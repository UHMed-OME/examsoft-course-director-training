# ExamSoft Tab-Delimited Import Schema (v11)

## File format

- Tab-delimited text file (.txt)
- First row must contain column headings in the exact order below
- Save from Excel: File > Save As > "Text (Tab delimited) (*.txt)"
- When the user imports, they should check **Import with HTML tags** on the ExamSoft import page

## Columns (in order, all required even if blank)

| # | Column | Required? | Max chars | Notes |
|---|--------|-----------|-----------|-------|
| 1 | Folders | Optional | 255 total | Subfolder path separated by `/`. Do NOT include the root "ITEMS" folder. Leaving blank places in root. |
| 2 | Descrip | Optional | 255 | Question description/title |
| 3 | Q Type | Required | N/A | `MC` or `M/C` (multiple choice), `TF` or `T/F` (true/false), `E` (essay) |
| 4 | Question Text | Required | Unlimited | The question stem. Use HTML tags for formatting. Replace any hard returns with vertical tab (Ctrl+K in Excel, or `\v`). |
| 5 | M/C Ans Choice A | Required for MC/TF | Unlimited | For TF: must be `TRUE` or `T` |
| 6 | M/C Ans Choice B | Required for MC/TF | Unlimited | For TF: must be `FALSE` or `F` |
| 7 | M/C Ans Choice C | Optional | Unlimited | |
| 8 | M/C Ans Choice D | Optional | Unlimited | |
| 9 | M/C Ans Choice E | Optional | Unlimited | |
| 10 | F | Optional | Unlimited | Answer choice F |
| 11 | G | Optional | Unlimited | Answer choice G |
| 12 | H | Optional | Unlimited | Answer choice H |
| 13 | I | Optional | Unlimited | Answer choice I |
| 14 | J | Optional | Unlimited | Answer choice J (max 10 choices) |
| 15 | Answer Key | Required for MC/TF | 255 | Single letter (A-J) for single answer. Comma-separated for multiple answers (e.g., `A,C`). For TF: `A` = True, `B` = False. |
| 16 | Partial Credit | Optional | N/A | `P` if multiple correct answers should award partial credit. Blank = no partial credit. |
| 17 | Rationale | Optional | Unlimited | Feedback/explanation released to exam takers post-exam via SofTest/Score. Not shown during exam. |
| 18 | Category | Optional | Unlimited | Separate multiple categories with commas. Sub-categories use colon separator (e.g., `Cardiology:Arrhythmias,Pharmacology:Antiarrhythmics`). Each name must be < 255 chars. |
| 19 | Item Groups | Optional | 50 | Group name. Must match spelling exactly to be in the same group. |
| 20 | Randomize Choices | Optional | 3 | `Yes`/`Y` to randomize, `No`/`N` to not. Blank = no randomize. Case insensitive. |
| 21 | Status | Optional | Unlimited | `DRAFT` or `APPROVED`. Blank = Approved. MC/TF must have answer key to be Approved. |

## Import rules

1. Only exam managers with edit rights on the root folder may import items.
2. All items are auto-tagged with a category: `IMPORTS/Imported_MMddyyyy-HHmmss`.
3. Questions are listed in import order.
4. The header row text need not be identical to the schema, but columns must be in this exact order.
5. Plain-text formatting only UNLESS "Import with HTML tags" is checked.
6. Only MC, TF, and Essay types can be imported via tab-delimited.
7. Quotation marks at start/end of a field are stripped.
8. MC questions may have up to 10 answer choices (columns A through J).
9. Optional columns may be blank but the column MUST be included (do not skip columns).

## HTML tags for formatting (when "Import with HTML tags" is checked)

Use standard HTML within Question Text, Answer Choices, and Rationale fields:

- `<b>bold</b>` or `<strong>bold</strong>`
- `<i>italic</i>` or `<em>italic</em>`
- `<u>underline</u>`
- `<sub>subscript</sub>` and `<sup>superscript</sup>`
- `<br>` for line breaks within a cell
- `<ol><li>item</li></ol>` for ordered lists
- `<ul><li>item</li></ul>` for unordered lists
- `<table><tr><td>cell</td></tr></table>` for tables

## Example rows

```
Folders	Descrip	Q Type	Question Text	M/C Ans Choice A	M/C Ans Choice B	M/C Ans Choice C	M/C Ans Choice D	M/C Ans Choice E	F	G	H	I	J	Answer Key	Partial Credit	Rationale	Category	Item Groups	Randomize Choices	Status
Cardiology/Arrhythmias	ECG Interpretation	MC	Which ECG finding is most characteristic of atrial fibrillation?	Irregularly irregular rhythm with absence of P waves	Regular narrow complex tachycardia	Sawtooth pattern	Wide QRS complexes with regular rhythm					A		Atrial fibrillation is characterized by an irregularly irregular rhythm without discernible P waves.	Cardiology:Arrhythmias,ECG Interpretation		Yes	APPROVED
Pharmacology	Drug Mechanism	MC	Which of the following mechanisms of action is correct? <i>Select all that apply.</i>	Metformin inhibits hepatic gluconeogenesis	Insulin stimulates glycogenolysis	Sulfonylureas block potassium channels in beta cells	Thiazolidinediones activate PPARgamma receptors					A,C,D	P	Insulin stimulates glycogen synthesis, not glycogenolysis.	Pharmacology:Diabetes		Yes	APPROVED
Anatomy	Brachial Plexus	TF	The musculocutaneous nerve is a branch of the lateral cord of the brachial plexus.	TRUE	FALSE									A		The musculocutaneous nerve (C5-C7) arises from the lateral cord.	Anatomy:Upper Extremity		No	APPROVED
Pathology	Essay	E	Describe the pathophysiology of Type 1 diabetes mellitus, including the role of autoimmune destruction of pancreatic beta cells.												Pathology:Endocrine			DRAFT
```
