import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_lists');
const OUTPUT = path.join(ROOT, 'vocab_lists_complete.json');

// Manual word-to-definition mappings based on careful analysis of the OCR files
const WORD_DEFINITIONS = {
  '1-1': {
    'acquisitive': {
      definition: 'able to get and retain ideas or information; concerned with acquiring wealth or property',
      example: 'In an acquisitive society, there is a great deal of emphasis on buying and selling.',
      synonyms: ['greedy', 'grasping', 'avaricious', 'retentive'],
      antonyms: ['altruistic', 'unretentive']
    },
    'arrogate': {
      definition: 'to claim or take without right',
      example: 'The ambitious noblemen will arrogate royal privileges to themselves.',
      synonyms: ['expropriate', 'usurp', 'commandeer'],
      antonyms: ['relinquish', 'renounce', 'abdicate', 'abandon']
    },
    'banal': {
      definition: 'hackneyed, trite, commonplace',
      example: 'The new play\'s banal dialogue made it seem more like a soap opera than a serious drama.',
      synonyms: ['stale', 'insipid'],
      antonyms: ['fresh', 'novel', 'original', 'new']
    },
    'belabor': {
      definition: 'to work on excessively; to thrash soundly',
      example: 'His tendency to belabor small points often made him miss the big picture.',
      synonyms: ['overwork'],
      antonyms: []
    },
    'carping': {
      definition: 'tending to find fault, especially in a petty, nasty, or hairsplitting way; petty, nagging criticism',
      example: 'The trainee resigned after a week rather than put up with the carping complaints of the sales manager.',
      synonyms: ['nit-picking', 'caviling'],
      antonyms: ['approving', 'uncritical']
    },
    'coherent': {
      definition: 'holding or sticking together; making a logical whole; comprehensible, meaningful',
      example: 'The physics teacher gave a surprisingly coherent description of quantum mechanics.',
      synonyms: ['connected', 'unified', 'consistent', 'cohesive'],
      antonyms: ['muddled', 'chaotic', 'disjointed']
    },
    'congeal': {
      definition: 'to change from liquid to solid, thicken; to make inflexible or rigid',
      example: 'If you do not wash your dishes right away, the food on them will congeal.',
      synonyms: ['harden', 'jell', 'coagulate', 'solidify'],
      antonyms: ['melt', 'liquefy']
    },
    'emulate': {
      definition: 'to imitate with the intent of equaling or surpassing the model',
      example: 'Most beginning writers try to emulate a great writer and later develop their own individual styles.',
      synonyms: ['copy', 'mimic', 'rival', 'match', 'measure up to'],
      antonyms: []
    },
    'encomium': {
      definition: 'a formal expression of praise, a lavish tribute',
      example: 'On Veterans Day, the President delivered a heartfelt encomium to those who died for their country.',
      synonyms: ['panegyric', 'eulogy', 'commendation'],
      antonyms: ['condemnation', 'castigation', 'criticism']
    },
    'eschew': {
      definition: 'to avoid, shun, keep away from',
      example: 'The young athletes promised the coach that they would train vigorously and eschew bad habits.',
      synonyms: ['abstain from', 'steer clear of', 'forgo'],
      antonyms: []
    }
  },
  '1-2': {
    'germane': {
      definition: 'relevant, appropriate, apropos, fitting',
      example: 'Bringing up examples from the past is not germane to the present discussion.',
      synonyms: ['pertinent'],
      antonyms: ['irrelevant', 'extraneous', 'inappropriate']
    },
    'insatiable': {
      definition: 'so great or demanding as not to be satisfied',
      example: 'People with an insatiable appetite for gossip often do not have compelling stories of their own.',
      synonyms: ['unquenchable', 'ravenous', 'voracious'],
      antonyms: ['satiable', 'satisfied', 'moderate']
    },
    'intransigent': {
      definition: 'refusing to compromise, irreconcilable',
      example: 'The intransigent attitudes maintained their conservative positions.',
      synonyms: ['obstinate', 'stubborn', 'inflexible'],
      antonyms: ['flexible', 'compromising', 'accommodating']
    },
    'invidious': {
      definition: 'offensive, hateful, tending to cause ill will or resentment',
      example: 'The boss made invidious comparisons between the workers.',
      synonyms: ['malicious', 'spiteful', 'discriminatory'],
      antonyms: ['fair', 'just', 'impartial']
    },
    'largesse': {
      definition: 'generosity in giving; lavish or bountiful contributions',
      example: 'The billionaire\'s largesse helped fund the new hospital wing.',
      synonyms: ['munificence', 'bounty', 'liberality'],
      antonyms: ['stinginess', 'miserliness', 'parsimony']
    },
    'reconnaissance': {
      definition: 'a survey made for military purposes; any preliminary examination',
      example: 'The scouts conducted reconnaissance before the main attack.',
      synonyms: ['survey', 'exploration', 'inspection'],
      antonyms: []
    },
    'substantiate': {
      definition: 'to give concrete or substantial form to; to provide with a factual basis',
      example: 'The lawyer was able to substantiate her client\'s alibi with witness testimony.',
      synonyms: ['verify', 'confirm', 'validate', 'corroborate'],
      antonyms: ['disprove', 'refute', 'contradict']
    },
    'taciturn': {
      definition: 'habitually silent or quiet, inclined to talk very little',
      example: 'Abraham Lincoln has the reputation of having a dour and taciturn personality.',
      synonyms: ['tight-lipped', 'uncommunicative', 'laconic'],
      antonyms: ['talkative', 'loquacious', 'garrulous']
    },
    'temporize': {
      definition: 'to stall or act evasively in order to gain time, avoid a confrontation, or postpone a decision',
      example: 'For most of Shakespeare\'s greatest tragedy, the protagonist Hamlet chooses to temporize rather than act.',
      synonyms: ['hedge', 'dillydally', 'procrastinate'],
      antonyms: ['act decisively', 'confront']
    },
    'tenable': {
      definition: 'capable of being held or defended',
      example: 'The researchers put forth a tenable theory, but their conclusions would be reviewed carefully by others.',
      synonyms: ['defensible', 'justifiable', 'maintainable'],
      antonyms: ['indefensible', 'unjustifiable']
    }
  }
};

function createWordFromDef(word, defData) {
  return {
    word: word,
    definition: defData.definition,
    example: defData.example,
    synonyms: defData.synonyms,
    antonyms: defData.antonyms
  };
}

function parseVocabFile(text, fileName) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Extract numbered words
  const words = [];
  const wordPattern = /^(\d+)\.\s+([a-zA-Z]+(?:[-'][a-zA-Z]+)*)\s*$/;
  
  for (const line of lines) {
    const match = line.match(wordPattern);
    if (match) {
      const word = fixOcrWord(match[2].toLowerCase());
      
      // Use manual definitions if available
      if (WORD_DEFINITIONS[fileName] && WORD_DEFINITIONS[fileName][word]) {
        words.push(createWordFromDef(word, WORD_DEFINITIONS[fileName][word]));
      } else {
        // Fallback to basic extraction
        words.push({
          word: word,
          definition: '',
          example: '',
          synonyms: [],
          antonyms: []
        });
      }
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
    
    // Show first few words
    words.slice(0, 2).forEach(word => {
      console.log(`    ${word.word}: ${word.definition ? word.definition.substring(0, 40) + '...' : 'No definition'}`);
    });
  }
  
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nWrote combined vocabulary lists to: ${OUTPUT}`);
  console.log(`Total lists: ${result.lists.length}`);
  console.log(`Total words: ${result.lists.reduce((sum, list) => sum + list.words.length, 0)}`);
}

main();