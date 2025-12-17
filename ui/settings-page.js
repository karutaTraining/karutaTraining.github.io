import { createKimarijiRepository } from '../config/kimariji-repository.js';
import { createSettingsStore } from '../domain/settings.js';
import { bindRange, qs, qsa, toggleClass } from './common/dom-utils.js';
import { renderCardList, renderGroupList, renderGrid } from './common/templating.js';
import { GRID, DISPLAY_CLASSES } from '../config/karuta-params.js';

const repo = createKimarijiRepository();
const store = createSettingsStore();

const selectedIds = new Set();
let noneCards = Array(GRID.total).fill(false);

function readRadio(name, fallback) {
  return qs(`input[name="${name}"]:checked`)?.value ?? fallback;
}

function setRadio(name, value) {
  const el = qs(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function syncListUI(individualSelection) {
  qsa('#listGroup .list-row').forEach((row) => {
    const members = repo.groupMembers(row.dataset.prefix || '');
    const allSelected = members.length > 0 && members.every((id) => individualSelection.has(id));
    toggleClass(row, DISPLAY_CLASSES.selected, allSelected);
  });
  qsa('#listIndividual .list-row').forEach((row) => {
    const id = Number(row.dataset.id);
    toggleClass(row, DISPLAY_CLASSES.selected, individualSelection.has(id));
  });
}

function handleGroupToggle(group) {
  const members = repo.groupMembers(group.prefix);
  const allSelected = members.every((id) => selectedIds.has(id));
  members.forEach((id) => {
    if (allSelected) selectedIds.delete(id);
    else selectedIds.add(id);
  });
  syncListUI(selectedIds);
}

function handleIndividualToggle(card) {
  if (selectedIds.has(card.id)) selectedIds.delete(card.id);
  else selectedIds.add(card.id);
  syncListUI(selectedIds);
}

function applySettings(settings) {
  qs('#allOrPart').checked = !!settings.allOrPart;
  selectedIds.clear();
  (settings.selectedIds || []).forEach((id) => selectedIds.add(Number(id)));
  noneCards = Array.isArray(settings.noneCards) && settings.noneCards.length === GRID.total
    ? settings.noneCards.slice()
    : noneCards;

  const s1 = settings.fudaNagashi;
  setRadio('direction1', s1.direction);
  qs('#judgeByRomaji1').checked = !!s1.judgeByRomaji;
  qs('#changing').checked = !!s1.changing;
  qs('#autoSend1').checked = !!s1.autoAdvance;
  qs('#waitRange1').value = s1.waitMs;
  qs('#countRange1').value = s1.count;

  const s2 = settings.fudaNagashiSeveral;
  setRadio('direction2', s2.direction);
  qs('#judgeByRomaji2').checked = !!s2.judgeByRomaji;
  qs('#autoSend2').checked = !!s2.autoAdvance;
  qs('#waitRange2').value = s2.waitMs;
  qs('#countRange2').value = s2.count;
  qs('#countCardsSeveral').value = s2.countCardsSeveral;
  qs('#appearanceRange').value = s2.appearanceMs;

  const s3 = settings.memorizePlacement;
  setRadio('groupMode', s3.groupMode);
  qs('#excludeFlag3').checked = !!s3.excludeFlag;
  setRadio('doOpen', s3.doOpen);
  setRadio('canFlip', s3.canFlip);
  qs('#autoSend3').checked = !!s3.autoAdvance;
  qs('#waitRange3').value = s3.waitMs;

  const s4 = settings.playingKaruta;
  qs('#excludeFlag4').checked = !!s4.excludeFlag;
  qs('#syllableInterval').value = s4.syllableInterval;
  qs('#autoSend4').checked = !!s4.autoAdvance;
  qs('#waitRange4').value = s4.waitMs;
}

function collectSettings() {
  return {
    allOrPart: qs('#allOrPart').checked,
    selectedIds: Array.from(selectedIds),
    noneCards: noneCards.slice(),
    fudaNagashi: {
      direction: readRadio('direction1', 'random'),
      judgeByRomaji: qs('#judgeByRomaji1').checked,
      changing: qs('#changing').checked,
      autoAdvance: qs('#autoSend1').checked,
      waitMs: Number(qs('#waitRange1').value),
      count: Number(qs('#countRange1').value),
    },
    fudaNagashiSeveral: {
      direction: readRadio('direction2', 'random'),
      judgeByRomaji: qs('#judgeByRomaji2').checked,
      autoAdvance: qs('#autoSend2').checked,
      waitMs: Number(qs('#waitRange2').value),
      count: Number(qs('#countRange2').value),
      countCardsSeveral: Number(qs('#countCardsSeveral').value),
      appearanceMs: Number(qs('#appearanceRange').value),
    },
    memorizePlacement: {
      groupMode: readRadio('groupMode', 'group'),
      excludeFlag: qs('#excludeFlag3').checked,
      doOpen: readRadio('doOpen', 'correct'),
      canFlip: readRadio('canFlip', 'correct'),
      autoAdvance: qs('#autoSend3').checked,
      waitMs: Number(qs('#waitRange3').value),
    },
    playingKaruta: {
      excludeFlag: qs('#excludeFlag4').checked,
      syllableInterval: Number(qs('#syllableInterval').value),
      autoAdvance: qs('#autoSend4').checked,
      waitMs: Number(qs('#waitRange4').value),
    },
  };
}

function renderNoneCardsGrid() {
  const gridEl = qs('#grid');
  const outEl = qs('#out');
  renderGrid(gridEl, noneCards.map((flag, index) => ({ flag, index })), ({ flag, index }) => {
    const cell = document.createElement('label');
    cell.className = 'cell';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !flag;
    cb.addEventListener('change', () => {
      noneCards[index] = !cb.checked;
      dumpArray(outEl);
    });
    cell.appendChild(cb);
    return cell;
  });
  dumpArray(outEl);
}

function dumpArray(outEl) {
  if (!outEl) return;
  const lines = [];
  for (let r = 0; r < GRID.rows; r += 1) {
    const row = [];
    for (let c = 0; c < GRID.cols; c += 1) {
      row.push(String(noneCards[r * GRID.cols + c]));
    }
    lines.push(row.join(', '));
  }
  outEl.value = lines.join('\n');
}

function init() {
  const settings = store.load();
  const individualSelection = new Set(settings.selectedIds);

  renderGroupList(qs('#listGroup'), repo.allGroups(), null, (group) => {
    handleGroupToggle(group);
    syncListUI(selectedIds);
  });

  renderCardList(qs('#listIndividual'), repo.allItems(), individualSelection, (card) => {
    handleIndividualToggle(card);
    syncListUI(selectedIds);
  });

  applySettings(settings);
  syncListUI(selectedIds);
  renderNoneCardsGrid();
  bindRange(qs('#waitRange1'), qs('#waitValue1'));
  bindRange(qs('#countRange1'), qs('#countValue1'));
  bindRange(qs('#waitRange2'), qs('#waitValue2'));
  bindRange(qs('#countRange2'), qs('#countValue2'));
  bindRange(qs('#countCardsSeveral'), qs('#countCardsSeveralValue'));
  bindRange(qs('#appearanceRange'), qs('#appearanceValue'));
  bindRange(qs('#waitRange3'), qs('#waitValue3'));
  bindRange(qs('#syllableInterval'), qs('#syllableIntervalValue'));
  bindRange(qs('#waitRange4'), qs('#waitValue4'));

  qs('#selectAll')?.addEventListener('click', () => {
    repo.allIds().forEach((id) => selectedIds.add(id));
    syncListUI(selectedIds);
  });
  qs('#clearAll')?.addEventListener('click', () => {
    selectedIds.clear();
    syncListUI(selectedIds);
  });
  qs('#btnBackSave')?.addEventListener('click', () => {
    store.save(collectSettings());
    window.location.href = './index.html';
  });
  qs('#resetAll')?.addEventListener('click', () => {
    if (window.confirm('設定をすべてリセットしますか？')) {
      const reset = store.reset();
      applySettings(reset);
      syncListUI(selectedIds);
      renderNoneCardsGrid();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
