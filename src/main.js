import { Storage } from './storage.js';
import { StudyEngine } from './study.js';

// State
const state = {
  lists: [],
  activeListId: null,
  session: null,
  awaitingContinue: false,
  streak: 0,
  lastPrompt: null,
  advanceTimer: null,
};

const els = {};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function init() {
  cacheEls();
  wireTabs();
  wireListPanel();
  wireStudyPanel();
  load();
  // Merge built-in default lists (non-destructive) asynchronously
  loadBuiltInLists('merge');
  render();
}

function cacheEls() {
  els.tabs = $all('.tab');
  els.panels = $all('.panel');
  // Lists panel
  els.listSearch = $('#list-search');
  els.listCards = $('#list-cards');
  els.listsOverview = $('#lists-overview');
  els.listDetail = $('#list-detail');
  els.detailTitle = $('#detail-title');
  // detail-count removed
  els.btnBackLists = $('#btn-back-lists');
  els.btnNewWord = $('#btn-new-word');
  // Modal elements
  els.wordModal = $('#word-modal');
  els.wordFormEl = $('#word-form');
  els.btnCloseWordModal = $('#btn-close-word-modal');
  els.btnDeleteWord = $('#btn-delete-word');
  els.btnNewList = $('#btn-new-list');
  els.btnDuplicateList = $('#btn-duplicate-list');
  els.btnDeleteList = $('#btn-delete-list');
  // list-name input & save button removed (inline title editing now)
  // Removed clear words & load sample buttons
  els.wordInputs = {
    word: $('#word-input'),
    example: $('#example-input'),
    definition: $('#definition-input'),
    synonyms: $('#synonyms-input'),
    antonyms: $('#antonyms-input'),
  };
  els.btnAddWord = $('#btn-add-word');
  els.btnResetWord = $('#btn-reset-word');
  els.wordSearch = $('#word-search');
  els.btnExportCurrent = $('#btn-export-current');
  els.wordsTbody = $('#words-tbody');

  // Study
  // Study setup (new)
  els.studyListChips = $('#study-list-chips');
  els.contentTabs = $all('.content-tab');
  els.btnStartStudy = $('#btn-start-study');
  // Floating settings
  els.btnSettings = $('#btn-settings');
  els.settingsPanel = $('#settings-panel');
  els.directionLabel = $('#direction-label');
  els.sessionMode = $('#session-mode');
  els.synAntPrompt = $('#syn-ant-prompt');

  els.session = $('#session');
  els.progressText = $('#progress-text');
  els.btnEndSession = $('#btn-end-session');
  els.prompt = $('#prompt');
  els.answerForm = $('#answer-form');
  els.answerInputArea = $('#answer-input-area');
  els.btnShowAnswer = $('#btn-show-answer');
  els.feedback = $('#feedback');
  // Redesigned study stats
  els.progressBarInner = $('#progress-bar-inner');
  els.chipAttempts = $('#chip-attempts');
  els.chipAccuracy = $('#chip-accuracy');
  els.chipStreak = $('#chip-streak');
  els.sessionPlaceholder = $('#session-placeholder');
  // New collapse toggle + config container
  els.toggleSetup = $('#toggle-setup');
  els.studyConfig = $('#study-config');

  // Inline JSON import only (OCR & built-ins removed)
  els.importFile = $('#import-file');
  els.btnImport = $('#btn-import');
  // Generic dialog
  els.appDialog = $('#app-dialog');
  els.appDialogTitle = $('#app-dialog-title');
  els.appDialogBody = $('#app-dialog-body');
  els.appDialogForm = $('#app-dialog-form');
  els.appDialogInputWrap = $('#app-dialog-input-wrap');
  els.appDialogInput = $('#app-dialog-input');
  els.appDialogButtons = $('#app-dialog-buttons');
  els.appDialogClose = $('#app-dialog-close');
}

function wireTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      els.tabs.forEach(t => t.classList.remove('active'));
      els.panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const id = `panel-${tab.dataset.tab}`;
      document.getElementById(id).classList.add('active');
      if (tab.dataset.tab === 'study') {
        document.body.classList.add('in-study');
      } else {
        document.body.classList.remove('in-study');
      }
    });
  });
}

function wireListPanel() {
  els.btnNewList.addEventListener('click', async () => {
    const name = await appPrompt('New list', 'Enter a name for the new list:');
    if (!name) return;
    const id = crypto.randomUUID();
    state.lists.push({ id, name, words: [], stats: {} });
    state.activeListId = id;
    save();
    openListDetail(id);
  });

  els.btnDuplicateList.addEventListener('click', () => {
    const list = activeList();
    if (!list) return;
    const id = crypto.randomUUID();
    const clone = JSON.parse(JSON.stringify(list));
    clone.id = id;
    clone.name = `${clone.name} (copy)`;
    state.lists.push(clone);
    state.activeListId = id;
    save();
    openListDetail(id);
  });

  els.btnDeleteList.addEventListener('click', async () => {
    const list = activeList();
    if (!list) return;
    const ok = await appConfirm('Delete List', `Delete list "${escapeHtml(list.name)}"? This cannot be undone.`);
    if (!ok) return;
    state.lists = state.lists.filter(l => l.id !== list.id);
  if (state.activeListId === list.id) state.activeListId = (state.lists[0] ? state.lists[0].id : null);
    save();
    // After delete go back to overview
    showOverview();
    renderLists();
    renderStudyListChips();
  });

  // Inline title rename: click list title (h2) to rename
  if (els.detailTitle) {
    const commit = () => {
      const list = activeList();
      if (!list) return;
      const v = els.detailTitle.value.trim();
      if (!v) return; // keep old if empty
      if (v !== list.name) {
        list.name = v;
        save();
        renderLists();
        renderStudyListChips();
      }
    };
    els.detailTitle.addEventListener('blur', commit);
    els.detailTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.detailTitle.blur(); } });
  }

  // Inline add/reset removed in favor of modal form
  els.wordSearch.addEventListener('input', renderWords);
  els.listSearch.addEventListener('input', renderLists);
  els.btnExportCurrent.addEventListener('click', () => {
    const list = activeList(); if (!list) return;
    downloadJSON(`${list.name}.json`, list);
  });
  els.btnBackLists.addEventListener('click', showOverview);
  if (els.btnNewWord) els.btnNewWord.addEventListener('click', () => openWordModal());
  if (els.btnCloseWordModal) els.btnCloseWordModal.addEventListener('click', closeWordModal);
  if (els.wordFormEl) els.wordFormEl.addEventListener('submit', (e) => { e.preventDefault(); saveWordFromModal(); });
  if (els.btnResetWord) els.btnResetWord.addEventListener('click', clearWordForm);
  if (els.btnDeleteWord) els.btnDeleteWord.addEventListener('click', deleteCurrentModalWord);

  // Inline JSON import (lists only)
  if (els.btnImport && els.importFile) {
    els.btnImport.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', async () => {
      const file = (els.importFile.files && els.importFile.files[0]);
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Accept formats:
        // 1) { lists: [ { name, words }, ... ] }
        // 2) [ { name, words }, ... ]
        // 3) { name, words }
        let incoming = [];
        if (data && Array.isArray(data.lists)) incoming = data.lists;
        else if (Array.isArray(data)) incoming = data;
        else if (data && typeof data === 'object' && data.name && Array.isArray(data.words)) incoming = [data];
        if (!incoming.length) { alert('Invalid JSON: expected a list object, an array of lists, or {"lists": [...]}'); return; }

        const nameMap = new Map(state.lists.map(l => [l.name, l]));
        let added = 0, merged = 0, addedWords = 0;
        incoming.forEach(src => {
          if (!src || !src.name || !Array.isArray(src.words)) return;
          const cleanedWords = src.words
            .filter(w => w && w.word && w.definition)
            .map(w => ({
              word: String(w.word).trim(),
              example: (w.example || '').trim(),
              definition: String(w.definition).trim(),
              synonyms: Array.isArray(w.synonyms) ? w.synonyms.filter(Boolean) : [],
              antonyms: Array.isArray(w.antonyms) ? w.antonyms.filter(Boolean) : [],
            }));
          const existing = nameMap.get(src.name);
            if (existing) {
              const existingWords = new Map(existing.words.map(w => [w.word.toLowerCase(), w]));
              cleanedWords.forEach(w => {
                const key = w.word.toLowerCase();
                if (!existingWords.has(key)) { existing.words.push(w); addedWords++; }
              });
              merged++;
            } else {
              state.lists.push({ id: crypto.randomUUID(), name: src.name, words: cleanedWords, stats: {} });
              added++;
              addedWords += cleanedWords.length;
            }
        });
        save();
        renderLists();
        renderStudyListChips();
        alert(`Import complete. New lists: ${added}, merged: ${merged}, words added: ${addedWords}.`);
      } catch (e) {
        alert('Import failed: ' + (e && e.message ? e.message : e));
      } finally {
        els.importFile.value = '';
      }
    });
  }
}

function wireStudyPanel() {
  els.btnStartStudy.addEventListener('click', () => startSession());
  els.btnEndSession.addEventListener('click', () => endSession());
  els.btnShowAnswer.addEventListener('click', () => showCurrentAnswer());
  els.answerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.session) return;
    if (state.awaitingContinue) return; // ignore submissions until Continue is clicked
    const result = state.session.submit(collectAnswer());
    renderFeedback(result);
    renderProgress();
    if (result.done) {
      renderSessionSummary();
      return;
    }
    if (result.correct) {
      // auto-advance after 500ms
      nextQuestionSoon(true);
    } else {
      // Pause flow until user clicks Continue
      state.awaitingContinue = true;
      showContinueButton(() => { state.awaitingContinue = false; nextQuestion(); });
    }
  });

  // Content tabs
  els.contentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      els.contentTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateDirectionLabel();
      updateSynAntVisibility();
    });
  });

  // Settings open/close
  if (els.btnSettings && els.settingsPanel) {
    els.btnSettings.addEventListener('click', () => {
      els.settingsPanel.classList.toggle('hidden');
    });
  }
  // Direction toggle: Match ____ to Word / Match Word to ____
  let directionState = 'toWord'; // force for spelling
  const updateDirectionLabel = () => {
    const content = currentContentType();
    if (content === 'spelling') directionState = 'toWord';
    const placeholder = contentTitle(content);
    if (directionState === 'toWord') {
      els.directionLabel.innerHTML = `Match <span>${escapeHtml(placeholder)}</span> to Word`;
    } else {
      els.directionLabel.innerHTML = `Match Word to <span>${escapeHtml(placeholder)}</span>`;
    }
    if (content === 'spelling') {
      els.directionLabel.setAttribute('disabled','disabled');
      els.directionLabel.classList.add('disabled');
    } else {
      els.directionLabel.removeAttribute('disabled');
      els.directionLabel.classList.remove('disabled');
    }
  };
  els.directionLabel.addEventListener('click', () => {
    const content = currentContentType();
    if (content === 'spelling') return; // locked
    directionState = directionState === 'toWord' ? 'toAnswer' : 'toWord';
    updateDirectionLabel();
  });
  // Initialize label
  updateDirectionLabel();
  updateSynAntVisibility();

  // Collapse setup controls
  // Floating collapse toggle button (slides config left by toggling .compact)
  if (els.toggleSetup && els.studyConfig) {
    const updateToggleA11y = () => {
      const collapsed = document.body.classList.contains('study-config-collapsed');
      els.toggleSetup.setAttribute('aria-expanded', String(!collapsed));
      els.toggleSetup.setAttribute('aria-label', collapsed ? 'Show setup' : 'Hide setup');
      els.toggleSetup.title = collapsed ? 'Show setup' : 'Hide setup';
      const eye = els.toggleSetup.querySelector('.collapse-icon-eye');
      const eyeOff = els.toggleSetup.querySelector('.collapse-icon-eye-off');
      if (eye && eyeOff) {
        if (collapsed) {
          eye.classList.add('hidden');
          eyeOff.classList.remove('hidden');
        } else {
          eye.classList.remove('hidden');
          eyeOff.classList.add('hidden');
        }
      }
    };
    const toggle = () => {
      const collapsed = document.body.classList.toggle('study-config-collapsed');
      if (collapsed) {
        els.studyConfig.classList.add('compact');
      } else {
        els.studyConfig.classList.remove('compact');
      }
      updateToggleA11y();
    };
    updateToggleA11y();
    els.toggleSetup.addEventListener('click', toggle);
    els.toggleSetup.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
  }
}


function load() {
  state.lists = Storage.loadLists();
  state.activeListId = Storage.loadActiveListId() || (state.lists[0] ? state.lists[0].id : null);
}

function save() {
  Storage.saveLists(state.lists);
  Storage.saveActiveListId(state.activeListId);
}

async function loadBuiltInLists(mode = 'merge', manual = false) {
  try {
    const resp = await fetch('default_vocab_lists.json', { cache: 'no-store' });
    if (!resp.ok) return; // silent fail
    const data = await resp.json();
    if (!data || !Array.isArray(data.lists)) return;
    const nameMap = new Map(state.lists.map(l => [l.name, l]));
    let changed = 0;
    for (const src of data.lists) {
      const existing = nameMap.get(src.name);
      if (!existing) {
        state.lists.push({ id: crypto.randomUUID(), name: src.name, words: src.words || [], stats: {} });
        changed++;
      } else if (mode === 'overwrite') {
        existing.words = src.words || [];
        existing.stats = {};
        changed++;
      }
    }
    if (changed) {
      if (!state.lists.find(l => l.id === state.activeListId)) {
  state.activeListId = (state.lists[0] ? state.lists[0].id : null);
      }
      save();
      renderLists();
      renderStudyListChips();
    }
  } catch (e) {
    console.warn('Failed to load built-in lists', e);
  if (manual) alert('Failed to load built-in lists: ' + (e && e.message ? e.message : e));
  }
}

function render() {
  renderLists();
  if (!els.listDetail.classList.contains('hidden')) {
    renderListEditor();
    renderWords();
  }
  renderStudyListChips();
}

function renderLists() {
  const filter = (els.listSearch.value || '').toLowerCase();
  els.listCards.innerHTML = '';
  // Sort lists alphabetically by name (case-insensitive) for overview display
  state.lists.slice().sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .filter(l => {
      if (l.name.toLowerCase().includes(filter)) return true;
      if (!filter) return true;
      // search words and definitions
      return l.words.some(w => w.word.toLowerCase().includes(filter) || (w.definition && w.definition.toLowerCase().includes(filter)));
    })
    .forEach(list => {
      const card = document.createElement('div');
      card.className = 'list-card';
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="list-card-head">
          <h3>${escapeHtml(list.name)}</h3>
          <div class="menu-wrap">
            <button class="icon-btn small menu-btn" aria-label="List actions" title="List actions"><svg class="icon" aria-hidden="true"><use href="#icon-menu"/></svg></button>
            <div class="menu hidden" role="menu">
              <button data-act="open" role="menuitem">Open</button>
              <button data-act="duplicate" role="menuitem">Duplicate</button>
              <button data-act="export" role="menuitem">Export</button>
              <button data-act="delete" class="danger" role="menuitem">Delete</button>
            </div>
          </div>
        </div>
        <div class="list-card-meta">${list.words.length} words</div>
        <div class="list-card-words">${previewWords(list.words)}</div>
      `;
      // open on click anywhere (except menu btn)
      card.addEventListener('click', (e) => {
        if (e.target.closest('.menu-wrap')) return; // menu button or menu itself
        // If any menu is open, just close menus and do NOT navigate
        const openMenu = document.querySelector('.list-card .menu:not(.hidden)');
        if (openMenu) { closeOtherMenus(null); return; }
        openListDetail(list.id);
      });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openListDetail(list.id); } });
      // menu logic
      const menuBtn = card.querySelector('.menu-btn');
      const menu = card.querySelector('.menu');
      menuBtn.setAttribute('aria-expanded','false');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        // Close all first
        closeOtherMenus(null);
        if (!isOpen) {
          menu.classList.remove('hidden');
          menuBtn.setAttribute('aria-expanded','true');
          // Focus first item for accessibility
          const first = menu.querySelector('button');
          setTimeout(() => { if (first) first.focus(); }, 0);
        } else {
          menu.classList.add('hidden');
          menuBtn.setAttribute('aria-expanded','false');
        }
      });
      menu.addEventListener('click', (e) => { e.stopPropagation(); });
      menu.addEventListener('focusout', (e) => {
        // Close if focus leaves the menu and not moving to another element inside it
        if (!menu.contains(e.relatedTarget)) closeOtherMenus(null);
      });
      menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => handleCardMenu(list, btn.dataset.act));
      });
      els.listCards.appendChild(card);
    });
  document.addEventListener('click', () => closeOtherMenus(null), { once: true });
}

function previewWords(words) {
  if (!words.length) return '<em class="muted">(empty)</em>';
  const maxLines = 20; // total lines to render for tall cards
  if (words.length <= maxLines) {
    return words.map(w => `<div class=\"word-line\">${escapeHtml(w.word)}</div>`).join('');
  }
  const visible = words.slice(0, maxLines - 1) // 19 words
    .map(w => `<div class=\"word-line\">${escapeHtml(w.word)}</div>`)
    .join('');
  const remaining = words.length - (maxLines - 1);
  return visible + `<div class=\"word-line more-line\">+ ${remaining} more</div>`;
}

function closeOtherMenus(current) {
  document.querySelectorAll('.list-card .menu').forEach(m => {
    if (m !== current) {
      if (!m.classList.contains('hidden')) m.classList.add('hidden');
    }
  });
  document.querySelectorAll('.list-card .menu-btn').forEach(btn => btn.setAttribute('aria-expanded','false'));
  if (current) {
  const btn = current && current.parentElement ? current.parentElement.querySelector('.menu-btn') : null;
    if (btn) btn.setAttribute('aria-expanded','true');
  }
}

// Global handlers for closing list action menus
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeOtherMenus(null);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOtherMenus(null); });

function handleCardMenu(list, act) {
  switch (act) {
    case 'open':
      closeOtherMenus(null); openListDetail(list.id); break;
    case 'duplicate':
      const id = crypto.randomUUID();
      const clone = JSON.parse(JSON.stringify(list));
      clone.id = id;
      clone.name = `${clone.name} (copy)`;
      state.lists.push(clone);
      state.activeListId = id; save(); renderLists(); closeOtherMenus(null); break;
    case 'export':
      downloadJSON(`${list.name}.json`, list); closeOtherMenus(null); break;
    case 'delete':
      appConfirm('Delete List', `Delete list "${escapeHtml(list.name)}"? This cannot be undone.`).then(ok => {
        if (!ok) { closeOtherMenus(null); return; }
        state.lists = state.lists.filter(l => l.id !== list.id);
  if (state.activeListId === list.id) state.activeListId = (state.lists[0] ? state.lists[0].id : null);
        save(); renderLists(); renderStudyListChips();
        closeOtherMenus(null);
      });
      break;
  }
}

function openListDetail(id) {
  state.activeListId = id;
  save();
  els.listsOverview.classList.add('hidden');
  els.listDetail.classList.remove('hidden');
  renderListEditor();
  renderWords();
  updateDetailHeader();
}

function updateDetailHeader() {
  const list = activeList();
  if (els.detailTitle) {
    const val = (list ? list.name : '');
    if (els.detailTitle.tagName === 'INPUT') {
      els.detailTitle.value = val;
    } else {
      els.detailTitle.textContent = val || 'List';
    }
  }
}

function showOverview() {
  els.listDetail.classList.add('hidden');
  els.listsOverview.classList.remove('hidden');
  renderLists();
}

function renderListEditor() {
  // list-name input removed; nothing needed here now
}

function renderWords() {
  const list = activeList();
  if (!els.wordsTbody) return;
  const filter = (els.wordSearch && els.wordSearch.value ? els.wordSearch.value : '').toLowerCase();
  els.wordsTbody.innerHTML = '';
  if (!list) return;
  list.words
    .filter(w => w.word.toLowerCase().includes(filter) || w.definition.toLowerCase().includes(filter))
    .forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(w.word)}</strong><br/><small>${escapeHtml(w.example || '')}</small></td>
        <td>${escapeHtml(w.definition)}</td>
  <td>${escapeHtml(Array.isArray(w.synonyms) ? w.synonyms.join(', ') : '')}</td>
  <td>${escapeHtml(Array.isArray(w.antonyms) ? w.antonyms.join(', ') : '')}</td>
      `;
      tr.addEventListener('click', () => openWordModal(w));
      els.wordsTbody.appendChild(tr);
    });
  updateDetailHeader();
}

function renderStudyListChips() {
  els.studyListChips.innerHTML = '';
  state.lists.forEach(l => {
    const id = `chip-${l.id}`;
    const label = document.createElement('label');
    label.className = 'chip';
    label.setAttribute('role', 'listitem');
    label.innerHTML = `<input type="checkbox" id="${id}" data-id="${l.id}" checked><span>${escapeHtml(l.name)} <small>(${l.words.length})</small></span>`;
    els.studyListChips.appendChild(label);
  });
}

function collectWordFromForm() {
  return normalizeWord({
    word: els.wordInputs.word.value.trim(),
    example: els.wordInputs.example.value.trim(),
    definition: els.wordInputs.definition.value.trim(),
    synonyms: els.wordInputs.synonyms.value.split(',').map(s => s.trim()).filter(Boolean),
    antonyms: els.wordInputs.antonyms.value.split(',').map(s => s.trim()).filter(Boolean),
  });
}

function fillWordForm(w) {
  els.wordInputs.word.value = w.word || '';
  els.wordInputs.example.value = w.example || '';
  els.wordInputs.definition.value = w.definition || '';
  els.wordInputs.synonyms.value = (w.synonyms || []).join(', ');
  els.wordInputs.antonyms.value = (w.antonyms || []).join(', ');
}

function clearWordForm() {
  Object.values(els.wordInputs).forEach(i => i.value = '');
  if (els.wordModal) {
    const mi = els.wordModal.querySelector('.modal');
    if (mi) mi.setAttribute('data-mode','new');
  }
  if (els.btnDeleteWord && els.btnDeleteWord.classList) {
    els.btnDeleteWord.classList.add('hidden');
  }
  const tEl = $('#word-modal-title');
  if (tEl) tEl.textContent = 'Add Word';
}

function normalizeWord(w) {
  return {
    word: w.word,
    example: w.example || '',
    definition: w.definition,
    synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
    antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
  };
}

function activeList() { return state.lists.find(l => l.id === state.activeListId) || state.lists[0] || null; }

// --- Modal Word Editing ---
let editingOriginalWord = null;
function openWordModal(word = null) {
  editingOriginalWord = (word && word.word) ? word.word : null;
  if (!els.wordModal) return; // safety
  const modalInner = els.wordModal.querySelector('.modal');
  if (word) {
    fillWordForm(word);
    if (modalInner) modalInner.setAttribute('data-mode','edit');
    if (els.btnDeleteWord && els.btnDeleteWord.classList) {
      els.btnDeleteWord.classList.remove('hidden');
    }
    const titleEl = $('#word-modal-title'); if (titleEl) titleEl.textContent = 'Edit Word';
  } else {
    clearWordForm();
  }
  els.wordModal.classList.remove('hidden');
  if (els.wordInputs.word) els.wordInputs.word.focus();
}
function closeWordModal() {
  if (els.wordModal && els.wordModal.classList) els.wordModal.classList.add('hidden');
  editingOriginalWord = null;
}
function saveWordFromModal() {
  const list = activeList(); if (!list) return;
  const data = collectWordFromForm();
  if (!data.word || !data.definition) { alert('Word and definition are required.'); return; }
  const idx = editingOriginalWord ? list.words.findIndex(x => x.word.toLowerCase() === editingOriginalWord.toLowerCase()) : -1;
  if (idx >= 0) list.words[idx] = data; else list.words.push(data);
  save();
  renderWords();
  renderLists();
  closeWordModal();
  clearWordForm();
}
function deleteCurrentModalWord() {
  const list = activeList(); if (!list || !editingOriginalWord) return;
  const idx = list.words.findIndex(x => x.word.toLowerCase() === editingOriginalWord.toLowerCase());
  if (idx < 0) { closeWordModal(); return; }
  appConfirm('Delete Word', `Delete "${escapeHtml(editingOriginalWord)}"?`).then(ok => {
    if (ok) { list.words.splice(idx,1); save(); renderWords(); renderLists(); updateDetailHeader(); }
    closeWordModal();
  });
}

// Study session
function startSession() {
  const listIds = Array.from(els.studyListChips.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.dataset.id);
  const selectedLists = state.lists.filter(l => listIds.includes(l.id));
  const allWords = selectedLists.flatMap(l => l.words.map(w => ({ ...w, __listId: l.id })));
  const pool = allWords;
  const content = currentContentType();
  if (!pool.length) {
    alert('Select at least one list with words.');
    return;
  }
  const options = {
    content,
    direction: currentDirection(),
    sessionMode: els.sessionMode.value, // learning | normal | test
    synAntPrompt: (els.synAntPrompt && els.synAntPrompt.value) ? els.synAntPrompt.value : 'random', // random | all
  };
  state.session = new StudyEngine(pool, options, state.lists);
  els.session.classList.remove('hidden');
  if (els.sessionPlaceholder) els.sessionPlaceholder.classList.add('hidden');
  els.feedback.innerHTML = '';
  state.awaitingContinue = false;
  state.streak = 0;
  updateStatsChips();
  nextQuestion(true);
  renderProgress();
  // Toggle start/end buttons
  if (els.btnStartStudy) els.btnStartStudy.classList.add('hidden');
  if (els.btnEndSession) els.btnEndSession.classList.remove('hidden');
}

function endSession() {
  if (!state.session) return;
  state.session = null;
  els.session.classList.add('hidden');
  if (els.sessionPlaceholder) els.sessionPlaceholder.classList.remove('hidden');
  // Restore buttons
  if (els.btnEndSession) els.btnEndSession.classList.add('hidden');
  if (els.btnStartStudy) els.btnStartStudy.classList.remove('hidden');
}

function nextQuestion(initial = false) {
  if (!state.session) return;
  const q = state.session.next();
  if (!q || q.type === 'done') { renderSessionSummary(); return; }
  // Only clear feedback automatically when coming from a correct answer auto-advance, not when first loading or after an incorrect (Continue clears it)
  if (!initial && !state.awaitingContinue) {
    els.feedback.innerHTML = '';
  }
  renderQuestion(q);
}

function nextQuestionSoon(correct) {
  // correct -> 500ms, incorrect path managed by Continue button
  const delay = correct ? 500 : 600;
  if (state.advanceTimer) clearTimeout(state.advanceTimer);
  const before = state.lastPrompt;
  state.advanceTimer = setTimeout(() => {
    // If still on the same prompt (hasn't advanced some other way) then advance
    if (!state.awaitingContinue) {
      const currentHtml = els.prompt.innerHTML;
      if (before === currentHtml) nextQuestion();
    }
  }, delay);
}

function renderQuestion(q) {
  els.prompt.innerHTML = q.promptHtml;
  state.lastPrompt = q.promptHtml;
  els.answerInputArea.innerHTML = '';
    if (els.btnShowAnswer && els.btnShowAnswer.classList) els.btnShowAnswer.classList.remove('hidden');
  if (q.type === 'input') {
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.placeholder = 'Type your answer…';
    input.name = 'text';
    els.answerInputArea.appendChild(input);
    input.focus();
  } else if (q.type === 'mc') {
    q.choices.forEach((choice, i) => {
      const id = `mc-${i}-${Date.now()}`;
      const label = document.createElement('label');
      label.className = 'mc-choice';
      label.htmlFor = id;
      label.innerHTML = `<input id="${id}" type="radio" name="mc" value="${i}"><span>${escapeHtml(choice)}</span>`;
      els.answerInputArea.appendChild(label);
    });
    // Focus first choice for accessibility
    const first = els.answerInputArea.querySelector('input[type="radio"]');
    if (first) first.focus();
  }
}

function collectAnswer() {
  const input = els.answerInputArea.querySelector('input[name="text"]');
  if (input) return { kind: 'text', value: input.value.trim() };
  const checked = els.answerInputArea.querySelector('input[name="mc"]:checked');
  return { kind: 'mc', value: checked ? Number(checked.value) : -1 };
}

function showCurrentAnswer() {
  if (!state.session) return;
  const ans = state.session.currentAnswer();
  els.feedback.innerHTML = `<div class="incorrect">Answer: ${escapeHtml(ans.expected)}</div>`;
}

function renderFeedback(result) {
  if (!result) return;
  if (result.correct) {
    els.feedback.innerHTML = `<div class="correct">Correct!</div>`;
    state.streak += 1;
    updateStatsChips();
    return;
  }
  // Incorrect flow
  state.streak = 0;
  const expected = escapeHtml(result.expected);
  const your = escapeHtml(result.your || '(no answer)');
  // Determine additional info
  let extraBlock = '';
  const isDefMode = result.mode && result.mode.startsWith('definition');
  const isSynAnt = result.mode && (result.mode.startsWith('synonym') || result.mode.startsWith('antonym'));
  if (isDefMode || isSynAnt) {
    const wrongDef = lookupWordDefinition(result.your);
    const correctDef = lookupWordDefinition(result.expected);
    const parts = [];
    if (correctDef) parts.push(`<div class=\"extra-def\"><strong>${expected}</strong>: ${escapeHtml(correctDef)}</div>`);
    if (wrongDef) parts.push(`<div class=\"extra-def\"><strong>${your}</strong>: ${escapeHtml(wrongDef)}</div>`);
    extraBlock = parts.join('');
  }
  // Only show definition blocks (no redundant labels)
  els.feedback.innerHTML = `<div class=\"incorrect\">${extraBlock || 'Incorrect.'}</div>`;
  // For MC highlight choices
  if (result.selectedIndex !== undefined && result.selectedIndex >= 0) {
    highlightChoices(result);
  }
  // Replace submit button area with Continue
  const submitBtn = els.answerForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.classList.add('hidden');
    // Inject a temporary continue button in its place
    let inlineHolder = els.answerForm.querySelector('.answer-actions .temp-continue');
    if (!inlineHolder) {
      inlineHolder = document.createElement('div');
      inlineHolder.className = 'temp-continue';
      submitBtn.parentElement.insertBefore(inlineHolder, submitBtn); // before hidden submit
    } else {
      inlineHolder.innerHTML = '';
    }
    const cont = document.createElement('button');
    cont.type = 'button';
    cont.textContent = 'Continue';
    cont.className = 'primary';
    inlineHolder.appendChild(cont);
    cont.focus();
    cont.addEventListener('click', () => {
      inlineHolder.remove();
      submitBtn.classList.remove('hidden');
      state.awaitingContinue = false;
      nextQuestion();
    });
  }
  updateStatsChips();
}

function lookupWordDefinition(wordPlain) {
  if (!wordPlain) return '';
  const lower = wordPlain.trim().toLowerCase();
  for (const l of state.lists) {
    const found = l.words.find(w => (w.word || '').toLowerCase() === lower);
    if (found) return found.definition || '';
  }
  return '';
}

function highlightChoices(result) {
  const labels = $all('.mc-choice');
  labels.forEach((lbl, idx) => {
    const input = lbl.querySelector('input');
    if (!input) return;
    if (idx === result.answerIndex) lbl.classList.add('choice-correct');
    if (idx === result.selectedIndex && result.selectedIndex !== result.answerIndex) lbl.classList.add('choice-wrong');
    input.disabled = true;
  });
}

function showContinueButton(onContinue) {
  $all('input', els.answerInputArea).forEach(i => i.disabled = true);
  els.answerForm.classList.add('awaiting-continue');
  if (els.btnShowAnswer && els.btnShowAnswer.classList) els.btnShowAnswer.classList.add('hidden');
  const submitBtn = els.answerForm.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  let holder = els.answerForm.querySelector('.answer-actions .temp-continue');
  if (!holder) {
    holder = document.createElement('div');
    holder.className = 'temp-continue';
    submitBtn.parentElement.insertBefore(holder, submitBtn);
  } else {
    holder.innerHTML = '';
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Continue';
  btn.className = 'primary';
  holder.appendChild(btn);
  submitBtn.classList.add('hidden');
  btn.focus();
  btn.addEventListener('click', () => {
    holder.remove();
    submitBtn.classList.remove('hidden');
    els.answerForm.classList.remove('awaiting-continue');
    if (typeof onContinue === 'function') onContinue();
  });
}

function renderProgress() {
  if (!state.session) return;
  const { answered, total, infinite } = state.session.progress();
  if (els.progressText) {
    els.progressText.textContent = infinite ? `${answered} / ∞` : `${answered} / ${total}`;
  }
  if (els.progressBarInner && total) {
    const pct = Math.min(100, (answered / total) * 100);
    els.progressBarInner.style.width = `${pct}%`;
  } else if (els.progressBarInner && !total) {
    // infinite session: animate subtle pulse
    els.progressBarInner.style.width = '100%';
    els.progressBarInner.style.animation = 'progressPulse 3s linear infinite';
  }
}

function renderSessionSummary() {
  if (!state.session) return;
  const summary = (state.session.summary ? state.session.summary() : null) || { attempts: 0, correct: 0, accuracy: 0 };
  els.feedback.innerHTML = `
    <div>
      <strong>Session complete.</strong><br/>
      Attempts: ${summary.attempts} • Correct: ${summary.correct} • Accuracy: ${(summary.accuracy * 100).toFixed(0)}%
    </div>
  `;
  updateStatsChips();
}

function updateStatsChips() {
  if (!state.session) {
    if (els.chipAttempts) els.chipAttempts.textContent = '0';
    if (els.chipAccuracy) els.chipAccuracy.textContent = '0%';
    if (els.chipStreak) els.chipStreak.textContent = '0';
    return;
  }
  const summary = state.session.summary ? state.session.summary() : { attempts: 0, correct: 0, accuracy: 0 };
  if (els.chipAttempts) els.chipAttempts.textContent = String(summary.attempts);
  if (els.chipAccuracy) {
    const pct = (summary.accuracy * 100).toFixed(0) + '%';
    els.chipAccuracy.textContent = pct;
    const parent = els.chipAccuracy.closest('.chip-stat');
    if (parent) {
      parent.classList.remove('good','warn','bad');
      const a = summary.accuracy;
      if (a >= 0.85) parent.classList.add('good'); else if (a >= 0.6) parent.classList.add('warn'); else parent.classList.add('bad');
    }
  }
  if (els.chipStreak) {
    els.chipStreak.textContent = String(state.streak);
    const parent = els.chipStreak.closest('.chip-stat');
    if (parent) {
      parent.classList.remove('good','warn','bad');
      if (state.streak >= 10) parent.classList.add('good'); else if (state.streak >=5) parent.classList.add('warn');
    }
  }
}

function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function currentContentType() {
  const active = els.contentTabs.find(t => t.classList.contains('active'));
  return (active && active.dataset && active.dataset.content) ? active.dataset.content : 'spelling';
}
function currentDirection() {
  // read from label text to stay in sync with UI logic
  // But we tracked state internally, so infer based on label text
  const content = currentContentType();
  if (content === 'spelling') return 'toWord';
  const txt = els.directionLabel.textContent || '';
  return txt.includes('to Word') ? 'toWord' : 'toAnswer';
}

function contentTitle(content) {
  switch (content) {
    case 'spelling':
      return 'Definition';
    case 'definition':
      return 'Definition';
    case 'synonym':
      return 'Synonym';
    case 'antonym':
      return 'Antonym';
    default:
      return 'Answer';
  }
}

function updateSynAntVisibility() {
  const wrapper = document.getElementById('syn-ant-wrapper');
  if (!wrapper) return;
  const c = currentContentType();
  if (c === 'synonym' || c === 'antonym') {
    wrapper.classList.remove('hidden');
  } else {
    wrapper.classList.add('hidden');
  }
}

// --- Downloads ---
function downloadJSON(filename, data) {
  try {
    const safeName = sanitizeFileName(filename || 'data.json');
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    // Some browsers need the link to be in the DOM
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  } catch (e) {
    console.error('downloadJSON failed', e);
    alert('Export failed: ' + ((e && e.message) ? e.message : e));
  }
}
function sanitizeFileName(name) {
  return String(name).replace(/[\\\/:*?"<>|]+/g, '_').trim() || 'download.json';
}

// --- Generic Dialog System ---
let dialogResolve = null;
function openDialog({ title, body, mode = 'confirm', placeholder = '', defaultValue = '' }) {
  if (!els.appDialog) return Promise.resolve(null);
  els.appDialogTitle.textContent = title || 'Dialog';
  els.appDialogBody.innerHTML = body || '';
  els.appDialogButtons.innerHTML = '';
  els.appDialogInputWrap.classList.add('hidden');
  els.appDialogInput.value = '';
  els.appDialog.classList.remove('hidden');
  els.appDialog.setAttribute('aria-hidden','false');

  const buttons = [];
  if (mode === 'prompt') {
    els.appDialogInputWrap.classList.remove('hidden');
    els.appDialogInput.placeholder = placeholder || '';
    els.appDialogInput.value = defaultValue || '';
    setTimeout(() => { els.appDialogInput.focus(); els.appDialogInput.select(); }, 30);
    buttons.push({ key: 'cancel', label: 'Cancel', class: 'icon-btn', value: null });
    buttons.push({ key: 'ok', label: 'OK', class: 'primary', value: '__PROMPT_OK__' });
  } else {
    buttons.push({ key: 'cancel', label: 'Cancel', class: 'icon-btn', value: false });
    buttons.push({ key: 'ok', label: 'OK', class: 'primary', value: true });
  }

  buttons.forEach(btnCfg => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = btnCfg.label;
    b.className = btnCfg.class;
    b.addEventListener('click', () => {
      if (!dialogResolve) return;
      if (mode === 'prompt') {
        if (btnCfg.value === null) { dialogResolve(null); closeDialog(); return; }
        dialogResolve(els.appDialogInput.value.trim() || '');
        closeDialog();
      } else {
        dialogResolve(btnCfg.value);
        closeDialog();
      }
    });
    els.appDialogButtons.appendChild(b);
  });

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (dialogResolve) dialogResolve(mode === 'prompt' ? null : false); closeDialog(); }
    if (mode === 'prompt' && e.key === 'Enter' && document.activeElement === els.appDialogInput) {
      e.preventDefault(); if (dialogResolve) { dialogResolve(els.appDialogInput.value.trim() || ''); closeDialog(); }
    }
  };
  document.addEventListener('keydown', onKey, { once: true });

  return new Promise(res => { dialogResolve = res; });
}

function closeDialog() {
  if (!els.appDialog) return;
  els.appDialog.classList.add('hidden');
  els.appDialog.setAttribute('aria-hidden','true');
  dialogResolve = null;
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    if (e.target === els.appDialog) { if (dialogResolve) dialogResolve(false); closeDialog(); }
  });
}
if (els.appDialogClose) els.appDialogClose.addEventListener('click', () => { if (dialogResolve) dialogResolve(false); closeDialog(); });

function appConfirm(title, message) {
  return openDialog({ title, body: `<p>${message}</p>`, mode: 'confirm' });
}
function appPrompt(title, message, defaultValue = '') {
  return openDialog({ title, body: `<p>${message}</p>`, mode: 'prompt', defaultValue });
}


document.addEventListener('DOMContentLoaded', init);
