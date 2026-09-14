import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {jsonEvents,socialUrl,socialMeta,sitemapEntries,explicitRanges,aggregateRecord,findDuplicate,sameDates,locationFor,popgaEvent} from '../scripts/wide-lib.mjs';
import {selectPopups} from '../docs/assets/core.js';
const coverage=JSON.parse(await fs.readFile(new URL('../docs/data/coverage.json',import.meta.url),'utf8'));
const source={id:'sample',label:'공개 모음',host:'example.com',url:'https://example.com/sitemap.xml'};
const now=Date.parse('2026-09-15T09:00:00+09:00');
const event={'@type':'Event',name:'샘플 향수 팝업',startDate:'2026-09-10T00:00:00',endDate:'2026-09-20T00:00:00',location:{address:{addressRegion:'서울',addressLocality:'마포구',streetAddress:'양화로 188'}},description:'향수 시향 행사'};

test('Nested JSON-LD Event data is parsed without executing scripts or accepting arbitrary scripts',()=>{
  const html='<script>throw Error("must not run")</script><script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'ItemList',itemListElement:[{item:event}]}]})+'</script>';
  assert.deepEqual(jsonEvents(html),[event]);assert.deepEqual(jsonEvents('<script type="application/ld+json">not JSON</script>'),[]);
});
test('Only explicit valid years and ranges become dates; no publication-year inference or booking fields',()=>{
  assert.deepEqual(explicitRanges('2026.09.10(목) ~ 11.16(월)'),[{start:'2026-09-10',end:'2026-11-16'}]);
  assert.deepEqual(explicitRanges('26.09.10(목) - 10.16(금)'),[{start:'2026-09-10',end:'2026-10-16'}]);
  assert.deepEqual(explicitRanges('26.8.30 - 26.9.30'),[{start:'2026-08-30',end:'2026-09-30'}]);
  assert.deepEqual(explicitRanges('9.10 ~ 9.20'),[]);assert.deepEqual(explicitRanges('2026.09.31 ~ 10.01'),[]);assert.deepEqual(explicitRanges('2026.12.30 ~ 1.02'),[]);
});
test('Cross-domain source links are restricted to public post paths without credentials or tracking',()=>{
  assert.equal(socialUrl('https://instagram.com/p/AbC123/?igsh=tracking'),'https://www.instagram.com/p/AbC123/');
  assert.equal(socialUrl('https://x.com/brand/status/1234?s=20'),'https://x.com/brand/status/1234');
  for(const u of ['https://www.instagram.com/accounts/login/','https://user:pass@instagram.com/p/a/','https://instagram.com:8443/p/a/','http://127.0.0.1/a','https://instagram.com.evil.test/p/a/'])assert.equal(socialUrl(u),null);
});
test('Sitemaps retain modification evidence and cannot introduce an outside fetch target',()=>{
  const s=sitemapEntries('<urlset><url><loc>https://example.com/popup/1</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://other.test/popup/2</loc></url><url><loc>https://example.com/member/3</loc></url></urlset>',source);
  assert.deepEqual(s.pages,[{url:'https://example.com/popup/1',modified:'2026-09-01'}]);
});
test('SNS profile/login descriptions do not count as successfully read posts',()=>{
  assert.equal(socialMeta('<meta property="og:description" content="See Instagram photos and videos from user">'),null);
  const meta=socialMeta('<meta property="og:description" content="15 likes, 0 comments - brand on September 7, 2026: 2026.09.10 ~ 11.16 서울 마포구 팝업">');
  assert.equal(meta.author,'brand');assert.equal(meta.ranges[0].end,'2026-11-16');
});
test('Secondary schedules retain unknown reservations and omit invented closing dates',()=>{
  const p=aggregateRecord(event,'https://example.com/popup/1',source,coverage,now).record;
  assert.equal(p.verification,'secondary');assert.equal(p.district,'마포구');assert.equal(p.category,'향수');assert.equal(p.booking.open,null);assert.equal(p.booking.close,null);assert.equal(p.booking.url,null);
  const ongoing=aggregateRecord({...event,description:'종료일 미정'},'https://example.com/popup/2',source,coverage,now).record;assert.equal(ongoing.event.end,null);
  assert.equal(aggregateRecord({...event,eventStatus:'https://schema.org/EventCancelled'},source.url,source,coverage,now).record,undefined);
});
test('Conflicting Seoul districts and landmarks are kept for review; foreign locations are not imported',()=>{
  assert.equal(locationFor('서울 성동구 코엑스',coverage),null);assert.equal(locationFor('서울 강남구 반포동',coverage),null);assert.equal(locationFor('부산 해운대구',coverage),null);
  assert.equal(locationFor('서울 신세계 강남점',coverage).district,'서초구');
});
test('Shared collection index URLs never merge distinct events and different districts remain separate',()=>{
  const a=aggregateRecord(event,'https://popupnavi.com/',source,coverage,now).record;
  const b=aggregateRecord({...event,name:'다른 향수 팝업'},'https://popupnavi.com/',source,coverage,now).record;
  assert.equal(findDuplicate([a],b),undefined);assert.equal(findDuplicate([a],{...a,district:'성동구'}),undefined);
  const shared={kind:'secondary',url:'https://www.instagram.com/p/roundup/'};
  assert.equal(findDuplicate([{...a,sources:[...a.sources,shared]}],{...b,sources:[...b.sources,shared]}),undefined);
  assert.equal(findDuplicate([a],structuredClone(a)),a);assert.equal(sameDates(a.event,{start:a.event.start,end:'2026-10-20'}),false);
  assert.equal(findDuplicate([a],{...a,address:'서울 마포구 월드컵북로 396',venue:'서울 마포구 월드컵북로 396'}),undefined);
});
test('Popga visible field adapter reads only the event date and location section',()=>{
  const html='<meta property="og:title" content="샘플 팝업 - 홍대 팝업 | 팝가"><div><h3>위치</h3><p>서울 마포구 양화로 188</p></div><div><h3>일정</h3><p>26.09.10(목) - 09.20(일)</p></div><p>예약 2026.09.01 - 09.02</p>';
  const e=popgaEvent(html)[0];assert.equal(e.endDate,'2026-09-20');assert.equal(e.location.address,'서울 마포구 양화로 188');
});
test('Official-only filter excludes secondary records independently of category and area',()=>{
  const p=aggregateRecord(event,'https://example.com/popup/1',source,coverage,now).record;
  const f={query:'',area:'',region:'',category:'',view:'active',sort:'end',verification:'official'};
  assert.equal(selectPopups([p,{...p,id:'verified',verification:'official'}],f,now).length,1);
  assert.equal(selectPopups([{...p,collection:{...p.collection,conflict:true}}],{...f,verification:''},now).length,0);
});
