---
permalink: /terms/
title: "Terms and Privacy Policy"
modified: 2026-10-26
---

{% include base_path %}
{% include toc %}

## Privacy and service information

This page describes what is configured in this site's source repository as of October 26, 2026. It is not a complete statement of how GitHub Pages, a content-delivery network, a browser, or an external site handles request data.

### Configured site features

The repository configures the following features:

* **Analytics:** `_config.yml` sets `analytics.provider` to `"false"` and leaves the Google Analytics tracking ID empty. The analytics include has no provider branch for `"false"`, so this configuration does not emit the template's Google Analytics snippets.
* **Comments:** `_config.yml` leaves `comments.provider` empty. The layouts only include comments when a provider is configured and the page enables comments, so Disqus is not enabled by this repository.
* **Advertising:** No advertising provider or advertising script appears in the repository configuration or templates reviewed for this page. This does not describe external pages linked from the site.

These source checks do not establish whether another part of the hosting or delivery infrastructure collects data.

### Third-party resources

The shared footer loads these resources from third-party content-delivery networks:

* the [cdnjs polyfill](https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6)
* [MathJax 3](https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js) from jsDelivr
* [Plotly 3.0.1](https://cdnjs.cloudflare.com/ajax/libs/plotly.js/3.0.1/plotly.min.js) from cdnjs
* [Mermaid 11](https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs) from jsDelivr

A browser requests these resources when a page using the shared layout loads. This repository does not establish what the CDN operators collect, retain, or infer from those requests. Review their current policies independently.

### Browser storage

The site's theme toggle stores a `theme` preference in browser `localStorage` so the display preference can be restored. The audited site code does not configure a site-specific cookie or web beacon. A browser or a third-party resource may have its own storage or data practices.

### Information requiring independent confirmation

The repository does not establish whether GitHub Pages or other hosting infrastructure creates access logs, which fields those logs contain, how long they are retained, or whether they are linked to individuals. This page therefore makes no claim about visitor IP addresses, browser or Internet Service Provider details, timestamps, referrers, clicks, or the identifiability of log data. Confirm those practices with the relevant providers.

The site publishes a contact email address as a `mailto` link. This repository does not process that mailbox or define how messages are shared or retained; ask the site owner about those practices before sending personal information.
