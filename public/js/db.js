// db.js — Couche d'abstraction pour la persistance
//
// En mode OFFLINE : état local in-memory (pour le dev/preview)
// En mode ONLINE  : Firebase Realtime Database (pour le party)

import { FIREBASE_CONFIG, OFFLINE_MODE } from './firebase-config.js';

let _db = null;
let _firebaseRef = null;

/**
 * Initialise la connexion à la base de données.
 */
export async function initDB() {
  if (OFFLINE_MODE) {
    console.log('[db] Mode hors-ligne — état local uniquement');
    return;
  }

  // Chargement dynamique de Firebase (CDN)
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
  const { getDatabase, ref } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js');

  const app = initializeApp(FIREBASE_CONFIG);
  _db = getDatabase(app);
  _firebaseRef = ref;
  console.log('[db] Firebase connecté');
}

/**
 * Écrire une valeur dans la DB.
 * @param {string} path - ex: 'state/phase'
 * @param {*} value
 */
export async function dbSet(path, value) {
  if (OFFLINE_MODE) {
    _localStore[path] = value;
    _notifyLocal(path, value);
    return;
  }
  const { set } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js');
  await set(_firebaseRef(_db, `quiz/${path}`), value);
}

/**
 * Lire une valeur de la DB (one-shot).
 * @param {string} path
 * @returns {*}
 */
export async function dbGet(path) {
  if (OFFLINE_MODE) {
    return _localStore[path] ?? null;
  }
  const { get } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js');
  const snap = await get(_firebaseRef(_db, `quiz/${path}`));
  return snap.val();
}

/**
 * Écouter les changements en temps réel.
 * @param {string} path
 * @param {function} callback - appelé avec la nouvelle valeur
 * @returns {function} unsubscribe
 */
export function dbListen(path, callback) {
  if (OFFLINE_MODE) {
    if (!_localListeners[path]) _localListeners[path] = [];
    _localListeners[path].push(callback);
    // Envoyer la valeur actuelle
    if (path in _localStore) {
      callback(_localStore[path]);
    }
    return () => {
      _localListeners[path] = _localListeners[path].filter(fn => fn !== callback);
    };
  }

  // Firebase listener
  import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js').then(({ onValue, off }) => {
    const refObj = _firebaseRef(_db, `quiz/${path}`);
    onValue(refObj, (snap) => callback(snap.val()));
    callback._unsub = () => off(refObj);
  });

  return () => { if (callback._unsub) callback._unsub(); };
}

/**
 * Écrire l'état complet du quiz.
 */
export async function dbSetState(state) {
  await dbSet('state', state);
}

/**
 * Écouter l'état complet du quiz.
 */
export function dbListenState(callback) {
  return dbListen('state', callback);
}

// --- Local store (mode offline) ---

const _localStore = {};
const _localListeners = {};

function _notifyLocal(path, value) {
  // Notifier les listeners exacts
  for (const fn of _localListeners[path] || []) {
    fn(value);
  }
  // Notifier les listeners parents (ex: 'state' quand on écrit 'state/phase')
  const parts = path.split('/');
  while (parts.length > 1) {
    parts.pop();
    const parentPath = parts.join('/');
    if (_localListeners[parentPath]) {
      // Reconstituer l'objet parent depuis le store
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
