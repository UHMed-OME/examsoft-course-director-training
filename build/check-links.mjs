/* ==========================================================================
   check-links.mjs — reports the HTTP status of every external URL in content/.
   Zero dependencies. Node 18 or newer (uses global fetch).

     node build/check-links.mjs

   Run this as part of the annual content review. ExamSoft reorganises its
   support site and has already removed one video this training depended on,
   so link rot is the most likely way the page goes stale.

   Exit code is 1 if anything looks broken, so it can gate CI.
   ========================================================================== */

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");

/* Some hosts reject unknown agents outright. A browser-ish UA keeps the
   report about the link rather than about the scraper. */
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml",
};

const TIMEOUT_MS = 20000;

/* Hosts known to answer automated requests with 403 regardless of whether the
   URL is good. support.examsoft.com runs Zendesk behind bot protection and
   returns 403 to every scripted request while serving the same URLs fine in a
   browser. Reporting those as broken would make this whole check useless, so
   they are surfaced as "verify by hand" instead of counted as failures. */
const BOT_PROTECTED = new Set(["support.examsoft.com"]);

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const collectUrls = async () => {
  const files = [join(CONTENT, "site.json")];
  const dir = join(CONTENT, "sections");
  for (const f of (await readdir(dir)).filter((n) => n.endsWith(".json")).sort()) {
    files.push(join(dir, f));
  }

  /* Matches both bare "url" values and inline [label](url) markup. */
  const found = new Map();
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const name = file.replace(ROOT + "\\", "").replace(ROOT + "/", "");
    /* The exclusion set has to cover markdown punctuation as well as JSON
       delimiters, or an inline [label](url) yields one mangled match that
       splices the label and the target together. */
    for (const match of raw.matchAll(/https?:\/\/[^\s"'<>()[\]\\]+/g)) {
      const url = match[0].replace(/[.,]+$/, "");
      if (!found.has(url)) found.set(url, new Set());
      found.get(url).add(name);
    }
  }
  return found;
};

const check = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    /* HEAD first; fall back to GET, since plenty of hosts mishandle HEAD. */
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: HEADERS,
      signal: controller.signal,
    });
    if (res.status === 405 || res.status === 403 || res.status === 404) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: HEADERS,
        signal: controller.signal,
      });
    }
    return { status: res.status, finalUrl: res.url };
  } catch (error) {
    return { status: 0, error: error.name === "AbortError" ? "timeout" : error.message };
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  const urls = await collectUrls();
  console.log(`Checking ${urls.size} external URLs from content/\n`);

  const problems = [];
  const suspicious = [];
  const manual = [];

  for (const [url, sources] of [...urls].sort()) {
    const { status, finalUrl, error } = await check(url);
    const blocked = BOT_PROTECTED.has(hostOf(url));

    let mark = "ok   ";
    if (status === 403 && blocked) {
      mark = "block";
      manual.push({ url, sources });
    } else if (status === 0) {
      mark = "FAIL ";
      problems.push({ url, detail: error, sources });
    } else if (status >= 400) {
      mark = "FAIL ";
      problems.push({ url, detail: `HTTP ${status}`, sources });
    } else if (status >= 300) {
      mark = "redir";
    }

    /* An Enterprise article in this repository is almost always a mistake:
       JABSOM runs Legacy and the screens differ. */
    if (/support\.examsoft\.com/.test(url) && /Enterprise-Portal/i.test(url)) {
      mark = "WARN";
      suspicious.push({ url, detail: "Enterprise article — JABSOM runs Legacy", sources });
    }

    const moved = finalUrl && finalUrl !== url ? `  ->  ${finalUrl}` : "";
    console.log(`${mark}  ${status || "-"}  ${url}${moved}`);
  }

  if (suspicious.length) {
    console.log(`\nWarnings (${suspicious.length}):`);
    for (const s of suspicious) {
      console.log(`  ${s.url}\n    ${s.detail}\n    in: ${[...s.sources].join(", ")}`);
    }
  }

  if (manual.length) {
    console.log(
      `\nBot-protected, verify by hand (${manual.length}):\n` +
        "  These hosts return 403 to any script. Spot-check a few in a browser.\n" +
        "  Confirm the title still starts with \"Legacy Portal:\" or covers both editions."
    );
    for (const m of manual) console.log(`  ${m.url}`);
  }

  if (problems.length) {
    console.log(`\nBroken or unreachable (${problems.length}):`);
    for (const p of problems) {
      console.log(`  ${p.url}\n    ${p.detail}\n    in: ${[...p.sources].join(", ")}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log(
    `\nNo failures. ${manual.length} link(s) need a manual spot-check, ` +
      `${suspicious.length} warning(s).\n`
  );
};

main().catch((error) => {
  console.error(`\nLink check failed: ${error.message}\n`);
  process.exit(1);
});
