/** Charlie MJ Language settings controller. Preferences remain local in Chrome storage. */
const defaults={sourceLanguage:'tr',targetLanguage:'en',translationProvider:'mymemory',libreTranslateUrl:'',focusMode:true,posColors:true,boldPOS:true,showLevels:true,autoTranslate:true,hideRecommendations:false,hideShorts:false,hideComments:false,showToolbarUnderVideo:true,downloadRoot:'Charlie MJ Language',downloadSaveAs:false,wordCardAutoCloseMs:6000,captionAutoFetch:true,captionFetchIntervalMs:180,captionSyncIntervalMs:80,captionSyncToleranceMs:350,toolbarRevealMode:'always',toolbarHoverZonePx:140,toolbarDragAnywhere:true,toolbarSnap:'free',toolbarAutoHideDelayMs:1800,theme:'dark',subtitlePreloadTranslations:2,captionMaxRetries:20,subtitleDisplayMode:'both',originalFontSize:28,translationFontSize:22,originalBold:true,translationBold:false,originalUnderline:false,translationUnderline:false,originalItalic:false,translationItalic:false,sentenceShowLevel:true,replayCount:1,playbackSpeed:1,autoPauseAfterSubtitle:false,studyModeDefault:false,showWordPronunciation:true,showWordTransliteration:false,markKnownStopsHighlight:true,toolbarPosition:{left:50,top:null,bottom:58},toolbarActionOrder:['toggle','transcript','word','sentence','save','bookmark','capture','watch','focus','theme'],toolbarMoreActions:['translate','replay','loop','speed','ab','study','save-sentence','download-transcript','download-vocabulary','report','diagnostics','settings'],grammarColors:{noun:'#38bdf8',verb:'#fb7185',adjective:'#a78bfa',adverb:'#4ade80',pronoun:'#facc15',preposition:'#f472b6',conjunction:'#fb923c',determiner:'#818cf8',numeral:'#a3e635',particle:'#22d3ee',other:'#e2e8f0',turkishSuffix:'#c084fc',turkishCase:'#f59e0b',turkishPlural:'#34d399',turkishPossessive:'#60a5fa',turkishTense:'#f87171',turkishPerson:'#fb7185'}};
const colorFields=[
  ['noun','Noun'],['pronoun','Pronoun'],['verb','Verb'],['adjective','Adjective'],['adverb','Adverb'],['preposition','Preposition'],['conjunction','Conjunction'],['determiner','Determiner'],['numeral','Numeral'],['particle','Particle'],['other','Other'],
  ['turkishSuffix','Turkish Suffix'],['turkishCase','Turkish Case'],['turkishPlural','Turkish Plural'],['turkishPossessive','Turkish Possessive'],['turkishTense','Turkish Tense / Aspect'],['turkishPerson','Turkish Person']
];

const TOOLBAR_LABELS={toggle:'CMJ',transcript:'Transcript',word:'Word Learning',sentence:'Sentence Learning',save:'Save',bookmark:'Bookmark',capture:'Capture',watch:'Watch Later',focus:'Focus',theme:'Theme',translate:'Translate',replay:'Replay',loop:'Loop Sentence',speed:'Speed',ab:'A/B Replay',study:'Study Mode','save-sentence':'Save Sentence','download-transcript':'Download Transcript','download-vocabulary':'Download Vocabulary',report:'Learning Report',diagnostics:'Caption Diagnostics',settings:'Settings'};
function renderToolbarManager(settings){
 const visible=document.getElementById('toolbarVisibleList'),more=document.getElementById('toolbarMoreList'); if(!visible||!more)return;
 visible.innerHTML='';more.innerHTML='';
 (settings.toolbarActionOrder||defaults.toolbarActionOrder).forEach(a=>visible.appendChild(toolbarItem(a)));
 (settings.toolbarMoreActions||defaults.toolbarMoreActions).forEach(a=>more.appendChild(toolbarItem(a)));
 [visible,more].forEach(list=>{
   list.addEventListener('dragover',e=>e.preventDefault());
   list.addEventListener('drop',e=>{
     e.preventDefault();
     if(e.target.closest('.drag-item')) return;
     const id=e.dataTransfer.getData('text/plain');
     const src=document.querySelector(`[data-action="${CSS.escape(id)}"]`);
     if(src) list.appendChild(src);
   });
 });
 function toolbarItem(a){const el=document.createElement('div');el.className='drag-item';el.draggable=true;el.dataset.action=a;el.textContent='☰ '+(TOOLBAR_LABELS[a]||a);el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',a));el.addEventListener('drop',e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain'),src=document.querySelector(`[data-action="${CSS.escape(id)}"]`);if(src&&src!==el)el.parentElement.insertBefore(src,el)});return el}
}

(async()=>{
  const {settings={}}=await chrome.storage.local.get('settings');
  const s={...defaults,...settings,grammarColors:{...defaults.grammarColors,...(settings.grammarColors||{})}};
  renderToolbarManager(s);
  const map={source:'sourceLanguage',target:'targetLanguage',provider:'translationProvider',libreUrl:'libreTranslateUrl',focusMode:'focusMode',posColors:'posColors',boldPOS:'boldPOS',showLevels:'showLevels',autoTranslate:'autoTranslate',hideRecommendations:'hideRecommendations',hideShorts:'hideShorts',hideComments:'hideComments',showToolbarUnderVideo:'showToolbarUnderVideo',downloadRoot:'downloadRoot',downloadSaveAs:'downloadSaveAs',wordCardAutoCloseMs:'wordCardAutoCloseMs',captionAutoFetch:'captionAutoFetch',captionFetchIntervalMs:'captionFetchIntervalMs',captionSyncIntervalMs:'captionSyncIntervalMs',captionSyncToleranceMs:'captionSyncToleranceMs',toolbarRevealMode:'toolbarRevealMode',toolbarHoverZonePx:'toolbarHoverZonePx',toolbarDragAnywhere:'toolbarDragAnywhere',toolbarSnap:'toolbarSnap',toolbarAutoHideDelayMs:'toolbarAutoHideDelayMs',theme:'theme',subtitlePreloadTranslations:'subtitlePreloadTranslations',captionMaxRetries:'captionMaxRetries',subtitleDisplayMode:'subtitleDisplayMode',originalFontSize:'originalFontSize',translationFontSize:'translationFontSize',originalBold:'originalBold',translationBold:'translationBold',originalUnderline:'originalUnderline',translationUnderline:'translationUnderline',originalItalic:'originalItalic',translationItalic:'translationItalic',sentenceShowLevel:'sentenceShowLevel',replayCount:'replayCount',playbackSpeed:'playbackSpeed',autoPauseAfterSubtitle:'autoPauseAfterSubtitle',studyModeDefault:'studyModeDefault',showWordPronunciation:'showWordPronunciation',showWordTransliteration:'showWordTransliteration',markKnownStopsHighlight:'markKnownStopsHighlight'};
  for(const [id,key] of Object.entries(map)){const el=document.getElementById(id);if(!el)continue;if(el.type==='checkbox') el.checked=Boolean(s[key]); else el.value=String(s[key] ?? '')}
  colorFields.forEach(([key])=>{const el=document.getElementById(`color-${key}`);if(el)el.value=s.grammarColors[key]||defaults.grammarColors[key]});
  buildSettingsNavigation();
})();

function buildSettingsNavigation(){
  const nav=document.getElementById('settingsNav');
  if(!nav)return;
  const categoryMap={
    'Language':'General',
    'Screen theme':'Appearance',
    'Extension toolbar':'Toolbar',
    'Toolbar Manager':'Toolbar',
    'Subtitle & timeline engine':'Subtitles & Timeline',
    'Subtitle display & learning modes':'Subtitles & Timeline',
    'Original subtitle typography':'Subtitles & Timeline',
    'Translation subtitle typography':'Subtitles & Timeline',
    'Video learning controls':'Learning',
    'Word learning':'Learning',
    'Grammar & Turkish morphology colors':'Language Intelligence',
    'Translation provider':'Translation',
    'Downloads':'Downloads',
    'Focus controls':'Focus'
  };
  const categoryMeta={
    'General':['🌍','Language and core preferences'],
    'Appearance':['☼','Theme and visual appearance'],
    'Toolbar':['☰','Toolbar placement and actions'],
    'Subtitles & Timeline':['💬','Caption engine and subtitle display'],
    'Learning':['🧠','Replay, Study Mode and word learning'],
    'Language Intelligence':['🔤','POS, CEFR and morphology colors'],
    'Translation':['🌐','Translation provider configuration'],
    'Downloads':['⬇','Export and download behavior'],
    'Focus':['🎯','YouTube distraction controls']
  };
  const groups=new Map();
  [...document.querySelectorAll('main>section')].forEach((section,index)=>{
    const h=section.querySelector('h2'); if(!h)return;
    const title=h.textContent.trim(); const category=categoryMap[title]||'General';
    section.dataset.settingsCategory=category;
    if(!groups.has(category))groups.set(category,[]);
    groups.get(category).push(section);
  });
  nav.innerHTML='<div class="settings-nav-title">⚙ Charlie MJ</div><p>Settings</p>';
  for(const [category,sections] of groups){
    const [icon,hint]=categoryMeta[category]||['•','Settings'];
    const button=document.createElement('button');
    button.type='button'; button.className='settings-category'; button.dataset.category=category;
    button.innerHTML=`<span>${icon} ${category}</span><small>${hint}</small>`;
    button.addEventListener('click',()=>showSettingsCategory(category));
    nav.appendChild(button);
  }
  showSettingsCategory(groups.keys().next().value||'General');

  function showSettingsCategory(category){
    document.querySelectorAll('main>section').forEach(section=>section.classList.toggle('settings-visible',section.dataset.settingsCategory===category));
    document.querySelectorAll('.settings-category').forEach(button=>button.classList.toggle('active',button.dataset.category===category));
    const title=document.getElementById('settingsContextTitle');
    const hint=document.getElementById('settingsContextHint');
    if(title)title.textContent=category;
    if(hint)hint.textContent=categoryMeta[category]?.[1]||'Settings';
  }
}


document.getElementById('save').onclick=async()=>{
  const grammarColors={};
  colorFields.forEach(([key])=>{grammarColors[key]=document.getElementById(`color-${key}`)?.value||defaults.grammarColors[key]});
  const existing=(await chrome.storage.local.get('settings')).settings||{};
  const settings={...defaults,...existing,
    sourceLanguage:document.getElementById('source').value,
    targetLanguage:document.getElementById('target').value,
    translationProvider:document.getElementById('provider').value,
    libreTranslateUrl:document.getElementById('libreUrl').value,
    focusMode:document.getElementById('focusMode').checked,
    posColors:document.getElementById('posColors').checked,
    boldPOS:document.getElementById('boldPOS').checked,
    showLevels:document.getElementById('showLevels').checked,
    autoTranslate:document.getElementById('autoTranslate').checked,
    hideRecommendations:document.getElementById('hideRecommendations').checked,
    hideShorts:document.getElementById('hideShorts').checked,
    hideComments:document.getElementById('hideComments').checked,
    showToolbarUnderVideo:document.getElementById('showToolbarUnderVideo').checked,
    downloadRoot:document.getElementById('downloadRoot').value.trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/^\.+/,'').replace(/\s+/g,' ').replace(/^\/+|\/+$/g,'')||'Charlie MJ Language',
    downloadSaveAs:document.getElementById('downloadSaveAs').checked,
    wordCardAutoCloseMs:Math.max(1500,Math.min(20000,Number(document.getElementById('wordCardAutoCloseMs').value)||6000)),
    captionAutoFetch:document.getElementById('captionAutoFetch').checked,
    captionFetchIntervalMs:Math.max(80,Math.min(1000,Number(document.getElementById('captionFetchIntervalMs').value)||180)),
    captionSyncIntervalMs:Math.max(40,Math.min(500,Number(document.getElementById('captionSyncIntervalMs').value)||80)),
    captionSyncToleranceMs:Math.max(0,Math.min(1500,Number(document.getElementById('captionSyncToleranceMs').value)||350)),
    toolbarRevealMode:document.getElementById('toolbarRevealMode').value,
    toolbarHoverZonePx:Math.max(40,Math.min(500,Number(document.getElementById('toolbarHoverZonePx').value)||140)),
    toolbarDragAnywhere:document.getElementById('toolbarDragAnywhere').checked,
    toolbarSnap:document.getElementById('toolbarSnap').value,
    toolbarAutoHideDelayMs:Math.max(500,Math.min(10000,Number(document.getElementById('toolbarAutoHideDelayMs').value)||1800)),
    theme:document.getElementById('theme').value,
    subtitlePreloadTranslations:Math.max(0,Math.min(5,Number(document.getElementById('subtitlePreloadTranslations').value)||2)),
    captionMaxRetries:Math.max(1,Math.min(30,Number(document.getElementById('captionMaxRetries').value)||20)),
    subtitleDisplayMode:document.getElementById('subtitleDisplayMode').value,
    originalFontSize:Math.max(10,Math.min(72,Number(document.getElementById('originalFontSize').value)||28)),
    translationFontSize:Math.max(10,Math.min(72,Number(document.getElementById('translationFontSize').value)||22)),
    originalBold:document.getElementById('originalBold').value==='true',
    translationBold:document.getElementById('translationBold').value==='true',
    originalUnderline:document.getElementById('originalUnderline').checked,
    translationUnderline:document.getElementById('translationUnderline').checked,
    originalItalic:document.getElementById('originalItalic').checked,
    translationItalic:document.getElementById('translationItalic').checked,
    sentenceShowLevel:document.getElementById('sentenceShowLevel').checked,
    replayCount:Math.max(1,Math.min(5,Number(document.getElementById('replayCount').value)||1)),
    playbackSpeed:Number(document.getElementById('playbackSpeed').value)||1,
    autoPauseAfterSubtitle:document.getElementById('autoPauseAfterSubtitle').checked,
    studyModeDefault:document.getElementById('studyModeDefault').checked,
    showWordPronunciation:document.getElementById('showWordPronunciation').checked,
    showWordTransliteration:document.getElementById('showWordTransliteration').checked,
    markKnownStopsHighlight:document.getElementById('markKnownStopsHighlight').checked,
    toolbarActionOrder:[...document.querySelectorAll('#toolbarVisibleList .drag-item')].map(x=>x.dataset.action),
    toolbarMoreActions:[...document.querySelectorAll('#toolbarMoreList .drag-item')].map(x=>x.dataset.action),
    grammarColors
  };
  await chrome.storage.local.set({settings});
  const saveButton=document.getElementById('save');
  const status=document.getElementById('status');
  saveButton.classList.remove('saving');
  saveButton.classList.add('saved');
  saveButton.textContent='✓ Saved';
  status.textContent='All settings saved successfully.';
  clearTimeout(window.__cmjSaveTimer);
  window.__cmjSaveTimer=setTimeout(()=>{saveButton.classList.remove('saved');saveButton.textContent='Save Settings';status.textContent='';},3200);
};
document.getElementById('resetColors').onclick=()=>{colorFields.forEach(([key])=>{const el=document.getElementById(`color-${key}`);if(el)el.value=defaults.grammarColors[key]});};

document.getElementById('resetToolbar').onclick=async()=>{const current=await chrome.storage.local.get('settings');const next={...(current.settings||{}),toolbarPosition:{left:50,top:null,bottom:58}};await chrome.storage.local.set({settings:next});document.getElementById('status').textContent='Toolbar position reset.';setTimeout(()=>document.getElementById('status').textContent='',2200)};
