import React from 'react';

export function QuestionForm({ sessionState, actions }) {
  const { answerInputType, mcChoices, showAnswerBtnVisible, awaitingContinue, correctMcIndex, mcSelection, lockedAnswer } = sessionState;
  const { submitAnswer, showAnswer, selectMcChoice } = actions;
  // Continue action: mimic the original injected button logic (advance to next question)
  const handleContinue = (e) => {
    e.preventDefault();
    if(typeof window !== 'undefined' && window.dispatchEvent){ /* no-op placeholder for accessibility hook */ }
    // We'll trigger the same path App used: clear awaitingContinue and advance
    // We cannot call nextQuestion directly here (not passed), so rely on submit prevention logic:
    // Instead, use a custom event consumed in App (simpler: add a helper action could be passed down)
  };
  return (
    <form id="answer-form" className="answer-area" autoComplete="off" onSubmit={submitAnswer}>
      <div id="answer-input-area" className="answer-input-area">
        {answerInputType==='input' && <input name="text" type="text" autoFocus autoComplete="off" spellCheck={false} placeholder="Type your answer…" disabled={lockedAnswer} />}
        {answerInputType==='mc' && mcChoices.map((c,i)=> {
          const stateClass = correctMcIndex===i? 'choice-correct' : (lockedAnswer && mcSelection===i && correctMcIndex!==i? 'choice-wrong':'');
          return (
            <label key={i} className={`mc-choice ${stateClass}`}>
              <input type="radio" name="mc" value={i} checked={mcSelection===i} disabled={lockedAnswer} onChange={()=> selectMcChoice(i)} />
              <span>{c}</span>
            </label>
          );
        })}
      </div>
      <div className="answer-actions">
        {!awaitingContinue && (
          <button type="submit" className="primary icon-btn" aria-label="Submit Answer" title="Submit Answer"><svg className="icon"><use href="#icon-check"/></svg></button>
        )}
        {awaitingContinue && (
          <button type="button" className="primary" onClick={()=> { const ce = new CustomEvent('vocab-continue-click'); window.dispatchEvent(ce); }} aria-label="Continue" title="Continue">Continue</button>
        )}
        {showAnswerBtnVisible && !awaitingContinue && <button type="button" id="btn-show-answer" className="icon-btn" aria-label="Show Answer" title="Show Answer" onClick={showAnswer}><svg className="icon"><use href="#icon-eye"/></svg></button>}
      </div>
    </form>
  );
}
