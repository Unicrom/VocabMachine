import React from 'react';

export function StudyConfig({ lists, sessionState, actions }) {
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
