/* ==========================================================================
   build.mjs — renders the site from the JSON in content/.
   Zero dependencies. Node 18 or newer.

     node build/build.mjs

   Emits two pages:
     index.html        the onboarding path, from content/home.json
     docs/index.html   the full reference, from content/sections/*.json

   Content is never edited in markup. To change the training, edit the JSON in
   content/ and re-run this. See README.md.
   ========================================================================== */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");

/* Relative-path prefix for the page currently being rendered. "" at the repo
   root, "../" for anything one directory down. Set by renderPage. */
let BASE = "";

/* --- Escaping and inline markup ----------------------------------------- */

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* Reject anything carrying a scheme other than http, https, or mailto. That
   blocks javascript: and data: while leaving every relative path usable. */
const safeHref = (url) => {
  const raw = String(url).trim();
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return "";
  return escapeHtml(raw);
};

/* Prefix a repo-relative asset path for the page being rendered. */
const asset = (path) => {
  const raw = String(path).trim();
  if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(raw)) return safeHref(raw);
  return escapeHtml(BASE + raw);
};

/* Supports **bold**, `code`, and [text](url). Deliberately small: the content
   files are prose, not a markup playground. Escaping runs first, so authored
   angle brackets stay literal. */
const inline = (text) => {
  if (text == null) return "";
  let out = escapeHtml(text);

  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const href = /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url) ? safeHref(url) : asset(url);
    if (!href) return label;
    const external = /^https?:/i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${href}"${attrs}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`);
  out = out.replace(/\*([^*]+)\*/g, (_, em) => `<em>${em}</em>`);

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

  /* Rendered as a callout so a maintainer note is impossible to miss, and so
     it survives into the printed PDF. */
  todo: (b) => `
    <aside class="callout callout--todo">
      <span class="callout__label">To do, maintainer</span>
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
      <img src="${asset(b.src)}" alt="${escapeHtml(b.alt)}" loading="lazy" decoding="async">
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
              <img src="${asset(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">
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

  /* An embed is only emitted when the content sets embed:true. The default is
     a link card, so an inaccessible or removed video never renders as a dead
     player. */
  video: (b) => {
    const status =
      b.status && b.status !== "ok"
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
      ${b.items.map((i) => `<dt>${inline(i.k)}</dt><dd>${inline(i.v)}</dd>`).join("")}
    </dl>`,

  /* Pulls from site.json so contact details live in exactly one place. */
  contacts: (_b, ctx) => `
    <div class="contacts">
      ${ctx.site.contacts
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

  /* Generated from the section files, so adding a section adds a card here
     without anyone remembering to update the home page. */
  doccards: (b, ctx) => `
    ${b.title ? `<h3>${inline(b.title)}</h3>` : ""}
    <ul class="doccards">
      ${ctx.sections
        .map(
          (s, i) => `<li class="doccard">
            <a class="doccard__link" href="${asset("docs/")}#${escapeHtml(s.id)}">
              <span class="doccard__num">${String(i + 1).padStart(2, "0")}</span>
              <span class="doccard__title">${escapeHtml(s.navLabel || s.title)}</span>
            </a>
            ${s.lede ? `<p class="doccard__lede">${escapeHtml(s.lede)}</p>` : ""}
          </li>`
        )
        .join("")}
    </ul>`,
};

const renderBlock = (block, ctx) => {
  const fn = renderers[block.type];
  if (!fn) {
    throw new Error(
      `Unknown block type "${block.type}". Add a renderer in build/build.mjs or fix the content file.`
    );
  }
  return fn(block, ctx);
};

/* --- Page shell --------------------------------------------------------- */

const shell = ({ title, description, body, extraClass = "" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="${asset("assets/css/tokens.css")}">
<link rel="stylesheet" href="${asset("assets/css/styles.css")}">
<link rel="stylesheet" href="${asset("assets/css/print.css")}">
</head>
<body class="${extraClass}">
<a class="skip-link" href="#main">Skip to content</a>
${body}
<button class="btn-icon theme-toggle" type="button" data-theme-toggle aria-pressed="false" hidden>
  <span data-theme-label>Dark</span> mode
</button>
<script src="${asset("assets/js/site.js")}" defer></script>
</body>
</html>
`;

const footer = (site) => `
  <footer class="footer">
    <p>${escapeHtml(site.portal.editionNote)}</p>
    <p>${escapeHtml(site.vendorTicketPolicy)}</p>
    <p>${escapeHtml(site.footerNote)} Last reviewed ${escapeHtml(site.reviewed)}, version ${escapeHtml(
  site.version
)}.</p>
  </footer>`;

/* --- Home (onboarding) -------------------------------------------------- */

const renderHome = (site, home, sections) => {
  BASE = "";
  const ctx = { site, sections };

  const body = `
<div class="layout layout--single">
  <main class="content" id="main">
    <div class="cover">
      <p class="cover__eyebrow">${escapeHtml(site.institution)} &middot; ${escapeHtml(
    site.office
  )}</p>
      <h1>${escapeHtml(site.title)}</h1>
      <p class="cover__sub">${escapeHtml(home.lede)}</p>
      <dl class="cover__meta">
        <div><dt>Portal</dt><dd><a href="${safeHref(site.portal.url)}" target="_blank" rel="noopener noreferrer">Sign in</a></dd></div>
        <div><dt>Institution ID</dt><dd><code>${escapeHtml(site.portal.institutionId)}</code></dd></div>
        <div><dt>Edition</dt><dd>${escapeHtml(site.portal.edition)}</dd></div>
        <div><dt>Academic year</dt><dd>${escapeHtml(site.academicYear)}</dd></div>
        <div><dt>Last reviewed</dt><dd>${escapeHtml(site.reviewed)}</dd></div>
      </dl>
    </div>
    ${home.blocks.map((b) => renderBlock(b, ctx)).join("\n")}
    ${footer(site)}
  </main>
</div>`;

  return shell({
    title: `${site.title} — ${site.institutionShort}`,
    description: site.subtitle,
    body,
    extraClass: "page-home",
  });
};

/* --- Docs (reference) --------------------------------------------------- */

const renderSection = (section, index, ctx) => `
  <section class="section" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(
  section.id
)}-h">
    <header class="section__head">
      <span class="section__num">Section ${String(index + 1).padStart(2, "0")}</span>
      <h2 id="${escapeHtml(section.id)}-h">${inline(
  section.title
)}<a class="section-permalink" href="#${escapeHtml(section.id)}" aria-label="Link to this section">#</a></h2>
      ${section.lede ? `<p class="section__lede">${inline(section.lede)}</p>` : ""}
    </header>
    ${section.blocks.map((b) => renderBlock(b, ctx)).join("\n")}
  </section>`;

const renderDocs = (site, sections) => {
  BASE = "../";
  const ctx = { site, sections };

  const body = `
<header class="topbar">
  <span class="topbar__title">${escapeHtml(site.docsTitle)}</span>
  <button class="btn-icon" type="button" data-nav-toggle aria-expanded="true" aria-controls="sidebar">
    Contents
  </button>
</header>

<div class="layout">
  <nav class="sidebar" id="sidebar" aria-label="Sections">
    <a class="sidebar__brand" href="${asset("")}">&larr; ${escapeHtml(site.title)}</a>
    <p class="sidebar__sub">${escapeHtml(site.institutionShort)} ${escapeHtml(site.office)}</p>
    <p class="toc-heading">Contents</p>
    <ol class="toc">
      ${sections
        .map((s) => `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.navLabel || s.title)}</a></li>`)
        .join("")}
    </ol>
  </nav>

  <main class="content" id="main">
    <div class="cover">
      <p class="cover__eyebrow">${escapeHtml(site.institution)} &middot; ${escapeHtml(
    site.office
  )}</p>
      <h1>${escapeHtml(site.docsTitle)}</h1>
      <p class="cover__sub">${escapeHtml(site.docsSubtitle)}</p>
      <p class="cover__audience">${escapeHtml(site.audienceNote)}</p>
    </div>

    <nav class="print-toc" aria-label="Contents">
      <h2>Contents</h2>
      <ol>
        ${sections.map((s) => `<li>${escapeHtml(s.navLabel || s.title)}</li>`).join("")}
      </ol>
    </nav>

    ${sections.map((s, i) => renderSection(s, i, ctx)).join("\n")}
    ${footer(site)}
  </main>
</div>`;

  return shell({
    title: `${site.docsTitle} — ${site.institutionShort}`,
    description: site.docsSubtitle,
    body,
  });
};

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
  const home = await readJson(join(CONTENT, "home.json"));

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

  const homeHtml = renderHome(site, home, sections);
  await writeFile(join(ROOT, "index.html"), homeHtml, "utf8");

  const docsHtml = renderDocs(site, sections);
  await mkdir(join(ROOT, "docs"), { recursive: true });
  await writeFile(join(ROOT, "docs", "index.html"), docsHtml, "utf8");

  console.log(`Built index.html      — onboarding, ${homeHtml.length} bytes`);
  console.log(`Built docs/index.html — ${sections.length} sections, ${docsHtml.length} bytes`);
};

main().catch((error) => {
  console.error(`\nBuild failed: ${error.message}\n`);
  process.exit(1);
});
