import { describe, it, expect } from 'vitest';
import { findArticleElement, extractJsonLdArticle, cleanTitleForPlayback } from '../js/utils/helpers.js';

describe('helpers.js - DOM Article Extraction', () => {
    describe('findArticleElement', () => {
        it('should locate semantic <article> element when present', () => {
            document.body.innerHTML = `
                <div>
                  <nav>Header</nav>
                  <article>
                    <p>This is the main article content body with sufficient length to be recognized as an article container.</p>
                  </article>
                </div>
            `;
            const article = findArticleElement(document);
            expect(article).not.toBeNull();
            expect(article.tagName.toLowerCase()).toBe('article');
        });

        it('should fallback to main container if <article> is missing', () => {
            document.body.innerHTML = `
                <div class="page">
                  <main class="article-content">
                    <p>${'Long article paragraph '.repeat(15)}</p>
                  </main>
                </div>
            `;
            const article = findArticleElement(document);
            expect(article).not.toBeNull();
            expect(article.tagName.toLowerCase()).toBe('main');
        });

        it('should return null if no article container or main element exists', () => {
            document.body.innerHTML = `<div>Short text</div>`;
            const article = findArticleElement(document);
            expect(article).toBeNull();
        });
    });

    describe('extractJsonLdArticle', () => {
        it('should parse headline from Schema.org Article JSON-LD script tag', () => {
            document.body.innerHTML = `
                <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  "headline": "Breakthrough in Text to Speech Models"
                }
                </script>
                <article>
                  <p>${'Article text body '.repeat(15)}</p>
                </article>
            `;
            const result = extractJsonLdArticle(document);
            expect(result).not.toBeNull();
            expect(result.title).toBe("Breakthrough in Text to Speech Models");
        });
    });

    describe('cleanTitleForPlayback', () => {
        it('should strip a " - " separator suffix like "Title - IGN.com"', () => {
            expect(cleanTitleForPlayback('Gaming culture has change alot since 2026 - IGN.com'))
                .toBe('Gaming culture has change alot since 2026');
        });

        it('should strip a " | " separator suffix like "Title | CNN"', () => {
            expect(cleanTitleForPlayback('Breaking news story - CNN'))
                .toBe('Breaking news story');
        });

        it('should keep a hyphen that joins words like "well-known" intact', () => {
            expect(cleanTitleForPlayback("DeepSeek's new AI model is by far the cheapest of well-known models to run, research firm says"))
                .toBe("DeepSeek's new AI model is by far the cheapest of well-known models to run, research firm says");
        });

        it('should handle en/em dashes used as separators', () => {
            expect(cleanTitleForPlayback('Some Headline – LongRead'))
                .toBe('Some Headline');
            expect(cleanTitleForPlayback('Some Headline — LongRead'))
                .toBe('Some Headline');
        });

        it('should return non-string or empty input unchanged', () => {
            expect(cleanTitleForPlayback('')).toBe('');
            expect(cleanTitleForPlayback(null)).toBeNull();
            expect(cleanTitleForPlayback(undefined)).toBeUndefined();
        });
    });
});
