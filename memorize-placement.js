/* ---------------  memorize-placement.js -----------------------------------*/

/* ----------------------------
 * [REWRITE] グローバル依存の参照
 * ---------------------------- */
(() => {
    // 外部データ（settings.js / kimariji-data.js から供給される前提）
    const GROUPS = window.KIMARIJI_GROUPS || []; // {id, s}
    const ITEMS = window.KIMARIJI_ITEMS || []; // {id, s}
    const ALL_IDS = ITEMS.map(x => x.id);

    // localStorage キー
    const KEY_SETTINGS = 'karutaSettings.v1';
    const KEY_BOARD = 'karutaBoard.v1';

    // 設定の読込（無ければ既定）
    const settings = (() => {
        try {
            const s3 = JSON.parse(localStorage.getItem(KEY_SETTINGS)) || {};
            return s3.memorizePlacement || {};
        }
        catch { return {}; }
    })();

    // noneCards（不変）：按分専用
    const noneCards = (() => {
        if (Array.isArray(settings.noneCards) && settings.noneCards.length === 66) {
            return settings.noneCards.slice();
        }
        // デフォルト：全マス有効
        return new Array(66).fill(false);
    })();

    /* ----------------------------
     * [REWRITE] DOM 参照
     * ---------------------------- */
    const elGrid = document.getElementById('grid');
    const elShuffle = document.getElementById('shuffleBtn');
    const elInvert = document.getElementById('changeVisible');
    const elStartQ = document.getElementById('startQuestion');
    const elNextQ = document.getElementById('nextQuestion');
    const elEndQ = document.getElementById('endQuestion');
    const elAnswer = document.getElementById('answer');
    const elPlay = document.getElementById('startPlaying');

    const elListG = document.getElementById('listGroup');
    const elListI = document.getElementById('listIndividual');
    const elJudge = document.querySelector('.judge');
    const elQuestion = document.querySelector('.question');

    /* ----------------------------
     * [REWRITE] 盤面・状態
     * ---------------------------- */
    const ROWS = 6, COLS = 11, TOTAL = 66, MID = 33;
    const SCALE_BASE = 0.09;

    // 盤面の唯一のソース：0 = 非存在（描画しない）
    let gridIds = new Array(TOTAL).fill(0);

    // 表示反転（座標単位）
    let selectedCells = new Array(TOTAL).fill(false);

    // 回答選択（座標単位／回答前のみ有効）
    let answerMarks = new Array(TOTAL).fill(false);

    // 公開モード：true=基本は id / false=基本は hide
    let isVisible = true;

    // テスト状態
    let duringTheTest = false;
    let afterAnswer = false;

    // ロック（true なら操作不可）
    let listLocked = false;  // 回答前は true、初期/回答後は false（canFlip次第）
    let cardLocked = false;  // 回答前の盤面「反転」は不可（回答選択のみ）

    // 出題設定
    const questionMode = settings?.groupMode ?? 'group'; // 'group' | 'individual' | 'mixed'
    const open = settings?.doOpen ?? 'correct';
    if (open === 'ok') {
        openAfterCorrect = true;
        openAfterIncorrect = true;
    }
    else if (open === 'ng') {
        openAfterCorrect = false;
        openAfterIncorrect = false;
    }
    else if (open === 'incorrect') {
        openAfterCorrect = false;
        openAfterIncorrect = true;
    }
    else {
        openAfterCorrect = true;
        openAfterIncorrect = false;
    }
    const flip = settings?.canFlip ?? 'correct';
    if (open === 'ok') {
        canFlipAfterCorrect = true;
        canFlipAfterIncorrect = true;
    }
    else if (open === 'ng') {
        canFlipAfterCorrect = false;
        canFlipAfterIncorrect = false;
    }
    else if (open === 'correct') {
        canFlipAfterCorrect = true;
        canFlipAfterIncorrect = false;
    }
    else {
        canFlipAfterCorrect = false;
        canFlipAfterIncorrect = true;
    }

    // [NEW] 直近の判定結果を保持（true=正解, false=誤答, null=未判定）
    let lastJudgeOk = null;


    // リスト（UI）用の“選択集合”（盤面の有無に依存しない）
    const selectedIndividuals = new Set(); // [NEW] リスト同値の唯一ソース

    // id→盤面インデックスの逆引き（配置更新時に再構築）
    const idIndexMap = new Map();

    // グループ Map（prefix -> id[]） & id→item
    const groupMap = new Map();
    const idToItem = new Map();
    GROUPS.forEach(g => {
        const ids = ITEMS.filter(k => k.s.startsWith(g.s)).map(k => k.id);
        groupMap.set(g.s, ids);
    });
    ITEMS.forEach(k => idToItem.set(k.id, k));

    // 質問キュー
    let motherQueue = [];
    let mqIndex = -1;
    let currentQuestion = null;

    // セル DOM のキャッシュ
    const cellRefs = new Array(TOTAL).fill(null); // {cell, img}

    /* ----------------------------
     * [NEW] ユーティリティ
     * ---------------------------- */
    function tryRestoreBoardFromSnapshot() {
        try {
            const snapStr = localStorage.getItem(KEY_BOARD);
            if (!snapStr) return false;
            const snap = JSON.parse(snapStr);
            const arr = Array.isArray(snap?.boardLayout) ? snap.boardLayout : null;
            if (!arr || arr.length !== TOTAL) return false;

            // 復元
            gridIds = arr.slice(0, TOTAL).map(Number);
            rebuildIdIndexMap();

            // 復元を1回限りにする
            localStorage.removeItem(KEY_BOARD);

            return true;
        } catch {
            return false;
        }
    }


    function setCardSizeFromBlank() {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const w = img.naturalWidth * SCALE_BASE;
                const h = img.naturalHeight * SCALE_BASE;
                const r = document.documentElement.style;
                console.log('w, h:', w, h);
                r.setProperty('--w', `${w}px`);
                r.setProperty('--h', `${h}px`);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = 'blank';
        });
    }

    function shuffleInPlace(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function decideAllowedIds() {
        if (settings.allOrPart && Array.isArray(settings.selectedIds) && settings.selectedIds.length) {
            const wants = new Set(settings.selectedIds.map(Number));
            return ALL_IDS.filter(id => wants.has(id));
        }
        return ALL_IDS.slice();
    }

    function pickNumbers() {
        const pool = shuffleInPlace(decideAllowedIds().slice());
        const slots = noneCards.reduce((n, v) => n + (v ? 0 : 1), 0);
        return pool.slice(0, Math.min(slots, pool.length));
    }

    /* ----------------------------
     * [REWRITE] 配置（按分）
     * noneCards を参照して gridIds を更新（noneCards は更新しない）
     * 差分 index のみ再描画。idIndexMap を再構築。
     * ---------------------------- */
    function applyDistribution(pickedIds) {
        const next = new Array(TOTAL).fill(0);

        // 置ける枠数
        const topSlots = noneCards.slice(0, MID).reduce((n, v) => n + (v ? 0 : 1), 0);
        const botSlots = noneCards.slice(MID).reduce((n, v) => n + (v ? 0 : 1), 0);

        const N = pickedIds.length;
        const up = Math.floor(N / 2);
        const down = N - up;

        const topPlace = Math.min(up, topSlots);
        const botPlace = Math.min(down, botSlots, N - topPlace);

        const topIds = pickedIds.slice(0, topPlace);
        const botIds = pickedIds.slice(topPlace, topPlace + botPlace);

        // 上段に左詰め
        let ti = 0;
        for (let i = 0; i < MID; i++) {
            if (!noneCards[i] && ti < topIds.length) next[i] = topIds[ti++];
        }
        // 下段は skipRows を 0 で埋めてから左詰め
        let bi = 0;
        const skip = botSlots - botPlace;
        let skipped = 0;
        for (let i = MID; i < TOTAL; i++) {
            if (noneCards[i]) continue;
            if (skipped < skip) { skipped++; continue; }
            if (bi < botIds.length) next[i] = botIds[bi++];
        }

        // 差分だけ反映 & 選択状態の初期化
        const changed = [];
        for (let i = 0; i < TOTAL; i++) {
            if (gridIds[i] !== next[i]) {
                gridIds[i] = next[i];
                selectedCells[i] = false; // [FIX] セルの意味が変わるためリセット
                answerMarks[i] = false;  // [FIX] テスト選択も無効化
                changed.push(i);
            }
        }

        rebuildIdIndexMap();
        paintCells(changed);
    }

    function rebuildIdIndexMap() {
        idIndexMap.clear();
        for (let i = 0; i < TOTAL; i++) {
            const id = gridIds[i];
            if (!id) continue;
            if (!idIndexMap.has(id)) idIndexMap.set(id, []);
            idIndexMap.get(id).push(i);
        }
    }

    /* ----------------------------
     * [REWRITE] 画像の決定（描画ロジックの唯一窓口）
     * ---------------------------- */
    function srcFor(index) {
        const id = gridIds[index];
        if (id === 0) return null; // 非存在（描画しない）

        // テスト中・回答前：blank / 0 の二値
        if (duringTheTest && !afterAnswer) {
            return answerMarks[index] ? 'blank' : 'hide';
        }

        // 初期 or 回答後（可）：
        const flip = !!selectedCells[index];
        if (isVisible) {
            // 公開モード：flip=true は覆う（hide）
            return flip ? 'hide' : `${id}`;
        } else {
            // 非公開モード：flip=true は公開（id）
            return flip ? `${id}` : 'hide';
        }
    }

    /* ----------------------------
     * [REWRITE] 差分描画 API
     * ---------------------------- */
    function ensureCell(index) {
        if (cellRefs[index]) return cellRefs[index];
        const cell = document.createElement('div');
        cell.className = (index < MID) ? 'cell upside-down' : 'cell upright';
        cell.dataset.idx = String(index);
        cell.dataset.cid = '0';
        cellRefs[index] = { cell, img: null };
        return cellRefs[index];
    }

    function paintCell(index) {
        const ref = ensureCell(index);
        const id = gridIds[index];
        const src = srcFor(index);

        if (id === 0) {
            ref.cell.className = 'cell none';
            ref.cell.dataset.cid = '0';
            if (ref.img && ref.img.parentNode) ref.cell.removeChild(ref.img);
            ref.img = null;
            return;
        } else {
            ref.cell.className = (index < MID) ? 'cell upside-down' : 'cell upright';
            ref.cell.dataset.cid = String(id);
        }

        if (!ref.img) {
            const img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            ref.cell.appendChild(img);
            ref.img = img;
        }

        const nextSrc = src || 'hide';
        //if (ref.img.__cardToken !== nextSrc) { console.log('cardToken', nextSrc); }
        if (!ref.img.src.endsWith(nextSrc)) {
            console.log('endWith', nextSrc);
            ref.img.src = nextSrc;
            ref.img.alt = nextSrc.substring(nextSrc.lastIndexOf('/') + 1);
        }
    }

    function paintCells(indices) {
        for (const i of indices) paintCell(i);
    }

    function paintAll() {
        const all = [];
        for (let i = 0; i < TOTAL; i++) all.push(i);
        paintCells(all);
    }

    function renderGridOnce() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < TOTAL; i++) {
            const { cell } = ensureCell(i);
            frag.appendChild(cell);
        }
        elGrid.innerHTML = '';
        elGrid.appendChild(frag);
        paintAll();
    }

    /* ----------------------------
     * [REWRITE] リスト（UI）更新
     *  - リスト同士（グループ⇄個別）の同値は selectedIndividuals のみで判定（盤面非依存）
     * ---------------------------- */
    function updateListUI() {
        // 個別
        if (elListI) {
            elListI.querySelectorAll('.list-row').forEach(row => {
                const m = (row.textContent || '').match(/#(\d+)/);
                if (!m) return;
                const id = +m[1];
                row.classList.toggle('selected', selectedIndividuals.has(id));
            });
        }
        // グループ
        if (elListG) {
            elListG.querySelectorAll('.list-row').forEach(row => {
                const m = (row.textContent || '').match(/：(.+?)\s*$/);
                if (!m) return;
                const prefix = m[1].trim();
                const ids = groupMap.get(prefix) || [];
                const all = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));
                row.classList.toggle('selected', all);
            });
        }
        // 可否
        [elListG, elListI].forEach(el => {
            if (!el) return;
            el.style.pointerEvents = listLocked ? 'none' : 'auto';
            el.style.opacity = listLocked ? '0.55' : '';
            el.setAttribute('aria-disabled', listLocked ? 'true' : 'false');
        });
    }

    /* ----------------------------
     * [REWRITE] 出題キュー
     * ---------------------------- */
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function buildMotherQueue() {
        const allowed = decideAllowedIds();
        const allowedSet = new Set(allowed);

        const groupEntries = GROUPS
            .filter(g => (groupMap.get(g.s) || []).some(id => allowedSet.has(id)))
            .map(g => ({ type: 'group', id: g.id, s: g.s }));

        const indivEntries = allowed.map(id => ({ type: 'individual', id }));

        if (questionMode === 'group') motherQueue = shuffle(groupEntries.slice());  
        else if (questionMode === 'individual') motherQueue = shuffle(indivEntries.slice());  
        else motherQueue = shuffle(groupEntries.concat(indivEntries));
        //else motherQueue = shuffle(groupEntries.slice()).concat(shuffle(indivEntries.slice()));

        mqIndex = -1;
        currentQuestion = null;
    }

    function nextFromQueue() {
        mqIndex++;
        if (mqIndex >= motherQueue.length) {
            alert('出題はすべて消費しました。');
            endQuestionFlow();
            return null;
        }
        currentQuestion = motherQueue[mqIndex];
        updateQuestionView();
        return currentQuestion;
    }

    function updateQuestionView() {
        if (!elQuestion) return;
        if (!currentQuestion) { elQuestion.textContent = ''; return; }
        elQuestion.textContent = (currentQuestion.type === 'group')
            ? currentQuestion.s
            : (idToItem.get(currentQuestion.id)?.s || '');
    }

    function clearJudgeView() {
        if (!elJudge) return;
        elJudge.style.display = 'none';
        elJudge.textContent = '';
        elJudge.classList.remove('ok', 'ng');
    }

    function updateButtons() {
        const show = (el, ok) => { if (el) el.style.display = ok ? 'block' : 'none'; };
        show(elShuffle, !duringTheTest);
        show(elInvert, !duringTheTest);
        show(elStartQ, !duringTheTest);
        show(elEndQ, duringTheTest);
        show(elAnswer, duringTheTest);
        show(elNextQ, duringTheTest);
        show(elPlay, !duringTheTest);
    }

    /* ----------------------------
     * [REWRITE] 盤面クリック（座標→リストへも反映）
     *  - 初期モード：常に可
     *  - 回答前：回答選択（answerMarks）のみ
     *  - 回答後：canFlipAfterCorrect/Incorrect が true の場合のみ可
     * ---------------------------- */
    elGrid.addEventListener('click', (ev) => {
        const img = ev.target.closest('.cell:not(.none) > img');
        if (!img) return;

        const cell = img.parentElement;
        const idx = +cell.dataset.idx;
        const id = gridIds[idx];
        if (!id) return;

        // テスト中・回答前 → 0/blank のトグルのみ
        if (duringTheTest && !afterAnswer) {
            answerMarks[idx] = !answerMarks[idx];
            paintCell(idx);
            return;
        }

        // ここからは「反転」モード（初期 or 回答後で可な場合のみ）
        const canFlipNow =
            !duringTheTest // 初期モードは常に可
            || (afterAnswer && (
                (lastJudgeOk === true && canFlipAfterCorrect)   // [FIX: gate] 正解後は canFlipAfterCorrect
                || (lastJudgeOk === false && canFlipAfterIncorrect) // [FIX: gate] 誤答後は canFlipAfterIncorrect
            ));
        if (!canFlipNow) return;


        // セル単位のトグル
        selectedCells[idx] = !selectedCells[idx];
        paintCell(idx);

        // [NEW] 盤面→リスト（個別）の同期：その id の全インデックスが true なら add、でなければ delete
        const idxs = idIndexMap.get(id) || [];
        const fully = idxs.length > 0 && idxs.every(i => selectedCells[i]);
        if (fully) selectedIndividuals.add(id);
        else selectedIndividuals.delete(id);

        updateListUI();
    });

    /* ----------------------------
     * [REWRITE] リストクリック 〜> 盤面へ反映（座標がある分だけ）
     *  - リスト同士の同値は selectedIndividuals で保証（盤面非依存）
     *  - 盤面には存在する index だけ同期して差分描画
     * ---------------------------- */
    elListI?.addEventListener('click', (ev) => {
        if (listLocked) return;
        const row = ev.target.closest('.list-row');
        if (!row) return;
        const m = (row.textContent || '').match(/#(\d+)/);
        if (!m) return;
        const id = +m[1];

        const on = selectedIndividuals.has(id);
        if (on) selectedIndividuals.delete(id);
        else selectedIndividuals.add(id);

        // 盤面同期
        const idxs = idIndexMap.get(id) || [];
        idxs.forEach(i => { selectedCells[i] = !on; });
        paintCells(idxs);
        updateListUI();
    });

    elListG?.addEventListener('click', (ev) => {
        if (listLocked) return;
        const row = ev.target.closest('.list-row');
        if (!row) return;
        const m = (row.textContent || '').match(/：(.+?)\s*$/);
        if (!m) return;
        const prefix = m[1].trim();

        const ids = groupMap.get(prefix) || [];
        const allSelected = ids.length > 0 && ids.every(id => selectedIndividuals.has(id));

        // リスト同値更新（盤面非依存）
        if (allSelected) ids.forEach(id => selectedIndividuals.delete(id));
        else ids.forEach(id => selectedIndividuals.add(id));

        // 盤面に存在する index だけ同期
        const indices = [];
        ids.forEach(id => (idIndexMap.get(id) || []).forEach(i => {
            selectedCells[i] = !allSelected;
            indices.push(i);
        }));
        paintCells(indices);
        updateListUI();
    });

    /* ----------------------------
     * [REWRITE] 反転ボタン：isVisible をトグル → 全セル再描画
     * ---------------------------- */
    elInvert?.addEventListener('click', () => {
        if (duringTheTest && !afterAnswer) return; // 回答前は無効
        isVisible = !isVisible;
        paintAll();           // [FIX] 見た目が全セル変わるため、全描画
        updateButtons();
    });

    /* ----------------------------
     * [REWRITE] シャッフル：再配置（按分）
     * ---------------------------- */
    elShuffle?.addEventListener('click', () => {
        isVisible = true;
        duringTheTest = false;
        afterAnswer = false;
        listLocked = false;
        cardLocked = false;

        selectedCells.fill(false);
        answerMarks.fill(false);
        selectedIndividuals.clear();

        const picked = pickNumbers();
        applyDistribution(picked);

        updateButtons();
        updateListUI();
        clearJudgeView();
    });

    /* ----------------------------
     * [REWRITE] 出題開始
     * ---------------------------- */
    elStartQ?.addEventListener('click', () => {
        if (!noneCards.some(v => !v)) {
            alert('札枠がありません（設定で全て未配置）。');
            return;
        }
        isVisible = false;
        duringTheTest = true;
        afterAnswer = false;
        listLocked = true;   // 回答前はリスト不可
        cardLocked = false;  // 盤面は回答選択のみ可

        selectedCells.fill(false);
        answerMarks.fill(false);
        selectedIndividuals.clear();

        buildMotherQueue();
        nextFromQueue();

        paintAll();
        updateButtons();
        updateListUI();
        clearJudgeView();
    });

    /* ----------------------------
     * [REWRITE] 回答（判定 → 自動公開 → ロック/解禁）
     * ---------------------------- */
    elAnswer?.addEventListener('click', () => {
        if (!duringTheTest || afterAnswer || !currentQuestion) return;

        // 回答（blank が置かれた座標）と正解座標
        const selectedIdx = new Set();
        for (let i = 0; i < TOTAL; i++) if (gridIds[i] !== 0 && answerMarks[i]) selectedIdx.add(i);

        const correctIdx = new Set();
        if (currentQuestion.type === 'individual') {
            const tid = currentQuestion.id;
            (idIndexMap.get(tid) || []).forEach(i => correctIdx.add(i));
        } else {
            const prefix = currentQuestion.s;
            for (let i = 0; i < TOTAL; i++) {
                const id = gridIds[i];
                if (!id) continue;
                const item = idToItem.get(id);
                if (item && item.s.startsWith(prefix)) correctIdx.add(i);
            }
        }

        // 判定
        const isEqual = (a, b) => (a.size === b.size) && [...a].every(x => b.has(x));
        const ok = isEqual(selectedIdx, correctIdx);
        lastJudgeOk = ok; // [NEW] 直近結果を記録

        // 表示
        if (elJudge) {
            elJudge.style.display = 'block';
            elJudge.textContent = ok ? '正解' : '誤答';
            elJudge.style.color = ok ? '#10b981' : '#ef4444';
        }

        const openFlag = ok ? openAfterCorrect : openAfterIncorrect;
        const canFlip = ok ? canFlipAfterCorrect : canFlipAfterIncorrect;

        // [FIX: order] ここで「回答後モード」に入る（以降の描画は回答後ロジック）
        afterAnswer = true;

        // blank は解除する（描画は後でまとめて）
        const idxsSelected = [...selectedIdx];
        idxsSelected.forEach(i => { answerMarks[i] = false; });

        // 自動公開：必ず id が見えるように selectedCells を設定
        const idxsOpen = openFlag ? [...correctIdx] : [];
        if (idxsOpen.length) {
            const desired = !isVisible; // isVisible=true→false / false→true で id 側へ寄せる
            idxsOpen.forEach(i => { selectedCells[i] = desired; });
            // リストにも反映（同値維持）
            const ids = new Set(idxsOpen.map(i => gridIds[i]));
            ids.forEach(id => selectedIndividuals.add(id));
        }

        // [FIX: order] まとめて差分描画（回答後ロジックで id/0 を再評価）
        const toPaint = Array.from(new Set([...idxsSelected, ...idxsOpen]));
        if (toPaint.length) paintCells(toPaint);
        updateListUI();

        // 回答後の可否
        listLocked = !canFlip;
        cardLocked = !canFlip;

        updateButtons();
    });

    /* ----------------------------
     * [REWRITE] 次の問題へ
     * ---------------------------- */
    elNextQ?.addEventListener('click', () => {
        if (!duringTheTest) return;

        selectedCells.fill(false);
        answerMarks.fill(false);
        selectedIndividuals.clear();

        if (!nextFromQueue()) return;
        cardLocked = false;
        listLocked = true;   // 回答前はリスト不可
        afterAnswer = false;

        clearJudgeView();
        paintAll();
        updateButtons();
        updateListUI();
    });

    /* ----------------------------
     * [REWRITE] 出題終了
     * ---------------------------- */
    function endQuestionFlow() {
        duringTheTest = false;
        isVisible = true;
        afterAnswer = false;
        listLocked = false;
        cardLocked = false;

        selectedCells.fill(false);
        answerMarks.fill(false);
        selectedIndividuals.clear();

        paintAll();
        updateButtons();
        currentQuestion = null;
        updateQuestionView();
        clearJudgeView();
        updateListUI();
    }
    elEndQ?.addEventListener('click', endQuestionFlow);

    /* ----------------------------
     * [REWRITE] プレイへ（スナップショット保存）
     * ---------------------------- */
    elPlay?.addEventListener('click', () => {
        const snapshot = { boardLayout: gridIds.slice(), noneCards: noneCards.slice() };
        try { localStorage.setItem(KEY_BOARD, JSON.stringify(snapshot)); } catch { }
        location.href = './playing-karuta.html';
    });

    /* ----------------------------
     * [REWRITE] 初期化
     * ---------------------------- */
    (async function init() {
        await setCardSizeFromBlank();

        isVisible = true;
        selectedCells.fill(false);
        answerMarks.fill(false);
        selectedIndividuals.clear();

        // [CHANGE] まずスナップショットからの復元を試みる
        const restored = tryRestoreBoardFromSnapshot();
        if (!restored) {
            // 復元できない場合のみ、従来どおり新規按分
            const picked = pickNumbers();
            applyDistribution(picked);
        }

        // 一度だけ DOM 構築
        renderGridOnce();

        updateButtons();
        updateQuestionView();
        clearJudgeView();
        updateListUI();

        // 設定変更の監視（別タブなどから）
        window.addEventListener('storage', (ev) => {
            if (ev.key !== KEY_SETTINGS) return;
            // 即座に反映はしない。ユーザーにリロードを促すだけ。
            if (confirm('設定が更新されました。再読み込みして反映しますか？')) {
                location.reload();
            }
        });
    })();

})();
