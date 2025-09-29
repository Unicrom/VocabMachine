# Vocab Machine – Functional & Architectural Summary

## Overview
Vocab Machine is a client‑side (no backend) vocabulary study web app. It lets a user:
- Create, duplicate, rename, delete, search, import, and export vocabulary lists.
- Add, edit, duplicate, delete, and search words inside a list (word data includes word, example, definition, synonyms, antonyms).
- Run adaptive study sessions across selected lists in different content modes (spelling, definition, synonym, antonym) and directions (e.g., definition → word or word → definition) with three session modes (normal, learning, test).
- Track per‑word, per‑mode performance statistics (attempts, correct, accuracy) persisted in `localStorage`.
- Import built‑in default lists and user JSON list files (merged non‑destructively unless overwritten explicitly).

All application state (lists, active list id, stats) persists locally in the browser via `localStorage`; no data leaves the device. The UI is a single HTML page with modular JavaScript (ES modules): `main.js` (UI + controller logic), `study.js` (StudyEngine), `storage.js` (persistence helpers), and optional `sample.js` (sample data provider – currently unused in main flow).

---
## Data Model
List object:
```jsonc
{
  id: string,          // UUID
  name: string,
  words: Word[],
  stats: { [key: string]: { attempts: number, correct: number, accuracy: number } }
}
```
Word object:
```jsonc
{
  word: string,
  example: string,
  definition: string,
  synonyms: string[],
  antonyms: string[]
}
```
Stats key format: `${listId || 'list'}::${word.toLowerCase()}::${mode}` where mode is an internal study mode (e.g., `definition_toWord`).

Session options stored on engine creation:
```jsonc
{
  content: 'spelling'|'definition'|'synonym'|'antonym',
  direction: 'toWord'|'toAnswer',
  sessionMode: 'normal'|'learning'|'test',
  synAntPrompt: 'random'|'all'
}
```

---
## UI Structure
Major panels:
1. Lists Panel
   - Overview (cards) and Detail (word table + inline search + list title editor).
2. Study Panel
   - Left Config (list selection chips, content mode tabs, direction toggle, session mode selector, synonym/antonym prompt control, start/end button).
   - Right Session Area (prompt, answer input / multiple choice, feedback, progress bar (test mode), stat chips (attempts, accuracy, streak)).

Modal dialogs:
- Generic dialog system (confirm/prompt) used for new list, delete confirmations, rename prompt (not for inline), etc.
- Word edit modal (add/edit with fields for all word attributes and buttons save/reset/delete).

Menus:
- Per list (open, duplicate, export, delete) via contextual dropdown inside each list card.
- Per word (edit, duplicate, delete) within the word table.

---
## Persistence Layer (`storage.js`)
Functions:
- `Storage.loadLists()` – Safely reads JSON from `localStorage`, validates shape, supplies defaults, generates missing IDs.
- `Storage.saveLists(lists)` – Serializes lists back to storage.
- `Storage.loadActiveListId()` / `Storage.saveActiveListId(id)` – Maintain the last open list.

Keys: `vm2001:lists`, `vm2001:activeListId`.

---
## Core Controller & UI Logic (`main.js`)
Initialization Flow (`init`):
1. Cache frequently accessed DOM elements.
2. Wire tab navigation, lists panel handlers, study panel handlers.
3. Load user data (`load()`), merge built‑in default lists asynchronously (`loadBuiltInLists('merge')`).
4. Initial rendering: lists, chips, optionally open detail view.
5. Hide progress bar until needed.

Key Functional Areas:

### List Management
- Create (`btn-new-list`): prompt for name, add list, activate it, render & sync chips.
- Duplicate (`btn-duplicate-list` AND list card menu `duplicate`): deep clone including words, rename with "(copy)" suffix.
- Delete (`btn-delete-list` or menu): confirmation; if active list removed, fallback to first available.
- Rename: inline text input (`detail-title`) commits on blur/Enter.
- Export current: download single list as JSON via `downloadJSON`.
- Import: JSON file input supports three shapes: `{lists:[...]}`, `[...]`, or a single `{name, words}`. Merges by list name; adds only new words when merging existing list to avoid duplicates.
- Overview search (`list-search`): Filters by list name OR any word/definition containing the search string.
- List cards show up to 19 words plus a tail line `+ N more` if truncated.

### Word Management
- Add / Edit via modal (`openWordModal` / `saveWordFromModal`): create or update word object; required fields word & definition.
- Duplicate: word menu duplicates with "(copy)" suffix appended to the word.
- Delete: confirmation dialog.
- Search (`word-search`): Case‑insensitive filter across word & definition inside active list.

### Generic Dialog System
`openDialog({title, body, mode, placeholder, defaultValue})` returns a Promise; specialized helpers:
- `appConfirm(title, message)` → Promise<boolean>
- `appPrompt(title, message, default)` → Promise<string|null>
Handles keyboard accessibility (Escape, Enter) and click outside to cancel.

### Import of Built‑In Lists
`loadBuiltInLists(mode='merge')`: fetches `default_vocab_lists.json`; silently fails if not present. Modes:
- `merge`: add new lists by name; do not overwrite existing words.
- `overwrite` (unused in default calls) replaces words & stats for matching list names.

### Study Panel & Sessions
Controls & states:
- Content tabs toggle `content` type.
- Direction toggle (except spelling locked to `toWord`).
- Syn/Ant prompt mode selector visible only in synonym/antonym modes (show random single vs all synonyms/antonyms).
- Session mode: normal (infinite), learning (weighted repetition of low‑accuracy items), test (single pass with progress bar & completion target).
- List selection chips (checkboxes) define the word pool.
- Start Session (`startSession`): Collects options, builds `StudyEngine`, resets streak, displays first question, shows/hides progress bar depending on test mode, swaps visibility of start/end buttons.
- End Session (`endSession`): Clears session, resets UI and progress bar, restores start button, resets restart tracking.
- Settings Change Detection: If session active and any setting (list selection, content, direction, session mode, syn/ant prompt) changes, the End button morphs into a primary "Start Session" restart button.

### Question / Answer Flow
- `nextQuestion` pulls next question object from engine: returns either input prompt or MC prompt.
- Input questions produce a text field; MC questions produce labeled radio buttons; first radio receives focus for accessibility.
- Submission (`answerForm` submit): Collect answer, call `session.submit`, produce feedback. On correct: auto-advance after 500ms. On incorrect: UI enters "await continue" state with explicit Continue button; correct answer and structured feedback shown.
- Show Answer button reveals expected answer without advancing.

### Feedback System
Comprehensive, mode‑specific template driven feedback for incorrect answers. Uses helper functions to look up:
- Definition given a word (`lookupWordDefinition`).
- Word by definition (`findWordByDefinition`).
- Word owning a synonym/antonym (`findWordBySynonym` / `findWordByAntonym`).
Templates in `FEEDBACK_TEMPLATES` map to internal mode strings and support conditional lines.

### Progress & Stats Display
- Real-time chips: Attempts, Accuracy (%), Streak. Colored classification (good / warn / bad) based on thresholds.
- Progress bar only in test sessions; otherwise hidden. Test sessions compute bounded total; infinite sessions show animated full bar.
- Final session summary: attempts, correct count, accuracy percentage.

### Accessibility & UX Enhancements
- Keyboard navigation for menus, Enter/Space activation on list cards.
- Aria attributes for tabs, dialogs, progress bar.
- Escape closes menus & dialogs.
- Smart menu positioning for word action dropdowns (positions above if insufficient space below viewport).
- Collapse toggle for study setup panel with icon state swap (eye / eye-off) and appropriate aria labels.

### Utility & Helper Functions
- `$` / `$all`: DOM selection shortcuts.
- `escapeHtml`: sanitize strings for safe innerHTML insertion.
- File export: `downloadJSON` + `sanitizeFileName`.
- Settings capture & change detection: `captureCurrentSettings`, `settingsChanged`, `updateButtonForSettingsChange`.
- Word normalization for modal form operations.

---
## Study Engine (`study.js`)
Responsibilities:
- Generates question queue according to content & session mode.
- Tracks answered count, correctness, per‑session attempts & accuracy.
- Supports three learning paradigms:
  - Normal: endless (queue reseeded when exhausted, infinite progress).
  - Learning: weights low‑accuracy items more (duplicates them in queue) and re-inserts missed items a few positions ahead for near-term repetition.
  - Test: single pass over each selected word exactly once; fixed total; progress bar shows completion percentage.

Question Generation (internal modes):
- `spelling_toWord`: Prompt = definition, user types word.
- `spelling_toAnswer`: Prompt = word, user types definition.
- `definition_toWord`: Definition shown; MC choices are candidate words.
- `definition_toAnswer`: Word shown; MC choices are candidate definitions.
- `synonym_toWord`: (Synonym(s) prompt) → pick correct word.
- `synonym_toAnswer`: Given word → pick synonym (or fallback word when none).
- `antonym_toWord` / `antonym_toAnswer`: Mirror synonym logic for antonyms.
Distractors: pulled from other definitions, words, synonyms/antonyms or fallback to other words when vocabulary sparse. Choices are shuffled.

Answer Submission:
- Normalizes text answers (alphanumeric lowercase) for spelling & definition input comparisons.
- Records result in list stats (attempts, correct, accuracy) with persistent storage update.
- Learning mode reinserts missed items after a short delay (approx a few questions later) for spaced repetition.

Summary & Progress:
- `progress()` returns answered count, total (undefined for infinite), and infinite flag.
- `summary()` returns session attempts, correct, accuracy fraction.

---
## File: `sample.js`
Exports `sampleData()` returning a small static vocabulary array (not directly wired into UI; could be used for demo seeding or tests).

---
## Built-In Lists File
`default_vocab_lists.json`: JSON resource with `{"lists": [...]}` structure loaded at startup and merged by name if lists do not already exist locally.

---
## Extensibility Notes / Potential Improvements
- Add persistence versioning & migration for future schema changes.
- Provide UI to clear/reset per-word stats.
- Add spaced repetition scheduling algorithm (e.g., SM-2) instead of simple weighted duplication.
- Implement offline-first PWA manifest & service worker for installability and caching.
- Validate and surface import conflicts (e.g., show which words skipped as duplicates) more transparently.
- Add CSV import/export in addition to JSON.
- Enhanced accessibility: announce feedback via ARIA live regions (partially present) & focus management after dialogs close.
- Unit tests (e.g., Jest) for StudyEngine logic (distractor generation, weighting, stats recording).

---
## Security & Privacy
- No network transmission of user-created data (except optional fetch of built-in list file).
- All data stored locally via `localStorage` under namespaced keys.

---
## Quick Functional Inventory (Function → Purpose)
(Abbreviated; see code for full signatures)
- init / cacheEls / wireTabs / wireListPanel / wireStudyPanel – App bootstrap and event binding.
- load / save / loadBuiltInLists – Persistence & seeding.
- render / renderLists / renderWords / renderStudyListChips – UI rendering.
- openListDetail / showOverview / updateDetailHeader – View navigation + header sync.
- openWordModal / saveWordFromModal / deleteCurrentModalWord – Word CRUD via modal.
- startSession / endSession / nextQuestion / renderQuestion / submit (inside StudyEngine) – Study flow.
- renderFeedback / generateModeSpecificFeedback (+ helpers) – Adaptive feedback templating.
- renderProgress / updateStatsChips / renderSessionSummary – Progress & statistics UI.
- captureCurrentSettings / settingsChanged / updateButtonForSettingsChange – Session restart logic.
- StudyEngine._buildSeed / _makeQuestion / _recordResult / progress / summary – Core study algorithm & state.

---
## High-Level Flow Diagram (Textual)
User selects lists → clicks Start Session → StudyEngine builds queue → Question rendered → User submits → Engine evaluates & records stats → Feedback displayed → (Auto advance if correct / Continue if incorrect) → Repeat until session end (test) or infinite (normal/learning) → Summary.

---
End of Summary.
