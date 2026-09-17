#!/usr/bin/env python3
"""build_deck.py — renders a 16:9 slide deck from the same content/ JSON
that build.mjs renders the website from.

    python build/build_deck.py

Output: dist/ExamSoft-for-Course-Directors.pptx

One source of truth, two renderers. Editing content/ updates both the site and
the deck; there is no second copy of the training text to keep in sync.

Requires python-pptx (pip install python-pptx). Nothing else.

Slide text is DERIVED from each section, not duplicated. A section is
condensed by priority: callout titles first (they carry the highest signal),
then step titles, then list items. A section can override the derivation by
adding a "deck" object — see README.

Upload the result to Drive and open it as Google Slides; the structure,
palette, and images survive that conversion. Embedded video does not, which is
why video appears as link slides.
"""

import json
import re
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.util import Emu, Inches, Pt
except ImportError:
    sys.exit("python-pptx is not installed. Run: pip install python-pptx")

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DIST = ROOT / "dist"
IMGCACHE = DIST / "_img"


def optimized(path, max_w=1100, quality=84):
    """Downscale an image for slide use.

    The originals in images/ stay full resolution for the website. A 1431px
    photograph displayed across seven inches of a slide is wasted bytes, and it
    measurably slows the Drive upload and the Google Slides conversion. Cached
    on mtime so repeat builds are cheap.
    """
    from PIL import Image

    path = Path(path)
    IMGCACHE.mkdir(parents=True, exist_ok=True)
    out = IMGCACHE / f"{path.stem}.jpg"
    if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
        return out

    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)),
                           Image.LANCZOS)
        im.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    return out

# --- Palette -----------------------------------------------------------------
# Mirrors assets/css/tokens.css. If you change the tokens there, change these
# to match — they are the same design, rendered by a different engine.
BRAND = RGBColor(0x02, 0x47, 0x31)
BRAND_DK = RGBColor(0x01, 0x30, 0x1F)
BRAND_LT = RGBColor(0x6F, 0xC3, 0x9F)
SOFT = RGBColor(0xEE, 0xF5, 0xF1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK = RGBColor(0x14, 0x20, 0x1B)
MUTED = RGBColor(0x4A, 0x5A, 0x52)
FAINT = RGBColor(0x66, 0x75, 0x6D)
RULE = RGBColor(0xD3, 0xDE, 0xD8)

CRITICAL = RGBColor(0xA4, 0x20, 0x1A)
WARN = RGBColor(0x8A, 0x5A, 0x00)
NOTE = RGBColor(0x1C, 0x5B, 0x96)

TONE_COLOR = {
    "critical": CRITICAL,
    "warn": WARN,
    "note": NOTE,
    "jabsom": BRAND,
}
TONE_LABEL = {
    "critical": "CRITICAL",
    "warn": "WATCH OUT",
    "note": "NOTE",
    "jabsom": "JABSOM CONVENTION",
}

FONT = "Segoe UI"

# 16:9
SW = Inches(13.333)
SH = Inches(7.5)
M = Inches(0.85)          # side margin
CONTENT_W = SW - (2 * M)


# --- Text helpers ------------------------------------------------------------
def plain(text):
    """Strip the site's inline markup. Slides get flat text."""
    if text is None:
        return ""
    s = str(text)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)   # [label](url) -> label
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)          # **bold** -> bold
    s = s.replace("`", "")
    return re.sub(r"\s+", " ", s).strip()


def clip(text, limit):
    """Trim to a sentence boundary where possible, so bullets do not dangle."""
    t = plain(text)
    if len(t) <= limit:
        return t
    cut = t[:limit]
    for sep in (". ", "; ", ", "):
        i = cut.rfind(sep)
        if i > limit * 0.55:
            return cut[: i + 1].rstrip(" ;,")
    return cut.rsplit(" ", 1)[0].rstrip(" ,;:") + "..."


def textbox(slide, left, top, width, height, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def para(tf, text, size, color, bold=False, space_after=6,
         first=False, align=PP_ALIGN.LEFT, spacing=None, caps=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(space_after)
    if spacing:
        p.line_spacing = spacing
    run = p.add_run()
    run.text = text.upper() if caps else text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = FONT
    return p


def rect(slide, left, top, width, height, fill):
    from pptx.enum.shapes import MSO_SHAPE
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    shape.shadow.inherit = False
    return shape


def set_alt(shape, description):
    """python-pptx exposes no alt-text API, so write the descr attribute the
    OOXML way. Google Slides and PowerPoint both read it."""
    shape._element._nvXxPr.cNvPr.set("descr", description)


def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = plain(text)


# --- Slide builders ----------------------------------------------------------
def slide_title(prs, site):
    s = blank(prs)
    rect(s, 0, 0, SW, SH, BRAND)
    rect(s, 0, 0, Inches(0.22), SH, BRAND_LT)

    tf = textbox(s, M, Inches(1.5), CONTENT_W, Inches(3.2))
    para(tf, f"{site['institution']} · {site['office']}", 13, BRAND_LT,
         bold=True, first=True, caps=True, space_after=16)
    para(tf, site["title"], 46, WHITE, bold=True, space_after=12, spacing=1.0)
    para(tf, site["subtitle"], 19, SOFT, space_after=0, spacing=1.2)

    tf2 = textbox(s, M, Inches(5.45), CONTENT_W, Inches(1.3))
    para(tf2, "INSTITUTION ID", 11, BRAND_LT, bold=True, first=True, space_after=2)
    para(tf2, site["portal"]["institutionId"], 20, WHITE, bold=True, space_after=10)
    para(tf2, f"{site['portal']['edition']} portal · {site['academicYear']} · "
              f"Reviewed {site['reviewed']} · v{site['version']}",
         12, SOFT, space_after=0)

    notes(s, "Faculty counterpart to the student Examplify orientation deck. "
             "Generated from the training repository; do not edit slides by hand.")
    return s


def slide_overview(prs, sections):
    s = blank(prs)
    header(s, "OVERVIEW", "What this covers")

    half = (len(sections) + 1) // 2
    for col, group in enumerate((sections[:half], sections[half:])):
        left = M + col * (CONTENT_W / 2 + Inches(0.2))
        tf = textbox(s, left, Inches(2.1), CONTENT_W / 2 - Inches(0.2), Inches(4.6))
        for i, sec in enumerate(group):
            n = col * half + i + 1
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(11)
            r1 = p.add_run()
            r1.text = f"{n:02d}   "
            r1.font.size = Pt(13)
            r1.font.bold = True
            # BRAND, not BRAND_LT: the light green is for dark slides only and
            # falls well below AA contrast on white.
            r1.font.color.rgb = BRAND
            r1.font.name = FONT
            r2 = p.add_run()
            r2.text = plain(sec.get("navLabel") or sec["title"])
            r2.font.size = Pt(15)
            r2.font.color.rgb = INK
            r2.font.name = FONT
    return s


def header(slide, eyebrow, title, lede=None):
    """Standard content-slide header: caps eyebrow, title, rule, optional lede.
    Mirrors the student deck's structure."""
    tf = textbox(slide, M, Inches(0.62), CONTENT_W, Inches(1.5))
    para(tf, plain(eyebrow), 12, BRAND, bold=True, first=True,
         caps=True, space_after=6)
    para(tf, plain(title), 32, INK, bold=True, space_after=0, spacing=1.0)

    rect(slide, M, Inches(1.82), Inches(1.5), Emu(22860), BRAND)

    if lede:
        tf2 = textbox(slide, M, Inches(2.0), CONTENT_W * 0.82, Inches(0.7))
        para(tf2, clip(lede, 165), 15, MUTED, first=True, space_after=0, spacing=1.25)


def bullets(slide, items, top=Inches(2.85), size=15, width=None):
    tf = textbox(slide, M, top, width or CONTENT_W * 0.88, SH - top - Inches(0.7))
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(13)
        p.line_spacing = 1.22
        dot = p.add_run()
        dot.text = "—  "
        dot.font.size = Pt(size)
        dot.font.bold = True
        dot.font.color.rgb = BRAND
        dot.font.name = FONT
        run = p.add_run()
        run.text = item
        run.font.size = Pt(size)
        run.font.color.rgb = INK
        run.font.name = FONT


def slide_callout(prs, eyebrow, title, tone, headline, body):
    """A full-slide emphasis panel for the load-bearing rules."""
    s = blank(prs)
    color = TONE_COLOR.get(tone, NOTE)
    header(s, eyebrow, title)

    panel_top = Inches(2.4)
    panel_h = Inches(3.5)
    rect(s, M, panel_top, CONTENT_W, panel_h, SOFT if tone == "jabsom" else RGBColor(0xF7, 0xF8, 0xF8))
    rect(s, M, panel_top, Inches(0.07), panel_h, color)

    tf = textbox(s, M + Inches(0.5), panel_top + Inches(0.42),
                 CONTENT_W - Inches(1.0), panel_h - Inches(0.8))
    para(tf, TONE_LABEL.get(tone, "NOTE"), 11, color, bold=True, first=True,
         space_after=10)
    para(tf, plain(headline), 25, INK, bold=True, space_after=14, spacing=1.05)
    para(tf, clip(body, 420), 15, MUTED, space_after=0, spacing=1.3)
    return s


def slide_image(prs, eyebrow, title, image, alt, caption, flag=None):
    s = blank(prs)
    header(s, eyebrow, title)

    from PIL import Image
    src = optimized(image)
    with Image.open(src) as im:
        iw, ih = im.size

    avail_w = CONTENT_W * 0.62
    avail_h = Inches(3.9)
    scale = min(avail_w / iw, avail_h / ih)
    w, h = int(iw * scale), int(ih * scale)

    pic = s.shapes.add_picture(str(src), M, Inches(2.35), width=w, height=h)
    set_alt(pic, alt)

    tx = M + w + Inches(0.5)
    tf = textbox(s, tx, Inches(2.35), SW - tx - M, Inches(4.0))
    para(tf, clip(caption, 240), 14, INK, first=True, space_after=12, spacing=1.25)
    if flag:
        para(tf, "FLAGGED FOR REVIEW", 10, WARN, bold=True, space_after=4)
        para(tf, clip(flag, 260), 12, MUTED, space_after=0, spacing=1.2)

    notes(s, f"Alt text: {alt}")
    return s


def slide_image_pair(prs, eyebrow, title, items, caption):
    s = blank(prs)
    header(s, eyebrow, title)

    from PIL import Image
    gap = Inches(0.45)
    col_w = (CONTENT_W - gap) / 2
    top = Inches(2.35)

    for i, item in enumerate(items):
        path = optimized(ROOT / item["src"], max_w=900)
        with Image.open(path) as im:
            iw, ih = im.size
        scale = min(col_w / iw, Inches(3.3) / ih)
        w, h = int(iw * scale), int(ih * scale)
        left = int(M + i * (col_w + gap) + (col_w - w) / 2)
        pic = s.shapes.add_picture(str(path), left, top, width=w, height=h)
        set_alt(pic, item["alt"])

        tf = textbox(s, int(M + i * (col_w + gap)), top + h + Inches(0.16),
                     int(col_w), Inches(0.5))
        para(tf, plain(item["label"]), 13, INK, bold=True, first=True,
             space_after=0, align=PP_ALIGN.CENTER)

    tf = textbox(s, M, SH - Inches(0.95), CONTENT_W, Inches(0.5))
    para(tf, clip(caption, 190), 12, MUTED, first=True, space_after=0)
    notes(s, " | ".join(i["alt"] for i in items))
    return s


def slide_timeline(prs, eyebrow, title, items):
    s = blank(prs)
    header(s, eyebrow, title)

    n = len(items)
    gap = Inches(0.18)
    col_w = (CONTENT_W - gap * (n - 1)) / n
    top = Inches(2.5)

    for i, item in enumerate(items):
        left = int(M + i * (col_w + gap))
        rect(s, left, top, int(col_w), Inches(0.055), BRAND)
        tf = textbox(s, left, top + Inches(0.26), int(col_w), Inches(3.6))
        para(tf, plain(item["when"]), 11, BRAND, bold=True, first=True,
             caps=True, space_after=7, spacing=1.1)
        para(tf, plain(item["what"]), 15, INK, bold=True, space_after=6, spacing=1.1)
        para(tf, plain(item["who"]), 10, FAINT, bold=True, caps=True, space_after=8)
        para(tf, clip(item["detail"], 175), 11, MUTED, space_after=0, spacing=1.2)
    return s


def slide_table(prs, eyebrow, title, cols, rows, widths=None, note=None):
    s = blank(prs)
    header(s, eyebrow, title)

    top = Inches(2.3)
    avail_h = SH - top - (Inches(1.0) if note else Inches(0.55))
    shape = s.shapes.add_table(len(rows) + 1, len(cols), M, top,
                               int(CONTENT_W), int(avail_h))
    table = shape.table

    if widths:
        total = sum(widths)
        for i, frac in enumerate(widths):
            table.columns[i].width = int(CONTENT_W * frac / total)

    body_size = 11 if len(rows) > 8 else 12

    for c, label in enumerate(cols):
        cell = table.cell(0, c)
        cell.text = plain(label)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BRAND
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = cell.margin_right = Inches(0.11)
        p = cell.text_frame.paragraphs[0]
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.font.name = FONT

    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row):
            cell = table.cell(r, c)
            cell.text = plain(value)
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE if r % 2 else SOFT
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = cell.margin_right = Inches(0.11)
            cell.margin_top = cell.margin_bottom = Inches(0.045)
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(body_size)
            p.font.bold = c == 0
            p.font.color.rgb = INK if c == 0 else MUTED
            p.font.name = FONT

    if note:
        tf = textbox(s, M, SH - Inches(0.85), CONTENT_W, Inches(0.55))
        para(tf, clip(note, 210), 11, MUTED, first=True, space_after=0, spacing=1.2)
    return s


def slide_links(prs, eyebrow, title, entries, lede=None):
    s = blank(prs)
    header(s, eyebrow, title, lede)

    top = Inches(2.7) if lede else Inches(2.35)
    tf = textbox(s, M, top, CONTENT_W * 0.9, SH - top - Inches(0.6))
    for i, entry in enumerate(entries):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(4)
        run = p.add_run()
        run.text = plain(entry["label"])
        run.font.size = Pt(14)
        run.font.bold = True
        run.font.color.rgb = INK
        run.font.name = FONT

        p2 = tf.add_paragraph()
        p2.space_after = Pt(12)
        r2 = p2.add_run()
        r2.text = entry["url"]
        r2.font.size = Pt(11)
        r2.font.color.rgb = BRAND
        r2.font.name = FONT
        try:
            r2.hyperlink.address = entry["url"]
        except Exception:
            pass

        if entry.get("note"):
            p3 = tf.add_paragraph()
            p3.space_after = Pt(14)
            r3 = p3.add_run()
            r3.text = clip(entry["note"], 150)
            r3.font.size = Pt(11)
            r3.font.color.rgb = MUTED
            r3.font.name = FONT
    return s


def slide_section(prs, section, index):
    """Generic section slide. Bullets are derived, highest-signal first."""
    s = blank(prs)
    header(s, f"Section {index:02d}", section["title"], section.get("lede"))

    override = (section.get("deck") or {}).get("bullets")
    items = [clip(b, 150) for b in override] if override else derive_bullets(section)
    bullets(s, items[:5])
    return s


def derive_bullets(section):
    """Condense a section for a slide. Callout titles carry the most signal, so
    they come first; then procedure step titles; then plain list items."""
    picked, seen = [], set()

    def add(text, limit=150):
        t = clip(text, limit)
        key = t.lower()[:45]
        if t and key not in seen:
            seen.add(key)
            picked.append(t)

    for tone in ("critical", "jabsom", "warn"):
        for b in section["blocks"]:
            if b.get("type") == "callout" and b.get("tone") == tone and b.get("title"):
                add(b["title"])

    for b in section["blocks"]:
        if b.get("type") == "steps":
            for item in b["items"]:
                add(item["t"], 90)
        elif b.get("type") == "kv":
            for item in b["items"]:
                add(f"{plain(item['k'])}: {plain(item['v'])}", 110)

    if len(picked) < 4:
        for b in section["blocks"]:
            if b.get("type") == "ul":
                for item in b["items"]:
                    add(item)
            elif b.get("type") == "p" and len(picked) < 3:
                add(b["text"], 165)

    return picked


def slide_contacts(prs, site):
    s = blank(prs)
    header(s, "SUPPORT", "Who to contact")

    gap = Inches(0.4)
    n = len(site["contacts"])
    col_w = (CONTENT_W - gap * (n - 1)) / n

    for i, c in enumerate(site["contacts"]):
        left = int(M + i * (col_w + gap))
        rect(s, left, Inches(2.4), int(col_w), Inches(2.5), SOFT)
        tf = textbox(s, left + Inches(0.35), Inches(2.72),
                     int(col_w - Inches(0.7)), Inches(2.0))
        para(tf, plain(c["role"]), 10, BRAND, bold=True, first=True,
             caps=True, space_after=8)
        para(tf, plain(c["name"]), 20, INK, bold=True, space_after=3)
        para(tf, plain(c["org"]), 11, FAINT, space_after=8)
        para(tf, c["email"], 13, BRAND, bold=True, space_after=8)
        para(tf, clip(c["note"], 120), 11, MUTED, space_after=0, spacing=1.2)

    tf = textbox(s, M, Inches(5.35), CONTENT_W, Inches(1.2))
    para(tf, "VENDOR TICKETS", 11, CRITICAL, bold=True, first=True, space_after=6)
    para(tf, clip(site["vendorTicketPolicy"], 320), 14, INK,
         space_after=0, spacing=1.25)
    return s


def slide_closing(prs, site):
    s = blank(prs)
    rect(s, 0, 0, SW, SH, BRAND)
    rect(s, 0, 0, Inches(0.22), SH, BRAND_LT)
    tf = textbox(s, M, Inches(2.6), CONTENT_W, Inches(2.4))
    para(tf, "Mahalo", 54, WHITE, bold=True, first=True, space_after=18)
    para(tf, f"Questions any time at {site['contacts'][0]['email']}",
         19, SOFT, space_after=16)
    para(tf, f"This deck is generated from the training repository. "
             f"Reviewed {site['reviewed']}, v{site['version']}.",
         12, BRAND_LT, space_after=0)
    return s


# --- Assembly ----------------------------------------------------------------
def find(section, block_type, **match):
    for b in section["blocks"]:
        if b.get("type") != block_type:
            continue
        if all(b.get(k) == v for k, v in match.items()):
            return b
    return None


def main():
    site = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    files = sorted((CONTENT / "sections").glob("*.json"))
    sections = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    by_id = {s["id"]: s for s in sections}

    prs = Presentation()
    prs.slide_width = SW
    prs.slide_height = SH

    slide_title(prs, site)
    slide_overview(prs, sections)

    for index, section in enumerate(sections, start=1):
        sid = section["id"]
        slide_section(prs, section, index)

        # Purpose-built slides that a generic bullet list would flatten.
        if sid == "account":
            slide_callout(prs, "Account and sign-in", "When sign-in fails",
                          "warn",
                          "\"No associated ExamSoft account found\"",
                          "The External ID on the ExamSoft account does not match what UH "
                          "single sign-on is sending. It is not a password problem and an "
                          "incognito window will not help. It is an admin-side fix — email "
                          "OME and it gets corrected in the portal.")

        elif sid == "preferences":
            fig = find(section, "figure")
            slide_image(prs, "First thing you do", "My Preferences: Arial 12",
                        ROOT / fig["src"], fig["alt"], fig["caption"], fig.get("flag"))

        elif sid == "exam-cycle":
            tl = find(section, "timeline")
            slide_timeline(prs, "The JABSOM exam cycle", "How an exam gets delivered",
                           tl["items"])
            slide_callout(prs, "The JABSOM exam cycle", "The deadline",
                          "critical",
                          "Draft due 7 business days before the exam",
                          "Preview, review, correction, re-preview, printing two hard "
                          "copies, and proctor preparation are sequential and need the "
                          "full window. A late draft compresses proofing, not the exam "
                          "date. It is more than just clicking a button.")

        elif sid == "question-types":
            table = find(section, "table")
            slide_table(prs, "Question types", "What is available, and what OME prefers",
                        table["cols"], table["rows"], widths=[1.1, 1.0, 2.6])
            fig = find(section, "figure")
            slide_image(prs, "Question types", "Hot Spot",
                        ROOT / fig["src"], fig["alt"], fig["caption"])
            pair = find(section, "figurepair")
            slide_image_pair(prs, "Question types", "Drag and Drop",
                             pair["items"], pair["caption"])
            slide_callout(prs, "Question types", "Two things people get wrong",
                          "critical",
                          "Drag and Drop is not an ordering question",
                          "The sequence a student drags answers in does not matter. "
                          "Separately, partial credit here subtracts: a wrong answer "
                          "dragged in loses the same points a right one gains, floored "
                          "at zero. Say so in the stem.")

        elif sid == "attachments":
            table = find(section, "table")
            slide_table(prs, "Attachments and media", "Per-file limits",
                        table["cols"], table["rows"], widths=[1.0, 1.5, 0.9, 2.2],
                        note="200 MB total per assessment, covering all attachments "
                             "and inline images combined. Assessment level accepts "
                             "exactly one file; question level accepts several.")

        elif sid == "building":
            table = find(section, "table")
            slide_table(prs, "Building an assessment", "Duplicate or repost",
                        table["cols"], table["rows"], widths=[1.3, 1.6, 1.6],
                        note="For a new academic year, duplicate. Reposting folds this "
                             "year's results into last year's reports.")

        elif sid == "posting":
            table = find(section, "table")
            slide_table(prs, "Posting an assessment", "The posting fields",
                        table["cols"], table["rows"], widths=[1.1, 1.5, 2.0])
            slide_callout(prs, "Posting an assessment", "After the first download",
                          "critical",
                          "Posted plus one download means the content is frozen",
                          "Once an assessment is posted and at least one student has "
                          "downloaded it, questions and answer keys can no longer be "
                          "altered. An error found after that becomes a scoring "
                          "adjustment, not an edit. Never send the password to students.")

        elif sid == "permissions":
            table = find(section, "table")
            slide_table(prs, "Your account", "Standard Main Access Rights",
                        table["cols"], table["rows"], widths=[1.1, 1.3, 2.6],
                        note="Grading stays unchecked. Checking it turns the account "
                             "into a grader-only account and removes the access a "
                             "course director needs.")

        elif sid == "video":
            video = find(section, "video")
            slide_callout(prs, "Video training", "The vendor's videos are gone",
                          "critical",
                          "ExamSoft removed its Legacy training videos",
                          "The Hot Spot and Drag-and-Drop video cited in the 2023 "
                          "onboarding document has been removed from YouTube, its "
                          "playlist is empty, and the ExamSoft Training channel has no "
                          "content. Even live vendor articles still link to removed "
                          "videos. The written Legacy articles are current — use those.")
            slide_links(prs, "Video training", "What is available",
                        [{"label": video["title"],
                          "url": video["url"],
                          "note": video["statusNote"]}],
                        lede="Checked 17 September 2026.")

        elif sid == "help":
            table = find(section, "table")
            slide_table(prs, "Getting help", "Where to take a problem",
                        table["cols"], table["rows"], widths=[2.2, 1.3])
            slide_contacts(prs, site)

    slide_closing(prs, site)

    DIST.mkdir(exist_ok=True)
    out = DIST / "ExamSoft-for-Course-Directors.pptx"
    prs.save(out)
    print(f"Built {out.relative_to(ROOT)} — {len(prs.slides._sldIdLst)} slides")
    print(f"From {len(sections)} sections in content/sections/")


if __name__ == "__main__":
    main()
