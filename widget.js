/* ==========================================================
   Horizontal Twitch Chat — StreamElements Custom Widget
   Fixes: correct SE event fields (nick, badges, emotes…)
   ========================================================== */

// ─── defaults (overridden by onWidgetLoad) ───────────────────
const CFG = {
  hideAfter:          0,
  hideCommands:      'yes',
  showAvatars:       'yes',
  fitContent:        'yes',
  avatarMode:        'twitch',
  avatarSize:         60,
  avatarBg:          '#AA4DDA',
  avatarInitColor:   '#FFFFFF',
  avatarBorder:      '#FFFFFF',
  showBadges:        'yes',
  badgeSize:          25,
  nameTransform:     'default',
  nameColorType:     'custom',
  nameColor:         '#039BEF',
  nameShadow:        'rgba(255,255,255,0)',
  msgColor:          '#CDEDF2',
  msgBg:             'rgba(0,0,0,0.55)',
  nameSize:           25,
  msgSize:            25,
  borderW:            13,
  borderCol:         '#039BEF',
  direction:         'ltr',
  font:              'Barlow Condensed',
  spacing:            15
};

const MAX = 8;
const container = () => document.getElementById('chat-container');

// ─── CSS vars ────────────────────────────────────────────────
function applyVars() {
  const r = document.documentElement;
  // Dynamic font load
  let lnk = document.getElementById('_gf');
  if (!lnk) { lnk = document.createElement('link'); lnk.id='_gf'; lnk.rel='stylesheet'; document.head.appendChild(lnk); }
  lnk.href = `https://fonts.googleapis.com/css2?family=${CFG.font.replace(/ /g,'+')}:ital,wght@0,400;0,700;1,700&display=swap`;

  const set = (k,v) => r.style.setProperty(k, v);
  set('--font',           `'${CFG.font}', sans-serif`);
  set('--avatar-size',    CFG.avatarSize + 'px');
  set('--avatar-bg',      CFG.avatarBg);
  set('--avatar-initials-color', CFG.avatarInitColor);
  set('--avatar-border',  CFG.avatarBorder);
  set('--badge-size',     CFG.badgeSize + 'px');
  set('--name-color',     CFG.nameColor);
  set('--name-size',      CFG.nameSize + 'px');
  set('--name-transform', CFG.nameTransform === 'uppercase' ? 'uppercase' : CFG.nameTransform === 'lowercase' ? 'lowercase' : 'none');
  set('--name-shadow',    CFG.nameShadow !== 'rgba(255,255,255,0)' ? `1px 1px 4px ${CFG.nameShadow}` : 'none');
  set('--msg-color',      CFG.msgColor);
  set('--msg-size',       CFG.msgSize + 'px');
  set('--msg-bg',         CFG.msgBg);
  set('--border-w',       CFG.borderW + 'px');
  set('--border-col',     CFG.borderCol);
  set('--spacing',        CFG.spacing + 'px');

  const c = container();
  if (c) c.style.flexDirection = CFG.direction === 'rtl' ? 'row-reverse' : 'row';
}

// ─── Helpers ─────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// ─── Emote parsers ───────────────────────────────────────────
// StreamElements gives emotes as: { "emoteId": ["start-end", …] }
function parseTwitchEmotes(text, emotes) {
  if (!emotes || !Object.keys(emotes).length) return esc(text);
  const reps = [];
  for (const [id, positions] of Object.entries(emotes)) {
    const list = Array.isArray(positions) ? positions : String(positions).split('/');
    for (const p of list) {
      const [s, e] = String(p).split('-').map(Number);
      if (isNaN(s) || isNaN(e)) continue;
      reps.push({ s, e, id, name: [...text].slice(s, e + 1).join('') });
    }
  }
  reps.sort((a,b) => a.s - b.s);
  let out = '', last = 0;
  // use [...text] to handle multi-byte chars correctly
  const chars = [...text];
  for (const r of reps) {
    if (r.s > last) out += esc(chars.slice(last, r.s).join(''));
    out += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0" alt="${esc(r.name)}" title="${esc(r.name)}" />`;
    last = r.e + 1;
  }
  if (last < chars.length) out += esc(chars.slice(last).join(''));
  return out;
}

function parseThirdParty(html, set) {
  if (!set || !set.length) return html;
  for (const e of set) {
    const url = (e.urls && (e.urls['2'] || e.urls['1'])) || e.url || '';
    if (!url || !e.name) continue;
    const rx = new RegExp('(?<![\\w])' + escRx(e.name) + '(?![\\w])', 'g');
    html = html.replace(rx, `<img class="emote" src="${url}" alt="${esc(e.name)}" title="${esc(e.name)}" />`);
  }
  return html;
}

// ─── Badge builder ───────────────────────────────────────────
// SE sends badges as array of {type, version, url, description}
function buildBadges(badges) {
  if (CFG.showBadges !== 'yes' || !Array.isArray(badges) || !badges.length) return '';
  return '<span class="msg-badges">' +
    badges.filter(b => b && b.url).map(b =>
      `<img src="${b.url}" alt="${esc(b.type||'')}" title="${esc(b.description||b.type||'')}" />`
    ).join('') + '</span>';
}

// ─── Avatar builder ──────────────────────────────────────────
function buildAvatar(nick, profileImg) {
  if (CFG.showAvatars !== 'yes') return '';
  const initial = esc((nick || '?')[0].toUpperCase());
  let inner;
  if (CFG.avatarMode === 'twitch' && profileImg) {
    // show image, fallback to initials on error
    inner = `<img src="${profileImg}" alt="${esc(nick)}" `
          + `onerror="this.parentNode.innerHTML='<span class=initials>${initial}</span>'" />`;
  } else {
    inner = `<span class="initials">${initial}</span>`;
  }
  return `<div class="msg-avatar">${inner}</div>`;
}

// ─── Main card builder ───────────────────────────────────────
/*
  StreamElements message event fields:
  data.nick          — lowercase username
  data.displayName   — display name (may differ in casing)
  data.text          — raw message text
  data.emotes        — { emoteId: ["start-end"] }
  data.emoteSet      — 3rd party emotes array
  data.badges        — badge array
  data.color         — user chat color
  data.profileImage  — profile picture URL (added by SE)
*/
function addMessage(data) {
  const nick = data.displayName || data.nick || data.name || 'User';
  const color = (CFG.nameColorType === 'twitch' && data.color) ? data.color : CFG.nameColor;

  let msgHtml = parseTwitchEmotes(data.text || '', data.emotes || {});
  msgHtml = parseThirdParty(msgHtml, data.emoteSet || []);

  const card = document.createElement('div');
  card.className = 'chat-msg' + (CFG.fitContent === 'yes' ? ' fit' : '');

  card.innerHTML =
    buildAvatar(nick, data.profileImage || data.avatar || '') +
    `<div class="msg-bubble">
      <div class="msg-meta">
        ${buildBadges(data.badges || [])}
        <span class="msg-name" style="color:${color}">${esc(nick)}</span>
      </div>
      <div class="msg-text">${msgHtml}</div>
    </div>`;

  const c = container();
  if (CFG.direction === 'rtl') c.insertBefore(card, c.firstChild);
  else c.appendChild(card);

  trim();

  if (CFG.hideAfter > 0) setTimeout(() => drop(card), CFG.hideAfter * 1000);
}

function trim() {
  const c = container();
  const msgs = [...c.querySelectorAll('.chat-msg:not(.out)')];
  if (msgs.length > MAX) msgs.slice(0, msgs.length - MAX).forEach(drop);
}

function drop(el) {
  el.classList.add('out');
  setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 350);
}

// ─── StreamElements API ──────────────────────────────────────
window.addEventListener('onWidgetLoad', obj => {
  const fd = obj.detail.fieldData;
  if (!fd) return;
  CFG.hideAfter       = parseInt(fd.hideAfter)      || 0;
  CFG.hideCommands    = fd.hideCommands              || 'yes';
  CFG.showAvatars     = fd.showAvatars               || 'yes';
  CFG.fitContent      = fd.fitContentWidth           || 'yes';
  CFG.avatarMode      = fd.avatarMode                || 'twitch';
  CFG.avatarSize      = parseInt(fd.avatarSize)      || 60;
  CFG.avatarBg        = fd.avatarInitialsBg          || '#AA4DDA';
  CFG.avatarInitColor = fd.avatarInitialsColor       || '#FFFFFF';
  CFG.avatarBorder    = fd.avatarBorderColor         || '#FFFFFF';
  CFG.showBadges      = fd.showBadges                || 'yes';
  CFG.badgeSize       = parseInt(fd.badgeSize)       || 25;
  CFG.nameTransform   = fd.usernameTransform         || 'default';
  CFG.nameColorType   = fd.usernameColorType         || 'custom';
  CFG.nameColor       = fd.usernameColor             || '#039BEF';
  CFG.nameShadow      = fd.usernameShadowColor       || 'rgba(255,255,255,0)';
  CFG.msgColor        = fd.messageColor              || '#CDEDF2';
  CFG.msgBg           = fd.messageBg                || 'rgba(0,0,0,0.55)';
  CFG.nameSize        = parseInt(fd.usernameFontSize)|| 25;
  CFG.msgSize         = parseInt(fd.messageFontSize) || 25;
  CFG.borderW         = parseInt(fd.borderWidth)     || 13;
  CFG.borderCol       = fd.borderColor               || '#039BEF';
  CFG.direction       = fd.scrollDirection === 'right-to-left' ? 'rtl' : 'ltr';
  CFG.font            = fd.googleFont                || 'Barlow Condensed';
  CFG.spacing         = parseInt(fd.spacing)         || 15;
  applyVars();
});

window.addEventListener('onEventReceived', obj => {
  const { listener, event } = obj.detail;
  // SE uses listener = 'message' for chat messages
  if (listener !== 'message') return;
  if (CFG.hideCommands === 'yes' && event.text && event.text.startsWith('!')) return;
  addMessage(event);
});

document.addEventListener('DOMContentLoaded', applyVars);
