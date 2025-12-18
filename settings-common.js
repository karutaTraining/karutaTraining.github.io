// --------- settings-common.js ---------
// 共通で使う設定値をまとめた共有モジュール。
// ブラウザ環境で読み込まれることを前提に、グローバルへ公開する。
(function () {
  const SETTINGS_KEY = 'karutaSettings.v1';
  const BOARD_KEY = 'karutaBoard.v1';
  const ROWS = 6;
  const COLS = 11;
  const TOTAL = ROWS * COLS;

  window.KARUTA_CONST = Object.freeze({
    SETTINGS_KEY,
    BOARD_KEY,
    ROWS,
    COLS,
    TOTAL,
  });
})();
