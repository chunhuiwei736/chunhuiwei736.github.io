# Chunhui Wei’s academic website

This repository contains the source for [Chunhui Wei’s academic website](https://chunhuiwei736.github.io/). It presents Chunhui’s research in complex geometry, complex algebraic geometry, and algebraic topology, together with education, publications, a CV, and informal notes. The site is configured for Chunhui Wei at Zhejiang University in [`_config.yml`](./_config.yml).

The site is built with [Academic Pages](https://academicpages.github.io/), a Jekyll template derived from the [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/) theme.

## Repository layout

- [`_pages/`](./_pages/) contains the pages shown in the site navigation: the home page, education, publications, notes, and CV.
- [`_publications/`](./_publications/) stores publication collection entries and their metadata. The visible publication cards are maintained in [`_pages/publications.html`](./_pages/publications.html); keep the two sources consistent when adding or correcting a publication.
- [`_data/notes.json`](./_data/notes.json) is the index for the Notes section. Each note records its title, description, and versions. The corresponding PDFs live below [`files/notes/`](./files/notes/), and the newest version should be listed first in the JSON data.
- [`files/`](./files/) contains downloadable material such as the CV and paper PDFs.
- [`_data/navigation.yml`](./_data/navigation.yml) controls the order and URLs of the navigation links. Site-wide identity, URL, and collection settings are in [`_config.yml`](./_config.yml).

When adding a publication, update its `_publications/*.md` entry and the matching card in `_pages/publications.html`, including authors, date, venue, abstract or description, and stable links to the article, preprint, or PDF. When adding a note version, upload its PDF under `files/notes/`, add a version object to the matching entry in `_data/notes.json`, and put the newest upload first. Use the existing fields and URL style so both the Jekyll build and the lightweight preview can resolve the link.

## Preview locally

The repository includes a small preview server for the customized academic pages. From a fresh checkout:

```bash
git clone https://github.com/chunhuiwei736/chunhuiwei736.github.io.git
cd chunhuiwei736.github.io
npm ci
npm run preview
```

Open [http://localhost:4000](http://localhost:4000). `npm run preview` compiles the site stylesheet, renders the academic pages into `_site/`, and serves them on port 4000. Set `PORT` to use another port, for example `PORT=4100 npm run preview`. The first run may download Sass through `npx`; a locally installed Sass executable can be selected with `SASS_PATH`.

For the complete GitHub Pages/Jekyll build, install Ruby and Bundler, then run:

```bash
bundle config set --local path vendor/bundle
bundle install
bundle exec jekyll serve --livereload --host 127.0.0.1
```

The full Jekyll server is available at [http://localhost:4000](http://localhost:4000). Restart it after changing `_config.yml`. Docker is an alternative when Ruby is not installed locally:

```bash
docker compose up --build
```

## Deploy to GitHub Pages

Push the completed changes to the `master` branch:

```bash
git add .
git commit -m "Describe the change"
git push origin master
```

GitHub Pages builds this repository from the root of `master`. Check the repository’s **Actions** or **Deployments** view for the Pages build, then open [chunhuiwei736.github.io](https://chunhuiwei736.github.io/) to verify the published result. The Pages configuration is managed in the repository’s **Settings → Pages** section; if it must be recreated, choose **Deploy from a branch**, `master`, and the root (`/`) directory.

## Attribution and maintenance

This customized site uses the [Academic Pages](https://github.com/academicpages/academicpages.github.io) template, originally created by [Stuart Geiger](https://github.com/staeiou) and maintained by [Robert Zupko](https://github.com/rjzupkoii) and other contributors. Academic Pages is derived from the [Minimal Mistakes Jekyll theme](https://github.com/mmistakes/minimal-mistakes) by Michael Rose. The upstream template and theme are distributed under the MIT License; see [`LICENSE`](./LICENSE). Site-specific content and maintenance belong to Chunhui Wei. For changes, update the relevant source files, run the local preview (and the full Jekyll build when appropriate), and push to `master` so GitHub Pages can rebuild the site.
