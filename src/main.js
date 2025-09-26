import { Storage } from './storage.js';
import { sampleData } from './sample.js';
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
  render();
}

function cacheEls() {
  els.tabs = $all('.tab');
  els.panels = $all('.panel');
  // Lists panel
  els.listSearch = $('#list-search');
  els.listsUl = $('#lists');
  els.btnNewList = $('#btn-new-list');
  els.btnDuplicateList = $('#btn-duplicate-list');
  els.btnDeleteList = $('#btn-delete-list');
  els.listName = $('#list-name');
  els.btnSaveList = $('#btn-save-list');
  els.btnClearWords = $('#btn-clear-words');
  els.btnLoadSample = $('#btn-load-sample');
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
  els.btnNewList.addEventListener('click', () => {
    const name = prompt('New list name:');
    if (!name) return;
    const id = crypto.randomUUID();
    state.lists.push({ id, name, words: [], stats: {} });
    state.activeListId = id;
    save();
    render();
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
    render();
  });

  els.btnDeleteList.addEventListener('click', () => {
    const list = activeList();
    if (!list) return;
    if (!confirm(`Delete list "${list.name}"?`)) return;
    state.lists = state.lists.filter(l => l.id !== list.id);
    if (state.activeListId === list.id) state.activeListId = state.lists[0]?.id || null;
    save();
    render();
  });

  els.btnSaveList.addEventListener('click', () => {
    const list = activeList();
    if (!list) return;
    list.name = els.listName.value.trim() || list.name;
    save();
    renderLists();
    renderStudyListChips();
  });

  els.btnClearWords.addEventListener('click', () => {
    const list = activeList();
    if (!list) return;
    if (!confirm('Remove all words from this list?')) return;
    list.words = [];
    save();
    renderWords();
  });

  els.btnLoadSample.addEventListener('click', () => {
    const list = activeList();
    if (!list) return;
    list.words = sampleData();
    save();
    renderWords();
  });

  els.btnAddWord.addEventListener('click', () => {
    const list = activeList(); if (!list) return;
    const w = collectWordFromForm();
    if (!w.word || !w.definition) {
      alert('Word and definition are required.');
      return;
    }
    const idx = list.words.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase());
    if (idx >= 0) list.words[idx] = w; else list.words.push(w);
    save();
    renderWords();
    clearWordForm();
  });

  els.btnResetWord.addEventListener('click', clearWordForm);

  els.wordSearch.addEventListener('input', renderWords);
  els.listSearch.addEventListener('input', renderLists);
  els.btnExportCurrent.addEventListener('click', () => {
    const list = activeList(); if (!list) return;
    downloadJSON(`${list.name}.json`, list);
  });
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
    els.btnImport.disabled = !els.importFile.files?.length;
  });
  els.btnImport.addEventListener('click', async () => {
    const file = els.importFile.files?.[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.lists)) throw new Error('Invalid format');
      // Merge by list name; add if new
      data.lists.forEach(importList => {
        const existing = state.lists.find(l => l.name === importList.name);
        const clone = { ...importList, id: existing?.id || crypto.randomUUID() };
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
    els.btnImportOcr.disabled = !els.importOcr.files?.length;
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
}

function load() {
  state.lists = Storage.loadLists();
  if (!state.lists.length) {
    // create initial list
    const id = crypto.randomUUID();
    state.lists.push({ id, name: 'My First List', words: [], stats: {} });
    state.activeListId = id;
    save();
  } else {
    state.activeListId = Storage.loadActiveListId() || state.lists[0]?.id || null;
  }
}

function save() {
  Storage.saveLists(state.lists);
  Storage.saveActiveListId(state.activeListId);
}

function render() {
  renderLists();
  renderListEditor();
  renderWords();
  renderStudyListChips();
}

function renderLists() {
  const filter = els.listSearch.value?.toLowerCase() || '';
  els.listsUl.innerHTML = '';
  state.lists
    .filter(l => l.name.toLowerCase().includes(filter))
    .forEach(list => {
      const li = document.createElement('li');
      li.className = list.id === state.activeListId ? 'active' : '';
      li.innerHTML = `<div><strong>${escapeHtml(list.name)}</strong><br/><small>${list.words.length} words</small></div><div></div>`;
      li.addEventListener('click', () => {
        state.activeListId = list.id;
        save();
        render();
      });
      els.listsUl.appendChild(li);
    });
}

function renderListEditor() {
  const list = activeList();
  els.listName.value = list?.name || '';
}

function renderWords() {
  const list = activeList();
  const filter = els.wordSearch.value?.toLowerCase() || '';
  els.wordsTbody.innerHTML = '';
  if (!list) return;
  list.words
    .filter(w => w.word.toLowerCase().includes(filter) || w.definition.toLowerCase().includes(filter))
    .forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(w.word)}</strong><br/><small>${escapeHtml(w.example || '')}</small></td>
        <td>${escapeHtml(w.definition)}</td>
        <td>${escapeHtml(w.synonyms?.join(', ') || '')}</td>
        <td>${escapeHtml(w.antonyms?.join(', ') || '')}</td>
        <td>
          <button data-act="edit">Edit</button>
          <button data-act="remove" class="danger">Remove</button>
        </td>
      `;
      tr.querySelector('[data-act="edit"]').addEventListener('click', () => fillWordForm(w));
      tr.querySelector('[data-act="remove"]').addEventListener('click', () => {
        const idx = list.words.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase());
        if (idx >= 0 && confirm(`Remove "${w.word}"?`)) {
          list.words.splice(idx, 1);
          save();
          renderWords();
        }
      });
      els.wordsTbody.appendChild(tr);
    });
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
    synAntPrompt: els.synAntPrompt?.value || 'random', // random | all
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
  els.btnShowAnswer?.classList?.remove?.('hidden');
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
  els.btnShowAnswer?.classList?.add?.('hidden');
  const wrapper = document.createElement('div');
  wrapper.style.marginTop = '8px';
  wrapper.appendChild(btn);
  els.feedback.appendChild(wrapper);
  btn.addEventListener('click', () => {
    // Clean up and proceed
    wrapper.remove();
    onContinue?.();
  });
}

function renderProgress() {
  if (!state.session) return;
  const { answered, total, infinite } = state.session.progress();
  els.progressText.textContent = infinite ? `${answered} / ∞` : `${answered} / ${total}`;
}

function renderSessionSummary() {
  if (!state.session) return;
  const summary = state.session.summary?.() || { attempts: 0, correct: 0, accuracy: 0 };
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
  return active?.dataset.content || 'spelling';
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
    alert('Export failed: ' + (e?.message || e));
  }
}
function sanitizeFileName(name) {
  return String(name).replace(/[\\\/:*?"<>|]+/g, '_').trim() || 'download.json';
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
