# Vocab Machine 2001

A lightweight, offline-ready vocab study web app. Create multiple lists, add words with definitions, examples, synonyms, and antonyms; then study in several modes with adaptive practice. All data stays in your browser via localStorage.

## Features

- Multiple lists with custom names
- Word fields: word, definition, example sentence, synonyms, antonyms
- Import/Export single list or all lists (JSON)
- Study modes
  - Spelling: given definition -> type the word
  - MC: word -> definition
  - MC: definition -> word
  - MC: pick a synonym
  - MC: pick an antonym
- Adaptive practice: prioritize low-accuracy items; repeat misses after a delay
- Filter: select lists to include and optionally restrict to specific words

## Run locally

Option A (quick): open `index.html` in your browser. If ES modules are blocked on `file://` by your browser, use a local server.

Option B (recommended): serve the folder on localhost.

Using PowerShell with Python (if installed):

```powershell
# From the project folder
python -m http.server 5500 --directory "c:\Users\babyp\OneDrive\Documents\Random\Coding\VocabMachine2001"
```
Then open http://localhost:5500 in your browser.

Using Node (if installed):

```powershell
# From the project folder
npx serve -p 5500 "c:\Users\babyp\OneDrive\Documents\Random\Coding\VocabMachine2001"
```

Or use the VS Code Live Server extension and click "Go Live".

## Data format

- localStorage keys: `vm2001:lists`, `vm2001:activeListId`
- List object:
  - id: string
  - name: string
  - words: Array<{ word, definition, example?, synonyms[], antonyms[] }>
  - stats: Record<key, { attempts, correct, accuracy }>
- Stats key: `${listId}::${word.toLowerCase()}::${mode}`

## Notes

- Type answers ignore case and punctuation when checking.
- Import merges lists by name; if name matches, it overwrites the existing list’s content.
- For MC synonym/antonym, the first provided synonym/antonym is used as the correct answer. Add more for better variety.

## Roadmap ideas

- Tolerant spelling (Levenshtein distance)
- Timed sessions and streaks
- Drag-and-drop matching mode
- Per-word notes and tags
- Cloud backup (optional)

---
Made for personal study. Enjoy!
