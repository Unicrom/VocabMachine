// Extracted feedback + helpers from original for reuse in React.
export const FEEDBACK_TEMPLATES = {
  spelling_toWord: [ { text: 'Correct Word: {EXPECTED}', class: 'incorrect' } ],
  spelling_toAnswer: [ { text: 'Correct Word: {EXPECTED}', class: 'correct' } ],
  definition_toWord: [ { text: '{YOUR}: {YOUR_DEF}', class: 'incorrect', condition: 'hasUserAnswer' }, { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' } ],
  definition_toAnswer: [ { text: 'You selected: {YOUR_WORD} ({YOUR})', class: 'incorrect', condition: 'hasUserAnswer' } ],
  synonym_toAnswer: [ { text: 'You selected: {YOUR_SYN_WORD} ({YOUR_SYN_WORD_DEF})', class: 'incorrect', condition: 'hasUserAnswer' }, { text: '{WORD}: {WORD_DEF}', class: 'correct' } ],
  synonym_toWord: [ { text: 'You chose: {YOUR}', class: 'incorrect', condition: 'hasUserAnswer' }, { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' } ],
  antonym_toAnswer: [ { text: 'You selected: {YOUR_ANT_WORD} ({YOUR_ANT_WORD_DEF})', class: 'incorrect', condition: 'hasUserAnswer' }, { text: '{WORD}: {WORD_DEF}', class: 'correct' } ],
  antonym_toWord: [ { text: 'You chose: {YOUR} ({YOUR_DEF})', class: 'incorrect', condition: 'hasUserAnswer' }, { text: '{EXPECTED}: {CORRECT_DEF}', class: 'correct' } ]
};

export function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

export function createFeedbackData(result, wordData, expected, your, helpers) {
  const { getWordData, lookupDefinition, findWordByDefinition, findWordBySynonym, findWordByAntonym } = helpers;
  const yourWordData = getWordData(your);
  const yourWord = findWordByDefinition(your);
  const yourSynonymWord = findWordBySynonym(your);
  const yourAntonymWord = findWordByAntonym(your);
  const yourSynWordData = getWordData(yourSynonymWord);
  const yourAntWordData = getWordData(yourAntonymWord);
  return {
    EXPECTED: escapeHtml(expected),
    YOUR: escapeHtml(your || ''),
    WORD: escapeHtml(wordData?.word || ''),
    CORRECT_DEF: escapeHtml(wordData?.definition || ''),
    WORD_DEF: escapeHtml(wordData?.definition || ''),
    YOUR_DEF: escapeHtml(yourWordData ? yourWordData.definition : lookupDefinition(your) || ''),
    YOUR_WORD: escapeHtml(yourWord || ''),
    YOUR_SYN_WORD: escapeHtml(yourSynonymWord || ''),
    YOUR_SYN_WORD_DEF: escapeHtml(yourSynWordData ? yourSynWordData.definition : ''),
    YOUR_ANT_WORD: escapeHtml(yourAntonymWord || ''),
    YOUR_ANT_WORD_DEF: escapeHtml(yourAntWordData ? yourAntWordData.definition : ''),
    hasUserAnswer: your && your !== expected && your !== '(no answer)'
  };
}

export function replacePlaceholders(template, data) {
  let result = template;
  for (const [k,v] of Object.entries(data)) {
    if (typeof v === 'string') result = result.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return result;
}

export function shouldShowFeedbackLine(line, data) { if (!line.condition) return true; return data[line.condition] === true; }
