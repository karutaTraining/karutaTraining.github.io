const safeWindow = (typeof window !== 'undefined') ? window : {};
const CARDS = safeWindow.CARDS || {};

/**
 * cards.js の base64 画像を解決するリゾルバ。
 * - '123' / 123 / 'hide' / 'blank' などを window.CARDS から取得
 * - すでに dataURL ならそのまま返す
 * - 見つからない場合は元の値を文字列化して返す（呼び出し側で扱う）
 */
export function createCardImageResolver() {
  const resolve = (token) => {
    if (typeof token !== 'string' && typeof token !== 'number') return token;
    const k = String(token);
    if (k.startsWith('data:image')) return k;
    return CARDS[k] ?? CARDS[+k] ?? k;
  };

  return { resolve };
}
