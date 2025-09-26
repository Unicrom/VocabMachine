import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_lists');
const OUTPUT = path.join(ROOT, 'temp_lists_import.json');

function readTxtFiles(dir) {
  const files = fs.readdirSync(dir).filter(f => /\.(txt|tzt)$/i.test(f)).sort();
  return files.map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

function parseAll(files) {
  const lists = [];
  for (const f of files) {
    const name = f.name.replace(/\.[^.]+$/, '');
    const words = parseOcrList(f.text);
    lists.push({ name, words });
  }
  return { version: 1, lists };
}

function parseOcrList(text) {
  const norm = text.replace(/\r/g, '');
  const lines = norm.split(/\n+/);
  const entries = [];
  const wordOrder = [];
  const wordIndex = new Map();
  let currentForExtras = null; // last word with a definition awaiting extras

  // Track where each headword appears so we can map POS blocks to the nearest prior head
  const headPositions = []; // { index, word }

  const getOrCreate = (raw) => {
    const w = sanitizeHeadword(raw);
    if (!w) return null;
    if (!wordIndex.has(w)) {
      const obj = { word: w, definition: '', example: '', synonyms: [], antonyms: [] };
      wordIndex.set(w, obj);
      wordOrder.push(w);
    }
    return wordIndex.get(w);
  };

  const STOP = new Set(['the','a','an','and','or','but','will','would','could','should','to','of','in','on','for','with','by','from','as','at','into','over','after','before','between','without','within','during','including','until','against','among','through','despite','towards','upon','about','above','below','off','out','up','down']);
  const isHead = (s) => {
    const t = s.trim();
    if (!/^(?:\s*\d+\.)?\s*[A-Za-z][A-Za-z\-']+\s*$/.test(t)) return false;
    const w = sanitizeHeadword(t);
    if (!w || w.length < 4 || STOP.has(w)) return false;
    return true;
  };
  const isIPA = (s) => /^\s*\([^)]*\)\s*$/.test(s.trim());
  const isPOS = (s) => /\((?:adj|adv|n|v|pron|prep|conj|interj)\.[^)]*\)/i.test(s);

  const findTargetForDef = (posIndex) => {
    for (let k = headPositions.length - 1; k >= 0; k--) {
      const hp = headPositions[k];
      if (hp.index < posIndex) {
        const obj = getOrCreate(hp.raw);
        if (obj && !obj.definition) return obj;
      }
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(IG|2G|3G|4G|2G-|3G-)$/i.test(line)) continue; // ignore stray markers

    // Headword detection (optionally followed by IPA line we can skip)
    if (isHead(line) && !isPOS(line) && !/SYNONYMS?:|ANTONYMS?:/i.test(line)) {
      const next = lines[i + 1]?.trim() || '';
      const maybeIPA = isIPA(next);
      const head = getOrCreate(line);
      if (head) headPositions.push({ index: i, word: head.word, raw: line });
      if (maybeIPA) i++; // skip IPA line
      continue;
    }

    // Definition start
    if (isPOS(line)) {
      // Attach to nearest prior headword lacking definition
      const target = findTargetForDef(i) || (currentForExtras && !currentForExtras.definition ? currentForExtras : null);
      if (target) {
        const def = collectDefinition(lines, i);
        target.definition = def.text;
        i = def.nextIndex;
        currentForExtras = target;
        continue;
      }
    }

    // Synonyms/Antonyms
    if (/SYNONYMS?:/i.test(line)) {
      if (currentForExtras) {
        const list = extractList(line, /SYNONYMS?\s*:\s*([^\n]+)/i);
        if (list.length) currentForExtras.synonyms = list;
      }
      continue;
    }
    if (/ANTONYMS?:/i.test(line)) {
      if (currentForExtras) {
        const list = extractList(line, /ANTONYMS?\s*:\s*([^\n]+)/i);
        if (list.length) currentForExtras.antonyms = list;
      }
      continue;
    }

    // Example sentence: if we have a current word with definition, take the first sentence-like line
    if (currentForExtras && currentForExtras.definition && !currentForExtras.example) {
      if (/\.$/.test(line) && !/SYNONYMS?:|ANTONYMS?:/i.test(line)) {
        currentForExtras.example = line;
        continue;
      }
    }
  }

  // Build entries from map with stable order encountered
  for (const w of wordOrder) entries.push(wordIndex.get(w));
  // Filter out empty or broken headwords
  return entries.filter(e => e.word && /[a-z]/i.test(e.word));
}

function sanitizeHeadword(s) {
  const m = s.trim().match(/^(?:\s*\d+\.)?\s*([A-Za-z][A-Za-z\-']+)\s*$/);
  if (!m) return '';
  return fixOcrWord(m[1].toLowerCase());
}

function collectDefinition(lines, startIndex) {
  let buf = [];
  // Include current line after POS as part of definition (strip the POS token)
  const first = lines[startIndex];
  buf.push(first.replace(/^\s*\([^)]*\)\s*/,'').trim());
  let i = startIndex + 1;
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) break;
    if (/SYNONYMS?:|ANTONYMS?:/i.test(l)) break;
    if (/^(?:\s*\d+\.)?\s*[A-Za-z][A-Za-z\-']+\s*$/.test(l)) break; // new headword
    if (/\((?:adj|adv|n|v|pron|prep|conj|interj)\./i.test(l)) break; // new POS/definition
    buf.push(l);
    // Stop if we see an obvious end of sentence and next looks like a new section
    if (/\.$/.test(l)) {
      const nxt = (lines[i+1]||'').trim();
      if (/SYNONYMS?:|ANTONYMS?:/i.test(nxt) || /^(?:\s*\d+\.)?\s*[A-Za-z]/.test(nxt)) { i++; break; }
    }
  }
  return { text: cleanLine(buf.join(' ')), nextIndex: i - 1 };
}

function extractDefinition(text) {
  const m = text.match(/\((?:adj|adv|n|v|pron|prep|conj|interj)\.[^)]*\)\s*([\s\S]*?)(?:\n\s*SYNONYMS?:|\n\s*ANTONYMS?:|\n?\s*$)/i);
  if (m) return cleanLine(m[1]);
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (/SYNONYMS?:|ANTONYMS?:/i.test(line)) break;
    if (/[.;]$/.test(line) || line.split(' ').length > 4) return cleanLine(line);
  }
  return '';
}
function extractList(text, regex) {
  const m = text.match(regex);
  if (!m) return [];
  return m[1]
    .replace(/\([^)]*\)/g, '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => fixOcrWord(s.toLowerCase()));
}
function extractExample(text) {
  const lines = text.split(/\n+/).map(s => s.trim());
  for (const line of lines) {
    if (/SYNONYMS?:|ANTONYMS?:/i.test(line)) continue;
    if (/^[A-Z][^\n]*\.$/.test(line) && line.split(' ').length > 4) return line;
  }
  return '';
}
function cleanLine(s) { return s.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim(); }
function minimalParse(text) {
  const words = [];
  const headwords = Array.from(text.matchAll(/\n\s*(?:\d+\.)?\s*([A-Za-z][A-Za-z\-']{2,})\s*\n/g)).map(m => m[1]);
  const uniq = Array.from(new Set(headwords.map(w => fixOcrWord(w.toLowerCase()))));
  return uniq.map(word => ({ word, definition: '', example: '', synonyms: [], antonyms: [] }));
}
function fixOcrWord(w) {
  const map = new Map([
    ['encomlum','encomium'],
    ['insatlable','insatiable'],
    ['reconnaissance','reconnaissance'],
    ['tallsman','talisman'],
    ['pecunlary','pecuniary'],
  ]);
  if (map.has(w)) return map.get(w);
  return w.replace(/0/g,'o').replace(/1/g,'l');
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error('Input directory not found:', INPUT_DIR);
    process.exit(1);
  }
  const files = readTxtFiles(INPUT_DIR);
  if (!files.length) {
    console.error('No .txt files found in', INPUT_DIR);
    process.exit(1);
  }
  const data = parseAll(files);
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf8');
  console.log('Wrote', OUTPUT);
}

main();
