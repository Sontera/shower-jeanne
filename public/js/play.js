// play.js — Logique de la vue joueur (mobile)

import { PLAYERS, createToken, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { QuizEngine, getRanking } from './quiz-engine.js';
import { initDB } from './db.js';

// --- Init ---

const engine = new QuizEngine(QUESTIONS, PLAYERS);

let myPlayerId = null;

// Écrans
function showPlayScreen(id) {
  const ids = ['screen-join', 'screen-waiting', 'screen-vote', 'screen-voted', 'screen-result'];
  for (const sid of ids) {
    const el = document.getElementById(sid);
    if (sid === id) {
      el.classList.add('active');
      el.style.display = '';
    } else {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  }
  // Header visible seulement quand connecté
  document.getElementById('play-header').style.display = myPlayerId ? 'flex' : 'none';
}

// --- Écran de connexion ---

function renderJoinScreen() {
  const container = document.getElementById('player-select');
  container.innerHTML = '';

  for (const player of PLAYERS) {
    const btn = document.createElement('button');
    btn.className = 'player-select-btn';

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = player.color;

    const name = document.createElement('span');
    name.textContent = player.name;

    btn.appendChild(dot);
    btn.appendChild(name);
    btn.addEventListener('click', () => joinAs(player.id));
    container.appendChild(btn);
  }
}

function joinAs(playerId) {
  myPlayerId = playerId;
  const player = getPlayerById(playerId);
  document.getElementById('my-name').textContent = player.name;
  engine.connectPlayer(playerId);
  updateMyScore();
  onPhaseChange(engine.phase);
}

function updateMyScore() {
  if (!myPlayerId) return;
  const score = engine.scores[myPlayerId] || 0;
  document.getElementById('my-score').textContent = `${score} pts`;
}

// --- Écran de vote ---

function renderVoteScreen() {
  const q = engine.currentQuestion;
  if (!q) return;

  document.getElementById('vote-question').textContent = q.text;

  const container = document.getElementById('vote-buttons');
  container.innerHTML = '';

  for (const choice of q.choices) {
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.textContent = choice;
    const letter = choice.charAt(0);
    btn.addEventListener('click', () => {
      engine.castVote(myPlayerId, letter);
      showPlayScreen('screen-voted');
    });
    container.appendChild(btn);
  }
}

// --- Écran résultat ---

function renderResult(questionIndex, correctAnswer, results) {
  if (!myPlayerId || !results[myPlayerId]) return;

  const { vote, correct } = results[myPlayerId];
  const q = engine.currentQuestion;

  const icon = document.getElementById('result-icon');
  icon.className = 'result-icon ' + (correct ? 'correct' : 'wrong');
  icon.textContent = correct ? '\u2714' : '\u2718';

  const correctChoice = q.choices.find(c => c.startsWith(correctAnswer + ')')) || correctAnswer;
  document.getElementById('result-answer').textContent =
    correct ? `Bonne réponse : ${correctChoice}` : `La bonne réponse était : ${correctChoice}`;

  updateMyScore();
  const score = engine.scores[myPlayerId] || 0;
  document.getElementById('result-score').textContent = `${score} pts`;

  const ranking = getRanking(engine.scores);
  const myRank = ranking.find(r => r.playerId === myPlayerId);
  document.getElementById('result-rank').textContent =
    myRank ? `${myRank.rank}e / ${ranking.length}` : '';

  showPlayScreen('screen-result');
}

// --- Phase changes ---

function onPhaseChange(phase) {
  if (!myPlayerId) {
    showPlayScreen('screen-join');
    return;
  }

  switch (phase) {
    case 'lobby':
      showPlayScreen('screen-waiting');
      break;
    case 'question':
      renderVoteScreen();
      showPlayScreen('screen-vote');
      break;
    case 'reveal':
      // Le résultat est rendu par l'event answer-revealed
      break;
    case 'scores':
      updateMyScore();
      showPlayScreen('screen-waiting');
      break;
    case 'final':
      updateMyScore();
      showPlayScreen('screen-result');
      break;
  }
}

// --- Events ---

engine.on('phase-change', onPhaseChange);
engine.on('answer-revealed', renderResult);
engine.on('scores-update', updateMyScore);

// --- Boot ---

async function boot() {
  await initDB();

  // En mode offline, connecter tous les joueurs
  for (const p of PLAYERS) {
    engine.connectPlayer(p.id);
  }

  renderJoinScreen();
  showPlayScreen('screen-join');
}

boot();

window.__quizEngine = engine;
