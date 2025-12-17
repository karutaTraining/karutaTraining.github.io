import { createKimarijiRepository } from '../config/kimariji-repository.js';
import { createSettingsStore } from '../domain/settings.js';
import { selectAllowedCards } from '../domain/filters.js';
import { createCardImageResolver } from '../config/card-images.js';
import { QuestionQueue } from '../services/question-queue.js';
import { Timer } from '../services/timer.js';
import { normalizeAnswer } from '../services/text-normalizer.js';
import { PLAY_MODES } from '../config/karuta-params.js';
import { qs } from './common/dom-utils.js';

const repo = createKimarijiRepository();
const store = createSettingsStore();
const resolver = createCardImageResolver();

const bodyMode = document.body.dataset.page === 'fuda-nagashi-several' ? PLAY_MODES.several : PLAY_MODES.single;

const qidEl = qs('#qid');
const resultEl = qs('#result');
const progressTextEl = qs('#progressText');
const barEl = qs('#bar');
const remainEl = qs('#remain');
const formEl = qs('#answerForm');
const inputEl = qs('#answerInput');
const resetBtn = qs('#resetBtn');
const skipBtn = qs('#skipBtn');
const listEl = qs('#list');
const imgWrap = qs('#rotate');
const toggleOrderBtn = qs('#toggleOrderBtn');
const statusPill = qs('#statusPill');

let queue = null;
let autoTimer = null;
let orderMode = 'id';
let pageSettings = null;
let currentBatch = [];

function setDirectionClass(direction) {
  if (!imgWrap) return;
  const cls = direction === 'normal' ? 'imgwrap upright' : direction === 'reverse' ? 'imgwrap upside-down' : 'imgwrap';
  imgWrap.className = cls;
}

function createQueue() {
  const allSettings = store.load();
  pageSettings = bodyMode === PLAY_MODES.several ? allSettings.fudaNagashiSeveral : allSettings.fudaNagashi;
  const cards = selectAllowedCards(allSettings, repo);
  queue = new QuestionQueue(cards, { count: pageSettings.count });
}

function renderList() {
  if (!listEl) return;
  const cards = repo.allItems().slice().sort((a, b) => {
    if (orderMode === 'label') return a.s.localeCompare(b.s, 'ja');
    return a.id - b.id;
  });
  listEl.innerHTML = cards.map((c) => `<div class="list-row"><span class="mono">#${String(c.id).padStart(3, '0')}</span>：${c.s}</div>`).join('');
}

function renderImages(batch) {
  imgWrap.innerHTML = '';
  batch.forEach((q) => {
    const img = document.createElement('img');
    img.alt = `札 ${q.card.id}`;
    img.src = resolver.resolve(q.card.id);
    imgWrap.appendChild(img);
  });
  setDirectionClass(pageSettings.direction);
}

function renderProgress() {
  const { current, total } = queue.progress();
  progressTextEl.textContent = `${Math.min(current, total)} / ${total}`;
  remainEl.textContent = String(queue.remaining());
  const pct = total === 0 ? 0 : ((current - 1) / total) * 100;
  barEl.style.width = `${pct}%`;
}

function renderStatus(text, type = 'muted') {
  resultEl.textContent = text;
  statusPill.textContent = bodyMode === PLAY_MODES.several ? '確認中' : '回答中';
  statusPill.className = type === 'ok' ? 'pill success' : type === 'ng' ? 'pill danger' : 'pill';
}

function pickBatch() {
  if (bodyMode === PLAY_MODES.several) {
    currentBatch = queue.drawBatch(pageSettings.countCardsSeveral);
  } else {
    const current = queue.current();
    currentBatch = current ? [current] : [];
  }
}

function renderQuestion() {
  pickBatch();
  if (currentBatch.length === 0) {
    renderStatus('出題はすべて終了しました', 'muted');
    imgWrap.innerHTML = '';
    return;
  }
  renderImages(currentBatch);
  renderProgress();
  qidEl.textContent = currentBatch.map((q) => q.card.id).join(', ');
  renderStatus('');
  inputEl.value = '';
  inputEl.focus();
  if (pageSettings.direction === 'random') {
    const dir = Math.random() < 0.5 ? 'normal' : 'reverse';
    setDirectionClass(dir);
  }
}

function scheduleNext() {
  if (!pageSettings.autoAdvance) return;
  autoTimer?.stop();
  autoTimer = new Timer(() => {
    goNext();
  }, pageSettings.waitMs);
  autoTimer.start();
}

function goNext() {
  if (bodyMode === PLAY_MODES.several) {
    renderQuestion();
    return;
  }
  queue.next();
  renderQuestion();
}

function handleAnswer(ev) {
  ev.preventDefault();
  if (!currentBatch.length) return;
  const answer = normalizeAnswer(inputEl.value);
  const target = normalizeAnswer(currentBatch[0].card.label || currentBatch[0].card.s || currentBatch[0].card);
  const correct = pageSettings.judgeByRomaji ? answer === target : inputEl.value.trim() === (currentBatch[0].card.label || currentBatch[0].card.s);
  queue.mark(correct);
  renderStatus(correct ? '正解です' : '違います', correct ? 'ok' : 'ng');
  scheduleNext();
}

function wireEvents() {
  formEl?.addEventListener('submit', handleAnswer);
  skipBtn?.addEventListener('click', () => {
    goNext();
  });
  resetBtn?.addEventListener('click', () => {
    createQueue();
    renderQuestion();
  });
  toggleOrderBtn?.addEventListener('click', () => {
    orderMode = orderMode === 'id' ? 'label' : 'id';
    renderList();
  });
}

function init() {
  createQueue();
  renderList();
  wireEvents();
  renderQuestion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
