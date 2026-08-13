# Customizing Relaxed Mode Extraction

The extension has two article-extraction modes, controlled by **Settings > General > Strict article extraction**:

- **Strict (default):** Uses Mozilla Readability with an `article-extractor` fallback. This produces a very clean reading experience, but it intentionally strips short, metadata-heavy blocks such as review author names, outlet names, and scores.
- **Relaxed:** Uses a raw-body extractor that removes common non-content elements (nav, footer, ads, cookie banners, social/share widgets, etc.) and then reads the rest of the page. This keeps more metadata, but may include a little extra page noise on some sites.

## Adding site-specific cleanup

If a particular site leaves noisy sections in relaxed mode, you can add site-specific CSS selectors to the cleanup list.

1. Open `js/utils/helpers.js`.
2. Find the `removeJunkElements` function.
3. Add your selectors to the **Site-specific filters** section.

### Example: OpenCritic

On OpenCritic, relaxed mode will keep review metadata (`IGN`, `Samuel Claiborn`, `7.3 / 10.0`), but it may also include the "Available Now", "Upcoming Releases", and "Hall of Fame" game lists. Those rows use the class `game-row`, and OpenCritic ads use the class `oc-ad`.

```javascript
// -----------------------------------------------------------------
// Site-specific filters
// Add your own site-specific selectors here. Be careful not to
// remove elements that contain the main article/content text.
// See docs/RELAXED_MODE_CUSTOMIZATION.md for examples.
// -----------------------------------------------------------------
'.game-row',
'.oc-ad',
// -----------------------------------------------------------------
```

### How to find selectors

1. Open the page in Chrome.
2. Right-click the noisy section and choose **Inspect**.
3. Look at the element's `class` or `id` attributes.
4. Add a selector like `.class-name`, `#id-name`, or `[class*="partial-name"]`.

### Tips

- Prefer classes/IDs that clearly identify non-content UI (lists, sidebars, ads, widgets).
- Avoid selectors that might match the main article body on other sites.
- Test both strict and relaxed modes after adding selectors.
- For word- or sentence-level filtering, use the existing **Domain Filters** feature instead (see `docs/DOMAIN_FILTERS.md`).
