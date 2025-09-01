// --------- fuda-nagashi.js (rewritten, batch-ready) ---------

// ====== 設定の読み込み ======
const SETTINGS_KEY = 'karutaSettings.v1';
const settings = (() => {
    try {
        const s2 = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        return s2.fudaNagashiSeveral || {};
    }
    catch { return {}; }
})();

// ====== DOM ======
const qidEl = document.getElementById('qid');
const statusPillEl = document.getElementById('statusPill');
const progressTextEl = document.getElementById('progressText');
const barEl = document.getElementById('bar');
const remainEl = document.getElementById('remain');
const rotateEl = document.getElementById('rotate');
const singleImgEl = document.getElementById('cardImg');
const answerFormEl = document.getElementById('answerForm');
const answerInputEl = document.getElementById('answerInput');
const skipBtn = document.getElementById('skipBtn');
const resetBtn = document.getElementById('resetBtn');
const toggleOrderBtn = document.getElementById('toggleOrderBtn');
const listEl = document.getElementById('list');

// ====== 画像パス ======
const IMG_DIR = '';
const BLANK_SRC = 'blank';

// ====== データ（kimariji-data.js 由来） ======
const CARDS = (window.KIMARIJI_ITEMS || []).slice(); // [{id,s},...]
const ALL_IDS_FN = window.KIMARIJI_ALL_IDS || (() => CARDS.map(c => c.id));
const id2s = new Map(CARDS.map(c => [c.id, c.s]));

// ====== 設定反映（デフォルト含む） ======
let AUTO_NEXT_MS = settings.autoAdvance ? (+settings.waitMs || 0) : 0;                    // 問終了→次問の自動遷移(ms)
let CARDS_DIRECTION = settings.direction || 'random';          // 'normal' | 'reverse' | 'random'
let BASE_COUNT = +settings.count || CARDS.length;         // 出題枚数（総カード数上限）
let allOrPart = !!settings.allOrPart;                    // true=限定出題
let selectedIdsSet = new Set(Array.isArray(settings.selectedIds) ? settings.selectedIds.map(Number) : []);
let isRomanized = !!settings.judgeByRomaji;                  // 設定があれば採用（なければ false）

// 追加パラメータ（今回の要件）
let dispSeconds = (settings.appearanceMs != null) ? +settings.appearanceMs : 5000; // ms扱い
let groupSize = Math.max(2, +settings.countCardsSeveral || 6);

// 変化フラグ（単問中の強制上書きに注意）
let syllableChangingDefault = (settings.changing != null) ? !!settings.changing : true;

// ====== 状態 ======
let poolIds = [];                 // 出題候補の全ID（限定あり）
let remainingIds = [];            // まだ未出題のID列（シャッフル順）
let consumedCount = 0;            // 既に消化した「カード枚数」
let currentGroup = [];            // 今回の問で出す ID 群（1..6）
let groupOrientation = 'upright'; // 'upright'|'upside-down'
let groupAnswersKana = [];        // 入力済み回答（かな）
let hideTimer = null;             // dispSeconds → blank 切替用
let awaitingNextQuestion = false; // 問終了後、次問待機中
let listMode = 'syllable';        // リスト表示モード
let historyById = new Map();      // id -> { correct:boolean, changed:boolean, readOrder:number }

// ====== ユーティリティ ======
const asOnOff = v => v ? 'ON' : 'OFF';

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function sampleIds(source, n) {
    const a = source.slice();
    shuffle(a);
    return a.slice(0, Math.min(n, a.length));
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function updateStatusPill(text) {
    if (!statusPillEl) return;
    statusPillEl.textContent = text;
}

function getReadingById(id) {
    return id2s.get(id) || '';
}

// ---- ローマ字→ひらがな（簡易・厳格寄り） ----
function romajiToHiraganaStrict(src) {
    let s = String(src || '').toLowerCase().trim();
    if (!s) return '';

    // 促音
    s = s.replace(/(bb|cc|dd|ff|gg|hh|jj|kk|ll|mm|pp|qq|rr|ss|tt|vv|ww|xx|zz)/g, m => 'っ' + m[0]);

    const table = [
        ['kyo', 'きょ'], ['kyu', 'きゅ'], ['kya', 'きゃ'],
        ['gyo', 'ぎょ'], ['gyu', 'ぎゅ'], ['gya', 'ぎゃ'],
        ['sho', 'しょ'], ['shu', 'しゅ'], ['sha', 'しゃ'], ['syo', 'しょ'], ['syu', 'しゅ'], ['sya', 'しゃ'],
        ['jo', 'じょ'], ['ju', 'じゅ'], ['ja', 'じゃ'], ['jyo', 'じょ'], ['jyu', 'じゅ'], ['jya', 'じゃ'],
        ['cho', 'ちょ'], ['chu', 'ちゅ'], ['cha', 'ちゃ'], ['tyo', 'ちょ'], ['tyu', 'ちゅ'], ['tya', 'ちゃ'],
        ['dyo', 'ぢょ'], ['dyu', 'ぢゅ'], ['dya', 'ぢゃ'],
        ['nyo', 'にょ'], ['nyu', 'にゅ'], ['nya', 'にゃ'],
        ['hyo', 'ひょ'], ['hyu', 'ひゅ'], ['hya', 'ひゃ'],
        ['pyo', 'ぴょ'], ['pyu', 'ぴゅ'], ['pya', 'ぴゃ'],
        ['byo', 'びょ'], ['byu', 'びゅ'], ['bya', 'びゃ'],
        ['myo', 'みょ'], ['myu', 'みゅ'], ['mya', 'みゃ'],
        ['ryo', 'りょ'], ['ryu', 'りゅ'], ['rya', 'りゃ'],
        ['tsu', 'つ'], ['shi', 'し'], ['chi', 'ち'], ['fu', 'ふ'],
        ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
        ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
        ['sa', 'さ'], ['si', 'し'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
        ['za', 'ざ'], ['zi', 'じ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'],
        ['ta', 'た'], ['ti', 'ち'], ['tu', 'つ'], ['te', 'て'], ['to', 'と'],
        ['da', 'だ'], ['di', 'ぢ'], ['du', 'づ'], ['de', 'で'], ['do', 'ど'],
        ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
        ['ha', 'は'], ['hi', 'ひ'], ['hu', 'ふ'], ['he', 'へ'], ['ho', 'ほ'],
        ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'],
        ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
        ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
        ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
        ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
        ['wa', 'わ'], ['wi', 'うぃ'], ['we', 'うぇ'], ['wo', 'を'],
        ['nn', 'ん'], ['n', 'ん'],
        ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お']
    ];

    for (const [r, h] of table) {
        s = s.split(r).join(h);
    }
    if (/[a-z]/.test(s)) return '';
    return s;
}

function hasHiragana(s) { return /[ぁ-ゖ]/.test(s); }
function hasAlpha(s) { return /[a-z]/i.test(s); }
function normalizeInputToKana(raw) {
    const t = String(raw || '').trim();
    if (!t) return '';
    const containsKana = hasHiragana(t);
    const containsAlpha = hasAlpha(t);
    if (containsKana && !containsAlpha) return t;
    if (!containsKana && containsAlpha && isRomanized) {
        const conv = romajiToHiraganaStrict(t);
        return conv || '';
    }
    return ''; // かなとローマ字が混在・または無効
}

// ---- 最短接頭辞（決まり字）計算 ----
function lcpLen(a, b) {
    const L = Math.min(a.length, b.length);
    let i = 0;
    for (; i < L; i++) { if (a[i] !== b[i]) break; }
    return i;
}
function computeExpectedPrefixFromIds(currentId, candidateIds) {
    const target = getReadingById(currentId);
    if (!target) return '';
    let maxLcp = 0;
    for (const id of candidateIds) {
        if (id === currentId) continue;
        const other = getReadingById(id);
        if (!other) continue;
        const l = lcpLen(target, other);
        if (l > maxLcp) maxLcp = l;
    }
    return target.slice(0, maxLcp + 1);
}

// ====== 画面系 ======
function ensureSlots() {
    // 回転ラッパ（#rotate）の中に、単一画像(#cardImg)と並立で batch 用の #cardSlots を用意
    if (!rotateEl) return null;
    let slots = rotateEl.querySelector('#cardSlots');
    if (!slots) {
        slots = document.createElement('div');
        slots.id = 'cardSlots';
        slots.style.display = 'grid';
        slots.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
        slots.style.gap = '8px';
        slots.style.alignItems = 'center';
        slots.style.justifyItems = 'center';
        rotateEl.appendChild(slots);
    }
    return slots;
}

// 配置番号順 → スロット index 配列（0-based）
function getPlacementOrder(size, orientation) {
    const up = [5, 4, 2, 1, 3, 0];
    const dn = [0, 1, 3, 4, 2, 5];
    //const dn = [5, 4, 2, 1, 3, 0];
    //const up = [0, 1, 4, 2, 3, 5];
    //const dn = [5, 3, 2, 4, 1, 0];
    const base = (orientation === 'upside-down') ? dn : up;
    const order = base.slice(0, size);

    console.debug('[getPlacementOrder]', { size, orientation, order });
    return order;
}

function setOrientationClass(orientation) {
    if (!rotateEl) return;
    rotateEl.className = (orientation === 'upside-down') ? 'imgwrap upside-down' : 'imgwrap';
}

function renderGroupImages(ids, orientation) {
    const N = ids.length;
    const slotsWrap = ensureSlots();
    if (!slotsWrap) return;

    // 単一画像エレメントは multi では隠す（1枚時は使用）
    if (singleImgEl) singleImgEl.style.display = (N === 1 ? '' : 'none');

    // 既存クリア
    while (slotsWrap.firstChild) slotsWrap.removeChild(slotsWrap.firstChild);

    // 3x2 = 6 スロット確保し、未使用は display:none
    const order = getPlacementOrder(N, orientation);
    //const usedSet = new Set(order);
    for (let i = 0; i < 6; i++) {
        const img = document.createElement('img');
        img.className = 'slot';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '28vmin';
        img.style.objectFit = 'contain';
        img.dataset.slot = String(i);
        img.dataset.used = '0';
        img.src = BLANK_SRC;
        img.style.visibility = 'hidden';
        //img.style.display = usedSet.has(i) ? '' : 'none';
        slotsWrap.appendChild(img);
    }

    // 表示：order順で id.png を差し込み
    const imgs = Array.from(slotsWrap.querySelectorAll('img.slot'));
    order.forEach((slotIndex, k) => {
        const id = ids[k];
        const img = imgs[slotIndex];
        img.dataset.used = '1';
        img.style.visibility = 'hidden';
        img.onload = () => { img.style.visibility = 'visible'; };
        img.src = id;
    });

    setOrientationClass(orientation);
}

function flipGroupToBlank() {
    const slotsWrap = ensureSlots();

    // 複数枚モード
    if (slotsWrap && currentGroup.length >= 2) {
        const imgs = slotsWrap.querySelectorAll('img.slot');
        imgs.forEach(img => {
            if (img.dataset.used === '1') {
                // 使用スロットだけを blank にして表示は維持
                img.src = BLANK_SRC;
                img.style.visibility = 'visible';
            } else {
                // 未使用スロットは空欄を維持（詰め防止のため visibility:hidden）
                img.style.visibility = 'hidden';
            }
        });
    }

    // 1枚モード
    if (singleImgEl && currentGroup.length === 1) {
        singleImgEl.src = BLANK_SRC;
    }
}
/*
function flipGroupToBlank() {
    const slotsWrap = ensureSlots();
    if (slotsWrap) {
        if (img.dataset.used === '1') {
            img.src = BLANK_SRC;          // 使用スロットだけブランク表示
            img.style.visibility = 'visible';
        }
    }
    if (singleImgEl && currentGroup.length === 1) {
        singleImgEl.src = BLANK_SRC;
    }
}
*/

function revealGroupImages() {
    const slotsWrap = ensureSlots();
    if (slotsWrap && currentGroup.length >= 2) {
        const order = getPlacementOrder(currentGroup.length, groupOrientation);
        const imgs = Array.from(slotsWrap.querySelectorAll('img.slot'));
        order.forEach((slotIndex, k) => {
            const id = currentGroup[k];
            const img = imgs[slotIndex];
            img.dataset.used = '1';
            img.src = id;
            img.style.visibility = 'visible';
        });
    } else if (singleImgEl && currentGroup.length === 1) {
        singleImgEl.src = currentGroup[0];
    }
}

function clearHideTimer() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
}

// ====== 出題制御 ======
function decideGroupOrientation() {
    if (CARDS_DIRECTION === 'normal') return 'upright';
    if (CARDS_DIRECTION === 'reverse') return 'upside-down';
    // random
    return Math.random() < 0.5 ? 'upright' : 'upside-down';
}

function pickNextGroup() {
    if (remainingIds.length === 0) return [];
    const N = clamp(groupSize, 1, 6);
    return remainingIds.slice(0, N);
}

function removeCurrentGroupFromRemaining() {
    const n = currentGroup.length;
    remainingIds = remainingIds.slice(n);
    consumedCount += n;
}

function updateProgress() {
    const total = Math.min(BASE_COUNT, poolIds.length);
    const done = clamp(consumedCount, 0, total);
    if (progressTextEl) progressTextEl.textContent = `${done} / ${total}`;
    if (remainEl) remainEl.textContent = String(Math.max(0, total - done));
    if (barEl) {
        const p = total > 0 ? (done / total) * 100 : 0;
        barEl.style.width = `${p}%`;
    }
}

function renderList() {
    if (!listEl) return;
    const arr = CARDS.slice();
    if (listMode === 'read') {
        arr.sort((a, b) => String(a.id).localeCompare(String(b.id), 'ja'));
    } else {
        arr.sort((a, b) => a.s.localeCompare(b.s, 'ja'));
    }
    const frag = document.createDocumentFragment();
    arr.forEach(({ id, s }) => {
        const div = document.createElement('div');
        div.textContent = `${String(id).padStart(3, '0')}: ${s}`;
        const h = historyById.get(id);
        if (h) {
            div.classList.add(h.correct ? 'read-ok' : 'read-ng');
            if (h.changed != null) {
                div.classList.add(h.changed ? 'read-changed' : 'read-stable');
            }
        }
        frag.appendChild(div);
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
}

function showQuestion() {
    // 終了チェック
    if (consumedCount >= Math.min(BASE_COUNT, poolIds.length)) {
        updateStatusPill('終了');
        currentGroup = [];
        clearHideTimer();
        if (singleImgEl) singleImgEl.style.display = '';
        const slotsWrap = ensureSlots();
        if (slotsWrap) slotsWrap.innerHTML = '';
        return;
    }

    // 問ごとの向きを決定（問内は統一）
    groupOrientation = decideGroupOrientation();
    setOrientationClass(groupOrientation);

    // 問の ID 群を確定
    currentGroup = pickNextGroup();
    if (currentGroup.length === 0) {
        updateStatusPill('終了');
        return;
    }

    // 表示（1枚は単一 img、2枚以上はスロット）
    if (currentGroup.length === 1 && singleImgEl) {
        // 単一モード：既存動作維持
        const id = currentGroup[0];
        singleImgEl.style.display = '';
        singleImgEl.style.visibility = 'hidden';
        singleImgEl.onload = () => { singleImgEl.style.visibility = 'visible'; };
        singleImgEl.src = id;
    } else {
        renderGroupImages(currentGroup, groupOrientation);
    }

    // 表示→blank のタイマー
    clearHideTimer();
    if (dispSeconds > 0) {
        hideTimer = setTimeout(flipGroupToBlank, dispSeconds);
    }

    // UI系
    if (qidEl) qidEl.textContent = (currentGroup.length === 1) ? String(currentGroup[0]) : currentGroup.join(', ');
    updateStatusPill('出題中');
    groupAnswersKana = [];
    if (answerInputEl) {
        answerInputEl.value = '';
        answerInputEl.focus();
    }
    updateProgress();
}

function judgeSingle(raw) {
    const id = currentGroup[0];
    const kana = normalizeInputToKana(raw);
    if (!kana) {
        return { ok: false, perId: new Map([[id, false]]), expected: [syllableChangingDefault ? computeExpectedPrefixFromIds(id, remainingIds.concat(currentGroup)) : getReadingById(id)] };
    }
    const changing = syllableChangingDefault;
    const expected = changing ? computeExpectedPrefixFromIds(id, remainingIds.concat(currentGroup)) : getReadingById(id);
    const ok = kana === expected;
    return { ok, perId: new Map([[id, ok]]), expected: [expected] };
}

function judgeMulti(inputsKana) {
    // 2枚以上：syllableChanging は強制 false（全文 s 一致）
    const expectedSet = new Set(currentGroup.map(id => getReadingById(id)));
    const inputSet = new Set(inputsKana.filter(Boolean)); // 空は除外
    const ok = (expectedSet.size === inputSet.size) && [...expectedSet].every(x => inputSet.has(x));
    const perId = new Map();
    currentGroup.forEach(id => {
        perId.set(id, inputSet.has(getReadingById(id)));
    });
    return { ok, perId, expected: [...expectedSet] };
}

function afterJudgeAndMaybeAdvance(ok) {
    // 判定結果表示
    if (statusPillEl) statusPillEl.textContent = ok ? 'OK' : 'NG';
    const resultEl = document.getElementById('result');
    if (resultEl) {
        resultEl.textContent = ok ? 'OK' : 'NG';
        resultEl.className = ok ? 'pill ok' : 'pill ng';
    }

    // 伏せていた画像を再表示
    revealGroupImages();

    // 履歴
    const changedFlagForSingle = (currentGroup.length === 1) ? (syllableChangingDefault) : false;
    historyById = historyById || new Map();
    const nowOrder = consumedCount + currentGroup.length; // おおよその既読順
    for (const [id, correct] of (currentGroup.length === 1 ? judgeSingle(answerInputEl?.value || '').perId : judgeMulti(groupAnswersKana).perId)) {
        historyById.set(id, { correct, changed: changedFlagForSingle, readOrder: nowOrder });
    }
    renderList();

    // 次問へ
    const goNext = () => {
        removeCurrentGroupFromRemaining();
        showQuestion();
    };
    if (AUTO_NEXT_MS > 0) {
        //setTimeout(goNext, AUTO_NEXT_MS);
    } else {
        awaitingNextQuestion = true;
    }
}

// ====== イベントハンドラ ======
function submitAnswer() {
    if (!currentGroup.length) return;

    if (currentGroup.length === 1) {
        const res = judgeSingle(answerInputEl?.value || '');
        afterJudgeAndMaybeAdvance(res.ok);
        return;
    }

    // 2枚以上：1入力ごとに次の入力へ（autoAdvance 不問）
    const kana = normalizeInputToKana(answerInputEl?.value || '');
    if (!kana) {
        // 無効入力：何もしない
        answerInputEl && answerInputEl.select();
        return;
    }
    groupAnswersKana.push(kana);
    answerInputEl.value = '';
    answerInputEl.focus();

    if (groupAnswersKana.length >= currentGroup.length) {
        const res = judgeMulti(groupAnswersKana);
        afterJudgeAndMaybeAdvance(res.ok);
    }
}

function skipQuestion() {
    if (!currentGroup.length) return;

    // 未回答は誤答扱い
    const perId = new Map();
    currentGroup.forEach(id => perId.set(id, false));
    // 結果表示
    const resultEl = document.getElementById('result');
    if (resultEl) { resultEl.textContent = 'NG'; resultEl.className = 'pill ng'; }
    updateStatusPill('NG');
    // 復元表示
    revealGroupImages();
    // 次へ
    removeCurrentGroupFromRemaining();
    if (AUTO_NEXT_MS > 0) {
        setTimeout(showQuestion, AUTO_NEXT_MS);
    } else {
        awaitingNextQuestion = true;
    }
}

function resetAll() {
    // 設定再反映（最新値に同期）
    AUTO_NEXT_MS = +settings.waitMs || 0;
    CARDS_DIRECTION = settings.direction || 'random';
    BASE_COUNT = +settings.count || CARDS.length;
    allOrPart = !!settings.allOrPart;
    selectedIdsSet = new Set(Array.isArray(settings.selectedIds) ? settings.selectedIds.map(Number) : []);
    isRomanized = !!settings.isRomanized;
    dispSeconds = (settings.dispSeconds != null) ? +settings.dispSeconds : dispSeconds;
    groupSize = clamp(+settings.groupSize || groupSize, 1, 6);
    syllableChangingDefault = (settings.changing != null) ? !!settings.changing : syllableChangingDefault;

    // プール構築（限定対応）
    const allIds = ALL_IDS_FN ? ALL_IDS_FN() : CARDS.map(c => c.id);
    poolIds = allOrPart && selectedIdsSet.size > 0
        ? allIds.filter(id => selectedIdsSet.has(id))
        : allIds.slice();

    // 数量制限・シャッフル
    const total = Math.min(BASE_COUNT, poolIds.length);
    remainingIds = sampleIds(poolIds, total);

    // 状態初期化
    consumedCount = 0;
    currentGroup = [];
    groupAnswersKana = [];
    clearHideTimer();
    awaitingNextQuestion = false;
    historyById.clear();

    // UI
    if (answerInputEl) { answerInputEl.value = ''; }
    if (qidEl) qidEl.textContent = '-';
    const resultEl = document.getElementById('result');
    if (resultEl) { resultEl.textContent = '未開始'; resultEl.className = 'pill'; }
    updateStatusPill('未開始');
    updateProgress();
    renderList();

    // 最初の出題
    showQuestion();
}

// ====== ワイヤリング ======
if (answerFormEl) {
    answerFormEl.addEventListener('submit', (e) => { e.preventDefault(); submitAnswer(); });
}
if (resetBtn) {
    resetBtn.addEventListener('click', resetAll);
}
if (skipBtn) {
    skipBtn.addEventListener('click', skipQuestion);
}
if (toggleOrderBtn) {
    toggleOrderBtn.addEventListener('click', () => {
        listMode = (listMode === 'syllable') ? 'read' : 'syllable';
        renderList();
    });
}

// ====== 起動 ======
renderList();
resetAll();
