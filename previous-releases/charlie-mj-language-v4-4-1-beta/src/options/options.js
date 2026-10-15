/** Charlie MJ Language settings controller. Preferences remain local in Chrome storage. */
const defaults={successPopupPosition:'subtitle-center',transcriptServiceEngine:'legacy-youtube',captionTrackPreference:'original-first',enableCaptionLanguageDiscovery:true,liveTranscriptHighlightEnabled:true,liveTranscriptHighlightStyle:'soft-background',liveTranscriptHighlightColor:'#8B5CF6',liveTranscriptHighlightOpacity:25,liveTranscriptHighlightTextColor:'#FFFFFF',liveTranscriptInheritTextColor:true,liveTranscriptSyncMode:'active-subtitle',liveTranscriptAutoScroll:true,liveTranscriptScrollPosition:'center',liveTranscriptTransitionMs:150,liveTranscriptFollowWhilePaused:true,liveTranscriptRespectManualScroll:true,sourceLanguage:'tr',targetLanguage:'en',translationProvider:'youtube-first',translationProviderPriority:['youtube-captions','google','microsoft','mymemory','libretranslate'],enabledTranslationProviders:{google:false,microsoft:false,deepl:false,mymemory:false,libretranslate:false,argos:false},translationApiKeys:{google:'',microsoft:'',deepl:''},microsoftRegion:'',libreTranslateUrl:'',argosUrl:'',argosModels:[],onlineOnly:false,offlineOnly:false,onlineOfflineFallback:true,privacyMode:false,translationCache:true,verificationMode:false,translationTimeoutMs:5000,translationRetries:1,maxTranslationLength:2000,dictionaryEnabled:true,dictionaryEndpoint:'https://api.dictionaryapi.dev/api/v2/entries',dictionaryTimeoutMs:2500,dictionaryWiktionaryEnabled:true,dictionaryReferenceLinks:true,dictionaryDefinitions:true,dictionaryExamples:true,dictionaryPronunciation:true,dictionaryIdioms:true,dictionaryPhrasalVerbs:true,dictionarySlang:true,dictionaryPreferredEnglish:'US',dictionarySourcePriority:['wiktionary','wordnet','arabic-wordnet','farsnet','turkish'],focusMode:true,posColors:true,boldPOS:true,showLevels:true,autoTranslate:true,hideRecommendations:false,hideShorts:false,hideComments:false,showToolbarUnderVideo:true,downloadRoot:'Charlie MJ Language',downloadSaveAs:false,wordCardAutoCloseMs:6000,captionAutoFetch:true,captionFetchIntervalMs:180,captionSyncIntervalMs:80,captionSyncToleranceMs:350,toolbarRevealMode:'hover',toolbarHoverZonePx:140,toolbarDragAnywhere:true,toolbarSnap:'free',toolbarAutoHideEnabled:true,toolbarAutoHideDelayMs:15000,toolbarScale:1,toolbarWidth:1180,
toolbarDefaultX:50,toolbarDefaultY:2,toolbarHeight:45,toolbarHorizontalAnchor:'center',toolbarVerticalAnchor:'bottom',toolbarOffsetX:0,toolbarOffsetY:2,toolbarPositionMode:'default',toolbarOverflowMode:'auto',
subtitleDefaultX:50,subtitleDefaultY:11,subtitleWidth:760,subtitleWidthPercent:60,subtitleHorizontalAnchor:'center',subtitleVerticalAnchor:'bottom',subtitleOffsetX:0,subtitleOffsetY:11,subtitleMoveHideDelayMs:1800,subtitlePositionMode:'bottom',subtitleUIFontSize:28,subtitleMaxWidth:1100,subtitleMaxHeight:300,subtitleTextColor:'#ffffff',subtitleBackgroundColor:'#000000',subtitleOpacity:65,
transcriptDefaultX:98,transcriptDefaultY:12,transcriptUIWidth:300,transcriptUIHeight:545,transcriptHorizontalAnchor:'right',transcriptPositionMode:'default',transcriptVerticalAnchor:'top',transcriptOffsetX:2,transcriptOffsetY:12,transcriptControlHideDelayMs:15000,transcriptAutoHideEnabled:true,transcriptAutoHideDelayMs:15000,transcriptHoverZonePx:120,
subtitleDragEnabled:true,subtitlePosition:{leftPx:null,topPx:null,left:21.3,top:76.7,bottom:null},
transcriptWindowWidth:300,transcriptWindowHeight:545,transcriptWindowMinWidth:220,transcriptWindowMaxWidth:1000,
transcriptWindowMinHeight:220,transcriptWindowMaxHeight:900,transcriptWindowPosition:{leftPx:null,topPx:70,right:18,bottom:18},transcriptPinned:false,theme:'dark',subtitlePreloadTranslations:2,captionMaxRetries:20,subtitleDisplayMode:'both',originalFontSize:28,translationFontSize:22,originalLineSpacing:'1.0',translationLineSpacing:'1.0',originalBoxWidthMode:'auto',originalBoxWidthCustom:640,originalBoxHeightMode:'auto',originalBoxHeightCustom:180,originalMaxWidth:900,originalMaxHeight:180,originalMaxLines:2,originalCustomMaxLines:2,originalTextWrapping:true,originalBoxPadding:7,originalBackgroundOpacity:62,originalCornerRadius:9,translationBoxWidthMode:'auto',translationBoxWidthCustom:640,translationBoxHeightMode:'auto',translationBoxHeightCustom:180,translationMaxWidth:900,translationMaxHeight:180,translationMaxLines:2,translationCustomMaxLines:2,translationTextWrapping:true,translationBoxPadding:7,translationBackgroundOpacity:52,translationCornerRadius:9,originalBold:true,translationBold:false,originalUnderline:false,translationUnderline:false,originalItalic:false,translationItalic:false,originalColor:'#ffffff',translationColor:'#e2e8f0',sentenceShowLevel:true,replayCount:1,playbackSpeed:1,autoPauseAfterSubtitle:false,studyModeDefault:false,showWordPronunciation:true,showWordTransliteration:false,markKnownStopsHighlight:true,toolbarPosition:{left:4.7,top:91.8,bottom:null},toolbarActionOrder:['toggle','transcript','word','sentence','save','bookmark','capture','watch','focus','theme'],toolbarMoreActions:['translate','replay','loop','speed','ab','study','save-sentence','download-transcript','download-vocabulary','settings'],grammarColors:{noun:'#38bdf8',verb:'#fb7185',adjective:'#a78bfa',adverb:'#4ade80',pronoun:'#facc15',preposition:'#f472b6',conjunction:'#fb923c',determiner:'#818cf8',numeral:'#a3e635',particle:'#22d3ee',other:'#e2e8f0',turkishSuffix:'#c084fc',turkishCase:'#f59e0b',turkishPlural:'#34d399',turkishPossessive:'#60a5fa',turkishTense:'#f87171',turkishPerson:'#fb7185'}};
const colorFields=[
  ['noun','Noun'],['pronoun','Pronoun'],['verb','Verb'],['adjective','Adjective'],['adverb','Adverb'],['preposition','Preposition'],['conjunction','Conjunction'],['determiner','Determiner'],['numeral','Numeral'],['particle','Particle'],['other','Other'],
  ['turkishSuffix','Turkish Suffix'],['turkishCase','Turkish Case'],['turkishPlural','Turkish Plural'],['turkishPossessive','Turkish Possessive'],['turkishTense','Turkish Tense / Aspect'],['turkishPerson','Turkish Person']
];

const TOOLBAR_LABELS={toggle:'CMJ',transcript:'Transcript',word:'Word Learning',sentence:'Sentence Learning',save:'Save',bookmark:'Bookmark',capture:'Capture',watch:'Watch Later',focus:'Focus',theme:'Theme',translate:'Translate',replay:'Replay',loop:'Loop Sentence',speed:'Speed',ab:'A/B Replay',study:'Study Mode','save-sentence':'Save Sentence','download-transcript':'Download Transcript','download-vocabulary':'Download Vocabulary',settings:'Settings'};
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

const TRANSLATION_PRIORITY_OPTIONS=[
 ['youtube-captions','YouTube Captions — Native + Auto-Translation'],['google','Google Translation'],['microsoft','Microsoft Translator'],['deepl','DeepL'],['mymemory','MyMemory'],['libretranslate','LibreTranslate'],['argos','Argos Offline']
];
function renderTranslationPriority(value){
 const host=document.getElementById('translationPriorityList'); if(!host)return;
 let current=Array.isArray(value)?value.slice():[]; if(current.includes('youtube-native')||current.includes('youtube-auto')){ current=['youtube-captions',...current.filter(x=>x!=='youtube-native'&&x!=='youtube-auto')]; } if(!current.includes('youtube-captions')) current=['youtube-captions',...current]; host.innerHTML='';
 for(let i=0;i<6;i++){
   const label=document.createElement('label'); label.className='priority-row';
   const span=document.createElement('span'); span.textContent=`Priority ${i+1}`;
   const select=document.createElement('select'); select.id=`translationPriority${i+1}`;
   select.innerHTML='<option value="">— Not used —</option>'+TRANSLATION_PRIORITY_OPTIONS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
   select.value=current[i]||''; label.append(span,select); host.appendChild(label);
 }
}
function readTranslationPriority(){
 const out=[]; for(let i=1;i<=6;i++){let v=document.getElementById(`translationPriority${i}`)?.value||'';if(v==='youtube-native'||v==='youtube-auto')v='youtube-captions';if(v&&!out.includes(v))out.push(v)} if(!out.length) out.push('youtube-captions'); return out;
}

(async()=>{
  const {settings={}}=await chrome.storage.local.get('settings');
  const s={...defaults,...settings,grammarColors:{...defaults.grammarColors,...(settings.grammarColors||{})}};
  const normalizeLineSpacing=(value,fontSize,legacyDefault)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)return '1.0';if(n>4){if(n===legacyDefault)return '1.0';const ratio=n/Math.max(1,Number(fontSize)||22);const rounded=Math.round(ratio*10)/10;return String(Math.max(0.8,Math.min(3,rounded)).toFixed(1));}const presets=['1.0','1.2','1.5','1.8','2.0'];return presets.find(x=>Math.abs(Number(x)-n)<0.001)||String(Math.max(0.8,Math.min(3,n)).toFixed(1));};
  s.originalLineSpacing=normalizeLineSpacing(s.originalLineSpacing,s.originalFontSize,36);
  s.translationLineSpacing=normalizeLineSpacing(s.translationLineSpacing,s.translationFontSize,28);
  renderToolbarManager(s);
  const map={toolbarDefaultX:'toolbarDefaultX',toolbarDefaultY:'toolbarDefaultY',toolbarHorizontalAnchor:'toolbarHorizontalAnchor',toolbarVerticalAnchor:'toolbarVerticalAnchor',toolbarOffsetX:'toolbarOffsetX',toolbarOffsetY:'toolbarOffsetY',toolbarPositionMode:'toolbarPositionMode',showToolbarUnderVideo:'showToolbarUnderVideo',toolbarScaleUI:'toolbarScale',toolbarDragAnywhereUI:'toolbarDragAnywhere',toolbarSnapUI:'toolbarSnap',toolbarWidthUI:'toolbarWidth',toolbarHeight:'toolbarHeight',toolbarRevealModeUI:'toolbarRevealMode',toolbarAutoHideEnabledUI:'toolbarAutoHideEnabled',toolbarAutoHideDelayMsUI:'toolbarAutoHideDelayMs',toolbarHoverZonePxUI:'toolbarHoverZonePx',toolbarOverflowMode:'toolbarOverflowMode',subtitleDefaultX:'subtitleDefaultX',subtitleDefaultY:'subtitleDefaultY',subtitleHorizontalAnchor:'subtitleHorizontalAnchor',subtitleVerticalAnchor:'subtitleVerticalAnchor',subtitleOffsetX:'subtitleOffsetX',subtitleOffsetY:'subtitleOffsetY',subtitleWidth:'subtitleWidth',subtitleWidthPercent:'subtitleWidthPercent',subtitleMoveHideDelayMs:'subtitleMoveHideDelayMs',subtitlePositionMode:'subtitlePositionMode',subtitleMaxWidth:'subtitleMaxWidth',subtitleMaxHeight:'subtitleMaxHeight',subtitleTextColor:'subtitleTextColor',subtitleBackgroundColor:'subtitleBackgroundColor',subtitleOpacity:'subtitleOpacity',originalBoxWidthMode:'originalBoxWidthMode',originalBoxWidthCustom:'originalBoxWidthCustom',originalBoxHeightMode:'originalBoxHeightMode',originalBoxHeightCustom:'originalBoxHeightCustom',originalMaxWidth:'originalMaxWidth',originalMaxHeight:'originalMaxHeight',originalMaxLines:'originalMaxLines',originalCustomMaxLines:'originalCustomMaxLines',originalTextWrapping:'originalTextWrapping',originalBoxPadding:'originalBoxPadding',originalBackgroundOpacity:'originalBackgroundOpacity',originalCornerRadius:'originalCornerRadius',translationBoxWidthMode:'translationBoxWidthMode',translationBoxWidthCustom:'translationBoxWidthCustom',translationBoxHeightMode:'translationBoxHeightMode',translationBoxHeightCustom:'translationBoxHeightCustom',translationMaxWidth:'translationMaxWidth',translationMaxHeight:'translationMaxHeight',translationMaxLines:'translationMaxLines',translationCustomMaxLines:'translationCustomMaxLines',translationTextWrapping:'translationTextWrapping',translationBoxPadding:'translationBoxPadding',translationBackgroundOpacity:'translationBackgroundOpacity',translationCornerRadius:'translationCornerRadius',transcriptDefaultX:'transcriptDefaultX',transcriptDefaultY:'transcriptDefaultY',transcriptHorizontalAnchor:'transcriptHorizontalAnchor',transcriptVerticalAnchor:'transcriptVerticalAnchor',transcriptOffsetX:'transcriptOffsetX',transcriptOffsetY:'transcriptOffsetY',transcriptPositionMode:'transcriptPositionMode',transcriptUIWidth:'transcriptUIWidth',transcriptUIHeight:'transcriptUIHeight',transcriptWindowMinWidthUI:'transcriptWindowMinWidth',transcriptWindowMaxWidthUI:'transcriptWindowMaxWidth',transcriptWindowMinHeightUI:'transcriptWindowMinHeight',transcriptWindowMaxHeightUI:'transcriptWindowMaxHeight',transcriptUIPinned:'transcriptPinned',transcriptAutoHideEnabledUI:'transcriptAutoHideEnabled',transcriptControlHideDelayMs:'transcriptAutoHideDelayMs',successPopupPosition:'successPopupPosition',liveTranscriptHighlightEnabled:'liveTranscriptHighlightEnabled',liveTranscriptHighlightStyle:'liveTranscriptHighlightStyle',liveTranscriptHighlightColor:'liveTranscriptHighlightColor',liveTranscriptHighlightOpacity:'liveTranscriptHighlightOpacity',liveTranscriptHighlightTextColor:'liveTranscriptHighlightTextColor',liveTranscriptInheritTextColor:'liveTranscriptInheritTextColor',liveTranscriptSyncMode:'liveTranscriptSyncMode',liveTranscriptAutoScroll:'liveTranscriptAutoScroll',liveTranscriptScrollPosition:'liveTranscriptScrollPosition',liveTranscriptTransitionMs:'liveTranscriptTransitionMs',liveTranscriptFollowWhilePaused:'liveTranscriptFollowWhilePaused',liveTranscriptRespectManualScroll:'liveTranscriptRespectManualScroll',transcriptServiceEngine:'transcriptServiceEngine',captionTrackPreference:'captionTrackPreference',enableCaptionLanguageDiscovery:'enableCaptionLanguageDiscovery',source:'sourceLanguage',target:'targetLanguage',provider:'translationProvider',libreUrl:'libreTranslateUrl',microsoftRegion:'microsoftRegion',argosUrl:'argosUrl',onlineOnly:'onlineOnly',offlineOnly:'offlineOnly',onlineOfflineFallback:'onlineOfflineFallback',privacyMode:'privacyMode',translationCache:'translationCache',verificationMode:'verificationMode',translationTimeoutMs:'translationTimeoutMs',translationRetries:'translationRetries',maxTranslationLength:'maxTranslationLength',dictionaryEnabled:'dictionaryEnabled',dictionaryEndpoint:'dictionaryEndpoint',dictionaryTimeoutMs:'dictionaryTimeoutMs',dictionaryWiktionaryEnabled:'dictionaryWiktionaryEnabled',dictionaryReferenceLinks:'dictionaryReferenceLinks',dictionaryDefinitions:'dictionaryDefinitions',dictionaryExamples:'dictionaryExamples',dictionaryPronunciation:'dictionaryPronunciation',dictionaryIdioms:'dictionaryIdioms',dictionaryPhrasalVerbs:'dictionaryPhrasalVerbs',dictionarySlang:'dictionarySlang',dictionaryPreferredEnglish:'dictionaryPreferredEnglish',dictionarySourcePriority:'dictionarySourcePriority',focusMode:'focusMode',posColors:'posColors',boldPOS:'boldPOS',showLevels:'showLevels',autoTranslate:'autoTranslate',hideRecommendations:'hideRecommendations',hideShorts:'hideShorts',hideComments:'hideComments',showToolbarUnderVideo:'showToolbarUnderVideo',downloadRoot:'downloadRoot',downloadSaveAs:'downloadSaveAs',wordCardAutoCloseMs:'wordCardAutoCloseMs',captionAutoFetch:'captionAutoFetch',captionFetchIntervalMs:'captionFetchIntervalMs',captionSyncIntervalMs:'captionSyncIntervalMs',captionSyncToleranceMs:'captionSyncToleranceMs',toolbarRevealMode:'toolbarRevealMode',toolbarHoverZonePx:'toolbarHoverZonePx',toolbarDragAnywhere:'toolbarDragAnywhere',toolbarSnap:'toolbarSnap',toolbarAutoHideDelayMs:'toolbarAutoHideDelayMs',toolbarScale:'toolbarScale',toolbarWidth:'toolbarWidth',
    subtitleDragEnabled:'subtitleDragEnabled',transcriptWindowWidth:'transcriptWindowWidth',transcriptWindowHeight:'transcriptWindowHeight',
    transcriptWindowMinWidth:'transcriptWindowMinWidth',transcriptWindowMaxWidth:'transcriptWindowMaxWidth',
    transcriptWindowMinHeight:'transcriptWindowMinHeight',transcriptWindowMaxHeight:'transcriptWindowMaxHeight',
    transcriptPinned:'transcriptPinned',theme:'theme',subtitlePreloadTranslations:'subtitlePreloadTranslations',captionMaxRetries:'captionMaxRetries',subtitleDisplayMode:'subtitleDisplayMode',originalFontSize:'originalFontSize',translationFontSize:'translationFontSize',originalLineSpacing:'originalLineSpacing',translationLineSpacing:'translationLineSpacing',originalBold:'originalBold',translationBold:'translationBold',originalUnderline:'originalUnderline',translationUnderline:'translationUnderline',originalItalic:'originalItalic',translationItalic:'translationItalic',sentenceShowLevel:'sentenceShowLevel',replayCount:'replayCount',playbackSpeed:'playbackSpeed',autoPauseAfterSubtitle:'autoPauseAfterSubtitle',studyModeDefault:'studyModeDefault',showWordPronunciation:'showWordPronunciation',showWordTransliteration:'showWordTransliteration',markKnownStopsHighlight:'markKnownStopsHighlight',subtitleGrammarColorsEnabled:'subtitleGrammarColorsEnabled',transcriptGrammarColorsEnabled:'transcriptGrammarColorsEnabled'};
  for(const [id,key] of Object.entries(map)){const el=document.getElementById(id);if(!el)continue;if(el.type==='checkbox') el.checked=Boolean(s[key]); else el.value=String(s[key] ?? '')}
  for(const kind of ['original','translation']){
    const select=document.getElementById(`${kind}LineSpacing`),custom=document.getElementById(`${kind}LineSpacingCustom`),value=String(s[`${kind}LineSpacing`]||'1.0');
    if(select&&custom){const presets=['1.0','1.2','1.5','1.8','2.0'];select.value=presets.includes(value)?value:'custom';custom.value=value;custom.classList.toggle('is-condition-hidden',select.value!=='custom');}
  }
renderTranslationPriority(s.translationProviderPriority||defaults.translationProviderPriority);
  if(document.getElementById('dictionarySourcePriority'))document.getElementById('dictionarySourcePriority').value=(s.dictionarySourcePriority||defaults.dictionarySourcePriority).join(',');
  const keyValues=s.translationApiKeys||{};
  if(document.getElementById('googleKey'))document.getElementById('googleKey').value=keyValues.google||'';
  if(document.getElementById('microsoftKey'))document.getElementById('microsoftKey').value=keyValues.microsoft||'';
  if(document.getElementById('deeplKey'))document.getElementById('deeplKey').value=keyValues.deepl||'';
  const enabled=s.enabledTranslationProviders||{}; ['google','microsoft','deepl','mymemory','libretranslate','argos'].forEach(k=>{const el=document.getElementById(`enable-${k}`);if(el)el.checked=Boolean(enabled[k]);});
  colorFields.forEach(([key])=>{const el=document.getElementById(`color-${key}`);if(el)el.value=s.grammarColors[key]||defaults.grammarColors[key]});
  buildSettingsNavigation();
  document.dispatchEvent(new Event('cmj-settings-loaded'));
  updateLiveHighlightPreview();
  for(const kind of ['original','translation'])updateBoxPreview(kind);
})();

function buildSettingsNavigation(){
  const nav=document.getElementById('settingsNav');
  if(!nav)return;
  const categoryMap={
    'Language':'General',
    'Screen theme':'Appearance',
    'UI Components':'UI Components',
    'Subtitle & timeline engine':'Subtitles & Timeline',
    'Subtitle display & learning modes':'Appearance',
    'Original subtitle typography':'Appearance',
    'Translation subtitle typography':'Appearance',
    'Video learning controls':'Learning',
    'Word learning':'Learning',
    'Grammar & Turkish morphology colors':'Language Intelligence',
    'Translation provider':'Translation',
    'Translation routing & privacy':'Translation',
    'Dictionary':'Dictionary',
    'Downloads':'Downloads',
    'Focus controls':'Focus'
  };
  const categoryMeta={
    'General':['🌍','Language and core preferences'],
    'Appearance':['☼','Theme and visual appearance'],
    'Toolbar':['☰','Toolbar placement and actions'],
    'UI Components':['◈','Exact position, size and lightweight component behavior'],
    'Subtitles & Timeline':['💬','Subtitle position, transcript window and caption display'],
    'Learning':['🧠','Replay, Study Mode and word learning'],
    'Language Intelligence':['🔤','POS, CEFR and morphology colors'],
    'Translation':['🌐','Translation provider configuration'],
    'Dictionary':['📖','Dictionary data, fields and reference sources'],
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


// Live preview and per-box reset; settings stay local until Save is pressed.
const BOX_DEFAULTS={original:{originalBoxWidthMode:'auto',originalBoxWidthCustom:640,originalBoxHeightMode:'auto',originalBoxHeightCustom:180,originalMaxWidth:900,originalMaxHeight:180,originalMaxLines:'2',originalCustomMaxLines:2,originalTextWrapping:true,originalBoxPadding:7,originalBackgroundOpacity:62,originalCornerRadius:9},translation:{translationBoxWidthMode:'auto',translationBoxWidthCustom:640,translationBoxHeightMode:'auto',translationBoxHeightCustom:180,translationMaxWidth:900,translationMaxHeight:180,translationMaxLines:'2',translationCustomMaxLines:2,translationTextWrapping:true,translationBoxPadding:7,translationBackgroundOpacity:52,translationCornerRadius:9}};
function updateBoxPreview(kind){const p=document.getElementById(`${kind}BoxPreview`);if(!p)return;const get=id=>document.getElementById(`${kind}${id}`);const widthMode=get('BoxWidthMode').value,heightMode=get('BoxHeightMode').value;const width=widthMode==='custom'?Number(get('BoxWidthCustom').value)||640:({small:280,medium:480,large:720}[widthMode]||'auto');const height=heightMode==='custom'?Number(get('BoxHeightCustom').value)||180:({small:60,medium:100,large:160}[heightMode]||'auto');const maxLines=get('MaxLines').value==='unlimited'?0:get('MaxLines').value==='custom'?Number(get('CustomMaxLines').value)||2:Number(get('MaxLines').value)||2;p.style.width=width==='auto'?'auto':`${width}px`;p.style.maxWidth=`min(${Number(get('MaxWidth').value)||900}px,100%)`;p.style.height=height==='auto'?'auto':`${height}px`;p.style.maxHeight=`${Number(get('MaxHeight').value)||180}px`;p.style.padding=`${Number(get('BoxPadding').value)||0}px`;p.style.background=`rgba(0,0,0,${Math.max(0,Math.min(100,Number(get('BackgroundOpacity').value)||0))/100})`;p.style.borderRadius=`${Number(get('CornerRadius').value)||0}px`;p.style.whiteSpace=get('TextWrapping').checked?'normal':'nowrap';p.style.overflowWrap=get('TextWrapping').checked?'anywhere':'normal';p.style.display='block';p.style.webkitLineClamp=maxLines?String(maxLines):'unset';p.style.webkitBoxOrient=maxLines?'vertical':'unset';p.style.overflow='hidden';p.style.display=maxLines?'-webkit-box':'block';}
for(const kind of ['original','translation']){document.querySelectorAll(`[id^="${kind}Box"],[id^="${kind}Max"],[id^="${kind}CustomMax"],[id^="${kind}TextWrapping"],[id^="${kind}BackgroundOpacity"],[id^="${kind}CornerRadius"]`).forEach(el=>{el.addEventListener('input',()=>updateBoxPreview(kind));el.addEventListener('change',()=>updateBoxPreview(kind));});document.getElementById(`reset${kind[0].toUpperCase()+kind.slice(1)}BoxSettings`)?.addEventListener('click',()=>{Object.entries(BOX_DEFAULTS[kind]).forEach(([key,value])=>{const el=document.getElementById(key);if(!el)return;if(el.type==='checkbox')el.checked=value;else el.value=String(value);});updateBoxPreview(kind);});}

for(const kind of ['original','translation'])updateBoxPreview(kind);

document.getElementById('save').onclick=async()=>{
  const grammarColors={};
  colorFields.forEach(([key])=>{grammarColors[key]=document.getElementById(`color-${key}`)?.value||defaults.grammarColors[key]});
  const existing=(await chrome.storage.local.get('settings')).settings||{};
  const settings={...defaults,...existing,
    sourceLanguage:document.getElementById('source').value,
    targetLanguage:document.getElementById('target').value,
    translationProvider:document.getElementById('provider').value,
    translationProviderPriority:readTranslationPriority(),
    enabledTranslationProviders:Object.fromEntries(['google','microsoft','deepl','mymemory','libretranslate','argos'].map(k=>[k,Boolean(document.getElementById(`enable-${k}`)?.checked)])),
    libreTranslateUrl:document.getElementById('libreUrl').value.trim(),
    microsoftRegion:document.getElementById('microsoftRegion')?.value.trim()||'',
    argosUrl:document.getElementById('argosUrl')?.value.trim()||'',
    onlineOnly:document.getElementById('onlineOnly')?.checked||false,
    offlineOnly:document.getElementById('offlineOnly')?.checked||false,
    onlineOfflineFallback:document.getElementById('onlineOfflineFallback')?.checked!==false,
    privacyMode:document.getElementById('privacyMode')?.checked||false,
    translationCache:document.getElementById('translationCache')?.checked!==false,
    verificationMode:document.getElementById('verificationMode')?.checked||false,
    translationTimeoutMs:Math.max(1000,Math.min(30000,Number(document.getElementById('translationTimeoutMs')?.value)||5000)),
    translationRetries:Math.max(0,Math.min(3,Number(document.getElementById('translationRetries')?.value)||1)),
    maxTranslationLength:Math.max(100,Math.min(10000,Number(document.getElementById('maxTranslationLength')?.value)||2000)),
    dictionaryEnabled:document.getElementById('dictionaryEnabled')?.checked!==false,
    dictionaryEndpoint:document.getElementById('dictionaryEndpoint')?.value.trim()||'https://api.dictionaryapi.dev/api/v2/entries',
    dictionaryTimeoutMs:Math.max(1500,Math.min(5000,Number(document.getElementById('dictionaryTimeoutMs')?.value)||2500)),
    dictionaryWiktionaryEnabled:document.getElementById('dictionaryWiktionaryEnabled')?.checked!==false,
    dictionaryReferenceLinks:document.getElementById('dictionaryReferenceLinks')?.checked!==false,
    dictionaryDefinitions:document.getElementById('dictionaryDefinitions')?.checked!==false,
    dictionaryExamples:document.getElementById('dictionaryExamples')?.checked!==false,
    dictionaryPronunciation:document.getElementById('dictionaryPronunciation')?.checked!==false,
    dictionaryIdioms:document.getElementById('dictionaryIdioms')?.checked!==false,
    dictionaryPhrasalVerbs:document.getElementById('dictionaryPhrasalVerbs')?.checked!==false,
    dictionarySlang:document.getElementById('dictionarySlang')?.checked!==false,
    dictionaryPreferredEnglish:document.getElementById('dictionaryPreferredEnglish')?.value||'US',
    dictionarySourcePriority:String(document.getElementById('dictionarySourcePriority')?.value||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),
    translationApiKeys:{
      google:document.getElementById('googleKey')?.value||existing.translationApiKeys?.google||'',
      microsoft:document.getElementById('microsoftKey')?.value||existing.translationApiKeys?.microsoft||'',
      deepl:document.getElementById('deeplKey')?.value||existing.translationApiKeys?.deepl||''
    },
    focusMode:document.getElementById('focusMode').checked,
    posColors:document.getElementById('posColors').checked,
    boldPOS:document.getElementById('boldPOS').checked,
    showLevels:document.getElementById('showLevels').checked,
    autoTranslate:document.getElementById('autoTranslate').checked,
    hideRecommendations:document.getElementById('hideRecommendations').checked,
    hideShorts:document.getElementById('hideShorts').checked,
    hideComments:document.getElementById('hideComments').checked,
    showToolbarUnderVideo:document.getElementById('showToolbarUnderVideo')?.checked!==false,
    downloadRoot:document.getElementById('downloadRoot').value.trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/^\.+/,'').replace(/\s+/g,' ').replace(/^\/+|\/+$/g,'')||'Charlie MJ Language',
    downloadSaveAs:document.getElementById('downloadSaveAs').checked,
    wordCardAutoCloseMs:Math.max(1500,Math.min(20000,Number(document.getElementById('wordCardAutoCloseMs').value)||6000)),
    captionAutoFetch:document.getElementById('captionAutoFetch').checked,
    captionFetchIntervalMs:Math.max(80,Math.min(1000,Number(document.getElementById('captionFetchIntervalMs').value)||180)),
    captionSyncIntervalMs:Math.max(40,Math.min(500,Number(document.getElementById('captionSyncIntervalMs').value)||80)),
    captionSyncToleranceMs:Math.max(0,Math.min(1500,Number(document.getElementById('captionSyncToleranceMs').value)||350)),
    toolbarRevealMode:document.getElementById('toolbarRevealMode')?.value||'hover',
    toolbarHoverZonePx:Math.max(40,Math.min(500,Number(document.getElementById('toolbarHoverZonePx')?.value)||140)),
    toolbarDragAnywhere:document.getElementById('toolbarDragAnywhere')?.checked!==false,
    toolbarSnap:document.getElementById('toolbarSnap')?.value||'free',
    toolbarAutoHideDelayMs:Math.max(500,Math.min(30000,Number(document.getElementById('toolbarAutoHideDelayMs')?.value)||15000)),
    toolbarScale:Math.max(0.7,Math.min(1.4,Number(document.getElementById('toolbarScale')?.value)||1)),
    toolbarWidth:Math.max(300,Math.min(1600,Number(document.getElementById('toolbarWidth')?.value)||1180)),
    toolbarDefaultX:Math.max(0,Math.min(100,Number(document.getElementById('toolbarDefaultX')?.value)||50)),
    toolbarDefaultY:Math.max(0,Math.min(100,Number(document.getElementById('toolbarDefaultY')?.value)||2)),
    toolbarHeight:Math.max(30,Math.min(120,Number(document.getElementById('toolbarHeight')?.value)||45)),
    toolbarOverflowMode:document.getElementById('toolbarOverflowMode')?.value||'auto',
    subtitleDefaultX:Math.max(0,Math.min(100,Number(document.getElementById('subtitleDefaultX')?.value)||21.3)),
    subtitleDefaultY:Math.max(0,Math.min(100,Number(document.getElementById('subtitleDefaultY')?.value)||76.7)),
    subtitleWidth:Math.max(280,Math.min(1400,Number(document.getElementById('subtitleWidth')?.value)||760)),
    subtitleWidthPercent:Math.max(20,Math.min(100,Number(document.getElementById('subtitleWidthPercent')?.value)||60)),
    subtitleMoveHideDelayMs:Math.max(0,Math.min(10000,Number(document.getElementById('subtitleMoveHideDelayMs')?.value)||1800)),
    subtitlePositionMode:document.getElementById('subtitlePositionMode')?.value||'bottom',
    subtitleMaxWidth:Math.max(200,Math.min(1800,Number(document.getElementById('subtitleMaxWidth')?.value)||1100)),
    subtitleMaxHeight:Math.max(40,Math.min(900,Number(document.getElementById('subtitleMaxHeight')?.value)||300)),
    subtitleTextColor:document.getElementById('subtitleTextColor')?.value||'#ffffff',
    subtitleBackgroundColor:document.getElementById('subtitleBackgroundColor')?.value||'#000000',
    subtitleOpacity:Math.max(0,Math.min(100,Number(document.getElementById('subtitleOpacity')?.value)||65)),
    transcriptDefaultX:Math.max(0,Math.min(100,Number(document.getElementById('transcriptDefaultX')?.value)||98)),
    transcriptDefaultY:Math.max(0,Math.min(100,Number(document.getElementById('transcriptDefaultY')?.value)||12)),
    transcriptUIWidth:Math.max(220,Math.min(1400,Number(document.getElementById('transcriptUIWidth')?.value)||275)),
    transcriptUIHeight:Math.max(220,Math.min(1200,Number(document.getElementById('transcriptUIHeight')?.value)||545)),
    transcriptAutoHideEnabled:document.getElementById('transcriptAutoHideEnabledUI')?.checked!==false, transcriptControlHideDelayMs:Math.max(5000,Math.min(30000,Number(document.getElementById('transcriptControlHideDelayMs')?.value)||15000)), transcriptAutoHideDelayMs:Math.max(5000,Math.min(30000,Number(document.getElementById('transcriptControlHideDelayMs')?.value)||15000)),
    subtitleDragEnabled:document.getElementById('subtitleDragEnabled')?.checked!==false,
    transcriptWindowWidth:Math.max(220,Math.min(1000,Number(document.getElementById('transcriptWindowWidth')?.value)||300)),
    transcriptWindowHeight:Math.max(280,Math.min(900,Number(document.getElementById('transcriptWindowHeight')?.value)||545)),
    transcriptWindowMinWidth:Math.max(220,Math.min(700,Number(document.getElementById('transcriptWindowMinWidth')?.value)||220)),
    transcriptWindowMaxWidth:Math.max(320,Math.min(1400,Number(document.getElementById('transcriptWindowMaxWidth')?.value)||1000)),
    transcriptWindowMinHeight:Math.max(220,Math.min(700,Number(document.getElementById('transcriptWindowMinHeight')?.value)||220)),
    transcriptWindowMaxHeight:Math.max(280,Math.min(1200,Number(document.getElementById('transcriptWindowMaxHeight')?.value)||900)),
    transcriptPinned:document.getElementById('transcriptPinned')?.checked||false,
    theme:document.getElementById('theme').value,
    subtitlePreloadTranslations:Math.max(0,Math.min(5,Number(document.getElementById('subtitlePreloadTranslations').value)||2)),
    captionMaxRetries:Math.max(1,Math.min(30,Number(document.getElementById('captionMaxRetries').value)||20)),
    subtitleDisplayMode:document.getElementById('subtitleDisplayMode').value,
    originalFontSize:Math.max(10,Math.min(72,Number(document.getElementById('originalFontSize').value)||28)),
    translationFontSize:Math.max(10,Math.min(72,Number(document.getElementById('translationFontSize').value)||22)),
    originalLineSpacing:(()=>{const el=document.getElementById('originalLineSpacing'),custom=document.getElementById('originalLineSpacingCustom');return Math.max(0.8,Math.min(3,Number(el?.value==='custom'?custom?.value:el?.value)||1));})(),
    translationLineSpacing:(()=>{const el=document.getElementById('translationLineSpacing'),custom=document.getElementById('translationLineSpacingCustom');return Math.max(0.8,Math.min(3,Number(el?.value==='custom'?custom?.value:el?.value)||1));})(),
    originalBold:document.getElementById('originalBold').value==='true',
    translationBold:document.getElementById('translationBold').value==='true',
    originalUnderline:document.getElementById('originalUnderline').checked,
    translationUnderline:document.getElementById('translationUnderline').checked,
    originalItalic:document.getElementById('originalItalic').checked,
    translationItalic:document.getElementById('translationItalic').checked,
    originalColor:document.getElementById('originalColor')?.value||'#ffffff',
    translationColor:document.getElementById('translationColor')?.value||'#e2e8f0',
    sentenceShowLevel:document.getElementById('sentenceShowLevel').checked,
    replayCount:Math.max(1,Math.min(5,Number(document.getElementById('replayCount').value)||1)),
    playbackSpeed:Number(document.getElementById('playbackSpeed').value)||1,
    autoPauseAfterSubtitle:document.getElementById('autoPauseAfterSubtitle').checked,
    studyModeDefault:document.getElementById('studyModeDefault').checked,
    showWordPronunciation:document.getElementById('showWordPronunciation').checked,
    showWordTransliteration:document.getElementById('showWordTransliteration').checked,
    markKnownStopsHighlight:document.getElementById('markKnownStopsHighlight').checked,
    // UI Components tab is authoritative for component geometry/behavior.
    toolbarHorizontalAnchor:document.getElementById('toolbarHorizontalAnchor')?.value||'center',
    toolbarPositionMode:document.getElementById('toolbarPositionMode')?.value||'default',
    toolbarVerticalAnchor:document.getElementById('toolbarVerticalAnchor')?.value||'bottom',
    toolbarOffsetX:Math.max(0,Math.min(50,Number(document.getElementById('toolbarOffsetX')?.value)||0)),
    toolbarOffsetY:Math.max(0,Math.min(50,Number(document.getElementById('toolbarOffsetY')?.value)||2)),
    toolbarDefaultX:50, toolbarDefaultY:2,
    showToolbarUnderVideo:document.getElementById('showToolbarUnderVideo')?.checked!==false,
    toolbarScale:Math.max(0.7,Math.min(1.4,Number(document.getElementById('toolbarScaleUI')?.value)||1)),
    toolbarDragAnywhere:document.getElementById('toolbarDragAnywhereUI')?.checked!==false,
    toolbarSnap:document.getElementById('toolbarSnapUI')?.value||'free',
    toolbarWidth:Math.max(300,Math.min(1600,Number(document.getElementById('toolbarWidthUI')?.value)||905)),
    toolbarHeight:Math.max(30,Math.min(120,Number(document.getElementById('toolbarHeight')?.value)||45)),
    toolbarRevealMode:document.getElementById('toolbarRevealModeUI')?.value||'hover',
    toolbarAutoHideEnabled:document.getElementById('toolbarAutoHideEnabledUI')?.checked!==false, toolbarAutoHideDelayMs:Math.max(5000,Math.min(30000,Number(document.getElementById('toolbarAutoHideDelayMsUI')?.value)||15000)),
    toolbarHoverZonePx:Math.max(40,Math.min(500,Number(document.getElementById('toolbarHoverZonePxUI')?.value)||140)),
    toolbarOverflowMode:document.getElementById('toolbarOverflowMode')?.value||'auto',
    subtitleHorizontalAnchor:document.getElementById('subtitleHorizontalAnchor')?.value||'center',
    subtitleVerticalAnchor:document.getElementById('subtitleVerticalAnchor')?.value||'bottom',
    subtitleOffsetX:Math.max(0,Math.min(50,Number(document.getElementById('subtitleOffsetX')?.value)||0)),
    subtitleOffsetY:Math.max(0,Math.min(50,Number(document.getElementById('subtitleOffsetY')?.value)||11)),
    subtitleDefaultX:50, subtitleDefaultY:11,
    subtitleWidth:Math.max(280,Math.min(1400,Number(document.getElementById('subtitleWidth')?.value)||760)),
    subtitleWidthPercent:Math.max(20,Math.min(100,Number(document.getElementById('subtitleWidthPercent')?.value)||60)),
    subtitleMoveHideDelayMs:Math.max(0,Math.min(10000,Number(document.getElementById('subtitleMoveHideDelayMs')?.value)||1800)),
    subtitlePositionMode:document.getElementById('subtitlePositionMode')?.value||'bottom',
    subtitleMaxWidth:Math.max(200,Math.min(1800,Number(document.getElementById('subtitleMaxWidth')?.value)||1100)),
    subtitleMaxHeight:Math.max(40,Math.min(900,Number(document.getElementById('subtitleMaxHeight')?.value)||300)),
    subtitleTextColor:document.getElementById('subtitleTextColor')?.value||'#ffffff',
    subtitleBackgroundColor:document.getElementById('subtitleBackgroundColor')?.value||'#000000',
    subtitleOpacity:Math.max(0,Math.min(100,Number(document.getElementById('subtitleOpacity')?.value)||65)),
    originalBoxWidthMode:document.getElementById('originalBoxWidthMode')?.value||'auto',originalBoxWidthCustom:Math.max(80,Math.min(1800,Number(document.getElementById('originalBoxWidthCustom')?.value)||640)),originalBoxHeightMode:document.getElementById('originalBoxHeightMode')?.value||'auto',originalBoxHeightCustom:Math.max(30,Math.min(900,Number(document.getElementById('originalBoxHeightCustom')?.value)||180)),originalMaxWidth:Math.max(80,Math.min(1800,Number(document.getElementById('originalMaxWidth')?.value)||900)),originalMaxHeight:Math.max(30,Math.min(900,Number(document.getElementById('originalMaxHeight')?.value)||180)),originalMaxLines:document.getElementById('originalMaxLines')?.value||'2',originalCustomMaxLines:Math.max(1,Math.min(30,Number(document.getElementById('originalCustomMaxLines')?.value)||2)),originalTextWrapping:document.getElementById('originalTextWrapping')?.checked!==false,originalBoxPadding:Math.max(0,Math.min(60,Number(document.getElementById('originalBoxPadding')?.value ?? 7))),originalBackgroundOpacity:Math.max(0,Math.min(100,Number(document.getElementById('originalBackgroundOpacity')?.value ?? 62))),originalCornerRadius:Math.max(0,Math.min(60,Number(document.getElementById('originalCornerRadius')?.value ?? 9))),
    translationBoxWidthMode:document.getElementById('translationBoxWidthMode')?.value||'auto',translationBoxWidthCustom:Math.max(80,Math.min(1800,Number(document.getElementById('translationBoxWidthCustom')?.value)||640)),translationBoxHeightMode:document.getElementById('translationBoxHeightMode')?.value||'auto',translationBoxHeightCustom:Math.max(30,Math.min(900,Number(document.getElementById('translationBoxHeightCustom')?.value)||180)),translationMaxWidth:Math.max(80,Math.min(1800,Number(document.getElementById('translationMaxWidth')?.value)||900)),translationMaxHeight:Math.max(30,Math.min(900,Number(document.getElementById('translationMaxHeight')?.value)||180)),translationMaxLines:document.getElementById('translationMaxLines')?.value||'2',translationCustomMaxLines:Math.max(1,Math.min(30,Number(document.getElementById('translationCustomMaxLines')?.value)||2)),translationTextWrapping:document.getElementById('translationTextWrapping')?.checked!==false,translationBoxPadding:Math.max(0,Math.min(60,Number(document.getElementById('translationBoxPadding')?.value ?? 7))),translationBackgroundOpacity:Math.max(0,Math.min(100,Number(document.getElementById('translationBackgroundOpacity')?.value ?? 52))),translationCornerRadius:Math.max(0,Math.min(60,Number(document.getElementById('translationCornerRadius')?.value ?? 9))),
    transcriptHorizontalAnchor:document.getElementById('transcriptHorizontalAnchor')?.value||'right',
    transcriptPositionMode:document.getElementById('transcriptPositionMode')?.value||'default',
    transcriptVerticalAnchor:document.getElementById('transcriptVerticalAnchor')?.value||'top',
    transcriptOffsetX:Math.max(0,Math.min(50,Number(document.getElementById('transcriptOffsetX')?.value)||2)),
    transcriptOffsetY:Math.max(0,Math.min(50,Number(document.getElementById('transcriptOffsetY')?.value)||12)),
    transcriptDefaultX:98, transcriptDefaultY:12,
    transcriptUIWidth:Math.max(220,Math.min(1400,Number(document.getElementById('transcriptUIWidth')?.value)||300)),
    transcriptUIHeight:Math.max(220,Math.min(1200,Number(document.getElementById('transcriptUIHeight')?.value)||545)),
    transcriptWindowWidth:Math.max(220,Math.min(1000,Number(document.getElementById('transcriptUIWidth')?.value)||300)),
    transcriptWindowHeight:Math.max(220,Math.min(900,Number(document.getElementById('transcriptUIHeight')?.value)||545)),
    transcriptWindowMinWidth:Math.max(220,Math.min(700,Number(document.getElementById('transcriptWindowMinWidthUI')?.value)||220)),
    transcriptWindowMaxWidth:Math.max(320,Math.min(1400,Number(document.getElementById('transcriptWindowMaxWidthUI')?.value)||1000)),
    transcriptWindowMinHeight:Math.max(220,Math.min(700,Number(document.getElementById('transcriptWindowMinHeightUI')?.value)||220)),
    transcriptWindowMaxHeight:Math.max(280,Math.min(1200,Number(document.getElementById('transcriptWindowMaxHeightUI')?.value)||900)),
    transcriptAutoHideEnabled:document.getElementById('transcriptAutoHideEnabledUI')?.checked!==false, transcriptControlHideDelayMs:Math.max(5000,Math.min(30000,Number(document.getElementById('transcriptControlHideDelayMs')?.value)||15000)), transcriptAutoHideDelayMs:Math.max(5000,Math.min(30000,Number(document.getElementById('transcriptControlHideDelayMs')?.value)||15000)),
    transcriptPinned:document.getElementById('transcriptUIPinned')?.checked||false,
    successPopupPosition:document.getElementById('successPopupPosition')?.value||'subtitle-center',
    liveTranscriptHighlightEnabled:document.getElementById('liveTranscriptHighlightEnabled')?.checked!==false,liveTranscriptHighlightStyle:document.getElementById('liveTranscriptHighlightStyle')?.value||'soft-background',liveTranscriptHighlightColor:document.getElementById('liveTranscriptHighlightColor')?.value||'#8B5CF6',liveTranscriptHighlightOpacity:Math.max(0,Math.min(100,Number(document.getElementById('liveTranscriptHighlightOpacity')?.value ?? 25))),liveTranscriptHighlightTextColor:document.getElementById('liveTranscriptHighlightTextColor')?.value||'#FFFFFF',liveTranscriptInheritTextColor:document.getElementById('liveTranscriptInheritTextColor')?.checked!==false,liveTranscriptSyncMode:document.getElementById('liveTranscriptSyncMode')?.value||'active-subtitle',liveTranscriptAutoScroll:document.getElementById('liveTranscriptAutoScroll')?.checked!==false,liveTranscriptScrollPosition:document.getElementById('liveTranscriptScrollPosition')?.value||'center',liveTranscriptTransitionMs:Math.max(0,Math.min(500,Number(document.getElementById('liveTranscriptTransitionMs')?.value ?? 150))),liveTranscriptFollowWhilePaused:document.getElementById('liveTranscriptFollowWhilePaused')?.checked!==false,liveTranscriptRespectManualScroll:document.getElementById('liveTranscriptRespectManualScroll')?.checked!==false,
    transcriptServiceEngine:document.getElementById('transcriptServiceEngine')?.value||'legacy-youtube',
    captionTrackPreference:document.getElementById('captionTrackPreference')?.value||'original-first',
    enableCaptionLanguageDiscovery:document.getElementById('enableCaptionLanguageDiscovery')?.checked!==false,
    subtitleGrammarColorsEnabled:document.getElementById('subtitleGrammarColorsEnabled')?.checked!==false,
    transcriptGrammarColorsEnabled:document.getElementById('transcriptGrammarColorsEnabled')?.checked!==false,
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

function updateLiveHighlightPreview(){
  const preview=document.getElementById('liveHighlightPreview'); if(!preview)return;
  const style=document.getElementById('liveTranscriptHighlightStyle')?.value||'soft-background';
  const color=document.getElementById('liveTranscriptHighlightColor')?.value||'#8B5CF6';
  const opacity=Math.max(0,Math.min(100,Number(document.getElementById('liveTranscriptHighlightOpacity')?.value ?? 25)))/100;
  const textColor=document.getElementById('liveTranscriptInheritTextColor')?.checked!==false?'inherit':(document.getElementById('liveTranscriptHighlightTextColor')?.value||'#FFFFFF');
  preview.style.backgroundColor=style==='soft-background'||style==='rounded-background'?`color-mix(in srgb, ${color} ${opacity*100}%, transparent)`:'transparent';
  preview.style.borderRadius=style==='rounded-background'?'12px':'6px';
  preview.style.boxShadow=style==='left-accent'?`inset 4px 0 0 ${color}`:style==='rounded-background'?`inset 0 0 0 1px ${color}`:'none';
  preview.style.textDecoration=style==='underline'?`underline 2px ${color}`:'none';
  preview.style.color=style==='text-color'?color:textColor;
  preview.style.opacity=document.getElementById('liveTranscriptHighlightEnabled')?.checked===false?'.45':'1';
}
['liveTranscriptHighlightEnabled','liveTranscriptHighlightStyle','liveTranscriptHighlightColor','liveTranscriptHighlightOpacity','liveTranscriptHighlightTextColor','liveTranscriptInheritTextColor'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateLiveHighlightPreview));
document.getElementById('resetLiveHighlight')?.addEventListener('click',()=>{
 const values={liveTranscriptHighlightEnabled:true,liveTranscriptHighlightStyle:'soft-background',liveTranscriptHighlightColor:'#8B5CF6',liveTranscriptHighlightOpacity:25,liveTranscriptHighlightTextColor:'#FFFFFF',liveTranscriptInheritTextColor:true,liveTranscriptSyncMode:'active-subtitle',liveTranscriptAutoScroll:true,liveTranscriptScrollPosition:'center',liveTranscriptTransitionMs:150,liveTranscriptFollowWhilePaused:true,liveTranscriptRespectManualScroll:true};
 for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(!el)continue;if(el.type==='checkbox')el.checked=value;else el.value=String(value)} updateLiveHighlightPreview();
});
document.getElementById('copyLiveHighlightPreview')?.addEventListener('click',async()=>{
 const value={enabled:document.getElementById('liveTranscriptHighlightEnabled')?.checked!==false,style:document.getElementById('liveTranscriptHighlightStyle')?.value,color:document.getElementById('liveTranscriptHighlightColor')?.value,opacity:Number(document.getElementById('liveTranscriptHighlightOpacity')?.value),textColor:document.getElementById('liveTranscriptHighlightTextColor')?.value,syncMode:document.getElementById('liveTranscriptSyncMode')?.value,autoScroll:document.getElementById('liveTranscriptAutoScroll')?.checked,scrollPosition:document.getElementById('liveTranscriptScrollPosition')?.value,transitionMs:Number(document.getElementById('liveTranscriptTransitionMs')?.value),followWhilePaused:document.getElementById('liveTranscriptFollowWhilePaused')?.checked,respectManualScroll:document.getElementById('liveTranscriptRespectManualScroll')?.checked};
 try{await navigator.clipboard.writeText(JSON.stringify(value,null,2));document.getElementById('liveHighlightCopyStatus').textContent='Preview settings copied.'}catch(_){document.getElementById('liveHighlightCopyStatus').textContent='Clipboard unavailable; save the settings below instead.'}
});

document.getElementById('resetColors').onclick=()=>{colorFields.forEach(([key])=>{const el=document.getElementById(`color-${key}`);if(el)el.value=defaults.grammarColors[key]});};

document.getElementById('resetToolbar')?.remove();

// v4.4.1 — adaptive controls improve clarity without changing setting IDs or saved values.
(function enhanceSettingsUX(){
  const byId=id=>document.getElementById(id);
  const field=id=>byId(id)?.closest('label');
  const setVisible=(id,visible)=>{const node=field(id);if(!node)return;node.classList.toggle('is-condition-hidden',!visible);node.setAttribute('aria-hidden',String(!visible));};
  const rules=[
    {watch:'toolbarAutoHideEnabledUI',run:()=>setVisible('toolbarAutoHideDelayMsUI',!!byId('toolbarAutoHideEnabledUI')?.checked)},
    {watch:'transcriptAutoHideEnabledUI',run:()=>setVisible('transcriptControlHideDelayMs',!!byId('transcriptAutoHideEnabledUI')?.checked)},
    {watch:'originalBoxWidthMode',run:()=>setVisible('originalBoxWidthCustom',byId('originalBoxWidthMode')?.value==='custom')},
    {watch:'originalBoxHeightMode',run:()=>setVisible('originalBoxHeightCustom',byId('originalBoxHeightMode')?.value==='custom')},
    {watch:'originalMaxLines',run:()=>setVisible('originalCustomMaxLines',byId('originalMaxLines')?.value==='custom')},
    {watch:'translationBoxWidthMode',run:()=>setVisible('translationBoxWidthCustom',byId('translationBoxWidthMode')?.value==='custom')},
    {watch:'translationBoxHeightMode',run:()=>setVisible('translationBoxHeightCustom',byId('translationBoxHeightMode')?.value==='custom')},
    {watch:'translationMaxLines',run:()=>setVisible('translationCustomMaxLines',byId('translationMaxLines')?.value==='custom')},
    ...['original','translation'].map(kind=>({watch:`${kind}LineSpacing`,run:()=>{const input=byId(`${kind}LineSpacingCustom`);if(input)input.classList.toggle('is-condition-hidden',byId(`${kind}LineSpacing`)?.value!=='custom');}}))
  ];
  rules.forEach(rule=>{const control=byId(rule.watch);if(!control)return;control.addEventListener('change',rule.run);rule.run();});
  document.addEventListener('cmj-settings-loaded',()=>rules.forEach(rule=>rule.run()));

  // Show a clear unsaved-state hint; the existing save handler remains authoritative for success.
  const saveButton=byId('save'),status=byId('status');
  if(status&&saveButton){
    const markDirty=event=>{
      if(!event.target?.matches?.('input,select,textarea'))return;
      if(event.target.id==='status')return;
      saveButton.classList.remove('saved');
      saveButton.textContent='Save Changes';
      status.textContent='Unsaved changes';
      status.style.color='#fbbf24';
    };
    document.addEventListener('input',markDirty,true);
    document.addEventListener('change',markDirty,true);
    saveButton.addEventListener('click',()=>{status.style.color='';});
  }
})();
