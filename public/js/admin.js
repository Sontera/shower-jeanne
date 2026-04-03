// admin.js — Vue animateur (maître : écrit l'état dans Firebase)

import { PLAYERS, createToken, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB, dbSet, dbListen } from './db.js';

// --- Engine (seul l'admin en possède un) ---

const engine = new QuizEngine(QUESTIONS, PLAYERS);

// --- DOM ---

const phaseBadge = document.getElementById('phase-badge');
const btnStart = document.getElementById('btn-start');
const btnReveal = document.getElementById('btn-reveal');
const btnScores = document.getElementById('btn-scores');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');

// --- Sync engine → Firebase ---

function syncState() {
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
    const token = createToken(player, 'neutral', { size: 'admin' });
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

// --- Button handlers ---

btnStart.addEventListener('click', () => engine.startQuiz());
btnReveal.addEventListener('click', () => engine.revealAnswer());
btnScores.addEventListener('click', () => engine.showScores());
btnNext.addEventListener('click', () => engine.nextQuestion());
btnBack.addEventListener('click', () => engine.goBack());

// --- Boot ---

async function boot() {
  await initDB();

  // Reset Firebase state
  await dbSet('state', {
    phase: 'lobby',
    currentQuestion: 0,
    scores: {},
    connectedPlayers: [],
    totalQuestions: engine.totalQuestions,
  });
  await dbSet('votes', null);
  await dbSet('players', null);

  renderPlayerList();
  updateControls('lobby');

  listenForVotes();
  listenForPlayers();
}

boot();
