export const DAY = 86400000;
export const KST = 9 * 3600000;
export function kstDate(now = Date.now()) { return new Date(now + KST).toISOString().slice(0, 10); }
export function dateOnly(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); }
export function timestamp(value, endOfDay = false) {
  if (!value) return null;
  return dateOnly(value) ? Date.parse(value + 'T00:00:00+09:00') + (endOfDay ? DAY : 0) : Date.parse(value);
}
export function hasPassed(value, now) { return value ? now >= timestamp(value, dateOnly(value)) : false; }
export function eventEnded(p, now) { return hasPassed(p.event.end, now); }
export function eventState(p, now) {
  if (p.cancelled) return '행사 취소';
  if (eventEnded(p, now)) return '행사 종료';
  if (p.event.start && now < timestamp(p.event.start)) return '오픈 예정';
  return p.event.start ? '행사 진행 기간' : '시작일 확인 필요';
}
export function bookingState(p, now) {
  const b=p.booking;
  if(p.cancelled || eventEnded(p,now)) return '접수 대상 행사 종료';
  if(b.mode==='walk-in') return '현장 방문';
  if(b.visitEnd && hasPassed(b.visitEnd,now)) return '사전예약 방문 기간 종료';
  if(b.close && hasPassed(b.close,now)) return '예약 접수 종료';
  if(b.open && now < timestamp(b.open)) return '예약 오픈 예정';
  return b.url ? '예약처에서 확인' : '예약 방식 확인 필요';
}
export function nextMilestone(p, now) {
  if (p.cancelled || eventEnded(p,now)) return null;
  const b=p.booking;
  if(b.open && now < timestamp(b.open)) return {label:'예약 오픈까지',value:b.open,type:'booking'};
  if(b.close && !hasPassed(b.close,now)) return {label:'예약 마감까지',value:b.close,type:'booking'};
  if(p.event.start && now < timestamp(p.event.start)) return {label:'행사 시작까지',value:p.event.start,type:'event'};
  return p.event.end ? {label:'행사 종료까지',value:p.event.end,type:'event'} : null;
}
export function countdown(value, now = Date.now()) {
  if(dateOnly(value)) {
    const days=Math.round((timestamp(value)-timestamp(kstDate(now)))/DAY);
    return days>0 ? `D-${days}` : days===0 ? '오늘' : '종료';
  }
  const seconds=Math.max(0,Math.floor((timestamp(value)-now)/1000));
  if(!seconds) return '도달';
  const pad=n=>String(n).padStart(2,'0');
  return `${Math.floor(seconds/86400)}일 ${pad(Math.floor(seconds/3600)%24)}:${pad(Math.floor(seconds/60)%60)}:${pad(seconds%60)}`;
}
export function formatDate(value) {
  if(!value) return '미공개';
  if(dateOnly(value)) return value.replaceAll('-','.');
  const f=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const get=t=>f.find(v=>v.type===t)?.value;
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}
export function selectPopups(popups, filters, now) {
  const tokens=filters.query.toLocaleLowerCase('ko').trim().split(/\s+/).filter(Boolean);
  return popups.filter(p=> {
    const ended=eventEnded(p,now)||p.cancelled;
    return !p.collection?.conflict && (filters.view==='ended' ? ended : !ended)
      && (filters.view!=='booking' || p.booking.mode==='reservation' || p.booking.mode==='mixed')
      && matchesArea(p,filters.area)
      && (!filters.region || p.region===filters.region)
      && (!filters.category || p.category===filters.category)
      && (!filters.verification || p.verification===filters.verification)
      && tokens.every(t=>`${p.title} ${p.brand} ${p.city||''} ${p.district||''} ${p.region} ${p.venue} ${p.address || ''} ${p.category}`.toLocaleLowerCase('ko').includes(t));
  }).sort((a,b)=> {
    if(filters.sort==='name') return a.title.localeCompare(b.title,'ko');
    let av,bv;
    if(filters.sort==='start') { av=timestamp(a.event.start); bv=timestamp(b.event.start); }
    else if(filters.sort==='end' || filters.view==='ended') { av=timestamp(a.event.end); bv=timestamp(b.event.end); }
    else { av=timestamp(nextMilestone(a,now)?.value); bv=timestamp(nextMilestone(b,now)?.value); }
    return ((av??Infinity)-(bv??Infinity)) * (filters.view==='ended' ? -1 : 1) || a.title.localeCompare(b.title,'ko');
  });
}
export function matchesArea(p,area) {
  if(!area)return true;
  if(area==='seoul')return p.city==='서울';
  if(area==='nearby')return ['경기','인천'].includes(p.city);
  return p.city==='서울'&&p.district===area;
}
