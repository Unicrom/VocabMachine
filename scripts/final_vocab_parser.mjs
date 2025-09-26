import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_lists');
const OUTPUT = path.join(ROOT, 'vocab_lists_final_clean.json');

function parseVocabFile(text, fileName) {
  const content = text.replace(/\r/g, '');
  
  // Split into sections based on numbered entries
  const sections = content.split(/\n(?=\d+\.\s+[a-zA-Z])/);
  const words = [];
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) continue;
    
    // Extract word from first line
    const firstLine = lines[0];
    const wordMatch = firstLine.match(/^(\d+)\.\s+([a-zA-Z]+(?:[-'][a-zA-Z]+)*)/);
    if (!wordMatch) continue;
    
    const word = fixOcrWord(wordMatch[2].toLowerCase());
    const wordData = {
      word: word,
      definition: '',
      example: '',
      synonyms: [],
      antonyms: []
    };
    
    // Process remaining lines to find definitions, examples, synonyms, antonyms
    let definitionLines = [];
    let exampleLines = [];
    let inDefinition = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip pronunciation lines
      if (/^\([a-zA-Z\s'ˈˌəɪɛɔʊʌɑæɜɝɪ\-ˌː]+\)$/.test(line)) continue;
      
      // Skip markers
      if (/^(IG|2G|3G|4G|2G-|3G-)$/.test(line)) continue;
      
      // Check for part of speech (start of definition)
      const posMatch = line.match(/^\((adj\.|adv\.|n\.|v\.)[^)]*\)\s*(.*)/);
      if (posMatch) {
        inDefinition = true;
        if (posMatch[2]) {
          definitionLines.push(posMatch[2]);
        }
        continue;
      }
      
      // Check for synonyms
      const synMatch = line.match(/^SYNONYMS?:\s*(.+)/i);
      if (synMatch) {
        wordData.synonyms = synMatch[1]
          .split(/[,;]/)
          .map(s => s.replace(/^\([^)]*\)\s*/, '').trim())
          .filter(s => s.length > 0);
        inDefinition = false;
        continue;
      }
      
      // Check for antonyms
      const antMatch = line.match(/^ANTONYMS?:\s*(.+)/i);
      if (antMatch) {
        wordData.antonyms = antMatch[1]
          .split(/[,;]/)
          .map(s => s.replace(/^\([^)]*\)\s*/, '').trim())
          .filter(s => s.length > 0);
        inDefinition = false;
        continue;
      }
      
      // If we're in a definition, collect the text
      if (inDefinition && line.length > 5) {
        definitionLines.push(line);
        continue;
      }
      
      // Check if this is an example sentence
      if (!inDefinition && line.length > 10) {
        // Look for example patterns
        const hasArticles = /\b(the|a|an)\b/i.test(line);
        const startsWithCapital = /^[A-Z]/.test(line);
        const hasVerb = /\b(is|are|was|were|will|would|could|should|can|may|might|must|do|does|did|have|has|had)\b/i.test(line);
        
        if (startsWithCapital && (hasArticles || hasVerb) && !wordData.example) {
          exampleLines.push(line);
        }
      }
    }
    
    // Clean up and assign definition
    if (definitionLines.length > 0) {
      wordData.definition = definitionLines.join(' ').replace(/\s+/g, ' ').trim();
    }
    
    // Clean up and assign example
    if (exampleLines.length > 0) {
      wordData.example = exampleLines.join(' ').replace(/\s+/g, ' ').trim();
    }
    
    words.push(wordData);
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
  
  return corrections[word] || word.replace(/[0]/g, 'o').replace(/[1]/g, 'l');
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
    
    // Show sample of extracted data
    words.slice(0, 2).forEach(word => {
      console.log(`    ${word.word}:`);
      console.log(`      def: ${word.definition.substring(0, 60)}${word.definition.length > 60 ? '...' : ''}`);
      console.log(`      syn: [${word.synonyms.slice(0, 3).join(', ')}${word.synonyms.length > 3 ? '...' : ''}]`);
      console.log(`      ant: [${word.antonyms.slice(0, 3).join(', ')}${word.antonyms.length > 3 ? '...' : ''}]`);
    });
    console.log();
  }
  
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Wrote combined vocabulary lists to: ${OUTPUT}`);
  console.log(`Total lists: ${result.lists.length}`);
  console.log(`Total words: ${result.lists.reduce((sum, list) => sum + list.words.length, 0)}`);
}

main();