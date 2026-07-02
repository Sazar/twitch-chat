/*
  ╔══════════════════════════════════════════════════════════╗
  ║   Horizontal Twitch Chat — StreamElements Widget v3      ║
  ╚══════════════════════════════════════════════════════════╝
*/

const CFG = {
  hideAfter: 0,
  hideCmds: true,
  showAvatars: true,
  fitContent: true,
  avatarMode: 'twitch',
  avSize: 62,
  avBg: '#AA4DDA',
  avInitColor: '#ffffff',
  avBorder: 'rgba(255,255,255,0.9)',
  showBadges: true,
  badgeSz: 20,
  nameTransform: 'none',
  nameColorType: 'custom',
  nameColor: '#039BEF',
  nameShadow: '',
  msgColor: '#CDEDF2',
  msgBg: 'rgba(15,20,45,0.82)',
  nameSz: 22,
  msgSz: 20,
  borderW: 12,
  borderCol: '#039BEF',
  rtl: false,
  font: 'Barlow Condensed',
  gap: 12,
  maxMsgs: 8,
  enableTestMessages: false
};

let testTimer = null;

const esc = s => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function applyVars() {
  let lnk = document.getElementById('_gf');
  if (!lnk) {
    lnk = document.createElement('link');
    lnk.id = '_gf';
    lnk.rel = 'stylesheet';
    document.head.appendChild(lnk);
  }
  lnk.href = `https://fonts.googleapis.com/css2?family=${CFG.font.replace(/ /g,'+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

  const R = document.documentElement;
  const s = (k,v) => R.style.setProperty(k,v);
  s('--font', `'${CFG.font}',sans-serif`);
  s('--av-size', CFG.avSize+'px');
  s('--av-bg', CFG.avBg);
  s('--av-color', CFG.avInitColor);
  s('--av-border', CFG.avBorder);
  s('--badge-sz', CFG.badgeSz+'px');
  s('--name-color', CFG.nameColor);
  s('--name-size', CFG.nameSz+'px');
  s('--msg-color', CFG.msgColor);
  s('--msg-size', CFG.msgSz+'px');
  s('--msg-bg', CFG.msgBg);
  s('--border-w', CFG.borderW+'px');
  s('--border-col', CFG.borderCol);
  s('--gap', CFG.gap+'px');

  const c = document.getElementById('chat-container');
  if (c) c.style.flexDirection = CFG.rtl ? 'row-reverse' : 'row';
}

function parseTwitchEmotes(text, emotes) {
  if (!emotes) return esc(text);
  const reps = [];

  if (Array.isArray(emotes)) {
    for (const e of emotes) {
      reps.push({ s: e.start ?? e.startIndex, e: e.end ?? e.endIndex, id: e.id, name: e.name });
    }
  } else if (typeof emotes === 'object') {
    for (const [id, positions] of Object.entries(emotes)) {
      const list = Array.isArray(positions) ? positions : String(positions).split('/');
      for (const p of list) {
        const [s, e] = String(p).split('-').map(Number);
        if (!isNaN(s) && !isNaN(e)) {
          const chars = [...text];
          reps.push({ s, e, id, name: chars.slice(s, e+1).join('') });
        }
      }
    }
  }

  if (!reps.length) return esc(text);
  reps.sort((a,b) => a.s - b.s);

  const chars = [...text];
  let out = '', last = 0;
  for (const r of reps) {
    if (r.s > last) out += esc(chars.slice(last, r.s).join(''));
    out += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0" alt="${esc(r.name)}" title="${esc(r.name)}"/>`;
    last = r.e + 1;
  }
  if (last < chars.length) out += esc(chars.slice(last).join(''));
  return out;
}

function parseThirdParty(html, emoteSet) {
  if (!Array.isArray(emoteSet)) return html;
  for (const e of emoteSet) {
    if (!e || !e.name) continue;
    const url = (e.urls && (e.urls['2'] || e.urls['1'])) || e.url || '';
    if (!url) continue;
    const rx = new RegExp('(?<![^\\s<>])' + escRx(e.name) + '(?![^\\s<>])', 'g');
    html = html.replace(rx, `<img class="emote" src="${url}" alt="${esc(e.name)}" title="${esc(e.name)}"/>`);
  }
  return html;
}

function buildBadges(badges) {
  if (!CFG.showBadges || !Array.isArray(badges) || !badges.length) return '';
  const imgs = badges
    .filter(b => b)
    .map(b => {
      const url = b.url || b.image_url || '';
      if (!url) return '';
      return `<img src="${url}" alt="${esc(b.type||b.id||'')}" title="${esc(b.description||b.type||'')}"/>`;
    }).join('');
  return imgs ? `<span class="chat-badges">${imgs}</span>` : '';
}

function buildAvatar(nick, imgUrl) {
  if (!CFG.showAvatars) return '';
  const init = esc((nick||'?')[0].toUpperCase());
  let inner;
  if (CFG.avatarMode === 'twitch' && imgUrl) {
    inner = `<img src="${imgUrl}" alt="${esc(nick)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span class="av-init" style="display:none">${init}</span>`;
  } else {
    inner = `<span class="av-init">${init}</span>`;
  }
  return `<div class="chat-avatar">${inner}</div>`;
}

function addMsg(ev) {
  const name = ev.displayName || ev.display_name || ev.nick || ev.username || ev.name || 'Chat';
  const text = ev.text || ev.message || '';
  const color = (CFG.nameColorType === 'twitch' && (ev.color || ev.chat_color)) ? (ev.color || ev.chat_color) : CFG.nameColor;
  const imgUrl = ev.profileImageURL || ev.profileImage || ev.avatar || '';
  const emotes = ev.emotes || {};
  const emoteSet = ev.emoteSet || ev.thirdPartyEmotes || [];
  const badges = ev.badges || [];

  let msgHtml = parseTwitchEmotes(text, emotes);
  msgHtml = parseThirdParty(msgHtml, emoteSet);

  const nameStyle = [
    `color:${color}`,
    CFG.nameTransform !== 'none' ? `text-transform:${CFG.nameTransform}` : '',
    CFG.nameShadow ? `text-shadow:1px 1px 4px ${CFG.nameShadow}` : ''
  ].filter(Boolean).join(';');

  const card = document.createElement('div');
  card.className = 'chat-msg';
  card.innerHTML = buildAvatar(name, imgUrl) + `<div class="chat-bubble"><div class="chat-meta">${buildBadges(badges)}<span class="chat-name" style="${nameStyle}">${esc(name)}</span></div><div class="chat-text">${msgHtml}</div></div>`;

  const c = document.getElementById('chat-container');
  CFG.rtl ? c.insertBefore(card, c.firstChild) : c.appendChild(card);

  const all = [...c.querySelectorAll('.chat-msg:not(.removing)')];
  if (all.length > CFG.maxMsgs) all.slice(0, all.length - CFG.maxMsgs).forEach(removeMsg);
  if (CFG.hideAfter > 0) setTimeout(() => removeMsg(card), CFG.hideAfter * 1000);
}

function removeMsg(el) {
  el.classList.add('removing');
  setTimeout(() => el.parentNode?.removeChild(el), 350);
}

function clearTestTimer() {
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }
}

function startTestMessages() {
  clearTestTimer();
  const samples = [
    {
      displayName: 'StreamerVault',
      text: 'this is a message with emotes Kappa PogChamp',
      color: '#39d353',
      badges: []
    },
    {
      displayName: 'Sawookie',
      text: 'Just subscribed! This game looks amazing!',
      color: '#8B5CF6',
      badges: []
    },
    {
      displayName: 'NeonNinja',
      text: 'Welcome to the stream! Make sure to follow for more content!',
      color: '#ff4fd8',
      badges: []
    }
  ];

  let i = 0;
  for (let j = 0; j < samples.length; j++) addMsg(samples[j]);

  testTimer = setInterval(() => {
    addMsg(samples[i % samples.length]);
    i++;
  }, 2200);
}

window.addEventListener('onWidgetLoad', obj => {
  const fd = obj?.detail?.fieldData;
  if (!fd) { applyVars(); return; }

  const b = v => v === 'yes' || v === true || v === 1;
  const n = (v, def) => { const x = parseInt(v); return isNaN(x) ? def : x; };

  CFG.hideAfter = n(fd.hideAfter, 0);
  CFG.hideCmds = b(fd.hideCommands);
  CFG.showAvatars = b(fd.showAvatars);
  CFG.fitContent = b(fd.fitContentWidth);
  CFG.avatarMode = fd.avatarMode || 'twitch';
  CFG.avSize = n(fd.avatarSize, 62);
  CFG.avBg = fd.avatarInitialsBg || '#AA4DDA';
  CFG.avInitColor = fd.avatarInitialsColor || '#ffffff';
  CFG.avBorder = fd.avatarBorderColor || 'rgba(255,255,255,0.9)';
  CFG.showBadges = b(fd.showBadges);
  CFG.badgeSz = n(fd.badgeSize, 20);
  CFG.nameTransform = fd.usernameTransform === 'uppercase' ? 'uppercase' : fd.usernameTransform === 'lowercase' ? 'lowercase' : 'none';
  CFG.nameColorType = fd.usernameColorType || 'custom';
  CFG.nameColor = fd.usernameColor || '#039BEF';
  CFG.nameShadow = (fd.usernameShadowColor && fd.usernameShadowColor !== 'rgba(255, 255, 255, 0)') ? fd.usernameShadowColor : '';
  CFG.msgColor = fd.messageColor || '#CDEDF2';
  CFG.msgBg = fd.messageBg || 'rgba(15,20,45,0.82)';
  CFG.nameSz = n(fd.usernameFontSize, 22);
  CFG.msgSz = n(fd.messageFontSize, 20);
  CFG.borderW = n(fd.borderWidth, 12);
  CFG.borderCol = fd.borderColor || '#039BEF';
  CFG.rtl = fd.scrollDirection === 'right-to-left';
  CFG.font = fd.googleFont || 'Barlow Condensed';
  CFG.gap = n(fd.spacing, 12);
  CFG.enableTestMessages = b(fd.enableTestMessages);

  applyVars();

  if (CFG.enableTestMessages) startTestMessages();
  else clearTestTimer();
});

window.addEventListener('onEventReceived', obj => {
  const listener = obj?.detail?.listener;
  const ev = obj?.detail?.event;
  if (!ev) return;
  if (listener !== 'message') return;

  const text = ev.text || ev.message || '';
  if (CFG.hideCmds && text.startsWith('!')) return;

  addMsg(ev);
});

document.addEventListener('DOMContentLoaded', applyVars);
