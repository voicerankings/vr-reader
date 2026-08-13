# 🧹 Domain Filters Guide

Domain filters in **VoiceRankings Reader** allow you to customize, clean, or skip specific words, phrases, sentences, and sections when reading web pages aloud.

Two kinds of rules can be defined, one per tab under **Settings > Custom Domain Filters**:

1. **Playback text** — pattern-matching rules that clean or skip spoken text (this guide, sections 1–3).
2. **CSS selectors** — rules that remove the actual HTML elements from the page before it is read (section 4 below).

---

## 📖 Overview

When listening to articles or web pages, unwanted content like citation numbers `[1]`, advertisement labels, social share links, or footer disclaimers can disrupt speech flow. Domain filters let you define pattern-matching rules per website or globally across all sites.

Filters operate at three primary levels:

1. **Word-Level (`clean`)**: Strips specific words, URLs, or Regex patterns *inside* a sentence while reading the remaining text smoothly.
2. **Line & Sentence-Level (`contains`, `exact`, `startsWith`, `endsWith`, `regex`)**: Removes the *entire sentence or paragraph* if a match is found.
3. **Playback Control (`stop`)**: Halts speech playback completely when reaching a matching section header or line.

---

## 🎯 1. Domain Scope Matching

| Domain Setting | Scope | Applies To | Examples |
| :--- | :--- | :--- | :--- |
| `*` *(or empty)* | **Global** | All websites globally | Applies filters everywhere on the web |
| `reddit.com` | **Exact Host** | `reddit.com` & `www.reddit.com` | Main site only (skips subdomains like `old.reddit.com`) |
| `old.reddit.com` | **Specific Subdomain** | `old.reddit.com` only | Distinct subdomain rules |
| `wikipedia.org` | **Exact Host** | `wikipedia.org` & `www.wikipedia.org` | Main site only |

### ⚡ Priority `-1` (Disabled & Remote Filter Override)
Setting a filter's **Priority to `-1`** serves a dual purpose:
1. **Disables the Custom Filter**: The filter is hidden from playback and will **not** alter or skip text during reading.
2. **Overrides & Suppresses Remote Filters**: If a remote filter fetched from the API matches your local filter on **Domain + Pattern + Type** (e.g. `youtube.com` + `"\[\d+\]"` + `clean`), setting your local filter's priority to `-1` will **override and block** that specific remote filter from executing during playback.

---

## ⚙️ 2. Filter Types & Behaviors

### 🧹 `clean` (Word / Regex In-Line Stripping)
- **Target**: Words or inline patterns within a sentence.
- **Action**: Replaces matched pattern with `""` and speaks the surrounding text.
- **Regex Support**: **Yes** (compiled case-insensitively via `new RegExp(pattern, 'gi')`).
- **Use Cases**: Stripping bracketed citations, URLs, ad labels, social handles.

### 🚫 `contains` (Sentence / Line Removal)
- **Target**: Entire sentence or paragraph block.
- **Action**: Skips the whole line if the pattern appears anywhere inside it.
- **Use Cases**: Skipping comment callouts (`"Leave a comment"`), share buttons (`"Share this article"`).

### 🎯 `exact` (Exact Sentence Match)
- **Target**: Entire sentence or paragraph block.
- **Action**: Skips the line only if the text matches the pattern exactly.

### 🚩 `startsWith` (Prefix Sentence Removal)
- **Target**: Sentence start.
- **Action**: Skips lines beginning with the specified text.
- **Use Cases**: Skipping metadata headers (`"Published by"`, `"Written on"`).

### 🏁 `endsWith` (Suffix Sentence Removal)
- **Target**: Sentence end.
- **Action**: Skips lines ending with the specified text.
- **Use Cases**: Skipping copyright footers (`"All rights reserved"`).

### 🔬 `regex` (Sentence-Level Pattern Match)
- **Target**: Entire sentence/line against Regex.
- **Action**: Skips the whole line if the Regex matches anywhere in the line.

### 🛑 `stop` Variants (Halt Playback)
- **`stop`** *(or `stop_contains`)*: Stops speech playback completely if a line **contains** the text.
- **`stop_exact`**: Stops speech playback **ONLY if the line matches the text 100% exactly**.
- **`stop_startsWith`**: Stops speech playback if a line **starts with** the text.
- **`stop_endsWith`**: Stops speech playback if a line **ends with** the text.
- **`stop_regex`**: Stops speech playback if a line matches a **Regex pattern**.

---

## 💡 Practical Filter Pattern Examples

### Word-Level (`clean`) Examples

| Goal | Pattern | Original Text → Spoken Output |
| :--- | :--- | :--- |
| **Remove Citation Brackets** | `\[\d+\]` | `"Quantum computing[1] is fast[2]."` → `"Quantum computing is fast."` |
| **Remove Web URLs** | `https?:\/\/\S+` | `"Check out https://example.com for info"` → `"Check out for info"` |
| **Remove Ad Labels** | `\b(sponsored|advertisement)\b` | `"This sponsored post explains..."` → `"This post explains..."` |
| **Remove Social Handles** | `@\w+` | `"Follow @voice_rankings on X"` → `"Follow on X"` |

### Sentence-Level Examples

| Goal | Type | Pattern | Behavior |
| :--- | :--- | :--- | :--- |
| **Skip Comments Section** | `contains` | `Leave a comment` | Skips comment header blocks |
| **Skip Author Metadata** | `startsWith` | `Written by` | Skips lines like *"Written by John Doe"* |
| **Skip Copyright Footers** | `endsWith` | `all rights reserved` | Skips copyright footer blocks |
| **Stop Reading at Recommended** | `stop` | `Recommended for you` | Stops TTS when section starts |

---

## 🎨 4. CSS Selector Filters (Remove Page Elements)

**Settings > Custom Domain Filters > CSS selectors**

CSS selector filters are **more precise** than playback-text filters. Instead of matching *spoken words*, they target the actual HTML elements on the page (ads, navigation, comment boxes, newsletter popups, "related articles" widgets, footers…). Their content is **excluded from what is read aloud**, so it is never spoken — while the page itself is left completely untouched. Rules apply exactly; there is **no "safe content" guard**.

### 🔍 Finding a selector (Chrome DevTools)

1. Right-click the element you want removed (e.g. a *"Related articles"* block) and choose **Inspect**.
2. In the **Elements** panel, take note of its `class` or `id` (e.g. `.related-articles`, `#comments`).
3. Right-click the element row and choose **Copy → Copy selector**, or write one manually.

### 💡 Common selector examples

| Selector | What It Removes |
| :--- | :--- |
| `#comments` | The element with the id `comments` |
| `.newsletter` | Every element with the class `newsletter` |
| `[class*="ad-banner"]` | Elements whose class name contains `ad-banner` |
| `.related, .recommended` | A comma-separated list matches multiple selectors |
| `aside.newsletter` | Tag + class — prefer specific selectors to avoid removing the main article |

### 🌐 Domain scope & priority

- **Domain**: Same rules as playback filters — a specific host, subdomain, or `*` for every site.
- **Priority `-1`**: Disables the local rule and acts as an **Override** — a matching remote CSS rule (same Domain + Selector) is suppressed.
- **Positive priorities** set the application order (lower numbers first); remote rules for the site are applied before your local ones.

### 🔁 Storage & syncing

CSS rules live in the same `CUSTOM_DOMAIN_FILTERS` storage (and the shared `domain_filters` API table) as playback filters, distinguished by a `type: 'css'` field. Rules sync to open browser tabs instantly on save — no page reload required.

---

## 🧪 Testing Your Domain Filters

1. Open the extension **Settings > Custom Domain Filters**.
2. Pick the **Playback text** tab (word/sentence filters) or the **CSS selectors** tab (element removal).
3. Click **Add new filter** (or **Add new CSS selector**).
4. Select your target **Domain** (`*` for global or a specific domain like `wikipedia.org`).
5. Choose the **Filter type** (`clean`, `contains`, `stop`, etc.) for playback filters, or enter a **CSS selector** for element removal.
6. Enter your **Filter pattern** (plain text, Regular Expression, or CSS selector).
7. Save the filter — rules sync instantly to open browser tabs without requiring a page reload!
