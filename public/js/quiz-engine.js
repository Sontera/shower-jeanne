// quiz-engine.js — Machine à états du quiz
//
// Phases: lobby → round-intro → question → reveal → [question → reveal ...] → scores → round-intro → ... → final

export class QuizEngine {
  constructor(questions = [], players = []) {
    this._listeners = {};
    this._questions = questions;
    this._players = players;

    this._phase = 'lobby';
    this._currentQuestion = 0;
    this._votes = {};
    this._scores = {};
    this._connectedPlayers = new Set();

    for (const p of players) {
      this._scores[p.id] = 0;
    }
  }

  // --- Getters ---

  get phase() { return this._phase; }
  get currentQuestionIndex() { return this._currentQuestion; }
  get totalQuestions() { return this._questions.length; }
  get currentQuestion() { return this._questions[this._currentQuestion] || null; }
  get votes() { return { ...this._votes }; }
  get scores() { return { ...this._scores }; }
  get connectedPlayers() { return [...this._connectedPlayers]; }

  get isLastQuestion() {
    return this._currentQuestion >= this._questions.length - 1;
  }

  get voteCount() {
    return Object.values(this._votes).filter(v => v !== null).length;
  }

  get allVotesIn() {
    return this._connectedPlayers.size > 0 &&
      [...this._connectedPlayers].every(id => this._votes[id] != null);
  }

  /** Vrai si la question courante est la dernière de son round. */
  get isEndOfRound() {
    if (this.isLastQuestion) return true;
    const current = this._questions[this._currentQuestion];
    const next = this._questions[this._currentQuestion + 1];
    if (!current || !next) return true;
    if (current.round != null && next.round != null) {
      return current.round !== next.round;
    }
    return (this._currentQuestion + 1) % 5 === 0;
  }

  /** Numéro du round courant. */
  get currentRoundNumber() {
    const q = this._questions[this._currentQuestion];
    return q ? (q.round || 1) : 1;
  }

  /** Thème du round courant. */
  get currentRoundTheme() {
    const q = this._questions[this._currentQuestion];
    return q ? (q.theme || '') : '';
  }

  /** Index de la question dans son round (1-based). */
  get questionInRound() {
    const q = this._questions[this._currentQuestion];
    if (!q) return 1;
    let count = 1;
    for (let i = this._currentQuestion - 1; i >= 0; i--) {
      if (this._questions[i].round === q.round) count++;
      else break;
    }
    return count;
  }

  /** Nombre de questions dans le round courant. */
  get questionsInCurrentRound() {
    const q = this._questions[this._currentQuestion];
    if (!q) return 5;
    return this._questions.filter(qq => qq.round === q.round).length;
  }

  // --- Actions ---

  connectPlayer(playerId) {
    this._connectedPlayers.add(playerId);
    if (!(playerId in this._scores)) {
      this._scores[playerId] = 0;
    }
    this._emit('player-joined', playerId);
    this._emit('scores-update', this.scores);
  }

  /** Lobby → round-intro */
  startQuiz() {
    if (this._phase !== 'lobby') return;
    if (this._questions.length === 0) return;
    this._currentQuestion = 0;
    this._clearVotes();
    this._setPhase('round-intro');
  }

  /** Round-intro → question */
  startRound() {
    if (this._phase !== 'round-intro') return;
    this._clearVotes();
    this._setPhase('question');
  }

  castVote(playerId, choice) {
    if (this._phase !== 'question') return;
    if (!this._connectedPlayers.has(playerId)) return;

    this._votes[playerId] = choice;
    this._emit('vote', playerId, choice);

    if (this.allVotesIn) {
      this._emit('all-votes-in');
    }
  }

  /** Question → reveal */
  revealAnswer() {
    if (this._phase !== 'question') return;
    const q = this.currentQuestion;
    if (!q) return;

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

  /** Reveal → scores (fin de round uniquement) */
  showScores() {
    if (this._phase !== 'reveal') return;
    this._setPhase('scores');
  }

  /** Reveal → question suivante (mid-round) */
  nextQuestion() {
    if (this._phase === 'reveal' && !this.isEndOfRound) {
      this._currentQuestion++;
      this._clearVotes();
      this._setPhase('question');
      return;
    }
    // Après scores: round suivant ou final
    if (this._phase === 'scores') {
      if (this.isLastQuestion) {
        this._setPhase('final');
      } else {
        this._currentQuestion++;
        this._clearVotes();
        this._setPhase('round-intro');
      }
      return;
    }
  }

  goBack() {
    switch (this._phase) {
      case 'reveal':
        this._setPhase('question');
        break;
      case 'scores':
        this._setPhase('reveal');
        break;
      case 'question':
        if (this._currentQuestion > 0) {
          this._currentQuestion--;
          this._clearVotes();
          this._setPhase('reveal');
        }
        break;
      case 'round-intro':
        if (this._currentQuestion === 0) {
          this._setPhase('lobby');
        } else {
          this._setPhase('scores');
        }
        break;
    }
  }

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
}

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
