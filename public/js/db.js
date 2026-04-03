// db.js — Couche d'abstraction Firebase Realtime Database
//
// Chemins Firebase:
//   quiz/state/    — écrit par l'admin (phase, currentQuestion, scores, revealResults)
//   quiz/votes/    — écrit par les joueurs ({playerId}: "B")
//   quiz/players/  — écrit par les joueurs quand ils rejoignent ({playerId}: true)

import { FIREBASE_CONFIG, OFFLINE_MODE } from './firebase-config.js';

// Modules Firebase pré-chargés à l'init
let _db = null;
let _fbRef = null;
let _fbSet = null;
let _fbGet = null;
let _fbOnValue = null;
let _fbOff = null;

/**
 * Initialise la connexion Firebase. Doit être appelé avant toute autre opération.
 */
export async function initDB() {
  if (OFFLINE_MODE) {
    console.log('[db] Mode hors-ligne — état local uniquement');
    return;
  }

  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const fbDb = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js');

  const app = initializeApp(FIREBASE_CONFIG);
  _db = fbDb.getDatabase(app);
  _fbRef = fbDb.ref;
  _fbSet = fbDb.set;
  _fbGet = fbDb.get;
  _fbOnValue = fbDb.onValue;
  _fbOff = fbDb.off;

  console.log('[db] Firebase connecté');
}

/**
 * Écrire une valeur.
 */
export async function dbSet(path, value) {
  if (OFFLINE_MODE) {
    _localStore[path] = value;
    _notifyLocal(path, value);
    return;
  }
  await _fbSet(_fbRef(_db, `quiz/${path}`), value);
}

/**
 * Lire une valeur (one-shot).
 */
export async function dbGet(path) {
  if (OFFLINE_MODE) {
    return _localStore[path] ?? null;
  }
  const snap = await _fbGet(_fbRef(_db, `quiz/${path}`));
  return snap.val();
}

/**
 * Écouter les changements en temps réel.
 * @returns {function} unsubscribe
 */
export function dbListen(path, callback) {
  if (OFFLINE_MODE) {
    if (!_localListeners[path]) _localListeners[path] = [];
    _localListeners[path].push(callback);
    if (path in _localStore) callback(_localStore[path]);
    return () => {
      _localListeners[path] = _localListeners[path].filter(fn => fn !== callback);
    };
  }

  const refObj = _fbRef(_db, `quiz/${path}`);
  _fbOnValue(refObj, (snap) => callback(snap.val()));
  return () => _fbOff(refObj);
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
