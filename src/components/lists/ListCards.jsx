import React from 'react';

export function ListCards({ lists, filter, onOpen, onDuplicate, onExport, onDelete }) {
  const lower = filter.toLowerCase();
  // Always sort alphabetically by list name (case-insensitive)
  const filtered = lists
    .slice()
    .sort((a,b)=> a.name.localeCompare(b.name, undefined,{sensitivity:'base'}))
    .filter(l => {
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
          onClick={(e)=> { if (e.target.closest('details')) return; onOpen(list.id); }}
          onKeyDown={(e)=> { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(list.id); } }}
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
