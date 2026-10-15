/**
 * Charlie MJ Language - universal page selection translator.
 * On ordinary websites, selecting text reveals a small translate action. The
 * extension never rewrites the page automatically; the learner explicitly asks
 * for a translation, keeping websites readable and avoiding intrusive UI.
 */
(() => {
  let bubble;
  document.addEventListener('mouseup', () => {
    const text = window.getSelection()?.toString().trim();
    if (!text || text.length > 5000) return hide();
    if (!bubble) { bubble = document.createElement('button'); bubble.id='cmj-page-translate'; bubble.textContent='🌍 Translate with Charlie MJ'; document.body.appendChild(bubble); bubble.onclick=async()=>{const r=await chrome.runtime.sendMessage({type:'CMJ_TRANSLATE',text,source:'auto',target:'en',provider:'mymemory'});showResult(r?.translation||'Translation unavailable')}; }
    const rect=window.getSelection().getRangeAt(0).getBoundingClientRect(); bubble.style.left=`${Math.max(8,rect.left+window.scrollX)}px`;bubble.style.top=`${rect.bottom+window.scrollY+8}px`;bubble.hidden=false;
  });
  document.addEventListener('scroll',hide,{passive:true});
  function hide(){if(bubble)bubble.hidden=true}
  function showResult(text){if(!bubble)return;bubble.textContent=text;bubble.classList.add('result');setTimeout(()=>{bubble.textContent='🌍 Translate with Charlie MJ';bubble.classList.remove('result')},5000)}
})();
