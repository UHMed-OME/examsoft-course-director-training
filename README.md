# ExamSoft for Course Directors — JABSOM OME

Onboarding training for new JABSOM pre-clerkship course directors using the
ExamSoft **Legacy** portal. Built as a static site so it can be versioned,
updated once a year, and reused for the next faculty member instead of being
rewritten as a one-off Word document.

Replaces the per-person `ExamSoft Training for <name>.docx` series that OME has
maintained since 2014.

- **Audience:** a physician who is an expert clinician and a complete novice in
  ExamSoft.
- **Output:** two pages. `index.html` is the onboarding path, short and
  task-focused, aimed at a course director's first week. `docs/index.html` is
  the full reference. No framework, no runtime dependencies, no build server.
- **Deploys to:** GitHub Pages under the `UHMed-OME` organization.

The split is deliberate. Onboarding and reference have different jobs: one
gets somebody productive in a week, the other answers a question in six
months. Keeping them on one page made both worse.

---

## Quick start

```bash
node build/build.mjs
```

That reads `content/` and writes `index.html` at the repository root. Then open
`index.html` directly, or serve the folder:

```bash
python -m http.server 8080
```

Node 18 or newer. There is nothing to `npm install` — the build script has zero
dependencies on purpose, so it will still run in five years.

---

## How the repository is laid out

```
content/
  site.json               Title, portal facts, contacts, version, review date
  home.json               The onboarding page
  sections/
    02-account-and-login.json   One file per docs section, in filename order
    03-preferences.json
    ...
build/
  build.mjs               Renders index.html and docs/index.html from content/
  build_deck.py           Renders the slide deck from the same content/
  check-links.mjs         Reports vendor link rot
assets/
  css/tokens.css          ALL color, type, spacing values. The design swap point
  css/styles.css          Layout and components. Declares no raw values
  css/print.css           Print / PDF rules
  js/site.js              Theme toggle, mobile nav, active-section highlight
images/                   Screenshots extracted from the source documents
index.html                Generated onboarding page. Committed for Pages
docs/index.html           Generated reference. Committed for Pages
```

Section files start at `02` because section 01 used to be "Start here" and
became the home page. Filenames only control order, so the gap is harmless.

**Content is never edited in markup.** If you find yourself editing
`index.html`, stop — your change will be overwritten on the next build. Edit
the JSON in `content/` instead.

---

## Updating the content for next year

The annual pass is usually four edits:

1. **`content/site.json`** — bump `academicYear`, `reviewed`, and `version`.
   The review date and version render in the cover block and the footer, so a
   reader can always tell how stale the page is.
2. **Check the dated facts.** Anything that could drift: the 7-business-day
   draft deadline, the 36–48 hour posting window, `Max Downloads: 1`,
   attachment ceilings, and the standard permission set in
   `12-permissions.json`.
3. **Re-check the vendor links.** See *Verifying links* below. ExamSoft
   reorganises its support site and has already removed one video this page
   used to depend on.
4. **Clear or update the maintainer TODOs.** Search the content for
   `"type": "todo"`. Each one is a decision waiting on OME; they render as
   visible purple callouts so they cannot be quietly forgotten.

Then rebuild and commit:

```bash
node build/build.mjs
git add -A && git commit -m "Content review for AY 2027-2028"
```

---

## Adding a new section

1. Create `content/sections/15-your-topic.json`. The numeric prefix sets the
   order in both the sidebar and the page — that is the only thing controlling
   sequence, so renumbering files reorders the training.
2. Give it the four required keys:

```json
{
  "id": "your-topic",
  "navLabel": "Short sidebar label",
  "title": "Full section heading",
  "lede": "One sentence on what this section is for.",
  "blocks": []
}
```

`id` must be unique and URL-safe — it becomes the anchor (`#your-topic`) and
other sections link to it. The build fails loudly on a duplicate `id` or a
missing required key rather than producing a broken page.

3. Fill `blocks` using the types below.
4. Run `node build/build.mjs`. The sidebar, numbering, and print contents all
   regenerate; there is no navigation to update by hand.

### Block types

| Type | Shape | Use for |
|---|---|---|
| `p` | `{ text }` | A paragraph |
| `h3`, `h4` | `{ text }` | Sub-headings within a section |
| `ul`, `ol` | `{ items: [] }` | Plain lists |
| `steps` | `{ items: [{ t, d }] }` | A numbered procedure. `t` is the action, `d` the detail |
| `timeline` | `{ items: [{ when, who, what, detail }] }` | A dated sequence, e.g. the exam cycle |
| `callout` | `{ tone, title, text }` | Emphasis. `tone` is `critical`, `warn`, `note`, or `jabsom` |
| `todo` | `{ text }` | A maintainer decision. Renders visibly, on screen and in print |
| `table` | `{ caption, cols: [], rows: [[]] }` | Tabular facts. First cell of each row becomes a row header |
| `figure` | `{ src, alt, caption, source, note, flag }` | One screenshot |
| `figurepair` | `{ caption, source, items: [{ src, alt, label }] }` | Two screenshots side by side, e.g. before/after |
| `video` | `{ title, provider, id, url, embed, status, statusNote, recorded, note }` | A recording. See *Videos* below |
| `links` | `{ title, items: [{ label, url, note }] }` | A reference list |
| `kv` | `{ title, items: [{ k, v }] }` | Short fact pairs |
| `contacts` | `{}` | Renders the contacts from `site.json`. Takes no arguments |

Adding a block type means adding one function to the `renderers` object in
`build/build.mjs`. An unknown type fails the build with the offending name, so
a typo is caught immediately.

### Inline markup

Inside any `text` value: `**bold**`, `` `code` ``, and `[label](url)`.
Everything is HTML-escaped first, so angle brackets and ampersands in prose are
safe to type literally. Only `http(s)`, `mailto:`, in-page `#anchor`, and
relative paths are allowed as link targets; anything else renders as plain text
rather than becoming a live link.

Cross-reference another section with its anchor: `[Question types](#question-types)`.

---

## Images and alt text

Screenshots in `images/` were extracted from the embedded media in
`ExamSoft Training for Brent Matsuda 071823.docx` (the most complete of the
per-person onboarding documents) and are committed at their original
resolution:

| File | Source | What it shows |
|---|---|---|
| `my-preferences-question-creation.png` | `word/media/image1.png`, 1430×833 | My Preferences, Question Creation tab, both fonts set to Arial 12 |
| `hot-spot-ipad-preview.jpg` | `word/media/image2.JPG`, 869×491 | A Hot Spot question in Examplify preview on an OME iPad |
| `drag-and-drop-before.jpg` | `word/media/image3.jpeg`, 1431×806 | Drag and Drop with all choices unplaced |
| `drag-and-drop-after.jpg` | `word/media/image4.jpeg`, 1431×806 | The same question after three choices were moved |

**Every image needs real alt text** — a description of what is in the frame,
not a label. This is a WCAG requirement and a JABSOM one. The existing entries
are the standard to match: they describe the annotations, the field values, and
the state being demonstrated, so a screen-reader user gets the same
information a sighted reader takes from the picture.

Use the `flag` field on a `figure` when an image has a problem that needs a
human decision. It renders as a visible amber notice rather than sitting in a
comment.

---

## Videos

`video` blocks default to a **link card, not an embed**. An embed is only
emitted when the content sets `"embed": true`. This is deliberate: a dead or
permission-blocked player looks like a broken site, whereas a link card with an
honest status note does not.

- `status: "restricted"` or `"removed"` renders a visible badge.
- `provider: "drive"` embeds `https://drive.google.com/file/d/<id>/preview`.
- `provider: "youtube"` embeds via `youtube-nocookie.com`.

### Current video situation

Checked 17 September 2026:

- **ExamSoft's own training video is gone.** The Hot Spot and Drag-and-Drop
  video cited in the 2023 onboarding document (`GCl7VCpMLgg`) has been removed
  from YouTube. Its playlist, *Legacy Webinars*, is now empty, and the
  `@ExamSoftTraining` channel has no content at all. There is no official
  ExamSoft video to embed for these question types. The written Legacy articles
  linked from the Question types section are current and cover the same
  material. The original timestamps are preserved in
  `13-video-training.json` in case the material reappears.
- **The OME recording is shared with nobody.**
  `ExamSoft Training 1 - 111422.mp4` (Drive ID `1kZHrJ6W3FH2XXttdue9xkA7OT1I09uFS`)
  currently lists exactly one permission: its owner, `omeit@hawaii.edu`. Until
  sharing is widened, neither the link nor an embed will open for a course
  director. Once it is shared, set `"embed": true` on that block.

---

## The slide deck

A 16:9 deck is generated from the **same** `content/` JSON, so the site and the
deck cannot drift apart:

```bash
pip install python-pptx
python build/build_deck.py
```

Output: `dist/ExamSoft-for-Course-Directors.pptx` (34 slides). `dist/` is
git-ignored — the deck is a build artifact, not source.

It is the faculty counterpart to the student *Examplify for iPad* orientation
deck and mirrors its structure and voice: an uppercase eyebrow, a short title,
then content. It does not repeat student-facing material.

### How slide text is derived

Slide bullets are **condensed** from each section, not written twice. The
derivation ranks by signal: `critical` and `jabsom` callout titles first, then
`steps` titles, then `kv` pairs, then list items — capped at five per slide.
Tables, the exam-cycle timeline, images, and contacts get purpose-built slides
rather than being flattened into bullets.

If a section condenses badly, override it rather than rewording the section.
Add a `deck` object alongside `blocks`:

```json
"deck": { "bullets": ["First point", "Second point"] }
```

Images are downscaled into `dist/_img/` for slide use — the full-resolution
originals in `images/` are for the website. Alt text is written into the
PowerPoint `descr` attribute, so it survives into Google Slides, and each image
slide also carries its alt text in the speaker notes.

### Turning it into Google Slides

Upload `dist/ExamSoft-for-Course-Directors.pptx` to Drive and open it with
Google Slides, or use **File → Import slides**. Layout, palette, tables, and
images convert cleanly.

Video does **not** survive as a live embed through that conversion, which is
why recordings appear as link slides. If you want true inline playback in
Slides, use **Insert → Video** on the relevant slide after converting; that
change lives in Slides only and will be lost if the deck is regenerated.

---

## Applying the design system

Every colour, type size, space, radius, and shadow is a custom property in
`assets/css/tokens.css`. No other stylesheet declares a raw value. To restyle
the site, change values in that one file.

The design system at `claude.ai/design/p/fa47af3f-232b-4a44-a336-7f61e227c21f`
**could not be read when this site was built.** `DesignSync` requires a
one-time interactive authorisation that a non-interactive session cannot
perform. To pull it in:

1. Run `/design-login` once from an interactive Claude Code session on this
   machine. Headless runs then reuse that authorisation.
2. Read the project's token files and transfer the values into `tokens.css`.

Until then the palette is a JABSOM-aligned placeholder built on UH Mānoa green
(`#024731`). Every text/background pair in it meets WCAG 2.2 AA contrast. If
you change a value, re-check the pair.

---

## Accessibility

Target is **WCAG 2.2 AA**, which is a JABSOM requirement.

What is already in place, and what to preserve when editing:

- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1`, and no
  skipped heading levels.
- A skip link, and a table of contents made of real anchors that works with
  JavaScript disabled.
- Visible focus rings (3px) with offset, and interactive targets at or above
  the 24×24px minimum (SC 2.5.8).
- Colour is never the only signal — every callout carries a text label
  (`Critical`, `Watch out`, `Note`, `JABSOM convention`) as well as a tint.
- Tables use `scope` on column and row headers, with captions.
- `prefers-reduced-motion` and `prefers-color-scheme` are both honoured.
- Alt text on every image.

The page is responsive from roughly 320px upward and has no horizontal scroll
at phone width.

---

## Printing

`assets/css/print.css` treats print as a real target, because the training has
to be handable to a course director on paper.

Print or Save as PDF from the browser. You get: the light palette forced,
sidebar and controls dropped, a generated two-column contents page, each
section starting on a new page, repeated table headers across page breaks,
external link URLs printed after their link text, and images constrained so
they do not straddle a break.

---

## Deploying to GitHub Pages

`index.html` is committed rather than generated on the server, so Pages can
serve the repository root directly with no Actions run required. `.nojekyll`
stops GitHub from processing the folder as a Jekyll site.

To publish under `UHMed-OME`:

```bash
gh repo create UHMed-OME/examsoft-course-director-training --public --source=. --push
```

Then in the repository, **Settings → Pages → Build and deployment → Deploy from
a branch**, branch `main`, folder `/ (root)`.

A workflow is included at `.github/workflows/pages.yml` if you would rather
have Pages build from source on every push; it runs the build and publishes the
result, which removes the need to commit `index.html`. Pick one approach, not
both.

### A note on repository visibility

GitHub Pages on a free organization plan requires a **public** repository.
Nothing in this repository is sensitive — see below — so public is workable.
If OME would rather keep it internal, Pages on a private repository needs
GitHub Team or Enterprise.

---

## What must never be committed

- **Exam passwords.**
- **Universal / exam resume codes.**
- **Student data** of any kind, including names, rosters, and scores.

Some historical OME decks contain real ones. The student-facing deck
*Examplify for iPad — August 2026* has a live exam password and universal
resume code on its "Mock exam details" slide; neither was carried into this
repository, and that deck is worth reviewing separately given how widely it is
shared.

Per-exam secrets belong on the OME-prepared proctor materials for that sitting,
never here.

---

## Verifying links

Every vendor link points at a **Legacy Portal** article. ExamSoft publishes
parallel Enterprise and Legacy documentation describing different screens, and
searching the support site returns both. When adding a link, confirm the title
begins with `Legacy Portal:` or that the article explicitly covers both
editions.

To check for rot across the whole page:

```bash
node build/check-links.mjs
```

That extracts every external URL from `content/` and reports its HTTP status.
Run it as part of the annual review.

---

## Provenance

Content was assembled from:

- `ExamSoft Training for Brent Matsuda 071823.docx` — the most recent and most
  complete per-person onboarding document, and the source of all four
  screenshots.
- `ExamSoft Training for Vanessa- How to post assessment.docx` (2020) — the
  only source covering the posting dialog field by field, including
  `Max Downloads: 1`, `Secure Review: None`, and the content-freeze behaviour
  after the first student download.
- `ExamSoft Training for Kyoko Shirahata 093020.docx` (2020) — used to check
  which conventions have held steady.
- The ExamSoft support site, Legacy articles only.

### What drifted, and what held

Comparing the 2020 and 2023 documents:

| | 2020 | 2023 |
|---|---|---|
| Question types | MC, MS, T/F, Fill-in-Blank, Matching | Adds Hot Spot and Drag and Drop |
| Attachment limits | Formats listed, no sizes | Sizes and image resolution specified |
| Staff referred to as | "OME proper staff" | "OME pre-clerkship staff" |
| Portal URL | `www.examsoft.com/hawaiimed` | Superseded by `ei.examsoft.com/GKWeb/login/hawaiimed` |

Unchanged across every revision: the 7-business-day draft deadline, the 36–48
hour posting window, `Max Downloads: 1`, at least one category per question,
the 200 MB attachment ceiling, the Arial 12 font convention, the proctor
PowerPoint carrying the universal code, and results being visible within
minutes of upload. Those are the load-bearing conventions.

The vendor's attachment article documents two limits the OME documents never
mentioned — PDF at 20 MB and RTF at 5 MB. Both are marked in the content as
vendor-sourced and unexercised at JABSOM.

---

## Maintainer

Jesse Thompson, Office of Medical Education — <jessetho@hawaii.edu>
