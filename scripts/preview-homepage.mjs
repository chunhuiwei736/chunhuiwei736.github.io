import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
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
    <ul>${navigation.map(({ title, url }) => `<li><a href="${url}"${url === currentUrl ? ' aria-current="page"' : ""}>${title}</a></li>`).join("")}</ul>
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
    <title>${title}</title>
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
        match[2].trim().replace(/^(['"])(.*)\1$/, "$2"),
      ]),
  );
};

// This lightweight preview renders the four HTML-based academic pages.
// GitHub Pages still builds the complete site with Jekyll.
for (const filename of ["about.md", "education.html", "publications.html", "cv.md"]) {
  const source = read(`_pages/${filename}`);
  const page = parseFrontMatter(source);
  const classes = `academic-page${page.permalink === "/" ? " academic-home" : ""}`;
  const html = pageShell(
    page.title,
    `<article class="splash ${classes}">${pageNavigation(page.permalink)}<section class="page__content">${stripFrontMatter(source)}</section></article>`,
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
  const destination = redirects[pathname] || navigation.find(({ url }) => url !== "/" && pathname === url.slice(0, -1))?.url;
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
