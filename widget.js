/*
 ================================================================
  Horizontal Twitch Chat — StreamElements Widget
  Basé sur la structure réelle SE (copiée depuis chat-flow):

  onEventReceived:
    obj.detail.listener = 'message'
    obj.detail.event    = { data: { ... } }  ← ou directement event

  Champs du message (dans data = event.data || event) :
    data.displayName || data.nick || data.name  → pseudo affiché
    data.displayColor || data.color             → couleur twitch
    data.text                                   → texte brut
    data.emotes   → [{id, start, end, urls:{1,2,4}}]  (tableau)
    data.badges   → [{image_url_1x, imageUrl1x, url, image}]
 ================================================================
*/

let fd = {};
let thirdPartyEmotes = {};
let widgetLoaded = false;
let testTimer = null;

const MAX_MSGS = 8;

// ── helpers ──────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// ── CSS vars ─────────────────────────────────────────────────
function applyVars() {
  // Chargement dynamique Google Font
  let lnk = document.getElementById('_gf');
  if (!lnk) {
    lnk = document.createElement('link');
    lnk.id = '_gf'; lnk.rel = 'stylesheet';
    document.head.appendChild(lnk);
  }
  const font = fd.googleFont || 'Barlow Condensed';
  lnk.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g,'+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

  const R = document.documentElement;
  const set = (k,v) => R.style.setProperty(k,v);
  set('--font',         `'${font}', sans-serif`);
  set('--av-size',      (fd.avatarSize   || 62)  + 'px');
  set('--av-bg',         fd.avatarInitialsBg     || '#AA4DDA');
  set('--av-color',      fd.avatarInitialsColor  || '#ffffff');
  set('--av-border',     fd.avatarBorderColor    || 'rgba(255,255,255,0.85)');
  set('--badge-sz',     (fd.badgeSize    || 20)  + 'px');
  set('--name-color',    fd.usernameColor        || '#039BEF');
  set('--name-size',    (fd.usernameFontSize || 22) + 'px');
  set('--name-transform',
    fd.usernameTransform === 'uppercase' ? 'uppercase' :
    fd.usernameTransform === 'lowercase' ? 'lowercase' : 'none');
  set('--msg-color',     fd.messageColor         || '#CDEDF2');
  set('--msg-size',     (fd.messageFontSize || 20) + 'px');
  set('--msg-bg',        fd.messageBg            || 'rgba(10,16,40,0.85)');
  set('--border-w',     (fd.borderWidth   || 12)  + 'px');
  set('--border-col',    fd.borderColor          || '#039BEF');
  set('--gap',          (fd.spacing       || 12)  + 'px');

  const c = document.getElementById('chat-container');
  if (c) c.style.flexDirection =
    fd.scrollDirection === 'right-to-left' ? 'row-reverse' : 'row';
}

// ── Emotes Twitch (tableau SE : [{id,start,end,urls}]) ───────
function renderEmotes(text, emotes) {
  const chars = Array.from(String(text || ''));
  const map = new Map();

  if (Array.isArray(emotes)) {
    // Format moderne SE : tableau d'objets
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
    // Format legacy : { "id": ["start-end"] }
    for (const [id, positions] of Object.entries(emotes)) {
      const list = Array.isArray(positions) ? positions : String(positions).split('/');
      for (const p of list) {
        const [s, e] = String(p).split('-').map(Number);
        if (isNaN(s) || isNaN(e)) continue;
        const url = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0`;
        map.set(s, { end: e, html: `<img class="emote" src="${esc(url)}" alt="${esc(chars.slice(s,e+1).join(''))}" onerror="this.remove()">` });
      }
    }
  }

  if (!map.size) return null; // pas d'emotes → retourner null pour fallback

  let out = '', i = 0;
  while (i < chars.length) {
    if (map.has(i)) { const en = map.get(i); out += en.html; i = en.end + 1; }
    else out += esc(chars[i++]);
  }
  return out;
}

// ── Emotes tierces (BTTV/FFZ/7TV) ───────────────────────────
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

// ── Badges ───────────────────────────────────────────────────
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

// ── Avatar ───────────────────────────────────────────────────
function buildAvatar(name, imgUrl) {
  if (fd.showAvatars === 'no') return '';
  const init = esc((name || '?')[0].toUpperCase());
  const mode = fd.avatarMode || 'twitch';
  let inner;
  if (mode === 'twitch' && imgUrl) {
    inner = `<img src="${esc(imgUrl)}" alt="${esc(name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          + `<span class="av-init" style="display:none">${init}</span>`;
  } else {
    inner = `<span class="av-init">${init}</span>`;
  }
  return `<div class="chat-avatar">${inner}</div>`;
}

// ── Rendu texte (reprend exactement la logique de chat-flow) ─
function renderText(data, isTest) {
  const rawText = String(data.text || data.messageRaw || (data.message && data.message.text) || '');

  if (isTest) {
    // remplace Kappa LUL etc. pour les messages de test
    const testEmotes = [['Kappa','25'],['LUL','425618'],['PogChamp','88'],['BibleThump','33'],['ResidentSleeper','245']];
    let out = esc(rawText);
    testEmotes.forEach(([name, id]) => {
      out = out.replace(
        new RegExp(`\\b${escRx(name)}\\b`, 'g'),
        `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${name}" onerror="this.remove()">`
      );
    });
    return out;
  }

  // 1) Essayer le format tableau d'emotes (SE moderne)
  const fromArray = renderEmotes(rawText, data.emotes);
  if (fromArray) return fromArray;

  // 2) Essayer fragments (format message.fragments)
  const frags = data.fragments || (data.message && data.message.fragments);
  if (Array.isArray(frags) && frags.length) {
    return frags.map(part => {
      if (part.type === 'emote' && part.emote && part.emote.id) {
        const url = `https://static-cdn.jtvnw.net/emoticons/v2/${part.emote.id}/default/dark/3.0`;
        return `<img class="emote" src="${esc(url)}" alt="${esc(part.text||'emote')}" onerror="this.remove()">`;
      }
      return esc(part.text || '');
    }).join('');
  }

  // 3) Fallback : texte brut + emotes tierces
  return injectThirdParty(rawText);
}

// ── Ajout d'un message ───────────────────────────────────────
function addMsg(data, isTest) {
  const name  = data.displayName || data.nick || data.name || 'viewer';
  const color = fd.usernameColorType === 'twitch'
    ? (data.displayColor || data.color || fd.usernameColor || '#039BEF')
    : (fd.usernameColor || '#039BEF');
  const imgUrl = data.profileImageURL || data.profileImage || data.avatar || '';

  const card = document.createElement('div');
  card.className = 'chat-msg';
  card.innerHTML =
    buildAvatar(name, imgUrl) +
    `<div class="chat-bubble">
      <div class="chat-meta">
        ${buildBadges(data.badges || [])}
        <span class="chat-name" style="color:${esc(color)}">${esc(name)}</span>
      </div>
      <div class="chat-text">${renderText(data, isTest)}</div>
    </div>`;

  const c = document.getElementById('chat-container');
  fd.scrollDirection === 'right-to-left'
    ? c.insertBefore(card, c.firstChild)
    : c.appendChild(card);

  // Supprimer les anciens messages si trop
  const all = [...c.querySelectorAll('.chat-msg:not(.removing)')];
  if (all.length > MAX_MSGS) {
    all.slice(0, all.length - MAX_MSGS).forEach(el => removeMsg(el));
  }

  if ((fd.hideAfter || 0) > 0) {
    setTimeout(() => removeMsg(card), fd.hideAfter * 1000);
  }
}

function removeMsg(el) {
  el.classList.add('removing');
  setTimeout(() => el.parentNode?.removeChild(el), 350);
}

// ── Messages de test ─────────────────────────────────────────
function startTestMessages() {
  stopTestMessages();
  const samples = [
    { displayName:'StreamerVault', text:'this is a message with emotes Kappa LUL',  displayColor:'#39d353', badges:[] },
    { displayName:'Sawookie',      text:'Just subscribed! This game looks amazing!',  displayColor:'#8B5CF6', badges:[] },
    { displayName:'NeonNinja',     text:'Welcome to the stream! Make sure to follow for more content!', displayColor:'#ff4fd8', badges:[] },
    { displayName:'RocketRacer',   text:'So close! BibleThump PogChamp',              displayColor:'#1E90FF', badges:[] },
    { displayName:'PixelPirate',   text:'LUL ce stream est incroyable ResidentSleeper', displayColor:'#FF6B35', badges:[] },
  ];
  let i = 0;
  samples.forEach((s, idx) => setTimeout(() => addMsg(s, true), idx * 400));
  testTimer = setInterval(() => {
    addMsg(samples[i % samples.length], true);
    i++;
  }, 2500);
}

function stopTestMessages() {
  if (testTimer) { clearInterval(testTimer); testTimer = null; }
}

// ── StreamElements Events ────────────────────────────────────
window.addEventListener('onWidgetLoad', obj => {
  widgetLoaded = true;
  fd = obj?.detail?.fieldData || {};
  applyVars();

  // Charger emotes tierces
  const ch = obj?.detail?.channel;
  if (ch?.providerId) loadThirdPartyEmotes(ch.providerId);

  if (fd.enableTestMessages === 'yes') startTestMessages();
});

// fallback si SE ne déclenche pas onWidgetLoad (preview navigateur)
window.addEventListener('load', () => {
  setTimeout(() => { if (!widgetLoaded) { applyVars(); } }, 400);
});

window.addEventListener('onEventReceived', obj => {
  const listener = obj?.detail?.listener;
  /*
   * ⚠️ Structure réelle SE :
   * obj.detail.event peut contenir { data: {...} } ou être directement les données
   */
  const event = obj?.detail?.event || {};
  const data  = event.data || event; // ← CRUCIAL : chat-flow fait exactement ça

  if (listener !== 'message') return;

  const text = String(data.text || '');
  if (fd.hideCommands === 'yes' && text.startsWith('!')) return;

  addMsg(data, false);
});

document.addEventListener('DOMContentLoaded', applyVars);
