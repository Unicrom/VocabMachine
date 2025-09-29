import React from 'react';

export function QuestionForm({ sessionState, actions }) {
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
