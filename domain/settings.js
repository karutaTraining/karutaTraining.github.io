import { GRID, STORAGE_KEYS, DEFAULTS } from '../config/karuta-params.js';

const legacyKey = 'karutaSettings.v1';

const buildDefaults = () => ({
  allOrPart: false,
  selectedIds: [],
  noneCards: Array(GRID.total).fill(false),
  fudaNagashi: {
    direction: DEFAULTS.direction,
    judgeByRomaji: true,
    changing: true,
    autoAdvance: false,
    waitMs: DEFAULTS.waitMs,
    count: DEFAULTS.count,
  },
  fudaNagashiSeveral: {
    direction: DEFAULTS.direction,
    judgeByRomaji: true,
    autoAdvance: false,
    waitMs: DEFAULTS.waitMs,
    count: DEFAULTS.count,
    countCardsSeveral: DEFAULTS.countCardsSeveral,
    appearanceMs: DEFAULTS.appearanceMs,
  },
  memorizePlacement: {
    groupMode: 'group',
    excludeFlag: false,
    doOpen: 'correct',
    canFlip: 'correct',
    autoAdvance: false,
    waitMs: DEFAULTS.waitMs,
  },
  playingKaruta: {
    excludeFlag: false,
    syllableInterval: DEFAULTS.syllableInterval,
    autoAdvance: false,
    waitMs: DEFAULTS.waitMs,
  },
  updatedAt: Date.now(),
});

function safeParse(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export class SettingsStore {
  constructor(storage = window.localStorage, key = STORAGE_KEYS.settings) {
    this.storage = storage;
    this.key = key;
  }

  load() {
    const defaults = buildDefaults();
    const raw = safeParse(this.storage.getItem(this.key)) || this.#loadLegacy();
    if (!raw) return defaults;
    const merged = structuredClone(defaults);
    return this.#mergeInto(merged, raw);
  }

  save(settings) {
    const current = this.load();
    const merged = this.#mergeInto(structuredClone(current), settings);
    merged.updatedAt = Date.now();
    this.storage.setItem(this.key, JSON.stringify(merged));
    return merged;
  }

  reset() {
    this.storage.removeItem(this.key);
    return this.load();
  }

  #loadLegacy() {
    return safeParse(this.storage.getItem(legacyKey));
  }

  #mergeInto(base, incoming) {
    const merged = { ...base, ...incoming };
    merged.selectedIds = Array.isArray(incoming?.selectedIds) ? incoming.selectedIds.map(Number) : base.selectedIds;
    merged.noneCards = Array.isArray(incoming?.noneCards) && incoming.noneCards.length === GRID.total
      ? incoming.noneCards.slice()
      : base.noneCards;

    merged.fudaNagashi = { ...base.fudaNagashi, ...incoming?.fudaNagashi };
    merged.fudaNagashiSeveral = { ...base.fudaNagashiSeveral, ...incoming?.fudaNagashiSeveral };
    merged.memorizePlacement = { ...base.memorizePlacement, ...incoming?.memorizePlacement };
    merged.playingKaruta = { ...base.playingKaruta, ...incoming?.playingKaruta };
    return merged;
  }
}

export function createSettingsStore() {
  return new SettingsStore();
}
