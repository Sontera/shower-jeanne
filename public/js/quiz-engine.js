// quiz-engine.js — Machine à états du quiz

const PHASES = ['lobby', 'question', 'reveal', 'scores', 'final'];

/**
 * QuizEngine gère l'état complet du quiz.
 * Fonctionne en local (in-memory). La couche db.js synchronise avec Firebase.
 *
 * Usage:
 *   const engine = new QuizEngine(questions, players);
 *   engine.on('phase-change', (phase) => { ... });
 *   engine.on('vote', (playerId, choice) => { ... });
 *   engine.on('scores-update', (scores) => { ... });
 */
export class QuizEngine {
  constructor(questions = [], players = []) {
    this._listeners = {};
    this._questions = questions;
    this._players = players;

    // State
    this._phase = 'lobby';
    this._currentQuestion = 0;
    this._votes = {};       // { playerId: 'A'|'B'|'C'|'D' }
    this._scores = {};      // { playerId: number }
    this._connectedPlayers = new Set();

    // Initialiser les scores à 0
    for (const p of players) {
      this._scores[p.id] = 0;
    }
  }

  // --- Getters ---

  get phase() { return this._phase; }
  get currentQuestionIndex() { return this._currentQuestion; }
  get totalQuestions() { return this._questions.length; }

  get currentQuestion() {
    return this._questions[this._currentQuestion] || null;
  }

  get votes() { return { ...this._votes }; }
  get scores() { return { ...this._scores }; }
  get connectedPlayers() { return [...this._connectedPlayers]; }

  get isLastQuestion() {
    return this._currentQuestion >= this._questions.length - 1;
  }

  /**
   * Nombre de joueurs ayant voté pour la question en cours.
   */
  get voteCount() {
    return Object.values(this._votes).filter(v => v !== null).length;
  }

  /**
   * Tous les joueurs connectés ont voté ?
   */
  get allVotesIn() {
    return this._connectedPlayers.size > 0 &&
      [...this._connectedPlayers].every(id => this._votes[id] != null);
  }

  // --- Actions (appelées par l'admin) ---

  /**
   * Un joueur rejoint la partie.
   */
  connectPlayer(playerId) {
    this._connectedPlayers.add(playerId);
    if (!(playerId in this._scores)) {
      this._scores[playerId] = 0;
    }
    this._emit('player-joined', playerId);
    this._emit('scores-update', this.scores);
  }

  /**
   * Lancer le quiz depuis le lobby.
   */
  startQuiz() {
    if (this._phase !== 'lobby') return;
    if (this._questions.length === 0) return;
    this._currentQuestion = 0;
    this._clearVotes();
    this._setPhase('question');
  }

  /**
   * Un joueur soumet son vote.
   */
  castVote(playerId, choice) {
    if (this._phase !== 'question') return;
    if (!this._connectedPlayers.has(playerId)) return;
    // Un seul vote par question
    if (this._votes[playerId] != null) return;

    this._votes[playerId] = choice;
    this._emit('vote', playerId, choice);

    if (this.allVotesIn) {
      this._emit('all-votes-in');
    }
  }

  /**
   * Révéler la bonne réponse (animateur clique "Révéler").
   */
  revealAnswer() {
    if (this._phase !== 'question') return;
    const q = this.currentQuestion;
    if (!q) return;

    // Calculer les points
    const results = {};
    for (const playerId of this._connectedPlayers) {
      const vote = this._votes[playerId];
      const correct = vote != null && vote === q.answer;
      if (correct) {
        this._scores[playerId] = (this._scores[playerId] || 0) + 1;
      }
      results[playerId] = { vote, correct };
    }

    this._setPhase('reveal');
    this._emit('answer-revealed', this._currentQuestion, q.answer, results);
    this._emit('scores-update', this.scores);
  }

  /**
   * Afficher le classement.
   */
  showScores() {
    if (this._phase !== 'reveal') return;
    this._setPhase('scores');
  }

  /**
   * Passer à la question suivante.
   */
  nextQuestion() {
    if (this._phase !== 'scores') return;

    if (this.isLastQuestion) {
      this._setPhase('final');
      return;
    }

    this._currentQuestion++;
    this._clearVotes();
    this._setPhase('question');
  }

  /**
   * Revenir en arrière (undo).
   */
  goBack() {
    switch (this._phase) {
      case 'reveal':
        // Annuler la révélation — on devrait retirer les points attribués
        // Pour simplifier, on recalcule tout
        this._recalculateScores();
        this._setPhase('question');
        break;
      case 'scores':
        this._setPhase('reveal');
        break;
      case 'question':
        if (this._currentQuestion > 0) {
          this._currentQuestion--;
          this._clearVotes();
          this._setPhase('scores');
        }
        break;
    }
  }

  /**
   * Charger un état complet (pour restauration ou sync Firebase).
   */
  loadState(state) {
    this._phase = state.phase || 'lobby';
    this._currentQuestion = state.currentQuestion || 0;
    this._votes = state.votes || {};
    this._scores = state.scores || {};
    this._connectedPlayers = new Set(state.connectedPlayers || []);
    this._emit('state-loaded', this.getState());
    this._emit('phase-change', this._phase);
    this._emit('scores-update', this.scores);
  }

  /**
   * Exporter l'état complet.
   */
  getState() {
    return {
      phase: this._phase,
      currentQuestion: this._currentQuestion,
      votes: { ...this._votes },
      scores: { ...this._scores },
      connectedPlayers: [...this._connectedPlayers],
    };
  }

  // --- Event emitter ---

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  _emit(event, ...args) {
    for (const fn of this._listeners[event] || []) {
      fn(...args);
    }
  }

  // --- Internal ---

  _setPhase(phase) {
    this._phase = phase;
    this._emit('phase-change', phase);
  }

  _clearVotes() {
    this._votes = {};
    for (const id of this._connectedPlayers) {
      this._votes[id] = null;
    }
  }

  /**
   * Recalcule tous les scores depuis le début jusqu'à la question courante (excluant).
   * Utilisé pour le undo.
   */
  _recalculateScores() {
    const scores = {};
    for (const id of this._connectedPlayers) {
      scores[id] = 0;
    }
    // Note: on n'a pas l'historique des votes passés en mémoire pour l'instant.
    // Pour un vrai undo, il faudrait stocker l'historique.
    // Pour l'instant, on ne touche pas aux scores lors du goBack depuis reveal.
    // TODO: stocker l'historique des votes pour un undo propre
  }
}

/**
 * Retourne le classement trié (du meilleur au moins bon).
 * @param {Object} scores - { playerId: number }
 * @returns {Array<{playerId, score, rank}>}
 */
export function getRanking(scores) {
  const sorted = Object.entries(scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score);

  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      rank = i + 1;
    }
    sorted[i].rank = rank;
  }
  return sorted;
}
