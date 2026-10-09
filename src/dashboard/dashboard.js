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
function difficultyFor(level){return ({A1:'Beginner',A2:'Beginner',B1:'Intermediate',B2:'Intermediate',C1:'Advanced',C2:'Advanced'})[String(level||'').toUpperCase()]||'Beginner'}
function languageName(code){return ({tr:'Turkish',en:'English',ur:'Urdu',ar:'Arabic',fa:'Persian',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese',ru:'Russian'}[String(code||'').toLowerCase()]||code||'Language')}
function itemTitle(x){return x.videoTitle||x.title||x.word||x.sentence||x.label||'Learning item'}
function itemTimestamp(x){return x.timestamp!=null?Number(x.timestamp):x.lastPosition!=null?Number(x.lastPosition):0}
function isSentenceItem(x){return x.type==='sentence'||x.source==='Sentence Learning'||Boolean(x.sentence&&!x.word)}
function card(x,p){
 let isVideo=['history','continue','videos'].includes(p.id),title=itemTitle(x),sub=x.word?`${x.word}${x.translation?' — '+x.translation:''}`:x.sentence||x.subtitle||x.label||'',time=itemTimestamp(x),thumb=x.thumbnail||(x.videoId?`https://i.ytimg.com/vi/${encodeURIComponent(x.videoId)}/hqdefault.jpg`:''),progress=Number(x.watchPercentage??x.progress??0),url=x.url?ts(x.url,time):'';
 let itemId=x.id||x.videoId||'',payload=esc(JSON.stringify(x));
 let actions=`<button data-details-item="${esc(itemId)}" data-item-json="${payload}">▣ Details / Card</button><button data-copy-item="${esc(itemId)}" data-item-json="${payload}">📋 Copy</button>`;
 if(p.key)actions+=`<button data-add-custom="${esc(itemId)}" data-source="${esc(p.key)}" data-collection-mode="copy">＋ Add to Collection</button>`;
 if(p.custom)actions+=`<button data-add-custom="${esc(itemId)}" data-source="${esc(p.key)}" data-collection-mode="move">↔ Move to Collection</button>`;
 if(x.videoId)actions+=`<button data-checkpoint="${esc(x.videoId)}" data-time="${esc(time)}">📍 Checkpoint</button>`;
 if(x.url)actions+=`<button data-favorite="${esc(itemId)}" data-favorite-json="${payload}">⭐ Favorite</button>`;
 if(isVideo&&x.url)actions+=`<button data-resume="${esc(x.videoId)}">▶ Resume</button>`;
 if(x.url)actions+=`<button data-open="${esc(url)}">Open at ${esc(fmt(time))}</button>`;
 actions+=`<button data-download-item="${esc(itemId)}" data-item-json="${payload}">⬇ Download</button><button data-export-item="${esc(itemId)}" data-item-json="${payload}">⇩ Export</button>`;
 if(p.key)actions+=`<button data-remove-item="${esc(x.id||'')}">🗑 Remove</button>`;
 return `<article class="item-card ${x.status==='completed'?'completed':''}">
 ${thumb?`<img class="thumb" src="${esc(thumb)}" alt="" loading="lazy">`:''}<div class="item-body"><div class="card-top"><span class="pill">${esc(p.name)}</span>${x.status?`<span class="status ${esc(x.status)}">${esc(x.status)}</span>`:''}</div>
 <h3 class="item-title">${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`:esc(title)}</h3><p class="item-meta"><strong>${esc(sub)}</strong></p>
 ${isVideo?`<div class="progress"><span style="width:${Math.max(0,Math.min(100,progress))}%"></span></div><p class="item-context">${Math.round(progress)}% · Last ${esc(time?fmt(time):'00:00:00')} · Sessions ${esc(x.sessions||1)}</p>`:''}
 <p class="item-context">${esc(x.source||'Library')}${time?` · ${esc(fmt(time))}`:''}${x.pos?` · ${esc(x.pos)}`:''}${x.level?` · ${esc(x.level)}`:''}${x.level?` · ${esc(difficultyFor(x.level))}`:''}</p>${x.sentence&&x.word?`<p class="item-context">${esc(x.sentence)}</p>`:''}${x.note?`<p class="note-preview">${esc(x.note)}</p>`:''}<div class="tags">${(x.tags||[]).map(t=>`<span>#${esc(t)}</span>`).join('')}</div><div class="item-actions">${actions}</div></div></article>`;
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
 let c=e.target.closest('[data-add-custom]');if(c){openPicker(c.dataset.addCustom,c.dataset.source,c.dataset.collectionMode||'copy');return}
 let f=e.target.closest('[data-favorite]');if(f){toggleFavorite(f.dataset.favorite,f.dataset.favoriteJson);return}
 let cp=e.target.closest('[data-checkpoint]');if(cp){openCheckpoint(cp.dataset.checkpoint,cp.dataset.time);return}
 let re=e.target.closest('[data-resume]');if(re){resumeVideo(re.dataset.resume);return}
 let op=e.target.closest('[data-open]');if(op){chrome.tabs.create({url:op.dataset.open});return}
 let ci=e.target.closest('[data-copy-item]');if(ci){copyItem(ci.dataset.copyItem,ci.dataset.itemJson);return}
 let de=e.target.closest('[data-details-item]');if(de){showDetails(de.dataset.detailsItem,de.dataset.itemJson);return}
 let di=e.target.closest('[data-download-item]');if(di){downloadSingleItem(di.dataset.downloadItem,di.dataset.itemJson);return}
 let ei=e.target.closest('[data-export-item]');if(ei){openItemExport(ei.dataset.exportItem,ei.dataset.itemJson);return}
 let doOpen=e.target.closest('[data-details-open]');if(doOpen){chrome.tabs.create({url:doOpen.dataset.detailsOpen});return}
 if(e.target.matches('[data-close]'))e.target.closest('dialog')?.close();
}
async function resumeVideo(id){let s=await chrome.storage.local.get('videoProgress');let p=(s.videoProgress||[]).find(x=>x.videoId===id);if(p?.url)chrome.tabs.create({url:ts(p.url,p.lastPosition)});else notify('No resume URL saved.')}
async function toggleFavorite(id,json){let s=await chrome.storage.local.get('favorites');let a=Array.isArray(s.favorites)?s.favorites:[];let found=a.find(x=>(x.id&&x.id===id)||(x.videoId&&x.videoId===id));if(found){a=a.filter(x=>!((x.id&&x.id===id)||(x.videoId&&x.videoId===id)))}else{let x=data.find(v=>(v.id&&v.id===id)||(v.videoId&&v.videoId===id));if(!x&&json){try{x=JSON.parse(json)}catch{}}if(x)a.unshift({...x,favorite:true,favoritedAt:new Date().toISOString()})}await chrome.storage.local.set({favorites:a});notify(found?'Removed from Favorites.':'Added to Favorites.');await load()}
function openCheckpoint(video,time){$('#checkpointVideo').value=video;$('#checkpointTime').value=Number(time)||0;$('#checkpointLabel').value='';$('#checkpointDialog').showModal()}
async function createCheckpoint(e){e.preventDefault();let id=$('#checkpointVideo').value,time=Number($('#checkpointTime').value)||0,label=$('#checkpointLabel').value.trim()||'Learning checkpoint',h=(await chrome.storage.local.get('history')).history||[],v=h.find(x=>x.videoId===id)||{};let s=await chrome.storage.local.get('checkpoints'),a=s.checkpoints||[];a.unshift({id:crypto.randomUUID(),videoId:id,videoTitle:v.videoTitle||'YouTube Video',url:v.url||`https://www.youtube.com/watch?v=${id}`,timestamp:time,label,createdAt:new Date().toISOString(),type:'checkpoint'});await chrome.storage.local.set({checkpoints:a});$('#checkpointDialog').close();notify('Checkpoint saved.');if(current==='checkpoints')load()}
async function loadSource(key){let s=await chrome.storage.local.get(key);return Array.isArray(s[key])?s[key]:[]}
async function openPicker(id,source,mode='copy'){
 if(!pages.length)return notify('Create a collection first.');
 const sourcePage=allPages().find(p=>p.key===source);
 const available=pages.filter(p=>!sourcePage?.custom || p.id!==sourcePage.rawId);
 if(!available.length)return notify(mode==='move'?'No other collection is available.':'Create another collection first.');
 $('#pickerItemId').value=id;$('#pickerSource').value=source;$('#pickerMode').value=mode;
 $('#pagePickerTitle').textContent=mode==='move'?'Move to collection':'Add to collection';
 $('#pagePickerDescription').textContent=mode==='move'?'Remove this item from the current collection after it is added to the selected collection.':'Keep this item here and add a copy to the selected collection.';
 $('#pagePickerSubmit').textContent=mode==='move'?'Move':'Add';
 $('#pagePickerSelect').innerHTML=available.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
 $('#pagePickerDialog').showModal()
}
async function addToCollection(e){
 e.preventDefault();
 let page=pages.find(p=>p.id===$('#pagePickerSelect').value);if(!page)return;
 let source=$('#pickerSource').value,mode=$('#pickerMode').value||'copy',id=$('#pickerItemId').value;
 let arr=await loadSource(source),item=arr.find(x=>(x.id||x.videoId)===id);
 if(!item && id) item=arr.find(x=>x.videoId===id);
 if(!item)return notify('Item not found. Refresh the Library and try again.');
 let key=`libraryPage_${page.id}`,target=await loadSource(key);
 let exists=target.some(x=>(x.id&&item.id&&x.id===item.id)||(!item.id&&x.videoId===item.videoId&&x.type===item.type));
 if(!exists)target.unshift({...item,collectionAddedAt:new Date().toISOString()});
 let changes={[key]:target};
 if(mode==='move' && source.startsWith('libraryPage_')){
   changes[source]=arr.filter(x=>!((x.id&&item.id&&x.id===item.id)||(!item.id&&x.videoId===item.videoId&&x.type===item.type)));
 }
 await chrome.storage.local.set(changes);
 $('#pagePickerDialog').close();
 notify(mode==='move'?`Moved to ${page.name}.`:`Added to ${page.name}.`);
 await load();
}
async function removeItem(id){let p=info(),arr=await loadSource(p.key);await chrome.storage.local.set({[p.key]:arr.filter(x=>x.id!==id)});load()}
async function copyItem(id,json){let x=data.find(a=>(a.id||a.videoId)===id);if(!x&&json){try{x=JSON.parse(json)}catch{}}if(!x)return;const ok=await copyText(readable([x],info()));notify(ok?'Item copied.':'Copy failed. Check Chrome clipboard permissions.');}
async function copyText(text){
  try{await navigator.clipboard.writeText(String(text||''));return true}catch(_){
    try{
      const area=document.createElement('textarea');area.value=String(text||'');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.focus();area.select();
      const ok=document.execCommand('copy');area.remove();return ok;
    }catch(_){return false}
  }
}
async function copyPage(){const ok=await copyText(readable(data,info()));notify(ok?`Copied ${data.length} item(s) from ${info().name}.`:'Copy failed. Check Chrome clipboard permissions.')}
let exportSingleItem=null,exportSinglePage=null;
async function openExport(downloadOnly){exportSingleItem=null;exportSinglePage=null;let choices=allPages().map(p=>`<label class="choice"><input type="checkbox" value="${esc(p.id)}" ${p.id===current?'checked':''}>${p.icon} ${esc(p.name)}</label>`).join('');$('#exportChoices').innerHTML=choices;$('#exportTitle').textContent=downloadOnly?'Download selected library':'Export selected library';$('#exportDescription').textContent='Select one or more Library sections, then choose the output format.';$('#exportFormat').disabled=false;$('#exportFormat').value='txt';$('#exportDialog').showModal()}
async function openItemExport(id,json){let x=data.find(a=>(a.id||a.videoId)===id);if(!x&&json){try{x=JSON.parse(json)}catch{}}if(!x)return;exportSingleItem=x;exportSinglePage=info();$('#exportChoices').innerHTML=`<label class="choice"><input type="checkbox" checked disabled> ${esc(exportSinglePage.icon||'📚')} ${esc(exportSinglePage.name)} — selected item only</label>`;$('#exportTitle').textContent='Export this Library item';$('#exportDescription').textContent='The selected word, sentence, or learning item will be exported with its learning details.';$('#exportFormat').disabled=false;$('#exportFormat').value='txt';$('#exportDialog').showModal()}
async function downloadSingleItem(id,json){await openItemExport(id,json)}
async function submitExport(e){e.preventDefault();let bundles=[];if(exportSingleItem&&exportSinglePage){bundles=[{page:exportSinglePage,items:[exportSingleItem]}]}else{let ids=[...document.querySelectorAll('#exportChoices input[type="checkbox"]:checked')].map(x=>x.value);if(!ids.length)return notify('Select at least one page.');for(let id of ids){let p=infoBy(id);bundles.push({page:p,items:await pageData(p)})}}
 let fmtType=$('#exportFormat').value,payload=JSON.stringify({program:'Charlie MJ Language',version:'4.2.1',exportedAt:new Date().toISOString(),pages:bundles},null,2),mime='application/json',ext='json';
 if(fmtType==='txt'){payload=bundles.map(b=>readable(b.items,b.page)).join('\n\n'+'='.repeat(80)+'\n\n');mime='text/plain';ext='txt'}
 if(fmtType==='md'){payload=bundles.map(b=>markdown(b.items,b.page)).join('\n\n---\n\n');mime='text/markdown';ext='md'}
 if(fmtType==='doc'){payload=bundles.map(b=>docHtml(b.items,b.page)).join('<hr>');payload=docDocument(payload);mime='application/msword';ext='doc'}
 if(fmtType==='pdf'){
   try{
     let text=bundles.map(b=>readable(b.items,b.page)).join('\n\n'+'='.repeat(80)+'\n\n');
     let pdf=await pdfFromText(text);
     let set=(await chrome.storage.local.get('settings')).settings||{};
     await downloadBinary(`${set.downloadRoot||'Charlie MJ Language'}/Exports/${safe(bundles.map(x=>x.page.name).join('-'))}.pdf`,pdf,'application/pdf');
     $('#exportDialog').close();notify('PDF export started.');exportSingleItem=null;exportSinglePage=null;return;
   }catch(error){console.error('Charlie MJ PDF export failed:',error);notify(`PDF export failed: ${error?.message||error}`);return}
 }
 if(fmtType==='csv'){payload=csv(bundles.flatMap(b=>b.items.map(x=>({page:b.page.name,...x}))));mime='text/csv';ext='csv'}
 if(fmtType==='anki'){payload=bundles.flatMap(b=>b.items).map(x=>`${String(x.word||x.sentence||'').replaceAll('\\t',' ')}\\t${String(x.translation||x.sentenceTranslation||'').replaceAll('\\t',' ')}\\t${String(x.sentence||'').replaceAll('\\t',' ')}`).join('\\n');mime='text/tab-separated-values';ext='txt'}
 if(['srt','vtt'].includes(fmtType)){let rows=bundles.flatMap(b=>b.items).filter(x=>x.sentence||x.subtitle).map((x,i)=>`${fmtType==='srt'?i+1+'\\n':''}${timecode(x.timestamp||0,fmtType)} --> ${timecode((x.timestamp||0)+(x.duration||2),fmtType)}\\n${x.sentence||x.subtitle||''}${x.translation||x.sentenceTranslation?'\\n'+(x.translation||x.sentenceTranslation):''}`).join('\\n\\n');payload=fmtType==='vtt'?'WEBVTT\\n\\n'+rows:rows;mime='text/plain';ext=fmtType}
 let set=(await chrome.storage.local.get('settings')).settings||{};
 try{
   const filename=`${set.downloadRoot||'Charlie MJ Language'}/Exports/${safe(bundles.map(x=>x.page.name).join('-'))}.${ext}`;
   await download(filename,payload,mime);
   $('#exportDialog').close();
   notify(`${fmtType.toUpperCase()} export started.`);
   exportSingleItem=null;exportSinglePage=null;
 }catch(error){
   console.error('Charlie MJ export failed:',error);
   notify(`Export failed: ${error?.message||error}`);
 }
}
function markdown(items,p){let out=[`# Charlie MJ Language — ${p.name}`,``,`Exported: ${new Date().toLocaleString()}`,``,`Total items: ${items.length}`,``];items.forEach((x,i)=>{out.push(`## ${i+1}. ${itemTitle(x)}`);if(x.word)out.push(`- **Word:** ${x.word}`);if(x.sentence)out.push(`- **Sentence:** ${x.sentence}`);out.push(`- **Translation:** ${x.translation||x.sentenceTranslation||''}`,`- **Language:** ${languageName(x.language)}`,`- **Level:** ${x.level||'A1'} — ${difficultyFor(x.level)}`,`- **Video:** ${x.videoTitle||x.title||''}`,`- **URL:** ${x.url||''}`,`- **Timestamp:** ${fmt(itemTimestamp(x))}`,`- **Saved:** ${x.createdAt||x.learnedAt||''}`);if(x.pos)out.push(`- **Part of speech:** ${x.pos}`);if(x.lemma)out.push(`- **Lemma:** ${x.lemma}`);if(x.tags?.length)out.push(`- **Tags:** ${x.tags.join(', ')}`);if(x.note)out.push(`- **Notes:** ${x.note}`);if(isSentenceItem(x))out.push('',sentenceMarkdown(x));out.push('')});return out.join('\n')}
function sentenceMarkdown(x){let words=Array.isArray(x.words)&&x.words.length?x.words:deriveSentenceWords(x);let lines=['### Sentence Study','',`**Complete translation:** ${x.sentenceTranslation||x.translation||''}`,'','| Original | Meaning | POS | Lemma | Suffix / Grammar |','|---|---|---|---|---|'];for(const w of words)lines.push(`| ${w.word||''} | ${w.translation||'—'} | ${w.posLabel||w.pos||'Other'} | ${w.lemma||'—'} | ${w.suffix||w.morphologyLabel||'—'} |`);return lines.join('\n')}
function docDocument(body){return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.5;color:#111}h1{font-size:24pt}h2{font-size:16pt;margin-top:24pt}h3{font-size:13pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;text-align:left}.meta{color:#555}</style></head><body>${body}</body></html>`}
function docHtml(items,p){return `<h1>Charlie MJ Language — ${esc(p.name)}</h1><p class="meta">Exported ${esc(new Date().toLocaleString())} · ${items.length} item(s)</p>${items.map((x,i)=>`<h2>${i+1}. ${esc(itemTitle(x))}</h2><p><strong>Original:</strong> ${esc(x.word||x.sentence||x.title||'')}</p><p><strong>Translation:</strong> ${esc(x.translation||x.sentenceTranslation||'')}</p><p><strong>Language:</strong> ${esc(languageName(x.language))} · <strong>Level:</strong> ${esc(x.level||'A1')} · <strong>Difficulty:</strong> ${esc(difficultyFor(x.level))}</p><p><strong>Video:</strong> ${esc(x.videoTitle||x.title||'')}<br><strong>URL:</strong> ${esc(x.url||'')}<br><strong>Timestamp:</strong> ${esc(fmt(itemTimestamp(x)))}<br><strong>Saved:</strong> ${esc(x.createdAt||x.learnedAt||'')}</p>${x.pos?`<p><strong>POS:</strong> ${esc(x.pos)}</p>`:''}${x.lemma?`<p><strong>Lemma:</strong> ${esc(x.lemma)}</p>`:''}${x.tags?.length?`<p><strong>Tags:</strong> ${esc(x.tags.join(', '))}</p>`:''}${x.note?`<p><strong>Notes:</strong> ${esc(x.note)}</p>`:''}${isSentenceItem(x)?docSentence(x):''}`).join('')}`}
function docSentence(x){let words=Array.isArray(x.words)&&x.words.length?x.words:deriveSentenceWords(x);return `<h3>Sentence Study</h3><p><strong>Complete translation:</strong> ${esc(x.sentenceTranslation||x.translation||'')}</p><table><thead><tr><th>Original</th><th>Meaning</th><th>POS</th><th>Lemma</th><th>Suffix / Grammar</th></tr></thead><tbody>${words.map(w=>`<tr><td>${esc(w.word||'')}</td><td>${esc(w.translation||'—')}</td><td>${esc(w.posLabel||w.pos||'Other')}</td><td>${esc(w.lemma||'—')}</td><td>${esc(w.suffix||w.morphologyLabel||'—')}</td></tr>`).join('')}</tbody></table>`}
function deriveSentenceWords(x){return String(x.sentence||'').split(/\s+/).filter(Boolean).map(word=>analyzeStoredWord(word,x))}
function analyzeStoredWord(raw,x){let word=String(raw||'').replace(/^[\s.,!?;:"“”‘’]+|[\s.,!?;:"“”‘’]+$/g,''),lower=word.toLocaleLowerCase('tr');let pronouns=new Set(['ben','sen','o','biz','siz','onlar','bana','sana','ona','bizi','sizi','onları','benim','senin','onun','bizim','sizin','onların']);let verb=/(iyor|ıyor|uyor|üyor|acak|ecek|miş|mış|muş|müş|di|dı|du|dü|mak|mek|yor)(um|ım|im|üm|sun|sın|sin|sunuz|siniz|sünüz|ız|iz|uz|üz)?$/i.test(lower);let pos=pronouns.has(lower)?'Pronoun':verb?'Verb':'Noun';let lemma=verb?lower.replace(/(iyor|ıyor|uyor|üyor)(um|ım|im|üm|sun|sın|sin|sunuz|siniz|sünüz|ız|iz|uz|üz)?$/i,'').replace(/(acak|ecek|miş|mış|muş|müş|di|dı|du|dü)(m|n|k)?$/i,'')+'mek':lower;let suffixMatch=lower.match(/(ımız|imiz|umuz|ümüz|ınız|iniz|unuz|ünüz|lar|ler|iyor|ıyor|uyor|üyor|acak|ecek|miş|mış|muş|müş|lik|lık|luk|lük|siz|sız|suz|süz|ci|cı|cu|cü|li|lı|lu|lü|den|dan|de|da|i|ı|u|ü)$/i);let suffix=suffixMatch?suffixMatch[0]:'';let label=suffix?(/(den|dan|de|da)$/i.test(suffix)?'Case suffix':/(lar|ler)$/i.test(suffix)?'Plural suffix':/(iyor|ıyor|uyor|üyor|acak|ecek|miş|mış|muş|müş)$/i.test(suffix)?'Tense / aspect suffix':'Turkish suffix'):'';return {word,pos,posLabel:pos,lemma,suffix,morphologyLabel:label,translation:x?.words?.find(w=>String(w.word||'').toLowerCase()===lower)?.translation||''}}
async function showDetails(id,json){let x=data.find(a=>(a.id||a.videoId)===id);if(!x&&json){try{x=JSON.parse(json)}catch{}}if(!x)return;let favs=(await chrome.storage.local.get('favorites')).favorites||[],isFav=favs.some(f=>(f.videoId&&x.videoId&&f.videoId===x.videoId)||(f.id&&x.id&&f.id===x.id));let collectionNames=[];for(const p of pages){let a=await loadSource(`libraryPage_${p.id}`);if(a.some(y=>(y.id&&x.id&&y.id===x.id)||(!x.id&&y.videoId===x.videoId&&y.type===x.type)))collectionNames.push(p.name)}$('#detailsTitle').textContent=isSentenceItem(x)?'Sentence Learning Card':'Vocabulary / Learning Card';$('#detailsBody').innerHTML=detailsHtml(x,isFav,collectionNames);$('#detailsDialog').showModal();if(isSentenceItem(x))enhanceSentenceDetails(x)}
function detailsHtml(x,isFav,collections){let level=x.level||'A1',diff=x.difficulty||difficultyFor(level),saved=x.createdAt||x.learnedAt||x.savedAt||'',time=itemTimestamp(x),url=x.url?ts(x.url,time):'';let rows=[['Original',x.word||x.sentence||x.title||''],['Translation',x.translation||x.sentenceTranslation||''],['Language',languageName(x.language)],['Language level',`${level} — ${diff}`],['Video title',x.videoTitle||x.title||''],['Video URL',x.url||''],['Timestamp',fmt(time)],['Date saved / learned',saved?new Date(saved).toLocaleString():'—'],['Collection',collections.length?collections.join(', '):'Not added'],['Favorite',isFav?'Yes':'No'],['Tags / labels',(x.tags||[]).join(', ')||'—'],['Notes',x.note||x.notes||'—'],['Source / context',x.source||'Library'],['POS',x.pos||'—'],['Lemma / base form',x.lemma||'—']];return `<div class="details-hero"><div class="details-original">${esc(x.word||x.sentence||x.title||'Learning item')}</div><div class="details-translation">${esc(x.translation||x.sentenceTranslation||'Translation not saved')}</div>${url?`<button class="primary" data-details-open="${esc(url)}">▶ Open YouTube at ${esc(fmt(time))}</button>`:''}</div><div class="details-grid">${rows.map(r=>`<div class="detail-row"><span>${esc(r[0])}</span><strong>${esc(r[1])}</strong></div>`).join('')}</div>${x.dictionary?`<section class="sentence-study"><h3>📖 Dictionary Details</h3><p><strong>Source:</strong> ${esc(x.dictionarySource||'Wiktionary / Kaikki')}</p>${(x.dictionary.entries||[]).slice(0,6).map(e=>`<div class="entry"><strong>${esc(e.pos||e.partOfSpeech||'')}</strong>${e.phonetic?`<p><strong>Pronunciation:</strong> ${esc(e.phonetic)}</p>`:''}${(e.meanings||[]).slice(0,4).map(m=>{const defs=m.definitions||m.meanings||[];return defs.slice(0,3).map(def=>{const text=typeof def==='string'?def:(def.definition||'');const ex=typeof def==='object'&&Array.isArray(def.example)?def.example:[];const syn=typeof def==='object'&&Array.isArray(def.synonyms)?def.synonyms:[];return `<p>${esc(text)}</p>${ex.slice(0,2).map(z=>`<p class="note"><strong>Example:</strong> ${esc(z)}</p>`).join('')}${syn.length?`<p class="note"><strong>Synonyms:</strong> ${esc(syn.join(', '))}</p>`:''}`}).join('')}).join('')}</div>`).join('')}${x.referenceLinks?.length?`<div class="reference-links"><strong>Reference dictionaries:</strong> ${x.referenceLinks.map(a=>`<a target="_blank" rel="noopener" href="${esc(a.url)}">${esc(a.name)}</a>`).join(' · ')}</div>`:''}${x.dictionarySourceUrl?`<p><a target="_blank" rel="noopener" href="${esc(x.dictionarySourceUrl)}">Open dictionary source</a></p>`:''}</section>`:''}${isSentenceItem(x)?`<section class="sentence-study"><h3>Sentence Grammar & Word Study</h3><p class="study-translation"><strong>Complete sentence translation:</strong> ${esc(x.sentenceTranslation||x.translation||'')}</p><div id="sentenceAnalysisBody"><p>Preparing word-by-word analysis…</p></div></section>`:''}`}
async function enhanceSentenceDetails(x){let words=Array.isArray(x.words)&&x.words.length?x.words.map(w=>({...w,word:w.word||''})):deriveSentenceWords(x);if(!words.length)return;let missing=words.filter(w=>!w.translation);if(missing.length){let settings=(await chrome.storage.local.get('settings')).settings||{};let source=settings.sourceLanguage||'tr',target=settings.targetLanguage||'en';let results=await Promise.all(words.map(async w=>{if(w.translation)return w;try{let r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(w.word)}&langpair=${encodeURIComponent(source+'|'+target)}`);let j=await r.json();return {...w,translation:j?.responseData?.translatedText||''}}catch{return w}}));words=results;let updated={...x,words};await persistWords(updated)}let el=$('#sentenceAnalysisBody');if(el)el.innerHTML=`<div class="word-study-grid">${words.map(w=>`<article class="word-study ${esc(String(w.pos||w.posLabel||'other').toLowerCase())}" style="--word-role:${esc(w.color||roleColor(w.pos||w.posLabel))}"><div class="study-word">${esc(w.word)}</div><div class="study-meaning">${esc(w.translation||'—')}</div><div class="study-meta"><span>${esc(w.posLabel||w.pos||'Other')}</span><span>${esc(w.cefr||x.level||'A1')}</span></div><div class="study-lemma">Base / lemma: <strong>${esc(w.lemma||analyzeStoredWord(w.word,x).lemma||'—')}</strong></div>${w.suffix||w.morphologyLabel?`<div class="study-suffix">${esc(w.suffix||'')} ${esc(w.morphologyLabel||'Turkish suffix')}</div>`:''}</article>`).join('')}</div>`}
async function persistWords(updated){for(const key of ['vocabulary','sentenceLearning']){let s=await chrome.storage.local.get(key),a=Array.isArray(s[key])?s[key]:[],i=a.findIndex(y=>y.id===updated.id);if(i>=0)a[i]=updated;await chrome.storage.local.set({[key]:a})}}
function roleColor(pos){return ({noun:'#38bdf8',verb:'#fb7185',adjective:'#a78bfa',adverb:'#4ade80',pronoun:'#facc15',preposition:'#f472b6',conjunction:'#fb923c',determiner:'#818cf8',numeral:'#a3e635',particle:'#22d3ee'}[String(pos||'').toLowerCase()]||'#e2e8f0')}
function readable(items,p){let l=[`Charlie MJ Language`,`Library: ${p.name}`,`Exported: ${new Date().toLocaleString()}`,`Total items: ${items.length}`,''];items.forEach((x,i)=>{l.push(`• ${itemTitle(x)}`);if(x.word)l.push(`  Word: ${x.word}`);if(x.sentence)l.push(`  Sentence: ${x.sentence}`);l.push(`  Translation: ${x.translation||x.sentenceTranslation||''}`,`  Language: ${languageName(x.language)}`,`  Level: ${x.level||'A1'} — ${difficultyFor(x.level)}`);if(x.videoTitle||x.title)l.push(`  Video: ${x.videoTitle||x.title}`);if(x.timestamp!=null)l.push(`  Timestamp: ${fmt(x.timestamp)}`);if(x.lastPosition!=null)l.push(`  Last position: ${fmt(x.lastPosition)}`);if(x.url)l.push(`  URL: ${x.url}`);if(x.createdAt||x.learnedAt)l.push(`  Saved: ${x.createdAt||x.learnedAt}`);if(x.pos)l.push(`  POS: ${x.pos}`);if(x.lemma)l.push(`  Lemma: ${x.lemma}`);if(x.tags?.length)l.push(`  Tags: ${x.tags.join(', ')}`);if(x.note)l.push(`  Notes: ${x.note}`);if(isSentenceItem(x)){l.push('  Complete sentence translation: '+(x.sentenceTranslation||x.translation||''));for(const w of (Array.isArray(x.words)&&x.words.length?x.words:deriveSentenceWords(x)))l.push(`    ${w.word} → ${w.translation||'—'} · ${w.posLabel||w.pos||'Other'} · lemma: ${w.lemma||'—'}${w.suffix?' · suffix: '+w.suffix:''}`)}l.push('')});return l.join('\n')}
function csv(items){let keys=[...new Set(items.flatMap(x=>Object.keys(x)))];return [keys.join(','),...items.map(x=>keys.map(k=>`"${String(Array.isArray(x[k])?x[k].join('|'):x[k]??'').replaceAll('"','""')}"`).join(','))].join('\n')}
function parseCSV(t){let lines=t.split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];let h=split(lines[0]);return lines.slice(1).map(l=>{let v=split(l),x={};h.forEach((k,i)=>x[k]=v[i]||'');x.id=x.id||crypto.randomUUID();if(x.timestamp)x.timestamp=Number(x.timestamp);x.tags=String(x.tags||'').split('|').filter(Boolean);return x})}
function split(l){let a=[],c='',q=false;for(let i=0;i<l.length;i++){let x=l[i];if(x==='"'&&l[i+1]==='"'){c+='"';i++;continue}if(x==='"'){q=!q;continue}if(x===','&&!q){a.push(c);c='';continue}c+=x}a.push(c);return a}
function timecode(sec,type){let ms=Math.max(0,Math.round(Number(sec||0)*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),z=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${type==='srt'?',':'.'}${String(z).padStart(3,'0')}`}
function normaliseDownloadPath(path, fallback='library.txt'){
  return String(path||fallback).replace(/^[\\/]+/,'').replace(/[<>:"|?*]+/g,'_').replace(/\\+/g,'/');
}
async function startDownloadBlob(path,blob){
  const filename=normaliseDownloadPath(path);
  const url=URL.createObjectURL(blob);
  try{
    const id=await chrome.downloads.download({url,filename,saveAs:false,conflictAction:'uniquify'});
    if(id==null) throw new Error('Chrome did not create a download.');
    return id;
  }catch(error){
    throw new Error(`Chrome download failed: ${error?.message||error}`);
  }finally{
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
}
async function download(path,text,mime){
  return startDownloadBlob(path,new Blob([String(text??'')],{type:`${mime};charset=utf-8`}));
}
async function downloadBinary(path,bytes,mime){
  return startDownloadBlob(path,new Blob([bytes],{type:mime}));
}
async function pdfFromText(text){let lines=[];for(const raw of String(text).split(/\r?\n/)){let line=raw||' ';while(line.length>72){lines.push(line.slice(0,72));line=line.slice(72)}lines.push(line)}let pageHeight=1754,pageWidth=1240,margin=75,lineH=29,perPage=Math.floor((pageHeight-margin*2)/lineH),pagesData=[];for(let p=0;p<lines.length||!pagesData.length;p+=perPage){let chunk=lines.slice(p,p+perPage),canvas=document.createElement('canvas');canvas.width=pageWidth;canvas.height=pageHeight;let c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,pageWidth,pageHeight);c.fillStyle='#111';c.font='24px Arial, sans-serif';c.textBaseline='top';chunk.forEach((line,i)=>c.fillText(line,margin,margin+i*lineH));let b64=canvas.toDataURL('image/jpeg',0.9).split(',')[1];let bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);pagesData.push({bytes,width:pageWidth,height:pageHeight})}return buildImagePdf(pagesData)}
function buildImagePdf(pagesData){let objects=[];const add=s=>{objects.push(typeof s==='string'?new TextEncoder().encode(s):s);return objects.length};let catalogId=add('');let pagesId=add('');let pageIds=[],contentIds=[],imageIds=[];pagesData.forEach((pg,i)=>{pageIds.push(add(''));contentIds.push(add(''));imageIds.push(add(''))});let chunks=[],offsets=[0],pos=0;function obj(id,head,body){let h=new TextEncoder().encode(`${id} 0 obj\n${head}\nstream\n`),tail=new TextEncoder().encode('\nendstream\nendobj\n');let all=new Uint8Array(h.length+body.length+tail.length);all.set(h);all.set(body,h.length);all.set(tail,h.length+body.length);chunks.push(all);offsets[id]=pos;pos+=all.length}function plain(id,body){let b=new TextEncoder().encode(body);chunks.push(b);offsets[id]=pos;pos+=b.length}let total=objects.length; // object ids already reserved
pagesData.forEach((pg,i)=>{let content=new TextEncoder().encode(`q\n${pg.width} 0 0 ${pg.height} 0 0 cm\n/Im${i+1} Do\nQ\n`);let cHead=`<< /Length ${content.length} >>`;obj(contentIds[i],cHead,content);let iHead=`<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>`;obj(imageIds[i],iHead,pg.bytes);let pHead=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pg.width} ${pg.height}] /Resources << /XObject << /Im${i+1} ${imageIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;plain(pageIds[i],`${pageIds[i]} 0 obj\n${pHead}\nendobj\n`) });plain(pagesId,`${pagesId} 0 obj\n<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>\nendobj\n`);plain(catalogId,`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`);let header=new TextEncoder().encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');let bodyParts=[header],cursor=header.length;let realOffsets={};for(const chunk of chunks){let m=new TextDecoder().decode(chunk).match(/^(\d+) 0 obj/);if(m)realOffsets[Number(m[1])]=cursor;bodyParts.push(chunk);cursor+=chunk.length}let xrefStart=cursor;let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)xref+=String(realOffsets[i]||0).padStart(10,'0')+' 00000 n \n';xref+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;bodyParts.push(new TextEncoder().encode(xref));let totalLen=bodyParts.reduce((n,b)=>n+b.length,0),out=new Uint8Array(totalLen),at=0;for(const b of bodyParts){out.set(b,at);at+=b.length}return out}
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
