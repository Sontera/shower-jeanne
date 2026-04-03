// tv.js — Logique de la vue TV (1080p Chromecast)

import { PLAYERS, createToken, updateTokenMood, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB } from './db.js';

// --- Init ---

const engine = new QuizEngine(QUESTIONS, PLAYERS);

const screens = {
  lobby: document.getElementById('screen-lobby'),
  question: document.getElementById('screen-question'),
  scores: document.getElementById('screen-scores'),
  final: document.getElementById('screen-final'),
};

function showScreen(phase) {
  // reveal utilise le même écran que question
  const screenKey = phase === 'reveal' ? 'question' : phase;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('active', key === screenKey);
  }
}

// --- Lobby ---

function renderLobby() {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';
  for (const player of PLAYERS) {
    const token = createToken(player, 'neutral', { size: 'tv' });
    token.style.animationDelay = `${PLAYERS.indexOf(player) * 0.1}s`;
    container.appendChild(token);
  }
}

// --- Question ---

const playersColumn = document.getElementById('players-column');
let playerTokens = {}; // { playerId: HTMLElement }

function renderPlayersColumn() {
  playersColumn.innerHTML = '';
  playerTokens = {};
  for (const player of PLAYERS) {
    if (!engine.connectedPlayers.includes(player.id)) continue;
    const token = createToken(player, 'neutral', { size: 'tv' });
    playerTokens[player.id] = token;
    playersColumn.appendChild(token);
  }
}

function renderQuestion() {
  const q = engine.currentQuestion;
  if (!q) return;

  document.getElementById('q-number').textContent =
    `Question ${engine.currentQuestionIndex + 1}/${engine.totalQuestions}`;
  document.getElementById('q-theme').textContent = q.theme;
  document.getElementById('q-text').textContent = q.text;

  const choicesEl = document.getElementById('q-choices');
  choicesEl.innerHTML = '';
  for (const choice of q.choices) {
    const div = document.createElement('div');
    div.className = 'choice';
    div.textContent = choice;
    div.dataset.letter = choice.charAt(0);
    choicesEl.appendChild(div);
  }

  // Cacher l'explication
  document.getElementById('q-explanation').classList.remove('visible');
  document.getElementById('q-explanation').textContent = '';

  // Reset les moods des jetons
  for (const [id, tokenEl] of Object.entries(playerTokens)) {
    const player = getPlayerById(id);
    if (player) updateTokenMood(tokenEl, player, 'neutral');
    tokenEl.dataset.voted = 'false';
  }
}

// --- Reveal ---

function renderReveal(questionIndex, correctAnswer, results) {
  // Mettre en évidence la bonne réponse
  const choicesEl = document.getElementById('q-choices');
  for (const div of choicesEl.children) {
    if (div.dataset.letter === correctAnswer) {
      div.classList.add('correct');
    }
  }

  // Afficher l'explication
  const q = engine.currentQuestion;
  if (q && q.explanation) {
    const explEl = document.getElementById('q-explanation');
    explEl.textContent = q.explanation;
    explEl.classList.add('visible');
  }

  // Animer les jetons
  for (const [playerId, { correct }] of Object.entries(results)) {
    const tokenEl = playerTokens[playerId];
    const player = getPlayerById(playerId);
    if (!tokenEl || !player) continue;

    const mood = correct ? 'happy' : 'sad';
    updateTokenMood(tokenEl, player, mood);
  }
}

// --- Scores ---

function renderScores(targetEl) {
  const ranking = getRanking(engine.scores);
  const maxScore = Math.max(1, ...ranking.map(r => r.score));

  targetEl = targetEl || document.getElementById('scoreboard');
  targetEl.innerHTML = '';

  for (const { playerId, score, rank } of ranking) {
    const player = getPlayerById(playerId);
    if (!player) continue;

    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.animationDelay = `${rank * 0.08}s`;

    row.innerHTML = `
      <span class="score-rank">${rank}.</span>
    `;

    const token = createToken(player, 'neutral', { size: 'admin' });
    row.appendChild(token);

    const bar = document.createElement('div');
    bar.className = 'score-bar';
    bar.innerHTML = `<div class="score-bar-fill" style="width:${(score / maxScore) * 100}%;background:${player.color}"></div>`;
    row.appendChild(bar);

    const val = document.createElement('span');
    val.className = 'score-value';
    val.textContent = score;
    row.appendChild(val);

    targetEl.appendChild(row);
  }
}

// --- Final / Podium ---

function renderFinal() {
  const ranking = getRanking(engine.scores);
  const podium = document.getElementById('podium');
  podium.innerHTML = '';

  // Podium : 2e, 1er, 3e (affichage classique)
  const order = [1, 0, 2]; // indices dans ranking
  const placeClasses = ['podium-2nd', 'podium-1st', 'podium-3rd'];

  for (let i = 0; i < 3; i++) {
    const idx = order[i];
    const entry = ranking[idx];
    if (!entry) continue;
    const player = getPlayerById(entry.playerId);
    if (!player) continue;

    const place = document.createElement('div');
    place.className = `podium-place ${placeClasses[i]}`;

    const token = createToken(player, 'happy', { size: 'tv' });
    place.appendChild(token);

    const block = document.createElement('div');
    block.className = 'podium-block';
    block.textContent = entry.score;
    place.appendChild(block);

    podium.appendChild(place);
  }

  renderScores(document.getElementById('final-scoreboard'));
}

// --- Events ---

engine.on('phase-change', (phase) => {
  showScreen(phase);
  switch (phase) {
    case 'lobby':
      renderLobby();
      break;
    case 'question':
      renderPlayersColumn();
      renderQuestion();
      break;
    case 'scores':
      renderScores();
      break;
    case 'final':
      renderFinal();
      break;
  }
});

engine.on('vote', (playerId) => {
  const tokenEl = playerTokens[playerId];
  if (tokenEl) tokenEl.dataset.voted = 'true';
});

engine.on('answer-revealed', renderReveal);

// --- Boot ---

async function boot() {
  await initDB();

  // En mode offline, connecter tous les joueurs automatiquement pour le preview
  for (const p of PLAYERS) {
    engine.connectPlayer(p.id);
  }

  // Afficher le lobby
  showScreen('lobby');
  renderLobby();
}

boot();

// Exposer l'engine pour le debug et pour que l'admin puisse le contrôler
// (en mode offline, les deux onglets partagent la même instance via BroadcastChannel)
window.__quizEngine = engine;
