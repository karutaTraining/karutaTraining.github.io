export const qs = (sel, parent = document) => parent.querySelector(sel);
export const qsa = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

export function paintRange(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 1);
  const val = Number(input.value || 0);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${pct}%, var(--slider-base) ${pct}%, var(--slider-base) 100%)`;
}

export function bindRange(inputEl, outEl) {
  if (!inputEl || !outEl) return;
  const update = () => {
    outEl.textContent = inputEl.value;
    paintRange(inputEl);
  };
  inputEl.addEventListener('input', update);
  update();
}

export function toggleClass(el, className, on) {
  if (!el) return;
  el.classList.toggle(className, on);
}
