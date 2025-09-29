import React from 'react';

export function WordsTable({ list, filter, onEdit, onDuplicate, onDelete }) {
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
