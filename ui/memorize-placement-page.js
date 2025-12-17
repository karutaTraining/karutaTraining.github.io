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
const judgeEl = qs('.judge');

const shuffleBtn = qs('#shuffleBtn');
const changeVisibleBtn = qs('#changeVisible');
const startQuestionBtn = qs('#startQuestion');
const endQuestionBtn = qs('#endQuestion');
const answerBtn = qs('#answer');
const nextQuestionBtn = qs('#nextQuestion');

let layout = null;
let queue = null;
let questionStarted = false;

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
    div.addEventListener('dblclick', () => {
      cell.hidden = !cell.hidden;
      toggleClass(div, DISPLAY_CLASSES.hidden, cell.hidden);
    });
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

function startQuestion() {
  questionStarted = true;
  judgeEl.style.display = 'block';
  questionEl.textContent = `出題: #${queue.current()?.card.id ?? '-'}`;
  startQuestionBtn.style.display = 'none';
  endQuestionBtn.style.display = 'block';
  answerBtn.style.display = 'block';
  nextQuestionBtn.style.display = 'block';
}

function endQuestion() {
  questionStarted = false;
  questionEl.textContent = '';
  judgeEl.textContent = '';
  judgeEl.style.display = 'none';
  startQuestionBtn.style.display = 'block';
  endQuestionBtn.style.display = 'none';
  answerBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'none';
}

function showAnswer() {
  const current = queue.current();
  if (!current) return;
  judgeEl.textContent = `答え: ${current.card.label} (#${current.card.id})`;
}

function nextQuestion() {
  queue.next();
  if (!queue.current()) {
    questionEl.textContent = 'すべて出題しました';
    return;
  }
  questionEl.textContent = `出題: #${queue.current().card.id}`;
  judgeEl.textContent = '';
}

function init() {
  const settings = store.load();
  const cards = selectAllowedCards(settings, repo);
  const ids = shuffle(cards.map((c) => c.id));
  layout = boardService.createLayout(ids, settings.noneCards);
  queue = new QuestionQueue(cards, { count: cards.length });

  renderBoard();
  renderLists(cards);

  shuffleBtn?.addEventListener('click', () => {
    const shuffled = shuffle(cards.map((c) => c.id));
    layout = boardService.createLayout(shuffled, settings.noneCards);
    renderBoard();
  });

  changeVisibleBtn?.addEventListener('click', () => {
    layout.cells.forEach((cell) => { cell.hidden = !cell.hidden; });
    renderBoard();
  });

  startQuestionBtn?.addEventListener('click', startQuestion);
  endQuestionBtn?.addEventListener('click', endQuestion);
  answerBtn?.addEventListener('click', showAnswer);
  nextQuestionBtn?.addEventListener('click', nextQuestion);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
