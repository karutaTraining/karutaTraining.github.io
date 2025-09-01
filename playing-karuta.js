// --------- memorize-placement.js ---------
const kimariji1 = window.KIMARIJI_GROUPS;
const kimariji2 = window.KIMARIJI_ITEMS;
const ALL_IDS = (window.KIMARIJI_ALL_IDS ? window.KIMARIJI_ALL_IDS() : window.KIMARIJI_ITEMS.map(x => x.id));
const KEY = 'karutaSettings.v1';
const BOARD_KEY = 'karutaBoard.v1';
const s = (() => {
    try {
        const s4 = JSON.parse(localStorage.getItem(KEY)) || {};
        return s4.playingKaruta || {};
    }
    catch { return {}; }
})();
let saved = null;

const _SEC = 1000;
const halfRow = 3, ROWS = 6, COLS = 11;
const middle = halfRow * COLS, TOTAL = ROWS * COLS;
const MAX_IMAGES = ROWS * COLS;
const grid = document.getElementById('grid');
const BASE_SCALE = 0.09;    // iPhone XR * 0.055

//回答後にimgのイベントリスナーを無効化する/しない
let questionMode = 'mode';
let CHAR_INTERVAL_MS_PLAY = 0;
let AUTO_NEXT_MS = 0;
let autoNext = false;
let emptyExclude = false;
let canFlipAfterCorrect = false;
let canFlipAfterIncorrect = false;
let openAfterCorrect = false;
let openAfterIncorrect = false;

let isVisible = true;
let duringTheTest = false;
let duringPlaying = false;
let cardLocked = false;
let listLocked = false;
let afterAnswer = false;

const revealedIds = new Set();
const selectedIndividuals = new Set();
const groupRowByPrefix = new Map();
const indivRowById = new Map();
const groupMap = new Map();
const idToItem = new Map();
let cardsList = [];
let noneCards = [];
let motherQueue = [];
let currentQuestion = null;
let mqIndex = -1;

(() => {
    // toDo: settings.htmlでLocalStorageに追加する
    console.log('s.excludeFlag=', s?.excludeFlag, 'emptyExclude=', emptyExclude);
    console.log('allOrPart=', s?.allOrPart, 'selectedIds.len=', (s?.selectedIds || []).length);
    console.log('present.size=', _presentIdsFromBoard().size);

    CHAR_INTERVAL_MS_PLAY = s?.syllableInterval ?? 1000;
    AUTO_NEXT_MS = s?.waitMs ?? 8000;
    autoNext = s?.autoAdvance ?? false;
    emptyExclude = s?.excludeFlag ?? false;
    questionMode = 'individual';         // mixed, group, individual
})();

// ===== 保存盤面の適用：失敗時は警告して memorize-placement に戻す =====
function restoreBoardFromStorage() {
    try { saved = JSON.parse(localStorage.getItem(BOARD_KEY) || null); }
    catch { }

    // noneCards は保存値を採用（プレイはこの配列をメモリ上で更新する）
    noneCards = saved.noneCards.slice();
    cardsList = saved.boardLayout.slice();

    return true;
}


// 内部状態（固定レイアウトの保持）
function _mpState() {
    if (!window.__MP_STATE) {
        window.__MP_STATE = { boardLayout: null, layoutBuilt: false };
    }
    return window.__MP_STATE;
}

// ★ 追加：グループ → 個別札ID[] のマップを作成
kimariji1.forEach(g => {
    const ids = kimariji2
        .filter(k => k.s.startsWith(g.s))
        .map(k => k.id);
    groupMap.set(g.s, ids);
});
kimariji2.forEach(k => idToItem.set(k.id, k));



function updateQuestionView() {
    const qEl = document.querySelector('.question');
    if (!qEl) return;
    let text = '';
    if (!currentQuestion) { qEl.textContent = ''; return; }
    if (currentQuestion.type === 'group') {
        text = currentQuestion.s;
    } else {
        const item = idToItem.get(currentQuestion.id);
        text = item ? item.s : '';
    }
    qEl.textContent = text;
}

function clearJudgeView() {
    const j = document.querySelector('.judge');
    if (j) { j.style.display = 'none'; j.textContent = ''; j.classList.remove('ok', 'ng'); }
}

// blank.png の実寸を読み取り、CSS変数を更新
function setSizeFromFirst() {
    return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => {
            const w = probe.naturalWidth * BASE_SCALE;
            const h = probe.naturalHeight * BASE_SCALE;
            const r = document.documentElement.style;
            r.setProperty('--w', w + 'px');
            r.setProperty('--h', h + 'px');
            resolve({ w, h });
        };
        probe.onerror = () => resolve();
        probe.src = 'blank';
    });
}




const decideAllowedIds = () => {
    if (s.allOrPart && Array.isArray(s.selectedIds) && s.selectedIds.length > 0) {
        const want = new Set(s.selectedIds.map(Number));
        return ALL_IDS.filter(id => want.has(id));
    }
    return ALL_IDS.slice();
};
const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

function nowTimeSeconds() {
    const n = new Date();
    return n.getHours().toString().padStart(2, '0') + ':' + n.getMinutes().toString().padStart(2, '0') + ':' + n.getSeconds().toString().padStart(2, '0') + '.' + n.getMilliseconds().toString().padStart(3, '0');
}



// 画像を配置（固定レイアウト boardLayout を忠実に反映）※未配置＆noneは非表示
function render() {
    //const st = _mpState();
    //const layout = st.boardLayout || buildInitialLayout();

    const frag = document.createDocumentFragment();
    const appendCell = (i) => {
        const cell = document.createElement('div');
        cell.dataset.idx = String(i);

        const assignedId = cardsList[i] || 0;        // レイアウト上のID（0あり）

        // 未配置 or noneCards=true → 非表示セル（imgは作らない）
        if (assignedId === 0 || noneCards[i]) {
            cell.className = 'cell none';
            cell.dataset.cid = '0';                 // presentIds計算の安全側
            frag.appendChild(cell);
            return;
        }

        // 表示セル
        cell.className = (i < middle ? 'cell upside-down' : 'cell upright');
        cell.dataset.cid = String(assignedId);

        const img = document.createElement('img');
        // isVisible / revealedIds の公開ロジックはここでは使わず、公開前は「見せない」要件に沿って、
        // 盤面には常に実ID画像を描画（プレイモードではクリック可）。
        img.alt = `${assignedId}.png`;
        img.src = `${assignedId}`;

        cell.appendChild(img);
        frag.appendChild(cell);
    };

    for (let i = 0; i < TOTAL; i++) appendCell(i);

    grid.innerHTML = '';
    grid.appendChild(frag);
}







// ===== クリック操作（盤面セル）【置換版】=====
grid.addEventListener('click', (e) => {
    // ★ プレイ中は従来のトグルを無効化（onGridClickDuringPlaying が拾う）
    if (duringPlaying) return;

    const img = e.target.closest('.cell:not(.none) > img');
    if (!img) return;
    if (cardLocked) return;

    const cell = img.parentElement;
    const idx = +(cell?.dataset?.idx ?? -1);
    const underId = +(cell?.dataset?.cid ?? 0);

    // カスタムイベント（既存仕様）
    try {
        grid.dispatchEvent(new CustomEvent('selectCards', {
            detail: { index: idx, id: underId, duringTheTest }
        }));
    } catch { }

    if (underId === 0) return;
    if (selectedIndividuals.has(underId)) selectedIndividuals.delete(underId);
    else selectedIndividuals.add(underId);
    recomputeUI();
    /*
    const srcNow = img.getAttribute('src') || '';
    if (duringTheTest && !afterAnswer) {
        if (srcNow.endsWith('hide')) {
            img.src = 'blank';
        } else if (srcNow.endsWith('blank')) {
            img.src = 'hide';
        }
    } else {
        if (underId === 0) return;
        if (selectedIndividuals.has(underId)) selectedIndividuals.delete(underId);
        else selectedIndividuals.add(underId);
        recomputeUI();
    }
    */
});


function updateButtonControls() {
    const show = (el, ok) => { if (!el) return; el.style.display = ok ? 'block' : 'none'; };
    /*
    const bShuffle = document.getElementById('shuffleBtn');
    const bVisible = document.getElementById('changeVisible');
    const bStart = document.getElementById('startQuestion');
    const bEnd = document.getElementById('endQuestion');
    const bAnswer = document.getElementById('answer');
    const bNext = document.getElementById('next');
    */
    const bPlayStart = document.getElementById('startPlaying');
    const bNextStart = document.getElementById('nextPlaying');
    const bPlayEnd = document.getElementById('endPlaying');

    if (duringPlaying) {
        show(bPlayStart, false);
        show(bNextStart, true);
        show(bPlayEnd, true);
    } else {
        show(bPlayStart, true);
        show(bNextStart, false);
        show(bPlayEnd, false);
    }
}





// ボタンイベント
// プレイモードの開始/終了ボタン
document.getElementById('startPlaying')?.addEventListener('click', startPlayingGame);
document.getElementById('nextPlaying')?.addEventListener('click', nextPlayingGame);
document.getElementById('endPlaying')?.addEventListener('click', endPlayingGame);

// ★ 新：選択状態から UI と盤面(非表示時)を一括再計算
function recomputeUI() {
    // まず行の見た目を更新
    indivRowById.forEach((row, id) => {
        row.classList.toggle('selected', selectedIndividuals.has(id));
    });
    groupRowByPrefix.forEach((row, prefix) => {
        const ids = groupMap.get(prefix) || [];
        const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
        row.classList.toggle('selected', allSelected);
    });

    // ★ 両モード共通で override を組み立て直す（listSelected ∩ presentIds）
    revealedIds.clear();
    const onBoard = new Set(cardsList); // 現在盤面に存在するID
    selectedIndividuals.forEach(id => { if (onBoard.has(id)) revealedIds.add(id); });
    render(); // 盤面反映
}




//これはデバッグ用？
const snap = (tag) => console.table(
    Array.from(document.querySelectorAll('#grid .cell')).map(c => ({
        idx: +c.dataset.idx, id: +(c.dataset.cid || 0), tag
    }))
);
//snap('before'); render(); snap('after');







// ================== プレイモード状態 ==================
const playingState = {
    active: false,
    intervalMs: CHAR_INTERVAL_MS_PLAY,
    pool: [],             // 出題母集団（個別ID配列）
    currentId: null,      // 出題中の個別ID
    currentReading: '',   // かな
    kIndex: null,         // 識別確定文字のインデックス(1-based)
    times: [],            // 各文字が可視化された時刻(ms) 1-basedで times[1] = 1文字目
    revealedTimer: null,  // setInterval のID
    resultTimer: null,    // 結果表示の setTimeout
    clicked: null,        // { id:number, at:number(ms) } | null
};

// ================== ユーティリティ ==================
function _qs(sel) { return document.querySelector(sel); }
function _qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function _now() { return Date.now(); }
function _roundSec2(x_ms) { return Math.round((x_ms / _SEC) * 100) / 100; } // 小数第2位

// KIMARIJI 読み取得
function _readById(id) {
    const a = (window.KIMARIJI_ITEMS || []);
    const hit = a.find(o => o && o.id === id);
    return hit ? String(hit.s || '') : '';
}

// LCP
function _lcpLen(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
}

// 盤面に「存在」する個別ID集合（DOMベース）
function _presentIdsFromBoard() {
    const ids = new Set();
    document.querySelectorAll('#grid .cell:not(.none)').forEach(cell => {
        const cid = Number(cell.dataset.cid || 0);
        if (cid) ids.add(cid);
    });
    (() => { const m = '[DEBUG] presentIds:' + Array.from(ids).sort((a, b) => a - b) + ' →'; console.log(m, nowTimeSeconds()); })();
    return ids;
}



// 指定IDのカードを盤面から除去（対応セルの noneCards を true にして再描画）
function removeIdFromBoard(id) {
    // 現在の DOM から対象セルを特定（レイアウト自体は固定のまま）
    const cell = document.querySelector(`#grid .cell[data-cid="${id}"]:not(.none)`);
    if (cell) {
        const idx = Number(cell.dataset.idx || -1);
        if (Number.isInteger(idx) && idx >= 0) {
            noneCards[idx] = true; // このマスを無効化
            (() => { const m = `[DEBUG] remove: id=${id} at idx=${idx} →`; console.log(m, nowTimeSeconds()); })();
        }
    } else {
        (() => { const m = `[DEBUG] remove: id=${id} not found on board (already none?) →`; console.log(m, nowTimeSeconds()); })();
    }
    render();
    recomputeUI();
}





// 最短識別位置 k（1-based）を算出（候補は pool 全体）
function _computeKIndexForId(currentId, poolIds) {
    const t = _readById(currentId);
    let maxL = 0;
    for (const id of poolIds) {
        if (id === currentId) continue;
        const o = _readById(id);
        if (!o) continue;
        const l = _lcpLen(t, o);
        if (l > maxL) maxL = l;
    }
    // 少なくとも1文字
    return Math.min(t.length, maxL + 1); // 1..t.length
}

// 出題母集団を構築（selectedIds 基準 + emptyExclude 適用）【置換版】
function buildPlayingGamePool(selectedIdsInput, applyEmptyExclude) {
    const base = Array.isArray(selectedIdsInput) ? selectedIdsInput.slice()
        : (selectedIdsInput instanceof Set ? Array.from(selectedIdsInput) : []);
    const pool = applyEmptyExclude
        ? (function () {
            const present = _presentIdsFromBoard();           // 盤面に存在するIDだけ
            return base.filter(id => present.has(id));
        })()
        : base;

    // ★ 出題順ランダム化
    return shuffle(pool);
    /*
    if (!applyEmptyExclude) return base;

    const present = _presentIdsFromBoard(); // 盤面存在
    return base.filter(id => present.has(id));
    */
}


// 逐次表示の開始（<span>で文字ごとに可視化）【置換版】
function beginSequentialReveal(containerEl, textKana, intervalMs, onCharShown, onAllShown) {
    containerEl.textContent = '';
    const spans = [];
    for (const ch of Array.from(textKana)) {
        const sp = document.createElement('span');
        sp.style.visibility = 'hidden';
        sp.textContent = ch;
        containerEl.appendChild(sp);
        spans.push(sp);
    }

    let i = 0;
    const times = [null]; // 1-based: times[1] が1文字目
    let timerId = null;

    const showOne = () => {
        if (i >= spans.length) return;
        spans[i].style.visibility = 'visible';
        times[i + 1] = Date.now();
        if (typeof onCharShown === 'function') onCharShown(i + 1, times[i + 1]);
        i++;
        if (i === spans.length) {
            if (timerId) clearInterval(timerId);
            if (typeof onAllShown === 'function') onAllShown(times);
        }
    };

    // 先に interval を確保してから初回実行（TDZ回避）
    timerId = setInterval(showOne, intervalMs);
    showOne();

    return { timerId, times };
}

// 判定メッセージを表示（displayも復帰）
function _showJudgeMessage(text) {
    const el = document.querySelector('.judge');
    if (!el) return;
    el.textContent = text;
    el.style.display = '';     // CSS競合対策：必要なら 'block' に
    console.log('[JUDGE] show', new Date().toISOString().slice(11, 23), 'msg=', text, 'AUTO_NEXT_MS=', AUTO_NEXT_MS);
}




// 盤面クリック（プレイ中のみ有効）【置換版】
function onGridClickDuringPlaying(ev) {
    if (!playingState.active) return;
    const img = ev.target.closest('#grid .cell:not(.none) > img');
    if (!img) return;
    const cell = img.parentElement;
    const id = Number(cell?.dataset?.cid || 0);
    if (!id) return;
    (() => { const m = '[DEBUG] clicked id=' + id + ' →'; console.log(m, nowTimeSeconds()); })();

    if (!playingState.clicked) {
        playingState.clicked = { id, at: Date.now() };
    }
}


// ========== プレイモード開始/終了/1問進行 ==========

// プレイモード開始【置換版】
function startPlayingGame() {
    if (playingState.active) return;

    // 固定条件
    duringPlaying = true;
    questionMode = 'individual';       // 個別固定
    listLocked = true;                  // リスト操作不可
    isVisible = true;                   // 常時公開
    revealedIds.clear();
    selectedIndividuals.clear();
    render();
    recomputeUI();
    updateButtonControls();


    // 文字間隔
    playingState.intervalMs = CHAR_INTERVAL_MS_PLAY;

    // 出題母集団（settings.selectedIds を基準／emptyExclude適用）
    const sel = decideAllowedIds();                   // 設定で選択された個別IDの実集合
    const pool = buildPlayingGamePool(sel, !!emptyExclude);
    playingState.pool = pool.slice();
    playingState.active = true;

    // 盤面クリックイベント（1回だけ束ねる）
    document.addEventListener('click', onGridClickDuringPlaying, { capture: true });

    // 最初の出題
    nextPlayingGame();
}

// プレイモード終了【置換版】
function endPlayingGame() {
    if (!playingState.active) return;
    playingState.active = false;
    duringPlaying = false;

    // タイマー停止
    if (playingState.revealedTimer) clearInterval(playingState.revealedTimer);
    if (playingState.resultTimer) clearTimeout(playingState.resultTimer);

    // クリック解除
    document.removeEventListener('click', onGridClickDuringPlaying, { capture: true });

    // リスト操作の復帰
    listLocked = false;

    // 表示は見やすさ優先で公開状態に戻す
    isVisible = true;
    const qEl = document.querySelector('.question'); if (qEl) qEl.textContent = '';
    _showJudgeMessage('');

    // 状態クリア
    playingState.pool = [];
    playingState.currentId = null;
    playingState.currentReading = '';
    playingState.kIndex = null;
    playingState.times = [];
    playingState.revealedTimer = null;
    playingState.resultTimer = null;
    playingState.clicked = null;

    // 以降のUI再描画は不要（遷移するため）
    const url = new URL('./memorize-placement.html', location.href);
    url.searchParams.set('from', 'playing');
    location.href = url.href;
}


// 次の1問へ（判定クリア→出題→逐次表示→finalize予約は別関数で）
function nextPlayingGame() {
    if (!playingState.active) return;

    // プール尽きたら終了
    if (!playingState.pool || !playingState.pool.length) {
        _showJudgeMessage('終了');
        return;
    }

    // ★ 前問の判定をここでクリア（AUTO_NEXT_MS分は前問で表示済）
    const jEl = document.querySelector('.judge');
    console.log('[JUDGE] clear-beforeNext', new Date().toISOString().slice(11, 23), 'text=', jEl ? jEl.textContent : '(none)');
    if (jEl) jEl.textContent = '';

    // 1問取り出し
    const id = playingState.pool.shift();
    playingState.currentId = id;
    const reading = _readById(id);
    playingState.currentReading = reading;

    // 表示初期化
    const qEl = document.querySelector('.question');
    const jEl2 = document.querySelector('.judge');
    if (jEl2) jEl2.style.display = ''; // 念のため可視化
    playingState.clicked = null;
    playingState.times = [];

    // k（識別確定の位置）を算出
    const k = _computeKIndexForId(id, playingState.pool.concat([id]));
    playingState.kIndex = k;

    // 逐次表示開始（全文字表示“完了後”に nms 後 finalize）
    const { timerId } = beginSequentialReveal(
        qEl || document.body,
        reading,
        CHAR_INTERVAL_MS_PLAY,
    /* onCharShown */ null,
    /* onAllShown  */(timesArr) => {
            playingState.times = timesArr;
            clearTimeout(playingState.resultTimer);
            playingState.resultTimer = setTimeout(_finalizeJudgeAndAdvance, CHAR_INTERVAL_MS_PLAY);
            console.log('[SEQ] onAllShown', new Date().toISOString().slice(11, 23), 'len=', timesArr.length);
        }
    );
    playingState.revealedTimer = timerId;

    console.log('[Q] start id=', id, 'reading=', reading, 'k=', k,
        'CHAR_INTERVAL_MS_PLAY=', CHAR_INTERVAL_MS_PLAY, 'AUTO_NEXT_MS=', AUTO_NEXT_MS);
}


// クリック判定を最終化して表示。AUTO_NEXT_MS だけ残してから次問へ
function _finalizeJudgeAndAdvance() {
    if (!playingState.active) return;

    const id = playingState.currentId;
    const reading = playingState.currentReading || '';
    const k = playingState.kIndex || 1;
    const times = playingState.times || [];
    const clicked = playingState.clicked; // {id, at} or null

    // 判定メッセージの決定（既存仕様に合わせた概要判定）
    let message = '';
    const now = Date.now();

    // 盤面に存在するか（presentIds）
    const presentIds = _presentIdsFromBoard();
    const existsOnBoard = presentIds.has(id);

    if (!existsOnBoard) {
        // 空札の扱い（クリックなし→正解:空札 / クリック有→誤札）
        if (!clicked) {
            message = '正解:空札';
        } else {
            message = '不正解: 誤札';
        }
    } else {
        // クリックが無ければ時間Over
        if (!clicked) {
            message = '不正解:時間Over';
        } else if (clicked.id !== id) {
            message = '不正解: 誤札';
        } else {
            // タイミング判定（k文字目の表示完了を基準、±CHAR_INTERVAL_MS_PLAY の窓）
            const t_k = times[k];            // k文字目が出た時刻
            const t_k1 = times[k + 1] || (t_k + CHAR_INTERVAL_MS_PLAY); // 次文字 or k+1無ければ +nms
            const earlyWindowStart = t_k;               // ここからOK
            const lateWindowEnd = t_k + CHAR_INTERVAL_MS_PLAY; // ここまでOK
            const at = clicked.at;

            if (at >= earlyWindowStart && at < lateWindowEnd) {
                message = '正解:タイミングOK';
            } else if (at < earlyWindowStart) {
                const diff = Math.max(0, earlyWindowStart - at) / 1000;
                message = `ズレ:${diff.toFixed(2)} 秒Earlier`;
            } else {
                const diff = Math.max(0, at - lateWindowEnd) / 1000;
                message = `ズレ:${diff.toFixed(2)} 秒Over`;
            }

            // クリック詳細ログ
            console.log('[KIMERU]', {
                id, k,
                t_k: new Date(t_k).toISOString().slice(11, 23),
                t_k1: new Date(t_k1).toISOString().slice(11, 23),
                clickAt: new Date(clicked.at).toISOString().slice(11, 23)
            });
        }
    }

    // 表示
    _showJudgeMessage(message);

    // ここで次問を「AUTO_NEXT_MS 後」に予約する（即時ではない）
    console.log('[JUDGE] scheduleNext', new Date().toISOString().slice(11, 23), 'wait=', AUTO_NEXT_MS, 'ms');
    clearTimeout(playingState.nextTimer);
    playingState.nextTimer = setTimeout(() => {
        if (autoNext) {
            console.log('[JUDGE] goNext', new Date().toISOString().slice(11, 23));
            nextPlayingGame();
        }
    }, AUTO_NEXT_MS);

    // 正解・不正解に関わらず出題IDを消費し、盤面から除去（要件）
    if (existsOnBoard) {
        removeIdFromBoard(id);
    }
}






window.addEventListener('storage', (ev) => {
    if (ev.key !== KEY) return;
    cardsList = saved.boardLayout.slice();
    revealedIds.clear();
    isVisible = true;
    render();
    recomputeUI();
});



// 初期化
(async function init() {
    await setSizeFromFirst();
    restoreBoardFromStorage();

    isVisible = true;

    // 行要素 → マップ
    document.querySelectorAll('#listGroup .list-row').forEach(row => {
        const m = (row.textContent || '').match(/：(.+?)\s*$/);
        if (m) { groupRowByPrefix.set(m[1].trim(), row); }
    });
    document.querySelectorAll('#listIndividual .list-row').forEach(row => {
        const m = (row.textContent || '').match(/#(\d+)/);
        if (m) { indivRowById.set(+m[1], row); }
    });
    

    

    render();
    recomputeUI();
    updateButtonControls();
    startPlayingGame();


    (() => { const m = `[DEBUG] init: CHAR_INTERVAL_MS_PLAY=${CHAR_INTERVAL_MS_PLAY}, AUTO_NEXT_MS=${AUTO_NEXT_MS} →`; console.log(m, nowTimeSeconds()); })();
})();



