// admin.js — Vue animateur (maître : écrit l'état dans Firebase)

import { PLAYERS, createToken, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB, dbSet, dbGet, dbListen } from './db.js';

// --- Engine (seul l'admin en possède un) ---

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

// Flag pour éviter les boucles de sync pendant la restauration
let _restoring = false;

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
  btnScores.disabled = phase !== 'reveal';
  btnNext.disabled = phase !== 'scores';
  btnBack.disabled = phase === 'lobby' || phase === 'final';
  btnRandomVotes.disabled = phase !== 'question';

  document.getElementById('panel-config').style.display =
    phase === 'lobby' ? 'block' : 'none';
  document.getElementById('question-info').style.display =
    (phase === 'question' || phase === 'reveal') ? 'block' : 'none';
  document.getElementById('vote-status').style.display =
    (phase === 'question' || phase === 'reveal') ? 'block' : 'none';
}

function renderQuestionInfo() {
  const q = engine.currentQuestion;
  if (!q) return;
  document.getElementById('admin-q-text').textContent =
    `[${q.id}] ${q.text}`;
  const correctChoice = q.choices.find(c => c.startsWith(q.answer + ')')) || q.answer;
  document.getElementById('admin-q-answer').textContent =
    `Bonne réponse : ${correctChoice}`;
}

function renderVoteStatus() {
  const votes = engine.votes;
  const connected = engine.connectedPlayers;
  const voteList = document.getElementById('vote-list');
  voteList.innerHTML = '';

  let count = 0;
  for (const playerId of connected) {
    const player = getPlayerById(playerId);
    if (!player) continue;

    const row = document.createElement('div');
    row.className = 'vote-row';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;

    const voteSpan = document.createElement('span');
    const vote = votes[playerId];
    if (vote != null) {
      voteSpan.className = 'vote-choice';
      voteSpan.textContent = vote;
      count++;
    } else {
      voteSpan.className = 'vote-pending';
      voteSpan.textContent = 'en attente...';
    }

    row.appendChild(nameSpan);
    row.appendChild(voteSpan);
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
  syncState();
});

engine.on('vote', () => {
  renderVoteStatus();
  syncState();
});

engine.on('answer-revealed', (_qi, _answer, results) => {
  syncRevealResults(results);
  syncState();
});

engine.on('scores-update', () => {
  syncState();
});

engine.on('player-joined', () => {
  renderPlayerList();
});

// --- Listen for votes from players (Firebase → engine) ---

function listenForVotes() {
  dbListen('votes', (votes) => {
    if (!votes || engine.phase !== 'question') return;
    for (const [playerId, choice] of Object.entries(votes)) {
      if (choice != null && engine.votes[playerId] == null) {
        engine.castVote(playerId, choice);
      }
    }
  });
}

// --- Listen for player connections ---

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

// --- Connecter tous les joueurs (test) ---

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

// --- Simuler votes aléatoires ---

async function simulateRandomVotes() {
  if (engine.phase !== 'question') return;
  const q = engine.currentQuestion;
  if (!q) return;

  const letters = q.choices.map(c => c.charAt(0));
  for (const playerId of engine.connectedPlayers) {
    if (engine.votes[playerId] != null) continue; // déjà voté
    const randomChoice = letters[Math.floor(Math.random() * letters.length)];
    await dbSet(`votes/${playerId}`, randomChoice);
    engine.castVote(playerId, randomChoice);
  }
}

// --- Reset quiz avec confirmation ---

async function resetQuiz() {
  if (!confirm('Recommencer le quiz depuis le début?\n\nTous les scores et le progrès seront perdus.')) {
    return;
  }

  // Recréer un engine frais
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
    // Pas de partie en cours, on reste en lobby
    updateControls('lobby');
    renderPlayerList();
    return false;
  }

  _restoring = true;

  // Restaurer les joueurs connectés
  // Firebase convertit les arrays en objets, il faut reconvertir
  let connectedPlayers = savedState.connectedPlayers || [];
  if (!Array.isArray(connectedPlayers)) {
    connectedPlayers = Object.values(connectedPlayers);
  }
  for (const playerId of connectedPlayers) {
    if (!engine.connectedPlayers.includes(playerId)) {
      engine.connectPlayer(playerId);
    }
  }

  // Restaurer les scores
  if (savedState.scores) {
    for (const [playerId, score] of Object.entries(savedState.scores)) {
      engine._scores[playerId] = score;
    }
  }

  // Restaurer la position dans le quiz
  engine._currentQuestion = savedState.currentQuestion || 0;
  engine._clearVotes();

  // Restaurer les votes en cours si on est en phase question
  if (savedVotes && savedState.phase === 'question') {
    for (const [playerId, choice] of Object.entries(savedVotes)) {
      if (choice != null) {
        engine._votes[playerId] = choice;
      }
    }
  }

  // Restaurer la phase
  engine._phase = savedState.phase;

  _restoring = false;

  // Mettre à jour l'UI
  updateControls(engine.phase);
  renderPlayerList();
  if (engine.phase === 'question' || engine.phase === 'reveal') {
    renderQuestionInfo();
    renderVoteStatus();
  }

  console.log(`[admin] État restauré: phase=${engine.phase}, question=${engine.currentQuestionIndex + 1}/${engine.totalQuestions}`);
  return true;
}

// --- Button handlers ---

btnStart.addEventListener('click', () => engine.startQuiz());
btnReveal.addEventListener('click', () => engine.revealAnswer());
btnScores.addEventListener('click', () => engine.showScores());
btnNext.addEventListener('click', () => engine.nextQuestion());
btnBack.addEventListener('click', () => engine.goBack());
btnConnectAll.addEventListener('click', connectAllPlayers);
btnRandomVotes.addEventListener('click', simulateRandomVotes);
btnReset.addEventListener('click', resetQuiz);

// --- Boot ---

async function boot() {
  await initDB();

  // Tenter de restaurer une partie en cours
  const restored = await restoreState();

  if (!restored) {
    // Première session ou lobby — initialiser proprement
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
