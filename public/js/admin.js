// admin.js — Vue animateur (maître : écrit l'état dans Firebase)

import { PLAYERS, createToken, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB, dbSet, dbGet, dbListen } from './db.js';
import { playRoundMusic, playFile, fadeOut, stop as stopMusic, setVolume, getVolume, isPlaying } from './music.js';

const engine = new QuizEngine(QUESTIONS, PLAYERS);

// --- DOM ---

const phaseBadge = document.getElementById('phase-badge');
const btnStart = document.getElementById('btn-start');
const btnReveal = document.getElementById('btn-reveal');
const btnScores = document.getElementById('btn-scores');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const btnConnectAll = document.getElementById('btn-connect-all');
const btnRandomVotes = document.getElementById('btn-random-votes');
const btnReset = document.getElementById('btn-reset');
const btnPodium = document.getElementById('btn-podium');
const btnJeopardy = document.getElementById('btn-jeopardy');
const btnMute = document.getElementById('btn-mute');
const volumeSlider = document.getElementById('volume-slider');

let _restoring = false;
let _muted = false;
let _savedVolume = 0.35;

// --- Sync engine → Firebase ---

function syncState() {
  if (_restoring) return;
  const state = engine.getState();
  dbSet('state', {
    phase: state.phase,
    currentQuestion: state.currentQuestion,
    scores: state.scores,
    connectedPlayers: state.connectedPlayers,
    totalQuestions: engine.totalQuestions,
  });
}

function syncRevealResults(results) {
  dbSet('state/revealResults', results);
}

function clearVotes() {
  dbSet('votes', null);
}

// --- Render ---

function renderPlayerList() {
  const list = document.getElementById('admin-player-list');
  list.innerHTML = '';
  for (const player of PLAYERS) {
    const connected = engine.connectedPlayers.includes(player.id);
    const token = createToken(player, 'neutral', { size: 'admin' });
    if (!connected) token.style.opacity = '0.4';
    list.appendChild(token);
  }
}

function updateControls(phase) {
  phaseBadge.textContent = phase;

  btnStart.disabled = phase !== 'lobby';
  btnReveal.disabled = phase !== 'question';
  btnRandomVotes.disabled = phase !== 'question';

  // After reveal: "Classement" at end of round (sauf dernière question), "Question suivante" mid-round
  if (phase === 'reveal') {
    if (engine.isLastQuestion) {
      // Dernière question : aller direct au podium
      btnScores.disabled = true;
      btnNext.disabled = false;
      btnNext.textContent = 'Podium final';
    } else if (engine.isEndOfRound) {
      btnScores.disabled = false;
      btnScores.textContent = 'Classement';
      btnNext.disabled = true;
    } else {
      btnScores.disabled = true;
      btnNext.disabled = false;
      btnNext.textContent = 'Question suivante';
    }
  } else if (phase === 'scores') {
    btnScores.disabled = true;
    btnNext.disabled = false;
    btnNext.textContent = 'Round suivant';
  } else if (phase === 'round-intro') {
    btnScores.disabled = true;
    btnNext.disabled = false;
    btnNext.textContent = 'Commencer le round';
  } else {
    btnScores.disabled = true;
    btnNext.disabled = true;
    btnNext.textContent = 'Question suivante';
  }

  btnBack.disabled = phase === 'lobby' || phase === 'final';

  // Bouton podium : activé dès que le quiz a commencé
  btnPodium.disabled = phase === 'lobby';

  document.getElementById('panel-config').style.display =
    phase === 'lobby' ? 'block' : 'none';

  const showQuestion = phase === 'question' || phase === 'reveal';
  document.getElementById('admin-q-position').style.display = showQuestion ? 'block' : 'none';
  document.getElementById('question-info').style.display = showQuestion ? 'block' : 'none';
  document.getElementById('vote-status').style.display = showQuestion ? 'block' : 'none';

  // Masquer la réponse et l'explication pendant la phase question, montrer en reveal
  const isReveal = phase === 'reveal';
  document.getElementById('admin-q-answer').style.display = isReveal ? 'block' : 'none';
  document.getElementById('admin-q-explanation').style.display = isReveal ? 'block' : 'none';
}

function renderQuestionInfo() {
  const q = engine.currentQuestion;
  if (!q) return;

  // Question X dans le round
  let qInRound = engine.questionInRound;
  let roundTotal = engine.questionsInCurrentRound;

  document.getElementById('admin-q-position').textContent =
    `Round ${q.round || '?'} — Question ${qInRound}/${roundTotal}`;
  document.getElementById('admin-q-text').textContent = q.text;

  const choicesEl = document.getElementById('admin-q-choices');
  choicesEl.innerHTML = '';
  for (const choice of q.choices) {
    const p = document.createElement('p');
    p.textContent = choice;
    choicesEl.appendChild(p);
  }

  const correctChoice = q.choices.find(c => c.startsWith(q.answer + ')')) || q.answer;
  document.getElementById('admin-q-answer').textContent =
    `Bonne réponse : ${correctChoice}`;
  document.getElementById('admin-q-explanation').textContent = q.explanation || '';
}

function renderVoteStatus() {
  const votes = engine.votes;
  const connected = engine.connectedPlayers;
  const q = engine.currentQuestion;
  const voteList = document.getElementById('vote-list');
  voteList.innerHTML = '';

  const letters = q ? q.choices.map(c => c.charAt(0)) : ['A', 'B', 'C', 'D'];

  let count = 0;
  for (const playerId of connected) {
    const player = getPlayerById(playerId);
    if (!player) continue;

    const row = document.createElement('div');
    row.className = 'vote-row';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;

    const vote = votes[playerId];
    if (vote != null) count++;

    // Boutons pour voter à la place du joueur
    const btnsWrap = document.createElement('span');
    btnsWrap.className = 'vote-proxy-buttons';
    for (const letter of letters) {
      const btn = document.createElement('button');
      btn.className = 'vote-proxy-btn' + (vote === letter ? ' active' : '');
      btn.textContent = letter;
      btn.addEventListener('click', async () => {
        await dbSet(`votes/${playerId}`, letter);
        engine.castVote(playerId, letter);
      });
      btnsWrap.appendChild(btn);
    }

    row.appendChild(nameSpan);
    row.appendChild(btnsWrap);
    voteList.appendChild(row);
  }

  document.getElementById('vote-count').textContent = count;
  document.getElementById('player-count').textContent = connected.length;
}

// --- Engine events → sync + render ---

engine.on('phase-change', (phase) => {
  updateControls(phase);
  if (phase === 'question') {
    renderQuestionInfo();
    renderVoteStatus();
    clearVotes();
  }
  // Musique d'ambiance automatique
  if (phase === 'round-intro') {
    playRoundMusic(engine.currentRoundNumber);
  } else if (phase === 'reveal' || phase === 'scores' || phase === 'final') {
    fadeOut();
  } else if (phase === 'lobby') {
    stopMusic();
  }
  syncState();
});

engine.on('vote', () => {
  renderVoteStatus();
  syncState();
});

engine.on('answer-revealed', (_qi, _answer, results) => {
  syncRevealResults(results);
  syncState();
  updateControls('reveal');
});

engine.on('scores-update', () => {
  syncState();
});

engine.on('player-joined', () => {
  renderPlayerList();
});

// --- Firebase listeners ---

function listenForVotes() {
  dbListen('votes', (votes) => {
    if (!votes || engine.phase !== 'question') return;
    for (const [playerId, choice] of Object.entries(votes)) {
      if (choice != null && engine.votes[playerId] !== choice) {
        engine.castVote(playerId, choice);
      }
    }
  });
}

function listenForPlayers() {
  dbListen('players', (players) => {
    if (!players) return;
    for (const playerId of Object.keys(players)) {
      if (!engine.connectedPlayers.includes(playerId)) {
        engine.connectPlayer(playerId);
        renderVoteStatus();
        syncState();
      }
    }
  });
}

// --- Test tools ---

async function connectAllPlayers() {
  for (const player of PLAYERS) {
    await dbSet(`players/${player.id}`, true);
    if (!engine.connectedPlayers.includes(player.id)) {
      engine.connectPlayer(player.id);
    }
  }
  renderPlayerList();
  renderVoteStatus();
  syncState();
}

async function simulateRandomVotes() {
  if (engine.phase !== 'question') return;
  const q = engine.currentQuestion;
  if (!q) return;

  const letters = q.choices.map(c => c.charAt(0));
  for (const playerId of engine.connectedPlayers) {
    if (engine.votes[playerId] != null) continue;
    const randomChoice = letters[Math.floor(Math.random() * letters.length)];
    await dbSet(`votes/${playerId}`, randomChoice);
    engine.castVote(playerId, randomChoice);
  }
}

async function resetQuiz() {
  if (!confirm('Recommencer le quiz depuis le début?\n\nTous les scores et le progrès seront perdus.')) return;

  engine.loadState({
    phase: 'lobby',
    currentQuestion: 0,
    votes: {},
    scores: {},
    connectedPlayers: [],
  });

  await dbSet('state', {
    phase: 'lobby',
    currentQuestion: 0,
    scores: {},
    connectedPlayers: [],
    totalQuestions: engine.totalQuestions,
  });
  await dbSet('votes', null);
  await dbSet('state/revealResults', null);
  await dbSet('players', null);

  renderPlayerList();
  updateControls('lobby');
}

// --- Restaurer l'état depuis Firebase ---

async function restoreState() {
  const savedState = await dbGet('state');
  const savedVotes = await dbGet('votes');

  if (!savedState || !savedState.phase || savedState.phase === 'lobby') {
    updateControls('lobby');
    renderPlayerList();
    return false;
  }

  _restoring = true;

  let connectedPlayers = savedState.connectedPlayers || [];
  if (!Array.isArray(connectedPlayers)) connectedPlayers = Object.values(connectedPlayers);
  for (const playerId of connectedPlayers) {
    if (!engine.connectedPlayers.includes(playerId)) {
      engine.connectPlayer(playerId);
    }
  }

  if (savedState.scores) {
    for (const [playerId, score] of Object.entries(savedState.scores)) {
      engine._scores[playerId] = score;
    }
  }

  engine._currentQuestion = savedState.currentQuestion || 0;
  engine._clearVotes();

  if (savedVotes && savedState.phase === 'question') {
    for (const [playerId, choice] of Object.entries(savedVotes)) {
      if (choice != null) engine._votes[playerId] = choice;
    }
  }

  engine._phase = savedState.phase;
  _restoring = false;

  updateControls(engine.phase);
  renderPlayerList();
  if (engine.phase === 'question' || engine.phase === 'reveal') {
    renderQuestionInfo();
    renderVoteStatus();
  }

  return true;
}

// --- Button handlers ---

btnStart.addEventListener('click', () => engine.startQuiz());
btnReveal.addEventListener('click', () => engine.revealAnswer());
btnScores.addEventListener('click', () => engine.showScores());
btnNext.addEventListener('click', () => {
  if (engine.phase === 'round-intro') {
    engine.startRound();
  } else {
    engine.nextQuestion();
  }
});
btnBack.addEventListener('click', () => engine.goBack());
btnPodium.addEventListener('click', () => {
  if (!confirm('Aller directement au podium final?')) return;
  engine.goToFinal();
});
btnConnectAll.addEventListener('click', connectAllPlayers);
btnRandomVotes.addEventListener('click', simulateRandomVotes);
btnReset.addEventListener('click', resetQuiz);
btnJeopardy.addEventListener('click', () => {
  if (isPlaying()) {
    stopMusic();
    btnJeopardy.textContent = 'Jeopardy';
    return;
  }
  playFile('assets/jeopardy.mp3', {
    onEnded: () => { btnJeopardy.textContent = 'Jeopardy'; }
  });
  btnJeopardy.textContent = 'Stop Jeopardy';
});

btnMute.addEventListener('click', () => {
  _muted = !_muted;
  if (_muted) {
    setVolume(0);
    btnMute.textContent = 'Unmute';
  } else {
    setVolume(_savedVolume);
    btnMute.textContent = 'Mute musique';
  }
});

volumeSlider.addEventListener('input', (e) => {
  _savedVolume = e.target.value / 100;
  if (!_muted) {
    setVolume(_savedVolume);
  }
});

// --- Boot ---

async function boot() {
  await initDB();
  const restored = await restoreState();
  if (!restored) {
    await dbSet('state', {
      phase: 'lobby',
      currentQuestion: 0,
      scores: {},
      connectedPlayers: [],
      totalQuestions: engine.totalQuestions,
    });
  }
  listenForVotes();
  listenForPlayers();
}

boot();
