# ExamSoft RTF Import Schema

## File format

- Rich Text Format (.rtf) file
- Create in Word and Save As > Rich Text Format (*.rtf)
- OR generate a minimal valid RTF wrapper (see "RTF wrapper" below)
- Import via ExamSoft > Questions > Import Questions > RTF Import

## RTF wrapper

Claude generates a minimal valid RTF document. The entire file structure:

```
{\rtf1\ansi\deff0{\fonttbl{\f0\fswiss Arial;}}
\f0\fs20
[QUESTION CONTENT HERE — one question after another, separated by blank lines (\par\par)]
}
```

Rules:
- Use `\par` for line breaks within the RTF (equivalent to a newline in the rendered output)
- Use `\par\par` (blank line) to separate questions
- Escape special RTF characters: `\` becomes `\\`, `{` becomes `\{`, `}` becomes `\}`
- Use `\'93` for left smart quote, `\'94` for right smart quote, `\'91` for left single quote, `\'92` for right single quote (or use `\lquote` `\rquote` `\ldblquote` `\rdblquote`)
- Use `\~` for non-breaking space
- For bold text: `{\b bold text}`
- For italic text: `{\i italic text}`
- For underline text: `{\ul underline text}`

## Question structure

Each question is a block of plain text within the RTF, using ExamSoft's marker syntax. Components appear on separate lines (separated by `\par`) in this order:

```
[Type: CODE] [Folder: path] [Title: name] [Category: tags] NUMBER. QUESTION STEM
~ RATIONALE (optional)
[answer letter]. answer text
[answer letter]. answer text
@answer comment (optional, after any answer choice)
```

### Required components

**Question number** — every question must have a number followed by a period or closing parenthesis. Use consecutive numbers. These are for import identification only; they don't persist after import.

**Question stem** — the actual question text. Follows the number on the same line.

**Answer choices** — required for all types except Essay. Format: letter, then a period or closing parenthesis, then the answer text. Correct answers are prefixed with `*`.

### Optional components (all placed BEFORE the question number)

| Component | Syntax | Notes |
|-----------|--------|-------|
| Type | `Type: CODE` | Required only for non-MC-single-answer types. See type codes below. |
| Folder | `Folder: path/subpath` | Subfolder path. `/` separates levels. Auto-created if new. |
| Title | `Title: name` | Question title for ExamSoft UI. If omitted, first 20 chars of stem are used. |
| Category | `Category: Cat1,Cat2/SubCat` | Comma-separated. `/` for sub-categories. Must exist in ExamSoft already. |

### Optional components (placed AFTER the question stem, BEFORE answer choices)

| Component | Syntax | Notes |
|-----------|--------|-------|
| Rationale | `~ text` | Tilde + space + explanation. Can be released to students post-exam. |

### Optional components (placed AFTER an answer choice)

| Component | Syntax | Notes |
|-----------|--------|-------|
| Answer comment | `@text` | @ + space + comment. Not shown to exam takers. For instructor reference. |

## Question type codes

| Code | Type | Notes |
|------|------|-------|
| *(none)* | Multiple Choice Single Answer | Default — no Type line needed |
| `MA` | Multiple Choice Multiple Answer | Mark each correct answer with `*` |
| `E` | Essay | No answer choices needed |
| `F` | Fill in the Blank | See FiB section below |
| `DD` | Drag and Drop | Mark correct answers with `*`. Optional `Title1:` and `Title2:` for box labels |
| `ORDERING` | Ordering | Use `---` to indicate correct position |
| `MTX` or `MATRIX` | Matrix | See Matrix section below |

## Question type examples

### Multiple Choice — Single Answer (default, no Type code needed)

```
Folder: Cardiology Title: AFib ECG Category: Cardiology/Arrhythmias 1. Which ECG finding is most characteristic of atrial fibrillation?
~ Atrial fibrillation is characterized by an irregularly irregular rhythm without discernible P waves. The sawtooth pattern is seen in atrial flutter.
a. Regular narrow complex tachycardia
*b. Irregularly irregular rhythm with absence of P waves
c. Sawtooth pattern on baseline
d. Wide QRS complexes with regular rhythm
```

### Multiple Choice — Multiple Answer

```
Type: MA Folder: Pharmacology Title: Diabetes Drugs Category: Pharmacology/Endocrine 2. Which of the following mechanisms of action are correct? Select all that apply.
*a. Metformin inhibits hepatic gluconeogenesis
b. Insulin stimulates glycogenolysis
*c. Sulfonylureas block potassium channels in beta cells
*d. Thiazolidinediones activate PPAR-gamma receptors
```

### True/False

```
Folder: Anatomy Title: Brachial Plexus Category: Anatomy/Upper Extremity 3. The musculocutaneous nerve is a branch of the lateral cord of the brachial plexus.
*A. T
B. F
```

True must always be listed first. Use `T`/`F` or `TRUE`/`FALSE`.

### Essay

```
Type: E Folder: Pathology Title: T1DM Pathophysiology 4. Describe the pathophysiology of Type 1 diabetes mellitus, including the role of autoimmune destruction of pancreatic beta cells.
~ Type 1 diabetes is an autoimmune disease in which T-cell mediated destruction of pancreatic beta cells leads to absolute insulin deficiency.
```

No answer choices for essay questions.

### Fill in the Blank — Basic Text Box

The question stem must contain blank indicator(s). Three formats for blanks:
- Five underscores: `_____`
- Number enclosed by double underscores: `__1__`, `__2__`
- Number/letter in square brackets: `[1]`, `[a]`, `[A]`

```
Type: F Folder: Physiology Title: Primary Colors 5. The primary colors are _____, yellow, and blue.
a. red
```

Multiple blanks:

```
Type: F 6. The [1] nerve innervates the [2] muscle.
a. musculocutaneous
b. coracobrachialis
```

Alternate accepted answers use pipe `|`:

```
Type: F 7. The United Arab Emirates borders Saudi Arabia on the east, along with _____.
a. Oman | Sultanate of Oman
```

### Fill in the Blank — Numeric Range

```
Type: F 8. Normal adult heart rate is _____ beats per minute.
a. Range: 60_100
```

Any number from 60 to 100 is accepted. Syntax: `Range:` then min, underscore, max (no spaces around underscore).

### Fill in the Blank — Dropdown List

```
Type: F 9. The _____ is the largest organ in the human body.
a. Choice of: Skin | Liver | Heart | Brain | 1
```

Syntax: `Choice of:` then options separated by `|`, ending with the number of the correct option (1-indexed).

### Drag and Drop

```
Type: DD Title1: Available Answers Title2: Your Selections 10. Drag each drug that is a beta-blocker to the Selected box.
*a. Metoprolol
b. Amlodipine
*c. Atenolol
d. Lisinopril
*e. Propranolol
```

`Title1:` labels the source box (default: "Possible Answers"). `Title2:` labels the target box (default: "Selected Answers").

### Ordering

```
Type: ORDERING 11. Arrange the following steps of the cardiac cycle in correct order.
a. Isovolumetric contraction --- 2
b. Ventricular filling --- 1
c. Ventricular ejection --- 3
d. Isovolumetric relaxation --- 4
```

Three dashes `---` separate the answer text from its correct position number.

### Matrix

```
Type: MTX Title-Prompt: Symptoms 12. Match each condition with its characteristic symptoms.
A) Hyperthyroidism --- 1,3
B) Hypothyroidism --- 2,4

1.- Weight loss
2.- Weight gain
3.- Tachycardia
4.- Bradycardia
```

Rows (A, B, ...) are prompts. `---` separates from correct column numbers. Columns (1., 2., ...) are the answer headers prefixed with `N.-`.

## Answer key alternative (MC-only files)

If the file contains ONLY multiple choice questions, you can omit `*` markers and add an answer key at the end:

```
Answers:
1. b
2. a
3. c
```

Use this only when all questions are MC. The skill defaults to the `*` method since it supports mixed question types.

## Category syntax detail

- Multiple categories separated by commas: `Category: Cardiology,Pharmacology`
- Sub-categories with forward slash: `Category: Cardiology/Arrhythmias`
- Multiple categories with sub-categories: `Category: Anatomy/Upper Extremity,Anatomy/Nerves`
- Categories MUST already exist in ExamSoft before import (unlike folders, they are NOT auto-created)

## Folder syntax detail

- Forward slash for subfolders: `Folder: Block 2/Cardiology`
- If the folder doesn't exist, ExamSoft creates it automatically
- Do NOT include the root "ITEMS" folder in the path
