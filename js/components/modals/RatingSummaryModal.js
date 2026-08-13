// RatingSummaryModal.js
// Post-rating modal shown after a user rates a voice.
//
// Contains three sections:
//   1. Thank you + aggregate rating (average stars + total count)  -> FAST, separate call
//   2. Leaderboard carousel (per-category ranks)                   -> SLOW, separate lazy call
//   3. Chrome Store review nudge / community (Discord) invite
//
// The aggregate and rankings are fetched via TWO INDEPENDENT background API calls so the
// slower ranking endpoint never delays the immediate thanks/rating feedback.

import {
    saveToLocalStorage,
    readLocalStorage
} from "../../utils/helpers";

import {
    CONSTANTS
} from "../../constants/constants.js";

import {
    APP_WEB_DOMAIN
} from "../../background/config.js";

const STORE_REVIEW_URL = CONSTANTS.GUIDE_LINKS.CHROME_STORE_REVIEW;
const DISCORD_INVITE_URL = CONSTANTS.GUIDE_LINKS.DISCORD;
const REVIEW_FLAG_KEY = "vr_review_nudge_complete";

const slugify = (value) => {
    return String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

export default class RatingSummaryModal {
    constructor({ voice, onClose }) {
        this.voice = voice;
        this.communicationHelper = window.VR_Reader || null;
        this.onClose = onClose;

        this.shadow = null;
        this.hostElement = null;

        // Aggregate rating state
        this.isLoadingSummary = true;
        this.ratingsSummary = null;

        // Rankings/park state
        this.isLoadingRankings = true;
        this.rankings = [];
        this.rankingsError = false;
        this.carouselIndex = 0;

        // Review nudge state
        this.reviewedDone = false;
        this.celebrate = false;

        this.PAGE = 3;          // boxes shown per carousel page
        this.BOX_WIDTH = 170;   // box width + gap (px) used for paging
    }

    async initShadowDOM(shadowDomDiv) {
        this.hostElement = shadowDomDiv;
        this.shadow = this.hostElement.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = this._getStyles();
        this.shadow.appendChild(style);
    }

    _getStyles() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .modal-backdrop {
                position: fixed; top: 0; left: 0; height: 100%; width: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                z-index: 10000000000;
                display: flex; align-items: center; justify-content: center;
                animation: vrr-fade 0.2s ease-out;
            }
            @keyframes vrr-fade { from { opacity: 0; } to { opacity: 1; } }
            .modal-content {
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
                width: 92vw;
                max-width: 620px;
                max-height: 88vh;
                overflow-y: auto;
                position: relative;
                padding: 28px 26px 24px;
                color: #111827;
            }
            .modal-close-btn {
                position: absolute; top: 14px; right: 16px;
                border: none; background: transparent;
                font-size: 26px; line-height: 1; color: #9ca3af; cursor: pointer;
                padding: 0 6px; border-radius: 8px;
            }
            .modal-close-btn:hover { color: #374151; background: #f3f4f6; }

            .modal-header {
                display: flex; align-items: center; gap: 10px;
                font-size: 20px; font-weight: 700; margin-bottom: 20px;
            }
            .modal-header .thumb {
                width: 36px; height: 36px; border-radius: 10px;
                background: linear-gradient(135deg, #6d28d9, #4f46e5);
                color: #fff; display: flex; align-items: center; justify-content: center;
                font-size: 18px; font-weight: 800; flex-shrink: 0;
            }
            .modal-header .sub { font-size: 12px; font-weight: 500; color: #6b7280; margin-top: 2px; }

            .section-title {
                font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
                color: #9ca3af; margin: 18px 0 10px;
            }

            /* ---- Section 1: Aggregate rating ---- */
            .summary-section {
                display: flex; align-items: center; gap: 20px;
                background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px;
                padding: 18px 20px;
            }
            .avg-num { font-size: 44px; font-weight: 800; color: #111827; line-height: 1; }
            .avg-num small { font-size: 22px; color: #6b7280; }
            .avg-count { font-size: 13px; color: #6b7280; margin-top: 6px; }
            .stars-wrap { position: relative; display: inline-block; font-size: 22px; letter-spacing: 2px; }
            .stars-off { color: #e5e7eb; }
            .stars-on { position: absolute; left: 0; top: 0; overflow: hidden; color: #f59e0b; white-space: nowrap; }

            /* skeletons */
            .sk { border-radius: 8px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%); background-size: 400% 100%; animation: sk 1.4s ease infinite; }
            @keyframes sk { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
            .sk-num { width: 70px; height: 44px; }
            .sk-stars { width: 130px; height: 20px; margin-top: 8px; }

            /* ---- Section 2: Rankings carousel ---- */
            .carousel { position: relative; }
            .carousel-track-wrap { overflow: hidden; }
            .carousel-track { display: flex; gap: 10px; transition: transform 0.3s ease-out; }
            .rank-card {
                width: 170px; flex: 0 0 170px;
                background: #fefefe; border: 1px solid #e5e7eb; border-radius: 12px;
                padding: 14px; min-height: 104px; cursor: pointer; text-decoration: none; color: inherit;
                display: flex; flex-direction: column; justify-content: space-between;
                transition: box-shadow 0.15s, border-color 0.15s;
            }
            .rank-card:hover { border-color: #c7d2fe; box-shadow: 0 6px 16px rgba(79, 70, 229, 0.12); }
            .rank-card.sk { min-height: 104px; border: none; }
            .rank-chip {
                display: inline-block; align-self: flex-start;
                font-size: 13px; font-weight: 800; padding: 4px 10px; border-radius: 999px;
            }
            .rank-chip.g1 { color: #b45309; background: #fef3c7; }
            .rank-chip.g2 { color: #475569; background: #f1f5f9; }
            .rank-chip.g3 { color: #c2410c; background: #ffedd5; }
            .rank-chip.gn { color: #4f46e5; background: #eef2ff; }
            .rank-chip.top { color: #4338ca; background: #e0e7ff; }
            .rank-chip.nr { color: #9ca3af; background: #f3f4f6; }
            .rank-cat { font-size: 15px; font-weight: 700; color: #111827; margin-top: 12px; line-height: 1.25; }
            .carousel-arrow {
                position: absolute; top: 50%; transform: translateY(-50%);
                width: 30px; height: 30px; border-radius: 50%; border: 1px solid #e5e7eb;
                background: #fff; color: #374151; font-size: 16px; cursor: pointer;
                display: flex; align-items: center; justify-content: center; z-index: 2;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
            }
            .carousel-arrow.prev { left: -8px; }
            .carousel-arrow.next { right: -8px; }
            .carousel-arrow:disabled { opacity: 0.35; cursor: default; }
            .rankings-empty { color: #9ca3af; font-size: 14px; padding: 18px 4px; }

            /* ---- Section 3: Review nudge ---- */
            .nudge-section { margin-top: 20px; }
            .nudge-box {
                background: linear-gradient(135deg, #f5f3ff, #eef2ff);
                border: 1px solid #e0e7ff; border-radius: 12px; padding: 16px 18px;
            }
            .nudge-title { font-size: 14px; font-weight: 700; color: #312e81; }
            .nudge-copy { font-size: 13px; color: #5b21b6; margin: 6px 0 12px; line-height: 1.4; }
            .nudge-btns { display: flex; flex-wrap: wrap; gap: 10px; }
            .btn {
                border: none; cursor: pointer; font-weight: 600; font-size: 13px;
                padding: 10px 16px; border-radius: 10px; transition: opacity 0.15s, transform 0.05s;
            }
            .btn:active { transform: translateY(1px); }
            .btn-primary { background: #4f46e5; color: #fff; }
            .btn-primary:hover { opacity: 0.92; }
            .btn-ghost { background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
            .btn-ghost:hover { background: #f5f5ff; }

            .celebrate { text-align: center; padding: 22px 8px 8px; }
            .celebrate .emoji { font-size: 44px; }
            .celebrate h3 { font-size: 20px; margin: 10px 0 6px; color: #111827; }
            .celebrate p { font-size: 14px; color: #6b7280; margin-bottom: 18px; line-height: 1.5; }

            .rank-card.rank-link { text-decoration: none; color: inherit; }
        `;
    }

    async render() {
        // Load the persisted review flag BEFORE first paint so we render the correct nudge.
        const stored = await readLocalStorage(REVIEW_FLAG_KEY);
        if (stored && stored[REVIEW_FLAG_KEY]) {
            this.reviewedDone = true;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
            <div class="modal-content">
                <button class="modal-close-btn" data-trigger="close" title="Close">&times;</button>
                <div class="modal-header">
                    <div class="thumb">🎙️</div>
                    <div>
                        <div>Thanks for rating <span style="color:#4f46e5">${this._esc(this.voice.voice_name || 'this voice')}</span>!</div>
                        <div class="sub">Your feedback keeps rankings fair &amp; helpful.</div>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="section-title">Community rating</div>
                    <div class="summary-section" id="vrr-summary"></div>

                    <div class="section-title">Where it ranks</div>
                    <div class="carousel" id="vrr-rankings"></div>

                    <div class="nudge-section" id="vrr-nudge"></div>
                </div>
            </div>
        `;
        this.shadow.appendChild(backdrop);

        // Kick off the two independent API calls. Rankings is shown immediately in its
        // skeleton state and fills in whenever its (slower) response arrives.
        this._renderSummary();
        this._renderRankings();
        this._renderNudge();

        this._fetchRatingsSummary();
        this._fetchRankings();

        this._bindEvents();
    }

    // ------------------------- aggregate (fast) -------------------------
    _fetchRatingsSummary() {
        if (!this.communicationHelper || !this.voice?.voice_id) {
            this.isLoadingSummary = false;
            this._renderSummary();
            return;
        }

        const requestID = `rating_summary_${Date.now()}`;
        const callbackID = `callback_${requestID}`;

        const finish = (summary) => {
            this.isLoadingSummary = false;
            this.ratingsSummary = summary || null;
            this._renderSummary();
        };

        this.communicationHelper.saveRequest(callbackID, (response) => {
            const summary = (response && response.ratingsSummary) ? response.ratingsSummary : null;
            finish(summary);
        });

        chrome.runtime.sendMessage({
            action: "getVoiceRatingsSummary",
            callbackID,
            payload: { voice_id: this.voice.voice_id }
        });

        // Safety timeout so the number never stays a skeleton forever.
        setTimeout(() => {
            if (this.isLoadingSummary) finish(null);
        }, 8000);
    }

    _renderSummary() {
        const el = this.shadow ? this.shadow.querySelector('#vrr-summary') : null;
        if (!el) return;

        if (this.isLoadingSummary) {
            el.innerHTML = `
                <div class="avg-num sk sk-num"></div>
                <div>
                    <div class="sk sk-stars"></div>
                    <div class="avg-count"><span class="sk" style="display:inline-block;height:14px;width:110px"></span></div>
                </div>
            `;
            return;
        }

        const avg = this.ratingsSummary ? parseFloat(this.ratingsSummary.averageRating) || 0 : 0;
        const total = this.ratingsSummary ? parseInt(this.ratingsSummary.totalRatings, 10) || 0 : 0;
        const pct = Math.max(0, Math.min(100, Math.round((avg / 5) * 100)));

        el.innerHTML = `
            <div class="avg-num">${avg.toFixed(1)}<small>/5</small></div>
            <div>
                <div class="stars-wrap">
                    <span class="stars-off">★★★★★</span>
                    <span class="stars-on" style="width:${pct}%">★★★★★</span>
                </div>
                <div class="avg-count">${total} rating${total === 1 ? '' : 's'}</div>
            </div>
        `;
    }

    // ------------------------- rankings (slow, lazy) -------------------------
    _fetchRankings() {
        if (!this.communicationHelper || !this.voice?.voice_id) {
            this.isLoadingRankings = false;
            this.rankingsError = true;
            this._renderRankings();
            return;
        }

        const requestID = `voice_rankings_${Date.now()}`;
        const callbackID = `callback_${requestID}`;

        const finish = (rankings, error) => {
            this.isLoadingRankings = false;
            this.rankingsError = !!error;
            this.rankings = rankings || [];
            this.carouselIndex = 0;
            this._renderRankings();
        };

        this.communicationHelper.saveRequest(callbackID, (response) => {
            const rankings = (response && response.data && response.data.rankings)
                ? response.data.rankings
                : null;
            finish(rankings, !rankings);
        });

        chrome.runtime.sendMessage({
            action: "getVoiceRankings",
            callbackID,
            payload: { voice_id: this.voice.voice_id }
        });

        setTimeout(() => {
            if (this.isLoadingRankings) finish(null, true);
        }, 12000);
    }

    _rankDisplay(rank) {
        const n = parseInt(rank, 10);
        if (!n || Number.isNaN(n)) return { text: 'NR', cls: 'nr' };
        if (n > 100) return { text: '>100', cls: 'top' };
        const cls = n === 1 ? 'g1' : n === 2 ? 'g2' : n === 3 ? 'g3' : 'gn';
        return { text: `#${n}`, cls };
    }

    _renderRankings() {
        const wrap = this.shadow ? this.shadow.querySelector('#vrr-rankings') : null;
        if (!wrap) return;

        // Skeleton carousel
        if (this.isLoadingRankings) {
            const skBoxes = Array(this.PAGE).fill(
                `<div class="rank-card" aria-hidden="true"></div>`
            ).join('');
            const skeleton = `
                <div class="carousel">
                    <div class="carousel-track-wrap">
                        <div class="carousel-track">${skBoxes}</div>
                    </div>
                </div>
            `;
            // skeleton boxes need shimmer bg
            wrap.innerHTML = skeleton.replace(/rank-card"/g, 'rank-card sk"');
            return;
        }

        if (this.rankingsError || !this.rankings.length) {
            wrap.innerHTML = `<div class="rankings-empty">No category rankings yet for this voice.</div>`;
            return;
        }

        // Map to display cards
        this._rankCards = this.rankings.map(r => {
            const rd = this._rankDisplay(r.rank);
            const slug = slugify(r.category_name);
            const href = `https://${APP_WEB_DOMAIN}/leaderboards/${slug}`;
            return {
                html: `
                    <a class="rank-card rank-link" href="${href}" target="_blank" rel="noopener noreferrer">
                        <span class="rank-chip ${rd.cls}">${rd.text}</span>
                        <span class="rank-cat">${this._esc(r.category_name)}</span>
                    </a>
                `,
                slug
            };
        });

        const pages = Math.ceil(this._rankCards.length / this.PAGE);
        if (this.carouselIndex > pages - 1) this.carouselIndex = Math.max(0, pages - 1);

        const totalWidth = this._rankCards.length * this.BOX_WIDTH;
        const maxTranslate = Math.max(0, totalWidth - (this.PAGE * this.BOX_WIDTH));
        const translate = Math.min(this.carouselIndex * this.PAGE * this.BOX_WIDTH, maxTranslate);

        wrap.innerHTML = `
            <div class="carousel">
                <button class="carousel-arrow prev" data-trigger="carousel-prev" ${this.carouselIndex <= 0 ? 'disabled' : ''}>&#8249;</button>
                <div class="carousel-track-wrap">
                    <div class="carousel-track" style="transform: translateX(-${translate}px)">
                        ${this._rankCards.map(c => c.html).join('')}
                    </div>
                </div>
                <button class="carousel-arrow next" data-trigger="carousel-next" ${this.carouselIndex >= pages - 1 ? 'disabled' : ''}>&#8250;</button>
            </div>
        `;
    }

    // ------------------------- review nudge -------------------------
    _renderNudge() {
        const el = this.shadow ? this.shadow.querySelector('#vrr-nudge') : null;
        if (!el) return;

        const body = this.shadow ? this.shadow.querySelector('.modal-body') : null;

        // Celebration takes over the whole body.
        if (this.celebrate) {
            if (body) body.style.display = 'none';
            const content = this.shadow.querySelector('.modal-content');
            let celeb = content.querySelector('.celebrate');
            if (!celeb) {
                celeb = document.createElement('div');
                celeb.className = 'celebrate';
                content.appendChild(celeb);
            }
            celeb.innerHTML = `
                <div class="emoji">🙌</div>
                <h3>Thank you so much!</h3>
                <p>You're helping other listeners find great voices.<br/>Come hang out with the community!</p>
                <button class="btn btn-primary" data-trigger="discordJoin">Join the Discord</button>
            `;
            return;
        }

        // If review already given previously -> keep summary + rankings, swap nudge for Discord CTA.
        if (this.reviewedDone) {
            el.innerHTML = `
                <div class="nudge-box">
                    <div class="nudge-title">Already have a review? Great!</div>
                    <div class="nudge-copy">Connect with other creators, share feedback, and get early access to new voices.</div>
                    <div class="nudge-btns">
                        <button class="btn btn-primary" data-trigger="discordJoin">Jump into the Discord</button>
                    </div>
                </div>
            `;
            return;
        }

        el.innerHTML = `
            <div class="nudge-box">
                <div class="nudge-title">Enjoying this voice?</div>
                <div class="nudge-copy">A quick review takes 30 seconds and helps others find voices like this one.</div>
                <div class="nudge-btns">
                    <button class="btn btn-primary" data-trigger="wantReview">I want a review</button>
                    <button class="btn btn-ghost" data-trigger="alreadyReviewed">I already reviewed</button>
                </div>
            </div>
        `;
    }

    // ------------------------- events -------------------------
    _bindEvents() {
        const modal = this.shadow.querySelector('.modal-content');
        if (!modal) return;

        modal.addEventListener('click', (e) => {
            const triggerEl = e.target.closest('[data-trigger]');
            if (!triggerEl) return;
            const action = triggerEl.getAttribute('data-trigger');

            if (action === 'close') {
                this.close();
            } else if (action === 'discordJoin') {
                this._trackEvent('join_discord');
                window.open(DISCORD_INVITE_URL, '_blank');
            } else if (action === 'wantReview') {
                this._trackEvent('want_review');
                window.open(STORE_REVIEW_URL, '_blank');
            } else if (action === 'alreadyReviewed') {
                this._markReviewedDone();
            } else if (action === 'carousel-prev') {
                this.carouselIndex = Math.max(0, this.carouselIndex - 1);
                this._renderRankings();
            } else if (action === 'carousel-next') {
                const pages = Math.ceil(this._rankCards ? this._rankCards.length / this.PAGE : 1);
                this.carouselIndex = Math.min(pages - 1, this.carouselIndex + 1);
                this._renderRankings();
            }
        });

        const backdrop = this.shadow.querySelector('.modal-backdrop');
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.close();
        });
    }

    async _markReviewedDone() {
        this.celebrate = true;
        this.reviewedDone = true;
        this._trackEvent('already_reviewed');
        try {
            await saveToLocalStorage({ [REVIEW_FLAG_KEY]: true });
        } catch (e) {
            console.error('Failed to persist review flag', e);
        }
        this._renderNudge();
    }

    _trackEvent(eventType) {
        try {
            const VR_Reader = window.VR_Reader;
            const telemetry = VR_Reader && VR_Reader.savedLocalStorageGlobal
                ? VR_Reader.savedLocalStorageGlobal['ALLOW_TELEMETRY']
                : undefined;
            if (telemetry === false) return;

            chrome.runtime.sendMessage({
                action: "recordReviewNudgeEvent",
                payload: {
                    event_type: eventType,
                    voice_id: this.voice && this.voice.voice_id ? this.voice.voice_id : null
                }
            });
        } catch (e) {
            console.error('Failed to track review nudge event', e);
        }
    }

    close() {
        if (this.hostElement && this.hostElement.parentNode) {
            this.hostElement.parentNode.removeChild(this.hostElement);
        }
        this.hostElement = null;
        this.shadow = null;
        if (this.onClose) this.onClose();
    }

    _esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}
