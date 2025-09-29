// (Copied & minimally adapted from original study.js)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sample(arr, n) { const copy = arr.slice(); shuffle(copy); return copy.slice(0, n); }
function pickDifferent(arr, notValue, n) { return sample(arr.filter(x => x !== notValue), n); }
function allWords(arr) { return Array.from(new Set(arr.map(x => x.word))); }
function escapeHtml(s = '') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function normalize(s = '') { return s.toLowerCase().replace(/[^a-z0-9]/g,''); }

function contentToInternalMode(content, direction) {
  switch (content) {
    case 'spelling': return direction === 'toWord' ? 'spelling_toWord' : 'spelling_toAnswer';
    case 'definition': return direction === 'toWord' ? 'definition_toWord' : 'definition_toAnswer';
    case 'synonym': return direction === 'toWord' ? 'synonym_toWord' : 'synonym_toAnswer';
    case 'antonym': return direction === 'toWord' ? 'antonym_toWord' : 'antonym_toAnswer';
    default: return 'spelling_toWord';
  }
}

export class StudyEngine {
  constructor(words, options, listsRef) {
    this.words = words;
    this.options = options;
    this.total = options.sessionMode === 'test' ? undefined : Infinity;
    this.answered = 0;
    this.current = null;
    this.queue = [];
    this.listsRef = listsRef;
    this.statsSession = { attempts: 0, correct: 0 };
    this.queue = this._buildSeed();
  }
  _statsMap() {
    const map = new Map();
    for (const list of this.listsRef) { if (!list.stats) continue; for (const [k,v] of Object.entries(list.stats)) map.set(k,v); }
    return map;
  }
  _keyFor(w, mode) { return `${w.__listId || 'list'}::${(w.word||'').toLowerCase()}::${mode}`; }
  _buildSeed() {
    const content = this.options.content || 'spelling';
    const mode = contentToInternalMode(content, this.options.direction);
    let items = this.words.map(w => ({ w, mode }));
    const statsMap = this._statsMap();
    if (this.options.sessionMode === 'learning') {
      const weighted = [];
      for (const it of items) {
        const key = this._keyFor(it.w, it.mode);
        const s = statsMap.get(key) || { attempts: 0, correct: 0, accuracy: 0.5 };
        const weight = 1.5 - (s.accuracy ?? 0.5);
        const copies = Math.max(1, Math.round(weight * 2));
        for (let i=0;i<copies;i++) weighted.push({...it});
      }
      items = weighted;
    } else if (this.options.sessionMode === 'test') {
      // one pass
    }
    shuffle(items);
    if (this.options.sessionMode === 'test') this.total = items.length;
    return items;
  }
  next() {
    if (this.answered >= this.total) { this.current=null; return { promptHtml: '<em>Session complete.</em>', type:'done' }; }
    if (!this.queue.length) {
      if (this.options.sessionMode === 'test') { this.current=null; return { promptHtml: '<em>Session complete.</em>', type:'done' }; }
      this.queue = this._buildSeed();
      if (!this.queue.length) { this.current=null; return { promptHtml:'<em>No eligible words for this mode.</em>', type:'done'}; }
    }
    const { w, mode } = this.queue.shift();
    this.current = this._makeQuestion(w, mode);
    return this.current.q;
  }
  currentAnswer() { if (!this.current) return { expected: '' }; return { expected: this.current.expectedPlain }; }
  submit(answer) {
    if (!this.current) return { correct:false, done:true };
    const { w, mode, expectedPlain, answerIndex } = this.current;
    let correct=false; let your=''; let selectedIndex=-1;
    if (this.current.q.type==='input' && answer.kind==='text') { your = answer.value; correct = normalize(your) === normalize(expectedPlain); }
    else if (this.current.q.type==='mc' && answer.kind==='mc') { your = this.current.q.choices[answer.value] || ''; correct = answer.value === answerIndex; selectedIndex = answer.value; }
    this._recordResult(w, mode, correct);
    this.statsSession.attempts++; if (correct) this.statsSession.correct++;
    if (!correct && this.options.sessionMode==='learning') { const delay=3; const insertAt = Math.min(this.queue.length, delay-1); this.queue.splice(insertAt,0,{w,mode}); }
    this.answered++;
    const done = this.answered >= this.total;
    return { correct, done, expected: expectedPlain, your, mode, word:w.word, wordDefinition:w.definition||'', answerIndex, selectedIndex };
  }
  progress() { return { answered: this.answered, total: this.total, infinite: this.options.sessionMode !== 'test' }; }
  _recordResult(w, mode, correct) {
    const list = this.listsRef.find(l => l.id === w.__listId); if (!list) return; if (!list.stats) list.stats = {};
    const key = this._keyFor(w, mode); const s = list.stats[key] || { attempts:0, correct:0 };
    s.attempts++; if (correct) s.correct++; s.accuracy = s.attempts ? s.correct / s.attempts : 0; list.stats[key]=s;
    try { localStorage.setItem('vm2001:lists', JSON.stringify(this.listsRef)); } catch {}
  }
  _makeQuestion(w, mode) {
    switch(mode) {
      case 'spelling_toWord': return this._q_input(`Definition:<br><blockquote>${escapeHtml(w.definition)}</blockquote>`, w.word, w, mode);
      case 'spelling_toAnswer': return this._q_input(`Word:<br><strong>${escapeHtml(w.word)}</strong><br>Type the definition`, w.definition, w, mode);
      case 'definition_toAnswer': { const choices = this._distractorsDefinition(w); const idx = choices.indexOf(w.definition); return this._q_mc(`What is the best definition for: <strong>${escapeHtml(w.word)}</strong>?`, choices, idx, w, mode); }
      case 'definition_toWord': { const wordsAll = shuffle(Array.from(new Set(this.words.map(x=>x.word)))); const choices = [w.word, ...pickDifferent(wordsAll, w.word, 3)]; shuffle(choices); const idx = choices.indexOf(w.word); return this._q_mc(`Which word matches this definition?<br><blockquote>${escapeHtml(w.definition)}</blockquote>`, choices, idx, w, mode); }
      case 'synonym_toAnswer': { const synList = Array.isArray(w.synonyms)?w.synonyms.filter(Boolean):[]; const syn = this.options.synAntPrompt==='random' ? (synList.length? synList[Math.floor(Math.random()*synList.length)]:undefined) : (synList.length? synList.join(', '):undefined); const vocab = shuffle(Array.from(new Set(this.words.flatMap(x=>x.synonyms||[])))); const distractors = syn ? pickDifferent(vocab, syn, 3) : pickDifferent(allWords(this.words), w.word, 3); const answer = syn || w.word; const choices = [answer, ...distractors]; shuffle(choices); const idx = choices.indexOf(answer); return this._q_mc(`Pick a synonym for <strong>${escapeHtml(w.word)}</strong>`, choices, idx, w, mode); }
      case 'synonym_toWord': { const synList = Array.isArray(w.synonyms)?w.synonyms.filter(Boolean):[]; let promptText; if (this.options.synAntPrompt==='random') promptText = synList.length? synList[Math.floor(Math.random()*synList.length)] : w.word; else promptText = synList.length? synList.join(', ') : w.word; const wordsAll = shuffle(Array.from(new Set(this.words.map(x=>x.word)))); const choices = [w.word, ...pickDifferent(wordsAll, w.word, 3)]; shuffle(choices); const idx = choices.indexOf(w.word); return this._q_mc(`Which word matches this synonym?<br><blockquote>${escapeHtml(promptText)}</blockquote>`, choices, idx, w, mode); }
      case 'antonym_toAnswer': { const antList = Array.isArray(w.antonyms)?w.antonyms.filter(Boolean):[]; const ant = this.options.synAntPrompt==='random' ? (antList.length? antList[Math.floor(Math.random()*antList.length)]:undefined) : (antList.length? antList.join(', '):undefined); const vocab = shuffle(Array.from(new Set(this.words.flatMap(x=>x.antonyms||[])))); const distractors = ant ? pickDifferent(vocab, ant, 3) : pickDifferent(allWords(this.words), w.word, 3); const answer = ant || w.word; const choices = [answer, ...distractors]; shuffle(choices); const idx = choices.indexOf(answer); return this._q_mc(`Pick an antonym for <strong>${escapeHtml(w.word)}</strong>`, choices, idx, w, mode); }
      case 'antonym_toWord': { const antList = Array.isArray(w.antonyms)?w.antonyms.filter(Boolean):[]; let promptText; if (this.options.synAntPrompt==='random') promptText = antList.length? antList[Math.floor(Math.random()*antList.length)] : w.word; else promptText = antList.length? antList.join(', ') : w.word; const wordsAll = shuffle(Array.from(new Set(this.words.map(x=>x.word)))); const choices=[w.word, ...pickDifferent(wordsAll, w.word,3)]; shuffle(choices); const idx = choices.indexOf(w.word); return this._q_mc(`Which word matches this antonym?<br><blockquote>${escapeHtml(promptText)}</blockquote>`, choices, idx, w, mode); }
      default: return this._q_input('Type the answer', w.word, w, mode);
    }
  }
  _distractorsDefinition(w) { const defs = this.words.map(x=>x.definition); const choices = [w.definition, ...pickDifferent(defs, w.definition, 3)]; shuffle(choices); return choices; }
  _q_input(promptHtml, expectedPlain, w, mode) { return { w, mode, expectedPlain, q:{ type:'input', promptHtml } }; }
  _q_mc(promptHtml, choices, answerIndex, w, mode) { return { w, mode, expectedPlain: choices[answerIndex], answerIndex, q:{ type:'mc', promptHtml, choices } }; }
  summary() { const { attempts, correct } = this.statsSession; const accuracy = attempts? correct/attempts:0; return { attempts, correct, accuracy }; }
}
