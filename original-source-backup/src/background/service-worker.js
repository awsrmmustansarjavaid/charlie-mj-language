/**
 * Charlie MJ Language - Manifest V3 service worker.
 * Responsible for context menus, commands, translation requests, downloads and
 * lightweight background coordination. No GitHub Actions or remote code is used.
 */

const MENU_ROOT = 'cmj-root';
const MENU_WATCH = 'cmj-watch-later';
const MENU_LEARN = 'cmj-open-learning';
const MENU_BOOKMARK = 'cmj-bookmark';
const MENU_SAVE_SELECTION = 'cmj-save-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({ id: MENU_ROOT, title: 'Charlie MJ Language', contexts: ['page', 'link', 'selection'] });
    chrome.contextMenus.create({ id: MENU_WATCH, parentId: MENU_ROOT, title: '➕ Add YouTube video to Watch Later', contexts: ['page', 'link'], documentUrlPatterns: ['https://*.youtube.com/*', 'https://youtu.be/*'] });
    chrome.contextMenus.create({ id: MENU_LEARN, parentId: MENU_ROOT, title: '🎬 Open Charlie MJ Learning Panel', contexts: ['page'], documentUrlPatterns: ['https://*.youtube.com/*'] });
    chrome.contextMenus.create({ id: MENU_BOOKMARK, parentId: MENU_ROOT, title: '🔖 Bookmark current YouTube moment', contexts: ['page'], documentUrlPatterns: ['https://*.youtube.com/*'] });
    chrome.contextMenus.create({ id: MENU_SAVE_SELECTION, parentId: MENU_ROOT, title: '⭐ Save selected text as vocabulary', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_WATCH) {
    const url = info.linkUrl || tab.url || '';
    if (/youtube\.com|youtu\.be/.test(url)) {
      await chrome.storage.local.set({ lastWatchLaterRequest: { url, title: tab.title || '', addedAt: Date.now() } });
      await sendToTab(tab.id, { type: 'CMJ_ADD_WATCH_LATER', url, title: tab.title || '' });
    }
  }
  if (info.menuItemId === MENU_LEARN) await sendToTab(tab.id, { type: 'CMJ_OPEN_PANEL' });
  if (info.menuItemId === MENU_BOOKMARK) await sendToTab(tab.id, { type: 'CMJ_BOOKMARK' });
  if (info.menuItemId === MENU_SAVE_SELECTION) await sendToTab(tab.id, { type: 'CMJ_SAVE_TEXT', text: info.selectionText || '' });
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  if (command === 'toggle-focus-mode') await sendToTab(tab.id, { type: 'CMJ_TOGGLE_FOCUS' });
  if (command === 'save-current-vocabulary') await sendToTab(tab.id, { type: 'CMJ_SAVE_CURRENT' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CMJ_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage().then(() => sendResponse({ ok: true })).catch(async () => {
      try { await chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') }); sendResponse({ ok: true }); }
      catch (error) { sendResponse({ ok: false, error: error.message }); }
    });
    return true;
  }
  if (message.type === 'CMJ_YOUTUBE_CAPTIONS') {
    youtubeCaptions(message.videoId, message.source || 'auto', message.target || 'en', message.mode || 'bundle')
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_TRANSLATE') {
    translate(message.text, message.source, message.target, message.provider, message.libreUrl, message.settings||{})
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_DICTIONARY') {
    dictionaryLookup(message.text, message.source || 'en', message.target || 'en', message.settings || {})
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ok:false,error:error.message}));
    return true;
  }
  if (message.type === 'CMJ_CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: 'png' })
      .then(dataUrl => getDownloadSettings().then(settings => chrome.downloads.download({ url: dataUrl, filename: message.filename || 'Charlie MJ Language/Screenshots/capture.png', saveAs: Boolean(settings.downloadSaveAs) })))
      .then(id => sendResponse({ ok: true, id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_DOWNLOAD_DATA') {
    let base64;
    if (message.dataUrl) base64 = message.dataUrl;
    else {
      const bytes = new TextEncoder().encode(message.text || '');
      base64 = `data:${message.mime || 'text/plain'};base64,${btoa(String.fromCharCode(...bytes))}`;
    }
    getDownloadSettings().then(settings => chrome.downloads.download({
      url: base64,
      filename: message.filename || 'charlie-mj.txt',
      saveAs: Boolean(settings.downloadSaveAs)
    })).then(id => sendResponse({ ok: true, id })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

async function sendToTab(tabId, message) {
  try { return await chrome.tabs.sendMessage(tabId, message); } catch { return null; }
}

/** Read the local download preference before placing a generated file. */
async function getDownloadSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { downloadSaveAs: false, ...(stored.settings || {}) };
}


function youtubeCaptionText(text){
  const raw=String(text||'').trim(); if(!raw) return [];
  const out=[];
  if(raw.startsWith('{')){
    try{
      const json=JSON.parse(raw);
      for(const e of (json.events||[])){
        const value=(e.segs||[]).map(x=>x.utf8||'').join('').replace(/\s+/g,' ').trim();
        if(value) out.push({start:Number(e.tStartMs||0)/1000,duration:Number(e.dDurationMs||0)/1000,text:value});
      }
    }catch(_){ }
    return out;
  }
  const decode=v=>String(v||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
  const re=/<text\b([^>]*)>([\s\S]*?)<\/text>/gi; let m;
  while((m=re.exec(raw))){ const a=m[1]||''; const body=decode(m[2].replace(/<[^>]+>/g,'' )).replace(/\s+/g,' ').trim(); if(!body)continue; const attr=n=>{const q=a.match(new RegExp('\\b'+n+'=(?:\"([^\"]*)\"|\'([^\']*)\')'));return q?(q[1]??q[2]??''):''}; out.push({start:Number(attr('start')||0),duration:Number(attr('dur')||0),text:body}); }
  return out;
}
async function youtubePlayer(videoId, client){
  const contexts={
    ANDROID:{clientName:'ANDROID',clientVersion:'20.10.38',androidSdkVersion:35,hl:'en',gl:'US'},
    IOS:{clientName:'IOS',clientVersion:'20.10.38',deviceMake:'Apple',deviceModel:'iPhone16,2',osName:'iOS',osVersion:'18.5',hl:'en',gl:'US'},
    TVHTML5:{clientName:'TVHTML5',clientVersion:'7.20260325.18.00',hl:'en',gl:'US'},
    WEB:{clientName:'WEB',clientVersion:'2.20261006.01.00',hl:'en',gl:'US'}
  };
  const response=await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false',{method:'POST',credentials:'include',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({context:{client:contexts[client]},videoId})});
  if(!response.ok) throw new Error(`YouTube player HTTP ${response.status}`);
  return response.json();
}
async function youtubeCaptions(videoId, source='auto', target='en', mode='bundle'){
  const id=String(videoId||'').trim(); if(!id) throw new Error('Missing YouTube video ID.');
  let player=null, last='';
  for(const client of ['ANDROID','IOS','TVHTML5','WEB']){
    try{ player=await withTimeout(youtubePlayer(id,client),4500); const status=player?.playabilityStatus?.status; if(status && status!=='OK' && !player?.captions) throw new Error(player?.playabilityStatus?.reason||status); const tracks=player?.captions?.playerCaptionsTracklistRenderer?.captionTracks||[]; if(tracks.length){ last=''; const cleanTracks=tracks.map(t=>({baseUrl:String(t.baseUrl||'').replace(/\\u0026/g,'&'),languageCode:t.languageCode||'',name:t.name?.simpleText||'',kind:t.kind||'',isTranslatable:t.isTranslatable!==false})).filter(t=>t.baseUrl); const lang=x=>String(x||'').split('-')[0].toLowerCase(); const src=lang(source); const tgt=lang(target); const find=(l)=>cleanTracks.find(t=>lang(t.languageCode)===l && t.kind!=='asr')||cleanTracks.find(t=>lang(t.languageCode)===l);
      const sourceTrack=(src&&src!=='auto'?find(src):null)||cleanTracks.find(t=>t.kind==='asr')||cleanTracks[0];
      const nativeTarget=find(tgt);
      async function fetchTrack(track, auto){ if(!track?.baseUrl) return []; const u=new URL(track.baseUrl); u.searchParams.set('fmt','json3'); if(auto && tgt) u.searchParams.set('tlang',tgt); const r=await withTimeout(fetch(u.toString(),{credentials:'include',cache:'no-store',headers:{accept:'application/json,text/plain,*/*'}}),3500); if(!r.ok) throw new Error(`Caption HTTP ${r.status}`); return youtubeCaptionText(await r.text()); }
      let original=[]; let translation=[]; let translationSource='';
      try{ original=await fetchTrack(sourceTrack,false); }catch(e){ last=e.message; }
      if(nativeTarget && (!sourceTrack || lang(nativeTarget.languageCode)!==lang(sourceTrack.languageCode))){ try{ translation=await fetchTrack(nativeTarget,false); translationSource='YouTube Native'; }catch(e){last=e.message;} }
      if(!translation && sourceTrack){ try{ translation=await fetchTrack(sourceTrack,true); if(translation.length) translationSource='YouTube Auto-Translation'; }catch(e){last=e.message;} }
      if(original.length || translation.length) return {ok:true,videoId:id,tracks:cleanTracks,original,translation,translationSource:translationSource||'YouTube Auto-Translation',sourceLanguage:sourceTrack?.languageCode||src,targetLanguage:tgt};
    }}catch(e){ last=e.message; }
  }
  throw new Error(last||'YouTube did not expose caption data for this video.');
}

async function withTimeout(promise, ms){
  const timeout=Math.max(500,Number(ms)||5000);
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Provider timeout')),timeout))]);
}
async function fetchJson(url, options={}, timeout=5000){
  const response=await withTimeout(fetch(url,options),timeout);
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function normalisePriority(settings){
  const defaults=['youtube-captions','google','microsoft','mymemory','libretranslate','deepl'];
  const raw=Array.isArray(settings.translationProviderPriority)?settings.translationProviderPriority:defaults;
  const aliases={youtube:'youtube-captions','youtube-native':'youtube-captions','youtube-auto':'youtube-captions','youtube subtitle':'youtube-captions','youtube-subtitle':'youtube-captions','youtube auto':'youtube-captions','youtube-auto-translation':'youtube-captions'};
  const out=[];
  for(const item of raw){ const k=aliases[String(item||'').trim().toLowerCase()]||String(item||'').trim().toLowerCase(); if(k && !out.includes(k)) out.push(k); }
  for(const k of defaults) if(!out.includes(k)) out.push(k);
  return out;
}
function providerList(settings,requested){
  const configured=normalisePriority(settings);
  const enabled=settings.enabledTranslationProviders||{};
  const filtered=configured.filter(p=>p!=='youtube-captions' && enabled[p]===true);
  if(requested && requested!=='youtube-first' && requested!=='auto' && enabled[requested]===true) return [requested,...filtered.filter(x=>x!==requested)];
  return filtered;
}

async function providerTranslate(provider,text,source,target,settings){
  const timeout=settings.translationTimeoutMs||5000;
  const keys=settings.translationApiKeys||{};
  if(provider==='google'){
    const key=keys.google;if(!key) throw new Error('Google API key is not configured.');
    const data=await fetchJson(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source:source==='auto'?undefined:source,target,format:'text'})
    },timeout);
    return data?.data?.translations?.[0]?.translatedText||'';
  }
  if(provider==='microsoft'){
    const key=keys.microsoft;if(!key) throw new Error('Microsoft Translator API key is not configured.');
    const headers={'Content-Type':'application/json','Ocp-Apim-Subscription-Key':key};
    if(settings.microsoftRegion)headers['Ocp-Apim-Subscription-Region']=settings.microsoftRegion;
    const data=await fetchJson(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(target)}${source&&source!=='auto'?`&from=${encodeURIComponent(source)}`:''}`,{
      method:'POST',headers,body:JSON.stringify([{Text:text}])
    },timeout);
    return data?.[0]?.translations?.[0]?.text||'';
  }
  if(provider==='deepl'){
    const key=keys.deepl;if(!key) throw new Error('DeepL API key is not configured.');
    const host=key.endsWith(':fx')?'https://api-free.deepl.com':'https://api.deepl.com';
    const body=new URLSearchParams({text,target_lang:String(target||'EN').replace('-','_').toUpperCase()});
    if(source&&source!=='auto')body.set('source_lang',String(source).replace('-','_').toUpperCase());
    const data=await fetchJson(`${host}/v2/translate`,{method:'POST',headers:{'Authorization':`DeepL-Auth-Key ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body},timeout);
    return data?.translations?.[0]?.text||'';
  }
  if(provider==='libretranslate'){
    const base=(settings.libreTranslateUrl||'').replace(/\/$/,'');if(!base)throw new Error('LibreTranslate server URL is not configured.');
    const data=await fetchJson(`${base}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source,target,format:'text'})},timeout);
    return data?.translatedText||'';
  }
  if(provider==='argos'){
    const base=(settings.argosUrl||'').replace(/\/$/,'');if(!base)throw new Error('Argos local service is not configured.');
    const data=await fetchJson(`${base}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source,target})},timeout);
    return data?.translatedText||data?.translation||'';
  }
  if(provider==='mymemory'){
    const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source||'auto')}|${encodeURIComponent(target)}`;
    const data=await fetchJson(url,{},timeout);
    return data?.responseData?.translatedText||'';
  }
  throw new Error(`Unknown translation provider: ${provider}`);
}
async function translate(text, source='auto', target='en', provider='youtube-first', libreUrl='', incomingSettings={}){
  const stored=await chrome.storage.local.get('settings');
  const settings={...(stored.settings||{}),...(incomingSettings||{})};
  if(libreUrl && !settings.libreTranslateUrl)settings.libreTranslateUrl=libreUrl;
  const value=String(text||'').trim();
  if(!value)return {translation:'',source:'none',status:'empty'};
  if(value.length>(settings.maxTranslationLength||2000))throw new Error(`Text exceeds the ${settings.maxTranslationLength||2000}-character limit.`);
  if(settings.privacyMode && !settings.offlineOnly)settings.onlineOnly=false;
  const sourceKey=source||'auto',targetKey=target||'en';
  const cacheKey=`translation:${sourceKey}:${targetKey}:${value}`;
  if(settings.translationCache!==false){
    const cached=await chrome.storage.local.get(cacheKey);
    if(cached[cacheKey]){const entry=cached[cacheKey];if(entry&&typeof entry==='object'&&entry.translation)return {translation:entry.translation,provider:entry.provider||'cache',source:sourceKey,target:targetKey,status:'cached',cached:true};return {translation:entry,provider:'cache',source:sourceKey,target:targetKey,status:'cached',cached:true};}
  }
  if(settings.offlineOnly && !settings.argosUrl)throw new Error('Offline-only mode requires an Argos local service.');
  const candidates=settings.offlineOnly?['argos']:(settings.privacyMode?['argos']:(settings.onlineOnly?providerList(settings,provider).filter(p=>p!=='argos'):providerList(settings,provider)));
  const errors=[];
  for(let attempt=0;attempt<=Math.max(0,Number(settings.translationRetries)||0);attempt++){
    for(const candidate of candidates){
      if(candidate==='argos' && !settings.argosUrl)continue;
      try{
        const translation=await providerTranslate(candidate,value,sourceKey,targetKey,settings);
        if(!translation)throw new Error('Empty translation');
        if(settings.translationCache!==false)await chrome.storage.local.set({[cacheKey]:{translation,provider:candidate,source:sourceKey,target:targetKey,updatedAt:new Date().toISOString()}});
        let verification=[];
        if(settings.verificationMode){
          const verifyCandidates=providerList(settings,provider).filter(p=>p!==candidate && p!=='argos' || (p==='argos' && settings.argosUrl)).slice(0,3);
          const results=await Promise.allSettled(verifyCandidates.map(p=>providerTranslate(p,value,sourceKey,targetKey,settings)));
          verification=results.map((r,i)=>({provider:verifyCandidates[i],translation:r.status==='fulfilled'?r.value:'',status:r.status==='fulfilled'?'ok':'unavailable'}));
          const normalized=[translation,...verification.filter(x=>x.translation).map(x=>x.translation).map(x=>x.trim().toLowerCase())];
          const agreement=verification.filter(x=>x.translation).every(x=>x.translation.trim().toLowerCase()===translation.trim().toLowerCase())
            ? (verification.length?'High Agreement':'Single Result')
            : (verification.length?'Different Translations':'Single Result');
          return {translation,provider:candidate,source:sourceKey,target:targetKey,status:'translated',cached:false,verification,agreement};
        }
        return {translation,provider:candidate,source:sourceKey,target:targetKey,status:'translated',cached:false};
      }catch(error){errors.push(`${candidate}: ${error.message}`);}
    }
  }
  throw new Error(errors.length?errors.join(' • '):'No configured translation provider is available.');
}
function referenceLinks(word,source,target){
  const w=encodeURIComponent(String(word||'').trim());
  const src=String(source||'en').split('-')[0];
  const links=[
    {name:'Wiktionary',url:`https://${src}.wiktionary.org/wiki/${w}`},
    {name:'Cambridge Dictionary',url:`https://dictionary.cambridge.org/dictionary/english/${w}`},
    {name:'Collins Dictionary',url:`https://www.collinsdictionary.com/dictionary/english/${w}`},
    {name:'Merriam-Webster',url:`https://www.merriam-webster.com/dictionary/${w}`},
    {name:"Oxford Learner's Dictionaries",url:`https://www.oxfordlearnersdictionaries.com/definition/english/${w}`},
    {name:'Glosbe',url:`https://glosbe.com/${src}/en/${w}`},
    {name:'Reverso Context',url:`https://context.reverso.net/translation/${src}-english/${w}`},
    {name:'Tureng',url:`https://tureng.com/en/turkish-english/${w}`},
    {name:'Rekhta',url:`https://www.rekhtadictionary.com/search/${w}`}
  ];
  return links;
}
async function dictionaryLookup(text,source='en',target='en',settings={}){
  const value=String(text||'').trim(); if(!value)return {ok:false,entries:[]};
  if(settings.dictionaryEnabled===false || settings.privacyMode)return {ok:false,entries:[],status:'disabled'};
  const lang=String(source||'en').split('-')[0];
  const refs=referenceLinks(value,source,target);
  const dictTimeout=Math.max(1500,Math.min(5000,Number(settings.dictionaryTimeoutMs)||2500));
  // Use the English Wiktionary REST endpoint as the universal runtime layer.
  // It contains entries for Turkish, Urdu, Arabic, Persian/Farsi and many
  // other languages, while avoiding a multi-hundred-MB bundled dictionary.
  if(settings.dictionaryWiktionaryEnabled!==false){
    try{
      const url=`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(value)}`;
      const data=await fetchJson(url,{},dictTimeout);
      const entries=[];
      for(const [code,defs] of Object.entries(data||{})){
        for(const d of Array.isArray(defs)?defs:[]){
          const meanings=(d.definitions||[]).map(x=>({definition:x.definition||'',example:(x.examples||[]).map(e=>e.text||'').filter(Boolean),synonyms:(x.synonyms||[]).map(x=>x.word||x).filter(Boolean)}));
          entries.push({word:value,language:code,pos:d.partOfSpeech||'',phonetic:d.pronunciation?.text||'',meanings});
        }
      }
      if(entries.length) return {ok:true,entries,source:'Wiktionary / Kaikki',sourceUrl:refs[0].url,dictionary:{word:value,language:lang,entries},referenceLinks:settings.dictionaryReferenceLinks===false?[]:refs};
    }catch(_){ }
  }
  const endpoint=(settings.dictionaryEndpoint||'https://api.dictionaryapi.dev/api/v2/entries').replace(/\/$/,'');
  try{
    if(lang!=='en') throw new Error('No English-only fallback for this language.');
    const data=await fetchJson(`${endpoint}/en/${encodeURIComponent(value)}`,{},dictTimeout);
    return {ok:true,entries:Array.isArray(data)?data:[],source:'DictionaryAPI.dev',sourceUrl:`${endpoint}/${encodeURIComponent(lang)}/${encodeURIComponent(value)}`,dictionary:{word:value,language:lang,entries:Array.isArray(data)?data:[]},referenceLinks:settings.dictionaryReferenceLinks===false?[]:refs};
  }catch(error){return {ok:false,entries:[],error:error.message,source:'Wiktionary / Kaikki',referenceLinks:settings.dictionaryReferenceLinks===false?[]:refs};}
}
