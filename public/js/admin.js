// admin.js — Logique de la vue animateur

import { PLAYERS, createToken, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB } from './db.js';

// --- Init ---

const engine = new QuizEngine(QUESTIONS, PLAYERS);

// DOM
const phaseBadge = document.getElementById('phase-badge');
const btnStart = document.getElementById('btn-start');
const btnReveal = document.getElementById('btn-reveal');
const btnScores = document.getElementById('btn-scores');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');

// --- Render functions ---

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

  // Afficher/cacher les panneaux
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
  document.getElementById('admin-q-answer').textContent =
    `Bonne réponse : ${q.answer}) — ${q.choices.find(c => c.startsWith(q.answer + ')')) || q.answer}`;
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

// --- Events ---

engine.on('phase-change', (phase) => {
  updateControls(phase);
  if (phase === 'question') {
    renderQuestionInfo();
    renderVoteStatus();
  }
});

engine.on('vote', () => {
  renderVoteStatus();
});

// --- Button handlers ---

btnStart.addEventListener('click', () => engine.startQuiz());
btnReveal.addEventListener('click', () => engine.revealAnswer());
btnScores.addEventListener('click', () => engine.showScores());
btnNext.addEventListener('click', () => engine.nextQuestion());
btnBack.addEventListener('click', () => engine.goBack());

// --- Boot ---

async function boot() {
  await initDB();

  for (const p of PLAYERS) {
    engine.connectPlayer(p.id);
  }

  renderPlayerList();
  updateControls('lobby');
}

boot();

window.__quizEngine = engine;
