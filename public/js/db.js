// db.js — Couche d'abstraction Firebase Realtime Database
//
// Utilise l'API compat Firebase chargée via <script> dans le HTML.
// Chemins Firebase:
//   quiz/state/    — écrit par l'admin (phase, currentQuestion, scores, revealResults)
//   quiz/votes/    — écrit par les joueurs ({playerId}: "B")
//   quiz/players/  — écrit par les joueurs quand ils rejoignent ({playerId}: true)

import { FIREBASE_CONFIG, OFFLINE_MODE } from './firebase-config.js';

let _db = null;

/**
 * Initialise la connexion Firebase.
 */
export async function initDB() {
  if (OFFLINE_MODE) {
    console.log('[db] Mode hors-ligne — état local uniquement');
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.database();
    console.log('[db] Firebase connecté');
  } catch (e) {
    console.error('[db] Erreur Firebase:', e);
  }
}

/**
 * Écrire une valeur.
 */
export async function dbSet(path, value) {
  if (OFFLINE_MODE || !_db) {
    _localStore[path] = value;
    _notifyLocal(path, value);
    return;
  }
  await _db.ref(`quiz/${path}`).set(value);
}

/**
 * Lire une valeur (one-shot).
 */
export async function dbGet(path) {
  if (OFFLINE_MODE || !_db) {
    return _localStore[path] ?? null;
  }
  const snap = await _db.ref(`quiz/${path}`).once('value');
  return snap.val();
}

/**
 * Écouter les changements en temps réel.
 * @returns {function} unsubscribe
 */
export function dbListen(path, callback) {
  if (OFFLINE_MODE || !_db) {
    if (!_localListeners[path]) _localListeners[path] = [];
    _localListeners[path].push(callback);
    if (path in _localStore) callback(_localStore[path]);
    return () => {
      _localListeners[path] = _localListeners[path].filter(fn => fn !== callback);
    };
  }

  const ref = _db.ref(`quiz/${path}`);
  const handler = (snap) => callback(snap.val());
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

// --- Local store (mode offline) ---

const _localStore = {};
const _localListeners = {};

function _notifyLocal(path, value) {
  for (const fn of _localListeners[path] || []) {
    fn(value);
  }
  const parts = path.split('/');
  while (parts.length > 1) {
    parts.pop();
    const parentPath = parts.join('/');
    if (_localListeners[parentPath]) {
      const parentVal = _reconstructObject(parentPath);
      for (const fn of _localListeners[parentPath]) {
        fn(parentVal);
      }
    }
  }
}

function _reconstructObject(prefix) {
  const result = {};
  for (const [key, val] of Object.entries(_localStore)) {
    if (key === prefix) return val;
    if (key.startsWith(prefix + '/')) {
      const subKey = key.slice(prefix.length + 1);
      const parts = subKey.split('/');
      let obj = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
    }
  }
  return result;
}
