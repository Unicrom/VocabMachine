import React, { useState, useEffect, useCallback } from 'react';
import { Storage } from '../storage.js';
import { StudyEngine } from '../studyEngine.js';
import { FEEDBACK_TEMPLATES, escapeHtml, createFeedbackData, replacePlaceholders, shouldShowFeedbackLine } from '../feedbackTemplates.js';
import { normalizeWord, downloadJSON } from '../utils.js';
// Extracted components
import { Dialog } from './common/Dialog.jsx';
import { WordModal } from './words/WordModal.jsx';
import { ListCards } from './lists/ListCards.jsx';
import { WordsTable } from './words/WordsTable.jsx';
import { StudyPanel } from './study/StudyPanel.jsx';

// Utility
const uuid = () => crypto.randomUUID();

// Utility functions now imported from utils.js

// ---------- Main App ----------
export default function App() {
  const [lists, setLists] = useState(()=> Storage.loadLists());
  const [activeListId, setActiveListId] = useState(null);
  const [activeTab, setActiveTab] = useState('lists');
  const [listSearch, setListSearch] = useState('');
  const [wordSearch, setWordSearch] = useState('');
  // Lists now always sorted alphabetically by name; removed listSortMode toggle
  const [dialog, setDialog] = useState(null);
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [wordEditing, setWordEditing] = useState(null);
  const [selectedListIds, setSelectedListIds] = useState(()=> lists.map(l=>l.id));
  const [content, setContent] = useState('spelling');
  const [direction, setDirection] = useState('toWord');
  const [sessionMode, setSessionMode] = useState('normal');
  const [synAntPrompt, setSynAntPrompt] = useState('random');
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [feedbackHtml, setFeedbackHtml] = useState('');
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({ attempts:0, correct:0, accuracy: '0' });
  const [startSettings, setStartSettings] = useState(null);
  const [mcSelection, setMcSelection] = useState(-1);
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [correctMcIndex, setCorrectMcIndex] = useState(-1); // highlight correct MC choice on incorrect answer
  const [lockedAnswer, setLockedAnswer] = useState(false);   // prevents changing answer after submission until next question

  // Persist lists & activeList
  useEffect(()=> { Storage.saveLists(lists); }, [lists]);
  useEffect(()=> { Storage.saveActiveListId(null); }, []);

  // Built-in lists merge
  useEffect(()=> { (async()=> { try { const r = await fetch('default_vocab_lists.json', {cache:'no-store'}); if(!r.ok) return; const data = await r.json(); if(!data?.lists) return; setLists(prev => {
    const nameMap = new Map(prev.map(l=>[l.name,l])); let changed=false; const merged=[...prev];
    for (const src of data.lists) { const ex = nameMap.get(src.name); if(!ex) { merged.push({ id: uuid(), name: src.name, words: src.words||[], stats:{} }); changed=true; } }
    return changed? merged: prev; }); } catch(e) { /* silent */ } })(); }, []);

  const activeList = activeListId ? lists.find(l => l.id === activeListId) || null : null;

  // Settings capture & change detection
  const captureSettings = () => ({ listIds: selectedListIds.slice().sort(), content, direction, sessionMode, synAntPrompt });
  const settingsChanged = session && startSettings && JSON.stringify(captureSettings()) !== JSON.stringify(startSettings);

  // Word CRUD
  const openWordModal = (word=null) => { if(word){ setWordEditing(word); } else setWordEditing(null); setWordModalOpen(true); };
  const closeWordModal = () => { setWordModalOpen(false); };
  const saveWord = (newWord, originalWord) => {
    setLists(ls => ls.map(l => l.id===activeListId ? { ...l, words: (function(){
      const words = [...l.words];
      if (originalWord) { const idx = words.findIndex(w => w.word.toLowerCase() === originalWord.toLowerCase()); if (idx>=0) words[idx]=newWord; else words.push(newWord); }
      else words.push(newWord); return words; })() } : l));
    closeWordModal();
  };
  const deleteWord = (word) => { setLists(ls => ls.map(l => l.id===activeListId ? { ...l, words: l.words.filter(w => w.word !== word) }: l)); closeWordModal(); };

  // Dialog helpers
  const appPrompt = (title, message, def='') => new Promise(res=> setDialog({ title, body:`<p>${message}</p>`, mode:'prompt', value:def, resolve:res }));
  const appConfirm = (title, message) => new Promise(res=> setDialog({ title, body:`<p>${message}</p>`, mode:'confirm', resolve:res }));
  const handleDialogClose = (val) => { if(dialog){ dialog.resolve(val); } setDialog(null); };

  // List actions
  const createList = async () => { const name = await appPrompt('New list','Enter a name for the new list:'); if(!name) return; const id=uuid(); setLists(l=> [...l,{id,name,words:[],stats:{}}]); setActiveListId(id); setSelectedListIds(ids=> [...new Set([...ids,id])]); };
  const duplicateList = (id) => { setLists(ls => { const src = ls.find(l=>l.id===id); if(!src) return ls; const clone = JSON.parse(JSON.stringify(src)); clone.id=uuid(); clone.name = `${clone.name} (copy)`; return [...ls, clone]; }); };
  const deleteList = async (id) => { const list = lists.find(l=>l.id===id); if(!list) return; const ok = await appConfirm('Delete List', `Delete list "${escapeHtml(list.name)}"? This cannot be undone.`); if(!ok) return; setLists(ls => ls.filter(l=>l.id!==id)); if (activeListId===id) setActiveListId(p=> (lists.filter(l=>l.id!==id)[0]?.id||null)); setSelectedListIds(ids=> ids.filter(x=>x!==id)); };
  const exportList = (id) => { const list = lists.find(l=>l.id===id); if(list) downloadJSON(`${list.name}.json`, list); };

  // Import
  const handleImport = async (files) => { const file = files?.[0]; if(!file) return; try { const text = await file.text(); const data = JSON.parse(text); let incoming=[]; if(Array.isArray(data?.lists)) incoming=data.lists; else if(Array.isArray(data)) incoming=data; else if (data && data.name && Array.isArray(data.words)) incoming=[data]; if(!incoming.length) { alert('Invalid JSON'); return; } setLists(prev => { const nameMap=new Map(prev.map(l=>[l.name,l])); const updated=[...prev]; let addedWords=0; incoming.forEach(src=> { if(!src?.name || !Array.isArray(src.words)) return; const cleaned = src.words.filter(w=> w && w.word && w.definition).map(w=> normalizeWord(w)); const existing = nameMap.get(src.name); if(existing){ const existingWords = new Set(existing.words.map(w=>w.word.toLowerCase())); cleaned.forEach(w=> { if(!existingWords.has(w.word.toLowerCase())) { existing.words.push(w); addedWords++; } }); } else { updated.push({ id: uuid(), name: src.name, words: cleaned, stats:{} }); addedWords+=cleaned.length; } }); return updated; }); } catch(e){ alert('Import failed: '+(e?.message||e)); } };

  // Study helpers for feedback lookups
  const lookupDefinition = (wordPlain) => { if(!wordPlain) return ''; const lw=wordPlain.trim().toLowerCase(); for(const l of lists){ const f=l.words.find(w=> (w.word||'').toLowerCase()===lw); if(f) return f.definition||''; } return ''; };
  const getWordData = (wordPlain) => { if(!wordPlain) return null; const lw=wordPlain.trim().toLowerCase(); for(const l of lists){ const f=l.words.find(w=> (w.word||'').toLowerCase()===lw); if(f) return f; } return null; };
  const findWordByDefinition = (definition) => { if(!definition) return null; const d=definition.trim().toLowerCase(); for(const l of lists){ const f=l.words.find(w=> (w.definition||'').toLowerCase()===d); if(f) return f.word; } return null; };
  const findWordBySynonym = (syn) => { if(!syn) return null; const s=syn.trim().toLowerCase(); for(const l of lists){ const f=l.words.find(w=> Array.isArray(w.synonyms) && w.synonyms.some(x=> x.toLowerCase()===s)); if(f) return f.word; } return null; };
  const findWordByAntonym = (ant) => { if(!ant) return null; const a=ant.trim().toLowerCase(); for(const l of lists){ const f=l.words.find(w=> Array.isArray(w.antonyms) && w.antonyms.some(x=> x.toLowerCase()===a)); if(f) return f.word; } return null; };

  // Session
  const startSession = () => {
    const chosenLists = lists.filter(l => selectedListIds.includes(l.id));
    const pool = chosenLists.flatMap(l => l.words.map(w => ({...w, __listId: l.id })));
    if(!pool.length){ alert('Select at least one list with words.'); return; }
    const options = { content, direction: content==='spelling'? 'toWord': direction, sessionMode, synAntPrompt };
    const eng = new StudyEngine(pool, options, lists);
    setSession(eng);
    setCurrentQuestion(eng.next());
    setFeedbackHtml('');
    setAwaitingContinue(false);
    setStreak(0);
    setStats({ attempts:0, correct:0, accuracy:'0' });
    setStartSettings(captureSettings());
  };
  const endSession = () => { setSession(null); setCurrentQuestion(null); setStartSettings(null); setFeedbackHtml(''); setAwaitingContinue(false); setStreak(0); setStats({attempts:0,correct:0,accuracy:'0'}); };
  const endOrRestartSession = () => { if(settingsChanged){ endSession(); startSession(); } else endSession(); };

  const updateStats = (engine) => { if(!engine){ setStats({attempts:0,correct:0,accuracy:'0'}); return; } const s=engine.summary(); setStats({ attempts: s.attempts, correct: s.correct, accuracy: (s.accuracy*100).toFixed(0) }); };

  const nextQuestion = useCallback((initial=false, clearFeedback=true)=> {
    if(!session) return;
    const q = session.next();
    if(!q || q.type==='done'){ // summary
      const s = session.summary();
      setFeedbackHtml(`<div><strong>Session complete.</strong><br/>Attempts: ${s.attempts} • Correct: ${s.correct} • Accuracy: ${(s.accuracy*100).toFixed(0)}%</div>`);
      updateStats(session);
      setSession(s2=>s2);
      return;
    }
    // Reset per-question UI state
    setLockedAnswer(false);
    setCorrectMcIndex(-1);
    setMcSelection(-1);
    setCurrentQuestion(q);
    if(!initial && clearFeedback) setFeedbackHtml('');
  }, [session]);

  // Answer submission
  const submitAnswer = (e) => {
    e.preventDefault(); if(!session || awaitingContinue || lockedAnswer) return;
    const formData = new FormData(e.target); const text = formData.get('text');
    const answerObj = currentQuestion?.type==='input'? { kind:'text', value: (text||'').toString().trim() } : { kind:'mc', value: mcSelection };
    const result = session.submit(answerObj);
    handleResult(result);
  };

  const handleResult = (result) => {
    updateStats(session);
    if(result.done){ handleSessionComplete(); return; }
    setLockedAnswer(true);
    if(result.correct){ setFeedbackHtml('<div class="correct">Correct!</div>'); setStreak(s=> s+1); // auto advance
      setTimeout(()=> { nextQuestion(false,true); }, 500);
    } else {
      setStreak(0);
      const wordData = getWordData(result.word);
      const expected = escapeHtml(result.expected);
      const your = escapeHtml(result.your || '(no answer)');
      let fbHtml = generateFeedback(result, wordData, expected, your);
      setFeedbackHtml(`<div class="incorrect">${fbHtml||'Incorrect.'}</div>`);
      setAwaitingContinue(true);
      // For MC, compute correct index for highlighting
      if(currentQuestion?.type==='mc') {
        const idx = (currentQuestion.choices||[]).findIndex(c=> c===result.expected);
        if(idx!==-1) setCorrectMcIndex(idx);
      }
    }
  };

  const handleSessionComplete = () => {
    const s = session.summary();
    setFeedbackHtml(`<div><strong>Session complete.</strong><br/>Attempts: ${s.attempts} • Correct: ${s.correct} • Accuracy: ${(s.accuracy*100).toFixed(0)}%</div>`);
  };

  const generateFeedback = (result, wordData, expected, your) => {
    if(!result.mode || !wordData) return 'Incorrect.';
    const template = FEEDBACK_TEMPLATES[result.mode];
    if(!template) return `<div class="extra-def correct"><strong>Correct answer:</strong> ${expected}</div>`;
    const data = createFeedbackData(result, wordData, expected, your, { getWordData, lookupDefinition, findWordByDefinition, findWordBySynonym, findWordByAntonym });
    const parts = [];
    template.forEach(line => { if(!shouldShowFeedbackLine(line, data)) return; const txt = replacePlaceholders(line.text, data); const colon = txt.indexOf(':'); const formatted = colon!==-1? `<strong>${txt.slice(0,colon+1)}</strong>${txt.slice(colon+1)}`: `<strong>${txt}</strong>`; parts.push(`<div class="extra-def ${line.class||'neutral'}">${formatted}</div>`); });
    return parts.join('');
  };

  const showAnswer = () => { if(!session) return; const ans = session.currentAnswer(); setFeedbackHtml(`<div class="incorrect">Answer: ${escapeHtml(ans.expected)}</div>`); };
  const selectMcChoice = (i) => { if(lockedAnswer || awaitingContinue) return; setMcSelection(i); };

  // Continue (when incorrect)
  // Awaiting continue now handled inline in QuestionForm (button replaces submit)
  useEffect(()=> {}, [awaitingContinue]);

  // Auto direction lock for spelling
  useEffect(()=> { if(content==='spelling') setDirection('toWord'); }, [content]);

  // Handle inline Continue button custom event
  useEffect(()=> {
    const handler = () => {
      if(!awaitingContinue || !session) return;
      setAwaitingContinue(false);
      nextQuestion(false,true);
    };
    window.addEventListener('vocab-continue-click', handler);
    return ()=> window.removeEventListener('vocab-continue-click', handler);
  }, [awaitingContinue, session, nextQuestion]);

  const toggleDirection = () => { if(content==='spelling') return; setDirection(d=> d==='toWord'?'toAnswer':'toWord'); };
  const toggleListSelection = (id) => { setSelectedListIds(ids=> ids.includes(id)? ids.filter(x=>x!==id): [...ids,id]); };
  const toggleConfigCollapse = () => { setConfigCollapsed(c=> !c); document.body.classList.toggle('study-config-collapsed'); };

  // Tab body class for styling parity
  useEffect(()=> { if(activeTab==='study') document.body.classList.add('in-study'); else document.body.classList.remove('in-study'); }, [activeTab]);

  // Track test progress percent
  const progress = session? session.progress(): { answered:0, total:0, infinite:true };
  const testModeActive = session && sessionMode==='test';
  const testProgressPct = testModeActive && progress.total ? Math.min(100, (progress.answered/progress.total)*100): 0;

  const answerInputType = currentQuestion?.type==='mc'? 'mc':'input';
  const mcChoices = currentQuestion?.choices || [];

  return (
    <>
      <header className="app-header">
        <h1>Vocab Machine</h1>
        <nav className="tabs" role="tablist" aria-label="Primary">
          <button className={`tab ${activeTab==='lists'? 'active':''}`} data-tab="lists" role="tab" aria-selected={activeTab==='lists'} onClick={()=> setActiveTab('lists')}>Lists</button>
          <button className={`tab ${activeTab==='study'? 'active':''}`} data-tab="study" role="tab" aria-selected={activeTab==='study'} onClick={()=> setActiveTab('study')}>Study</button>
        </nav>
      </header>
      <main>
        <section id="panel-lists" className={activeTab==='lists'? 'panel active':'panel'} role="tabpanel" aria-labelledby="Lists">
          <div id="lists-overview" className={activeListId? 'lists-overview hidden':'lists-overview'}>
            <div className="panel-header lists-bar">
              <input id="list-search" className="full-search" type="search" placeholder="Search lists & words…" value={listSearch} onChange={e=> setListSearch(e.target.value)} />
              <div className="lists-bar-actions" style={{display:'flex', gap:8}}>
                {/* Sorting toggle removed: always A→Z */}
                <button id="btn-new-list" className="primary icon-btn" aria-label="New List" title="New List" onClick={createList}><svg className="icon"><use href="#icon-add"/></svg></button>
                <input id="import-file" type="file" accept="application/json" style={{display:'none'}} onChange={e=> { handleImport(e.target.files); e.target.value=''; }} />
                <button id="btn-import" className="icon-btn" aria-label="Import Lists (JSON)" title="Import Lists (JSON)" onClick={()=> document.getElementById('import-file').click()}><svg className="icon"><use href="#icon-upload"/></svg></button>
              </div>
            </div>
            <ListCards lists={lists} filter={listSearch} onOpen={(id)=> setActiveListId(id)} onDuplicate={duplicateList} onExport={exportList} onDelete={deleteList} />
          </div>
          {activeList && (
            <div id="list-detail" className={activeList? 'list-detail': 'list-detail hidden'}>
              <div className="detail-header">
                <div className="left">
                  <button id="btn-back-lists" className="icon-btn" aria-label="Back to Lists" title="Back to Lists" onClick={()=> setActiveListId(null)}><svg className="icon"><use href="#icon-close"/></svg></button>
                  <input id="detail-title" type="text" className="title-input" placeholder="List name" value={activeList.name} onChange={e=> setLists(ls=> ls.map(l=> l.id===activeList.id? {...l, name:e.target.value}:l))} onBlur={()=> setLists(ls=> [...ls])} />
                </div>
                <div className="detail-actions">
                  <button id="btn-duplicate-list" className="icon-btn" aria-label="Duplicate List" title="Duplicate List" onClick={()=> duplicateList(activeList.id)}><svg className="icon"><use href="#icon-copy"/></svg></button>
                  <button id="btn-delete-list" className="danger icon-btn" aria-label="Delete List" title="Delete List" onClick={()=> deleteList(activeList.id)}><svg className="icon"><use href="#icon-trash"/></svg></button>
                  <button id="btn-export-current" className="icon-btn" aria-label="Export This List" title="Export This List" onClick={()=> exportList(activeList.id)}><svg className="icon"><use href="#icon-download"/></svg></button>
                </div>
              </div>
              <div className="list-detail-body">
                <div className="list-meta-inline bare">
                  <input id="word-search" type="search" placeholder="Search words…" value={wordSearch} onChange={e=> setWordSearch(e.target.value)} />
                  <button id="btn-new-word" className="primary icon-btn" aria-label="Add New Word" title="Add New Word" onClick={()=> openWordModal()}><svg className="icon"><use href="#icon-add"/></svg></button>
                </div>
                <div className="words-table">
                  <WordsTable list={activeList} filter={wordSearch} onEdit={(w)=> openWordModal(activeList.words.find(x=>x.word===w))} onDuplicate={(w)=> setLists(ls=> ls.map(l=> l.id===activeList.id? {...l, words:[...l.words, {...l.words.find(x=>x.word===w), word: `${w} (copy)`}]}:l))} onDelete={(w)=> deleteWord(w)} />
                </div>
              </div>
            </div>
          )}
        </section>
  <StudyPanel lists={lists} sessionState={{ activeTab, session, awaitingContinue, feedbackHtml, stats, streak, currentQuestion, answerInputType, mcChoices, showAnswerBtnVisible: !!session && !awaitingContinue && !lockedAnswer, testProgressPct, testModeActive, content, direction, sessionMode, synAntPrompt, selectedListIds, settingsChanged, configCollapsed, correctMcIndex, mcSelection, lockedAnswer }} actions={{ submitAnswer, showAnswer, selectMcChoice, setContent, toggleDirection, setSessionMode, setSynAntPrompt, toggleListSelection, startSession, endOrRestartSession, toggleConfigCollapse }} />
      </main>
      <footer className="app-footer"><small>Made for personal study • Data stays on this device</small></footer>
      <WordModal open={wordModalOpen} wordEditing={wordEditing} onSave={saveWord} onDelete={deleteWord} onClose={closeWordModal} />
      <Dialog dialog={dialog} onClose={handleDialogClose} />
    </>
  );
}
