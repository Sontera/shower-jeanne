// play.js — Vue joueur (écoute Firebase, écrit ses votes)

import { PLAYERS, getPlayerById } from './players.js';
import { QUESTIONS } from './questions.js';
import { getRanking } from './quiz-engine.js';
import { initDB, dbSet, dbListen } from './db.js';

// --- State ---

let myPlayerId = null;
let currentState = null;

// --- Screens ---

function showPlayScreen(id) {
  const ids = ['screen-join', 'screen-waiting', 'screen-vote', 'screen-voted', 'screen-result'];
  for (const sid of ids) {
    const el = document.getElementById(sid);
    el.style.display = sid === id ? '' : 'none';
    if (sid === id) el.classList.add('active');
    else el.classList.remove('active');
  }
  document.getElementById('play-header').style.display = myPlayerId ? 'flex' : 'none';
}

// --- Join ---

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

async function joinAs(playerId) {
  myPlayerId = playerId;
  const player = getPlayerById(playerId);
  document.getElementById('my-name').textContent = player.name;

  // Écrire dans Firebase que ce joueur est connecté
  await dbSet(`players/${playerId}`, true);

  // Afficher l'écran approprié selon la phase actuelle
  if (currentState) {
    onStateChange(currentState);
  } else {
    showPlayScreen('screen-waiting');
  }
}

// --- Vote ---

function renderVoteScreen(questionIndex) {
  const q = QUESTIONS[questionIndex];
  if (!q) return;

  document.getElementById('vote-question').textContent = q.text;

  const container = document.getElementById('vote-buttons');
  container.innerHTML = '';

  for (const choice of q.choices) {
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.textContent = choice;
    const letter = choice.charAt(0);
    btn.addEventListener('click', async () => {
      // Écrire le vote dans Firebase
      await dbSet(`votes/${myPlayerId}`, letter);
      showPlayScreen('screen-voted');
    });
    container.appendChild(btn);
  }
}

// --- Result ---

function renderResult(questionIndex, results, scores) {
  if (!myPlayerId || !results || !results[myPlayerId]) return;

  const { vote, correct } = results[myPlayerId];
  const q = QUESTIONS[questionIndex];

  const icon = document.getElementById('result-icon');
  icon.className = 'result-icon ' + (correct ? 'correct' : 'wrong');
  icon.textContent = correct ? '\u2714' : '\u2718';

  const correctChoice = q.choices.find(c => c.startsWith(q.answer + ')')) || q.answer;
  document.getElementById('result-answer').textContent =
    correct ? `Bonne réponse : ${correctChoice}` : `La bonne réponse était : ${correctChoice}`;

  const myScore = (scores && scores[myPlayerId]) || 0;
  document.getElementById('result-score').textContent = `${myScore} pts`;

  const ranking = getRanking(scores || {});
  const myRank = ranking.find(r => r.playerId === myPlayerId);
  document.getElementById('result-rank').textContent =
    myRank ? `${myRank.rank}e / ${ranking.length}` : '';

  updateMyScore(scores);
}

function updateMyScore(scores) {
  if (!myPlayerId) return;
  const score = (scores && scores[myPlayerId]) || 0;
  document.getElementById('my-score').textContent = `${score} pts`;
}

// --- State listener ---

let lastPhase = null;
let lastQuestionIndex = null;

function onStateChange(state) {
  console.log('[play] state reçu:', JSON.stringify(state));
  console.log('[play] myPlayerId:', myPlayerId);
  if (!state) return;
  currentState = state;
  const { phase, currentQuestion, scores } = state;

  if (!myPlayerId) {
    showPlayScreen('screen-join');
    return;
  }

  updateMyScore(scores);

  switch (phase) {
    case 'lobby':
      showPlayScreen('screen-waiting');
      break;

    case 'question':
      if (lastPhase !== 'question' || lastQuestionIndex !== currentQuestion) {
        renderVoteScreen(currentQuestion);
        showPlayScreen('screen-vote');
      }
      break;

    case 'reveal':
      // Result will be rendered by revealResults listener
      if (lastPhase === 'question') {
        // Stay on voted/vote screen until results arrive
      }
      break;

    case 'scores':
      updateMyScore(scores);
      showPlayScreen('screen-waiting');
      break;

    case 'final':
      updateMyScore(scores);
      showPlayScreen('screen-result');
      // Show final ranking
      const ranking = getRanking(scores || {});
      const myRank = ranking.find(r => r.playerId === myPlayerId);
      document.getElementById('result-icon').className = 'result-icon correct';
      document.getElementById('result-icon').textContent = '\uD83C\uDFC6';
      document.getElementById('result-answer').textContent = 'Quiz terminé!';
      document.getElementById('result-score').textContent =
        `${(scores && scores[myPlayerId]) || 0} pts`;
      document.getElementById('result-rank').textContent =
        myRank ? `Classement final : ${myRank.rank}e / ${ranking.length}` : '';
      break;
  }

  lastPhase = phase;
  lastQuestionIndex = currentQuestion;
}

// --- Boot ---

async function boot() {
  await initDB();

  renderJoinScreen();
  showPlayScreen('screen-join');

  // Écouter l'état du quiz
  dbListen('state', onStateChange);

  // Écouter les résultats de révélation
  dbListen('state/revealResults', (results) => {
    if (results && currentState && myPlayerId) {
      renderResult(currentState.currentQuestion, results, currentState.scores);
      showPlayScreen('screen-result');
    }
  });
}

boot();
