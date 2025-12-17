export const STORAGE_KEYS = {
  settings: 'karuta.settings.v2',
  boardState: 'karuta.board.v1',
  stats: 'karuta.stats.v1',
};

export const GRID = {
  rows: 6,
  cols: 11,
  total: 6 * 11,
};

export const DEFAULTS = {
  waitMs: 500,
  count: 100,
  direction: 'random',
  syllableInterval: 500,
  countCardsSeveral: 5,
  appearanceMs: 500,
};

export const DISPLAY_CLASSES = {
  selected: 'selected',
  hidden: 'is-hidden',
  disabled: 'set-disabled',
};

export const PLAY_MODES = {
  single: 'single',
  several: 'several',
};

export const CARD_TOKENS = {
  hide: 'hide',
  blank: 'blank',
};

export const LOCAL_STORAGE_NAMESPACE = 'karuta-training';
