import React from 'react';
import { StudyConfig } from './StudyConfig.jsx';
import { QuestionForm } from './QuestionForm.jsx';

export function StudyPanel({ lists, sessionState, actions }) {
  const { session, feedbackHtml, stats, streak, currentQuestion, testProgressPct, testModeActive, configCollapsed } = sessionState;
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
