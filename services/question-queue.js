import { Question } from '../domain/models.js';
import { shuffle, take } from '../domain/randomizer.js';

export class QuestionQueue {
  constructor(cards, { count } = {}) {
    const pool = count ? take(shuffle(cards), count) : shuffle(cards);
    this.questions = pool.map((card) => new Question(card));
    this.index = 0;
    this.seen = 0;
  }

  current() {
    return this.questions[this.index] ?? null;
  }

  progress() {
    const total = this.questions.length;
    const current = Math.min(Math.max(this.seen, this.index + 1), total);
    return { current, total };
  }

  remaining() {
    return Math.max(0, this.questions.length - this.index);
  }

  mark(correct) {
    const q = this.current();
    if (!q) return;
    q.answered = true;
    q.correct = !!correct;
  }

  next() {
    if (this.index < this.questions.length - 1) {
      this.index += 1;
      this.seen = Math.max(this.seen, this.index + 1);
      return this.current();
    }
    return null;
  }

  reset() {
    this.index = 0;
    this.seen = 0;
    this.questions.forEach((q) => {
      q.answered = false;
      q.correct = null;
    });
  }

  drawBatch(size) {
    const start = this.seen;
    const end = Math.min(this.questions.length, start + size);
    this.index = end > 0 ? end - 1 : 0;
    this.seen = end;
    return this.questions.slice(start, end);
  }
}
