import {DAY,kstDate,dateOnly,timestamp,eventEnded,eventState,bookingState,nextMilestone,countdown,formatDate,selectPopups,matchesArea,groupPopupsByMilestone} from './core.js?v=groups-1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?esc(u.href):null;}catch{return null;}};
const external=(url,label,classes='')=>safeUrl(url)?`<a class="${classes}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`:'';
let data,coverage;
const params=new URLSearchParams(location.search);
const filters={verification:['official','secondary'].includes(params.get('verification'))?params.get('verification'):'',query:params.get('q')||'',area:params.get('area')||'',region:params.get('region')||'',category:params.get('category')||'',view:['active','booking','ended'].includes(params.get('view'))?params.get('view'):'active',sort:['deadline','end','start','name'].includes(params.get('sort'))?params.get('sort'):'deadline'};
const compactFilters=matchMedia('(max-width:850px)');
$('#filter-panel').open=!compactFilters.matches;
compactFilters.addEventListener('change',e=>{$('#filter-panel').open=!e.matches;});
function syncUrl(){const p=new URLSearchParams();for(const [key,val] of Object.entries(filters))if(val && !((key==='view'&&val==='active')||(key==='sort'&&val==='deadline')))p.set(key==='query'?'q':key,val);history.replaceState(null,'',`${location.pathname}${p.size?'?'+p:''}${location.hash}`);}
function makeFilters(){
  const areas=[['','서울·수도권 전체'],['seoul','서울 전체'],['nearby','경기·인천'],...coverage.districts.map(d=>[d.name,d.name])];
  if(!areas.some(([value])=>value===filters.area))filters.area='';
  $('#area').innerHTML=areas.map(([value,label])=>`<option value="${esc(value)}" ${value===filters.area?'selected':''}>${esc(label)}</option>`).join('');
  const areaLabel=areas.find(([value])=>value===filters.area)[1];
  const regions=[...new Set(data.popups.filter(p=>matchesArea(p,filters.area)).map(p=>p.region))];
  const regionOrder=['홍대·연남·합정','성수','건대·광진','신촌','명동·을지로','종로','한남·용산','여의도','영등포','강남·신사','반포·서초','삼성·코엑스','잠실','수원'];
  regions.sort((a,b)=>(regionOrder.includes(a)?regionOrder.indexOf(a):999)-(regionOrder.includes(b)?regionOrder.indexOf(b):999)||a.localeCompare(b,'ko'));
  const categoryOrder=['미용','의류','향수','푸드','리빙','캐릭터·게임','음악·엔터'];
  const availableCategories=new Set(data.popups.map(p=>p.category));
  const categories=[...categoryOrder.filter(c=>availableCategories.has(c)),...[...availableCategories].filter(c=>!categoryOrder.includes(c))];
  if(!regions.includes(filters.region))filters.region='';if(!categories.includes(filters.category))filters.category='';
  $('#filter-selection').textContent=[filters.region||areaLabel,filters.category].filter(Boolean).join(' · ');
  $('#regions').innerHTML=['',...regions].map(r=>`<button type="button" data-region="${esc(r)}" aria-pressed="${r===filters.region}"><span>${esc(r||areaLabel)}</span><span class="region-count">${selectPopups(data.popups,{...filters,query:'',category:'',region:r},Date.now()).length}</span></button>`).join('');
  $('#categories').innerHTML=['',...categories].map(c=>`<button type="button" data-category="${esc(c)}" aria-pressed="${c===filters.category}">${esc(c||'전체')}</button>`).join('');
  $('#verification').value=filters.verification;$('#search').value=filters.query;$('#sort').value=filters.sort;
}
function card(p,now){
  const milestone=nextMilestone(p,now),ended=eventEnded(p,now)||p.cancelled;
  const verified=p.verification==='official';
  const age=Math.floor((timestamp(kstDate(now))-timestamp(p.checkedAt))/DAY);
  const b=p.booking;
  const closing=milestone && timestamp(milestone.value,dateOnly(milestone.value))-now <= 7*DAY;
  const sourceLinks=p.sources.map(s=>`<li>${external(s.url,s.label)}<span>${esc(s.note)}</span></li>`).join('');
  const mainLink=b.url&&!ended?external(b.url,'예약처 확인','action-link'):external(p.sources.find(s=>s.kind==='official')?.url||p.sources[0].url,'공지 확인','action-link secondary');
  return `<article class="popup-card ${ended?'is-ended':''}" id="${esc(p.id)}">
    <div class="card-body"><div class="card-eyebrow"><span class="category category-${esc(p.tone)}">${esc(p.category)}</span><span>${esc(p.region)}</span><span class="evidence ${verified&&age<3?'verified':''}">${age>=3?`${age}일 전 자료 · 재확인 권장`:verified?(p.collection?.method==='official-social-match'?'✓ 공식 SNS 확인':p.collection?'공식 공지 · 자동 추출':'✓ 공식 일정 확인'):'모음 일정 · 공식 확인 전'}</span></div>
    <h3>${esc(p.title)}</h3><p class="brand-line">${esc(p.brand)} <span>·</span> ${esc(p.venue)}</p>
    <div class="event-period"><span class="status-dot ${ended?'gray':''}"></span><span>${esc(eventState(p,now))}</span><span>${formatDate(p.event.start)} — ${formatDate(p.event.end)}</span></div>
    <div class="reservation-line"><span class="mini-label">예약</span><strong>${esc(bookingState(p,now))}</strong><span>${b.close?'접수 마감 '+formatDate(b.close):b.mode==='walk-in'?'사전예약 없이 방문':'접수 마감 미공개'}</span></div>
    <details><summary>예약 상세·출처 <span>＋</span></summary><div class="details-body"><dl><div><dt>예약 오픈</dt><dd>${b.mode==='walk-in'?'해당 없음':formatDate(b.open)}${b.open&&dateOnly(b.open)?' · 시각 미공개':''}</dd></div><div><dt>예약 마감</dt><dd>${b.mode==='walk-in'?'해당 없음':formatDate(b.close)}${b.close&&dateOnly(b.close)?' · 시각 미공개':''}</dd></div>${b.visitStart?`<div><dt>예약 방문일</dt><dd>${formatDate(b.visitStart)} — ${formatDate(b.visitEnd)}</dd></div>`:''}<div><dt>운영시간</dt><dd>${esc(p.hours||'공식 공지 확인')}</dd></div><div><dt>위치</dt><dd>${esc(p.address||p.venue)}</dd></div></dl><p class="detail-note">${esc(b.note)}</p><div class="source-heading">자료 확인 ${formatDate(p.checkedAt)} · ${verified?'공식 공지/예약처 기준':'일부 내용은 2차 출처 기준'}</div><ul class="sources">${sourceLinks}</ul></div></details>
    </div><div class="card-deadline ${closing?'soon':''}"><span class="deadline-label">${milestone?esc(milestone.label):ended?'지난 팝업':'일정 확인 필요'}</span><strong class="countdown" ${milestone?`data-countdown="${esc(milestone.value)}"`:''}>${milestone?countdown(milestone.value,now):ended?'종료':'미공개'}</strong><span class="deadline-date">${milestone?formatDate(milestone.value)+(dateOnly(milestone.value)?' · 시각 미공개':' KST'):'다음 팝업을 기다려 주세요'}</span>${mainLink}${milestone?.type==='event'?'<small>행사 일정 기준</small>':'<small>잔여석은 예약처에서 확인</small>'}</div>
  </article>`;
}
function render(){if(!data)return;const now=Date.now();makeFilters();
  const active=data.popups.filter(p=>!eventEnded(p,now)&&!p.cancelled&&!p.collection?.conflict);
  $('#stat-active').textContent=active.length;$('#stat-booking').textContent=active.filter(p=>p.booking.url).length;
  $('#stat-soon').textContent=active.filter(p=>p.event.end&&timestamp(p.event.end,true)-now<=7*DAY).length;
  $('#checked-date').textContent=formatDate(data.checkedAt);
  const age=Math.floor((timestamp(kstDate(now))-timestamp(data.checkedAt))/DAY);
  $('#data-notice').hidden=age<3;$('#data-notice').textContent=`자료를 확인한 지 ${age}일 지났습니다. 새 공지와 예약 가능 여부를 공식 예약처에서 확인하세요.`;
  $('#views').querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',btn.dataset.view===filters.view));
  const list=selectPopups(data.popups,filters,now);$('#result-count').textContent=`${list.length}개`;
  const groups=filters.view==='ended'?[]:groupPopupsByMilestone(list,now);
  $('#milestone-nav').hidden=!groups.length;
  $('#milestone-nav').innerHTML=groups.map(g=>`<a class="milestone-link milestone-${g.id}" href="#group-${g.id}">${g.title}<span>${g.items.length}개</span><span aria-hidden="true">↓</span></a>`).join('');
  $('#list-note').textContent=groups.length?'카운트다운 기준별로 나눠서 정렬해요':'예약 마감과 행사 종료를 구분해요';
  const rows=groups.length?groups.map(g=>`<section class="milestone-group milestone-${g.id}" aria-labelledby="group-${g.id}"><header class="milestone-heading"><div><h2 id="group-${g.id}" tabindex="-1">${g.title}<span>${g.items.length}개</span></h2><p>${g.description}</p></div><a href="#milestone-nav" class="group-top">기준 선택 ↑</a></header><div class="milestone-cards">${g.items.map(p=>card(p,now)).join('')}</div></section>`).join(''):list.map(p=>card(p,now)).join('');
  $('#results').innerHTML=list.length?rows:`<div class="empty"><span class="empty-symbol">↗</span><h3>등록된 일정 중 조건에 맞는 팝업이 없어요.</h3><p>서울 25개 구를 조사 대상으로 확인하고 있습니다. 이 지역에 실제 행사가 없다는 뜻은 아닙니다.</p><p>다른 지역이나 카테고리를 선택해 보세요.${filters.view==='booking'?' 예약 방식이 확인된 팝업만 이 목록에 표시합니다.':''}</p><button type="button" class="action-link" id="empty-reset">전체 일정 보기</button></div>`;
  $('#results').setAttribute('aria-busy','false');syncUrl();
}
function reset(){Object.assign(filters,{query:'',area:'',region:'',category:'',verification:'',view:'active',sort:'deadline'});render();}
$('#verification').addEventListener('change',e=>{filters.verification=e.target.value;render();});
$('#area').addEventListener('change',e=>{filters.area=e.target.value;filters.region='';render();});
$('#regions').addEventListener('click',e=>{const b=e.target.closest('[data-region]');if(b){filters.region=b.dataset.region;render();$('#regions').querySelector(`[data-region="${CSS.escape(filters.region)}"]`)?.focus();}});
$('#categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){filters.category=b.dataset.category;render();$('#categories').querySelector(`[data-category="${CSS.escape(filters.category)}"]`)?.focus();}});
$('#views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){filters.view=b.dataset.view;render();}});
$('#search').addEventListener('input',e=>{filters.query=e.target.value;render();});
$('#sort').addEventListener('change',e=>{filters.sort=e.target.value;render();});
$('#reset').addEventListener('click',reset);$('#results').addEventListener('click',e=>{if(e.target.closest('#empty-reset'))reset();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();$('#search').focus();}});
let lastStatus='';
const statusKey=now=>JSON.stringify([kstDate(now),...(data?.popups||[]).map(p=>[eventState(p,now),bookingState(p,now),nextMilestone(p,now)])]);
function tick(){const now=Date.now();$('#korea-clock').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
  const key=statusKey(now);
  if(data && lastStatus && key!==lastStatus){const opened=[...document.querySelectorAll('#results details[open]')].map(d=>d.closest('article').id);const active=document.activeElement;const focusedId=active.id;const r=active.dataset.region,c=active.dataset.category;const articleId=active.closest('article')?.id;const tag=active.tagName;render();for(const id of opened)document.getElementById(id)?.querySelector('details').setAttribute('open','');if(focusedId)document.getElementById(focusedId)?.focus();else if(r!==undefined)document.querySelector(`[data-region="${CSS.escape(r)}"]`)?.focus();else if(c!==undefined)document.querySelector(`[data-category="${CSS.escape(c)}"]`)?.focus();else if(articleId&&tag==='SUMMARY')document.getElementById(articleId)?.querySelector('summary')?.focus();}
  lastStatus=key;document.querySelectorAll('[data-countdown]').forEach(el=>el.textContent=countdown(el.dataset.countdown,now));
}
tick();setInterval(tick,1000);
fetch('./data/discovery.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('수집 상태 오류');return r.json();}).then(report=>{
  const age=Date.now()-Date.parse(report.checkedAt);
  $('#collection-summary').textContent=`최근 수집 ${formatDate(report.checkedAt)} KST · ${age>36*3600000?'수집 지연 확인 필요':report.status==='partial'?'일부 채널 확인 제한':'수집 완료'} · 검토 대기 ${report.reviewCount}건`;
  $('#collection-detail').innerHTML=`<p>공식 공지·공개 SNS·팝업 모음을 확인합니다. 모음 일정은 공식 확인 전으로 표시하며, 불명확하거나 충돌한 정보는 검토 대기에 남깁니다. <a href="./discover.html">전체 발견 공지와 SNS 출처 보기 ↗</a></p><ul class="collector-sources">${report.sources.map(s=>`<li>${external(s.url,s.label)}: ${esc({ok:'확인',limited:'이미지·동적 공지 별도 확인',partial:'일부 문서 확인 제한',error:'접속 실패'}[s.status]||'확인 필요')}</li>`).join('')}</ul><ul class="candidate-list">${report.candidates.slice(0,30).map(c=>`<li>${external(c.url,c.title)}<small>${esc(c.reason)}</small></li>`).join('')||'<li>현재 검토 대기 공지가 없습니다.</li>'}</ul>`;
}).catch(()=>{$('#collection-summary').textContent='자동 수집 상태를 불러오지 못했습니다.';});
Promise.all(['popups','coverage'].map(name=>fetch(`./data/${name}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('자료 오류');return r.json();}))).then(([json,scope])=>{data=json;coverage=scope;render();}).catch(()=>{ $('#results').setAttribute('aria-busy','false');$('#results').innerHTML='<div class="empty"><h3>일정을 불러오지 못했어요.</h3><p>네트워크 연결을 확인하고 다시 시도해 주세요.</p><button type="button" class="action-link" id="retry">다시 불러오기</button></div>';$('#retry').addEventListener('click',()=>location.reload());});
