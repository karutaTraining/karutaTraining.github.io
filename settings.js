// --------- settings.js (fixed) ---------
const SETTINGS_KEY = 'karutaSettings.v1';
const ROWS = 6, COLS = 11, TOTAL = ROWS * COLS;

// === データ from kimariji-data.js ===
const kimarijiGroups = window.KIMARIJI_GROUPS || [];
const kimarijiItems = window.KIMARIJI_ITEMS || [];
const oneSyllableIds = window.STANDALONE_IDS || [];

// === 状態 ===
const revealedIds = new Set();
const selectedIndividuals = new Set();
const groupRowByPrefix = new Map();
const indivRowById = new Map();
let noneCards = Array(TOTAL).fill(false); // false=枠あり, true=空札

// === 保存/読込 ===
const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
};
const saveSettings = (obj) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); } catch { }
};

// === ユーティリティ ===
function q(id) { return document.getElementById(id); }
function setRadio(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
}
function getRadio(name, fallback) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value ?? fallback;
}
function paintRange(el) {
    const min = +el.min, max = +el.max, val = +el.value;
    const pct = ((val - min) / (max - min)) * 100;
    el.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${pct}%, var(--slider-base) ${pct}%, var(--slider-base) 100%)`;
}
function bindRange(inputEl, outEl) {
    const update = () => { outEl.textContent = inputEl.value; paintRange(inputEl); };
    inputEl.addEventListener('input', update); update();
}

// === グループ→個別マップ ===
const groupMap = new Map();
kimarijiGroups.forEach(g => {
    const ids = kimarijiItems.filter(k => k.s.startsWith(g.s)).map(k => k.id);
    groupMap.set(g.s, ids);
});

// === 設定収集 ===
function collectSettings() {
    return {
        // 共通
        //allOrPart: q('allOrPart').checked,
        //selectedIds: Array.from(selectedIndividuals),
        //noneCards: noneCards.slice(),

        // 札流し
        fudaNagashi: {
            allOrPart: q('allOrPart').checked,
            selectedIds: Array.from(selectedIndividuals),
            direction: getRadio('direction1', 'random'),
            judgeByRomaji: q('judgeByRomaji1').checked,
            changing: q('changing').checked,
            autoAdvance: q('autoSend1').checked,
            waitMs: +q('waitRange1').value || 0,
            count: +q('countRange1').value || 100,
        },

        // 札流し（複数）
        fudaNagashiSeveral: {
            allOrPart: q('allOrPart').checked,
            selectedIds: Array.from(selectedIndividuals),
            direction: getRadio('direction2', 'random'),
            judgeByRomaji: q('judgeByRomaji2').checked,
            autoAdvance: q('autoSend2').checked,
            waitMs: +q('waitRange2').value || 0,
            count: +q('countRange2').value || 100,
            countCardsSeveral: +q('countCardsSeveral').value || 5,
            appearanceMs: +q('appearanceRange').value || 500,
        },

        // 配置暗記
        memorizePlacement: {
            allOrPart: q('allOrPart').checked,
            selectedIds: Array.from(selectedIndividuals),
            noneCards: noneCards.slice(),
            groupMode: getRadio('groupMode', 'group'),
            excludeFlag: q('excludeFlag3').checked,
            doOpen: getRadio('doOpen', 'correct'),
            canFlip: getRadio('canFlip', 'correct'),
            autoAdvance: q('autoSend3').checked,
            waitMs: +q('waitRange3').value || 0,
        },

        // プレイ中
        playingKaruta: {
            allOrPart: q('allOrPart').checked,
            selectedIds: Array.from(selectedIndividuals),
            noneCards: noneCards.slice(),
            excludeFlag: q('excludeFlag4').checked,
            syllableInterval: +q('syllableInterval').value || 500,
            autoAdvance: q('autoSend4').checked,
            waitMs: +q('waitRange4').value || 0,
        },

        updatedAt: Date.now(),
    };
}

// === 設定適用 ===
function applySettings(s) {
    if (!s) return;

    // 共通
    if ('allOrPart' in s) q('allOrPart').checked = !!s.allOrPart;
    if (Array.isArray(s.selectedIds)) {
        selectedIndividuals.clear();
        s.selectedIds.forEach(id => selectedIndividuals.add(+id));
    }
    if (Array.isArray(s.noneCards) && s.noneCards.length === TOTAL) {
        noneCards = s.noneCards.slice();
    }

    // 札流し
    const s1 = s.fudaNagashi || {};
    setRadio('direction1', s1.direction ?? 'random');
    if ('judgeByRomaji' in s1) q('judgeByRomaji1').checked = !!s1.judgeByRomaji;
    if ('changing' in s1) q('changing').checked = !!s1.changing;
    if ('autoAdvance' in s1) q('autoSend1').checked = !!s1.autoAdvance;
    if ('waitMs' in s1) q('waitRange1').value = +s1.waitMs;
    if ('count' in s1) q('countRange1').value = +s1.count;

    // 札流し（複数）
    const s2 = s.fudaNagashiSeveral || {};
    setRadio('direction2', s2.direction ?? 'random');
    if ('judgeByRomaji' in s2) q('judgeByRomaji2').checked = !!s2.judgeByRomaji;
    if ('autoAdvance' in s2) q('autoSend2').checked = !!s2.autoAdvance;
    if ('waitMs' in s2) q('waitRange2').value = +s2.waitMs;
    if ('count' in s2) q('countRange2').value = +s2.count;
    if ('countCardsSeveral' in s2) q('countCardsSeveral').value = +s2.countCardsSeveral;
    if ('appearanceMs' in s2) q('appearanceRange').value = +s2.appearanceMs;

    // 配置暗記
    const s3 = s.memorizePlacement || {};
    setRadio('groupMode', s3.groupMode ?? 'group');
    if ('excludeFlag' in s3) q('excludeFlag3').checked = !!s3.excludeFlag;
    setRadio('doOpen', s3.doOpen ?? 'correct');
    setRadio('canFlip', s3.canFlip ?? 'correct');
    if ('autoAdvance' in s3) q('autoSend3').checked = !!s3.autoAdvance;
    if ('waitMs' in s3) q('waitRange3').value = +s3.waitMs;

    // プレイ中
    const s4 = s.playingKaruta || {};
    if ('excludeFlag' in s4) q('excludeFlag4').checked = !!s4.excludeFlag;
    if ('syllableInterval' in s4) q('syllableInterval').value = +s4.syllableInterval;
    if ('autoAdvance' in s4) q('autoSend4').checked = !!s4.autoAdvance;
    if ('waitMs' in s4) q('waitRange4').value = +s4.waitMs;

    // スライダ表示と塗り
    bindRange(q('waitRange1'), q('waitValue1'));
    bindRange(q('countRange1'), q('countValue1'));
    bindRange(q('waitRange2'), q('waitValue2'));
    bindRange(q('countRange2'), q('countValue2'));
    bindRange(q('countCardsSeveral'), q('countCardsSeveralValue'));
    bindRange(q('appearanceRange'), q('appearanceValue'));
    bindRange(q('waitRange3'), q('waitValue3'));
    bindRange(q('syllableInterval'), q('syllableIntervalValue'));
    bindRange(q('waitRange4'), q('waitValue4'));
}

// === リストの選択状態 → 見た目反映 ===
function recomputeUI() {
    indivRowById.forEach((row, id) => {
        row.classList.toggle('selected', selectedIndividuals.has(id));
    });
    groupRowByPrefix.forEach((row, prefix) => {
        const ids = groupMap.get(prefix) || [];
        const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
        row.classList.toggle('selected', allSelected);
    });
}

// === イベント ===
const selectAllBtn = q('selectAll');
const clearAllBtn = q('clearAll');
if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
        const all = new Set(oneSyllableIds);
        groupMap.forEach(ids => ids.forEach(id => all.add(id)));
        selectedIndividuals.clear();
        all.forEach(id => selectedIndividuals.add(id));
        recomputeUI();
    });
}
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        selectedIndividuals.clear();
        recomputeUI();
    });
}

// グループ行クリック
q('listGroup').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (!row) return;
    const m = (row.textContent || '').match(/：(.+?)\s*$/);
    if (!m) return;
    const prefix = m[1].trim();
    const ids = groupMap.get(prefix) || [];
    const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
    if (allSelected) { ids.forEach(id => selectedIndividuals.delete(id)); }
    else { ids.forEach(id => selectedIndividuals.add(id)); }
    recomputeUI();
});

// 個別行クリック
q('listIndividual').addEventListener('click', (e) => {
    const row = e.target.closest('.list-row');
    if (!row) return;
    const m = (row.textContent || '').match(/#(\d+)/);
    if (!m) return;
    const id = +m[1];
    if (selectedIndividuals.has(id)) selectedIndividuals.delete(id);
    else selectedIndividuals.add(id);
    recomputeUI();
});

// 保存して戻る
q('btnBackSave').addEventListener('click', () => {
    saveSettings(collectSettings());
    location.href = './index.html';
});

// 全設定リセット
q('resetAll').addEventListener('click', () => {
    if (confirm('設定をすべてリセットしますか？')) {
        localStorage.removeItem(SETTINGS_KEY);
        location.reload();
    }
});

// 初期化
(function init() {
    // listIndividual は HTML 側にすでに中身が入っている前提
    document.querySelectorAll('#listGroup .list-row').forEach(row => {
        const m = (row.textContent || '').match(/：(.+?)\s*$/);
        if (m) { groupRowByPrefix.set(m[1].trim(), row); }
    });
    document.querySelectorAll('#listIndividual .list-row').forEach(row => {
        const m = (row.textContent || '').match(/#(\d+)/);
        if (m) { indivRowById.set(+m[1], row); }
    });

    const s = loadSettings();
    // noneCards 初期値
    if (!(Array.isArray(s.noneCards) && s.noneCards.length === TOTAL)) {
        // 他ページで保存されていなければ false 埋め
        s.noneCards = Array(TOTAL).fill(false);
    }
    applySettings(s);
    recomputeUI();
})();

// ============== 札配置グリッド ==============
const grid = q('grid');
const out = q('out');

function renderGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
        const cell = document.createElement('label');
        cell.className = 'cell';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = (noneCards[i] === false); // checked=true ⇒ 札あり(false)
        cb.dataset.index = String(i);
        cb.addEventListener('change', (e) => {
            const idx = +e.target.dataset.index;
            noneCards[idx] = !e.target.checked; // 反転
            dumpArray();
        });
        cell.appendChild(cb);
        grid.appendChild(cell);
    }
    dumpArray();
}

function dumpArray() {
    const lines = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) row.push(String(noneCards[r * COLS + c]));
        lines.push(row.join(', '));
    }
    out.value = lines.join('\n');
}

renderGrid();
