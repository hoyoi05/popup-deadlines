import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,eventDates,parseOfficial,mergeEvent,sourceUrl,fetchSource} from '../scripts/collector-lib.mjs';
const source={id:'ssg',label:'공식 테스트 공지',host:'www.shinsegaegroupnewsroom.com',url:'https://www.shinsegaegroupnewsroom.com/feed/',type:'rss',adapter:'ssg'};
const publishedAt='2026-09-10T01:00:00Z',now=Date.parse('2026-09-15T00:00:00+09:00');
const item={title:'여성복 브랜드 A, 성수 팝업스토어',url:'https://www.shinsegaegroupnewsroom.com/test-popup/',publishedAt,body:'<p>여성복 브랜드 A가 새 컬렉션을 소개한다.</p><p>오는 10월 11일까지 서울 성수동에서 팝업스토어를 운영한다.</p>'};

test('RSS preserves CDATA content, decodes titles and only accepts same-host HTTPS article links',()=>{
  const xml='<rss><channel><item><title>A &amp; B 팝업</title><link>https://www.shinsegaegroupnewsroom.com/a/</link><content:encoded><![CDATA[<p>행사 본문</p>]]></content:encoded><pubDate>Thu, 10 Sep 2026 01:00:00 GMT</pubDate></item><item><title>팝업 광고</title><link>https://evil.example/</link></item></channel></rss>';
  const found=discover(xml,source);assert.equal(found.length,1);assert.equal(found[0].title,'A & B 팝업');assert.equal(found[0].body,'<p>행사 본문</p>');
});
test('Date parser keeps missing starts unknown and separates reservations, gifts and article dates',()=>{
  assert.deepEqual(eventDates('오는 10월 11일까지 서울 성수에서 팝업스토어를 운영한다.',publishedAt),{start:null,end:'2026-10-11'});
  assert.deepEqual(eventDates('9월 11일부터 20일까지 서울에서 팝업을 연다.',publishedAt),{start:'2026-09-11',end:'2026-09-20'});
  assert.equal(eventDates('팝업 사전예약 접수는 9월 11일부터 20일까지다.',publishedAt),null);
  assert.equal(eventDates('팝업 구매 고객 사은품은 9월 30일까지 증정한다.',publishedAt),null);
  assert.equal(eventDates('오는 12일부터 16일까지 팝업을 운영한다.',publishedAt),null);
  assert.equal(eventDates('9월 31일까지 팝업을 운영한다.',publishedAt),null);
  assert.equal(eventDates('2025년 9월 20일까지 팝업을 운영했다.',publishedAt),null);
  assert.equal(eventDates('12월 20일부터 1월 5일까지 팝업을 연다.',publishedAt),null);
});
test('Official adapter imports supported evidence with no fabricated booking details',()=>{
  const p=parseOfficial(item,source,now);assert.equal(p.district,'성동구');assert.equal(p.category,'의류');assert.equal(p.event.start,null);assert.equal(p.event.end,'2026-10-11');assert.equal(p.booking.close,null);assert.equal(p.booking.open,null);assert.equal(p.booking.mode,'unknown');assert.equal(p.collection.method,'official-text-rule');
});
test('Ambiguous multiple schedules, overseas events and unsupported sources remain review candidates',()=>{
  assert.equal(parseOfficial({...item,body:item.body+'<p>9월 15일부터 20일까지 서울 성수에서 팝업을 연다.</p>'},source,now),null);
  assert.equal(parseOfficial({...item,body:item.body.replace('서울 성수동','도쿄')},source,now),null);
  assert.equal(parseOfficial(item,{...source,adapter:null},now),null);
  assert.equal(parseOfficial({...item,publishedAt:null},source,now),null);
  assert.equal(parseOfficial({...item,body:'<p>팝업 개최가 취소되었습니다.</p>'+item.body},source,now),null);
  assert.equal(parseOfficial(item,source,Date.parse('2026-10-12')),null);
});
test('Matching source URLs prevent duplicates and preserve manually verified dates and booking',()=>{
  const parsed=parseOfficial(item,source,now),manual={...structuredClone(parsed),event:{start:'2026-09-01',end:'2026-10-10'},booking:{close:'2026-09-20',mode:'reservation'}};delete manual.collection;
  const list=[manual],before=JSON.stringify(list);assert.equal(mergeEvent(list,parsed),'curated');assert.equal(JSON.stringify(list),before);
  const fresh=[];assert.equal(mergeEvent(fresh,parsed),'added');assert.equal(mergeEvent(fresh,{...parsed,event:{start:null,end:'2026-10-12'}}),'updated');assert.equal(fresh.length,1);assert.equal(fresh[0].event.end,'2026-10-12');
});
test('Network boundaries reject credentials, foreign ports and redirects before any outside fetch',async()=>{
  assert.equal(sourceUrl('https://u:p@www.shinsegaegroupnewsroom.com/a',source),null);
  assert.equal(sourceUrl('https://www.shinsegaegroupnewsroom.com:8080/a',source),null);
  let calls=0;await assert.rejects(fetchSource(source.url,source,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/secret'}});}),/리디렉션/);assert.equal(calls,1);
});
