import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_lists');
const OUTPUT = path.join(ROOT, 'vocab_lists_final.json');

function parseVocabFile(text, fileName) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Extract all numbered words first
  const words = [];
  const wordPattern = /^(\d+)\.\s+([a-zA-Z]+(?:[-'][a-zA-Z]+)*)\s*$/;
  
  for (const line of lines) {
    const match = line.match(wordPattern);
    if (match) {
      words.push({
        number: parseInt(match[1]),
        word: fixOcrWord(match[2].toLowerCase()),
        definition: '',
        example: '',
        synonyms: [],
        antonyms: []
      });
    }
  }
  
  // Extract all definition blocks (marked by part of speech)
  const definitions = [];
  let currentDef = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip word headers and pronunciation
    if (wordPattern.test(line) || /^\([a-zA-Z\s'ˈˌəɪɛɔʊʌɑæɜɝɪ]+\)$/.test(line)) {
      continue;
    }
    
    // Check for part of speech (start of definition)
    const posMatch = line.match(/^\((adj\.|adv\.|n\.|v\.|pron\.|prep\.|conj\.|interj\.)[^)]*\)\s*(.*)/);
    if (posMatch) {
      // Save previous definition
      if (currentDef) {
        definitions.push(currentDef);
      }
      
      currentDef = {
        pos: posMatch[1],
        definition: posMatch[2] ? [posMatch[2].trim()] : [],
        example: '',
        synonyms: [],
        antonyms: []
      };
      continue;
    }
    
    if (!currentDef) continue;
    
    // Check for synonyms
    const synMatch = line.match(/^SYNONYMS?:\s*(.+)/i);
    if (synMatch) {
      currentDef.synonyms = synMatch[1]
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\([^)]*\)$/))
        .map(s => s.replace(/^\(.*?\)\s*/, ''));
      continue;
    }
    
    // Check for antonyms
    const antMatch = line.match(/^ANTONYMS?:\s*(.+)/i);
    if (antMatch) {
      currentDef.antonyms = antMatch[1]
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\([^)]*\)$/))
        .map(s => s.replace(/^\(.*?\)\s*/, ''));
      continue;
    }
    
    // Skip markers
    if (/^(IG|2G|3G|4G|2G-|3G-)$/.test(line)) {
      continue;
    }
    
    // Check for example sentences
    if (line.length > 15 && /^[A-Z]/.test(line) && 
        (line.includes(' the ') || line.includes(' a ') || line.includes(' will ') || 
         line.includes(' was ') || line.includes(' is ')) &&
        !currentDef.example) {
      currentDef.example = line;
      continue;
    }
    
    // Add to definition if it looks like definition text
    if (line.length > 5 && !line.includes('SYNONYM') && !line.includes('ANTONYM')) {
      currentDef.definition.push(line);
    }
  }
  
  // Save final definition
  if (currentDef) {
    definitions.push(currentDef);
  }
  
  // Clean up definitions
  definitions.forEach(def => {
    def.definition = def.definition.join(' ').trim();
  });
  
  // Map definitions to words (in order)
  let defIndex = 0;
  for (let i = 0; i < words.length && defIndex < definitions.length; i++) {
    const word = words[i];
    const def = definitions[defIndex];
    
    if (def) {
      word.definition = def.definition;
      word.example = def.example;
      word.synonyms = def.synonyms;
      word.antonyms = def.antonyms;
      defIndex++;
    }
  }
  
  // For any remaining words without definitions, try to find loose matches
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.definition && defIndex < definitions.length) {
      const def = definitions[defIndex];
      word.definition = def.definition;
      word.example = def.example;
      word.synonyms = def.synonyms;
      word.antonyms = def.antonyms;
      defIndex++;
    }
  }
  
  return words;
}

function fixOcrWord(word) {
  const corrections = {
    'encomlum': 'encomium',
    'insatlable': 'insatiable',
    'reconnalssance': 'reconnaissance',
    'tallsman': 'talisman',
    'pecunlary': 'pecuniary'
  };
  
  return corrections[word] || word.replace(/0/g, 'o').replace(/1/g, 'l');
}

function readTxtFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.txt'))
    .sort()
    .map(f => ({
      name: f.replace('.txt', ''),
      text: fs.readFileSync(path.join(dir, f), 'utf8')
    }));
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
  
  const result = {
    version: 1,
    lists: []
  };
  
  for (const file of files) {
    console.log(`Processing ${file.name}...`);
    const words = parseVocabFile(file.text, file.name);
    result.lists.push({
      name: file.name,
      words: words
    });
    console.log(`  Found ${words.length} words`);
    
    // Log first few words for debugging
    words.slice(0, 3).forEach(word => {
      console.log(`    ${word.word}: ${word.definition.substring(0, 50)}${word.definition.length > 50 ? '...' : ''}`);
    });
  }
  
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nWrote combined vocabulary lists to: ${OUTPUT}`);
  console.log(`Total lists: ${result.lists.length}`);
  console.log(`Total words: ${result.lists.reduce((sum, list) => sum + list.words.length, 0)}`);
}

main();