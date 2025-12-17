export function resolveAllowedIds(settings, repo) {
  const selected = new Set((settings?.selectedIds || []).map(Number));
  if (settings?.allOrPart && selected.size > 0) {
    return repo.allIds().filter((id) => selected.has(id));
  }
  return repo.allIds();
}

import { Card } from './models.js';

export function selectAllowedCards(settings, repo) {
  const allowedIds = new Set(resolveAllowedIds(settings, repo));
  return repo
    .allItems()
    .filter((c) => allowedIds.has(c.id))
    .map((c) => new Card(c.id, c.s));
}
