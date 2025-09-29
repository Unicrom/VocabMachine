import React, { useState, useEffect } from 'react';
import { normalizeWord } from '../../utils.js';

export function WordModal({ open, wordEditing, onSave, onDelete, onClose }) {
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
