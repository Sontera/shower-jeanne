// players.js — Données des participants et rendu des jetons

export const PLAYERS = [
  {
    id: 'jeanne',
    name: 'Jeanne',
    color: '#E8A0BF',
    initials: 'J',
  },
  {
    id: 'mathieu-d',
    name: 'Mathieu D.',
    color: '#A0C4E8',
    initials: 'MD',
  },
  {
    id: 'sarah',
    name: 'Sarah',
    color: '#B8E0A0',
    initials: 'S',
  },
  {
    id: 'jonathan',
    name: 'Jonathan',
    color: '#E8D4A0',
    initials: 'Jo',
  },
  {
    id: 'leonie',
    name: 'Léonie',
    color: '#D4A0E8',
    initials: 'L',
  },
  {
    id: 'mathieu-g',
    name: 'Mathieu G.',
    color: '#A0E8D4',
    initials: 'MG',
  },
  {
    id: 'catherine',
    name: 'Catherine',
    color: '#E8B8A0',
    initials: 'C',
  },
  {
    id: 'andre',
    name: 'André',
    color: '#A0B8E8',
    initials: 'A',
  },
  {
    id: 'michelle',
    name: 'Michelle',
    color: '#E8A0A0',
    initials: 'Mi',
  },
];

export const ANIMATOR = { id: 'charles', name: 'Charles' };

/**
 * Retourne le chemin de la photo pour un joueur et un mood donné.
 * mood: 'neutral' | 'happy' | 'sad'
 */
export function getPhotoPath(player, mood) {
  return `assets/players/${player.id}-${mood}.png`;
}

/**
 * Génère un SVG data-URI placeholder avec les initiales du joueur.
 */
function initialsSvg(player, size = 64) {
  const fontSize = player.initials.length > 1 ? size * 0.36 : size * 0.44;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${player.color}"/>
    <text x="50%" y="50%" dy=".35em" text-anchor="middle"
          font-family="system-ui, sans-serif" font-weight="600"
          font-size="${fontSize}" fill="#fff">${player.initials}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/**
 * Crée un élément DOM jeton joueur.
 *
 * Structure:
 *   .player-token[data-player-id][data-mood]
 *     .token-name
 *     .token-avatar
 *       img (photo ou placeholder SVG)
 *
 * @param {Object} player - objet joueur de PLAYERS
 * @param {string} mood - 'neutral' | 'happy' | 'sad'
 * @param {Object} options - { size: 'tv' | 'admin' | 'mobile' }
 * @returns {HTMLElement}
 */
export function createToken(player, mood = 'neutral', options = {}) {
  const size = options.size || 'tv';

  const token = document.createElement('div');
  token.className = `player-token player-token--${size}`;
  token.dataset.playerId = player.id;
  token.dataset.mood = mood;
  token.style.setProperty('--player-color', player.color);

  // Nom
  const nameEl = document.createElement('span');
  nameEl.className = 'token-name';
  nameEl.textContent = player.name;

  // Avatar circulaire
  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'token-avatar';

  const img = document.createElement('img');
  img.alt = player.name;
  img.draggable = false;

  // Essayer la vraie photo, fallback sur le SVG initiales
  const photoPath = getPhotoPath(player, mood);
  img.src = photoPath;
  img.onerror = () => { img.src = initialsSvg(player); img.onerror = null; };

  avatarWrap.appendChild(img);
  token.appendChild(nameEl);
  token.appendChild(avatarWrap);

  return token;
}

/**
 * Met à jour le mood d'un jeton existant (change l'image + data-mood).
 */
export function updateTokenMood(tokenEl, player, mood) {
  tokenEl.dataset.mood = mood;
  const img = tokenEl.querySelector('.token-avatar img');
  if (!img) return;

  const photoPath = getPhotoPath(player, mood);
  img.src = photoPath;
  img.onerror = () => { img.src = initialsSvg(player); img.onerror = null; };
}

/**
 * Cherche un joueur par ID.
 */
export function getPlayerById(id) {
  return PLAYERS.find(p => p.id === id) || null;
}
