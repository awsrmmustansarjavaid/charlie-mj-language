const DEFAULTS={enabled:true,targetLanguage:'en',fontScale:1,opacity:.72};
const $=id=>document.getElementById(id);
async function getSettings(){return {...DEFAULTS,...((await chrome.storage.local.get('cmjDualSettings')).cmjDualSettings||{})};}
async function save(s){await chrome.storage.local.set({cmjDualSettings:s});}
async function sendToYouTube(msg){const tabs=await chrome.tabs.query({active:true,currentWindow:true});if(tabs[0] && /^https:\/\/(www\.)?youtube\.com\//.test(tabs[0].url||'')){try{return await chrome.tabs.sendMessage(tabs[0].id,msg)}catch(e){return null}}}
async function init(){const s=await getSettings();$('enabled').checked=s.enabled;$('language').value=s.targetLanguage;$('scale').value=String(s.fontScale);$('opacity').value=s.opacity;
  for(const id of ['enabled','language','scale','opacity']) $(id).addEventListener('change',async()=>{const s=await getSettings();s.enabled=$('enabled').checked;s.targetLanguage=$('language').value;s.fontScale=Number($('scale').value);s.opacity=Number($('opacity').value);await save(s);await sendToYouTube({type:'CMJ_SETTINGS',settings:s});});
  $('refresh').onclick=async()=>{ $('status').textContent='Fetching…';const r=await sendToYouTube({type:'CMJ_REFRESH'});$('status').textContent=r?.ok?'Ready.':'Refresh requested.';};
  $('openPanel').onclick=async()=>{await sendToYouTube({type:'CMJ_OPEN_PANEL'});window.close();};
  const r=await sendToYouTube({type:'CMJ_GET_STATUS'});if(r)$('status').textContent=`${r.status} · ${r.cueCount||0} cues`;
}
init();
