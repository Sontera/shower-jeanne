// tv.js — Vue TV (écoute Firebase, affiche)

import { PLAYERS, createToken, updateTokenMood, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { getRanking } from './quiz-engine.js';
import { initDB, dbListen } from './db.js';

// --- Screens ---

const screens = {
  lobby: document.getElementById('screen-lobby'),
  'round-intro': document.getElementById('screen-round-intro'),
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

// --- Lobby ---

function renderLobby(connectedPlayers) {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';
  for (const player of PLAYERS) {
    const isConnected = connectedPlayers && connectedPlayers.includes(player.id);
    const token = createToken(player, 'neutral', { size: 'tv' });
    token.style.animationDelay = `${PLAYERS.indexOf(player) * 0.1}s`;
    if (isConnected) {
      token.style.background = 'var(--correct-light)';
      token.style.borderColor = 'var(--correct)';
    } else {
      token.style.opacity = '0.3';
    }
    container.appendChild(token);
  }
}

// --- Round intro ---

function renderRoundIntro(questionIndex) {
  const q = QUESTIONS[questionIndex];
  if (!q) return;
  const roundNum = q.round || 1;
  document.getElementById('round-label').textContent = `Round ${roundNum}`;
  document.getElementById('round-theme').textContent = q.theme || '';
  const count = QUESTIONS.filter(qq => qq.round === q.round).length;
  document.getElementById('round-subtitle').textContent = `${count} questions`;

  // Image du round
  const imgContainer = document.getElementById('round-image');
  imgContainer.innerHTML = '';
  const img = document.createElement('img');
  img.src = `assets/rounds/round-${roundNum}.jpg`;
  img.alt = q.theme || '';
  img.onerror = () => { imgContainer.style.display = 'none'; };
  img.onload = () => { imgContainer.style.display = ''; };
  imgContainer.appendChild(img);
}

// --- Question ---

let playerTokens = {};

function renderPlayersColumn(connectedPlayers) {
  const col = document.getElementById('players-column');
  col.innerHTML = '';
  playerTokens = {};
  // Normalize connectedPlayers (Firebase may return object instead of array)
  let players = connectedPlayers || [];
  if (!Array.isArray(players)) players = Object.values(players);

  for (const player of PLAYERS) {
    if (!players.includes(player.id)) continue;
    const token = createToken(player, 'neutral', { size: 'tv' });
    // Pré-insérer le badge (invisible) pour réserver l'espace
    const badge = document.createElement('span');
    badge.className = 'token-vote-badge';
    token.insertBefore(badge, token.querySelector('.token-avatar'));
    playerTokens[player.id] = token;
    col.appendChild(token);
  }
}

function renderQuestion(questionIndex, totalQuestions) {
  const q = QUESTIONS[questionIndex];
  if (!q) return;

  // Question X in round
  let qInRound = 1;
  for (let i = questionIndex - 1; i >= 0; i--) {
    if (QUESTIONS[i].round === q.round) qInRound++;
    else break;
  }
  const roundTotal = QUESTIONS.filter(qq => qq.round === q.round).length;

  document.getElementById('q-number').textContent =
    `Question ${qInRound}/${roundTotal}`;
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

  for (const [id, tokenEl] of Object.entries(playerTokens)) {
    const player = getPlayerById(id);
    if (player) updateTokenMood(tokenEl, player, 'neutral');
    tokenEl.dataset.voted = 'false';
    // Reset le badge
    const badge = tokenEl.querySelector('.token-vote-badge');
    if (badge) {
      badge.textContent = '';
      badge.classList.remove('badge-correct', 'badge-wrong');
    }
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

  const choicesEl = document.getElementById('q-choices');
  for (const div of choicesEl.children) {
    if (div.dataset.letter === q.answer) {
      div.classList.add('correct');
    }
  }

  if (q.explanation) {
    const explEl = document.getElementById('q-explanation');
    explEl.textContent = q.explanation;
    explEl.classList.add('visible');
  }

  if (results) {
    for (const [playerId, result] of Object.entries(results)) {
      const tokenEl = playerTokens[playerId];
      const player = getPlayerById(playerId);
      if (!tokenEl || !player) continue;
      updateTokenMood(tokenEl, player, result.correct ? 'happy' : 'sad');

      // Enlever le point vert "a voté"
      tokenEl.dataset.voted = 'false';

      // Afficher la lettre de réponse dans le badge
      const badge = tokenEl.querySelector('.token-vote-badge');
      if (!badge) continue;
      const voteText = result.vote || '—';
      badge.textContent = voteText;
      badge.classList.toggle('badge-correct', result.correct);
      badge.classList.toggle('badge-wrong', !result.correct);
    }
  }
}

// --- Scores ---

function renderScores(scores, targetEl, roundLabel) {
  const ranking = getRanking(scores || {});
  const maxScore = Math.max(1, ...ranking.map(r => r.score));

  targetEl = targetEl || document.getElementById('scoreboard');
  targetEl.innerHTML = '';

  if (roundLabel) {
    document.getElementById('scores-title').textContent = roundLabel;
  }

  const total = ranking.length;
  for (const { playerId, score, rank } of ranking) {
    const player = getPlayerById(playerId);
    if (!player) continue;

    // Mood selon le rang : top 3 = happy, bottom 3 = sad, milieu = neutral
    let mood = 'neutral';
    if (rank <= 3) mood = 'happy';
    else if (rank > total - 3) mood = 'sad';

    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.animationDelay = `${rank * 0.08}s`;

    row.innerHTML = `<span class="score-rank">${rank}.</span>`;

    const token = createToken(player, mood, { size: 'admin' });
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

  const order = [1, 0, 2];
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

  renderScores(scores, document.getElementById('final-scoreboard'), 'Classement final');
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

    case 'round-intro':
      renderRoundIntro(currentQuestion);
      renderPlayersColumn(connectedPlayers);
      break;

    case 'question':
      if (lastPhase !== 'question' || lastQuestionIndex !== currentQuestion) {
        renderPlayersColumn(connectedPlayers);
        renderQuestion(currentQuestion, totalQuestions);
      }
      updateVoteIndicators(currentVotes);
      break;

    case 'reveal':
      // Reveal animation triggered by revealResults listener
      break;

    case 'scores': {
      const q = QUESTIONS[currentQuestion];
      const label = q ? `Classement — Round ${q.round}` : 'Classement';
      renderScores(scores, null, label);
      break;
    }

    case 'final':
      renderFinal(scores);
      break;
  }

  lastPhase = phase;
  lastQuestionIndex = currentQuestion;
}

// --- Boot ---

function renderQRCode() {
  const playUrl = location.origin + '/play';
  const container = document.getElementById('qr-code');
  container.innerHTML = '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(playUrl);
    qr.make();
    container.innerHTML = qr.createImgTag(6, 0);
    const urlLabel = document.createElement('span');
    urlLabel.className = 'lobby-qr-url';
    urlLabel.textContent = playUrl.replace('https://', '');
    container.appendChild(urlLabel);
  } catch (e) {
    container.textContent = playUrl;
  }
}

async function boot() {
  await initDB();
  renderQRCode();

  dbListen('state', onStateChange);

  dbListen('votes', (votes) => {
    currentVotes = votes || {};
    if (currentState && currentState.phase === 'question') {
      updateVoteIndicators(currentVotes);
    }
  });

  dbListen('state/revealResults', (results) => {
    if (results && currentState) {
      renderReveal(currentState.currentQuestion, results);
    }
  });

  showScreen('lobby');
  renderLobby([]);
}

boot();
