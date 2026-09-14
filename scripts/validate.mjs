import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {dateOnly,timestamp,kstDate} from '../docs/assets/core.js';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await fs.readFile(new URL('docs/data/popups.json',root),'utf8'));
const errors=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg);};
const validUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
function validDate(value){
  if(typeof value!=='string')return false;
  if(!dateOnly(value)&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value))return false;
  const time=timestamp(value);return Number.isFinite(time)&&kstDate(time)===value.slice(0,10);
}
check(data.schemaVersion===1,'schemaVersion must be 1');
check(data.timezone==='Asia/Seoul','timezone must be Asia/Seoul');
check(dateOnly(data.checkedAt)&&validDate(data.checkedAt),'Invalid dataset checkedAt');
check(Array.isArray(data.popups)&&data.popups.length>0,'Empty dataset');
const ids=new Set();
for(const p of data.popups||[]){
  const at=msg=>`${p.id}: ${msg}`;
  check(/^[a-z0-9-]+$/.test(p.id)&&!ids.has(p.id),at('Invalid or duplicate id'));ids.add(p.id);
  for(const key of ['title','brand','region','category','venue'])check(typeof p[key]==='string'&&p[key].trim(),at(`Missing ${key}`));
  check(['beauty','character','fashion','food','lifestyle'].includes(p.tone),at('Invalid tone'));
  check(['official','secondary'].includes(p.verification),at('Invalid verification'));
  check(dateOnly(p.checkedAt)&&validDate(p.checkedAt)&&p.checkedAt<=data.checkedAt,at('Invalid checkedAt'));
  check(Array.isArray(p.sources)&&p.sources.length>0,at('Missing sources'));
  for(const s of p.sources||[])check(validUrl(s.url)&&s.label&&s.note&&['official','secondary'].includes(s.kind),at('Invalid source'));
  const officialUrls=(p.sources||[]).filter(s=>s.kind==='official').map(s=>s.url);
  if(p.verification==='official')check(officialUrls.length>0,at('Official evidence missing'));
  const b=p.booking,e=p.event;
  check(!!b&&!!e,at('Missing booking or event'));if(!b||!e)continue;
  check(['unknown','reservation','mixed','walk-in'].includes(b.mode),at('Invalid booking mode'));
  check(typeof b.note==='string'&&b.note.trim(),at('Missing booking note'));
  if(b.url)check(validUrl(b.url),at('Unsafe booking URL'));
  for(const [key,value] of Object.entries({start:e.start,end:e.end,open:b.open,close:b.close,visitStart:b.visitStart,visitEnd:b.visitEnd}))if(value!==null&&value!==undefined)check(validDate(value),at(`Invalid ${key}: require date or explicit +09:00 timestamp`));
  check(e.start||e.end,at('No event dates'));
  if(e.start&&e.end)check(timestamp(e.start)<=timestamp(e.end,true),at('Event date order'));
  if(b.open&&b.close)check(timestamp(b.open)<=timestamp(b.close,true),at('Booking date order'));
  if(b.visitStart&&b.visitEnd)check(timestamp(b.visitStart)<=timestamp(b.visitEnd,true),at('Booking visit date order'));
  for(const key of ['open','close'])if(b[key])check(officialUrls.includes(b[`${key}Source`]),at(`${key} must cite an official source explicitly`));
  if(b.mode==='walk-in')check(!b.open&&!b.close&&!b.url,at('Walk-in must not carry reservation dates or a booking URL'));
}
for(const filename of ['docs/assets/app.js','docs/assets/core.js'])execFileSync(process.execPath,['--check',fileURLToPath(new URL(filename,root))],{stdio:'pipe'});
const html=await fs.readFile(new URL('docs/index.html',root),'utf8');
for(const m of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)){
  try{await fs.access(new URL(m[1],new URL('docs/',root)));}catch{errors.push(`Missing local asset ${m[1]}`);}
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Validated ${data.popups.length} popups, dates, official booking evidence, URLs, JavaScript and local assets.`);
