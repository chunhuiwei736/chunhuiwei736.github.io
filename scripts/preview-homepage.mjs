import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "_site");
const previewScss = join(output, ".preview-main.scss");
const previewCss = join(output, "assets", "css", "main.css");
const port = Number(process.env.PORT || 4000);

const read = (path) => readFileSync(join(root, path), "utf8");
const stripFrontMatter = (source) =>
  source.replace(/^---\r?\n(?:[\s\S]*?\r?\n)?---\r?\n/, "");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

mkdirSync(dirname(previewCss), { recursive: true });

const mainScss = stripFrontMatter(read("assets/css/main.scss"))
  .replace(
    "\"theme/{{ site.site_theme | default: 'default' | append: '_light' }}\"",
    "\"theme/default_light\"",
  )
  .replace(
    "\"theme/{{ site.site_theme | default: 'default' | append: '_dark' }}\"",
    "\"theme/default_dark\"",
  );

writeFileSync(previewScss, mainScss);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
// An installed Sass CLI can be used when npm registry access is unavailable.
const sassPath = process.env.SASS_PATH;
const sass = spawnSync(
  sassPath ? process.execPath : npx,
  [
    ...(sassPath ? [sassPath] : ["--yes", "sass"]),
    `--load-path=${join(root, "_sass")}`,
    previewScss,
    previewCss,
    "--style=compressed",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: !sassPath && process.platform === "win32",
  },
);

rmSync(previewScss, { force: true });

if (sass.status !== 0) {
  if (sass.error) {
    console.error(sass.error.message);
  }
  process.exit(sass.status ?? 1);
}

// Use the same page destinations as the Jekyll navigation data.
const navigation = [
  { title: "Home", url: "/" },
  ...[...read("_data/navigation.yml").matchAll(/^  - title:\s*"([^"]+)"\r?\n\s+url:\s*(\S+)/gm)]
    .map(([, title, url]) => ({ title, url })),
];

const pageNavigation = (currentUrl) => `
  <nav class="academic-page-nav" aria-label="Page navigation">
    <p class="academic-page-nav__label">Explore</p>
    <ul>${navigation.map(({ title, url }) => `<li><a href="${escapeHtml(url)}"${url === currentUrl ? ' aria-current="page"' : ""}>${escapeHtml(title)}</a></li>`).join("")}</ul>
  </nav>`;

const masthead = `
  <div class="masthead">
    <div class="masthead__inner-wrap">
      <div class="masthead__menu">
        <nav id="site-nav" class="greedy-nav">
          <button aria-label="Open navigation"><span class="navicon"></span></button>
          <ul class="visible-links">
            <li class="masthead__menu-item masthead__menu-item--lg persist"><a href="/">Homepage</a></li>
            <li id="theme-toggle" class="masthead__menu-item persist tail">
              <a role="button" aria-label="Toggle color theme"><i id="theme-icon" class="fa-solid fa-sun" aria-hidden="true"></i></a>
            </li>
          </ul>
          <ul class="hidden-links hidden"></ul>
        </nav>
      </div>
    </div>
  </div>`;

const pageShell = (title, content, mainClass = "") => `<!doctype html>
<html lang="en" class="no-js">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="/assets/css/main.css">
  </head>
  <body class="academic-site">
    ${masthead}
    <div id="main"${mainClass ? ` class="${mainClass}"` : ""} role="main">${content}</div>
    <div class="page__footer">
      <footer>
        <div class="page__footer-copyright">&copy; ${new Date().getFullYear()} Chunhui Wei</div>
      </footer>
    </div>
    <script type="module" src="/assets/js/main.min.js"></script>
  </body>
</html>`;

const parseFrontMatter = (source) => {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};

  return Object.fromEntries(
    block[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([a-zA-Z_]+):\s*(.*)$/))
      .filter(Boolean)
      .map((match) => [
        match[1],
        parseScalar(match[2].trim()),
      ]),
  );
};

const parseScalar = (value) => {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      // Keep supporting simple YAML strings that are not JSON strings.
    }
  }
  return value.replace(/^(['"])(.*)\1$/, "$2").replace(/''/g, "'");
};

const notes = JSON.parse(read("_data/notes.json"));
const uploadedTime = (version, dateOnly = false) => `<time datetime="${escapeHtml(version.uploaded_at)}">${escapeHtml(dateOnly ? version.uploaded_label.split(",")[0] : version.uploaded_label)}</time>`;

const noteList = () => notes.length ? `
  <div class="academic-papers">
    ${notes.map((note) => {
      const url = `/notes/${note.id}/`;
      const latest = note.versions[0];
      return `<article class="academic-paper">
        <div class="academic-paper__meta">
          <span>Note</span>
          <span>${note.versions.length} ${note.versions.length === 1 ? "version" : "versions"}</span>
        </div>
        <div class="academic-paper__content">
          <h2><a href="${escapeHtml(url)}">${escapeHtml(note.title)}</a></h2>
          ${note.description ? `<p>${escapeHtml(note.description)}</p>` : ""}
          ${latest ? `<p>Latest upload: ${uploadedTime(latest, true)}</p>` : ""}
          <div class="academic-paper__links"><a href="${escapeHtml(url)}">View versions <span aria-hidden="true">→</span></a></div>
        </div>
      </article>`;
    }).join("")}
  </div>` : "<p>No notes have been added yet.</p>";

const noteVersions = (page) => {
  const note = notes.find(({ id }) => id === page.note_id);
  if (!note) throw new Error(`No Notes data found for ${page.note_id}`);

  return `<section class="academic-section academic-work" aria-labelledby="note-title">
    <p><a href="/notes/">← All notes</a></p>
    <div class="academic-section__heading">
      <p class="academic-eyebrow">Notes</p>
      <h1 id="note-title">${escapeHtml(note.title)}</h1>
      ${note.description ? `<p>${escapeHtml(note.description)}</p>` : ""}
    </div>
    <p>Choose a version to read. Versions are listed by upload time, newest first.</p>
    <div class="academic-papers">
      ${note.versions.map((version, index) => `<article class="academic-paper" id="version-${escapeHtml(version.id)}">
        <div class="academic-paper__meta">
          <span>${index === 0 ? "Latest version" : "Earlier version"}</span>
          <span>Uploaded</span>
        </div>
        <div class="academic-paper__content">
          <h2>${uploadedTime(version, true)}</h2>
          <div class="academic-paper__links">
            <a href="${escapeHtml(version.pdf)}">View PDF <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </article>`).join("")}
    </div>
  </section>`;
};

const renderContent = (source, page) => stripFrontMatter(source)
  .replace(/{%\s*include note-list\.html\s*%}/g, () => noteList())
  .replace(/{%\s*include note-versions\.html\s*%}/g, () => noteVersions(page));

// This lightweight preview renders the HTML-based academic pages.
// GitHub Pages still builds the complete site with Jekyll.
const pageUrls = new Set();
const filenames = readdirSync(join(root, "_pages"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:html|md)$/.test(entry.name))
  .map((entry) => entry.name);

for (const filename of filenames) {
  const source = read(`_pages/${filename}`);
  const page = parseFrontMatter(source);
  if (page.academic_navigation !== "true" || !page.permalink) continue;
  pageUrls.add(page.permalink);
  const classes = `academic-page${page.permalink === "/" ? " academic-home" : ""}`;
  const html = pageShell(
    page.title,
    `<article class="splash ${classes}">${pageNavigation(page.academic_navigation_url || page.permalink)}<section class="page__content">${renderContent(source, page)}</section></article>`,
    classes,
  );
  const destination = join(output, page.permalink, "index.html");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const safePath = (base, pathname) => {
  const candidate = resolve(base, `.${normalize(pathname)}`);
  return candidate === base || candidate.startsWith(`${base}${sep}`) ? candidate : null;
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);

  const redirects = { "/about/": "/", "/about.html": "/", "/resume": "/cv/", "/resume/": "/cv/" };
  const destination = redirects[pathname] || (pageUrls.has(`${pathname}/`) ? `${pathname}/` : null);
  if (destination) {
    response.writeHead(302, { Location: destination });
    response.end();
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const routedPath = requestedPath.endsWith("/")
    ? `${requestedPath}index.html`
    : requestedPath;
  const candidates = [
    safePath(output, routedPath),
    safePath(root, routedPath),
  ].filter(Boolean);

  let file;
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        file = candidate;
        break;
      }
    } catch {
      // Try the next candidate.
    }
  }

  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
  });
  response.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => {
  console.log(`Academic homepage preview: http://localhost:${port}`);
});
