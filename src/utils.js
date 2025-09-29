// Shared small utilities extracted to reduce duplication

export function normalizeWord(w = {}) {
  return {
    word: w.word || '',
    example: w.example || '',
    definition: w.definition || '',
    synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
    antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
  };
}

export function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]+/g,'_').trim() || 'download.json';
}

export function downloadJSON(filename, data) {
  try {
    const safe = sanitizeFileName(filename || 'data.json');
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = safe; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },0);
  } catch (e) {
    alert('Export failed: '+ (e?.message||e));
  }
}
