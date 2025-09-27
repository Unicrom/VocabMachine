import { Storage } from './storage.js';
import { StudyEngine } from './study.js';

// State
const state = {
  lists: [],
  activeListId: null,
  session: null,
  awaitingContinue: false,
};

const els = {};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function init() {
  cacheEls();
  wireTabs();
  wireListPanel();
  wireStudyPanel();
  wireImportExport();
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

  // Import/export
  els.btnExportAll = $('#btn-export-all');
  els.importFile = $('#import-file');
  els.btnImport = $('#btn-import');
  els.importOcr = $('#import-ocr');
  els.btnImportOcr = $('#btn-import-ocr');
  els.btnBuiltinsMerge = $('#btn-builtins-merge');
  els.btnBuiltinsOverwrite = $('#btn-builtins-overwrite');
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
    });
  });

  // Settings open/close
  els.btnSettings.addEventListener('click', () => {
    els.settingsPanel.classList.toggle('hidden');
  });
  // Direction toggle: Match ____ to Word / Match Word to ____
  let directionState = 'toWord'; // 'toWord' or 'toAnswer'
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
    directionState = directionState === 'toWord' ? 'toAnswer' : 'toWord';
    updateDirectionLabel();
  });
  // Initialize label
  updateDirectionLabel();
}

function wireImportExport() {
  els.btnExportAll.addEventListener('click', () => {
    downloadJSON('vocab_machine_export.json', { version: 1, lists: state.lists });
  });
  els.importFile.addEventListener('change', () => {
  els.btnImport.disabled = !(els.importFile.files && els.importFile.files.length);
  });
  els.btnImport.addEventListener('click', async () => {
  const file = (els.importFile.files && els.importFile.files[0]); if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.lists)) throw new Error('Invalid format');
      // Merge by list name; add if new
      data.lists.forEach(importList => {
        const existing = state.lists.find(l => l.name === importList.name);
  const clone = { ...importList, id: (existing ? existing.id : crypto.randomUUID()) };
        if (existing) Object.assign(existing, clone);
        else state.lists.push(clone);
      });
      save();
      render();
      alert('Import complete.');
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  });

  // OCR text import
  els.importOcr.addEventListener('change', () => {
  els.btnImportOcr.disabled = !(els.importOcr.files && els.importOcr.files.length);
  });
  els.btnImportOcr.addEventListener('click', async () => {
    const files = Array.from(els.importOcr.files || []);
    if (!files.length) return;
    const newLists = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const words = parseOcrList(text);
        const name = file.name.replace(/\.[^.]+$/, '');
        newLists.push({ id: crypto.randomUUID(), name, words, stats: {} });
      } catch (e) {
        console.error('Failed to parse', file.name, e);
        alert(`Failed to parse ${file.name}: ${e.message}`);
      }
    }
    // Merge by list name
    newLists.forEach(nl => {
      const existing = state.lists.find(l => l.name === nl.name);
      if (existing) Object.assign(existing, nl, { id: existing.id });
      else state.lists.push(nl);
    });
    save();
    render();
    alert('Text lists imported.');
  });

  // Built-in lists re-import
  if (els.btnBuiltinsMerge) els.btnBuiltinsMerge.addEventListener('click', async () => {
    await loadBuiltInLists('merge', true);
    alert('Built-in lists merged (missing lists added).');
  });
  if (els.btnBuiltinsOverwrite) els.btnBuiltinsOverwrite.addEventListener('click', async () => {
    const ok = await appConfirm('Overwrite Built-ins', 'Overwrite built-in lists? This resets their words & stats. Continue?');
    if (!ok) return;
    await loadBuiltInLists('overwrite', true);
    alert('Built-in lists overwritten.');
  });
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
  state.lists
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
  return words.map(w => `<div class="word-line">${escapeHtml(w.word)}</div>`).join('');
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
  els.feedback.innerHTML = '';
  state.awaitingContinue = false;
  nextQuestion(true);
  renderProgress();
}

function endSession() {
  if (!state.session) return;
  state.session = null;
  els.session.classList.add('hidden');
}

function nextQuestion(initial = false) {
  if (!state.session) return;
  const q = state.session.next();
  renderQuestion(q);
  if (!initial) els.feedback.innerHTML = '';
}

function nextQuestionSoon(correct) {
  setTimeout(() => nextQuestion(), correct ? 300 : 600);
}

function renderQuestion(q) {
  els.prompt.innerHTML = q.promptHtml;
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
  } else {
    const expected = escapeHtml(result.expected);
    const your = escapeHtml(result.your || '(no answer)');
    let extra = '';
    if (result.mode && (result.mode.startsWith('synonym') || result.mode.startsWith('antonym'))) {
      if (result.wordDefinition) {
        extra = `<br/><small>Definition of ${escapeHtml(result.word)}: ${escapeHtml(result.wordDefinition)}</small>`;
      }
    }
    els.feedback.innerHTML = `<div class="incorrect">Incorrect. Expected: ${expected}<br/>Your answer: ${your}${extra}</div>`;
  }
}

function showContinueButton(onContinue) {
  // Render a Continue button below feedback; disable form inputs
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Continue';
  btn.className = 'primary';
  // Prevent selecting new MC options until continue
  $all('input', els.answerInputArea).forEach(i => i.disabled = true);
  if (els.btnShowAnswer && els.btnShowAnswer.classList) {
    els.btnShowAnswer.classList.add('hidden');
  }
  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '8px';
  wrapper.appendChild(btn);
  els.feedback.appendChild(wrapper);
  btn.addEventListener('click', () => {
    // Clean up and proceed
    wrapper.remove();
    if (typeof onContinue === 'function') onContinue();
  });
}

function renderProgress() {
  if (!state.session) return;
  const { answered, total, infinite } = state.session.progress();
  els.progressText.textContent = infinite ? `${answered} / ∞` : `${answered} / ${total}`;
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
}

function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function currentContentType() {
  const active = els.contentTabs.find(t => t.classList.contains('active'));
  return (active && active.dataset && active.dataset.content) ? active.dataset.content : 'spelling';
}
function currentDirection() {
  // read from label text to stay in sync with UI logic
  // But we tracked state internally, so infer based on label text
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

// --- OCR text parsing ---
function parseOcrList(text) {
  // Strategy: Split into entries by numbering patterns like "1." at line start.
  // For each entry, extract headword (first line after number), then find definition, synonyms, antonyms, and example.
  const norm = text.replace(/\r/g, '');
  const blocks = norm.split(/\n\s*(?:\d+)\.\s+/g).filter(Boolean);
  // If the text sometimes starts before first number, handle alt split
  if (blocks.length <= 1) {
    // fallback: split on lines starting with a word and IPA line following; still attempt minimal
    return minimalParse(norm);
  }
  const words = [];
  for (const raw of blocks) {
    const entry = raw.trim();
    const lines = entry.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) continue;
    // Headword often in first line; strip punctuation
    let word = lines[0].replace(/[^A-Za-z\-']/g, '').toLowerCase();
    // Fix common OCR mistakes
    word = fixOcrWord(word);

    const joined = entry;
    const definition = extractDefinition(joined);
    const synonyms = extractList(joined, /\bSYNONYMS?\s*:\s*([^\n]+)/i);
    const antonyms = extractList(joined, /\bANTONYMS?\s*:\s*([^\n]+)/i);
    const example = extractExample(joined);

    if (!word) continue;
    words.push({ word, definition, example, synonyms, antonyms });
  }
  return words;
}

function extractDefinition(text) {
  // Heuristic: after (adj.)/(n.)/(v.) .... until next SYNONYMS/ANTONYMS or blank line with numbered next entry
  const m = text.match(/\((?:adj|adv|n|v|pron|prep|conj|interj)\.[^)]*\)\s*([^\n][\s\S]*?)(?:\n\s*SYNONYMS?:|\n\s*ANTONYMS?:|\n?\s*$)/i);
  if (m) {
    return cleanLine(m[1]);
  }
  // Fallback: first sentence-like chunk
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (/SYNONYMS?:|ANTONYMS?:/i.test(line)) break;
    if (/[.;]$/.test(line) || line.split(' ').length > 4) return cleanLine(line);
  }
  return '';
}

function extractList(text, regex) {
  const m = text.match(regex);
  if (!m) return [];
  return m[1]
    .replace(/\([^)]*\)/g, '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(fixOcrWord);
}

function extractExample(text) {
  // Heuristic: Look for lines that begin with capital and end with period near definition area and not containing SYN/ANTONYMS labels.
  const lines = text.split(/\n+/).map(s => s.trim());
  for (const line of lines) {
    if (/SYNONYMS?:|ANTONYMS?:/i.test(line)) continue;
    if (/^[A-Z][^\n]*\.$/.test(line) && line.split(' ').length > 4) return line;
  }
  return '';
}

function cleanLine(s) {
  return s.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
}

function minimalParse(text) {
  // fallback: just pick capitalized words as entries
  const words = [];
  const headwords = Array.from(text.matchAll(/\n\s*(?:\d+\.)?\s*([A-Za-z][A-Za-z\-']{2,})\s*\n/g)).map(m => m[1]);
  const uniq = Array.from(new Set(headwords.map(w => fixOcrWord(w.toLowerCase()))));
  return uniq.map(word => ({ word, definition: '', example: '', synonyms: [], antonyms: [] }));
}

function fixOcrWord(w) {
  const map = new Map([
    ['encomlum','encomium'],
    ['insatlable','insatiable'],
    ['reconnaissance'.toLowerCase(),'reconnaissance'],
    ['tallsman','talisman'],
    ['pecunlary','pecuniary'],
  ]);
  if (map.has(w)) return map.get(w);
  // common OCR char swaps
  return w.replace(/0/g,'o').replace(/1/g,'l');
}

document.addEventListener('DOMContentLoaded', init);
