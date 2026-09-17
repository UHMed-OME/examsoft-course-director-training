/* ==========================================================================
   build.mjs — renders index.html from the JSON in content/.
   Zero dependencies. Node 18 or newer.

     node build/build.mjs

   Content is never edited in markup. To change the training, edit the JSON
   in content/ and re-run this. See README.md.
   ========================================================================== */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");

/* --- Escaping and inline markup ----------------------------------------- */

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* Only http(s), mailto, and in-page anchors are allowed through. Anything
   else becomes inert text, so a bad content edit cannot inject a script URL. */
const safeHref = (url) => {
  const raw = String(url).trim();
  return /^(https?:\/\/|mailto:|#|\.{0,2}\/|images\/)/i.test(raw) ? escapeHtml(raw) : "";
};

/* Supports **bold**, `code`, and [text](url). Deliberately small — the
   content files are prose, not a markup playground. Escaping happens first,
   so authored angle brackets are always literal. */
const inline = (text) => {
  if (text == null) return "";
  let out = escapeHtml(text);

  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const href = safeHref(url);
    if (!href) return label;
    const external = /^https?:/i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${href}"${attrs}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`);

  return out;
};

/* --- Callout tones ------------------------------------------------------- */

const TONES = {
  critical: { cls: "critical", label: "Critical" },
  warn: { cls: "warn", label: "Watch out" },
  note: { cls: "note", label: "Note" },
  jabsom: { cls: "jabsom", label: "JABSOM convention" },
};

/* --- Block renderers ---------------------------------------------------- */

const renderers = {
  p: (b) => `<p>${inline(b.text)}</p>`,

  h3: (b) => `<h3>${inline(b.text)}</h3>`,

  h4: (b) => `<h4>${inline(b.text)}</h4>`,

  ul: (b) => `<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`,

  ol: (b) => `<ol>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</ol>`,

  steps: (b) => `
    <ol class="steps">
      ${b.items
        .map(
          (s) => `<li>
            <span class="steps__t">${inline(s.t)}</span>
            <span class="steps__d">${inline(s.d)}</span>
          </li>`
        )
        .join("")}
    </ol>`,

  timeline: (b) => `
    <ol class="timeline">
      ${b.items
        .map(
          (t) => `<li>
            <span class="timeline__when">${inline(t.when)}</span>
            <span class="timeline__what">${inline(t.what)}</span>
            <span class="timeline__who">${inline(t.who)}</span>
            <p class="timeline__detail">${inline(t.detail)}</p>
          </li>`
        )
        .join("")}
    </ol>`,

  callout: (b) => {
    const tone = TONES[b.tone] || TONES.note;
    return `
      <aside class="callout callout--${tone.cls}">
        <span class="callout__label">${escapeHtml(tone.label)}</span>
        ${b.title ? `<p class="callout__title">${inline(b.title)}</p>` : ""}
        <p>${inline(b.text)}</p>
      </aside>`;
  },

  /* Rendered as a callout so a maintainer note is impossible to miss, and
     so it survives into the printed PDF. */
  todo: (b) => `
    <aside class="callout callout--todo">
      <span class="callout__label">To do &mdash; maintainer</span>
      <p>${inline(b.text)}</p>
    </aside>`,

  table: (b) => `
    <div class="table-wrap">
      <table>
        ${b.caption ? `<caption>${inline(b.caption)}</caption>` : ""}
        <thead>
          <tr>${b.cols.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${b.rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell, index) =>
                    index === 0
                      ? `<th scope="row">${inline(cell)}</th>`
                      : `<td>${inline(cell)}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`,

  figure: (b) => `
    <figure>
      <img src="${safeHref(b.src)}" alt="${escapeHtml(b.alt)}"${
        b.width ? ` width="${escapeHtml(b.width)}"` : ""
      }${b.height ? ` height="${escapeHtml(b.height)}"` : ""} loading="lazy" decoding="async">
      <figcaption>
        ${inline(b.caption)}
        ${b.note ? `<span class="figure__source">${inline(b.note)}</span>` : ""}
        ${b.source ? `<span class="figure__source">Source: ${inline(b.source)}</span>` : ""}
        ${
          b.flag
            ? `<span class="figure__flag"><strong>Flagged for review:</strong> ${inline(b.flag)}</span>`
            : ""
        }
      </figcaption>
    </figure>`,

  figurepair: (b) => `
    <figure>
      <div class="figurepair">
        ${b.items
          .map(
            (item) => `<figure class="figurepair__item">
              <img src="${safeHref(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">
              <figcaption class="figurepair__label">${inline(item.label)}</figcaption>
            </figure>`
          )
          .join("")}
      </div>
      <figcaption>
        ${inline(b.caption)}
        ${b.source ? `<span class="figure__source">Source: ${inline(b.source)}</span>` : ""}
      </figcaption>
    </figure>`,

  /* An embed is only emitted when the content explicitly sets embed:true.
     The default is a link card, so an inaccessible or removed video never
     renders as a dead player. */
  video: (b) => {
    const status = b.status && b.status !== "ok"
      ? `<span class="video__status video__status--${escapeHtml(b.status)}">${escapeHtml(
          b.status === "restricted" ? "Access restricted" : "Removed"
        )}</span>`
      : "";

    let frame = "";
    if (b.embed) {
      const src =
        b.provider === "drive"
          ? `https://drive.google.com/file/d/${encodeURIComponent(b.id)}/preview`
          : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.id)}${
              b.start ? `?start=${encodeURIComponent(b.start)}` : ""
            }`;
      frame = `
        <div class="video__frame">
          <iframe src="${escapeHtml(src)}" title="${escapeHtml(b.title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>`;
    }

    return `
      <div class="video">
        ${frame}
        <div class="video__body">
          <p class="video__title">${inline(b.title)}</p>
          ${status}
          ${b.recorded ? `<p class="video__meta">Recorded ${inline(b.recorded)}</p>` : ""}
          ${b.note ? `<p>${inline(b.note)}</p>` : ""}
          ${b.statusNote ? `<p>${inline(b.statusNote)}</p>` : ""}
          ${
            b.url
              ? `<p><a class="btn" href="${safeHref(b.url)}" target="_blank" rel="noopener noreferrer">Open the recording</a></p>
                 <p class="video__print-note">Recording: ${escapeHtml(b.url)}</p>`
              : ""
          }
        </div>
      </div>`;
  },

  links: (b) => `
    <div class="links">
      ${b.title ? `<p class="links__heading">${inline(b.title)}</p>` : ""}
      <ul>
        ${b.items
          .map(
            (item) => `<li>
              <a href="${safeHref(item.url)}" target="_blank" rel="noopener noreferrer">${inline(
              item.label
            )}</a>
              ${item.note ? `<span class="links__note">${inline(item.note)}</span>` : ""}
            </li>`
          )
          .join("")}
      </ul>
    </div>`,

  kv: (b) => `
    ${b.title ? `<h3>${inline(b.title)}</h3>` : ""}
    <dl class="kv">
      ${b.items
        .map((i) => `<dt>${inline(i.k)}</dt><dd>${inline(i.v)}</dd>`)
        .join("")}
    </dl>`,

  /* Pulls from site.json so contact details live in exactly one place. */
  contacts: (_b, site) => `
    <div class="contacts">
      ${site.contacts
        .map(
          (c) => `<div class="contact">
            <p class="contact__role">${inline(c.role)}</p>
            <p class="contact__name">${inline(c.name)}</p>
            <p class="contact__org">${inline(c.org)}</p>
            <p><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></p>
            ${c.note ? `<p class="contact__note">${inline(c.note)}</p>` : ""}
          </div>`
        )
        .join("")}
    </div>`,
};

const renderBlock = (block, site) => {
  const fn = renderers[block.type];
  if (!fn) {
    throw new Error(
      `Unknown block type "${block.type}". Add a renderer in build/build.mjs or fix the content file.`
    );
  }
  return fn(block, site);
};

/* --- Page --------------------------------------------------------------- */

const renderSection = (section, index, site) => `
  <section class="section" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(
  section.id
)}-h">
    <header class="section__head">
      <span class="section__num">Section ${String(index + 1).padStart(2, "0")}</span>
      <h2 id="${escapeHtml(section.id)}-h">${inline(section.title)}<a class="section-permalink" href="#${escapeHtml(
  section.id
)}" aria-label="Link to this section">#</a></h2>
      ${section.lede ? `<p class="section__lede">${inline(section.lede)}</p>` : ""}
    </header>
    ${section.blocks.map((b) => renderBlock(b, site)).join("\n")}
  </section>`;

const renderPage = (site, sections) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(site.title)} — ${escapeHtml(site.institutionShort)}</title>
<meta name="description" content="${escapeHtml(site.subtitle)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/styles.css">
<link rel="stylesheet" href="assets/css/print.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="topbar">
  <span class="topbar__title">${escapeHtml(site.title)}</span>
  <button class="btn-icon" type="button" data-nav-toggle aria-expanded="true" aria-controls="sidebar">
    Contents
  </button>
</header>

<div class="layout">
  <nav class="sidebar" id="sidebar" aria-label="Sections">
    <a class="sidebar__brand" href="#main">${escapeHtml(site.title)}</a>
    <p class="sidebar__sub">${escapeHtml(site.institutionShort)} ${escapeHtml(site.office)}</p>
    <p class="toc-heading">Contents</p>
    <ol class="toc">
      ${sections
        .map(
          (s) =>
            `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.navLabel || s.title)}</a></li>`
        )
        .join("")}
    </ol>
  </nav>

  <main class="content" id="main">
    <div class="cover">
      <p class="cover__eyebrow">${escapeHtml(site.institution)} &middot; ${escapeHtml(
  site.office
)}</p>
      <h1>${escapeHtml(site.title)}</h1>
      <p class="cover__sub">${escapeHtml(site.subtitle)}</p>
      <dl class="cover__meta">
        <div><dt>Portal</dt><dd>${escapeHtml(site.portal.edition)}</dd></div>
        <div><dt>Institution ID</dt><dd><code>${escapeHtml(
          site.portal.institutionId
        )}</code></dd></div>
        <div><dt>Academic year</dt><dd>${escapeHtml(site.academicYear)}</dd></div>
        <div><dt>Last reviewed</dt><dd>${escapeHtml(site.reviewed)}</dd></div>
        <div><dt>Version</dt><dd>${escapeHtml(site.version)}</dd></div>
      </dl>
      <p class="cover__audience">${escapeHtml(site.audienceNote)}</p>
    </div>

    <nav class="print-toc" aria-label="Contents">
      <h2>Contents</h2>
      <ol>
        ${sections.map((s) => `<li>${escapeHtml(s.navLabel || s.title)}</li>`).join("")}
      </ol>
    </nav>

    ${sections.map((s, i) => renderSection(s, i, site)).join("\n")}

    <footer class="footer">
      <p>${escapeHtml(site.portal.editionNote)}</p>
      <p>${escapeHtml(site.vendorTicketPolicy)}</p>
      <p>${escapeHtml(site.footerNote)} Last reviewed ${escapeHtml(
  site.reviewed
)}, version ${escapeHtml(site.version)}.</p>
    </footer>
  </main>
</div>

<button class="btn-icon theme-toggle" type="button" data-theme-toggle aria-pressed="false" hidden>
  <span data-theme-label>Dark</span> mode
</button>

<script src="assets/js/site.js" defer></script>
</body>
</html>
`;

/* --- Run ---------------------------------------------------------------- */

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${path}: ${error.message}`);
  }
};

const main = async () => {
  const site = await readJson(join(CONTENT, "site.json"));

  const dir = join(CONTENT, "sections");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

  if (!files.length) throw new Error("No section files found in content/sections/.");

  const sections = [];
  for (const file of files) {
    const section = await readJson(join(dir, file));
    for (const key of ["id", "title", "blocks"]) {
      if (!section[key]) throw new Error(`${file} is missing required key "${key}".`);
    }
    sections.push(section);
  }

  const ids = sections.map((s) => s.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new Error(`Duplicate section id "${duplicate}".`);

  const html = renderPage(site, sections);
  await writeFile(join(ROOT, "index.html"), html, "utf8");

  console.log(`Built index.html — ${sections.length} sections, ${html.length} bytes`);
  console.log(`Sections: ${files.join(", ")}`);
};

main().catch((error) => {
  console.error(`\nBuild failed: ${error.message}\n`);
  process.exit(1);
});
