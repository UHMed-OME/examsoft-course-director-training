/* build.mjs — renders the site from content/*.json. Zero dependencies. */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
let BASE = "";

const esc = (v) => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const safeHref = (url) => {
  const raw = String(url).trim();
  const m = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (m && !/^(https?|mailto)$/i.test(m[1])) return "";
  return esc(raw);
};

const asset = (p) => {
  const raw = String(p).trim();
  if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(raw)) return safeHref(raw);
  return esc(BASE + raw);
};

const inline = (text) => {
  if (text == null) return "";
  let o = esc(text);
  o = o.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  o = o.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url) ? safeHref(url) : asset(url);
    if (!href) return label;
    const ext = /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${href}"${ext}>${label}</a>`;
  });
  o = o.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  o = o.replace(/\*([^*]+)\*/g, (_, e) => `<em>${e}</em>`);
  return o;
};

const TONES = {
  critical: { cls: "critical", label: "Critical" },
  warn:     { cls: "warn",     label: "Watch out" },
  note:     { cls: "note",     label: "Note" },
  jabsom:   { cls: "jabsom",   label: "JABSOM convention" },
};

const renderers = {
  p:    (b) => `<p>${inline(b.text)}</p>`,
  h3:   (b) => `<h3>${inline(b.text)}</h3>`,
  h4:   (b) => `<h4>${inline(b.text)}</h4>`,
  ul:   (b) => `<ul>${b.items.map(i => `<li>${inline(i)}</li>`).join("")}</ul>`,
  ol:   (b) => `<ol>${b.items.map(i => `<li>${inline(i)}</li>`).join("")}</ol>`,

  localvideo: (b) => `<div class="local-video">
    <video controls preload="metadata" playsinline${b.poster ? ` poster="${asset(b.poster)}"` : ""}>
      <source src="${asset(b.src)}" type="${esc(b.type || "video/mp4")}">
    </video>
    ${b.caption ? `<p class="local-video__caption">${inline(b.caption)}</p>` : ""}
  </div>`,

  steps: (b) => `<ol class="steps">${b.items.map(s =>
    `<li><span class="steps__t">${inline(s.t)}</span><span class="steps__d">${inline(s.d)}</span>${
      s.fig ? `<figure class="steps__fig"><img src="${asset(s.fig.src)}" alt="${esc(s.fig.alt)}" loading="lazy" decoding="async"><figcaption>${inline(s.fig.caption || "")}</figcaption></figure>` : ""
    }</li>`
  ).join("")}</ol>`,

  timeline: (b) => `<ol class="timeline">${b.items.map(t =>
    `<li><span class="timeline__when">${inline(t.when)}</span>
     <span class="timeline__what">${inline(t.what)}</span>
     <span class="timeline__who">${inline(t.who)}</span>
     <p class="timeline__detail">${inline(t.detail)}</p></li>`
  ).join("")}</ol>`,

  callout: (b) => {
    const t = TONES[b.tone] || TONES.note;
    return `<aside class="callout callout--${t.cls}">
      <span class="callout__label">${esc(t.label)}</span>
      ${b.title ? `<p class="callout__title">${inline(b.title)}</p>` : ""}
      <p>${inline(b.text)}</p></aside>`;
  },

  todo: (b) => `<aside class="callout callout--todo">
    <span class="callout__label">To do, maintainer</span>
    <p>${inline(b.text)}</p></aside>`,

  table: (b) => `<div class="table-wrap"><table>
    ${b.caption ? `<caption>${inline(b.caption)}</caption>` : ""}
    <thead><tr>${b.cols.map(c => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead>
    <tbody>${b.rows.map(row => `<tr>${row.map((cell, i) =>
      i === 0 ? `<th scope="row">${inline(cell)}</th>` : `<td>${inline(cell)}</td>`
    ).join("")}</tr>`).join("")}</tbody></table></div>`,

  figure: (b) => `<figure>
    <img src="${asset(b.src)}" alt="${esc(b.alt)}" loading="lazy" decoding="async">
    <figcaption>${inline(b.caption)}
      ${b.note ? `<span class="figure__source">${inline(b.note)}</span>` : ""}
      ${b.source ? `<span class="figure__source">Source: ${inline(b.source)}</span>` : ""}
      ${b.flag ? `<span class="figure__flag"><strong>Flagged:</strong> ${inline(b.flag)}</span>` : ""}
    </figcaption></figure>`,

  figurepair: (b) => `<figure><div class="figurepair">
    ${b.items.map(it => `<figure class="figurepair__item">
      <img src="${asset(it.src)}" alt="${esc(it.alt)}" loading="lazy" decoding="async">
      <figcaption class="figurepair__label">${inline(it.label)}</figcaption>
    </figure>`).join("")}</div>
    <figcaption>${inline(b.caption)}
      ${b.source ? `<span class="figure__source">Source: ${inline(b.source)}</span>` : ""}
    </figcaption></figure>`,

  video: (b) => {
    const status = b.status && b.status !== "ok"
      ? `<span class="video__status video__status--${esc(b.status)}">${esc(b.status === "restricted" ? "Access restricted" : "Removed")}</span>` : "";
    let frame = "";
    if (b.embed) {
      const src = b.provider === "drive"
        ? `https://drive.google.com/file/d/${encodeURIComponent(b.id)}/preview`
        : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.id)}${b.start ? `?start=${encodeURIComponent(b.start)}` : ""}`;
      frame = `<div class="video__frame"><iframe src="${esc(src)}" title="${esc(b.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<div class="video">${frame}<div class="video__body">
      <p class="video__title">${inline(b.title)}</p>${status}
      ${b.recorded ? `<p class="video__meta">Recorded ${inline(b.recorded)}</p>` : ""}
      ${b.note ? `<p>${inline(b.note)}</p>` : ""}
      ${b.statusNote ? `<p>${inline(b.statusNote)}</p>` : ""}
      ${b.url ? `<p><a class="btn" href="${safeHref(b.url)}" target="_blank" rel="noopener noreferrer">Open the recording</a></p>` : ""}
    </div></div>`;
  },

  links: (b) => `<div class="links">
    ${b.title ? `<p class="links__heading">${inline(b.title)}</p>` : ""}
    <ul>${b.items.map(it => `<li><a href="${safeHref(it.url)}" target="_blank" rel="noopener noreferrer">${inline(it.label)}</a>
      ${it.note ? `<span class="links__note">${inline(it.note)}</span>` : ""}</li>`).join("")}</ul></div>`,

  kv: (b) => `${b.title ? `<h3>${inline(b.title)}</h3>` : ""}
    <dl class="kv">${b.items.map(i => `<dt>${inline(i.k)}</dt><dd>${inline(i.v)}</dd>`).join("")}</dl>`,

  contacts: (_b, ctx) => `<div class="contacts">${ctx.site.contacts.map(c =>
    `<div class="contact">
      <p class="contact__role">${inline(c.role)}</p>
      <p class="contact__name">${inline(c.name)}</p>
      <p class="contact__org">${inline(c.org)}</p>
      <p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
      ${c.note ? `<p class="contact__note">${inline(c.note)}</p>` : ""}
    </div>`).join("")}</div>`,
};

const renderBlock = (block, ctx) => {
  const fn = renderers[block.type];
  if (!fn) throw new Error(`Unknown block type "${block.type}".`);
  return fn(block, ctx);
};

/* --- Prev / Next nav ---------------------------------------------------- */

const CHEVRON_LEFT = `<svg class="page-nav__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEVRON_RIGHT = `<svg class="page-nav__icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const prevNext = (pageSeq, currentId) => {
  const idx = pageSeq.findIndex(p => p.id === currentId);
  if (idx < 0) return "";
  const prev = idx > 0 ? pageSeq[idx - 1] : null;
  const next = idx < pageSeq.length - 1 ? pageSeq[idx + 1] : null;
  if (!prev && !next) return "";
  return `<nav class="page-nav" aria-label="Page navigation">
    ${prev ? `<a class="page-nav__link page-nav__prev" href="${asset(prev.href)}">${CHEVRON_LEFT}<span class="page-nav__text"><span class="page-nav__dir">Previous</span><span class="page-nav__label">${esc(prev.label)}</span></span></a>` : `<span></span>`}
    ${next ? `<a class="page-nav__link page-nav__next" href="${asset(next.href)}"><span class="page-nav__text"><span class="page-nav__dir">Next</span><span class="page-nav__label">${esc(next.label)}</span></span>${CHEVRON_RIGHT}</a>` : `<span></span>`}
  </nav>`;
};

/* --- Sidebar ------------------------------------------------------------ */

const sidebar = (active, videoItems, sections) => {
  const link = (id, label, href) => {
    const current = id === active;
    return `<li><a href="${asset(href)}"${current ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`;
  };

  const videoLinks = videoItems.map(v => {
    const current = `video-${v.slug}` === active;
    return `<li class="sidebar__sub"><a href="${asset("videos/" + v.slug + "/")}"${current ? ' aria-current="page"' : ""}>${esc(v.navLabel || v.title)}</a></li>`;
  }).join("\n");

  const sectionLinks = sections.map(s => {
    const current = s.id === active;
    return `<li class="sidebar__sub"><a href="${asset("docs/" + s.id + "/")}"${current ? ' aria-current="page"' : ""}>${esc(s.navLabel || s.title)}</a></li>`;
  }).join("\n");

  return `
<nav class="sidebar" id="sidebar" aria-label="Site">
  <a class="sidebar__brand" href="${asset("")}"><img class="sidebar__logo" src="${asset("assets/jabsom-logo-white.png")}" alt="JABSOM" width="190" height="240"><span class="sidebar__brand-text">ExamSoft</span></a>
  <ul class="sidebar__links">
    ${link("home", "Quick start", "")}
    <li class="sidebar__heading">Videos</li>
${videoLinks}
    <li class="sidebar__heading">Reference</li>
${sectionLinks}
    ${link("faq", "FAQ", "faq/")}
  </ul>
</nav>`;
};

/* --- Shell -------------------------------------------------------------- */

const shell = ({ title, description, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" href="${asset("assets/favicon.png")}">
<link rel="apple-touch-icon" href="${asset("assets/apple-touch-icon.png")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap">
<link rel="stylesheet" href="${asset("assets/css/tokens.css")}">
<link rel="stylesheet" href="${asset("assets/css/styles.css")}">
<link rel="stylesheet" href="${asset("assets/css/print.css")}">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<button class="sidebar-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="sidebar">&#9776;</button>
<div class="sidebar-backdrop"></div>
<div class="layout">
${body}
</div>
<script src="${asset("assets/js/site.js")}" defer></script>
</body>
</html>`;

const header = (site) => `<header class="site-header">
  <div class="site-header__inner">
    <span class="site-header__title">${esc(site.title)}</span>
    <span class="site-header__org">${esc(site.institutionShort)} ${esc(site.office)}</span>
  </div>
</header>`;

const progressCard = (pageSeq, currentId) => {
  const idx = pageSeq.findIndex(p => p.id === currentId);
  if (idx < 0) return "";
  const pct = Math.round(((idx + 1) / pageSeq.length) * 100);
  return `<div class="progress-card" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Course progress">
  <div class="progress-card__top">
    <span class="progress-card__label">Your progress</span>
    <span class="progress-card__count">${idx + 1} of ${pageSeq.length}</span>
  </div>
  <div class="progress-card__track"><div class="progress-card__fill" style="width:${pct}%"></div></div>
</div>`;
};

const footer = (site) => `<footer class="footer">
  <div class="footer__inner">
    <p class="footer__org">${esc(site.office)}, ${esc(site.institutionShort)}</p>
    <p class="footer__meta">v${esc(site.version)}</p>
  </div>
</footer>`;

/* --- Home --------------------------------------------------------------- */

const renderHome = (site, home, videoItems, sections, pageSeq) => {
  BASE = "";
  const ctx = { site, sections };
  const body = `
${sidebar("home", videoItems, sections)}
${header(site)}
<div class="page">
  ${progressCard(pageSeq, "home")}
  <main id="main">
    ${home.supertitle ? `<p class="page__supertitle">${esc(home.supertitle)}</p>` : ""}
    <h1>${esc(home.title)}</h1>
    ${home.lede ? `<p class="page__lede">${inline(home.lede)}</p>` : ""}
    ${home.blocks.map(b => renderBlock(b, ctx)).join("\n")}
  </main>
  ${prevNext(pageSeq, "home")}
</div>
${footer(site)}`;
  return shell({ title: `${home.title} — ${site.institutionShort}`, description: home.lede || "", body });
};

/* --- Video page (one per video) ----------------------------------------- */

const renderVideoPage = (site, vid, videoItems, sections, pageSeq) => {
  BASE = "../../";
  let videoEl;
  if (vid.local) {
    videoEl = `<div class="local-video">
      <video controls preload="metadata" playsinline>
        <source src="${asset(vid.src)}" type="video/mp4">
      </video>
    </div>`;
  } else if (vid.embed) {
    const src = vid.provider === "drive"
      ? `https://drive.google.com/file/d/${encodeURIComponent(vid.id)}/preview`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid.id)}${vid.start ? `?start=${encodeURIComponent(vid.start)}` : ""}`;
    videoEl = `<div class="video"><div class="video__frame"><iframe src="${esc(src)}" title="${esc(vid.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></div>`;
  } else {
    const status = vid.status && vid.status !== "ok"
      ? `<p class="video__status video__status--${esc(vid.status)}">${esc(vid.status === "restricted" ? "Access restricted" : "Removed")}</p>` : "";
    videoEl = `<div class="video"><div class="video__body">
      ${status}
      ${vid.recorded ? `<p class="video__meta">Recorded ${inline(vid.recorded)}</p>` : ""}
      ${vid.statusNote ? `<p>${inline(vid.statusNote)}</p>` : ""}
      ${vid.url ? `<p><a class="btn" href="${safeHref(vid.url)}" target="_blank" rel="noopener noreferrer">Open the recording</a></p>` : ""}
    </div></div>`;
  }
  const body = `
${sidebar(`video-${vid.slug}`, videoItems, sections)}
${header(site)}
<div class="page">
  ${progressCard(pageSeq, `video-${vid.slug}`)}
  <main id="main">
    <h1>${esc(vid.title)}</h1>
    ${vid.lede ? `<p class="page__lede">${inline(vid.lede)}</p>` : ""}
    ${videoEl}
    ${vid.note ? `<p>${inline(vid.note)}</p>` : ""}
  </main>
  ${prevNext(pageSeq, `video-${vid.slug}`)}
</div>
${footer(site)}`;
  return shell({ title: `${vid.title} — ${site.institutionShort}`, description: vid.lede || vid.note || "", body });
};

/* --- Section page (one per reference topic) ----------------------------- */

const renderSectionPage = (site, section, videoItems, sections, pageSeq) => {
  BASE = "../../";
  const ctx = { site, sections };
  const body = `
${sidebar(section.id, videoItems, sections)}
${header(site)}
<div class="page">
  ${progressCard(pageSeq, section.id)}
  <main id="main">
    <h1>${esc(section.title)}</h1>
    ${section.blocks.map(b => renderBlock(b, ctx)).join("\n")}
  </main>
  ${prevNext(pageSeq, section.id)}
</div>
${footer(site)}`;
  return shell({ title: `${section.title} — ${site.institutionShort}`, description: "", body });
};

/* --- FAQ ---------------------------------------------------------------- */

const renderFaq = (site, faq, videoItems, sections, pageSeq) => {
  BASE = "../";
  const body = `
${sidebar("faq", videoItems, sections)}
${header(site)}
<div class="page">
  ${progressCard(pageSeq, "faq")}
  <main id="main">
    <h1>${esc(faq.title)}</h1>
    <div class="faq-list">
    ${faq.items.map(item => `
    <details class="faq-item">
      <summary>${inline(item.q)}</summary>
      <div class="faq-answer"><p>${inline(item.a)}</p></div>
    </details>`).join("\n")}
    </div>
  </main>
  ${prevNext(pageSeq, "faq")}
</div>
${footer(site)}`;
  return shell({ title: `FAQ — ${site.institutionShort}`, description: "Common questions about ExamSoft at JABSOM.", body });
};

/* --- Run ---------------------------------------------------------------- */

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

const main = async () => {
  const site = await readJson(join(CONTENT, "site.json"));
  const home = await readJson(join(CONTENT, "home.json"));
  const videos = await readJson(join(CONTENT, "videos.json"));
  const faq = await readJson(join(CONTENT, "faq.json"));

  const dir = join(CONTENT, "sections");
  const files = (await readdir(dir)).filter(f => f.endsWith(".json")).sort();
  if (!files.length) throw new Error("No section files in content/sections/.");

  const sections = [];
  for (const f of files) {
    const s = await readJson(join(dir, f));
    for (const k of ["id","title","blocks"]) if (!s[k]) throw new Error(`${f} missing "${k}".`);
    sections.push(s);
  }

  const videoItems = videos.items || [];

  const pageSeq = [
    { id: "home", label: "Quick start", href: "" },
    ...videoItems.map(v => ({ id: `video-${v.slug}`, label: v.navLabel || v.title, href: `videos/${v.slug}/` })),
    ...sections.map(s => ({ id: s.id, label: s.navLabel || s.title, href: `docs/${s.id}/` })),
    { id: "faq", label: "FAQ", href: "faq/" },
  ];

  const homeHtml = renderHome(site, home, videoItems, sections, pageSeq);
  await writeFile(join(ROOT, "index.html"), homeHtml, "utf8");

  for (const v of videoItems) {
    const outDir = join(ROOT, "videos", v.slug);
    await mkdir(outDir, { recursive: true });
    const html = renderVideoPage(site, v, videoItems, sections, pageSeq);
    await writeFile(join(outDir, "index.html"), html, "utf8");
    console.log(`Built videos/${v.slug}/index.html — ${html.length} bytes`);
  }

  for (const s of sections) {
    const html = renderSectionPage(site, s, videoItems, sections, pageSeq);
    const outDir = join(ROOT, "docs", s.id);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "index.html"), html, "utf8");
    console.log(`Built docs/${s.id}/index.html — ${html.length} bytes`);
  }

  const faqHtml = renderFaq(site, faq, videoItems, sections, pageSeq);
  await mkdir(join(ROOT, "faq"), { recursive: true });
  await writeFile(join(ROOT, "faq", "index.html"), faqHtml, "utf8");

  console.log(`Built index.html         — home, ${homeHtml.length} bytes`);
  console.log(`Built ${videoItems.length} video pages`);
  console.log(`Built faq/index.html     — ${faq.items.length} questions, ${faqHtml.length} bytes`);
};

main().catch(e => { console.error(`\nBuild failed: ${e.message}\n`); process.exit(1); });
