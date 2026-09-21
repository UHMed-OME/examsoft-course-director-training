---
name: examsoft-import
description: Generate an ExamSoft-compatible RTF import file from questions provided by the user. Supports all question types — Multiple Choice, Multiple Answer, True/False, Essay, Fill in the Blank (text box, numeric range, dropdown), Drag and Drop, Ordering, and Matrix — with folders, categories, rationale, and answer comments.
---

# ExamSoft Question Import Generator

Generate an RTF file that imports directly into ExamSoft's Legacy Portal via **Questions > Import Questions > RTF Import**.

## When to use

The user wants to:
- Convert questions into an ExamSoft import file
- Bulk-create exam questions for ExamSoft
- Migrate questions from another source into ExamSoft
- Generate practice exam items for a course

## Before you start

Read `references/rtf-import-schema.md` for the full format spec, type codes, and examples of every question type.

## Interaction

1. **Gather the questions.** The user may provide them as:
   - Plain text (pasted questions, a document, lecture notes)
   - A file (Word, PDF, spreadsheet, text)
   - A topic and request to generate questions
   - A mix of the above

2. **Clarify only what you cannot infer.** Ask at most one round of questions, covering only the gaps:
   - **Folder** — where in the item bank? Default: leave blank (root).
   - **Categories** — any ExamSoft categories to tag? Default: none.
   - **Question types** — if the source material doesn't make the type obvious, ask. Default: MC single answer.
   - If the user provides enough context (e.g., "for the Cardiology exam"), skip asking and use reasonable defaults.

3. **Generate the file.** Write an `.rtf` file to the working directory (or the user's preferred location). Name it descriptively, e.g., `cardiology-midterm-import.rtf`.

## Output format rules

Follow these exactly — a malformed file will fail on import or silently drop data.

### RTF wrapper

Every generated file must be a valid RTF document. Use this minimal wrapper:

```
{\rtf1\ansi\deff0{\fonttbl{\f0\fswiss Arial;}}
\f0\fs20
[ALL QUESTIONS HERE]
}
```

Within the wrapper, each question is plain text using ExamSoft's marker syntax. Questions are separated by a blank line (`\par\par`). Line breaks within a question use `\par`.

### Character escaping

These characters MUST be escaped in the RTF content:
- `\` → `\\`
- `{` → `\{`
- `}` → `\}`

Smart quotes (if present in source material):
- Left double quote → `\'93`
- Right double quote → `\'94`
- Left single quote / apostrophe → `\'92`

### Text formatting

RTF supports inline formatting:
- Bold: `{\b bold text}`
- Italic: `{\i italic text}`
- Underline: `{\ul underline text}`

Use formatting sparingly — bold for key terms, underline for negative stems (NOT, EXCEPT).

### Question block structure

Each question block follows this pattern:

```
[Type: CODE ][Folder: path ][Title: name ][Category: tags ]NUMBER. QUESTION STEM\par
[~ RATIONALE\par]
[*]a. answer choice A\par
[@answer comment\par]
[*]b. answer choice B\par
...
```

**Order matters:**
1. Optional metadata line: Type, Folder, Title, Category (all on the same line, before the question number)
2. Question number + stem (on the same line as the metadata, or on its own line if no metadata)
3. Rationale (optional, starts with `~`)
4. Answer choices (letters followed by period or parenthesis)
5. Answer comments (optional, start with `@`, placed after the answer they apply to)

### Question types

**Multiple Choice — Single Answer** (most common, no Type code needed)
- Correct answer marked with `*` before the letter
- Up to 26 answer choices (a through z)

**Multiple Choice — Multiple Answer**
- `Type: MA` before the question number
- Mark EACH correct answer with `*`
- Add "Select all that apply" to the stem

**True/False** (no Type code needed)
- TRUE must be choice A, FALSE must be choice B
- Use `T`/`F` or `TRUE`/`FALSE`
- Mark correct answer with `*`

**Essay**
- `Type: E` before the question number
- No answer choices

**Fill in the Blank**
- `Type: F` before the question number
- Stem must contain blank indicators: `_____` (5 underscores), `__1__`, `[1]`, or `[a]`
- Three answer formats:
  - **Text box**: `a. answer` (pipe `|` separates alternate accepted answers)
  - **Numeric range**: `a. Range: MIN_MAX`
  - **Dropdown**: `a. Choice of: opt1 | opt2 | opt3 | CORRECT_NUMBER`

**Drag and Drop**
- `Type: DD` before the question number
- Mark correct answers with `*`
- Optional `Title1: Label` and `Title2: Label` for box headers

**Ordering**
- `Type: ORDERING` before the question number
- Each choice followed by `---` and its correct position number

**Matrix**
- `Type: MTX` before the question number
- Optional `Title-Prompt: Label` for the prompt column header
- Rows use uppercase letters with `---` and correct column numbers
- Columns listed below with `N.-` prefix

### Folder and category rules

**Folders:**
- Path separator: `/` (e.g., `Folder: Block 2/Cardiology`)
- Auto-created if they don't exist
- Do NOT include the root "ITEMS" folder

**Categories:**
- Separator between multiple categories: `,`
- Sub-category separator: `/` (e.g., `Category: Cardiology/Arrhythmias,Pharmacology`)
- Categories must already exist in ExamSoft — they are NOT auto-created
- Advise the user to verify category names match ExamSoft exactly

### Rationale

- Start with `~` followed by a space
- Place after the stem, before answer choices
- Can be released to students post-exam via SofTest/Score
- Keep concise: 1-3 sentences

## Quality guidelines for generated questions

When generating questions (not just converting user-provided ones):

- Write stems as clinical vignettes when possible (patient age, sex, presentation, relevant history, then ask).
- Avoid "All of the above" and "None of the above" — they reduce item discrimination.
- Make distractors plausible and homogeneous in length and style.
- Avoid negative stems ("Which is NOT...") when possible; if unavoidable, underline the negative word using `{\ul NOT}`.
- Each question should test one concept.
- Avoid absolute terms ("always", "never") in stems and distractors.
- Rationale should explain the correct answer and address the most tempting distractor.

## After generating

Tell the user:
1. Open ExamSoft > Questions > Import Questions
2. In the **RTF Import** panel, click "Select Folder" to choose where questions land
3. Drag the `.rtf` file or click to browse
4. Optionally check "Import with HTML tags" if the file contains HTML (this skill uses RTF formatting instead, so this is usually unchecked)
5. Consider checking "Import all questions as draft" to review before approving
6. Click Next and verify the preview

## Limitations to mention

- Images cannot be imported. Add them in ExamSoft after import.
- Text formatting (bold, italic) may not be retained for all question types — verify after import.
- Categories must exist in ExamSoft before import. Folders are auto-created.
- Supported fonts: Arial, Arial Black, Calibri, Comic Sans, Courier New, Georgia, Impact, Times New Roman, Trebuchet MS, Verdana.
- Supported sizes: 8pt, 9pt, 10pt, 11pt, 12pt, 14pt, 16pt, 20pt, 22pt, 24pt, 26pt, 28pt, 36pt, 48pt, 72pt.
