import { DISPLAY_CLASSES } from '../../config/karuta-params.js';
import { toggleClass } from './dom-utils.js';

export function renderGroupList(container, groups, selection, onToggle) {
  if (!container) return;
  container.innerHTML = '';
  groups.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.dataset.prefix = g.s;
    row.textContent = `${g.s}：`;
    row.addEventListener('click', () => onToggle?.(g, row));
    if (selection) toggleClass(row, DISPLAY_CLASSES.selected, selection.has(g.s));
    container.appendChild(row);
  });
}

export function renderCardList(container, cards, selection, onToggle) {
  if (!container) return;
  container.innerHTML = '';
  cards.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.dataset.id = c.id;
    row.innerHTML = `<span class="mono">#${String(c.id).padStart(3, '0')}</span>：${c.label}`;
    row.addEventListener('click', () => onToggle?.(c, row));
    toggleClass(row, DISPLAY_CLASSES.selected, selection.has(c.id));
    container.appendChild(row);
  });
}

export function renderGrid(container, cells, createNode) {
  if (!container) return;
  container.innerHTML = '';
  cells.forEach((cell) => {
    const node = createNode(cell);
    container.appendChild(node);
  });
}
