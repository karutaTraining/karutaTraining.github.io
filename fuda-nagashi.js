// --------- fuda-nagashi.js ---------

let AUTO_NEXT_MS = 0;
let CARDS_COUNT = 100;
let CARDS_DIRECTION = 'normal';
const rotateEl = document.getElementById("rotate");

const KEY = 'karutaSettings.v1';
const s = (() => {
    try {
        const s1 = JSON.parse(localStorage.getItem(KEY)) || {};
        return s1.fudaNagashi || {};
    }
    catch { return {}; }
})();

// ====== 状態 ======
let remaining = [];               // 残り札（Card配列）
let id2s = new Map();             // id -> s
let history = new Map();          // id -> { changedAtRead: boolean, correct: boolean }
let reads = [];                   // シャッフル済みの 1..100
let idx = 0;                      // 現在の出題インデックス
let awaitingNext = false; // 「答える」後に手動で次へ進む待機中かどうか
let nextTimer = null;     // 自動遷移タイマーID
let advanced = false;     // この設問で既に進んだかのガード
let isRomanized = false;
let syllableChanging = false;
let hideProgress = false;
let notInputButSelect = false;
let listMode = "syllable";

const CARDS = window.KIMARIJI_ITEMS;
const ALL_IDS_FN = window.KIMARIJI_ALL_IDS || (() => CARDS.map(x => x.id));
const ALL_IDS = ALL_IDS_FN();

// ====== DOM ======
const qidEl = document.getElementById("qid");
const resultEl = document.getElementById("result");
const progressTextEl = document.getElementById("progressText");
const barEl = document.getElementById("bar");
const remainEl = document.getElementById("remain");
const statusPill = document.getElementById("statusPill");
const formEl = document.getElementById("answerForm");
const inputEl = document.getElementById("answerInput");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const listEl = document.getElementById("list");
const imgEl = document.getElementById("cardImg");
const toggleOrderBtn = document.getElementById("toggleOrderBtn");

(() => {
    if (s.autoAdvance) AUTO_NEXT_MS = s.waitMs;
    CARDS_COUNT = s.count;
    CARDS_DIRECTION = s.direction;
    if (CARDS_DIRECTION === 'normal') { rotateEl.className = 'imgwrap upright'; }
    else if (CARDS_DIRECTION === 'reverse') { rotateEl.className = 'imgwrap upside-down'; }
    isRomanized = s?.judgeByRomaji ?? true;
    syllableChanging = s?.changing ?? true;
    hideProgress = s?.notShowProgress ?? false;
    //notInputButSelect = s?.doSelect ?? false;
})();

/*
(() => {
    const ta = document.querySelector('.title-box textarea');
    if (!ta) return;

    const asOnOff = v => (v ? 'ON' : 'OFF');
    const dirLabel = v => ({ random: 'ランダム', normal: '正方向', reverse: '逆さま' }[v] || 'ランダム');
    const render = () => {
        const lines = [
            `向き,${dirLabel(s.direction)}`,
            `変化,${asOnOff(!!s.changing)}`,
            `自動,${asOnOff(!!s.autoAdvance)}`,
            `待機,${(s.waitMs ?? 500)}ms`,
            `枚数,${(s.count ?? 100)}`,
            `限定,${asOnOff(!!s.allOrPart)}`,
            '',
            '決まり字一覧(番号だけ)',
            Array.isArray(s.selectedIds)
                ? s.selectedIds.map(Number).sort((a, b) => a - b).join(',')
                : ''
        ];
        ta.value = lines.join('\n');
    };

    // 初期表示
    render();
    // 設定画面で変更→戻ってきたとき等、他タブからの更新も反映
    window.addEventListener('storage', (ev) => {
        if (ev.key === KEY) render();
    });
})();
*/

// 今回の「対象ID集合」を決定（包含方式：選択があればそのみ／なければ全量）
const decideAllowedIds = () => {
    if (s.allOrPart && Array.isArray(s.selectedIds) && s.selectedIds.length > 0) {
        const want = new Set(s.selectedIds.map(Number));
        return ALL_IDS.filter(id => want.has(id));
    }
    return ALL_IDS.slice();
};

// 今回セッションの「対象カード配列」
const sessionCards = () => {
    const allowed = new Set(decideAllowedIds());
    return CARDS.filter(c => allowed.has(c.id));
};

// ====== 文字単位ユーティリティ（UTF-8/16のサロゲート対策に Array.from を使う）======

// ---- ひらがな/ASCII 種別チェック ----
function _hasHiragana(str) { return /[\u3041-\u3096]/.test(str); }
function _hasAlphabet(str) { return /[A-Za-z]/.test(str); }
function _isAsciiOnly(str) { return /^[\x20-\x7E]+$/.test(str); }

// ---- KIMARIJI から読みを取る ----
function getReadingByIdFromKimariji(id) {
    const arr = (window.KIMARIJI_ITEMS || []);
    const hit = arr.find(o => o && o.id === id);
    return hit ? String(hit.s || '') : '';
}

// ---- 2つの文字列の最長共通接頭辞長 ----
function _lcpLen(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
}

const toChars = (s) => Array.from(s); // code point 単位
const lcpChars = (a, b) => {
    const ca = toChars(a), cb = toChars(b);
    const n = Math.min(ca.length, cb.length);
    let i = 0;
    while (i < n && ca[i] === cb[i]) i++;
    return i;
};
const prefixChars = (s, k) => {
    const cs = toChars(s);
    if (k > cs.length) k = cs.length;
    return cs.slice(0, k).join("");
};


// ---- 期待される最短接頭辞（かな）を算出 ----
function computeExpectedPrefixFromIds(currentId, candidateIds) {
    const target = getReadingByIdFromKimariji(currentId); // かな
    if (!target) return '';
    let maxLcp = 0;
    for (const id of candidateIds) {
        if (id === currentId) continue;
        const other = getReadingByIdFromKimariji(id);
        if (!other) continue;
        const l = _lcpLen(target, other);
        if (l > maxLcp) maxLcp = l;
    }
    const need = Math.min(target.length, maxLcp + 1); // 1文字以上
    return target.slice(0, need);
}

/**
 * ローマ字→ひらがな（厳格版）
 * - 許容するゆらぎのみ実装（仕様通り）
 *   ふ: hu/fu, つ: tu/tsu, し: si/shi, ち: ti/chi, じ: ji/zi
 * - 長音の特例: ooe/ooke/ooko のみ許容（oh 系不可）
 * - 撥音・促音・拗音は今回対象外（パース失敗で null を返す）
 * - 一般的な CV マッピングも実装（ka/ki/…、ba/bi/… 等）
 */
function romajiToHiraganaStrict(input) {
    if (!input) return '';
    let s = String(input).trim().toLowerCase().replace(/\s+/g, '');
    if (!_isAsciiOnly(s)) return null; // 非ASCIIを含むなら対象外

    const vowels = window.ROMAJI_VOWELS;
    const cv = window.ROMAJI_CONSONANT;

    // 変換ループ（前方最長一致）
    let i = 0;
    let out = '';
    while (i < s.length) {
        // 長音特例
        if (s.startsWith('ooke', i)) { out += 'おおけ'; i += 4; continue; }
        if (s.startsWith('ooko', i)) { out += 'おおこ'; i += 4; continue; }
        if (s.startsWith('ooe', i)) { out += 'おおえ'; i += 3; continue; }

        // 3文字優先
        if (s.startsWith('shi', i)) { out += 'し'; i += 3; continue; }
        if (s.startsWith('chi', i)) { out += 'ち'; i += 3; continue; }
        if (s.startsWith('tsu', i)) { out += 'つ'; i += 3; continue; }

        // 2文字の許容ゆらぎ
        if (s.startsWith('si', i)) { out += 'し'; i += 2; continue; }
        if (s.startsWith('ti', i)) { out += 'ち'; i += 2; continue; }
        if (s.startsWith('tu', i)) { out += 'つ'; i += 2; continue; }
        if (s.startsWith('hu', i)) { out += 'ふ'; i += 2; continue; }
        if (s.startsWith('fu', i)) { out += 'ふ'; i += 2; continue; }
        if (s.startsWith('ji', i)) { out += 'じ'; i += 2; continue; }
        if (s.startsWith('zi', i)) { out += 'じ'; i += 2; continue; }

        // 母音単独
        const ch = s[i];
        const ch2 = s.slice(i, i + 2);
        if (vowels[ch]) { out += vowels[ch]; i += 1; continue; }

        // 一般 CV（例: ka, ke, bo, ra ...）
        if (ch2.length === 2 && cv[ch] && vowels[ch2[1]]) {
            const vowelIndex = 'aiueo'.indexOf(ch2[1]);
            const row = cv[ch][vowelIndex];
            if (!row) return null; // 許容外
            out += row;
            i += 2;
            continue;
        }

        // どれにも該当しない → 許容外
        return null;
    }
    return out;
}

/**
 * 回答判定（ひらがな/ローマ字両対応）
 * - settings?.judgeByRomaji が true のとき ASCII のみ入力ならローマ字→かなへ変換
 * - ひらがなとローマ字の混在入力は常に不正解（仕様）
 */
function judgeFudanagashiAnswer(rawInput, currentId, remainingIds) {
    //const s = settings || {};
    //const isRomanized = !!(s && s.judgeByRomaji);

    const expectedKana = computeExpectedPrefixFromIds(currentId, remainingIds);
    if (!expectedKana) {
        return { ok: false, expectedKana: '', inputKana: null, reason: 'mismatch' };
    }

    const raw = String(rawInput || '').trim();
    const hasKana = _hasHiragana(raw);
    const hasAlpha = _hasAlphabet(raw);

    // 混在は常に不正解
    if (hasKana && hasAlpha) {
        return { ok: false, expectedKana, inputKana: null, reason: 'mixed' };
    }

    let inputKana = null;

    if (isRomanized && hasAlpha && !hasKana) {
        // ローマ字→かな（厳格）
        const conv = romajiToHiraganaStrict(raw);
        if (!conv) {
            return { ok: false, expectedKana, inputKana: null, reason: 'romaji-invalid' };
        }
        inputKana = conv;
    } else if (!hasAlpha && hasKana) {
        // かな入力
        inputKana = raw;
    } else {
        // それ以外（記号/全角英数など）は不正解扱い
        return { ok: false, expectedKana, inputKana: null, reason: 'romaji-invalid' };
    }

    // 判定（期待される最短接頭辞に一致するかを厳密比較）
    const ok = (inputKana === expectedKana);
    return { ok, expectedKana, inputKana, reason: ok ? null : 'mismatch' };
}

// 共通：次へ進む
const advanceToNext = () => {
    // 追加：二重進行防止
    if (advanced) return;
    advanced = true;

    // 追加：手動進行時は保留中タイマーを無効化
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    if (idx >= reads.length) return;

    removeById(currentId());
    idx++;
    inputEl.disabled = false;     // 次の問題で入力可能に戻す
    awaitingNext = false;
    skipBtn.textContent = "スキップ";
    showQuestion();
};


const updateToggleLabel = () => {
    if (!toggleOrderBtn) return;
    if (listMode === "syllable") {
        //toggleOrderBtn.textContent = "並び替え";
        toggleOrderBtn.title = "読み上げ順に並び替え";
    } else {
        //toggleOrderBtn.textContent = "並び替え";
        toggleOrderBtn.title = "決まり字順に並び替え";
    }
};


// ====== ヘルパ ======
const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const expectedPrefix = (s) => {
    let maxL = 0;
    for (const t of remaining) {
        if (t.s === s) continue;
        const l = lcpChars(s, t.s);
        if (l > maxL) maxL = l;
    }
    const need = Math.min(toChars(s).length, maxL + 1);
    return prefixChars(s, need);
};

const removeById = (id) => {
    const k = remaining.findIndex(c => c.id === id);
    if (k >= 0) remaining.splice(k, 1);
};

const currentId = () => reads[idx];
const curS = () => id2s.get(currentId());

const updateProgress = () => {
    progressTextEl.textContent = `${idx} / ${CARDS_COUNT}`;
    const pct = (idx / CARDS_COUNT) * 100;
    barEl.style.width = `${pct}%`;
    remainEl.textContent = remaining.length.toString();
};


const renderList = () => {
    const remIds = new Set(remaining.map(c => c.id));

    // 並び順のソースを分岐
    let items;
    if (listMode === "syllable") {
        // 初期状態：全100枚（既存順）
        //items = CARDS.slice();
        items = sessionCards();
    } else {
        // 読み上げ順：既読だけ（reads の先頭 idx 件）
        // ※ reads は提示順、idx は既に読み上げ済みの枚数
        const readIds = reads.slice(0, idx);
        items = readIds.map(id => CARDS.find(c => c.id === id)).filter(Boolean);
    }

    const rows = items.map(c => {
        let cls = "", label = "";

        if (remIds.has(c.id)) {
            // 未読：今この瞬間に変化しているか
            const changedNow = (expectedPrefix(c.s) !== c.s);
            cls = changedNow ? "unread-changed" : "unread-stable";
            label = changedNow ? "未読・変化中" : "未読・初期";
        } else {
            // 既読：出題時の状態＋正誤
            const h = history.get(c.id);
            if (!h) {
                cls = "unread-stable";
                label = "既読・不明";
            } else {
                const part1 = h.changedAtRead ? "changed" : "stable";
                const part2 = h.correct ? "ok" : "ng";
                cls = `read-${part1}-${part2}`;
                label = `${h.correct ? "正解" : "誤答"}・${h.changedAtRead ? "変化" : "初期"}`;
            }
        }

        const idStr = String(c.id).padStart(3, "0");
        return `<div class="list-row ${cls}" title="${label}">
              <span><span class="mono">#${idStr}</span>：${c.s}</span>
              <span class="lab">${label}</span>
            </div>`;
    }).join("");

    listEl.innerHTML = rows;
};



const showQuestion = () => {
    advanced = false;
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    skipBtn.textContent = "スキップ";

    if (idx >= CARDS_COUNT) {
        qidEl.textContent = "終了";
        statusPill.textContent = "完了";
        resultEl.innerHTML = `<span class="ok">お疲れさまでした！</span> 全問終了です。`;
        inputEl.disabled = true;
        if (imgEl) { imgEl.removeAttribute("src"); imgEl.alt = ""; imgEl.style.visibility = "hidden"; }
        updateProgress();
        renderList();
        return;
    }

    const id = String(currentId());
    qidEl.textContent = id;
    statusPill.textContent = "出題中";
    resultEl.textContent = "";
    inputEl.value = "";
    inputEl.focus();
    updateProgress();

    // ▼ 画像切り替え（同階層の id.png を表示）
    if (imgEl) {
        imgEl.style.visibility = "hidden";
        imgEl.onload = () => {
            imgEl.style.visibility = "visible";
            if (CARDS_DIRECTION === 'random' && rotateEl) {
                if (Math.random() < 0.5) { rotateEl.className = 'imgwrap'; }
                else { rotateEl.className = 'imgwrap upside-down'; }
            }
        };
        imgEl.onerror = () => {
            imgEl.style.visibility = "visible";
            imgEl.alt = `画像が見つかりません（${id}.png）`;
        };
        imgEl.src = `${id}`;
        imgEl.alt = `札画像 ${id}.png`;
    }
    renderList();
};


// submitAnswer（判定を表示→自動/手動で次へ）【置換版】
const submitAnswer = () => {
    if (idx >= reads.length) return;
    if (inputEl.disabled) return; // 既に判定済みで待機中なら無視

    const sKanaFull = curS(); // 現在IDの全文かな
    if (!sKanaFull) {
        resultEl.innerHTML = `<span class="ng">データ不整合</span>：このIDの札が見つかりません`;
        return;
    }

    // いま残っている候補（id配列）
    const remainingIds = remaining.map(c => c.id);

    // 新ロジック（ローマ字対応）で判定
    const judge = judgeFudanagashiAnswer(
        inputEl.value.trim(),
        currentId(),
        remainingIds
        //s // localStorageから読んだ設定（s?.judgeByRomaji を参照）
    );

    const changedAtRead = (judge.expectedKana !== sKanaFull);

    if (judge.ok) {
        resultEl.innerHTML = `<span class="ok">OK</span>`;
        statusPill.textContent = "判定：正解";
    } else {
        // 失敗理由の文面（必要最小限）
        let reasonNote = "";
        if (judge.reason === 'mixed') reasonNote = '（かな＋ローマ字の混在は不可）';
        else if (judge.reason === 'romaji-invalid') reasonNote = '（ローマ字表記が仕様外）';
        resultEl.innerHTML = `<span class="ng">NG</span>：正解は <b class="mono">${judge.expectedKana}</b> ${reasonNote}`;
        statusPill.textContent = "判定：不正解";
    }

    history.set(currentId(), { changedAtRead, correct: judge.ok });

    // 判定中は入力をロック
    inputEl.disabled = true;

    if (AUTO_NEXT_MS > 0) {
        // 自動で次へ
        nextTimer = setTimeout(advanceToNext, AUTO_NEXT_MS);
    } else {
        // 手動で次へ（ボタン表示だけ変えて待機）
        awaitingNext = true;
        skipBtn.textContent = "次へ";
    }
};



/*
// submitAnswer（判定を表示→少し待ってから次へ）
const submitAnswer = () => {
    if (idx >= reads.length) return;
    if (inputEl.disabled) return; // 既に判定済みで待機中なら無視

    const s = curS();
    if (!s) {
        resultEl.innerHTML = `<span class="ng">データ不整合</span>：このIDの札が見つかりません`;
        return;
    }

    const expect = expectedPrefix(s);
    const user = inputEl.value.trim();
    const correct = (user === expect);
    const changedAtRead = (expect !== s);

    if (correct) {
        resultEl.innerHTML = `<span class="ok">OK</span>`;
        statusPill.textContent = "判定：正解";
    } else {
        resultEl.innerHTML = `<span class="ng">NG</span>：正解は <b class="mono">${expect}</b>`;
        statusPill.textContent = "判定：不正解";
    }
    history.set(currentId(), { changedAtRead, correct });


    // 判定中は入力をロック
    inputEl.disabled = true;

    if (AUTO_NEXT_MS > 0) {
        // 自動で次へ
        nextTimer = setTimeout(advanceToNext, AUTO_NEXT_MS);
    } else {
        // 手動で次へ（ボタン表示だけ変えて待機）
        awaitingNext = true;
        skipBtn.textContent = "次へ";
    }
};
*/

// スキップ：未回答のみ誤答扱い。判定済み（正解/不正解）は上書きしないで次へ。
const skipQuestion = () => {
    if (idx >= reads.length) return;
    const id = currentId();
    // 既に submitAnswer 済みなら（=履歴がある）既存の判定を尊重して進むだけ
    if (history.has(id)) {
        advanceToNext();
        return;
    }
    // 未回答でのスキップは誤答として記録
    const s = curS();
    const changedAtRead = (expectedPrefix(s) !== s);
    history.set(id, { changedAtRead, correct: false });
    advanceToNext();
};


const resetAll = () => {
    const allowedIds = decideAllowedIds();             // 今回対象ID
    const tmpCards = sessionCards();                      // 今回対象カード

    const want = (s && Number.isInteger(s.count)) ? s.count : 100;
    CARDS_COUNT = Math.max(1, Math.min(want, allowedIds.length));

    remaining = tmpCards.slice();
    id2s = new Map(tmpCards.map(c => [c.id, c.s]));
    reads = shuffle(allowedIds.slice());
    idx = 0;

    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    advanced = false;
    awaitingNext = false;
    history.clear();

    inputEl.disabled = false;
    statusPill.textContent = "準備完了";
    skipBtn.textContent = "スキップ";
    updateProgress();
    showQuestion();
};


// ====== イベント ======
formEl.addEventListener("submit", (e) => { e.preventDefault(); submitAnswer(); });
resetBtn.addEventListener("click", resetAll);
skipBtn.addEventListener("click", skipQuestion);
toggleOrderBtn.addEventListener("click", () => {
    listMode = (listMode === "syllable") ? "read" : "syllable";
    updateToggleLabel();
    renderList();
});


// ====== 起動 ======
updateToggleLabel();
renderList();
resetAll();
