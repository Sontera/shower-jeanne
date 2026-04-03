// music.js — Musique d'ambiance par round
//
// Fichiers attendus dans assets/music/ :
//   round-1.mp3  à  round-8.mp3
//   reveal.mp3   (optionnel — sting court à la révélation)
//   final.mp3    (optionnel — musique du podium)

let _audio = null;
let _sting = null;
let _fadeInterval = null;
let _volume = 0.35;

/**
 * Joue la musique du round donné. Boucle automatiquement.
 */
export function playRoundMusic(roundNumber) {
  stop();
  const src = `assets/music/round-${roundNumber}.mp3`;
  _audio = new Audio(src);
  _audio.loop = true;
  _audio.volume = _volume;
  _audio.play().catch(() => {});
}

/**
 * Joue un fichier audio arbitraire (remplace la musique en cours).
 */
export function playFile(src, options = {}) {
  stop();
  _audio = new Audio(src);
  _audio.loop = !!options.loop;
  _audio.volume = _volume;
  if (options.onEnded) {
    _audio.addEventListener('ended', options.onEnded);
  }
  _audio.play().catch(() => {});
}

/**
 * Joue un son court (sting). Tracké pour pouvoir être stoppé.
 */
export function playSting(name) {
  if (_sting) { _sting.pause(); _sting = null; }
  _sting = new Audio(`assets/music/${name}.mp3`);
  _sting.volume = _volume;
  _sting.addEventListener('ended', () => { _sting = null; });
  _sting.play().catch(() => {});
}

/**
 * Fade-out puis stop.
 */
export function fadeOut(duration = 1500) {
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
 * Stop immédiat (musique + sting).
 */
export function stop() {
  clearInterval(_fadeInterval);
  if (_audio) {
    _audio.pause();
    _audio.currentTime = 0;
    _audio = null;
  }
  if (_sting) {
    _sting.pause();
    _sting = null;
  }
}

/**
 * Change le volume (0 à 1). Affecte musique et sting.
 */
export function setVolume(vol) {
  _volume = Math.max(0, Math.min(1, vol));
  if (_audio) _audio.volume = _volume;
  if (_sting) _sting.volume = _volume;
}

export function getVolume() {
  return _volume;
}

export function isPlaying() {
  return (_audio && !_audio.paused) || (_sting && !_sting.paused);
}
