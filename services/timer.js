export class Timer {
  constructor(callback, delay) {
    this.callback = callback;
    this.delay = delay;
    this.id = null;
  }

  start() {
    this.stop();
    this.id = window.setTimeout(() => {
      this.id = null;
      this.callback();
    }, this.delay);
  }

  stop() {
    if (this.id !== null) {
      window.clearTimeout(this.id);
      this.id = null;
    }
  }
}
