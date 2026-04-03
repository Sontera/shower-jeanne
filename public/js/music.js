// music.js — Musique d'ambiance par round
//
// Fichiers attendus dans assets/music/ :
//   round-1.mp3  à  round-8.mp3
//   reveal.mp3   (optionnel — sting court à la révélation)
//   final.mp3    (optionnel — musique du podium)
//
// La musique joue en boucle pendant le round-intro et les questions,
// puis s'arrête en fade-out à la révélation.

const FADE_DURATION = 1500; // ms

let _audio = null;
let _fadeInterval = null;
let _volume = 0.35;

/**
 * Joue la musique du round donné. Boucle automatiquement.
 * @param {number} roundNumber - 1 à 8
 */
export function playRoundMusic(roundNumber) {
  stop();
  const src = `assets/music/round-${roundNumber}.mp3`;
  _audio = new Audio(src);
  _audio.loop = true;
  _audio.volume = _volume;
  _audio.play().catch(() => {
    // Autoplay bloqué par le navigateur — ignoré silencieusement
  });
}

/**
 * Joue un fichier audio arbitraire (remplace la musique en cours).
 * @param {string} src - chemin du fichier
 * @param {Object} options - { loop: false, onEnded: null }
 */
export function playFile(src, options = {}) {
  stop();
  _audio = new Audio(src);
  _audio.loop = !!options.loop;
  _audio.volume = _volume;
  if (options.onEnded) {
    _audio.addEventListener('ended', options.onEnded);
  }
  const p = _audio.play();
  if (p) p.catch(() => {});
}

/**
 * Joue un son court (reveal, final, etc.)
 * @param {string} name - nom du fichier sans extension (ex: 'reveal', 'final')
 */
export function playSting(name) {
  const sting = new Audio(`assets/music/${name}.mp3`);
  sting.volume = _volume;
  sting.play().catch(() => {});
}

/**
 * Fade-out puis stop.
 */
export function fadeOut(duration = FADE_DURATION) {
  if (!_audio) return;
  clearInterval(_fadeInterval);
  const step = 50;
  const decrement = (_audio.volume / (duration / step));
  _fadeInterval = setInterval(() => {
    if (!_audio) { clearInterval(_fadeInterval); return; }
    _audio.volume = Math.max(0, _audio.volume - decrement);
    if (_audio.volume <= 0.01) {
      stop();
    }
  }, step);
}

/**
 * Stop immédiat.
 */
export function stop() {
  clearInterval(_fadeInterval);
  if (_audio) {
    _audio.pause();
    _audio.currentTime = 0;
    _audio = null;
  }
}

/**
 * Change le volume (0 à 1).
 */
export function setVolume(vol) {
  _volume = Math.max(0, Math.min(1, vol));
  if (_audio) _audio.volume = _volume;
}

/**
 * Retourne le volume courant.
 */
export function getVolume() {
  return _volume;
}

/**
 * Musique en cours?
 */
export function isPlaying() {
  return _audio && !_audio.paused;
}
