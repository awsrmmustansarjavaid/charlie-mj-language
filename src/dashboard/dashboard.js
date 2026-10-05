(() => {
'use strict';
const BUILTIN=[
 {id:'overview',name:'Overview',key:null,icon:'🏠',group:'Start'},
 {id:'continue',name:'Continue Learning',key:'videoProgress',icon:'▶️',group:'Start'},
 {id:'history',name:'History',key:'history',icon:'🕘',group:'Content'},
 {id:'videos',name:'Videos',key:'history',icon:'🎬',group:'Content'},
 {id:'transcripts',name:'Transcripts',key:'transcripts',icon:'📄',group:'Content'},
 {id:'wordLearning',name:'Word Learning',key:'wordLearning',icon:'🔤',group:'Learning'},
 {id:'sentenceLearning',name:'Sentence Learning',key:'sentenceLearning',icon:'📝',group:'Learning'},
 {id:'vocabulary',name:'Vocabulary',key:'vocabulary',icon:'📚',group:'Learning'},
 {id:'review',name:'Review / Weak Words',key:'vocabulary',icon:'🧠',group:'Learning'},
 {id:'collections',name:'Collections',key:null,icon:'📁',collections:true,group:'Organize'},
 {id:'bookmarks',name:'Bookmarks',key:'bookmarks',icon:'🔖',group:'Organize'},
 {id:'watchLater',name:'Watch Later',key:'watchLater',icon:'⏰',group:'Organize'},
 {id:'notes',name:'Notes',key:'notes',icon:'🗒️',group:'Organize'},
 {id:'captures',name:'Captures',key:'captures',icon:'📸',group:'Organize'},
 {id:'favorites',name:'Favorites',key:'favorites',icon:'⭐',group:'Organize'},
 {id:'checkpoints',name:'Checkpoints',key:'checkpoints',icon:'📍',group:'Organize'}
];
let pages=[],current='overview',data=[],view='grid',pendingDelete=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safe=v=>String(v||'library').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,100)||'library';
const fmt=s=>{let n=Math.max(0,Math.floor(Number(s)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),x=n%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`};
const ts=(url,t)=>{try{if(t==null)return url;let u=new URL(url);u.searchParams.set('t',`${Math.floor(Number(t))}s`);return u.toString()}catch{return url}};
const notify=m=>{let e=$('#libraryNotice');if(!e){e=document.createElement('div');e.id='libraryNotice';e.className='notice';document.body.appendChild(e)}e.textContent=m;clearTimeout(notify.t);notify.t=setTimeout(()=>e.remove(),3200)};
init().catch(console.error);

async function init(){
  const s=await chrome.storage.local.get('libraryView'); view=s.libraryView||'grid'; applyView();
  $('#viewToggle').onclick=async()=>{view=view==='grid'?'list':'grid';await chrome.storage.local.set({libraryView:view});applyView();render()};
  $('#openOptions').onclick=()=>chrome.runtime.openOptionsPage();$('#refresh').onclick=load;
  $('#resumeTop').onclick=()=>{current='continue';load()};
  $('#addPage').onclick=()=>{$('#pageName').value='';$('#pageTags').value='';$('#pageDescription').value='';$('#pageDialog').showModal()};
  $('#copyPage').onclick=copyPage;$('#downloadPage').onclick=()=>openExport(true);$('#exportPage').onclick=()=>openExport(false);$('#importPage').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=importPage;['search','tagFilter'].forEach(id=>$('#'+id).oninput=render);['levelFilter','videoFilter','typeFilter'].forEach(id=>$('#'+id).onchange=render);
  $('#pageForm').onsubmit=createPage;$('#exportForm').onsubmit=submitExport;$('#pagePickerForm').onsubmit=addToCollection;$('#checkpointForm').onsubmit=createCheckpoint;$('#confirmYes').onclick=confirmDelete;
  document.addEventListener('click',onClick); await loadPages(); await load();
}
async function loadPages(){let s=await chrome.storage.local.get('libraryPages');pages=Array.isArray(s.libraryPages)?s.libraryPages:[];renderNav()}
function allPages(){return [...BUILTIN,...pages.map(p=>({id:`custom:${p.id}`,name:p.name,key:`libraryPage_${p.id}`,custom:true,rawId:p.id,icon:'📁'}))]}
function info(){return allPages().find(x=>x.id===current)||BUILTIN[0]}
function renderNav(){
 const groups=['Start','Content','Learning','Organize'];
 const grouped=groups.map(group=>{
   const items=allPages().filter(p=>p.group===group || (!p.group&&group==='Organize'));
   if(!items.length)return '';
   return `<section class="library-group"><h3>${group}</h3>${items.map(p=>`<div class="nav-wrap"><button class="library-tab ${p.id===current?'active':''}" data-page-id="${esc(p.id)}"><span class="nav-icon">${p.icon}</span><span>${esc(p.name)}</span><span class="nav-count" data-count-for="${esc(p.id)}"></span></button>${p.custom?`<button class="page-delete" title="Delete collection" data-delete-page="${esc(p.rawId)}">×</button>`:''}</div>`).join('')}</section>`;
 }).join('');
 const custom=pages.length?`<section class="library-group custom-group"><h3>My Collections</h3>${pages.map(p=>{const id=`custom:${p.id}`;return `<div class="nav-wrap"><button class="library-tab ${id===current?'active':''}" data-page-id="${esc(id)}"><span class="nav-icon">📁</span><span>${esc(p.name)}</span></button><button class="page-delete" title="Delete collection" data-delete-page="${esc(p.id)}">×</button></div>`}).join('')}</section>`:'';
 $('#libraryNav').innerHTML=grouped+custom;
}
async function pageData(p){
  if(!p.key)return[];
  if(p.id==='review'){
    const s=await chrome.storage.local.get('vocabulary'); const all=Array.isArray(s.vocabulary)?s.vocabulary:[]; const counts=new Map(); all.filter(x=>x.type==='word').forEach(x=>{const k=(x.lemma||x.word||'').toLowerCase();counts.set(k,(counts.get(k)||0)+1)}); return all.filter(x=>x.type==='word' && ((counts.get((x.lemma||x.word||'').toLowerCase())||0)>1 || !['mastered','known'].includes(String(x.stage||'').toLowerCase()))).slice(0,1000);
  }
  if(p.id==='notes'){
    const s=await chrome.storage.local.get(['notesByVideo','history']);
    const h=s.history||[], out=[];
    for(const [videoId,notes] of Object.entries(s.notesByVideo||{})){
      const v=h.find(x=>x.videoId===videoId)||{};
      (Array.isArray(notes)?notes:[]).forEach((note,i)=>out.push({id:note.id||`${videoId}:note:${i}`,videoId,videoTitle:v.videoTitle||'YouTube Video',url:v.url||'',timestamp:note.timestamp||0,note:String(note.text||note.html||''),html:note.html||'',createdAt:note.createdAt||'',source:'Notes'}));
    }
    return out;
  }
  let s=await chrome.storage.local.get(p.key);return Array.isArray(s[p.key])?s[p.key]:[]
}
async function load(){await loadPages();let p=info(); if(current==='overview'){data=[];renderOverview();return} if(current==='collections'){data=pages;renderCollections();return} data=await pageData(p);render()}
function render(){
 $('#overview').hidden=true;let p=info(),q=$('#search').value.trim().toLowerCase(),lv=$('#levelFilter').value,tag=$('#tagFilter').value.trim().toLowerCase(),vid=$('#videoFilter').value,typ=$('#typeFilter').value;
 let filtered=data.filter(x=>{let hay=JSON.stringify(x).toLowerCase();let tags=(x.tags||[]).join(' ').toLowerCase();let itemType=x.type||x.kind||(p.id==='videos'||p.id==='continue'?'video':'');return(!q||hay.includes(q))&&(!lv||String(x.level||'').toUpperCase()===lv)&&(!tag||tags.includes(tag))&&(!vid||x.videoId===vid)&&(!typ||itemType===typ)});
 $('#typeFilter').disabled=['overview','collections','history','continue','videos','checkpoints'].includes(p.id);
 renderNav();renderVideoFilter();renderStats(filtered,p);
 $('#items').className=`item-grid ${view==='list'?'list-view':''}`;
 $('#items').innerHTML=filtered.length?filtered.map(x=>card(x,p)).join(''):`<div class="empty"><h3>Nothing saved here yet</h3><p>${esc(p.name)} will fill automatically as you learn.</p></div>`;
}
function renderVideoFilter(){let sel=$('#videoFilter').value,map=new Map();data.forEach(x=>{if(x.videoId)map.set(x.videoId,x.videoTitle||x.title||x.videoId)});$('#videoFilter').innerHTML='<option value="">All videos</option>'+[...map].map(([id,t])=>`<option value="${esc(id)}">${esc(t)}</option>`).join('');if(map.has(sel))$('#videoFilter').value=sel}
function renderStats(items,p){let vids=new Set(items.map(x=>x.videoId).filter(Boolean)),tags=new Set(items.flatMap(x=>x.tags||[])),total=items.length;$('#stats').innerHTML=[['Items',total,p.name],['Videos',vids.size,'linked videos'],['Tags',tags.size,'active tags'],['Progress',p.id==='continue'?items.filter(x=>x.status!=='completed').length:'—','unfinished / status']].map(x=>`<div class="stat"><strong>${esc(x[1])}</strong><span>${esc(x[0])} · ${esc(x[2])}</span></div>`).join('')}
function card(x,p){
 let isVideo=['history','continue','videos'].includes(p.id),title=x.videoTitle||x.title||x.word||x.sentence||x.label||'Learning item',sub=x.word?`${x.word}${x.translation?' — '+x.translation:''}`:x.sentence||x.subtitle||x.label||'',time=x.timestamp!=null?fmt(x.timestamp):x.lastPosition!=null?fmt(x.lastPosition):'',thumb=x.thumbnail||(x.videoId?`https://i.ytimg.com/vi/${encodeURIComponent(x.videoId)}/hqdefault.jpg`:''),progress=Number(x.watchPercentage??x.progress??0),url=x.url?ts(x.url,x.timestamp??x.lastPosition):'';
 let actions=`<button data-copy-item="${esc(x.id||x.videoId||'')}">📋 Copy</button>`;
 if(p.custom)actions+=`<button data-add-custom="${esc(x.id||x.videoId||'')}" data-source="${esc(p.key)}">＋ Collection</button>`;
 if(x.videoId)actions+=`<button data-checkpoint="${esc(x.videoId)}" data-time="${esc(x.timestamp??x.lastPosition??0)}">📍 Checkpoint</button>`;
 if(x.url)actions+=`<button data-favorite="${esc(x.videoId||x.id||'')}">⭐ Favorite</button>`;
 if(isVideo&&x.url)actions+=`<button data-resume="${esc(x.videoId)}">▶ Resume</button>`;
 if(x.url)actions+=`<button data-open="${esc(url)}">Open</button>`;
 if(p.key)actions+=`<button data-remove-item="${esc(x.id||'')}">🗑 Remove</button>`;
 return `<article class="item-card ${x.status==='completed'?'completed':''}">
 ${thumb?`<img class="thumb" src="${esc(thumb)}" alt="" loading="lazy">`:''}<div class="item-body"><div class="card-top"><span class="pill">${esc(p.name)}</span>${x.status?`<span class="status ${esc(x.status)}">${esc(x.status)}</span>`:''}</div>
 <h3 class="item-title">${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`:esc(title)}</h3><p class="item-meta"><strong>${esc(sub)}</strong></p>
 ${isVideo?`<div class="progress"><span style="width:${Math.max(0,Math.min(100,progress))}%"></span></div><p class="item-context">${Math.round(progress)}% · Last ${esc(time||'00:00:00')} · Sessions ${esc(x.sessions||1)}</p>`:''}
 <p class="item-context">${esc(x.source||'Library')}${time?` · ${esc(time)}`:''}${x.pos?` · ${esc(x.pos)}`:''}${x.level?` · ${esc(x.level)}`:''}</p>${x.sentence&&x.word?`<p class="item-context">${esc(x.sentence)}</p>`:''}${x.note?`<p class="note-preview">${esc(x.note)}</p>`:''}<div class="tags">${(x.tags||[]).map(t=>`<span>#${esc(t)}</span>`).join('')}</div><div class="item-actions">${actions}</div></div></article>`;
}
function renderOverview(){
 $('#overview').hidden=false;$('#items').innerHTML='';$('#stats').innerHTML='';
 Promise.all([pageData({key:'videoProgress'}),pageData({key:'history'}),pageData({key:'vocabulary'}),pageData({key:'sentenceLearning'})]).then(([prog,hist,vocab,sent])=>{
  let active=prog.filter(x=>x.status!=='completed').sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0)).slice(0,6),recent=hist.slice(0,6);
  $('#overview').innerHTML=`<div class="overview-head"><div><p class="eyebrow">WELCOME BACK</p><h2>Continue your learning</h2><p>${active.length} unfinished videos · ${vocab.filter(x=>x.type!=='sentence').length} words · ${sent.length} saved sentences</p></div><div class="overview-metrics"><div><b>${vocab.length}</b><span>Vocabulary</span></div><div><b>${sent.length}</b><span>Sentences</span></div><div><b>${prog.filter(x=>x.status==='completed').length}</b><span>Completed</span></div></div></div>
  <div class="section-title"><h3>▶ Resume Queue</h3><span>Saved automatically while you watch</span></div><div class="resume-grid">${active.length?active.map(x=>card(x,{id:'continue',name:'Continue Learning'})).join(''):'<div class="empty">No unfinished videos yet. Open a YouTube video to start.</div>'}</div>
  <div class="section-title"><h3>🕘 Recent History</h3><span>Last watched videos</span></div><div class="resume-grid">${recent.length?recent.map(x=>card(x,{id:'history',name:'History'})).join(''):'<div class="empty">Your watch history will appear here.</div>'}</div>`;
 }).catch(console.error)
}
function renderCollections(){ $('#overview').hidden=true;$('#stats').innerHTML=`<div class="stat"><strong>${pages.length}</strong><span>Collections</span></div>`;$('#items').className=`item-grid ${view==='list'?'list-view':''}`;$('#items').innerHTML=pages.length?pages.map(p=>`<article class="item-card collection-card"><div class="collection-icon">📁</div><div class="item-body"><div class="card-top"><span class="pill">Collection</span></div><h3 class="item-title">${esc(p.name)}</h3><p class="item-context">${esc(p.description||'Custom learning collection')} · ${(p.tags||[]).map(esc).join(', ')}</p><div class="item-actions"><button data-page-id="custom:${esc(p.id)}">Open</button><button data-delete-page="${esc(p.id)}">🗑 Delete</button></div></div></article>`).join(''):'<div class="empty"><h3>Create your first collection</h3><p>Courses, languages, shows, grammar topics or anything else you want to learn.</p></div>'}
function onClick(e){
 let n=e.target.closest('[data-page-id]');if(n){current=n.dataset.pageId;load();return}
 let d=e.target.closest('[data-delete-page]');if(d){askDelete(d.dataset.deletePage);return}
 let r=e.target.closest('[data-remove-item]');if(r){removeItem(r.dataset.removeItem);return}
 let c=e.target.closest('[data-add-custom]');if(c){openPicker(c.dataset.addCustom,c.dataset.source);return}
 let f=e.target.closest('[data-favorite]');if(f){toggleFavorite(f.dataset.favorite);return}
 let cp=e.target.closest('[data-checkpoint]');if(cp){openCheckpoint(cp.dataset.checkpoint,cp.dataset.time);return}
 let re=e.target.closest('[data-resume]');if(re){resumeVideo(re.dataset.resume);return}
 let op=e.target.closest('[data-open]');if(op){chrome.tabs.create({url:op.dataset.open});return}
 let ci=e.target.closest('[data-copy-item]');if(ci){copyItem(ci.dataset.copyItem);return}
 if(e.target.matches('[data-close]'))e.target.closest('dialog')?.close();
}
async function resumeVideo(id){let s=await chrome.storage.local.get('videoProgress');let p=(s.videoProgress||[]).find(x=>x.videoId===id);if(p?.url)chrome.tabs.create({url:ts(p.url,p.lastPosition)});else notify('No resume URL saved.')}
async function toggleFavorite(id){let s=await chrome.storage.local.get('favorites');let a=s.favorites||[];let found=a.find(x=>x.videoId===id);if(found)a=a.filter(x=>x.videoId!==id);else{let p=(await chrome.storage.local.get('history')).history||[];let x=p.find(v=>v.videoId===id);if(x)a.unshift({...x,id:crypto.randomUUID(),favorite:true})}await chrome.storage.local.set({favorites:a});notify(found?'Removed from Favorites.':'Added to Favorites.');await load()}
function openCheckpoint(video,time){$('#checkpointVideo').value=video;$('#checkpointTime').value=Number(time)||0;$('#checkpointLabel').value='';$('#checkpointDialog').showModal()}
async function createCheckpoint(e){e.preventDefault();let id=$('#checkpointVideo').value,time=Number($('#checkpointTime').value)||0,label=$('#checkpointLabel').value.trim()||'Learning checkpoint',h=(await chrome.storage.local.get('history')).history||[],v=h.find(x=>x.videoId===id)||{};let s=await chrome.storage.local.get('checkpoints'),a=s.checkpoints||[];a.unshift({id:crypto.randomUUID(),videoId:id,videoTitle:v.videoTitle||'YouTube Video',url:v.url||`https://www.youtube.com/watch?v=${id}`,timestamp:time,label,createdAt:new Date().toISOString(),type:'checkpoint'});await chrome.storage.local.set({checkpoints:a});$('#checkpointDialog').close();notify('Checkpoint saved.');if(current==='checkpoints')load()}
async function loadSource(key){let s=await chrome.storage.local.get(key);return Array.isArray(s[key])?s[key]:[]}
async function openPicker(id,source){if(!pages.length)return notify('Create a collection first.');$('#pickerItemId').value=id;$('#pickerSource').value=source;$('#pagePickerSelect').innerHTML=pages.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('#pagePickerDialog').showModal()}
async function addToCollection(e){e.preventDefault();let page=pages.find(p=>p.id===$('#pagePickerSelect').value);if(!page)return;let source=$('#pickerSource').value,arr=await loadSource(source),item=arr.find(x=>(x.id||x.videoId)===$('#pickerItemId').value);if(!item){let prog=arr.find(x=>x.videoId===$('#pickerItemId').value);item=prog}if(!item)return notify('Item not found.');let key=`libraryPage_${page.id}`,target=await loadSource(key);if(!target.some(x=>x.id===item.id||x.videoId===item.videoId&&x.type===item.type))target.unshift({...item,collectionAddedAt:new Date().toISOString()});await chrome.storage.local.set({[key]:target});$('#pagePickerDialog').close();notify(`Added to ${page.name}.`)}
async function removeItem(id){let p=info(),arr=await loadSource(p.key);await chrome.storage.local.set({[p.key]:arr.filter(x=>x.id!==id)});load()}
async function copyItem(id){let x=data.find(a=>(a.id||a.videoId)===id);if(!x)return;navigator.clipboard.writeText(readable([x],info()));notify('Copied.')}
async function copyPage(){navigator.clipboard.writeText(readable(data,info()));notify('Current library page copied.')}
async function openExport(downloadOnly){let choices=allPages().map(p=>`<label class="choice"><input type="checkbox" value="${esc(p.id)}" ${p.id===current?'checked':''}>${p.icon} ${esc(p.name)}</label>`).join('');$('#exportChoices').innerHTML=choices;$('#exportTitle').textContent=downloadOnly?'Download selected library':'Export selected library';$('#exportFormat').disabled=downloadOnly;if(downloadOnly)$('#exportFormat').value='txt';$('#exportDialog').showModal()}
async function submitExport(e){e.preventDefault();let ids=[...$('#exportChoices input:checked')].map(x=>x.value);if(!ids.length)return notify('Select at least one page.');let bundles=[];for(let id of ids){let p=infoBy(id);bundles.push({page:p,items:await pageData(p)})}let fmtType=$('#exportFormat').value,payload=JSON.stringify({program:'Charlie MJ Language',version:'4.1.0',exportedAt:new Date().toISOString(),pages:bundles},null,2),mime='application/json',ext='json';if(fmtType==='txt'){payload=bundles.map(b=>readable(b.items,b.page)).join('\\n\\n'+'='.repeat(80)+'\\n\\n');mime='text/plain';ext='txt'}if(fmtType==='csv'){payload=csv(bundles.flatMap(b=>b.items.map(x=>({page:b.page.name,...x}))));mime='text/csv';ext='csv'}if(fmtType==='anki'){payload=bundles.flatMap(b=>b.items).map(x=>`${String(x.word||x.sentence||'').replaceAll('\\t',' ')}\\t${String(x.translation||x.sentenceTranslation||'').replaceAll('\\t',' ')}\\t${String(x.sentence||'').replaceAll('\\t',' ')}`).join('\\n');mime='text/tab-separated-values';ext='txt'}if(['srt','vtt'].includes(fmtType)){let rows=bundles.flatMap(b=>b.items).filter(x=>x.sentence||x.subtitle).map((x,i)=>`${fmtType==='srt'?i+1+'\\n':''}${timecode(x.timestamp||0,fmtType)} --> ${timecode((x.timestamp||0)+(x.duration||2),fmtType)}\\n${x.sentence||x.subtitle||''}${x.translation||x.sentenceTranslation?'\\n'+(x.translation||x.sentenceTranslation):''}`).join('\\n\\n');payload=fmtType==='vtt'?'WEBVTT\\n\\n'+rows:rows;mime='text/plain';ext=fmtType}let set=(await chrome.storage.local.get('settings')).settings||{};await download(`${set.downloadRoot||'Charlie MJ Language'}/Exports/${safe(bundles.map(x=>x.page.name).join('-'))}.${ext}`,payload,mime);$('#exportDialog').close();notify('Export started.')}
async function importPage(e){let f=e.target.files?.[0];e.target.value='';if(!f)return;try{let t=await f.text(),p=info(),parsed=f.name.toLowerCase().endsWith('.json')?JSON.parse(t):parseCSV(t),items=Array.isArray(parsed)?parsed:parsed.items||parsed.pages?.flatMap(x=>x.items||[])||[];let old=await pageData(p),map=new Map([...old,...items].map(x=>[x.id||crypto.randomUUID(),x]));await chrome.storage.local.set({[p.key]:[...map.values()]});await load();notify(`Imported ${items.length} item(s).`)}catch(err){notify('Import failed: '+err.message)}}
async function createPage(e){e.preventDefault();let p={id:crypto.randomUUID(),name:$('#pageName').value.trim(),tags:$('#pageTags').value.split(',').map(x=>x.trim()).filter(Boolean),description:$('#pageDescription').value.trim(),createdAt:new Date().toISOString()};if(!p.name)return;pages.push(p);await chrome.storage.local.set({libraryPages:pages,[`libraryPage_${p.id}`]:[]});$('#pageDialog').close();current=`custom:${p.id}`;await load();notify(`Created ${p.name}.`)}
function askDelete(id){pendingDelete=pages.find(p=>p.id===id);if(!pendingDelete)return;$('#confirmTitle').textContent='Delete collection?';$('#confirmText').textContent=`Delete “${pendingDelete.name}” and its items?`;$('#confirmDialog').showModal()}
async function confirmDelete(e){e.preventDefault();if(!pendingDelete)return;pages=pages.filter(p=>p.id!==pendingDelete.id);await chrome.storage.local.set({libraryPages:pages});await chrome.storage.local.remove(`libraryPage_${pendingDelete.id}`);pendingDelete=null;current='collections';$('#confirmDialog').close();await load()}
function infoBy(id){return allPages().find(p=>p.id===id)||BUILTIN[0]}
function readable(items,p){let l=[`Charlie MJ Language`,`Library: ${p.name}`,`Exported: ${new Date().toLocaleString()}`,`Total items: ${items.length}`,''];items.forEach((x,i)=>{l.push(`• ${x.videoTitle||x.title||x.word||x.sentence||x.label||'Item '+(i+1)}`);if(x.word)l.push(`  Word: ${x.word}`,`  Translation: ${x.translation||''}`);if(x.sentence)l.push(`  Sentence: ${x.sentence}`,`  Sentence translation: ${x.sentenceTranslation||x.translation||''}`);if(x.timestamp!=null)l.push(`  Timestamp: ${fmt(x.timestamp)}`);if(x.lastPosition!=null)l.push(`  Last position: ${fmt(x.lastPosition)}`);if(x.url)l.push(`  URL: ${x.url}`);if(x.pos)l.push(`  POS: ${x.pos}`);if(x.lemma)l.push(`  Lemma: ${x.lemma}`);if(x.tags?.length)l.push(`  Tags: ${x.tags.join(', ')}`);l.push('')});return l.join('\\n')}
function csv(items){let keys=[...new Set(items.flatMap(x=>Object.keys(x)))];return [keys.join(','),...items.map(x=>keys.map(k=>`"${String(Array.isArray(x[k])?x[k].join('|'):x[k]??'').replaceAll('"','""')}"`).join(','))].join('\\n')}
function parseCSV(t){let lines=t.split(/\\r?\\n/).filter(Boolean);if(lines.length<2)return[];let h=split(lines[0]);return lines.slice(1).map(l=>{let v=split(l),x={};h.forEach((k,i)=>x[k]=v[i]||'');x.id=x.id||crypto.randomUUID();if(x.timestamp)x.timestamp=Number(x.timestamp);x.tags=String(x.tags||'').split('|').filter(Boolean);return x})}
function split(l){let a=[],c='',q=false;for(let i=0;i<l.length;i++){let x=l[i];if(x==='"'&&l[i+1]==='"'){c+='"';i++;continue}if(x==='"'){q=!q;continue}if(x===','&&!q){a.push(c);c='';continue}c+=x}a.push(c);return a}
function timecode(sec,type){let ms=Math.max(0,Math.round(Number(sec||0)*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),z=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${type==='srt'?',':'.'}${String(z).padStart(3,'0')}`}
async function download(path,text,mime){let u=URL.createObjectURL(new Blob([text],{type:mime+';charset=utf-8'}));try{await chrome.downloads.download({url:u,filename:path,saveAs:false})}finally{setTimeout(()=>URL.revokeObjectURL(u),15000)}}
function applyView(){$('#viewToggle').textContent=view==='grid'?'☷ List':'▦ Grid'}
})();
