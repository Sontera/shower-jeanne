// firebase-config.js — Configuration Firebase
//
// TODO: Remplacer par les vraies valeurs du projet Firebase
// (console.firebase.google.com → Project Settings → Your apps → Config)

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD0Wc3sdF0iBIY-YrNezsbOmsQa4gKbPFs',
  authDomain: 'showerjeanne.firebaseapp.com',
  databaseURL: 'https://showerjeanne-default-rtdb.firebaseio.com',
  projectId: 'showerjeanne',
  storageBucket: 'showerjeanne.firebasestorage.app',
  messagingSenderId: '526075317099',
  appId: '1:526075317099:web:8ca7d30bca5ecf882a1a2e',
};

/**
 * true = mode local (pas de Firebase, état en mémoire uniquement).
 * Passe à false une fois la config Firebase remplie.
 */
export const OFFLINE_MODE = FIREBASE_CONFIG.apiKey === 'TODO';
