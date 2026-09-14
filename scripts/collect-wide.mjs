import fs from 'node:fs/promises';
import {load} from 'cheerio';
import {fetchSource,hash,plain,districtsFor} from './collector-lib.mjs';
import {publicUrl,socialUrl,socialLinks,socialMeta,sitemapEntries,jsonEvents,popgaEvent,aggregateRecord,findDuplicate,sameDates,normalized} from './wide-lib.mjs';
import {kstDate,timestamp,DAY} from '../docs/assets/core.js';
const root=new URL('../',import.meta.url),now=Date.now(),stamp=new Date(now).toISOString();
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(new URL(p,root),'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback)return fallback;throw e;}};
const write=async(p,v)=>{const u=new URL(p,root),temp=new URL(p+'.tmp',root);await fs.writeFile(temp,JSON.stringify(v,null,2)+'\n');await fs.rename(temp,u);};
const [config,data,coverage,state,report]=await Promise.all([read('data/wide-sources.json'),read('docs/data/popups.json'),read('docs/data/coverage.json'),read('data/wide-state.json',{pages:{},social:{}}),read('docs/data/discovery.json')]);
const candidates=new Map(report.candidates.map(c=>[c.id,{...c,title:c.title.trim()||'행사명 확인 필요'}]));
const oldWideSources=new Set([...config.sources.map(s=>s.id),'social-public']);
report.sources=report.sources.filter(s=>!oldWideSources.has(s.id));
const stats={checkedAt:stamp,pagesRead:0,structuredEvents:0,added:0,updated:0,duplicates:0,socialDiscovered:0,socialRead:0,socialLimited:0,pendingPages:0,pendingSocial:0};
const social=new Map(),records=[],sourceReports=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function pool(items,fn,size=3){let cursor=0;await Promise.all(Array.from({length:Math.min(size,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];await fn(item);await sleep(80);}}));}
function candidate(url,title,source,reason,extra={}){
  title=String(title||'').trim()||'행사명 확인 필요';
  const id='wide-candidate-'+hash(url+'|'+title).slice(0,16),old=candidates.get(id);
  if(old&&/불일치|충돌/.test(old.reason)&&!/불일치|충돌/.test(reason)){old.lastSeenAt=stamp;return old;}
  const c={id,url,title:String(title).slice(0,160),source,reason,detectedAt:old?.detectedAt||stamp,lastSeenAt:stamp,districts:extra.districts||[],...extra};candidates.set(id,c);return c;
}
function removeCandidate(url,title){const id='wide-candidate-'+hash(url+'|'+title).slice(0,16);if(!/불일치|충돌/.test(candidates.get(id)?.reason||''))candidates.delete(id);}
function queueSocial(url,context){const clean=socialUrl(url);if(!clean)return;const list=social.get(clean)||[];list.push(context);social.set(clean,list);}
function registerEvents(html,url,source,summary){
  const events=source.adapter==='popga'?popgaEvent(html):jsonEvents(html),links=socialLinks(html);
  if(events.length===1&&source.id==='popply'){const $=load(html);events[0].keywords=$('h1').first().parent().text().slice(0,2000);}
  if(!events.length){if(source.adapter!=='review'){summary.unparsed=(summary.unparsed||0)+1;}return {end:null,parsed:false};}
  for(const e of events){
    stats.structuredEvents++;
    const outcome=aggregateRecord(e,url,source,coverage,now);
    if(outcome.skip)continue;
    const title=plain(e.name||'팝업 공지'),context={url,title,source:source.label,record:outcome.record||null};
    if(!outcome.record)for(const old of data.popups){
      if(old.verification==='secondary'&&old.collection&&old.sources[0].url===url&&(url!=='https://popupnavi.com/'||normalized(old.title)===normalized(title)))old.collection.conflict=true;
    }
    // Links from a page containing multiple events are not assigned to every event.
    const linked=events.length===1?links:[];
    if(socialUrl(e.url))linked.push(socialUrl(e.url));
    for(const link of [...new Set(linked)])queueSocial(link,context);
    if(source.adapter==='review'||!outcome.record){candidate(url,title,source.label,outcome.reason||'모음 사이트 원문·날짜 교차 확인 필요',{districts:outcome.record?[outcome.record.district]:districtsFor(JSON.stringify(e.location||''),coverage),event:outcome.record?.event||null,category:outcome.record?.category||null,relatedUrls:linked});continue;}
    outcome.record.sources.push(...[...new Set(linked)].map(link=>({kind:'secondary',label:'연결된 SNS 게시물',url:link,note:'모음 페이지에 연결된 SNS 원문. 읽기 결과와 공식 계정 여부는 별도로 확인합니다.'})));
    records.push(outcome.record);
  }
  return {end:events.map(e=>String(e.endDate||'').slice(0,10)).filter(Boolean).sort().at(-1)||null,parsed:true};
}
async function collectSource(source){
  const summary={id:source.id,label:source.label,url:source.url,status:'ok',discovered:0,reviewed:0,errors:[],pending:0};sourceReports.push(summary);
  try{
    const first=await fetchSource(source.url,source);
    if(source.type==='blog'){
      const $=load(first,{xml:true});if(!$('rss channel').length)throw Error('RSS 형식 확인 필요');
      for(const el of $('item').toArray()){
        const row=$(el),title=plain(row.find('title').text()),date=Date.parse(row.find('pubDate').text());
        if(!/팝업|pop.?up/i.test(title)||!Number.isFinite(date)||date<now-60*DAY)continue;
        const url=publicUrl(row.find('link').text());if(!url||new URL(url).hostname!=='blog.naver.com')continue;
        const description=row.find('description').text();summary.discovered++;summary.reviewed++;
        candidate(url,title,source.label,'블로그에서 발견 · 개별 행사·SNS 원문 확인 필요',{districts:districtsFor(plain(description),coverage)});
        for(const link of socialLinks(description))queueSocial(link,{url,title,source:source.label});
      }
      return;
    }
    if(source.type==='page'){summary.discovered=1;registerEvents(first,source.url,source,summary);summary.reviewed=1;stats.pagesRead++;return;}
    const entries=sitemapEntries(first,source);let pages=entries.pages;
    for(const map of entries.maps){try{pages.push(...sitemapEntries(await fetchSource(map,source),source).pages);}catch(e){summary.errors.push('하위 사이트맵: '+e.message);}}
    pages=[...new Map(pages.map(p=>[p.url,p])).values()];summary.discovered=pages.length;
    const currentUrls=new Set(data.popups.filter(p=>!p.event.end||timestamp(p.event.end,true)>=now).flatMap(p=>p.sources.map(s=>s.url)));
    for(const [url,cached] of Object.entries(state.pages))if(cached.end&&timestamp(cached.end,true)>=now)currentUrls.add(url);
    const ordered=pages.filter(p=>{const cached=state.pages[p.url];return !cached||cached.modified!==p.modified||currentUrls.has(p.url)||!cached.parsed&&Date.parse(cached.checkedAt)<now-7*DAY;}).sort((a,b)=>{
      // Existing active events and new high-numbered entries first; old pages are resumable backfill.
      const ap=currentUrls.has(a.url)?2:!state.pages[a.url]?1:0,bp=currentUrls.has(b.url)?2:!state.pages[b.url]?1:0;
      return bp-ap||Number(b.url.match(/\d+\/?$/)?.[0].replace('/',''))-Number(a.url.match(/\d+\/?$/)?.[0].replace('/',''));
    });
    const budget=Number(process.env.WIDE_PAGE_BUDGET||source.budget);
    const active=ordered.filter(p=>currentUrls.has(p.url)).sort((a,b)=>(state.pages[a.url]?.checkedAt||'').localeCompare(state.pages[b.url]?.checkedAt||''));
    const newPages=ordered.filter(p=>!currentUrls.has(p.url));
    // Reserve room for new announcements even when there are many ongoing events.
    const selected=[...active.slice(0,Math.ceil(budget/2)),...newPages.slice(0,Math.floor(budget/2))];
    const selectedUrls=new Set(selected.map(p=>p.url));for(const p of [...active,...newPages])if(selected.length<budget&&!selectedUrls.has(p.url)){selected.push(p);selectedUrls.add(p.url);}
    summary.pending=ordered.length-selected.length;stats.pendingPages+=summary.pending;
    if(summary.pending)summary.status='partial';
    let throttled=false;
    await pool(selected,async p=>{
      if(throttled){summary.pending++;stats.pendingPages++;return;}
      try{const html=await fetchSource(p.url,source);const result=registerEvents(html,p.url,source,summary);state.pages[p.url]={modified:p.modified,checkedAt:stamp,...result};summary.reviewed++;stats.pagesRead++;}
      catch(e){summary.errors.push(p.url+': '+e.message);if(/HTTP 429/.test(e.message))throttled=true;}
      if(summary.reviewed&&summary.reviewed%100===0)console.log(`${source.id}: ${summary.reviewed}/${selected.length}`);
    });
    if(summary.unparsed)summary.errors.push(`${summary.unparsed}개 페이지의 일정 형식 확인 필요`);
  }catch(e){summary.status='error';summary.errors.push(e.message);}
  finally{if(summary.errors.length&&summary.status==='ok')summary.status='partial';console.log(`${source.id}: ${summary.status}, ${summary.reviewed} documents, ${summary.pending} pending`);}
}
// Independent sites in parallel, with at most three requests in flight to each site.
await pool(config.sources,collectSource,2);
const socialSummary={id:'social-public',label:'Instagram·X·Threads 공개 원문',url:'https://www.instagram.com/',status:'ok',discovered:social.size,reviewed:0,errors:[],pending:0};
stats.socialDiscovered=social.size;
const socialEntries=[...social.entries()].sort(([a],[b])=>(state.social[a]?.attemptedAt||state.social[a]?.checkedAt||'').localeCompare(state.social[b]?.attemptedAt||state.social[b]?.checkedAt||''));const socialBudget=Number(process.env.WIDE_SOCIAL_BUDGET||config.socialBudget);
const throttledHosts=new Set(),consecutiveFailures=new Map();
stats.pendingSocial=socialSummary.pending=Math.max(0,socialEntries.length-socialBudget);
await pool(socialEntries.slice(0,socialBudget),async([url,contexts])=>{
  const socialHost=new URL(url).hostname;
  if(throttledHosts.has(socialHost)){stats.pendingSocial++;socialSummary.pending++;return;}
  try{
    const host=new URL(url).hostname;if(!config.socialHosts.includes(host))throw Error('지원 전 SNS 출처');
    const meta=socialMeta(await fetchSource(url,{url,host}));if(!meta)throw Error('공개 본문을 읽지 못함 · 이미지/로그인 확인 필요');
    stats.socialRead++;socialSummary.reviewed++;
    consecutiveFailures.set(socialHost,0);
    state.social[url]={checkedAt:stamp,author:meta.author,hash:meta.fingerprint,status:'read'};
    const verified=config.verifiedAccounts.find(a=>a.platform==='instagram'&&a.handle===meta.author);
    for(const c of contexts){
      const r=c.record;
      if(r){
        const evidence=r.sources.find(s=>s.url===url);if(evidence){evidence.label=verified?verified.label+' 공식 Instagram':'SNS 공개 본문 확인';evidence.note='공개 게시물 본문을 읽었습니다. '+(meta.author?'게시 계정: @'+meta.author+'. ':'')+'예약 접수 마감은 자동 추정하지 않습니다.';}
        if(meta.ranges.length===1&&!sameDates(r.event,meta.ranges[0])){
          r.collection.conflict=true;candidate(c.url,c.title,c.source,'SNS 본문과 모음 사이트의 행사 기간 불일치',{districts:[r.district],event:r.event,otherEvent:meta.ranges[0],category:r.category,relatedUrls:[url]});
        }else if(meta.ranges.length===1&&r.event.start&&r.event.end&&sameDates(r.event,meta.ranges[0])&&verified&&meta.description.includes(r.district)){
          r.verification='official';r.collection.method='official-social-match';if(evidence)evidence.kind='official';r.booking.note='주최 측 공개 SNS 본문에서 행사 기간과 자치구가 일치함을 확인했습니다. 예약 접수 일정은 별도 확인 전까지 미공개로 둡니다.';
        }
      }
      if(!r)candidate(url,c.title,c.source,'SNS 본문 확인 · 행사별 날짜·장소 검토 필요',{districts:districtsFor(meta.description,coverage),relatedUrls:[c.url]});
    }
  }catch(e){
    stats.socialLimited++;state.social[url]={...state.social[url],attemptedAt:stamp,status:'limited'};socialSummary.errors.push(url+': '+e.message);
    consecutiveFailures.set(socialHost,(consecutiveFailures.get(socialHost)||0)+1);
    if(/HTTP 429/.test(e.message)||consecutiveFailures.get(socialHost)>=12)throttledHosts.add(socialHost);
    for(const c of contexts)candidate(url,c.title,c.source,'SNS 공개 본문 확인 제한 · 이미지·로그인 확인 필요',{districts:c.record?[c.record.district]:[],category:c.record?.category||null,event:c.record?.event||null,relatedUrls:[c.url]});
  }
  if((stats.socialRead+stats.socialLimited)%50===0)console.log(`SNS: ${stats.socialRead} read, ${stats.socialLimited} limited / ${socialEntries.length}`);
});
if(stats.socialLimited||stats.pendingSocial)socialSummary.status='partial';sourceReports.push(socialSummary);

records.sort((a,b)=>(b.verification==='official')-(a.verification==='official'));
const socialConflicts=records.filter(r=>r.collection.conflict);
for(const r of records){
  const alias=config.eventAliases?.find(a=>a.sourceUrl===r.sources[0].url&&a.start===r.event.start&&a.end===r.event.end);
  const existing=(alias&&data.popups.find(p=>p.id===alias.canonicalId))||findDuplicate(data.popups,r);
  if(r.collection.conflict||(r.verification==='secondary'&&socialConflicts.some(c=>findDuplicate([c],r)))){
    if(existing?.verification==='secondary')existing.collection.conflict=true;
    continue;
  }
  if(existing){
    stats.duplicates++;
    if(existing.verification==='secondary'&&r.verification==='official'){
      Object.assign(existing,r,{id:existing.id});stats.updated++;removeCandidate(r.sources[0].url,r.title);continue;
    }
    if(!sameDates(existing.event,r.event)){
      if(existing.verification==='secondary'&&existing.collection)existing.collection.conflict=true;
      candidate(r.sources[0].url,r.title,r.sources[0].label,'등록된 행사와 날짜 불일치 · 기존 일정 보존',{districts:[r.district],event:r.event,otherEvent:existing.event,category:r.category,relatedUrls:existing.sources.map(s=>s.url)});continue;
    }
    if(existing.collection?.method==='public-listing'&&existing.sources[0].url===r.sources[0].url){const conflict=existing.collection.conflict;Object.assign(existing,r,{id:existing.id});if(conflict)existing.collection.conflict=true;stats.updated++;}
    else if(existing.collection?.method==='public-listing'&&r.verification==='official'){Object.assign(existing,r,{id:existing.id});stats.updated++;}
    if(!existing.collection?.conflict)removeCandidate(r.sources[0].url,r.title);continue;
  }
  // Keep possible spelling variants for review instead of publishing duplicate visits.
  const similar=data.popups.find(p=>p.district===r.district&&p.event.end?.slice(0,10)===r.event.end&&(!p.event.start||!r.event.start||p.event.start.slice(0,10)===r.event.start)&&((normalized(p.brand).length>=3&&(normalized(r.title).includes(normalized(p.brand))||normalized(p.title).includes(normalized(r.brand))))||(Math.min(normalized(p.title).length,normalized(r.title).length)>=5&&(normalized(p.title).includes(normalized(r.title))||normalized(r.title).includes(normalized(p.title))))));
  if(similar){stats.duplicates++;candidate(r.sources[0].url,r.title,r.sources[0].label,'등록 행사와 유사 · 브랜드·장소 중복 검토',{districts:[r.district],event:r.event,category:r.category,relatedUrls:similar.sources.map(s=>s.url)});continue;}
  data.popups.push(r);stats.added++;removeCandidate(r.sources[0].url,r.title);
}
report.sources.push(...sourceReports);report.status=report.sources.some(s=>s.status!=='ok')?'partial':'ok';report.checkedAt=stamp;
report.wide=stats;
report.candidates=[...candidates.values()].filter(c=>Date.parse(c.lastSeenAt)>now-120*DAY).sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt)||a.id.localeCompare(b.id));report.reviewCount=report.candidates.length;
data.checkedAt=data.popups.reduce((latest,p)=>p.checkedAt>latest?p.checkedAt:latest,data.checkedAt);
await write('docs/data/popups.json',data);await write('docs/data/discovery.json',report);await write('data/wide-state.json',state);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`\n## 공개 모음·SNS 확장 수집\n\n문서 ${stats.pagesRead}개 · 구조화 일정 ${stats.structuredEvents}개 · 추가 ${stats.added}개 · SNS 본문 ${stats.socialRead}/${stats.socialDiscovered}개 · 미처리 페이지 ${stats.pendingPages}개\n\n수집 제한과 검토 대기는 공개 사이트에 표시합니다. 미처리 페이지는 다음 실행에서 이어서 확인합니다.\n`);
console.log(JSON.stringify(stats));
