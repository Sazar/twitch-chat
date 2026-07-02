/* ============================================================
   Horizontal Twitch Chat Widget - StreamElements
   ============================================================ */

// ---- Default field values (overridden by StreamElements) ----
let fieldData = {
  hideAfter: 0,
  hideCommands: 'yes',
  showAvatars: 'yes',
  fitContentWidth: 'yes',
  avatarMode: 'twitch',
  avatarSize: 60,
  avatarInitialsBg: '#AA4DDA',
  avatarInitialsColor: '#FFFFFF',
  avatarBorderColor: '#FFF',
  showBadges: 'yes',
  badgeSize: 25,
  usernameTransform: 'default',
  usernameColorType: 'custom',
  usernameColor: '#039BEF',
  usernameShadowColor: 'rgba(255,255,255,0)',
  messageColor: '#CDEDF2',
  messageBg: 'rgba(0,0,0,0.5)',
  usernameFontSize: 25,
  messageFontSize: 25,
  borderWidth: 13,
  borderColor: '#039BEF',
  scrollDirection: 'left-to-right',
  googleFont: 'Barlow Condensed',
  spacing: 15
};

const MAX_MESSAGES = 6;

// ---- Apply CSS variables from field data ----
function applyCSSVars() {
  const root = document.documentElement;

  // Load google font dynamically
  const existingLink = document.getElementById('gfont');
  if (existingLink) existingLink.remove();
  const link = document.createElement('link');
  link.id = 'gfont';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fieldData.googleFont.replace(/ /g, '+')}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);

  root.style.setProperty('--font-family', `'${fieldData.googleFont}', sans-serif`);
  root.style.setProperty('--avatar-size', fieldData.avatarSize + 'px');
  root.style.setProperty('--avatar-initials-bg', fieldData.avatarInitialsBg);
  root.style.setProperty('--avatar-initials-color', fieldData.avatarInitialsColor);
  root.style.setProperty('--avatar-border-color', fieldData.avatarBorderColor);
  root.style.setProperty('--badge-size', fieldData.badgeSize + 'px');
  root.style.setProperty('--username-color', fieldData.usernameColor);
  root.style.setProperty('--username-font-size', fieldData.usernameFontSize + 'px');
  root.style.setProperty('--username-transform',
    fieldData.usernameTransform === 'uppercase' ? 'uppercase' :
    fieldData.usernameTransform === 'lowercase' ? 'lowercase' : 'none');
  root.style.setProperty('--username-shadow',
    fieldData.usernameShadowColor !== 'rgba(255,255,255,0)'
      ? `1px 1px 3px ${fieldData.usernameShadowColor}`
      : 'none');
  root.style.setProperty('--message-color', fieldData.messageColor);
  root.style.setProperty('--message-font-size', fieldData.messageFontSize + 'px');
  root.style.setProperty('--message-bg', fieldData.messageBg);
  root.style.setProperty('--border-width', fieldData.borderWidth + 'px');
  root.style.setProperty('--border-color', fieldData.borderColor);
  root.style.setProperty('--spacing', fieldData.spacing + 'px');

  // Scroll direction
  const container = document.getElementById('chat-container');
  if (container) {
    container.style.flexDirection =
      fieldData.scrollDirection === 'right-to-left' ? 'row-reverse' : 'row';
  }
}

// ---- Parse Twitch native emotes ----
function parseEmotes(message, emotes) {
  if (!emotes || Object.keys(emotes).length === 0) {
    return escapeHtml(message);
  }
  const replacements = [];
  for (const [emoteId, positions] of Object.entries(emotes)) {
    const posArr = Array.isArray(positions) ? positions : String(positions).split('/');
    for (const pos of posArr) {
      const parts = typeof pos === 'string' ? pos.split('-') : [pos.start, pos.end];
      replacements.push({
        start: parseInt(parts[0]),
        end: parseInt(parts[1]),
        emoteId,
        emoteName: message.substring(parseInt(parts[0]), parseInt(parts[1]) + 1)
      });
    }
  }
  replacements.sort((a, b) => a.start - b.start);
  let result = '';
  let lastIndex = 0;
  for (const rep of replacements) {
    if (rep.start > lastIndex) result += escapeHtml(message.substring(lastIndex, rep.start));
    result += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${rep.emoteId}/default/dark/2.0" alt="${escapeHtml(rep.emoteName)}" title="${escapeHtml(rep.emoteName)}" />`;
    lastIndex = rep.end + 1;
  }
  if (lastIndex < message.length) result += escapeHtml(message.substring(lastIndex));
  return result;
}

// ---- Parse BTTV / FFZ / 7TV emotes ----
function parseThirdPartyEmotes(html, emoteSet) {
  if (!emoteSet || emoteSet.length === 0) return html;
  for (const emote of emoteSet) {
    const url = (emote.urls && emote.urls['1']) || emote.url || '';
    if (!url) continue;
    const regex = new RegExp('(?<![\\w])' + escapeRegex(emote.name) + '(?![\\w])', 'g');
    html = html.replace(regex,
      `<img class="emote" src="${url}" alt="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}" />`);
  }
  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Build badge HTML ----
function buildBadges(badgeData) {
  if (fieldData.showBadges !== 'yes' || !badgeData || badgeData.length === 0) return '';
  let html = '';
  for (const badge of badgeData) {
    if (badge.url) {
      html += `<img src="${badge.url}" alt="${escapeHtml(badge.type || '')}" title="${escapeHtml(badge.description || badge.type || '')}" />`;
    }
  }
  return html ? `<span class="badges">${html}</span>` : '';
}

// ---- Build avatar HTML ----
function buildAvatar(data) {
  if (fieldData.showAvatars !== 'yes') return '';
  const name = data.displayName || data.username || '?';
  let inner = '';
  if (fieldData.avatarMode === 'twitch' && data.profilePicture) {
    inner = `<img src="${data.profilePicture}" alt="${escapeHtml(name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />`
           + `<span class="avatar-initials" style="display:none">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
  } else {
    inner = `<span class="avatar-initials">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
  }
  return `<div class="avatar-wrapper">${inner}</div>`;
}

// ---- Resolve username color ----
function resolveColor(data) {
  return (fieldData.usernameColorType === 'twitch' && data.color)
    ? data.color
    : fieldData.usernameColor;
}

// ---- Build and append message card ----
function buildMessageCard(data) {
  const container = document.getElementById('chat-container');
  const displayName = escapeHtml(data.displayName || data.username || 'Unknown');
  const color = resolveColor(data);

  let msgHtml = parseEmotes(data.text || '', data.emotes || {});
  if (data.emoteSet) msgHtml = parseThirdPartyEmotes(msgHtml, data.emoteSet);

  const card = document.createElement('div');
  card.classList.add('chat-message');
  if (fieldData.fitContentWidth === 'yes') {
    card.style.maxWidth = 'none';
    card.style.width = 'auto';
  }

  card.innerHTML = `
    ${buildAvatar(data)}
    <div class="message-body">
      <div class="username-row">
        ${buildBadges(data.badges || [])}
        <span class="username" style="color:${color}">${displayName}</span>
      </div>
      <div class="message-text">${msgHtml}</div>
    </div>
  `;

  if (fieldData.scrollDirection === 'right-to-left') {
    container.insertBefore(card, container.firstChild);
  } else {
    container.appendChild(card);
  }

  trimMessages();

  if (fieldData.hideAfter > 0) {
    setTimeout(() => removeMessage(card), fieldData.hideAfter * 1000);
  }
}

function trimMessages() {
  const container = document.getElementById('chat-container');
  const messages = container.querySelectorAll('.chat-message:not(.removing)');
  if (messages.length > MAX_MESSAGES) {
    Array.from(messages).slice(0, messages.length - MAX_MESSAGES).forEach(removeMessage);
  }
}

function removeMessage(el) {
  el.classList.add('removing');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
}

// ---- StreamElements events ----
window.addEventListener('onWidgetLoad', function (obj) {
  const fd = obj.detail.fieldData;
  Object.assign(fieldData, {
    hideAfter:           parseInt(fd.hideAfter) || 0,
    hideCommands:        fd.hideCommands || 'yes',
    showAvatars:         fd.showAvatars || 'yes',
    fitContentWidth:     fd.fitContentWidth || 'yes',
    avatarMode:          fd.avatarMode || 'twitch',
    avatarSize:          parseInt(fd.avatarSize) || 60,
    avatarInitialsBg:    fd.avatarInitialsBg || '#AA4DDA',
    avatarInitialsColor: fd.avatarInitialsColor || '#FFFFFF',
    avatarBorderColor:   fd.avatarBorderColor || '#FFF',
    showBadges:          fd.showBadges || 'yes',
    badgeSize:           parseInt(fd.badgeSize) || 25,
    usernameTransform:   fd.usernameTransform || 'default',
    usernameColorType:   fd.usernameColorType || 'custom',
    usernameColor:       fd.usernameColor || '#039BEF',
    usernameShadowColor: fd.usernameShadowColor || 'rgba(255,255,255,0)',
    messageColor:        fd.messageColor || '#CDEDF2',
    messageBg:           fd.messageBg || 'rgba(0,0,0,0.5)',
    usernameFontSize:    parseInt(fd.usernameFontSize) || 25,
    messageFontSize:     parseInt(fd.messageFontSize) || 25,
    borderWidth:         parseInt(fd.borderWidth) || 13,
    borderColor:         fd.borderColor || '#039BEF',
    scrollDirection:     fd.scrollDirection || 'left-to-right',
    googleFont:          fd.googleFont || 'Barlow Condensed',
    spacing:             parseInt(fd.spacing) || 15
  });
  applyCSSVars();
});

window.addEventListener('onEventReceived', function (obj) {
  if (obj.detail.listener !== 'message') return;
  const data = obj.detail.event;
  if (fieldData.hideCommands === 'yes' && data.text && data.text.startsWith('!')) return;
  buildMessageCard(data);
});

document.addEventListener('DOMContentLoaded', applyCSSVars);
