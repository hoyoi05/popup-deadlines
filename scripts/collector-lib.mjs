import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {kstDate,timestamp,DAY} from '../docs/assets/core.js';

export const hash=text=>createHash('sha256').update(text).digest('hex');
export const plain=html=>load(String(html||'')).text().replace(/\s+/g,' ').trim();
const popupPattern=/팝업|pop[ -]?up/i;
export function sourceUrl(value,source){
  try{const url=new URL(value,source.url);if(url.protocol!=='https:'||url.hostname!==source.host||url.port||url.username||url.password)return null;url.hash='';return url.href;}catch{return null;}
}
export async function fetchSource(url,source,fetcher=fetch){
  let target=sourceUrl(url,source);if(!target)throw Error('허용되지 않은 출처 주소');
  for(let i=0;i<5;i++){
    const response=await fetcher(target,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'PopupDeadlines/1.0 (+https://github.com/hoyoi05/popup-deadlines)','Accept':'text/html,application/rss+xml,application/xml'}});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');await response.body?.cancel();
      target=location&&sourceUrl(new URL(location,target).href,source);if(!target)throw Error('출처 밖 리디렉션 또는 로그인 확인 필요');continue;
    }
    if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>4*1024*1024)throw Error('문서 크기 제한 초과');chunks.push(chunk);}
    const html=Buffer.concat(chunks).toString('utf8');
    if(/<title>[^<]*(로그인|Access Denied|Just a moment)/i.test(html))throw Error('접근 제한 또는 로그인 필요');
    return html;
  }
  throw Error('리디렉션 횟수 제한');
}
export function discover(document,source){
  const $=load(document,{xml:source.type==='rss'}),items=[];
  if(source.type==='rss'){
    if(!$('rss channel').length)throw Error('RSS 문서 형식이 변경됨');
    $('item').each((_,el)=>{
      const row=$(el),title=plain(row.children('title').text());
      if(!popupPattern.test(title))return;
      const url=sourceUrl(row.children('link').text(),source);if(!url)return;
      const published=Date.parse(row.children('pubDate').text());
      items.push({url,title,publishedAt:Number.isFinite(published)?new Date(published).toISOString():null,body:row.children('content\\:encoded').text()||row.children('description').text()});
    });
  }else{
    $('a[href]').each((_,el)=>{
      const title=plain($(el).text()||$(el).find('img').attr('alt'));
      const url=sourceUrl($(el).attr('href'),source);
      if(url&&title.length>=6&&popupPattern.test(title)&&!/(입점|제휴|채용|모집|조직도)/.test(title)&&url!==source.url)items.push({url,title:title.slice(0,160),publishedAt:null,body:''});
    });
  }
  return [...new Map(items.map(item=>[item.url,item])).values()].slice(0,40);
}
export function articleInfo(html){
  const $=load(html);const article=$('article').first();
  const body=article.length?article.html():'';
  let publishedAt=$('meta[property="article:published_time"]').attr('content')||null;
  for(const script of $('script[type="application/ld+json"]').toArray()){
    try{const json=JSON.parse($(script).text());for(const node of [...(json['@graph']||[]),json])if(node.datePublished&&/Article/.test(String(node['@type'])))publishedAt=node.datePublished;}catch{}
  }
  return {body,title:plain($('h1').first().text()||$('h2').first().text()||$('title').text()),publishedAt,canonical:$('link[rel="canonical"]').attr('href')||null};
}
export function districtsFor(text,coverage){
  return coverage.districts.filter(d=>text.includes(d.name)||d.keywords.some(k=>new RegExp(`(^|[^가-힣])${k}(?:동|역|점|입구)?(?=[^가-힣]|$)`).test(text))).map(d=>d.name);
}
function day(year,month,date){
  const value=`${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
  return Number.isFinite(timestamp(value))&&kstDate(timestamp(value))===value?value:null;
}
// Only parse an explicit event-date sentence. Never infer a booking deadline.
export function eventDates(sentence,publishedAt){
  if(!popupPattern.test(sentence)||/사전예약|예약\s*접수|사은품|럭키드로우|구매\s*고객|증정|채용|모집/.test(sentence))return null;
  const pub=Date.parse(publishedAt);if(!Number.isFinite(pub))return null;
  const pubDate=kstDate(pub),year=Number(pubDate.slice(0,4));
  let start=null,end=null;
  const range=sentence.match(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일(?:\([^)]*\))?\s*부터\s*(?:(\d{1,2})월\s*)?(\d{1,2})일(?:\([^)]*\))?\s*까지/);
  if(range){
    if(range[1]&&Number(range[1])!==year)return null;
    start=day(year,Number(range[2]),Number(range[3]));end=day(year,Number(range[4]||range[2]),Number(range[5]));
    if(!start||!end||timestamp(start)>timestamp(end))return null;
  }else{
    const close=sentence.match(/(?:오는\s*)?(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일(?:\([^)]*\))?\s*까지/);
    if(!close||close[1]&&Number(close[1])!==year)return null;
    end=day(year,Number(close[2]),Number(close[3]));if(!end)return null;
  }
  if(timestamp(end)<timestamp(pubDate)||timestamp(end)-timestamp(pubDate)>120*DAY)return null;
  return {start,end};
}
function locationFor(text){
  if(/성수/.test(text)&&/서울/.test(text))return {city:'서울',district:'성동구',region:'성수',venue:'서울 성수동'};
  if(/강남점/.test(text))return {city:'서울',district:'서초구',region:'반포·서초',venue:'신세계백화점 강남점'+(text.match(/(?:본관\s*)?\d+층/)?.[0]?' '+text.match(/(?:본관\s*)?\d+층/)[0]:'')};
  if(/타임스퀘어점/.test(text))return {city:'서울',district:'영등포구',region:'영등포',venue:'신세계백화점 타임스퀘어점'};
  if(/서울.{0,8}본점|본점.{0,8}서울/.test(text))return {city:'서울',district:'중구',region:'명동·을지로',venue:'신세계백화점 본점'};
  return null;
}
function categoryFor(text){
  if(/헤어|바디\s*컬렉션|스킨케어|화장품|메이크업|클렌징/.test(text))return ['미용','beauty'];
  if(/향수|퍼퓸/.test(text))return ['향수','fragrance'];
  if(/여성복|남성\s*(상품|전용)|의류|패션\s*브랜드|룰루레몬|골프웨어/.test(text))return ['의류','fashion'];
  if(/테이블웨어|가구|공예|생활용품|식기/.test(text))return ['리빙','lifestyle'];
  if(/디저트|베이커리|식품|한과/.test(text))return ['푸드','food'];
  if(/캐릭터|포켓몬|이누야샤|게임/.test(text))return ['캐릭터·게임','character'];
  return null;
}
export function parseOfficial(item,source,now){
  if(source.adapter!=='ssg'||!sourceUrl(item.url,source)||!popupPattern.test(item.title))return null;
  const $=load(item.body),paragraphs=$('p').toArray().map(el=>plain($(el).text())).filter(Boolean).slice(0,5);
  if(!paragraphs.length)paragraphs.push(plain(item.body));
  const lead=paragraphs.slice(0,3).join(' ');
  if(/취소|연기|일정\s*변경|뉴욕|도쿄|일본|부산|대구|대전|광주|센텀시티|여러\s*점포|전국|전\s*점포/.test(lead))return null;
  const dates=paragraphs.map(p=>eventDates(p,item.publishedAt)).filter(Boolean);
  if(dates.length!==1)return null;
  const location=locationFor(paragraphs.find(p=>eventDates(p,item.publishedAt))||'');
  const category=categoryFor(lead);
  if(!location||!category||timestamp(dates[0].end,true)<=now)return null;
  const brand=(item.title.split(/[,，]/)[0]||'브랜드 확인 필요').slice(0,60);
  return {id:'auto-'+hash(item.url).slice(0,16),title:item.title.slice(0,140),brand,...location,category:category[0],tone:category[1],address:null,hours:null,event:dates[0],booking:{mode:'unknown',open:null,close:null,url:null,note:'공식 뉴스룸의 행사 기간 문장을 자동으로 읽었습니다. 예약 방식·접수 오픈·마감은 별도 검증 전까지 미공개로 유지합니다.'},verification:'official',checkedAt:kstDate(now),collection:{method:'official-text-rule',sourceId:source.id},sources:[{kind:'official',label:source.label,url:item.url,note:'공식 본문의 명시된 월·일과 개최 장소를 자동 규칙으로 추출. 게시일을 시작일로 사용하지 않으며 운영시간·예약 일정은 추정하지 않음.'}]};
}
export function mergeEvent(popups,parsed){
  if(!parsed)return 'review';
  const existing=popups.find(p=>p.sources.some(s=>s.url===parsed.sources[0].url));
  if(existing){
    // Human-curated records are never overwritten by the text adapter.
    if(!existing.collection)return 'curated';
    Object.assign(existing,{event:parsed.event,checkedAt:parsed.checkedAt});return 'updated';
  }
  popups.push(parsed);return 'added';
}
