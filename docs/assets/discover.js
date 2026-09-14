import {formatDate} from './core.js?v=social-1';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return '';return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;}catch{return '';}};
let items=[],limit=40;
function render(){
  const q=$('#candidate-query').value.toLowerCase().trim(),area=$('#candidate-area').value,category=$('#candidate-category').value,type=$('#candidate-source').value;
  const matches=items.filter(c=>(!area||c.districts.includes(area))&&(!category||(c.category||'미분류')===category)&&(!q||[c.title,c.source,c.reason,...c.districts].join(' ').toLowerCase().includes(q))&&(!type||(type==='conflict'?/불일치|충돌/.test(c.reason):[c.url,...(c.relatedUrls||[])].some(u=>/instagram\.com|x\.com|threads\.(com|net)/.test(u)))));
  $('#candidate-count').textContent=`${matches.length}건`;
  $('#candidate-results').innerHTML=matches.slice(0,limit).map(c=>`<article class="candidate-card"><div class="card-eyebrow"><span class="category">${esc(c.category||'분류 확인 필요')}</span><span>${esc(c.districts.join(' · ')||'지역 확인 필요')}</span><span class="evidence">검토 대기</span></div><h3>${link(c.url,c.title)}</h3><p>${esc(c.reason)}</p>${c.event?`<p class="candidate-dates">발견한 행사 기간: ${formatDate(c.event.start)} — ${formatDate(c.event.end)}</p>`:''}${c.otherEvent?`<p class="candidate-dates">다른 출처의 기간: ${formatDate(c.otherEvent.start)} — ${formatDate(c.otherEvent.end)}</p>`:''}<div class="candidate-links">${(c.relatedUrls||[]).map((u,i)=>link(u,`${/instagram\.com/.test(u)?'Instagram':/x\.com/.test(u)?'X':/threads\./.test(u)?'Threads':'관련 출처'} ${i+1}`)).join(' ')}</div><small>${esc(c.source)} · 최근 발견 ${formatDate(c.lastSeenAt)} KST</small></article>`).join('')||'<p class="empty">조건에 맞는 발견 공지가 없습니다.</p>';
  $('#candidate-more').hidden=matches.length<=limit;$('#candidate-results').setAttribute('aria-busy','false');
}
for(const id of ['candidate-query','candidate-area','candidate-category','candidate-source'])$('#'+id).addEventListener(id==='candidate-query'?'input':'change',()=>{limit=40;render();});
$('#candidate-more').addEventListener('click',()=>{limit+=40;render();});
Promise.all(['discovery','coverage'].map(f=>fetch(`./data/${f}.json`,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('수집 결과 오류');return r.json();}))).then(([report,coverage])=>{
  items=report.candidates;$('#review-total').textContent=items.length;$('#social-read').textContent=`${report.wide?.socialRead||0} / ${report.wide?.socialDiscovered||0}`;$('#pending-total').textContent=(report.wide?.pendingPages||0)+(report.wide?.pendingSocial||0);
  $('#discovery-updated').textContent=`최근 실행 ${formatDate(report.checkedAt)} KST · 매일 오전 9시 확인 · 미처리 페이지는 다음 실행에서 이어서 확인합니다.`;
  $('#candidate-area').insertAdjacentHTML('beforeend',coverage.districts.map(d=>`<option>${esc(d.name)}</option>`).join(''));
  $('#candidate-category').insertAdjacentHTML('beforeend',[...new Set(items.map(c=>c.category||'미분류'))].sort().map(c=>`<option>${esc(c)}</option>`).join(''));
  $('#source-status').innerHTML='<ul class="collector-sources">'+report.sources.map(s=>`<li>${link(s.url,s.label)} · ${esc({ok:'확인',partial:'일부 제한·미처리',limited:'별도 확인 필요',error:'접속 실패'}[s.status])} · ${s.reviewed||0}개 문서${s.pending?` · 대기 ${s.pending}개`:''}${s.errors?.length?`<small>${esc(s.errors.slice(0,3).map(e=>e.replace(/https:\/\/\S+: /,'' )).join(' / '))}</small>`:''}</li>`).join('')+'</ul>';
  render();
}).catch(()=>{$('#candidate-results').innerHTML='<p class="empty">수집 결과를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';$('#candidate-results').setAttribute('aria-busy','false');});
