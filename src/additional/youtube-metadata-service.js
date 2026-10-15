/** Additive public-page YouTube metadata resolver. */
function clean(s){return String(s??'').replace(/\s+/g,' ').trim()}
function firstJson(text,marker){const i=text.indexOf(marker);if(i<0)return null;const start=text.indexOf('{',i);if(start<0)return null;let depth=0,quote=false,esc=false;for(let p=start;p<text.length;p++){const c=text[p];if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')quote=false;continue}if(c==='"'){quote=true;continue}if(c==='{')depth++;else if(c==='}'&&!--depth){try{return JSON.parse(text.slice(start,p+1))}catch{return null}}}return null}
function deepFind(obj,keys){const wanted=new Set(keys),stack=[obj];while(stack.length){const x=stack.pop();if(!x||typeof x!=='object')continue;for(const[k,v]of Object.entries(x)){if(wanted.has(k)&&v!=null)return v;if(v&&typeof v==='object')stack.push(v)}}return null}
function metaTag(html,name){const re=new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(':','\\:')}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name.replace(':','\\:')}["']`,'i');const m=html.match(re);return clean(m?.[1]||m?.[2]||'')}
function channelIdFromHtml(html){return clean((html.match(/"channelId":"(UC[\w-]{10,})"/)||[])[1]||'')}
export function parseYouTubeMetadata(url,html,type='auto'){
 const u=new URL(url),text=String(html||'');
 const isPlaylist=u.pathname==='/playlist'||(u.searchParams.has('list')&&u.pathname!=='/watch');
 const isChannel=/^\/(?:@|channel\/|c\/|user\/)/.test(u.pathname);
 const kind=type==='auto'?(isChannel?'channel':isPlaylist?'playlist':'unknown'):type;
 const ld=[];const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(text))){try{const x=JSON.parse(m[1]);Array.isArray(x)?ld.push(...x):ld.push(x)}catch{}}
 const schema=ld.find(x=>x&&typeof x==='object'&&(x.name||x.description))||{};const yt=firstJson(text,'var ytInitialData')||firstJson(text,'ytInitialData =');
 let name=clean(schema.name||deepFind(yt,['title'])?.simpleText||deepFind(yt,['text'])||metaTag(text,'og:title')||'');
 let description=clean(schema.description||deepFind(yt,['description'])?.simpleText||metaTag(text,'og:description')||'');
 let thumb=clean(schema.image?.url||schema.thumbnailUrl?.[0]||metaTag(text,'og:image')||metaTag(text,'twitter:image')||'');
 const avatar=deepFind(yt,['avatar']); if(!thumb&&avatar?.thumbnails?.length)thumb=avatar.thumbnails.at(-1)?.url||'';
 if(kind==='playlist'&&!thumb){const pv=deepFind(yt,['playlistVideoRenderer']);thumb=pv?.thumbnail?.thumbnails?.at(-1)?.url||'';}
 const id=kind==='channel'?channelIdFromHtml(text):(u.searchParams.get('list')||'');
 const handle=(u.pathname.match(/\/@([^/]+)/)||[])[1]?`@${(u.pathname.match(/\/@([^/]+)/)||[])[1]}`:'';
 const subscribers=clean(deepFind(yt,['subscriberCountText'])?.simpleText||deepFind(yt,['subscriberCountText'])?.runs?.map(x=>x.text).join('')||'');
 const videoCount=clean(deepFind(yt,['videoCountText'])?.simpleText||deepFind(yt,['videoCountText'])?.runs?.map(x=>x.text).join('')||'');
 const owner=clean(deepFind(yt,['ownerText'])?.runs?.map(x=>x.text).join('')||deepFind(yt,['longBylineText'])?.runs?.map(x=>x.text).join('')||'');
 return {kind,id,channelId:kind==='channel'?id:'',playlistId:kind==='playlist'?id:'',name,handle,url:u.href,description,thumbnail:thumb,subscriberCount:subscribers,videoCount,owner,metadataLastChecked:new Date().toISOString(),thumbnailChecked:new Date().toISOString()};
}
export async function fetchYouTubeMetadata(url,type='auto'){const r=await fetch(url,{credentials:'include',cache:'no-store',headers:{accept:'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error(`YouTube metadata HTTP ${r.status}`);const html=await r.text();return parseYouTubeMetadata(url,html,type)}
