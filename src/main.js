import { Storage } from './storage.js';
import { StudyEngine } from './study.js';

// State
const state = {
  lists: [],
  activeListId: null,
  selectedStudyListIds: [], // IDs of lists selected for study session
  session: null,
  awaitingContinue: false,
  streak: 0,
  lastPrompt: null,
  advanceTimer: null,
  // Session restart tracking
  sessionStartSettings: null,
  settingsChanged: false,
  // Flashcards state
  flashcards: {
    listId: null,
    cards: [],
    currentIndex: 0,
    flipped: false,
  },
};

const els = {};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function init() {
  cacheEls();
  // Bind generic dialog close button now that elements are cached
  if (els.appDialogClose) {
    els.appDialogClose.addEventListener('click', () => {
      if (dialogResolve) dialogResolve(false);
      closeDialog();
    });
  }
  wireTabs();
  wireListPanel();
  wireStudyPanel();
  wireFlashcardsPanel();
  load();
  // Merge built-in default lists (non-destructive) asynchronously
  loadBuiltInLists('merge');
  render();
  // Ensure progress bar hidden by default until a test session begins (new markup has id)
  const pbWrap = document.getElementById('progress-bar-wrap');
  if (pbWrap) {
    pbWrap.classList.add('hidden');
    pbWrap.setAttribute('aria-hidden','true');
  }
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
  els.btnAddStudyLists = $('#btn-add-study-lists');
  els.selectedStudyLists = $('#selected-study-lists');
  els.addListsModal = $('#add-lists-modal');
  els.btnCloseAddLists = $('#btn-close-add-lists');
  els.btnCancelAddLists = $('#btn-cancel-add-lists');
  els.addListsSearch = $('#add-lists-search');
  els.addListsContainer = $('#add-lists-container');
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
  
  // Flashcards
  els.flashcardListSelect = $('#flashcard-list-select');
  els.flashcardDirection = $('#flashcard-direction');
  els.flashcardOrder = $('#flashcard-order');
  els.flashcardAnimationsBtn = $('#flashcard-animations-btn');
  els.flashcardPlaceholder = $('#flashcard-placeholder');
  els.flashcardViewer = $('#flashcard-viewer');
  els.flashcard = $('#flashcard');
  els.flashcardContent = $('#flashcard-content');
  els.flashcardLabel = $('#flashcard-label');
  els.flashcardCounter = $('#flashcard-counter');
  els.flashcardControlsBottom = $('#flashcard-controls-bottom');
  els.btnPrevCard = $('#btn-prev-card');
  els.btnNextCard = $('#btn-next-card');
  els.btnFlipCard = $('#btn-flip-card');
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
        // Persist any pending list changes & refresh chips when entering Study
        save();
        renderSelectedStudyLists();
        // Update progress bar visibility (only when a test session is active)
        const pbWrap = document.getElementById('progress-bar-wrap');
        if (pbWrap) {
          if (state.session && state.session.options && state.session.options.sessionMode === 'test') {
            pbWrap.classList.remove('hidden');
            pbWrap.setAttribute('aria-hidden','false');
          } else {
            pbWrap.classList.add('hidden');
            pbWrap.setAttribute('aria-hidden','true');
          }
        }
      } else if (tab.dataset.tab === 'flashcards') {
        document.body.classList.remove('in-study');
        // Populate flashcard lists when entering flashcards tab
        save();
        populateFlashcardLists();
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
    // Immediately reflect in Study panel
    renderSelectedStudyLists();
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
    // Refresh list selection for new duplicate
    renderSelectedStudyLists();
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
    renderSelectedStudyLists();
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
        renderSelectedStudyLists(); // keep list selection in sync
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
        renderSelectedStudyLists();
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
  els.btnEndSession.addEventListener('click', () => {
    if (state.settingsChanged) {
      // Restart with new settings
      endSession();
      startSession();
    } else {
      // Normal end session
      endSession();
    }
  });
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
      showContinueButton(() => { state.awaitingContinue = false; nextQuestion(false, true); });
    }
  });

  // Content tabs
  els.contentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      els.contentTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateDirectionLabel();
      updateSynAntVisibility();
      updateButtonForSettingsChange(); // Check for settings change
    });
  });

  // Settings open/close
  if (els.btnSettings && els.settingsPanel) {
    els.btnSettings.addEventListener('click', () => {
      els.settingsPanel.classList.toggle('hidden');
    });
  }
  // Direction toggle: Match ____ to Word / Match Word to ____
  let directionState = 'toWord';
  const updateDirectionLabel = () => {
    const content = currentContentType();
    const placeholder = contentTitle(content);
    if (directionState === 'toWord') {
      els.directionLabel.innerHTML = `Match <span>${escapeHtml(placeholder)}</span> to Word`;
    } else {
      els.directionLabel.innerHTML = `Match Word to <span>${escapeHtml(placeholder)}</span>`;
    }
  };
  els.directionLabel.addEventListener('click', () => {
    const content = currentContentType();
    directionState = directionState === 'toWord' ? 'toAnswer' : 'toWord';
    updateDirectionLabel();
    updateButtonForSettingsChange(); // Check for settings change
  });
  // Initialize label
  updateDirectionLabel();
  updateSynAntVisibility();

  // Add settings change listeners
  if (els.sessionMode) {
    els.sessionMode.addEventListener('change', updateButtonForSettingsChange);
  }
  if (els.synAntPrompt) {
    els.synAntPrompt.addEventListener('change', updateButtonForSettingsChange);
  }
  
  // Add Lists button
  if (els.btnAddStudyLists) {
    els.btnAddStudyLists.addEventListener('click', openAddListsModal);
  }
  
  // Close modal buttons
  if (els.btnCloseAddLists) {
    els.btnCloseAddLists.addEventListener('click', closeAddListsModal);
  }
  if (els.btnCancelAddLists) {
    els.btnCancelAddLists.addEventListener('click', closeAddListsModal);
  }
  
  // Search in add lists modal
  if (els.addListsSearch) {
    els.addListsSearch.addEventListener('input', renderAddListsModal);
  }

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
        state.lists.push({ id: crypto.randomUUID(), name: src.name, words: src.words || [], tags: src.tags || [], stats: {} });
        changed++;
      } else if (mode === 'overwrite') {
        existing.words = src.words || [];
        existing.tags = src.tags || [];
        existing.stats = {};
        changed++;
      } else if (mode === 'merge') {
        // In merge mode, update tags if they don't exist
        if (!existing.tags || existing.tags.length === 0) {
          existing.tags = src.tags || [];
          changed++;
        }
      }
    }
    if (changed) {
      if (!state.lists.find(l => l.id === state.activeListId)) {
  state.activeListId = (state.lists[0] ? state.lists[0].id : null);
      }
      save();
      renderLists();
      renderSelectedStudyLists();
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
  renderSelectedStudyLists();
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

// Global handlers for closing list action menus and word menus
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) closeOtherMenus(null);
  if (!e.target.closest('.word-menu-wrap')) closeWordMenus();
});
document.addEventListener('keydown', (e) => { 
  if (e.key === 'Escape') {
    closeOtherMenus(null);
    closeWordMenus();
  }
});

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
        save(); renderLists(); renderSelectedStudyLists();
        closeOtherMenus(null);
      });
      break;
  }
}

function closeWordMenus() {
  if (els.wordsTbody) {
    els.wordsTbody.querySelectorAll('.word-menu').forEach(menu => {
      menu.classList.add('hidden');
    });
  }
}

function handleWordMenuAction(word, action) {
  const list = activeList();
  if (!list || !word) return;
  
  if (action === 'edit') {
    openWordModal(word);
  } else if (action === 'duplicate') {
    const duplicated = JSON.parse(JSON.stringify(word));
    duplicated.word = `${duplicated.word} (copy)`;
    list.words.push(duplicated);
    save();
    renderWords();
    renderLists();
  } else if (action === 'delete') {
    appConfirm('Delete Word', `Delete "${escapeHtml(word.word)}"?`).then(ok => {
      if (ok) {
        const idx = list.words.findIndex(w => w.word === word.word);
        if (idx >= 0) {
          list.words.splice(idx, 1);
          save();
          renderWords();
          renderLists();
          updateDetailHeader();
        }
      }
    });
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
        <td class="word-menu-cell">
          <div class="word-menu-wrap">
            <button class="icon-btn small word-menu-btn" aria-label="Word actions" title="Word actions" data-word="${escapeHtml(w.word)}">
              <svg class="icon" aria-hidden="true"><use href="#icon-menu"/></svg>
            </button>
            <div class="word-menu hidden" role="menu">
              <button data-act="edit" role="menuitem">Edit</button>
              <button data-act="duplicate" role="menuitem">Duplicate</button>
              <button data-act="delete" class="danger" role="menuitem">Delete</button>
            </div>
          </div>
        </td>
      `;
      els.wordsTbody.appendChild(tr);
    });
  
  // Add event listeners for word menus
  els.wordsTbody.querySelectorAll('.word-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      const wordText = btn.getAttribute('data-word');
      const word = list.words.find(w => w.word === wordText);
      
      // Close other menus
      els.wordsTbody.querySelectorAll('.word-menu').forEach(m => {
        if (m !== menu) m.classList.add('hidden');
      });
      
      // Toggle this menu
      menu.classList.toggle('hidden');
      
      // Smart positioning to avoid cutoff
      if (!menu.classList.contains('hidden')) {
        const btnRect = btn.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const menuHeight = 120; // Approximate menu height
        const spaceBelow = viewportHeight - btnRect.bottom;
        
        // If there's not enough space below, position above
        if (spaceBelow < menuHeight && btnRect.top > menuHeight) {
          menu.classList.add('position-up');
        } else {
          menu.classList.remove('position-up');
        }
      }
      
      // Handle menu actions
      menu.querySelectorAll('[data-act]').forEach(actionBtn => {
        actionBtn.onclick = (e) => {
          e.stopPropagation();
          handleWordMenuAction(word, actionBtn.getAttribute('data-act'));
          menu.classList.add('hidden');
        };
      });
    });
  });
  
  updateDetailHeader();
}

function renderSelectedStudyLists() {
  if (!els.selectedStudyLists) return;
  els.selectedStudyLists.innerHTML = '';
  
  if (state.selectedStudyListIds.length === 0) {
    els.selectedStudyLists.innerHTML = '<p class="no-lists-message">No lists selected. Click "Add Lists" to get started.</p>';
    return;
  }
  
  state.selectedStudyListIds.forEach(id => {
    const list = state.lists.find(l => l.id === id);
    if (!list) return;
    
    const item = document.createElement('div');
    item.className = 'selected-list-item';
    item.innerHTML = `
      <div class="selected-list-info">
        <span class="selected-list-name">${escapeHtml(list.name)}</span>
      </div>
      <button class="icon-btn small remove-list-btn" data-id="${list.id}" aria-label="Remove ${escapeHtml(list.name)}" title="Remove list">
        <svg class="icon" aria-hidden="true"><use href="#icon-close"/></svg>
      </button>
    `;
    
    const removeBtn = item.querySelector('.remove-list-btn');
    removeBtn.addEventListener('click', () => {
      state.selectedStudyListIds = state.selectedStudyListIds.filter(i => i !== id);
      renderSelectedStudyLists();
      updateButtonForSettingsChange();
    });
    
    els.selectedStudyLists.appendChild(item);
  });
}

function openAddListsModal() {
  if (!els.addListsModal) return;
  els.addListsModal.classList.remove('hidden');
  if (els.addListsSearch) els.addListsSearch.value = '';
  renderAddListsModal();
}

function closeAddListsModal() {
  if (!els.addListsModal) return;
  els.addListsModal.classList.add('hidden');
}

function renderAddListsModal() {
  if (!els.addListsContainer) return;
  
  const searchTerm = (els.addListsSearch ? els.addListsSearch.value : '').toLowerCase();
  const sorted = state.lists.slice().sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  
  const filtered = sorted.filter(list => {
    if (!searchTerm) return true;
    
    // Search by name
    if (list.name.toLowerCase().includes(searchTerm)) return true;
    
    // Search by tags
    if (list.tags && list.tags.some(tag => tag.toLowerCase().includes(searchTerm))) return true;
    
    return false;
  });
  
  els.addListsContainer.innerHTML = '';
  
  if (filtered.length === 0) {
    els.addListsContainer.innerHTML = '<p class="no-results-message">No lists found matching your search.</p>';
    return;
  }
  
  filtered.forEach(list => {
    const isSelected = state.selectedStudyListIds.includes(list.id);
    
    const item = document.createElement('div');
    item.className = 'add-list-item' + (isSelected ? ' selected' : '');
    
    // Ensure tags is always an array
    const tags = Array.isArray(list.tags) ? list.tags : [];
    const tagsHTML = tags.length > 0
      ? tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
      : '<span class="tag">uncategorized</span>';
    
    item.innerHTML = `
      <div class="add-list-info">
        <span class="add-list-name">${escapeHtml(list.name)}</span>
        <span class="add-list-dot">•</span>
        <span class="add-list-count">${list.words.length} words</span>
      </div>
      <div class="add-list-tags">
        ${tagsHTML}
      </div>
    `;
    
    item.addEventListener('click', () => {
      if (isSelected) {
        state.selectedStudyListIds = state.selectedStudyListIds.filter(i => i !== list.id);
      } else {
        state.selectedStudyListIds.push(list.id);
      }
      renderAddListsModal();
      renderSelectedStudyLists();
      updateButtonForSettingsChange();
    });
    
    els.addListsContainer.appendChild(item);
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
  if (state.selectedStudyListIds.length === 0) {
    alert('Please add at least one list to study.');
    return;
  }
  
  const selectedLists = state.lists.filter(l => state.selectedStudyListIds.includes(l.id));
  const allWords = selectedLists.flatMap(l => l.words.map(w => ({ ...w, __listId: l.id })));
  const pool = allWords;
  const content = currentContentType();
  if (!pool.length) {
    alert('The selected lists have no words.');
    return;
  }
  const options = {
    content,
    direction: currentDirection(),
    sessionMode: els.sessionMode.value, // learning | normal | test
    synAntPrompt: (els.synAntPrompt && els.synAntPrompt.value) ? els.synAntPrompt.value : 'random', // random | all
  };
  
  // Capture initial settings for change detection
  state.sessionStartSettings = captureCurrentSettings();
  state.settingsChanged = false;
  
  state.session = new StudyEngine(pool, options, state.lists);
  els.session.classList.remove('hidden');
  if (els.sessionPlaceholder) els.sessionPlaceholder.classList.add('hidden');
  els.feedback.innerHTML = '';
  state.awaitingContinue = false;
  state.streak = 0;
  updateStatsChips();
  nextQuestion(true);
  // Show/hide progress bar only for test mode
  const pbWrap = document.getElementById('progress-bar-wrap');
  if (pbWrap) {
    if (options.sessionMode === 'test') {
      pbWrap.classList.remove('hidden');
      pbWrap.setAttribute('aria-hidden','false');
      renderProgress();
    } else {
      pbWrap.classList.add('hidden');
      pbWrap.setAttribute('aria-hidden','true');
    }
  }
  // Toggle start/end buttons
  if (els.btnStartStudy) els.btnStartStudy.classList.add('hidden');
  if (els.btnEndSession) els.btnEndSession.classList.remove('hidden');
}

function endSession() {
  if (!state.session) return;
  state.session = null;
  els.session.classList.add('hidden');
  if (els.sessionPlaceholder) els.sessionPlaceholder.classList.remove('hidden');
  // Always hide progress bar when session ends
  const pbWrap = document.getElementById('progress-bar-wrap');
  if (pbWrap) { pbWrap.classList.add('hidden'); pbWrap.setAttribute('aria-hidden','true'); }
  // Restore buttons
  if (els.btnEndSession) {
    els.btnEndSession.classList.add('hidden');
    // Reset button state to original
    els.btnEndSession.textContent = 'End';
    els.btnEndSession.setAttribute('aria-label', 'End Session');
    els.btnEndSession.classList.remove('primary');
    els.btnEndSession.classList.add('danger');
  }
  if (els.btnStartStudy) els.btnStartStudy.classList.remove('hidden');
  
  // Reset session restart tracking
  state.sessionStartSettings = null;
  state.settingsChanged = false;
}

function nextQuestion(initial = false, clearFeedback = true) {
  if (!state.session) return;
  const q = state.session.next();
  if (!q || q.type === 'done') { renderSessionSummary(); return; }
  // Only clear feedback when explicitly requested and not on initial load
  if (!initial && clearFeedback) {
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
      if (before === currentHtml) nextQuestion(false, true);
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
  
  // Get word data for comprehensive feedback
  const wordData = getWordData(result.word);
  
  // Generate comprehensive feedback based on mode
  let extraBlock = generateModeSpecificFeedback(result, wordData, expected, your);
  
  els.feedback.innerHTML = `<div class="incorrect">${extraBlock || 'Incorrect.'}</div>`;
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
      nextQuestion(false, true);
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

function getWordData(wordPlain) {
  if (!wordPlain) return null;
  const lower = wordPlain.trim().toLowerCase();
  for (const l of state.lists) {
    const found = l.words.find(w => (w.word || '').toLowerCase() === lower);
    if (found) return found;
  }
  return null;
}

function findWordByDefinition(definition) {
  if (!definition) return null;
  const defLower = definition.trim().toLowerCase();
  for (const l of state.lists) {
    const found = l.words.find(w => (w.definition || '').toLowerCase() === defLower);
    if (found) return found.word;
  }
  return null;
}

function findWordBySynonym(synonym) {
  if (!synonym) return null;
  const synLower = synonym.trim().toLowerCase();
  for (const l of state.lists) {
    const found = l.words.find(w => 
      Array.isArray(w.synonyms) && 
      w.synonyms.some(s => s.toLowerCase() === synLower)
    );
    if (found) return found.word;
  }
  return null;
}

function findWordByAntonym(antonym) {
  if (!antonym) return null;
  const antLower = antonym.trim().toLowerCase();
  for (const l of state.lists) {
    const found = l.words.find(w => 
      Array.isArray(w.antonyms) && 
      w.antonyms.some(a => a.toLowerCase() === antLower)
    );
    if (found) return found.word;
  }
  return null;
}

// Feedback templates with placeholders
const FEEDBACK_TEMPLATES = {
  spelling_toWord: [
    { text: 'Correct Word: {EXPECTED}', class: 'incorrect' }
  ],
  spelling_toAnswer: [
    { text: 'Correct Definition: {EXPECTED}', class: 'incorrect' }
  ],
  definition_toWord: [
    { text: '{YOUR}: {YOUR_DEF}', class: 'incorrect', condition: 'hasUserAnswer' },
    { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' },
  ],
  definition_toAnswer: [
    { text: 'You selected: {YOUR_WORD} ({YOUR})', class: 'incorrect', condition: 'hasUserAnswer' }
  ],
  synonym_toAnswer: [
    { text: 'You selected: {YOUR_SYN_WORD} ({YOUR_SYN_WORD_DEF})', class: 'incorrect', condition: 'hasUserAnswer' },
    { text: '{WORD}: {WORD_DEF}', class: 'correct' }
  ],
  synonym_toWord: [
    { text: 'You chose: {YOUR}', class: 'incorrect', condition: 'hasUserAnswer' },
    { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' }
  ],
  antonym_toAnswer: [
    { text: 'You selected: {YOUR_ANT_WORD} ({YOUR_ANT_WORD_DEF})', class: 'incorrect', condition: 'hasUserAnswer' },
    { text: '{WORD}: {WORD_DEF}', class: 'correct' }
  ],
  antonym_toWord: [
    { text: 'You chose: {YOUR} ({YOUR_DEF})', class: 'incorrect', condition: 'hasUserAnswer' },
    { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' }
  ]
};

function createFeedbackData(result, wordData, expected, your) {
  const yourWordData = getWordData(your);
  const yourWord = findWordByDefinition(your);
  
  // For synonym/antonym modes, find the word that has the selected synonym/antonym
  const yourSynonymWord = findWordBySynonym(your);
  const yourAntonymWord = findWordByAntonym(your);
  const yourSynWordData = getWordData(yourSynonymWord);
  const yourAntWordData = getWordData(yourAntonymWord);
  
  return {
    EXPECTED: escapeHtml(expected),
    YOUR: escapeHtml(your || ''),
    WORD: escapeHtml(wordData.word || ''),
    CORRECT_DEF: escapeHtml(wordData.definition || ''),
    WORD_DEF: escapeHtml(wordData.definition || ''),
    YOUR_DEF: escapeHtml(yourWordData ? yourWordData.definition : lookupWordDefinition(your) || ''),
    YOUR_WORD: escapeHtml(yourWord || ''),
    
    // For synonym feedback
    YOUR_SYN_WORD: escapeHtml(yourSynonymWord || ''),
    YOUR_SYN_WORD_DEF: escapeHtml(yourSynWordData ? yourSynWordData.definition : ''),
    
    // For antonym feedback  
    YOUR_ANT_WORD: escapeHtml(yourAntonymWord || ''),
    YOUR_ANT_WORD_DEF: escapeHtml(yourAntWordData ? yourAntWordData.definition : ''),
    
    // Conditions
    hasUserAnswer: your && your !== expected && your !== '(no answer)'
  };
}

function replacePlaceholders(template, data) {
  let result = template;
  for (const [placeholder, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      result = result.replace(new RegExp(`{${placeholder}}`, 'g'), value);
    }
  }
  return result;
}

function shouldShowFeedbackLine(feedbackLine, data) {
  if (!feedbackLine.condition) return true;
  return data[feedbackLine.condition] === true;
}

function generateModeSpecificFeedback(result, wordData, expected, your) {
  if (!result.mode || !wordData) return 'Incorrect.';
  
  const template = FEEDBACK_TEMPLATES[result.mode];
  if (!template) {
    return `<div class="extra-def correct"><strong>Correct answer:</strong> ${escapeHtml(expected)}</div>`;
  }
  
  const data = createFeedbackData(result, wordData, expected, your);
  const parts = [];
  
  template.forEach(feedbackLine => {
    if (!shouldShowFeedbackLine(feedbackLine, data)) return;
    
    const text = replacePlaceholders(feedbackLine.text, data);
    const cssClass = feedbackLine.class || 'neutral';
    
    // Only put text before and including colon in strong tags
    const colonIndex = text.indexOf(':');
    let formattedText;
    if (colonIndex !== -1) {
      const beforeColon = text.substring(0, colonIndex + 1);
      const afterColon = text.substring(colonIndex + 1);
      formattedText = `<strong>${beforeColon}</strong>${afterColon}`;
    } else {
      formattedText = `<strong>${text}</strong>`;
    }
    
    parts.push(`<div class="extra-def ${cssClass}">${formattedText}</div>`);
  });
  
  return parts.length > 0 ? parts.join('') : 'Incorrect.';
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
  const txt = els.directionLabel.textContent || '';
  return txt.includes('to Word') ? 'toWord' : 'toAnswer';
}

// Settings tracking for session restart
function captureCurrentSettings() {
  return {
    listIds: state.selectedStudyListIds.slice().sort(), // Sort for consistent comparison
    contentType: currentContentType(),
    direction: currentDirection(),
    sessionMode: els.sessionMode.value,
    synAntPrompt: (els.synAntPrompt && els.synAntPrompt.value) ? els.synAntPrompt.value : 'random'
  };
}

function settingsChanged() {
  if (!state.sessionStartSettings) return false;
  const current = captureCurrentSettings();
  return JSON.stringify(current) !== JSON.stringify(state.sessionStartSettings);
}

function updateButtonForSettingsChange() {
  if (state.session && settingsChanged()) {
    if (!state.settingsChanged) {
      state.settingsChanged = true;
      els.btnEndSession.textContent = 'Start Session';
      els.btnEndSession.setAttribute('aria-label', 'Start New Session');
      els.btnEndSession.classList.remove('danger');
      els.btnEndSession.classList.add('primary');
    }
  } else if (state.settingsChanged) {
    state.settingsChanged = false;
    els.btnEndSession.textContent = 'End';
    els.btnEndSession.setAttribute('aria-label', 'End Session');
    els.btnEndSession.classList.remove('primary');
    els.btnEndSession.classList.add('danger');
  }
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
// (Dialog close button binding moved into init after cacheEls())

function appConfirm(title, message) {
  return openDialog({ title, body: `<p>${message}</p>`, mode: 'confirm' });
}
function appPrompt(title, message, defaultValue = '') {
  return openDialog({ title, body: `<p>${message}</p>`, mode: 'prompt', defaultValue });
}

// ===== FLASHCARDS =====
function wireFlashcardsPanel() {
  if (!els.flashcardListSelect) return;
  
  // Populate list dropdown
  els.flashcardListSelect.addEventListener('change', () => {
    const listId = els.flashcardListSelect.value;
    if (listId) {
      loadFlashcards(listId);
    } else {
      hideFlashcardViewer();
    }
  });
  
  // Direction cycle button
  if (els.flashcardDirection) {
    els.flashcardDirection.addEventListener('click', () => {
      const currentValue = els.flashcardDirection.dataset.value;
      const newValue = currentValue === 'word-to-definition' ? 'definition-to-word' : 'word-to-definition';
      els.flashcardDirection.dataset.value = newValue;
      els.flashcardDirection.textContent = newValue === 'word-to-definition' ? 'Word → Definition' : 'Definition → Word';
      
      if (state.flashcards.listId) {
        state.flashcards.flipped = false;
        renderFlashcard();
      }
    });
  }
  
  // Order cycle button
  if (els.flashcardOrder) {
    els.flashcardOrder.addEventListener('click', () => {
      const currentValue = els.flashcardOrder.dataset.value;
      const newValue = currentValue === 'sequential' ? 'random' : 'sequential';
      els.flashcardOrder.dataset.value = newValue;
      els.flashcardOrder.textContent = newValue === 'sequential' ? 'Sequential' : 'Random';
      
      if (state.flashcards.listId) {
        loadFlashcards(state.flashcards.listId);
      }
    });
  }
  
  // Animations toggle button
  if (els.flashcardAnimationsBtn) {
    els.flashcardAnimationsBtn.addEventListener('click', () => {
      els.flashcardAnimationsBtn.classList.toggle('active');
    });
  }
  
  // Navigation
  if (els.btnPrevCard) {
    els.btnPrevCard.addEventListener('click', () => {
      if (state.flashcards.currentIndex > 0) {
        state.flashcards.currentIndex--;
        state.flashcards.flipped = false;
        renderFlashcard('prev');
      }
    });
  }
  
  if (els.btnNextCard) {
    els.btnNextCard.addEventListener('click', () => {
      if (state.flashcards.currentIndex < state.flashcards.cards.length - 1) {
        state.flashcards.currentIndex++;
        state.flashcards.flipped = false;
        renderFlashcard('next');
      }
    });
  }
  
  if (els.btnFlipCard) {
    els.btnFlipCard.addEventListener('click', () => {
      state.flashcards.flipped = !state.flashcards.flipped;
      renderFlashcard();
    });
  }
  
  // Click card to flip
  if (els.flashcard) {
    els.flashcard.addEventListener('click', () => {
      if (state.flashcards.listId) {
        state.flashcards.flipped = !state.flashcards.flipped;
        renderFlashcard();
      }
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only handle in flashcards panel
    const flashcardsPanel = document.getElementById('panel-flashcards');
    if (!flashcardsPanel || !flashcardsPanel.classList.contains('active')) return;
    if (!state.flashcards.listId) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      els.btnPrevCard.click();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      els.btnNextCard.click();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      els.btnFlipCard.click();
    }
  });
}

function populateFlashcardLists() {
  if (!els.flashcardListSelect) return;
  
  const currentValue = els.flashcardListSelect.value;
  els.flashcardListSelect.innerHTML = '<option value="">Choose a list...</option>';
  
  const sorted = state.lists.slice().sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  sorted.forEach(list => {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = `${list.name} (${list.words.length} words)`;
    els.flashcardListSelect.appendChild(option);
  });
  
  // Restore selection if it still exists
  if (currentValue && state.lists.find(l => l.id === currentValue)) {
    els.flashcardListSelect.value = currentValue;
  }
}

function loadFlashcards(listId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list || !list.words.length) return;
  
  state.flashcards.listId = listId;
  state.flashcards.cards = list.words.slice();
  
  // Apply ordering
  const order = els.flashcardOrder ? els.flashcardOrder.dataset.value : 'sequential';
  if (order === 'random') {
    // Fisher-Yates shuffle
    for (let i = state.flashcards.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.flashcards.cards[i], state.flashcards.cards[j]] = [state.flashcards.cards[j], state.flashcards.cards[i]];
    }
  }
  
  state.flashcards.currentIndex = 0;
  state.flashcards.flipped = false;
  
  showFlashcardViewer();
  renderFlashcard();
}

function showFlashcardViewer() {
  if (els.flashcardPlaceholder) els.flashcardPlaceholder.classList.add('hidden');
  if (els.flashcardViewer) els.flashcardViewer.classList.remove('hidden');
  if (els.flashcardControlsBottom) els.flashcardControlsBottom.classList.remove('hidden');
}

function hideFlashcardViewer() {
  if (els.flashcardPlaceholder) els.flashcardPlaceholder.classList.remove('hidden');
  if (els.flashcardViewer) els.flashcardViewer.classList.add('hidden');
  if (els.flashcardControlsBottom) els.flashcardControlsBottom.classList.add('hidden');
  state.flashcards.listId = null;
  state.flashcards.cards = [];
}

function renderFlashcard(swipeDirection = null) {
  const card = state.flashcards.cards[state.flashcards.currentIndex];
  if (!card) return;
  
  const direction = els.flashcardDirection ? els.flashcardDirection.dataset.value : 'word-to-definition';
  const animationsEnabled = els.flashcardAnimationsBtn ? els.flashcardAnimationsBtn.classList.contains('active') : true;
  
  let front, back, frontLabel, backLabel;
  if (direction === 'word-to-definition') {
    front = card.word;
    back = card.definition;
    frontLabel = 'Word';
    backLabel = 'Definition';
  } else {
    front = card.definition;
    back = card.word;
    frontLabel = 'Definition';
    backLabel = 'Word';
  }
  
  // Add appropriate animation only if enabled
  if (animationsEnabled && swipeDirection === 'next') {
    els.flashcard.classList.add('swipe-out-left');
    setTimeout(() => {
      updateCardContent(front, back, frontLabel, backLabel);
      els.flashcard.classList.remove('swipe-out-left');
      els.flashcard.classList.add('swipe-in-right');
      setTimeout(() => els.flashcard.classList.remove('swipe-in-right'), 300);
    }, 300);
  } else if (animationsEnabled && swipeDirection === 'prev') {
    els.flashcard.classList.add('swipe-out-right');
    setTimeout(() => {
      updateCardContent(front, back, frontLabel, backLabel);
      els.flashcard.classList.remove('swipe-out-right');
      els.flashcard.classList.add('swipe-in-left');
      setTimeout(() => els.flashcard.classList.remove('swipe-in-left'), 300);
    }, 300);
  } else if (animationsEnabled && !swipeDirection) {
    // Flip animation (no swipe)
    els.flashcard.classList.add('flipping');
    setTimeout(() => {
      updateCardContent(front, back, frontLabel, backLabel);
      els.flashcard.classList.remove('flipping');
    }, 150);
  } else {
    // No animation - instant update
    updateCardContent(front, back, frontLabel, backLabel);
  }
  
  // Update counter
  els.flashcardCounter.textContent = `${state.flashcards.currentIndex + 1} / ${state.flashcards.cards.length}`;
  
  // Update button states
  if (els.btnPrevCard) {
    els.btnPrevCard.disabled = state.flashcards.currentIndex === 0;
  }
  if (els.btnNextCard) {
    els.btnNextCard.disabled = state.flashcards.currentIndex === state.flashcards.cards.length - 1;
  }
}

function updateCardContent(front, back, frontLabel, backLabel) {
  els.flashcardContent.textContent = state.flashcards.flipped ? back : front;
  els.flashcardLabel.textContent = state.flashcards.flipped ? backLabel : frontLabel;
}

document.addEventListener('DOMContentLoaded', init);
