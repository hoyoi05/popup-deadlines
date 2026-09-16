import test from 'node:test';
import assert from 'node:assert/strict';
import {kstDate,timestamp,hasPassed,eventState,bookingState,nextMilestone,countdown,selectPopups,formatDate,groupPopupsByMilestone} from '../docs/assets/core.js';
const now=Date.parse('2026-09-15T12:00:00+09:00');
const base={id:'p',title:'마녀공장 팝업',brand:'ma:nyo',region:'성수',category:'미용',venue:'성수 연무장길',event:{start:'2026-09-10',end:'2026-09-20'},booking:{mode:'reservation',open:null,close:null,url:'https://example.com'}};
test('KST midnight is independent of host timezone',()=>{assert.equal(kstDate(Date.parse('2026-09-14T15:00:00Z')),'2026-09-15');assert.equal(timestamp('2026-09-15'),Date.parse('2026-09-14T15:00:00Z'));assert.equal(formatDate('2026-09-15T00:00:00+09:00'),'2026.09.15 00:00');});
test('Date-only end stays visible until the next Korean day; no fake seconds',()=>{assert.equal(hasPassed('2026-09-15',Date.parse('2026-09-15T23:59:59+09:00')),false);assert.equal(hasPassed('2026-09-15',Date.parse('2026-09-16T00:00:00+09:00')),true);assert.equal(countdown('2026-09-15',now),'오늘');assert.equal(countdown('2026-09-20',now),'D-5');});
test('Exact booking deadline wins over event end and expires at its boundary',()=>{const p={...base,booking:{...base.booking,close:'2026-09-16T18:00:00+09:00'}};assert.equal(nextMilestone(p,now).label,'예약 마감까지');assert.equal(countdown(p.booking.close,now),'1일 06:00:00');assert.equal(bookingState(p,timestamp(p.booking.close)),'예약 접수 종료');assert.equal(nextMilestone(p,timestamp(p.booking.close)).label,'행사 종료까지');});
test('Unknown booking deadline never inherits an event or visit end',()=>{const p={...base,booking:{...base.booking,visitEnd:'2026-09-16'}};assert.equal(nextMilestone(p,now).label,'행사 종료까지');assert.equal(bookingState(p,now),'예약처에서 확인');assert.equal(p.booking.close,null);assert.equal(bookingState(p,Date.parse('2026-09-17T00:00:00+09:00')),'사전예약 방문 기간 종료');});
test('Future booking open is shown before any later deadline',()=>{const p={...base,booking:{...base.booking,open:'2026-09-16T18:00:00+09:00',close:'2026-09-18T18:00:00+09:00'}};assert.equal(nextMilestone(p,now).label,'예약 오픈까지');assert.equal(bookingState(p,now),'예약 오픈 예정');assert.equal(nextMilestone(p,timestamp(p.booking.open)).label,'예약 마감까지');});
test('Unknown, walk-in, cancelled and ended states remain distinct',()=>{assert.equal(bookingState({...base,booking:{mode:'unknown'}},now),'예약 방식 확인 필요');assert.equal(bookingState({...base,booking:{mode:'walk-in'}},now),'현장 방문');assert.equal(nextMilestone({...base,cancelled:true},now),null);assert.equal(eventState({...base,cancelled:true},now),'행사 취소');assert.equal(nextMilestone(base,Date.parse('2026-09-21T00:00:00+09:00')),null);});
test('Search ANDs words, region and category filters and excludes ended events',()=>{const filters={query:'ma:nyo 성수',region:'성수',category:'미용',sort:'deadline',view:'active'};assert.deepEqual(selectPopups([base,{...base,id:'other',region:'수원'}],filters,now).map(p=>p.id),['p']);assert.equal(selectPopups([base],{...filters,query:'없는 검색어'},now).length,0);assert.equal(selectPopups([base],{...filters,view:'ended'},now).length,0);});
test('Earliest future milestone sorts first, missing dates last',()=>{const a={...base,id:'a',event:{start:'2026-09-01',end:null}};const b={...base,id:'b',booking:{...base.booking,close:'2026-09-16T18:00:00+09:00'}};const f={query:'',region:'',category:'',sort:'deadline',view:'active'};assert.deepEqual(selectPopups([a,base,b],f,now).map(p=>p.id),['b','p','a']);});
test('Exact event closing boundary archives immediately',()=>{const p={...base,event:{start:'2026-09-15T11:00:00+09:00',end:'2026-09-15T20:00:00+09:00'}};assert.equal(eventState(p,timestamp(p.event.end)-1),'행사 진행 기간');assert.equal(eventState(p,timestamp(p.event.end)),'행사 종료');});

test('Seoul district selection uses location, not store name, and combines with category',()=>{
  const items=[{...base,id:'hongdae',city:'서울',district:'마포구',region:'홍대·연남·합정'},{...base,id:'department',city:'서울',district:'서초구',region:'반포·서초',venue:'신세계 강남점',category:'의류'},{...base,id:'suwon',city:'경기',district:'수원시',region:'수원'}];
  const f={query:'',region:'',category:'',view:'active',sort:'name'};
  assert.equal(selectPopups(items,{...f,area:'seoul'},now).length,2);
  assert.deepEqual(selectPopups(items,{...f,area:'마포구',category:'미용'},now).map(p=>p.id),['hongdae']);
  assert.deepEqual(selectPopups(items,{...f,area:'서초구',query:'강남'},now).map(p=>p.id),['department']);
  assert.equal(selectPopups(items,{...f,area:'강남구'},now).length,0);
  assert.deepEqual(selectPopups(items,{...f,area:'nearby'},now).map(p=>p.id),['suwon']);
  assert.equal(selectPopups(items,{...f,area:'중랑구'},now).length,0);
});

test('Countdown groups stay separate, preserve sorting, and do not duplicate events',()=>{
  const upcoming={...base,id:'upcoming',event:{start:'2026-09-16',end:'2026-09-30'}};
  const unknown={...base,id:'unknown',event:{start:'2026-09-01',end:null}};
  const booking={...base,id:'booking',booking:{...base.booking,close:'2026-09-16T18:00:00+09:00'}};
  const second={...base,id:'second'};
  const groups=groupPopupsByMilestone([upcoming,base,unknown,booking,second],now);
  assert.deepEqual(groups.map(g=>[g.id,g.items.map(p=>p.id)]),[['event-end',['p','second']],['event-start',['upcoming']],['booking-close',['booking']],['unknown',['unknown']]]);
  for(const g of groups)for(const p of g.items)assert.equal(nextMilestone(p,now)?.label||'일정 확인 필요',g.title);
});

test('Opening moves a popup into the ending group at the Korean date or exact opening time',()=>{
  for(const start of ['2026-09-16','2026-09-16T11:00:00+09:00']){
    const p={...base,event:{start,end:'2026-09-20'}};
    assert.equal(groupPopupsByMilestone([p],timestamp(start)-1)[0].id,'event-start');
    assert.equal(groupPopupsByMilestone([p],timestamp(start))[0].id,'event-end');
  }
  assert.deepEqual(groupPopupsByMilestone([{...base,cancelled:true}],now),[]);
  assert.deepEqual(groupPopupsByMilestone([base],timestamp('2026-09-21')),[]);
});
