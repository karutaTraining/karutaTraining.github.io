export class Card {
  constructor(id, label) {
    this.id = Number(id);
    this.label = String(label || '');
  }
}

export class CardGroup {
  constructor(id, prefix, members = []) {
    this.id = Number(id);
    this.prefix = prefix;
    this.members = members.map((m) => Number(m));
  }
}

export class Question {
  constructor(card) {
    this.card = card;
    this.answered = false;
    this.correct = null;
  }
}

export class BoardCell {
  constructor(index, cardId = null, hidden = false) {
    this.index = index;
    this.cardId = cardId;
    this.hidden = hidden;
  }
}

export class BoardLayout {
  constructor(cells) {
    this.cells = cells;
  }

  clone() {
    return new BoardLayout(this.cells.map((c) => new BoardCell(c.index, c.cardId, c.hidden)));
  }
}
