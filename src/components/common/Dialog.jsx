import React from 'react';

export function Dialog({ dialog, onClose }) {
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
