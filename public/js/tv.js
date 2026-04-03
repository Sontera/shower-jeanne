// tv.js — Vue TV (écoute Firebase, affiche)

import { PLAYERS, createToken, updateTokenMood, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { getRanking } from './quiz-engine.js';
import { initDB, dbListen } from './db.js';

// --- Screens ---

const screens = {
  lobby: document.getElementById('screen-lobby'),
  question: document.getElementById('screen-question'),
  scores: document.getElementById('screen-scores'),
  final: document.getElementById('screen-final'),
};

function showScreen(phase) {
  const screenKey = phase === 'reveal' ? 'question' : phase;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('active', key === screenKey);
  }
}

// --- State ---

let currentState = null;
let currentVotes = {};
let revealResults = null;

// --- Lobby ---

function renderLobby(connectedPlayers) {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';
  for (const player of PLAYERS) {
    const isConnected = connectedPlayers && connectedPlayers.includes(player.id);
    const token = createToken(player, 'neutral', { size: 'tv' });
    token.style.animationDelay = `${PLAYERS.indexOf(player) * 0.1}s`;
    if (!isConnected) token.style.opacity = '0.35';
    container.appendChild(token);
  }
}

// --- Question ---

let playerTokens = {};

function renderPlayersColumn(connectedPlayers) {
  const col = document.getElementById('players-column');
  col.innerHTML = '';
  playerTokens = {};
  for (const player of PLAYERS) {
    if (!connectedPlayers || !connectedPlayers.includes(player.id)) continue;
    const token = createToken(player, 'neutral', { size: 'tv' });
    playerTokens[player.id] = token;
    col.appendChild(token);
  }
}

function renderQuestion(questionIndex, totalQuestions) {
  const q = QUESTIONS[questionIndex];
  if (!q) return;

  document.getElementById('q-number').textContent =
    `Question ${questionIndex + 1}/${totalQuestions}`;
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

  document.getElementById('q-explanation').classList.remove('visible');
  document.getElementById('q-explanation').textContent = '';

  // Reset token moods
  for (const [id, tokenEl] of Object.entries(playerTokens)) {
    const player = getPlayerById(id);
    if (player) updateTokenMood(tokenEl, player, 'neutral');
    tokenEl.dataset.voted = 'false';
  }
}

function updateVoteIndicators(votes) {
  if (!votes) return;
  for (const [playerId, choice] of Object.entries(votes)) {
    const tokenEl = playerTokens[playerId];
    if (tokenEl && choice != null) {
      tokenEl.dataset.voted = 'true';
    }
  }
}

// --- Reveal ---

function renderReveal(questionIndex, results) {
  const q = QUESTIONS[questionIndex];
  if (!q) return;

  // Highlight correct answer
  const choicesEl = document.getElementById('q-choices');
  for (const div of choicesEl.children) {
    if (div.dataset.letter === q.answer) {
      div.classList.add('correct');
    }
  }

  // Show explanation
  if (q.explanation) {
    const explEl = document.getElementById('q-explanation');
    explEl.textContent = q.explanation;
    explEl.classList.add('visible');
  }

  // Animate tokens
  if (results) {
    for (const [playerId, result] of Object.entries(results)) {
      const tokenEl = playerTokens[playerId];
      const player = getPlayerById(playerId);
      if (!tokenEl || !player) continue;
      updateTokenMood(tokenEl, player, result.correct ? 'happy' : 'sad');
    }
  }
}

// --- Scores ---

function renderScores(scores, targetEl) {
  const ranking = getRanking(scores || {});
  const maxScore = Math.max(1, ...ranking.map(r => r.score));

  targetEl = targetEl || document.getElementById('scoreboard');
  targetEl.innerHTML = '';

  for (const { playerId, score, rank } of ranking) {
    const player = getPlayerById(playerId);
    if (!player) continue;

    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.animationDelay = `${rank * 0.08}s`;

    row.innerHTML = `<span class="score-rank">${rank}.</span>`;

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

// --- Final ---

function renderFinal(scores) {
  const ranking = getRanking(scores || {});
  const podium = document.getElementById('podium');
  podium.innerHTML = '';

  const order = [1, 0, 2]; // 2nd, 1st, 3rd
  const placeClasses = ['podium-2nd', 'podium-1st', 'podium-3rd'];

  for (let i = 0; i < 3; i++) {
    const entry = ranking[order[i]];
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

  renderScores(scores, document.getElementById('final-scoreboard'));
}

// --- Main state listener ---

let lastPhase = null;
let lastQuestionIndex = null;

function onStateChange(state) {
  if (!state) return;
  currentState = state;
  const { phase, currentQuestion, scores, connectedPlayers, totalQuestions } = state;

  showScreen(phase);

  switch (phase) {
    case 'lobby':
      renderLobby(connectedPlayers);
      break;

    case 'question':
      if (lastPhase !== 'question' || lastQuestionIndex !== currentQuestion) {
        renderPlayersColumn(connectedPlayers);
        renderQuestion(currentQuestion, totalQuestions);
      }
      updateVoteIndicators(currentVotes);
      revealResults = null;
      break;

    case 'reveal':
      if (lastPhase === 'question') {
        // On vient de passer en reveal — l'animation sera déclenchée par revealResults
      }
      break;

    case 'scores':
      renderScores(scores);
      break;

    case 'final':
      renderFinal(scores);
      break;
  }

  lastPhase = phase;
  lastQuestionIndex = currentQuestion;
}

// --- Boot ---

async function boot() {
  await initDB();

  // Écouter l'état du quiz
  dbListen('state', onStateChange);

  // Écouter les votes (pour les indicateurs visuels)
  dbListen('votes', (votes) => {
    currentVotes = votes || {};
    if (currentState && currentState.phase === 'question') {
      updateVoteIndicators(currentVotes);
    }
  });

  // Écouter les résultats de révélation
  dbListen('state/revealResults', (results) => {
    if (results && currentState) {
      renderReveal(currentState.currentQuestion, results);
    }
  });

  // Afficher le lobby par défaut
  showScreen('lobby');
  renderLobby([]);
}

boot();
