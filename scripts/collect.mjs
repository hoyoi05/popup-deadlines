import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {kstDate,eventEnded} from '../docs/assets/core.js';
import {hash,plain,fetchSource,discover,articleInfo,districtsFor,parseOfficial,mergeEvent} from './collector-lib.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(path.join(root,file),'utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}};
const write=async(file,value)=>{const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target+'.tmp',JSON.stringify(value,null,2)+'\n');await fs.rename(target+'.tmp',target);};
const now=Date.now(),stamp=new Date(now).toISOString();
const [data,coverage,config,state,previous]=await Promise.all([read('docs/data/popups.json'),read('docs/data/coverage.json'),read('data/collector-sources.json'),read('data/collector-state.json',{pages:{}}),read('docs/data/discovery.json',{candidates:[]})]);
const candidates=new Map(previous.candidates.filter(p=>Date.parse(p.lastSeenAt)>now-120*86400000&&!/입점[·\s]*팝업\s*안내/.test(p.title)).map(p=>[p.url,p]));
state.aliases||={};
const seen=new Set(),report={checkedAt:stamp,status:'ok',sources:[],added:0,updated:0,reviewCount:0,candidates:[]};

function processItem(item,source){
  seen.add(item.url);
  const text=plain(item.body),fingerprint=hash(text),old=state.pages[item.url];
  if(/(?:미국|뉴욕|도쿄|일본|부산|대구|대전).{0,24}팝업|입점[·\s]*팝업\s*안내/.test(item.title)){candidates.delete(item.url);return;}
  const existing=data.popups.find(p=>p.sources.some(s=>s.url===item.url||state.aliases[s.url]===item.url));
  if(existing&&!text)return;
  const parsed=parseOfficial(item,source,now);
  const result=existing&&!existing.collection?'curated':mergeEvent(data.popups,parsed);
  if(result==='added')report.added++;
  if(result==='updated'&&(!old||old.hash!==fingerprint))report.updated++;
  const changed=old&&old.hash!==fingerprint;
  if(['added','updated'].includes(result))candidates.delete(item.url);
  else if(!existing||changed){
    const prior=candidates.get(item.url);
    candidates.set(item.url,{id:'candidate-'+hash(item.url).slice(0,16),title:item.title.slice(0,160),url:item.url,source:source.label,publishedAt:item.publishedAt||null,detectedAt:prior?.detectedAt||stamp,lastSeenAt:stamp,districts:districtsFor(item.title+' '+text.slice(0,1800),coverage),reason:existing?'등록 행사 공식 공지 변경 감지 · 일정 재검토 필요':'날짜·지점·예약 방식 검토 필요'});
  }else if(candidates.has(item.url)){
    const prior=candidates.get(item.url);prior.lastSeenAt=stamp;
  }
  state.pages[item.url]={hash:fingerprint,lastSeenAt:stamp};
}

async function inspectSource(source){
  const summary={id:source.id,label:source.label,url:source.url,status:'ok',discovered:0,reviewed:0,errors:[]};
  let items=[];
  try{
    const document=await fetchSource(source.url,source);items=discover(document,source);summary.discovered=items.length;
    if(source.type==='html'&&!items.length){summary.status='limited';summary.errors.push('정적 HTML에서 팝업 링크를 읽지 못함. 이미지·동적 공지는 별도 확인 필요.');}
  }catch(e){summary.status='error';summary.errors.push(e.message);return summary;}
  for(const item of items){
    if(item.publishedAt&&Date.parse(item.publishedAt)<now-120*86400000)continue;
    if(!item.body){try{const info=articleInfo(await fetchSource(item.url,source));item.body=info.body;item.publishedAt=info.publishedAt;}catch(e){summary.errors.push(`${item.title.slice(0,50)}: ${e.message}`);}}
    processItem(item,source);summary.reviewed++;
  }
  // Also revisit active records hosted by this connector, even after they leave the RSS feed.
  const activeUrls=[...new Set(data.popups.filter(p=>!eventEnded(p,now)).flatMap(p=>p.sources).filter(s=>new URL(s.url).hostname===source.host).map(s=>s.url))].filter(url=>!seen.has(url)).slice(0,30);
  for(const url of activeUrls){
    try{const info=articleInfo(await fetchSource(url,source));if(!info.body)throw Error('본문을 읽지 못함');if(info.canonical&&info.canonical!==url){state.aliases[url]=info.canonical;candidates.delete(info.canonical);}processItem({...info,url},source);summary.reviewed++;}
    catch(e){summary.errors.push(`${url}: ${e.message}`);}
  }
  if(summary.errors.length&&summary.status==='ok')summary.status='partial';
  return summary;
}

// Bounded batches keep each site's request stream sequential.
for(let i=0;i<config.sources.length;i+=3){
  const summaries=await Promise.all(config.sources.slice(i,i+3).map(inspectSource));
  report.sources.push(...summaries);
  for(const source of summaries)console.log(`${source.id}: ${source.status}; ${source.discovered} links, ${source.reviewed} documents`);
}
if(report.sources.every(s=>s.status==='error')){
  await write('work/collection-failure.json',report);throw Error('모든 출처 수집 실패. 기존 행사 데이터와 마지막 성공 상태를 보존합니다.');
}
report.status=report.sources.some(s=>s.status!=='ok')?'partial':'ok';
report.candidates=[...candidates.values()].sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt)||a.id.localeCompare(b.id));
report.reviewCount=report.candidates.length;
data.checkedAt=data.popups.reduce((latest,p)=>p.checkedAt>latest?p.checkedAt:latest,data.checkedAt);
state.pages=Object.fromEntries(Object.entries(state.pages).filter(([,p])=>Date.parse(p.lastSeenAt)>now-180*86400000));
await write('docs/data/popups.json',data);
await write('docs/data/discovery.json',report);
await write('data/collector-state.json',state);
const summary=`## 팝업 공지 수집 · ${kstDate(now)}\n\n- 새 일정: ${report.added}건\n- 자동 일정 변경: ${report.updated}건\n- 검토 대기: ${report.reviewCount}건\n- 출처 상태: ${report.sources.map(s=>`${s.label} (${s.status})`).join(', ')}\n\n원문의 예약 접수 마감은 자동 추정하지 않습니다. 전체 수집 상태와 후보는 docs/data/discovery.json을 확인하세요.\n`;
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(`Added ${report.added}; changed ${report.updated}; review ${report.reviewCount}.`);
