import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_lists');
const OUTPUT = path.join(ROOT, 'vocab_lists_combined.json');

function readTxtFiles(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.txt'))
    .sort()
    .map(f => ({
      name: f.replace('.txt', ''),
      text: fs.readFileSync(path.join(dir, f), 'utf8')
    }));
  return files;
}

function parseVocabFile(text, fileName) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find all word entries with their sections
  const sections = [];
  let currentSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for numbered word (start of new section)
    const wordMatch = line.match(/^(\d+)\.\s+([a-zA-Z]+(?:[-'][a-zA-Z]+)*)\s*$/);
    if (wordMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        number: parseInt(wordMatch[1]),
        word: wordMatch[2].toLowerCase(),
        lines: []
      };
      continue;
    }
    
    if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  // Process each section to extract word data
  const words = [];
  
  for (const section of sections) {
    const wordObj = {
      word: section.word,
      definition: '',
      example: '',
      synonyms: [],
      antonyms: []
    };
    
    let definitionParts = [];
    let inDefinition = false;
    
    for (let i = 0; i < section.lines.length; i++) {
      const line = section.lines[i];
      
      // Skip pronunciation lines
      if (/^\([a-zA-Z\s'ˈˌəɪɛɔʊʌɑæɜɝɪ]+\)$/.test(line)) {
        continue;
      }
      
      // Skip standalone markers
      if (/^(IG|2G|3G|4G|2G-|3G-)$/.test(line)) {
        continue;
      }
      
      // Check for part of speech (start of definition)
      const posMatch = line.match(/^\((adj\.|adv\.|n\.|v\.|pron\.|prep\.|conj\.|interj\.)[^)]*\)\s*(.*)/);
      if (posMatch) {
        // End previous definition if any
        if (inDefinition && definitionParts.length > 0) {
          wordObj.definition = definitionParts.join(' ').trim();
          definitionParts = [];
        }
        
        inDefinition = true;
        if (posMatch[2] && posMatch[2].trim()) {
          definitionParts.push(posMatch[2].trim());
        }
        continue;
      }
      
      // Check for synonyms
      const synMatch = line.match(/^SYNONYMS?:\s*(.+)/i);
      if (synMatch) {
        if (inDefinition && definitionParts.length > 0) {
          wordObj.definition = definitionParts.join(' ').trim();
          definitionParts = [];
          inDefinition = false;
        }
        
        const synonyms = synMatch[1]
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.match(/^\([^)]*\)$/))
          .map(s => s.replace(/^\(.*?\)\s*/, ''));
        wordObj.synonyms = synonyms;
        continue;
      }
      
      // Check for antonyms
      const antMatch = line.match(/^ANTONYMS?:\s*(.+)/i);
      if (antMatch) {
        if (inDefinition && definitionParts.length > 0) {
          wordObj.definition = definitionParts.join(' ').trim();
          definitionParts = [];
          inDefinition = false;
        }
        
        const antonyms = antMatch[1]
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.match(/^\([^)]*\)$/))
          .map(s => s.replace(/^\(.*?\)\s*/, ''));
        wordObj.antonyms = antonyms;
        continue;
      }
      
      // Collect definition parts
      if (inDefinition && line.length > 3 && !line.includes('SYNONYM') && !line.includes('ANTONYM')) {
        definitionParts.push(line);
        continue;
      }
      
      // Check for example sentences (complete sentences that aren't definitions)
      if (!inDefinition && !wordObj.example && line.length > 15) {
        const isExample = /^[A-Z]/.test(line) && 
                         (line.includes(' the ') || line.includes(' a ') || line.includes(' an ') || 
                          line.includes(' will ') || line.includes(' was ') || line.includes(' is ')) &&
                         (line.endsWith('.') || line.endsWith('!') || line.endsWith('?')) &&
                         !line.includes('SYNONYM') && !line.includes('ANTONYM');
        
        if (isExample) {
          wordObj.example = line;
        }
      }
    }
    
    // Finalize any remaining definition
    if (inDefinition && definitionParts.length > 0) {
      wordObj.definition = definitionParts.join(' ').trim();
    }
    
    // Clean up the word (fix common OCR errors)
    wordObj.word = fixOcrWord(wordObj.word);
    
    words.push(wordObj);
  }
  
  return words.filter(word => word.word && word.word.length > 2);
}

function fixOcrWord(word) {
  const corrections = {
    'encomlum': 'encomium',
    'insatlable': 'insatiable',
    'reconnalssance': 'reconnaissance',
    'tallsman': 'talisman',
    'pecunlary': 'pecuniary'
  };
  
  if (corrections[word]) {
    return corrections[word];
  }
  
  // Fix common OCR substitutions
  return word.replace(/0/g, 'o').replace(/1/g, 'l');
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
  }
  
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nWrote combined vocabulary lists to: ${OUTPUT}`);
  console.log(`Total lists: ${result.lists.length}`);
  console.log(`Total words: ${result.lists.reduce((sum, list) => sum + list.words.length, 0)}`);
}

main();