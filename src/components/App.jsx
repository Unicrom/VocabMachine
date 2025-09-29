import React, { useState, useEffect, useCallback } from 'react';
// Import original storage (vanilla) for persistence parity
import { Storage } from '../storage.js';
import { StudyEngine } from '../studyEngine.js';
import { FEEDBACK_TEMPLATES, escapeHtml, createFeedbackData, replacePlaceholders, shouldShowFeedbackLine } from '../feedbackTemplates.js';

// Utility
const uuid = () => crypto.randomUUID();

// ---------- Data helpers (mirroring original) ----------
function normalizeWord(w) {
  return {
    word: w.word || '',
    example: w.example || '',
    definition: w.definition || '',
    synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
    antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
  };
}

function sanitizeFileName(name) { return String(name).replace(/[\\/:*?"<>|]+/g,'_').trim() || 'download.json'; }
function downloadJSON(filename, data) {
  try {
    const safe = sanitizeFileName(filename || 'data.json');
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = safe; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
  } catch (e) { alert('Export failed: '+ (e?.message||e)); }
}

// ---------- Dialog Component ----------
function Dialog({ dialog, onClose }) {
  if (!dialog) return null;
  const { title, body, mode, placeholder, value } = dialog;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-hidden={false} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(null); }}>
      <div className="modal small">
        <div className="modal-header">
          <h3>{title||'Dialog'}</h3>
          <button className="icon-btn" onClick={()=>onClose(null)} aria-label="Close dialog"><svg className="icon"><use href="#icon-close"/></svg></button>
        </div>
        <div className="modal-body" dangerouslySetInnerHTML={{__html: body||''}} />
        <form className="modal-form" onSubmit={(e)=>{e.preventDefault(); if(mode==='prompt') onClose(value||''); else onClose(true);}}>
          {mode==='prompt' && (
            <div className="dialog-input-wrap">
              <input autoFocus type="text" defaultValue={value||''} placeholder={placeholder||''} onKeyDown={(e)=>{ if(e.key==='Escape'){ e.preventDefault(); onClose(null);} }} onChange={ev=> dialog.value = ev.target.value } />
            </div>
          )}
          <div className="modal-footer" style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
            <button type="button" className="icon-btn" onClick={()=>onClose(mode==='prompt'? null: false)}>Cancel</button>
            <button type="submit" className="primary">OK</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Word Modal ----------
function WordModal({ open, wordEditing, onSave, onDelete, onClose }) {
  const isEdit = !!wordEditing;
  const [form, setForm] = useState(()=> normalizeWord(wordEditing||{}));
  useEffect(()=>{ setForm(normalizeWord(wordEditing||{})); }, [wordEditing]);
  if (!open) return null;
  const update = (k,v)=> setForm(f=> ({...f,[k]:v}));
  return (
    <div className="modal-overlay" aria-modal="true" role="dialog" aria-hidden={false} onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal" data-mode={isEdit? 'edit':'new'}>
        <div className="modal-header">
          <h3>{isEdit? 'Edit Word':'Add Word'}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><svg className="icon"><use href="#icon-close"/></svg></button>
        </div>
        <form onSubmit={(e)=>{e.preventDefault(); if(!form.word || !form.definition) { alert('Word and definition are required.'); return;} onSave(normalizeWord(form), wordEditing?.word); }}>
          <div className="grid-2">
            <label>Word
              <input value={form.word} onChange={e=>update('word', e.target.value)} />
            </label>
            <label>Example sentence (optional)
              <input value={form.example} onChange={e=>update('example', e.target.value)} />
            </label>
          </div>
          <label>Definition
            <textarea rows={3} value={form.definition} onChange={e=>update('definition', e.target.value)} />
          </label>
            <div className="grid-2">
              <label>Synonyms (comma-separated)
                <input value={form.synonyms.join(', ')} onChange={e=>update('synonyms', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
              </label>
              <label>Antonyms (comma-separated)
                <input value={form.antonyms.join(', ')} onChange={e=>update('antonyms', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
              </label>
            </div>
          <div className="modal-footer form-actions">
            <button type="submit" className="primary icon-btn" aria-label="Save Word" title="Save Word"><svg className="icon"><use href="#icon-check"/></svg></button>
            <button type="button" className="icon-btn" onClick={()=>setForm(normalizeWord(wordEditing||{}))} aria-label="Reset" title="Reset"><svg className="icon"><use href="#icon-refresh"/></svg></button>
            {isEdit && <button type="button" className="danger icon-btn" onClick={()=> onDelete(wordEditing.word)} aria-label="Delete Word" title="Delete Word"><svg className="icon"><use href="#icon-trash"/></svg></button>}
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- List Cards Overview ----------
function ListCards({ lists, filter, sortMode, onOpen, onDuplicate, onExport, onDelete }) {
  const lower = filter.toLowerCase();
  let working = lists.slice();
  if (sortMode === 'alpha') {
    working.sort((a,b)=> a.name.localeCompare(b.name, undefined,{sensitivity:'base'}));
  } // 'created' keeps insertion order
  const filtered = working.filter(l => {
    if (l.name.toLowerCase().includes(lower)) return true;
    if (!lower) return true;
    return l.words.some(w => w.word.toLowerCase().includes(lower) || (w.definition||'').toLowerCase().includes(lower));
  });
  function previewWords(words) {
    if (!words.length) return <em className="muted">(empty)</em>;
    const maxLines = 20;
    if (words.length <= maxLines) return words.map(w => <div key={w.word} className="word-line">{w.word}</div>);
    const first = words.slice(0,maxLines-1).map(w => <div key={w.word} className="word-line">{w.word}</div>);
    return [...first, <div key="more" className="word-line more-line">+ {words.length-(maxLines-1)} more</div>];
  }
  return (
    <div id="list-cards" className="list-cards" aria-live="polite">
      {filtered.map(list => (
        <div
          key={list.id}
          className="list-card"
          tabIndex={0}
          onClick={(e)=> {
            // Don't trigger open if clicking inside the <details> menu or its summary / buttons
            if (e.target.closest('details')) return;
            onOpen(list.id);
          }}
          onKeyDown={(e)=> {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(list.id); }
          }}
          role="button"
          aria-label={`Open list ${list.name}`}
        >
          <div className="list-card-head">
            <h3>{list.name}</h3>
            <div className="menu-wrap">
              <details>
                <summary className="icon-btn small menu-btn" aria-label="List actions" title="List actions"><svg className="icon"><use href="#icon-menu"/></svg></summary>
                <div className="menu" role="menu">
                  <button onClick={()=>onOpen(list.id)} role="menuitem">Open</button>
                  <button onClick={()=>onDuplicate(list.id)} role="menuitem">Duplicate</button>
                  <button onClick={()=>onExport(list.id)} role="menuitem">Export</button>
                  <button onClick={()=>onDelete(list.id)} className="danger" role="menuitem">Delete</button>
                </div>
              </details>
            </div>
          </div>
          <div className="list-card-meta">{list.words.length} words</div>
          <div className="list-card-words">{previewWords(list.words)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- Words Table ----------
function WordsTable({ list, filter, onEdit, onDuplicate, onDelete }) {
  if (!list) return null;
  const lower = filter.toLowerCase();
  const words = list.words.filter(w => w.word.toLowerCase().includes(lower) || (w.definition||'').toLowerCase().includes(lower));
  return (
    <table>
      <thead>
        <tr>
          <th style={{width:'18rem'}}>Word</th>
          <th>Definition</th>
          <th>Synonyms</th>
            <th>Antonyms</th>
          <th style={{width:'3rem'}}></th>
        </tr>
      </thead>
      <tbody>
        {words.map(w => (
          <tr key={w.word}>
            <td><strong>{w.word}</strong><br/><small>{w.example}</small></td>
            <td>{w.definition}</td>
            <td>{(w.synonyms||[]).join(', ')}</td>
            <td>{(w.antonyms||[]).join(', ')}</td>
            <td className="word-menu-cell">
              <details className="word-menu-wrap">
                <summary className="icon-btn small word-menu-btn" aria-label="Word actions" title="Word actions"><svg className="icon"><use href="#icon-menu"/></svg></summary>
                <div className="word-menu" role="menu">
                  <button role="menuitem" onClick={()=>onEdit(w.word)}>Edit</button>
                  <button role="menuitem" onClick={()=>onDuplicate(w.word)}>Duplicate</button>
                  <button role="menuitem" className="danger" onClick={()=>onDelete(w.word)}>Delete</button>
                </div>
              </details>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Study Panel ----------
function StudyPanel({ lists, sessionState, actions }) {
  const { session, awaitingContinue, feedbackHtml, stats, streak, currentQuestion, showAnswerBtnVisible, testProgressPct, testModeActive, configCollapsed } = sessionState;
  const { toggleConfigCollapse } = actions;
  return (
    <section id="panel-study" className={sessionState.activeTab==='study'? 'panel active':'panel'} role="tabpanel" aria-labelledby="Study">
      <div className="study-layout">
        <div className="study-session-wrap">
          <div className="session-top">
            <div id="progress-bar-wrap" className={`progress-bar ${testModeActive? '':'hidden'}`} aria-hidden={!testModeActive}>
              <div id="progress-bar-inner" className="inner" style={{width: `${testProgressPct}%`}}></div>
            </div>
            <div className="stat-chips">
              <div className="chip-stat"><span id="chip-attempts">{stats.attempts}</span><label>Attempts</label></div>
              <div className="chip-stat"><span id="chip-accuracy">{stats.accuracy}%</span><label>Accuracy</label></div>
              <div className="chip-stat"><span id="chip-streak">{streak}</span><label>Streak</label></div>
              <button id="toggle-setup" className="collapse-toggle" aria-label={configCollapsed? 'Show setup':'Hide setup'} title={configCollapsed? 'Show setup':'Hide setup'} onClick={toggleConfigCollapse}>
                <svg className={`icon collapse-icon-eye${configCollapsed? ' hidden':''}`}><use href="#icon-eye"/></svg>
                <svg className={`icon collapse-icon-eye-off${configCollapsed? '':' hidden'}`}><use href="#icon-eye-off"/></svg>
              </button>
            </div>
          </div>
          {!session && (
            <div id="session-placeholder" className="session-placeholder">
              <h3>Ready to study?</h3>
              <p>Select lists and press <strong>Start Session</strong> to begin. Your progress, accuracy and streak will appear here.</p>
            </div>
          )}
          {session && (
            <div id="session" className="session redesigned" aria-live="polite">
              <div id="prompt" className="prompt" dangerouslySetInnerHTML={{__html: currentQuestion?.promptHtml || ''}} />
              <QuestionForm sessionState={sessionState} actions={actions} />
              <div id="feedback" className="feedback" aria-live="polite" dangerouslySetInnerHTML={{__html: feedbackHtml}} />
            </div>
          )}
        </div>
        <StudyConfig lists={lists} sessionState={sessionState} actions={actions} />
      </div>
    </section>
  );
}

function QuestionForm({ sessionState, actions }) {
  const { answerInputType, mcChoices, showAnswerBtnVisible } = sessionState;
  const { submitAnswer, showAnswer, selectMcChoice } = actions;
  return (
    <form id="answer-form" className="answer-area" autoComplete="off" onSubmit={submitAnswer}>
      <div id="answer-input-area" className="answer-input-area">
        {answerInputType==='input' && <input name="text" type="text" autoFocus autoComplete="off" spellCheck={false} placeholder="Type your answer…" />}
        {answerInputType==='mc' && mcChoices.map((c,i)=>(
          <label key={i} className="mc-choice">
            <input type="radio" name="mc" value={i} onChange={()=> selectMcChoice(i)} />
            <span>{c}</span>
          </label>
        ))}
      </div>
      <div className="answer-actions">
        <button type="submit" className="primary icon-btn" aria-label="Submit Answer" title="Submit Answer"><svg className="icon"><use href="#icon-check"/></svg></button>
        {showAnswerBtnVisible && <button type="button" id="btn-show-answer" className="icon-btn" aria-label="Show Answer" title="Show Answer" onClick={showAnswer}><svg className="icon"><use href="#icon-eye"/></svg></button>}
      </div>
    </form>
  );
}

function StudyConfig({ lists, sessionState, actions }) {
  const { activeTab, content, direction, sessionMode, synAntPrompt, selectedListIds, session, settingsChanged, configCollapsed } = sessionState;
  const { setContent, toggleDirection, setSessionMode, setSynAntPrompt, toggleListSelection, startSession, endOrRestartSession } = actions;
  return (
    <aside className={`study-config ${configCollapsed? 'compact':''}`} id="study-config" style={{display: activeTab==='study'? undefined:'none'}}>
      <div className="config-block">
        <label className="config-label">Lists</label>
        <div className="list-chips selectable" id="study-list-chips" role="list">
          {lists.slice().sort((a,b)=> a.name.localeCompare(b.name, undefined,{sensitivity:'base'})).map(l => (
            <label key={l.id} className="chip" role="listitem">
              <input type="checkbox" checked={selectedListIds.includes(l.id)} onChange={()=> toggleListSelection(l.id)} />
              <span>{l.name} <small>({l.words.length})</small></span>
            </label>
          ))}
        </div>
      </div>
      <div className="config-block">
        <label className="config-label">Content Type</label>
        <div className="content-tabs modern" role="tablist" aria-label="Content Type">
          {['spelling','definition','synonym','antonym'].map(ct => (
            <button key={ct} className={`content-tab ${content===ct? 'active':''}`} role="tab" aria-selected={content===ct} data-content={ct} onClick={()=> setContent(ct)}>{ct.charAt(0).toUpperCase()+ct.slice(1)}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="config-label" htmlFor="session-mode">Mode</label>
        <select id="session-mode" className="full-select" value={sessionMode} onChange={e=> setSessionMode(e.target.value)}>
          <option value="normal">Normal</option>
          <option value="learning">Learning</option>
          <option value="test">Test</option>
        </select>
      </div>
      {(content==='synonym' || content==='antonym') && (
        <div id="syn-ant-wrapper">
          <label className="config-label" htmlFor="syn-ant-prompt">Syn/Ant Prompt</label>
          <select id="syn-ant-prompt" className="full-select" value={synAntPrompt} onChange={e=> setSynAntPrompt(e.target.value)}>
            <option value="random">Random</option>
            <option value="all">All</option>
          </select>
        </div>
      )}
      <div className="config-block">
        <button id="direction-label" className={`direction-toggle ${content==='spelling'? 'disabled':''}`} disabled={content==='spelling'} onClick={toggleDirection} title="Toggle direction">
          {direction==='toWord' ? <>Match <span>{content==='spelling'? 'Definition': content.charAt(0).toUpperCase()+content.slice(1)}</span> to Word</> : <>Match Word to <span>{content==='spelling'? 'Definition': content.charAt(0).toUpperCase()+content.slice(1)}</span></>}
        </button>
      </div>
      <div className="config-block start-block start-end-row">
        {!session && <button id="btn-start-study" className="primary start-btn" onClick={startSession}><span>Start Session</span></button>}
        {session && <button id="btn-end-session" className={`${settingsChanged? 'primary':'danger'} start-btn`} onClick={endOrRestartSession}>{settingsChanged? 'Start Session':'End'}</button>}
      </div>
    </aside>
  );
}

// ---------- Main App ----------
export default function App() {
  const [lists, setLists] = useState(()=> Storage.loadLists());
  const [activeListId, setActiveListId] = useState(()=> Storage.loadActiveListId() || (Storage.loadLists()[0]?.id || null));
  const [activeTab, setActiveTab] = useState('lists');
  const [listSearch, setListSearch] = useState('');
  const [wordSearch, setWordSearch] = useState('');
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

  // Persist lists & activeList
  useEffect(()=> { Storage.saveLists(lists); }, [lists]);
  useEffect(()=> { Storage.saveActiveListId(activeListId); }, [activeListId]);

  // Built-in lists merge
  useEffect(()=> { (async()=> { try { const r = await fetch('default_vocab_lists.json', {cache:'no-store'}); if(!r.ok) return; const data = await r.json(); if(!data?.lists) return; setLists(prev => {
    const nameMap = new Map(prev.map(l=>[l.name,l])); let changed=false; const merged=[...prev];
    for (const src of data.lists) { const ex = nameMap.get(src.name); if(!ex) { merged.push({ id: uuid(), name: src.name, words: src.words||[], stats:{} }); changed=true; } }
    return changed? merged: prev; }); } catch(e) { /* silent */ } })(); }, []);

  const activeList = lists.find(l => l.id === activeListId) || lists[0] || null;

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
    if(!session) return; const q = session.next(); if(!q || q.type==='done'){ // summary
      const s = session.summary(); setFeedbackHtml(`<div><strong>Session complete.</strong><br/>Attempts: ${s.attempts} • Correct: ${s.correct} • Accuracy: ${(s.accuracy*100).toFixed(0)}%</div>`); updateStats(session); setSession(s2=>s2); return; }
    setCurrentQuestion(q); if(!initial && clearFeedback) setFeedbackHtml('');
  }, [session]);

  // Answer submission
  const submitAnswer = (e) => {
    e.preventDefault(); if(!session || awaitingContinue) return;
    const formData = new FormData(e.target); const text = formData.get('text');
    const answerObj = currentQuestion?.type==='input'? { kind:'text', value: (text||'').toString().trim() } : { kind:'mc', value: mcSelection };
    const result = session.submit(answerObj);
    handleResult(result);
  };

  const handleResult = (result) => {
    updateStats(session);
    if(result.done){ handleSessionComplete(); return; }
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
  const selectMcChoice = (i) => setMcSelection(i);

  // Continue (when incorrect)
  useEffect(()=> { if(awaitingContinue){ const btn = document.createElement('button'); btn.textContent='Continue'; btn.className='primary'; btn.onclick=()=> { setAwaitingContinue(false); nextQuestion(false,true); }; // Inject below feedback
    const wrap = document.querySelector('#feedback'); if(wrap){ const holder = document.createElement('div'); holder.className='temp-continue'; holder.appendChild(btn); wrap.appendChild(holder); btn.focus(); }
  } }, [awaitingContinue, nextQuestion]);

  // Auto direction lock for spelling
  useEffect(()=> { if(content==='spelling') setDirection('toWord'); }, [content]);

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
                <button id="btn-new-list" className="primary icon-btn" aria-label="New List" title="New List" onClick={createList}><svg className="icon"><use href="#icon-add"/></svg></button>
                <input id="import-file" type="file" accept="application/json" style={{display:'none'}} onChange={e=> { handleImport(e.target.files); e.target.value=''; }} />
                <button id="btn-import" className="icon-btn" aria-label="Import Lists (JSON)" title="Import Lists (JSON)" onClick={()=> document.getElementById('import-file').click()}><svg className="icon"><use href="#icon-upload"/></svg></button>
              </div>
            </div>
            <ListCards lists={lists} filter={listSearch} sortMode={listSortMode} onOpen={(id)=> setActiveListId(id)} onDuplicate={duplicateList} onExport={exportList} onDelete={deleteList} />
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
        <StudyPanel lists={lists} sessionState={{ activeTab, session, awaitingContinue, feedbackHtml, stats, streak, currentQuestion, answerInputType, mcChoices, showAnswerBtnVisible: !!session && !awaitingContinue, testProgressPct, testModeActive, content, direction, sessionMode, synAntPrompt, selectedListIds, settingsChanged, configCollapsed }} actions={{ submitAnswer, showAnswer, selectMcChoice, setContent, toggleDirection, setSessionMode, setSynAntPrompt, toggleListSelection, startSession, endOrRestartSession, toggleConfigCollapse }} />
      </main>
      <footer className="app-footer"><small>Made for personal study • Data stays on this device</small></footer>
      <WordModal open={wordModalOpen} wordEditing={wordEditing} onSave={saveWord} onDelete={deleteWord} onClose={closeWordModal} />
      <Dialog dialog={dialog} onClose={handleDialogClose} />
    </>
  );
}
