const safeWindow = (typeof window !== 'undefined') ? window : {};
const VOWELS = safeWindow.ROMAJI_VOWELS || { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };
const CONSONANT = safeWindow.ROMAJI_CONSONANT || {
  k: ['か', 'き', 'く', 'け', 'こ'],
  s: ['さ', 'し', 'す', 'せ', 'そ'],
  t: ['た', 'ち', 'つ', 'て', 'と'],
  n: ['な', 'に', 'ぬ', 'ね', 'の'],
  h: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  m: ['ま', 'み', 'む', 'め', 'も'],
  y: ['や', 'い', 'ゆ', 'え', 'よ'],
  r: ['ら', 'り', 'る', 'れ', 'ろ'],
  w: ['わ', 'ゐ', 'う', 'ゑ', 'を'],
};

const vowels = ['a', 'i', 'u', 'e', 'o'];

export function toHiragana(input) {
  if (!input) return '';
  const s = String(input).trim().toLowerCase().replace(/\s+/g, '');
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(s)) {
    return s
      .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const v = s[i + 1];
    const vIndex = vowels.indexOf(v);
    if (vIndex >= 0 && CONSONANT[c]) {
      const hira = CONSONANT[c][vIndex];
      if (hira) out.push(hira);
      i += 2;
      continue;
    }
    if (VOWELS[c]) {
      out.push(VOWELS[c]);
    }
    i += 1;
  }
  return out.join('');
}

export function normalizeAnswer(text) {
  return toHiragana(text).trim();
}
