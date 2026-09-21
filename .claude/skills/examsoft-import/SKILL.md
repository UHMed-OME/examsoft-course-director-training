---
name: examsoft-import
description: Generate an ExamSoft-compatible tab-delimited import file (.txt) from questions provided by the user. Supports Multiple Choice, True/False, and Essay with HTML formatting, categories, folders, rationale, and partial credit for multiple-answer questions.
---

# ExamSoft Question Import Generator

Generate a tab-delimited .txt file that imports directly into ExamSoft's Legacy Portal via **Questions > Import Questions > Tab Delimited Import**.

## When to use

The user wants to:
- Convert questions into an ExamSoft import file
- Bulk-create exam questions for ExamSoft
- Migrate questions from another source into ExamSoft
- Generate practice exam items for a course

## Before you start

Read `references/tab-delimited-schema.md` for the exact column spec, field rules, and HTML tag support.

## Interaction

1. **Gather the questions.** The user may provide them as:
   - Plain text (pasted questions, a document, lecture notes)
   - A file (Word, PDF, spreadsheet, text)
   - A topic and request to generate questions
   - A mix of the above

2. **Clarify only what you cannot infer.** Ask at most one round of questions, covering only the gaps:
   - **Folder** — where in the item bank? Default: leave blank (root).
   - **Categories** — any ExamSoft categories to tag? Default: none (ExamSoft auto-adds an IMPORTS category).
   - **Status** — DRAFT or APPROVED? Default: DRAFT (safer; they can bulk-approve later).
   - If the user provides enough context (e.g., "for the Cardiology exam"), skip asking and use reasonable defaults.

3. **Generate the file.** Write a `.txt` file to the working directory (or the user's preferred location). Name it descriptively, e.g., `cardiology-midterm-import.txt`.

## Output format rules

Follow these exactly — a malformed file will fail on import or silently drop data.

### Structure
- **Row 1**: Header row with all 21 column names, tab-separated.
- **Row 2+**: One question per row, tab-separated.
- All 21 columns must be present in every row, even if blank. Never skip a column.
- Use literal tab characters (`\t`) between fields. No extra whitespace.
- No quoting of fields unless the field itself contains a tab (which it should not).
- File encoding: UTF-8 without BOM.

### Header row (copy exactly)
```
Folders	Descrip	Q Type	Question Text	M/C Ans Choice A	M/C Ans Choice B	M/C Ans Choice C	M/C Ans Choice D	M/C Ans Choice E	F	G	H	I	J	Answer Key	Partial Credit	Rationale	Category	Item Groups	Randomize Choices	Status
```

### Question types

**Multiple Choice (single answer)**
- Q Type: `MC`
- Fill answer choices A through E (or more, up to J). Leave unused choice columns blank.
- Answer Key: single letter, e.g., `C`
- Partial Credit: blank
- Set Randomize Choices to `Yes` unless order matters (e.g., "All of the above" is a choice)

**Multiple Choice (multiple answer / select all that apply)**
- Q Type: `MC` (same as single answer — ExamSoft distinguishes by the answer key)
- Answer Key: comma-separated letters, e.g., `A,C,D`
- Partial Credit: `P`
- Add "(Select all that apply)" or similar to the question stem so exam takers know

**True/False**
- Q Type: `TF`
- Choice A: `TRUE` (always first)
- Choice B: `FALSE` (always second)
- Answer Key: `A` (true) or `B` (false)
- Leave choices C through J blank

**Essay**
- Q Type: `E`
- Leave all answer choice columns blank
- Leave Answer Key and Partial Credit blank
- Status defaults to DRAFT (essays cannot be auto-scored)

### HTML formatting

Always generate HTML-tagged content. The user will check "Import with HTML tags" on the ExamSoft import page.

Use HTML for:
- **Bold**: `<b>key terms</b>` for emphasis in stems
- **Italic**: `<i>supplementary context</i>`
- **Underline**: `<u>critical negatives</u>` (e.g., "Which is <u>NOT</u> a symptom")
- **Line breaks**: `<br>` within a cell (never a literal newline — that breaks the TSV)
- **Superscript/subscript**: `<sup>2+</sup>`, `<sub>2</sub>` for chemistry/physics notation
- **Lists**: `<ul><li>...</li></ul>` when a stem presents a clinical scenario with multiple findings

Do NOT use:
- Literal newlines within any field (breaks the row). Use `<br>` instead.
- Quotation marks wrapping a field (ExamSoft strips them).
- Images (not supported in tab-delimited import).

### Categories

- Separate multiple categories with commas: `Cardiology,Pharmacology`
- Sub-categories use a colon: `Cardiology:Arrhythmias`
- Categories must already exist in ExamSoft or they are ignored. Advise the user to verify.

### Folders

- Path separator is `/`: `Block 1/Cardiology`
- Omit the root "ITEMS" folder name.
- If the folder doesn't exist, ExamSoft creates it.

### Rationale

- Include a brief explanation for the correct answer. This helps course directors and can be released to students post-exam.
- Keep it concise: 1-3 sentences covering why the correct answer is right and, if helpful, why the most common wrong answer is wrong.

## Quality guidelines for generated questions

When generating questions (not just converting user-provided ones):

- Write stems as clinical vignettes when possible (patient age, sex, presentation, relevant history, then ask).
- Avoid "All of the above" and "None of the above" — they reduce item discrimination.
- Make distractors plausible and homogeneous in length and style.
- Avoid negative stems ("Which is NOT...") when possible; if unavoidable, bold/underline the negative word.
- Each question should test one concept.
- Avoid absolute terms ("always", "never") in stems and distractors.
- Rationale should explain the correct answer and address the most tempting distractor.

## After generating

Tell the user:
1. Open ExamSoft > Questions > Import Questions
2. In the **Tab Delimited Import** panel, click "Select Folder" to choose where questions land (or leave blank for root)
3. Drag the .txt file or click to browse
4. **Check "Import with HTML tags"** (important — the file uses HTML formatting)
5. Consider checking "Import all questions as draft" if they want to review before approving
6. Click Next and verify the preview

## Limitations to mention

- Tab-delimited import supports MC, TF, and Essay only. For Fill in the Blank, Drag & Drop, Ordering, or Matrix questions, use the RTF import instead.
- Images cannot be imported via either format. Add them in ExamSoft after import.
- Categories in the file must match existing ExamSoft categories exactly (name and path). Folders are auto-created if they don't exist.
