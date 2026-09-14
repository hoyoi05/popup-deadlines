import {load} from 'cheerio';
import {hash,plain,districtsFor} from './collector-lib.mjs';
import {kstDate,timestamp,DAY} from '../docs/assets/core.js';

export function publicUrl(value,base){
  try{const u=new URL(value,base);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(igsh|igshid|fbclid)$/.test(k))u.searchParams.delete(k);return u.href;}catch{return null;}
}
export function socialUrl(value){
  const href=publicUrl(value);if(!href)return null;const u=new URL(href);u.hostname=u.hostname.replace(/^www\./,'');
  if(u.hostname==='instagram.com'&&/^\/(p|reel)\/[\w-]+\/?$/.test(u.pathname)){u.hostname='www.instagram.com';u.pathname=u.pathname.replace(/\/?$/,'/');u.search='';return u.href;}
  if(['x.com','twitter.com'].includes(u.hostname)&&/^\/[\w]+\/status\/\d+\/?$/.test(u.pathname)){u.hostname='x.com';u.search='';return u.href;}
  if(['threads.com','threads.net'].includes(u.hostname)&&/^\/@[\w.]+\/post\/[\w-]+/.test(u.pathname)){u.hostname='www.threads.com';u.search='';return u.href;}
  return null;
}
export function jsonEvents(html){
  const $=load(html),events=[];
  function visit(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if([value['@type']].flat().includes('Event'))events.push(value);else for(const key of ['@graph','itemListElement','item'])visit(value[key]);}
  for(const s of $('script[type="application/ld+json"]').toArray())try{visit(JSON.parse($(s).text()));}catch{}
  return events;
}
export function socialLinks(html){const $=load(html);return [...new Set($('a[href]').map((_,a)=>socialUrl($(a).attr('href'))).get().filter(Boolean))];}
export function sitemapEntries(xml,source){
  const $=load(xml,{xml:true});if(!$('urlset,sitemapindex').length)throw Error('사이트맵 형식 확인 필요');
  const maps=$('sitemap loc').map((_,e)=>publicUrl($(e).text())).get().filter(u=>u&&new URL(u).hostname===source.host);
  const pages=$('url').map((_,e)=>({url:publicUrl($(e).find('loc').text()),modified:$(e).find('lastmod').text()||null})).get().filter(p=>p.url&&new URL(p.url).hostname===source.host&&/^\/popup\/\d+\/?$/.test(new URL(p.url).pathname));
  return {maps,pages};
}
export function isoDay(value){
  const m=String(value||'').match(/^(20\d{2})-(\d{2})-(\d{2})(?:T|$)/);if(!m)return null;const d=m.slice(1).join('-');return Number.isFinite(timestamp(d))&&kstDate(timestamp(d))===d?d:null;
}
export function explicitRanges(text){
  const ranges=[];
  // An explicit year is mandatory. The end year may only inherit within the same year.
  const re=/(?<!\d)(20\d{2}|\d{2})[.년/-]\s*(\d{1,2})[.월/-]\s*(\d{1,2})(?:일|\.)?\s*(?:\([^)]{1,5}\))?\s*(?:~|–|—|-|부터)\s*(?:(20\d{2}|\d{2})[.년/-]\s*(?=\d{1,2}[.월/-]\s*\d{1,2}))?(\d{1,2})[.월/-]\s*(\d{1,2})(?:일|\.)?/g;
  for(const m of text.matchAll(re)){
    const y=m[1].length===2?'20'+m[1]:m[1],endYear=m[4]?(m[4].length===2?'20'+m[4]:m[4]):y;
    const start=isoDay(`${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`),end=isoDay(`${endYear}-${m[5].padStart(2,'0')}-${m[6].padStart(2,'0')}`);
    if(start&&end&&start<=end)ranges.push({start,end});
  }
  return [...new Map(ranges.map(r=>[r.start+r.end,r])).values()];
}
export function socialMeta(html){
  const $=load(html),description=$('meta[property="og:description"]').attr('content')||$('meta[name="description"]').attr('content')||'';
  const title=$('meta[property="og:title"]').attr('content')||$('title').text();
  if(!description||/See Instagram photos and videos|Login|Log in to|Join X today|Sign up for|ログイン|로그인하세요/i.test(description))return null;
  const author=description.match(/(?:comments? - |^)([\w.]+) on [A-Z][a-z]+ \d{1,2}, 20\d{2}:/)?.[1]||null;
  return {title:plain(title).slice(0,160),description,author,ranges:explicitRanges(description),fingerprint:hash(description)};
}
export function categoryFor(text){
  if(/향수|퍼퓸|프래그런스|바이레도|퍼퓨라운지|프라포투투/i.test(text))return ['향수','fragrance'];
  if(/뷰티|미용|스킨케어|클렌징|화장품|메이크업|바디\s*컬렉션|토라젤|편한가|마녀공장|러쉬|바이오힐/i.test(text))return ['미용','beauty'];
  if(/패션|의류|파자마|주얼리|웨어|룰루레몬|김해김|오끼뜨|에이엔|아디다스|신발|액세서리/i.test(text))return ['의류','fashion'];
  if(/푸드|디저트|아이스크림|한과|젤라또|베이커리|쿠키|떡전|카페|음료|먹거리|소금빵|베이글|도넛|치킨|셰프|분식|라면|스낵|치즈|버거킹|카누/i.test(text))return ['푸드','food'];
  if(/캐릭터|애니|게임|스누피|포켓몬|산리오|이누야샤|토이스토리|귀멸|주술회전|맘마|치이카와|웹툰|만화/i.test(text))return ['캐릭터·게임','character'];
  if(/가구|공예|생활|리빙|테이블웨어|식기|의자|문구|인테리어|박그릇|현대기물|요기보/i.test(text))return ['리빙','lifestyle'];
  if(/앨범|음악|아이돌|엔터|아티스트|사진전|전시|매거진|NCT|아이브|아이즈|유진|원영/i.test(text))return ['음악·엔터','lifestyle'];
  return ['기타','lifestyle'];
}
export function locationFor(address,coverage){
  const text=address.replace(/서울특별시/g,'서울').replace(/\s+/g,' ').trim();
  if(!/^서울\s/.test(text))return null;
  const explicit=coverage.districts.filter(d=>text.includes(d.name)).map(d=>d.name);
  const landmarks=[[/성수|서울숲/,'성동구','성수'],[/홍대|연남|합정/,'마포구','홍대·연남·합정'],[/잠실|롯데월드|석촌/,'송파구','잠실'],[/더현대\s*서울|여의도/,'영등포구','여의도'],[/신세계.{0,6}강남|반포/,'서초구','반포·서초'],[/코엑스|가로수길|압구정|청담/,'강남구','강남·신사'],[/한남|아이파크몰|이태원/,'용산구','한남·용산'],[/신촌/,'서대문구','신촌'],[/명동|DDP|소공동/,'중구','명동·을지로'],[/북촌|서촌|광화문|익선/,'종로구','종로']];
  const matched=landmarks.filter(([r])=>r.test(text));
  if(explicit.length>1||new Set(matched.map(m=>m[1])).size>1)return null;
  if(explicit.length&&matched.length&&explicit[0]!==matched[0][1])return null;
  const district=explicit[0]||matched[0]?.[1];if(!district)return null;
  return {city:'서울',district,region:matched[0]?.[2]||district,address:text,venue:text};
}
export function popgaEvent(html){
  const $=load(html);const field=name=>$('h3').filter((_,e)=>$(e).text().trim()===name).first().parent();
  const date=field('일정').find('p').first().text(),ranges=explicitRanges(date);
  const loc=field('위치').find('p').map((_,e)=>$(e).text()).get().join(' ').trim()||field('위치').text().replace(/^위치/,'').trim();
  const title=$('h1').first().text().trim()||($('meta[property="og:title"]').attr('content')||'').replace(/ - [^-]+ 팝업 \| 팝가$/,'');
  if(!title||ranges.length!==1)return [];
  const description=$('meta[property="og:description"]').attr('content')||'';
  return [{'@type':'Event',name:title,startDate:ranges[0].start,endDate:ranges[0].end,location:{name:loc,address:loc},description,keywords:$('h1').first().parent().text().slice(0,500)}];
}
export function aggregateRecord(event,url,source,coverage,now){
  const name=plain(event.name||'').slice(0,160);if(!name)return {reason:'이름 확인 필요'};
  const description=plain(event.description||'');
  if(/취소|연기/.test(event.eventStatus||'' )||/EventCancelled|EventPostponed/.test(event.eventStatus||''))return {reason:'취소·연기 확인 필요'};
  const start=isoDay(event.startDate);let end=isoDay(event.endDate);
  if(/종료일?\s*(미정|미공개)|상시\s*(팝업|운영)|기간\s*미정/.test(description))end=null;
  if((event.startDate&&!start)||(event.endDate&&!isoDay(event.endDate))||(!start&&!end)||(start&&end&&start>end))return {reason:'행사 날짜 형식 확인 필요'};
  if(end&&timestamp(end,true)<now-14*DAY)return {skip:true};
  if(start&&timestamp(start)>now+180*DAY)return {skip:true};
  if(!end&&start&&timestamp(start)<now-180*DAY)return {reason:'종료일 미정의 오래된 공지 · 현재 운영 여부 확인 필요'};
  if(!/팝업|pop[ -]?up|페어|콜라보|쇼룸|플래그십/i.test(name+' '+description))return {reason:'팝업스토어에 해당하는 행사인지 확인 필요'};
  const a=event.location?.address;
  const address=typeof a==='string'?a:a?.streetAddress?[a.addressRegion,a.addressLocality,a.streetAddress].filter(Boolean).join(' '):a?.name||event.location?.name||'';
  const location=locationFor(address,coverage);if(!location)return {reason:'서울 개최 장소·자치구 확인 필요'};
  if(/출처별|엇갈|추정치|날짜.*불명확/.test(description))return {reason:'출처 간 날짜·위치 충돌 확인 필요'};
  const category=categoryFor(name+' '+String(event.keywords||'')+' '+description);
  const brand=plain(event.organizer?.name||name.replace(/\s*팝업.*$/,'')).slice(0,90)||name;
  const record={id:'wide-'+hash(url+'|'+name+'|'+location.district).slice(0,16),title:name,brand,...location,category:category[0],tone:category[1],hours:null,event:{start,end},booking:{mode:'unknown',open:null,close:null,url:null,note:'팝업 모음의 공개 일정에서 수집했습니다. 예약 방식·접수 기간은 공식 공지 확인 전까지 미확인으로 표시합니다.'},verification:'secondary',checkedAt:kstDate(now),collection:{method:'public-listing',sourceId:source.id},sources:[{kind:'secondary',label:source.label,url,note:'공개된 행사명·기간·위치만 수집. 주최 측 공식 확인 및 예약 접수 마감 검증 전 자료.'}]};
  return {record};
}
export const normalized=text=>String(text).toLowerCase().replace(/팝업스토어|팝업|popupstore|pop.?up|서울|스토어|\s|[^가-힣a-z0-9]/g,'');
export function samePlace(a,b){
  const clean=p=>String(p.address||p.venue||'').replace(/서울특별시/g,'서울').replace(/\s|[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
  const x=clean(a),y=clean(b);return x.length>=6&&y.length>=6&&(x.includes(y)||y.includes(x));
}
export function findDuplicate(popups,record){
  return popups.find(p=>p.city===record.city&&p.district===record.district&&((p.sources[0].url===record.sources[0].url&&p.sources[0].url!=='https://popupnavi.com/')||samePlace(p,record)&&normalized(p.title)===normalized(record.title)&&(!p.event.start||!record.event.start||p.event.start.slice(0,10)===record.event.start)));
}
export function sameDates(a,b){return ['start','end'].every(k=>!a[k]||!b[k]||a[k].slice(0,10)===b[k].slice(0,10));}
