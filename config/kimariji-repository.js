const safeWindow = (typeof window !== 'undefined') ? window : {};
const items = Array.isArray(safeWindow.KIMARIJI_ITEMS) ? safeWindow.KIMARIJI_ITEMS : [];
const groups = Array.isArray(safeWindow.KIMARIJI_GROUPS) ? safeWindow.KIMARIJI_GROUPS : [];
const standalone = Array.isArray(safeWindow.STANDALONE_IDS) ? safeWindow.STANDALONE_IDS : [];

export function createKimarijiRepository() {
  const allIds = () => items.map((k) => k.id);
  const findById = (id) => items.find((k) => k.id === Number(id)) || null;
  const groupMap = new Map(
    groups.map((g) => [
      g.s,
      items.filter((k) => String(k.s || '').startsWith(g.s)).map((k) => k.id),
    ]),
  );

  return {
    allItems: () => items.slice(),
    allGroups: () => groups.slice(),
    standaloneIds: () => standalone.slice(),
    allIds,
    findById,
    groupMembers: (prefix) => groupMap.get(prefix) || [],
  };
}
