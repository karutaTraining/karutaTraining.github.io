import { GRID } from '../config/karuta-params.js';
import { BoardCell, BoardLayout } from '../domain/models.js';

export class BoardService {
  constructor(repository) {
    this.repo = repository;
  }

  createLayout(allowedIds, noneCards) {
    const ids = allowedIds.length ? allowedIds : this.repo.allIds();
    const cells = [];
    for (let i = 0; i < GRID.total; i += 1) {
      const cardId = noneCards?.[i] ? null : ids[i % ids.length];
      cells.push(new BoardCell(i, cardId, false));
    }
    return new BoardLayout(cells);
  }

  toggleHidden(layout, index) {
    const cell = layout.cells[index];
    if (!cell) return;
    cell.hidden = !cell.hidden;
  }
}
