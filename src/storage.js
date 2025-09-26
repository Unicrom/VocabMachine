const KEYS = {
  lists: 'vm2001:lists',
  activeListId: 'vm2001:activeListId',
};

export const Storage = {
  loadLists() {
    try {
      const raw = localStorage.getItem(KEYS.lists);
      if (!raw) return [];
      const lists = JSON.parse(raw);
      // Basic validation
      if (!Array.isArray(lists)) return [];
      return lists.map(l => ({ id: l.id || crypto.randomUUID(), name: l.name || 'Untitled', words: Array.isArray(l.words) ? l.words : [], stats: l.stats || {} }));
    } catch {
      return [];
    }
  },
  saveLists(lists) {
    try { localStorage.setItem(KEYS.lists, JSON.stringify(lists)); } catch {}
  },
  loadActiveListId() {
    return localStorage.getItem(KEYS.activeListId);
  },
  saveActiveListId(id) {
    try { localStorage.setItem(KEYS.activeListId, id || ''); } catch {}
  },
};
