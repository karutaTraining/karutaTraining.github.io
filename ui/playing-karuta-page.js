import { createKimarijiRepository } from '../config/kimariji-repository.js';
import { createSettingsStore } from '../domain/settings.js';
import { selectAllowedCards } from '../domain/filters.js';
import { createCardImageResolver } from '../config/card-images.js';
import { BoardService } from '../services/board-service.js';
import { QuestionQueue } from '../services/question-queue.js';
import { renderCardList, renderGroupList, renderGrid } from './common/templating.js';
import { qs, qsa, toggleClass } from './common/dom-utils.js';
import { shuffle } from '../domain/randomizer.js';
import { DISPLAY_CLASSES } from '../config/karuta-params.js';

const repo = createKimarijiRepository();
const store = createSettingsStore();
const resolver = createCardImageResolver();
const boardService = new BoardService(repo);

const gridEl = qs('#grid');
const questionEl = qs('.question');
const startBtn = qs('#startPlaying');
const nextBtn = qs('#nextPlaying');
const endBtn = qs('#endPlaying');

let layout = null;
let queue = null;
let active = false;

function renderBoard() {
  renderGrid(gridEl, layout.cells, (cell) => {
    const div = document.createElement('div');
    div.className = 'cell';
    if (cell.cardId === null) {
      div.classList.add('blank');
      return div;
    }
    const img = document.createElement('img');
    img.src = resolver.resolve(cell.cardId);
    img.alt = `札 ${cell.cardId}`;
    if (cell.hidden) div.classList.add(DISPLAY_CLASSES.hidden);
    div.appendChild(img);
    return div;
  });
}

function renderLists(cards) {
  const groupEl = qs('#listGroup');
  const indivEl = qs('#listIndividual');
  renderGroupList(groupEl, repo.allGroups(), null, null);
  renderCardList(indivEl, cards, new Set(), null);
  qsa('.list-row', groupEl).forEach((row) => row.classList.add(DISPLAY_CLASSES.disabled));
  qsa('.list-row', indivEl).forEach((row) => row.classList.add(DISPLAY_CLASSES.disabled));
}

function revealCard(cardId) {
  const idx = layout.cells.findIndex((c) => c.cardId === cardId);
  if (idx >= 0) {
    layout.cells[idx].hidden = false;
  }
  renderBoard();
}

function showCurrentQuestion() {
  const current = queue.current();
  questionEl.textContent = current ? `現在の札: #${current.card.id} (${current.card.label})` : '出題終了';
}

function startPlaying() {
  active = true;
  startBtn.style.display = 'none';
  nextBtn.style.display = 'block';
  endBtn.style.display = 'block';
  showCurrentQuestion();
  revealCard(queue.current()?.card.id);
}

function nextPlaying() {
  if (!active) return;
  queue.next();
  const current = queue.current();
  if (!current) {
    questionEl.textContent = '出題終了';
    nextBtn.style.display = 'none';
    return;
  }
  revealCard(current.card.id);
  showCurrentQuestion();
}

function endPlaying() {
  window.location.href = './memorize-placement.html';
}

function init() {
  const settings = store.load();
  const cards = selectAllowedCards(settings, repo);
  const ids = shuffle(cards.map((c) => c.id));
  layout = boardService.createLayout(ids, settings.noneCards);
  // hide all to start play
  layout.cells.forEach((c) => { c.hidden = true; });
  queue = new QuestionQueue(cards, { count: cards.length });

  renderBoard();
  renderLists(cards);
  showCurrentQuestion();

  startBtn?.addEventListener('click', startPlaying);
  nextBtn?.addEventListener('click', nextPlaying);
  endBtn?.addEventListener('click', endPlaying);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
