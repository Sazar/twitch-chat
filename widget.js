/*
 ================================================================
  Horizontal Twitch Chat — StreamElements Widget
 ================================================================
*/

let fd = {};
let thirdPartyEmotes = {};
let widgetLoaded = false;
let MAX_MSGS = 6;
const avatarCache = new Map();
const imagePreloadCache = new Set();

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

function applyVars() {
  MAX_MSGS = Math.max(1, parseInt(fd.maxMessages) || 6);
  let lnk = document.getElementById('_gf');
  if (!lnk) { lnk = document.createElement('link'); lnk.id='_gf'; lnk.rel='stylesheet'; document.head.appendChild(lnk); }
  const font = fd.googleFont || 'Montserrat';
  lnk.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:ital,wght@0,400;0,500;1,700;1,800&display=swap`;
  const R = document.documentElement;
  const set = (k,v) => R.style.setProperty(k,v);
  set('--font',          `'${font}', sans-serif`);
  set('--av-size',       (parseInt(fd.avatarSize)       || 56) + 'px');
  set('--av-radius',     (parseInt(fd.avatarRadius)     || 10) + 'px');
  set('--av-bg',          fd.avatarInitialsBg           || '#7C3AED');
  set('--av-color',       fd.avatarInitialsColor        || '#ffffff');
  set('--bar-w',         (parseInt(fd.borderWidth)      ||  5) + 'px');
  set('--badge-sz',      (parseInt(fd.badgeSize)        || 15) + 'px');
  set('--name-color',     fd.usernameColor              || '#a78bfa');
  set('--name-size',     (parseInt(fd.usernameFontSize) || 15) + 'px');
  set('--name-transform',
    fd.usernameTransform==='uppercase'?'uppercase':
    fd.usernameTransform==='lowercase'?'lowercase':'none');
  set('--msg-color',      fd.messageColor               || '#dde9f7');
  set('--msg-size',      (parseInt(fd.messageFontSize)  || 13) + 'px');
  set('--msg-bg',         fd.messageBg                  || 'rgba(15,18,45,0.82)');
  set('--gap',           (parseInt(fd.spacing)          || 14) + 'px');
  const c = document.getElementById('chat-container');
  if (c) c.style.flexDirection = fd.scrollDirection==='right-to-left'?'row-reverse':'row';
}

function getBarColor(twitchColor) {
  return fd.borderColorType === 'custom' ? (fd.borderColor || '#539ef7') : twitchColor;
}
function getAvatarBorderColor(twitchColor) {
  return fd.avatarBorderColorType === 'custom' ? (fd.avatarBorderColor || '#a78bfa') : twitchColor;
}

function preloadImage(url) {
  if (!url || imagePreloadCache.has(url)) return Promise.resolve();
  imagePreloadCache.add(url);
  return new Promise(resolve => { const i=new Image(); i.onload=i.onerror=resolve; i.src=url; });
}

async function fetchAvatar(username) {
  if (!username) return null;
  const key = username.toLowerCase();
  if (avatarCache.has(key)) {
    const v = avatarCache.get(key);
    if (v instanceof Promise) return v;
    return v;
  }
  const promise = (async () => {
    try {
      const r = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(key)}`);
      if (!r.ok) return null;
      const url = (await r.text()).trim();
      if (url && url.startsWith('http')) {
        await preloadImage(url);
        avatarCache.set(key, url);
        return url;
      }
    } catch(e) {}
    avatarCache.set(key, null);
    return null;
  })();
  avatarCache.set(key, promise);
  const result = await promise;
  avatarCache.set(key, result);
  return result;
}

function preloadEmoteUrls(urls) {
  return Promise.all(urls.map(u => preloadImage(u)));
}

function collectEmoteUrls(data) {
  const urls = [];
  if (Array.isArray(data.emotes)) {
    data.emotes.forEach(em => {
      const url = em.urls
        ? (em.urls['2']||em.urls['1']||em.urls['4']||Object.values(em.urls)[0]||'')
        : (em.id ? `https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/3.0` : '');
      if (url) urls.push(url);
    });
  } else if (data.emotes && typeof data.emotes === 'object') {
    for (const id of Object.keys(data.emotes))
      urls.push(`https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0`);
  }
  const frags = data.fragments||(data.message&&data.message.fragments);
  if (Array.isArray(frags))
    frags.forEach(p => { if (p.type==='emote'&&p.emote?.id) urls.push(`https://static-cdn.jtvnw.net/emoticons/v2/${p.emote.id}/default/dark/3.0`); });
  const rawText = String(data.text||data.messageRaw||(data.message&&data.message.text)||'');
  rawText.split(/\s+/).forEach(tok => { if (thirdPartyEmotes[tok]) urls.push(thirdPartyEmotes[tok]); });
  return [...new Set(urls)];
}

function renderEmotes(text, emotes) {
  const chars = Array.from(String(text||''));
  const map = new Map();
  if (Array.isArray(emotes)) {
    emotes.forEach(em => {
      const url = em.urls?(em.urls['2']||em.urls['1']||em.urls['4']||Object.values(em.urls)[0]||''):(em.id?`https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/3.0`:'');
      if (!url) return;
      const s=Number(em.start!==undefined?em.start:em.startIndex), e=Number(em.end!==undefined?em.end:em.endIndex);
      if (isNaN(s)||isNaN(e)) return;
      map.set(s,{end:e,html:`<img class="emote" src="${esc(url)}" alt="${esc(chars.slice(s,e+1).join(''))}">`});
    });
  } else if (emotes&&typeof emotes==='object') {
    for (const [id,positions] of Object.entries(emotes)) {
      const list=Array.isArray(positions)?positions:String(positions).split('/');
      for (const p of list) {
        const [s,e]=String(p).split('-').map(Number);
        if (isNaN(s)||isNaN(e)) continue;
        map.set(s,{end:e,html:`<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${esc(chars.slice(s,e+1).join(''))}">`});
      }
    }
  }
  if (!map.size) return null;
  let out='',i=0;
  while(i<chars.length){if(map.has(i)){const en=map.get(i);out+=en.html;i=en.end+1;}else out+=esc(chars[i++]);}
  return out;
}

async function loadThirdPartyEmotes(channelId) {
  if (!channelId) return;
  try{const r=await fetch(`https://7tv.io/v3/users/twitch/${channelId}`);if(r.ok){const d=await r.json();((d?.emote_set?.emotes)||[]).forEach(e=>{if(!e.name||!e.data?.host?.url)return;const files=e.data.host.files||[];const f=files.find(x=>x.name==='1x.webp')||files[0];if(f)thirdPartyEmotes[e.name]='https:'+e.data.host.url+'/'+f.name;});}}catch(e){}
  try{const r=await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);if(r.ok){const d=await r.json();[...(d.channelEmotes||[]),...(d.sharedEmotes||[])].forEach(e=>{if(e.code&&e.id)thirdPartyEmotes[e.code]=`https://cdn.betterttv.net/emote/${e.id}/1x`;});}}catch(e){}
}

function injectThirdParty(text) {
  return String(text||'').split(/(\s+)/).map(tok=>{
    if(/^\s+$/.test(tok))return tok;
    return thirdPartyEmotes[tok]?`<img class="emote" src="${esc(thirdPartyEmotes[tok])}" alt="${esc(tok)}">`:esc(tok);
  }).join('');
}

function buildBadges(badges) {
  if (fd.showBadges==='no') return '';
  if (!Array.isArray(badges)||!badges.length) return '';
  const imgs=badges.map(b=>{
    if(!b) return '';
    const url=b.image_url_1x||b.imageUrl1x||b.url||b.image||'';
    return url?`<img class="badge" src="${esc(url)}" alt="" onerror="this.remove()">`:'';
  }).join('');
  return imgs?`<span class="chat-badges">${imgs}</span>`:'';
}

function buildAvatar(name, twitchColor, photoUrl) {
  if (fd.showAvatars === 'no') return '';
  const init        = esc((name || '?')[0].toUpperCase());
  const borderColor = getAvatarBorderColor(twitchColor);
  if (fd.avatarMode === 'twitch' && photoUrl) {
    return `<div class="chat-avatar" style="border-color:${esc(borderColor)};position:relative">`
         + `<img class="av-photo" src="${esc(photoUrl)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">`
         + `</div>`;
  }
  return `<div class="chat-avatar" style="border-color:${esc(borderColor)}">`
       + `<span class="av-init">${init}</span>`
       + `</div>`;
}

function renderText(data, isTest) {
  const rawText = String(data.text||data.messageRaw||(data.message&&data.message.text)||'');
  if (isTest) {
    const te=[['Kappa','25'],['LUL','425618'],['PogChamp','88'],['BibleThump','33'],['ResidentSleeper','245']];
    let out=esc(rawText);
    te.forEach(([n,id])=>{ out=out.replace(new RegExp(`\\b${escRx(n)}\\b`,'g'),`<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${n}">`); });
    return out;
  }
  const fromArray = renderEmotes(rawText, data.emotes);
  if (fromArray) return fromArray;
  const frags = data.fragments||(data.message&&data.message.fragments);
  if (Array.isArray(frags)&&frags.length) {
    return frags.map(part=>{
      if(part.type==='emote'&&part.emote?.id) return `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${part.emote.id}/default/dark/3.0" alt="${esc(part.text||'emote')}">` ;
      return esc(part.text||'');
    }).join('');
  }
  return injectThirdParty(rawText);
}

async function addMsg(data, isTest) {
  const name      = data.displayName||data.nick||data.name||'viewer';
  const twitchCol = data.displayColor||data.color||fd.usernameColor||'#a78bfa';
  const nameColor = fd.usernameColorType==='twitch' ? twitchCol : (fd.usernameColor||'#a78bfa');
  const barColor  = getBarColor(twitchCol);
  const badgesHtml = buildBadges(data.badges||[]);
  const isComic   = fd.borderStyle === 'comic';

  const emoteUrls = isTest ? [] : collectEmoteUrls(data);
  const [photoUrl] = await Promise.all([
    (fd.avatarMode === 'twitch' && !isTest) ? fetchAvatar(name) : Promise.resolve(null),
    preloadEmoteUrls(emoteUrls)
  ]);

  const textHtml = renderText(data, isTest);

  const card = document.createElement('div');
  card.className = 'chat-msg';
  if (isComic) card.classList.add('chat-msg--comic');
  card.classList.add(`anim-in-${fd.animIn || 'slideUp'}`);

  // La barre : classe de base + classe comic si besoin
  const barClass = isComic ? 'chat-bar chat-bar--comic' : 'chat-bar';

  card.innerHTML =
    buildAvatar(name, twitchCol, photoUrl) +
    `<div class="chat-body">
      <div class="chat-topline">
        <span class="chat-name" style="color:${esc(nameColor)}">${esc(name)}</span>
        ${badgesHtml}
      </div>
      <div class="chat-row">
        <div class="${barClass}" style="background:${esc(barColor)}"></div>
        <div class="chat-bubble">
          <div class="chat-text">${textHtml}</div>
        </div>
      </div>
    </div>`;

  const c = document.getElementById('chat-container');
  fd.scrollDirection==='right-to-left'?c.insertBefore(card,c.firstChild):c.appendChild(card);
  const all=[...c.querySelectorAll('.chat-msg:not(.removing)')];
  if(all.length>MAX_MSGS) all.slice(0,all.length-MAX_MSGS).forEach(el=>removeMsg(el));
  if((parseInt(fd.hideAfter)||0)>0) setTimeout(()=>removeMsg(card),fd.hideAfter*1000);
}

function removeMsg(el) {
  el.classList.add('removing');
  el.classList.add(`anim-out-${fd.animOut || 'slideDown'}`);
  setTimeout(()=>el.parentNode?.removeChild(el), 300);
}

const TEST_POOL = [
  { displayName:'Sawookie',      text:'Just subscribed! This game looks amazing!', displayColor:'#8B5CF6', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/a3259b9d-5cfb-420a-ab9c-f8579d35c883/1'},{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'StreamerVault', text:'this is a message with emotes Kappa LUL',  displayColor:'#39d353', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'NeonNinja',     text:'Welcome! Make sure to follow for more!',    displayColor:'#06B6D4', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'RocketRacer',   text:'So close! BibleThump PogChamp',             displayColor:'#1E90FF', badges:[] },
  { displayName:'PixelPirate',   text:'LUL',                                       displayColor:'#FF6B35', badges:[] },
  { displayName:'DarkWizard',    text:'GG WP ! Kappa',                             displayColor:'#9333EA', badges:[] },
  { displayName:'StarGazerXXL',  text:'ok',                                        displayColor:'#F59E0B', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/a3259b9d-5cfb-420a-ab9c-f8579d35c883/1'},{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'NightBlaze',    text:'PogChamp PogChamp on y est !!',             displayColor:'#EC4899', badges:[] },
];

function startTestMessages() {
  stopTestMessages();
  for(let i=0;i<MAX_MSGS;i++) setTimeout(()=>addMsg(TEST_POOL[i%TEST_POOL.length],true),i*350);
}
function stopTestMessages() {
  const c=document.getElementById('chat-container');
  if(c)[...c.querySelectorAll('.chat-msg')].forEach(el=>removeMsg(el));
}

window.addEventListener('onWidgetLoad', obj => {
  widgetLoaded = true;
  fd = obj?.detail?.fieldData || {};
  applyVars();
  const ch = obj?.detail?.channel;
  if (ch?.providerId) loadThirdPartyEmotes(ch.providerId);
  if (fd.enableTestMessages===true||fd.enableTestMessages==='true') startTestMessages();
});

window.addEventListener('onWidgetLoad', obj => {
  const newFd = obj?.detail?.fieldData;
  if (!newFd || !widgetLoaded) return;
  fd = newFd;
  applyVars();
  if (fd.enableTestMessages===true||fd.enableTestMessages==='true') startTestMessages();
  else stopTestMessages();
});

window.addEventListener('load', () => { setTimeout(()=>{ if(!widgetLoaded) applyVars(); }, 400); });

window.addEventListener('onEventReceived', obj => {
  const listener=obj?.detail?.listener, event=obj?.detail?.event||{}, data=event.data||event;
  if (listener!=='message') return;
  if (fd.hideCommands==='yes'&&String(data.text||'').startsWith('!')) return;
  addMsg(data, false);
});

document.addEventListener('DOMContentLoaded', applyVars);
