/*
 ================================================================
  Horizontal Twitch Chat — StreamElements Widget
  Structure SE réelle (basée sur chat-flow) :
    data = event.data || event
    data.displayName || data.nick || data.name
    data.displayColor || data.color
    data.emotes → [{id,start,end,urls}] ou {id:["s-e"]}
    data.badges → [{image_url_1x, imageUrl1x, url, image}]

  DOM généré par addMsg :
    .chat-msg
      .chat-avatar     ← carré bords arrondis (si activé)
      .chat-bar        ← barre verticale colorée
      .chat-bubble
        .chat-topline  ← [pseudo gauche] [badges droite]
        .chat-text     ← message
 ================================================================
*/

let fd = {};
let thirdPartyEmotes = {};
let widgetLoaded = false;
let testTimer = null;
let MAX_MSGS = 6;

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// ── CSS vars ──────────────────────────────────────────────────
function applyVars() {
  MAX_MSGS = Math.max(1, parseInt(fd.maxMessages) || 6);

  let lnk = document.getElementById('_gf');
  if (!lnk) {
    lnk = document.createElement('link');
    lnk.id = '_gf'; lnk.rel = 'stylesheet';
    document.head.appendChild(lnk);
  }
  const font = fd.googleFont || 'Barlow Condensed';
  lnk.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:ital,wght@0,400;1,400;1,700;1,800&display=swap`;

  const R = document.documentElement;
  const set = (k, v) => R.style.setProperty(k, v);
  set('--font',           `'${font}', sans-serif`);
  set('--av-size',        (parseInt(fd.avatarSize)       || 58) + 'px');
  set('--av-radius',      (parseInt(fd.avatarRadius)     || 10) + 'px');
  set('--av-bg',           fd.avatarInitialsBg           || '#7C3AED');
  set('--av-color',        fd.avatarInitialsColor        || '#ffffff');
  set('--bar-w',          (parseInt(fd.borderWidth)      ||  5) + 'px');
  // --bar-col sera mis à jour par addMsg selon la couleur du viewer
  // mais on met la valeur par défaut ici
  set('--bar-col',         fd.borderColor                || '#539ef7');
  set('--badge-sz',       (parseInt(fd.badgeSize)        || 17) + 'px');
  set('--name-color',      fd.usernameColor              || '#a78bfa');
  set('--name-size',      (parseInt(fd.usernameFontSize) || 20) + 'px');
  set('--name-transform',
    fd.usernameTransform === 'uppercase' ? 'uppercase' :
    fd.usernameTransform === 'lowercase' ? 'lowercase' : 'none');
  set('--msg-color',       fd.messageColor               || '#dde9f7');
  set('--msg-size',       (parseInt(fd.messageFontSize)  || 18) + 'px');
  set('--msg-bg',          fd.messageBg                  || 'rgba(15,18,45,0.82)');
  set('--gap',            (parseInt(fd.spacing)          || 14) + 'px');

  const c = document.getElementById('chat-container');
  if (c) c.style.flexDirection =
    fd.scrollDirection === 'right-to-left' ? 'row-reverse' : 'row';
}

// ── Emotes Twitch ─────────────────────────────────────────────
function renderEmotes(text, emotes) {
  const chars = Array.from(String(text || ''));
  const map = new Map();
  if (Array.isArray(emotes)) {
    emotes.forEach(em => {
      const url = em.urls
        ? (em.urls['2'] || em.urls['1'] || em.urls['4'] || Object.values(em.urls)[0] || '')
        : (em.id ? `https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/3.0` : '');
      if (!url) return;
      const s = Number(em.start !== undefined ? em.start : em.startIndex);
      const e = Number(em.end   !== undefined ? em.end   : em.endIndex);
      if (isNaN(s) || isNaN(e)) return;
      map.set(s, { end: e, html: `<img class="emote" src="${esc(url)}" alt="${esc(chars.slice(s,e+1).join(''))}" onerror="this.remove()">` });
    });
  } else if (emotes && typeof emotes === 'object') {
    for (const [id, positions] of Object.entries(emotes)) {
      const list = Array.isArray(positions) ? positions : String(positions).split('/');
      for (const p of list) {
        const [s, e] = String(p).split('-').map(Number);
        if (isNaN(s) || isNaN(e)) continue;
        map.set(s, { end: e, html: `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${esc(chars.slice(s,e+1).join(''))}" onerror="this.remove()">` });
      }
    }
  }
  if (!map.size) return null;
  let out = '', i = 0;
  while (i < chars.length) {
    if (map.has(i)) { const en = map.get(i); out += en.html; i = en.end + 1; }
    else out += esc(chars[i++]);
  }
  return out;
}

// ── Emotes tierces (BTTV/7TV) ─────────────────────────────────
async function loadThirdPartyEmotes(channelId) {
  if (!channelId) return;
  try {
    const r = await fetch(`https://7tv.io/v3/users/twitch/${channelId}`);
    if (r.ok) {
      const d = await r.json();
      ((d?.emote_set?.emotes) || []).forEach(e => {
        if (!e.name || !e.data?.host?.url) return;
        const files = e.data.host.files || [];
        const f = files.find(x => x.name === '1x.webp') || files[0];
        if (f) thirdPartyEmotes[e.name] = 'https:' + e.data.host.url + '/' + f.name;
      });
    }
  } catch(e) {}
  try {
    const r = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);
    if (r.ok) {
      const d = await r.json();
      [...(d.channelEmotes||[]), ...(d.sharedEmotes||[])].forEach(e => {
        if (e.code && e.id) thirdPartyEmotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
      });
    }
  } catch(e) {}
}

function injectThirdParty(text) {
  return String(text || '').split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    return thirdPartyEmotes[tok]
      ? `<img class="emote" src="${esc(thirdPartyEmotes[tok])}" alt="${esc(tok)}" onerror="this.remove()">`
      : esc(tok);
  }).join('');
}

// ── Badges ────────────────────────────────────────────────────
function buildBadges(badges) {
  if (fd.showBadges === 'no') return '';
  if (!Array.isArray(badges) || !badges.length) return '';
  const imgs = badges.map(b => {
    if (!b) return '';
    const url = b.image_url_1x || b.imageUrl1x || b.url || b.image || '';
    return url ? `<img class="badge" src="${esc(url)}" alt="" onerror="this.remove()">` : '';
  }).join('');
  return imgs ? `<span class="chat-badges">${imgs}</span>` : '';
}

// ── Avatar ────────────────────────────────────────────────────
function buildAvatar(name, imgUrl) {
  if (fd.showAvatars === 'no') return '';
  const init = esc((name || '?')[0].toUpperCase());
  let inner;
  if ((fd.avatarMode || 'initials') !== 'initials' && imgUrl) {
    inner = `<img src="${esc(imgUrl)}" alt="${esc(name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          + `<span class="av-init" style="display:none">${init}</span>`;
  } else {
    // Par défaut : initiale (comme sur le screen)
    inner = `<span class="av-init">${init}</span>`;
  }
  return `<div class="chat-avatar">${inner}</div>`;
}

// ── Rendu texte ───────────────────────────────────────────────
function renderText(data, isTest) {
  const rawText = String(data.text || data.messageRaw || (data.message && data.message.text) || '');
  if (isTest) {
    const testEmotes = [['Kappa','25'],['LUL','425618'],['PogChamp','88'],['BibleThump','33'],['ResidentSleeper','245']];
    let out = esc(rawText);
    testEmotes.forEach(([name, id]) => {
      out = out.replace(new RegExp(`\\b${escRx(name)}\\b`, 'g'),
        `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${name}" onerror="this.remove()">`);
    });
    return out;
  }
  const fromArray = renderEmotes(rawText, data.emotes);
  if (fromArray) return fromArray;
  const frags = data.fragments || (data.message && data.message.fragments);
  if (Array.isArray(frags) && frags.length) {
    return frags.map(part => {
      if (part.type === 'emote' && part.emote?.id)
        return `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${part.emote.id}/default/dark/3.0" alt="${esc(part.text||'emote')}" onerror="this.remove()">`;
      return esc(part.text || '');
    }).join('');
  }
  return injectThirdParty(rawText);
}

// ── Ajout d'un message ────────────────────────────────────────
// DOM : .chat-msg > [.chat-avatar] + .chat-bar + .chat-bubble(.chat-topline + .chat-text)
function addMsg(data, isTest) {
  const name    = data.displayName || data.nick || data.name || 'viewer';
  // Couleur : twitch color du viewer OU couleur custom
  const color   = fd.usernameColorType === 'twitch'
    ? (data.displayColor || data.color || fd.usernameColor || '#a78bfa')
    : (fd.usernameColor || '#a78bfa');
  const imgUrl  = data.profileImageURL || data.profileImage || data.avatar || '';
  const badgesHtml = buildBadges(data.badges || []);

  const card = document.createElement('div');
  card.className = 'chat-msg';
  card.innerHTML =
    // Avatar (carré bords arrondis, initiale par défaut)
    buildAvatar(name, imgUrl) +
    // Barre verticale — couleur du pseudo
    `<div class="chat-bar" style="background:${esc(color)}"></div>` +
    // Bulle fond sombre
    `<div class="chat-bubble">
      <div class="chat-topline">
        <span class="chat-name" style="color:${esc(color)}">${esc(name)}</span>
        ${badgesHtml}
      </div>
      <div class="chat-text">${renderText(data, isTest)}</div>
    </div>`;

  const c = document.getElementById('chat-container');
  fd.scrollDirection === 'right-to-left'
    ? c.insertBefore(card, c.firstChild)
    : c.appendChild(card);

  const all = [...c.querySelectorAll('.chat-msg:not(.removing)')];
  if (all.length > MAX_MSGS)
    all.slice(0, all.length - MAX_MSGS).forEach(el => removeMsg(el));

  if ((parseInt(fd.hideAfter) || 0) > 0)
    setTimeout(() => removeMsg(card), fd.hideAfter * 1000);
}

function removeMsg(el) {
  el.classList.add('removing');
  setTimeout(() => el.parentNode?.removeChild(el), 350);
}

// ── Messages de test ──────────────────────────────────────────
const TEST_POOL = [
  { displayName:'Sawookie',      text:'Just subscribed! This game looks amazing!',            displayColor:'#8B5CF6', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/a3259b9d-5cfb-420a-ab9c-f8579d35c883/1'},{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'StreamerVault', text:'this is a message with emotes Kappa LUL',             displayColor:'#39d353', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'NeonNinja',     text:'Welcome to the stream! Make sure to follow for more!', displayColor:'#06B6D4', badges:[{image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/1'}] },
  { displayName:'RocketRacer',   text:'So close! BibleThump PogChamp',                        displayColor:'#1E90FF', badges:[] },
  { displayName:'PixelPirate',   text:'LUL ce stream est incroyable ResidentSleeper',          displayColor:'#FF6B35', badges:[] },
  { displayName:'DarkWizard',    text:'GG WP ! Kappa tu gères vraiment bien',                 displayColor:'#9333EA', badges:[] },
  { displayName:'StarGazer',     text:'Premier message ici, super stream !',                   displayColor:'#F59E0B', badges:[] },
  { displayName:'NightBlaze',    text:'PogChamp PogChamp PogChamp on y est !!',                displayColor:'#EC4899', badges:[] },
];

function startTestMessages() {
  stopTestMessages();
  for (let i = 0; i < MAX_MSGS; i++)
    setTimeout(() => addMsg(TEST_POOL[i % TEST_POOL.length], true), i * 350);
}

function stopTestMessages() {
  if (testTimer) { clearInterval(testTimer); testTimer = null; }
  const c = document.getElementById('chat-container');
  if (c) [...c.querySelectorAll('.chat-msg')].forEach(el => removeMsg(el));
}

// ── StreamElements Events ─────────────────────────────────────
window.addEventListener('onWidgetLoad', obj => {
  widgetLoaded = true;
  fd = obj?.detail?.fieldData || {};
  applyVars();
  const ch = obj?.detail?.channel;
  if (ch?.providerId) loadThirdPartyEmotes(ch.providerId);
  if (fd.enableTestMessages === 'yes') startTestMessages();
});

window.addEventListener('load', () => {
  setTimeout(() => { if (!widgetLoaded) applyVars(); }, 400);
});

window.addEventListener('onEventReceived', obj => {
  const listener = obj?.detail?.listener;
  const event    = obj?.detail?.event || {};
  const data     = event.data || event;
  if (listener !== 'message') return;
  const text = String(data.text || '');
  if (fd.hideCommands === 'yes' && text.startsWith('!')) return;
  addMsg(data, false);
});

document.addEventListener('DOMContentLoaded', applyVars);
