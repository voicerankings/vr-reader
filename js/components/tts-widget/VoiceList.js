/**
 * ============================================================================
 * VoiceList Module
 * ============================================================================
 * Manages the voice selection UI, including the library, collections, and favorites.
 * Handles rendering of voice items with rich metadata (ratings, languages, tags),
 * provides search functionality, and allows users to set their default voice.
 */
import { saveToLocalStorage, readLocalStorage } from "../../utils/helpers";
import { APP_WEB_DOMAIN } from "../../background/config.js";

export default class VoiceList {
    constructor() {
        this.el = null;
        this.componentDiv = null;
        this.componentIDNAME = "VOICELIST";
        this.currentView = 'library';
        this.currentVoiceList = [];
        this.collectionsData = [];
        this.openCollections = new Set();
        this.searchDebounceTimeout = null;
        
        // ADD THIS NEW PROPERTY:
        this.defaultVoiceId = null;
        
        // Performance optimizations
        this.STAR_SVG_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";
        this.langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
        this.regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
        this.tooltipCache = new Map();
        this.ratingHtmlCache = new Map();
        this.tagsHtmlCache = new Map();
        
        // Global tooltip element
        this.globalTooltip = null;
        this.currentHoveredItem = null;
        this.tooltipUpdateRAF = null;
    }

    initDOM(DOMElement) {
        this.el = DOMElement;
    }

    init() {
        try {
            // Load default voice ID
            chrome.storage.local.get(['DEFAULT_PREMIUM_VOICE_ID'], (result) => {
                this.defaultVoiceId = result.DEFAULT_PREMIUM_VOICE_ID || null;
            });
            
            // Create global tooltip
            this.createGlobalTooltip();
            
            // Tab buttons
            this.componentDiv.querySelector("#FavoritesTabBtn").addEventListener('click', () => this.switchTab('favorites'));
            this.componentDiv.querySelector("#CollectionsTabBtn").addEventListener('click', () => this.switchTab('collections'));
            this.componentDiv.querySelector("#LibraryTabBtn").addEventListener('click', () => this.switchTab('library'));

            // Search input
            this.componentDiv.querySelector("#VoiceSearchInput").addEventListener('input', (e) => this.handleSearch(e.target.value));

            // Voice list click handler
            this.componentDiv.querySelector("#VoiceListContainer").addEventListener('click', (e) => this.handleListClick(e));

            // Voice list hover handlers
            const listContainer = this.componentDiv.querySelector("#VoiceListContainer");
            if (listContainer) {
                listContainer.addEventListener('mouseover', (e) => this.handleMouseOver(e));
                listContainer.addEventListener('mouseout', (e) => this.handleMouseOut(e));
                listContainer.addEventListener('scroll', () => this.updateTooltipPosition());
            }

            // Initial load
            this.switchTab('library');
        } catch(e) {
            console.log(e);
        }
    }
    async makeDefaultVoice(voice) {
        if (voice.voice_service_extension_active === false) {
            alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
            return;
        }

        // Update local reference
        this.defaultVoiceId = voice.voice_id;

        // Save to chrome storage
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_ID': voice.voice_id });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_NAME': voice.voice_name });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_GENDER': voice.voice_gender });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_INSTRUCTIONS': voice.voice_instructions ?? null });

        const languageCode = voice.voice_language_code || (Array.isArray(voice.voice_language_codes) ? voice.voice_language_codes[0] : null);
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_LANGUAGE_CODE': languageCode });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SPEAKER_ID': voice.voice_speaker_id });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_WORDS_PER_MINUTE': voice.voice_words_per_minute });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_SERVICE': voice.voice_service });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voice.voice_has_voice_speed_support });
        await chrome.storage.local.set({ 'DEFAULT_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voice.voice_has_word_timestamp_support });

        VR_Reader.updateAllContentScriptTabs(voice);

        // Update all default voice buttons in the UI
        const allDefaultButtons = this.componentDiv.querySelectorAll('.default-voice-btn');
        allDefaultButtons.forEach(btn => {
            const btnVoiceId = btn.closest('.voice-item')?.dataset.voiceId;
            if (btnVoiceId === voice.voice_id) {
                btn.classList.add('is-default');
                btn.style.color = '#10b981';
            } else {
                btn.classList.remove('is-default');
                btn.style.color = '#9ca3af';
            }
        });

        VR_Reader.makeToast({
            posX2: 25,
            posY: 50,
            delay: 2000,
            action: 'normal',
            title: `${voice.voice_name} is now your default voice!`
        });

        this.selectVoice(voice);
    }
    createGlobalTooltip() {
        this.globalTooltip = document.createElement('div');
        this.globalTooltip.id = 'global-voice-tooltip';
        this.globalTooltip.className = 'html-tooltip-content';
        this.componentDiv.appendChild(this.globalTooltip);
    }

    handleMouseOver(e) {
        const voiceItem = e.target.closest('.voice-item');
        if (voiceItem && voiceItem !== this.currentHoveredItem) {
            this.currentHoveredItem = voiceItem;
            const voiceId = voiceItem.dataset.voiceId;
            const voice = this.findVoiceById(voiceId);
            
            if (voice) {
                this.showTooltip(voiceItem, voice);
            }
        }
    }

    handleMouseOut(e) {
        const voiceItem = e.target.closest('.voice-item');
        if (voiceItem && !voiceItem.contains(e.relatedTarget)) {
            this.hideTooltip();
        }
    }

    findVoiceById(voiceId) {
        // Search in current view
        if (this.currentView === 'collections') {
            for (const collection of this.collectionsData) {
                const voice = collection.voices.find(v => v.voice_id === voiceId);
                if (voice) return voice;
            }
        } else {
            return this.currentVoiceList.find(v => v.voice_id === voiceId);
        }
        return null;
    }

    showTooltip(element, voice) {
        if (!this.globalTooltip) return;
        
        const content = this.getTooltipContent(voice);
        this.globalTooltip.innerHTML = content;
        this.globalTooltip.style.opacity = '0';
        this.globalTooltip.style.visibility = 'visible';
        
        // Force a reflow to get accurate dimensions
        this.globalTooltip.offsetHeight;
        
        this.updateTooltipPosition();
        
        // Fade in with delay
        setTimeout(() => {
            if (this.currentHoveredItem === element) {
                this.globalTooltip.style.transition = 'opacity 0.2s ease-in-out';
                this.globalTooltip.style.opacity = '1';
            }
        }, 300);
    }

    hideTooltip() {
        this.currentHoveredItem = null;
        if (this.globalTooltip) {
            this.globalTooltip.style.transition = 'none';
            this.globalTooltip.style.opacity = '0';
            this.globalTooltip.style.visibility = 'hidden';
        }
        if (this.tooltipUpdateRAF) {
            cancelAnimationFrame(this.tooltipUpdateRAF);
            this.tooltipUpdateRAF = null;
        }
    }

    updateTooltipPosition() {
        if (!this.currentHoveredItem || !this.globalTooltip) return;
        
        if (this.tooltipUpdateRAF) {
            cancelAnimationFrame(this.tooltipUpdateRAF);
        }
        
        this.tooltipUpdateRAF = requestAnimationFrame(() => {
            const itemRect = this.currentHoveredItem.getBoundingClientRect();
            const tooltipRect = this.globalTooltip.getBoundingClientRect();
            const scrollContainer = this.componentDiv.querySelector('#VoiceListContainer');
            const containerRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
            
            const tooltipWidth = 288;
            const tooltipHeight = tooltipRect.height || 150;
            const offset = 12;
            
            // Calculate horizontal position (centered on item)
            let left = itemRect.left + (itemRect.width / 2) - (tooltipWidth / 2);
            
            // Keep tooltip within viewport horizontally
            const viewportWidth = window.innerWidth;
            if (left < 10) left = 10;
            if (left + tooltipWidth > viewportWidth - 10) {
                left = viewportWidth - tooltipWidth - 10;
            }
            
            // Calculate vertical position
            let top;
            let showAbove = false;
            
            if (containerRect) {
                const spaceAbove = itemRect.top - containerRect.top;
                const spaceBelow = containerRect.bottom - itemRect.bottom;
                
                // Decide whether to show above or below
                if (spaceAbove >= tooltipHeight + offset || spaceAbove > spaceBelow) {
                    showAbove = true;
                    top = itemRect.top - tooltipHeight - offset;
                } else {
                    showAbove = false;
                    top = itemRect.bottom + offset;
                }
            } else {
                // Fallback to viewport-based calculation
                const spaceAbove = itemRect.top;
                const spaceBelow = window.innerHeight - itemRect.bottom;
                
                if (spaceAbove >= tooltipHeight + offset || spaceAbove > spaceBelow) {
                    showAbove = true;
                    top = itemRect.top - tooltipHeight - offset;
                } else {
                    showAbove = false;
                    top = itemRect.bottom + offset;
                }
            }
            
            // Apply position
            this.globalTooltip.style.left = `${left}px`;
            this.globalTooltip.style.top = `${top}px`;
            this.globalTooltip.style.width = `${tooltipWidth}px`;
            
            // Update arrow direction
            if (showAbove) {
                this.globalTooltip.classList.add('show-above');
                this.globalTooltip.classList.remove('show-below');
            } else {
                this.globalTooltip.classList.add('show-below');
                this.globalTooltip.classList.remove('show-above');
            }
            
            // Position arrow to align with item center
            const arrowOffset = (itemRect.left + itemRect.width / 2) - left;
            this.globalTooltip.style.setProperty('--arrow-offset', `${arrowOffset}px`);
        });
    }

    getRatingHtml(voice) {
        const cacheKey = `${voice.voice_review_average}-${voice.voice_review_count}`;
        if (this.ratingHtmlCache.has(cacheKey)) {
            return this.ratingHtmlCache.get(cacheKey);
        }

        const average = voice.voice_review_average;
        const count = voice.voice_review_count;
        if (!count || count === 0) return '';
        
        const widthPercentage = (average / 5) * 100;

        const stars = `
            <div style="position: relative; display: inline-flex; align-items: center; gap: 2px;">
                <div style="display: flex; gap: 2px;">
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #4b5563;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                </div>
                <div style="position: absolute; top: 0; left: 0; display: flex; overflow: hidden; width: ${widthPercentage}%; gap: 2px;">
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                    <svg style="width: 16px; height: 16px; color: #fbbf24; flex-shrink: 0;" viewBox="0 0 20 20" fill="currentColor">
                        <path d="${this.STAR_SVG_PATH}"/>
                    </svg>
                </div>
            </div>
        `;

        const result = `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                ${stars}
                <span style="color: white; font-weight: 600;">${Number(average).toFixed(1)}</span>
                <span style="color: #d1d5db;">(${count})</span>
            </div>
        `;

        this.ratingHtmlCache.set(cacheKey, result);
        return result;
    }

    getLanguagesTooltipHtml(voice) {
        if (!voice.voice_language_codes || voice.voice_language_codes.length === 0) return '';
        
        return `
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                ${voice.voice_language_codes.slice(0, 1).map(code => {
                    try {
                        const parts = code.split('-');
                        const langCode = parts[0];

                        let langName = this.langDisplay.of(langCode);
                        const regionCode = parts.length > 1 ? parts[1].toUpperCase() : null;
                        let regionName = regionCode ? this.regionDisplay.of(regionCode) : '';
                        
                        if (!regionCode) return `<span style="font-size: 12px; color: white;">${code}</span>`;
                        return `
                            <span style="display: inline-flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px; color: white;">${langName} / ${regionName}</span>
                                <img style="height: 16px; width: auto; border-radius: 3px;" src="https://flagsapi.com/${regionCode}/flat/24.png" alt="${code}" onerror="this.style.display='none'" />
                                
                            </span>
                        `;
                    } catch (e) {
                        return `<span style="font-size: 12px; color: white;">${code}</span>`;
                    }
                }).join('')}
            </div>
        `;
    }

    
    getTagsHtml(voice) {
        const tags = voice.voice_suggested_tags_filtered || voice.voice_suggested_tags;
        const cacheKey = tags ? tags.join(',') : '';

        if (!cacheKey) return '';
        if (this.tagsHtmlCache.has(cacheKey)) {
            return this.tagsHtmlCache.get(cacheKey);
        }

        const tagBadges = tags.map(tag =>
            `<span style="display: inline-block; background-color: #4b5563; color: #e5e7eb; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500;">${tag}</span>`
        ).join('');

        const result = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${tagBadges}</div>`;
        this.tagsHtmlCache.set(cacheKey, result);
        return result;
    }

    getTooltipContent(voice) {
        if (this.tooltipCache.has(voice.voice_id)) {
            return this.tooltipCache.get(voice.voice_id);
        }

        const nameHtml = `<div style="text-align:left"><strong style="font-size: 14px;">${voice.voice_name}</strong></div>`;
        const ratingSection = this.getRatingHtml(voice);
        const languagesSection = this.getLanguagesTooltipHtml(voice);
        const tagsSection = this.getTagsHtml(voice);

        let finalHtml = nameHtml;

        if (ratingSection) {
            finalHtml += `<div style="margin-top: 6px;">${ratingSection}</div>`;
        }

        if (ratingSection && (languagesSection || tagsSection)) {
            finalHtml += `<hr style="margin: 8px 0; border: none; border-top: 1px solid #4b5563;">`;
        }
        
        if (languagesSection) {
            finalHtml += `<div style="margin-top: 6px;">${languagesSection}</div>`;
        }
        
        if (tagsSection) {
            const marginTop = languagesSection ? '8px' : '6px';
            finalHtml += `<div style="margin-top: ${marginTop};">${tagsSection}</div>`;
        }

        this.tooltipCache.set(voice.voice_id, finalHtml);
        return finalHtml;
    }

    getLanguageInfo(languageCodes) {
        if (!languageCodes || !Array.isArray(languageCodes)) return { primaryCountryCode: null, count: 0 };
        const codes = languageCodes;
        const count = codes.length;
        if (count === 0) return { primaryCountryCode: null, count: 0 };
        let primaryCode = codes.find(c => c.toLowerCase() === 'en-us') || codes.find(c => c.toLowerCase().startsWith('en-')) || codes[0];
        const parts = primaryCode.split('-');
        const countryCode = parts.length > 1 ? parts[1].toUpperCase() : null;
        return { primaryCountryCode: countryCode, count: count };
    }

    switchTab(view) {
        this.currentView = view;
        
        // Update active tab styling
        const tabs = ['FavoritesTabBtn', 'CollectionsTabBtn', 'LibraryTabBtn'];
        tabs.forEach(tabId => {
            const tab = this.componentDiv.querySelector(`#${tabId}`);
            if (tabId.toLowerCase().includes(view)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Clear search
        this.componentDiv.querySelector("#VoiceSearchInput").value = '';

        // Load appropriate content
        if (view === 'favorites') {
            this.loadFavorites();
        } else if (view === 'collections') {
            this.loadCollections();
        } else if (view === 'library') {
            this.loadLibrary();
        }
    }

    async loadFavorites() {
        this.showLoading();
        
        const callbackID = `getVoiceFavorites_${Date.now()}`;
        VR_Reader.saveRequest(callbackID, (data) => {
            this.currentVoiceList = data.favorites || [];
            this.renderVoiceList(this.currentVoiceList);
        });
        
        chrome.runtime.sendMessage({
            action: "getVoiceFavorites",
            callbackID,
            payload: {}
        });
    }

    async loadCollections() {
        this.showLoading();
        
        const callbackID = `getVoiceCollections_${Date.now()}`;
        VR_Reader.saveRequest(callbackID, (data) => {
            this.collectionsData = (data.collections || []).map(collection => ({
                ...collection,
                voices: [],
                voicesLoaded: false,
                loadingVoices: false
            }));
            this.renderCollections();
        });
        
        chrome.runtime.sendMessage({
            action: "getVoiceCollections",
            callbackID,
            payload: {}
        });
    }

    async loadLibrary() {
        const storage = await readLocalStorage(['voiceRecentSearches']);
        const recentSearches = storage.voiceRecentSearches || [];
        
        // ✅ CRITICAL FIX: Store voices so findVoiceById can find them
        this.currentVoiceList = recentSearches;
        
        if (recentSearches.length > 0) {
            this.renderVoiceList(recentSearches, 'Recent Searches');
        } else {
            this.currentVoiceList = [];
            this.showMessage('Type to search all voices...');
        }
    }

    handleSearch(query) {
        clearTimeout(this.searchDebounceTimeout);
        
        const trimmedQuery = query.trim();
        
        if (this.currentView === 'library') {
            if (!trimmedQuery) {
                this.loadLibrary();
                return;
            }
            
            this.searchDebounceTimeout = setTimeout(() => {
                this.searchVoices(trimmedQuery);
            }, 300);
        } else if (this.currentView === 'favorites') {
            const filtered = this.currentVoiceList.filter(voice => 
                voice.voice_name.toLowerCase().includes(trimmedQuery.toLowerCase())
            );
            this.renderVoiceList(filtered);
        } else if (this.currentView === 'collections') {
            const filtered = this.collectionsData.filter(collection =>
                collection.collection_name.toLowerCase().includes(trimmedQuery.toLowerCase())
            );
            this.renderCollections(filtered);
        }
    }

async searchVoices(query) {
    this.showLoading();
    
    const callbackID = `getVoiceSearch_${Date.now()}`;
    VR_Reader.saveRequest(callbackID, (data) => {
        this.currentVoiceList = data.voices || []; // ✅ Already correct
        this.renderVoiceList(this.currentVoiceList);
    });
    
    chrome.runtime.sendMessage({
        action: "getVoiceSearch",
        callbackID,
        payload: { search: query }
    });
}

    async loadCollectionVoices(collectionId, collectionIndex) {
        const collection = this.collectionsData[collectionIndex];
        
        if (collection.voicesLoaded || collection.loadingVoices) return;
        
        collection.loadingVoices = true;
        this.updateCollectionLoadingState(collectionId, true);
        
        const callbackID = `getCollectionVoices_${Date.now()}`;
        VR_Reader.saveRequest(callbackID, (data) => {
            collection.voices = data.voices || [];
            collection.voicesLoaded = true;
            collection.loadingVoices = false;
            this.renderCollectionVoices(collectionId, collection.voices);
        });
        
        chrome.runtime.sendMessage({
            action: "getVoiceList",
            callbackID,
            payload: {
                collection_id: collectionId,
                limit: 1000,
                offset: 0
            }
        });
    }

    toggleCollection(collectionId, collectionIndex) {
        if (this.openCollections.has(collectionId)) {
            this.openCollections.delete(collectionId);
            const voicesContainer = this.componentDiv.querySelector(`#collection-voices-${collectionId}`);
            if (voicesContainer) voicesContainer.style.display = 'none';
            
            const arrow = this.componentDiv.querySelector(`#collection-arrow-${collectionId}`);
            if (arrow) arrow.classList.remove('rotated');
        } else {
            this.openCollections.add(collectionId);
            const voicesContainer = this.componentDiv.querySelector(`#collection-voices-${collectionId}`);
            if (voicesContainer) voicesContainer.style.display = 'block';
            
            const arrow = this.componentDiv.querySelector(`#collection-arrow-${collectionId}`);
            if (arrow) arrow.classList.add('rotated');
            
            this.loadCollectionVoices(collectionId, collectionIndex);
        }
    }

    handleListClick(e) {
        // Check for default button click first
        const defaultButton = e.target.closest('.default-voice-btn');
        if (defaultButton) {
            e.stopPropagation();
            const voiceId = defaultButton.dataset.voiceId;
            const selectedVoice = this.findVoiceById(voiceId);
            
            if (selectedVoice) {
                this.makeDefaultVoice(selectedVoice);
            }
            return;
        }

        // Check for details button click
        const detailsButton = e.target.closest('.details-button');
        if (detailsButton) {
            e.stopPropagation();
            return; // Let the link handle navigation
        }
        
        const voiceItem = e.target.closest('.voice-item');
        const collectionHeader = e.target.closest('.collection-header');
        
        if (voiceItem) {
            const voiceId = voiceItem.dataset.voiceId;
            const selectedVoice = this.findVoiceById(voiceId);
            
            if (selectedVoice) {
                this.selectVoice(selectedVoice);
            }
        } else if (collectionHeader) {
            const collectionId = collectionHeader.dataset.collectionId;
            const collectionIndex = parseInt(collectionHeader.dataset.collectionIndex);
            this.toggleCollection(collectionId, collectionIndex);
        }
    }

    async selectVoice(voice) {
        try {
      
            if(voice.voice_service_extension_active === false) {
                alert(`Sorry, ${voice.voice_service} voices are not available yet for the extension`);
                return;
            }

            const storage = await readLocalStorage(['voiceRecentSearches']);
            let recentSearches = storage.voiceRecentSearches || [];
            
            const existingIndex = recentSearches.findIndex(item => item.voice_id === voice.voice_id);
            if (existingIndex > -1) {
                recentSearches.splice(existingIndex, 1);
            }
            recentSearches.unshift(voice);
            if (recentSearches.length > 6) {
                recentSearches = recentSearches.slice(0, 6);
            }
            await saveToLocalStorage({ 'voiceRecentSearches': recentSearches }, true);
        } catch (e) {
            console.error("Failed to update recent searches:", e);
        }

        const defaultVoiceData = {
            'ACTIVE_PREMIUM_VOICE_ID': voice.voice_id,
            'ACTIVE_PREMIUM_VOICE_NAME': voice.voice_name,
            'ACTIVE_PREMIUM_VOICE_GENDER': voice.voice_gender,
            'ACTIVE_PREMIUM_VOICE_INSTRUCTIONS': voice.voice_instructions,
            'ACTIVE_PREMIUM_VOICE_LANGUAGE_CODE': voice.voice_language_codes ? voice.voice_language_codes[0] : null,
            'ACTIVE_PREMIUM_VOICE_SPEAKER_ID': voice.voice_speaker_id,
            'ACTIVE_PREMIUM_VOICE_WORDS_PER_MINUTE': voice.voice_words_per_minute,
            'ACTIVE_PREMIUM_VOICE_SERVICE': voice.voice_service,
            'ACTIVE_PREMIUM_VOICE_SPEED': (voice.voice_speed)? voice.voice_speed : 1,
            'ACTIVE_PREMIUM_VOICE_HAS_VOICE_SPEED_SUPPORT': voice.voice_has_voice_speed_support,
            'ACTIVE_PREMIUM_VOICE_HAS_WORD_TIMESTAMP_SUPPORT': voice.voice_has_word_timestamp_support,
        };
        await saveToLocalStorage(defaultVoiceData, true);
        await VR_Reader.changeActiveVoice();
        
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.voiceClass) {
            VR_Reader.ttsWidget.voiceClass.voiceChanged();
        }

        this.highlightSelectedVoice(voice.voice_id);
    }

    highlightSelectedVoice(voiceId) {
        const allVoiceItems = this.componentDiv.querySelectorAll('.voice-item');
        allVoiceItems.forEach(item => {
            if (item.dataset.voiceId === voiceId) {
                item.classList.add('selected');
                setTimeout(() => item.classList.remove('selected'), 1000);
            }
        });
    }

    showLoading() {
        const container = this.componentDiv.querySelector("#VoiceListContainer");
        container.innerHTML = `
            <div class="loading-state">
                ${this.svgLoading()}
            </div>
        `;
    }

    showMessage(message) {
        const container = this.componentDiv.querySelector("#VoiceListContainer");
        container.innerHTML = `
            <div class="message-state">
                ${message}
            </div>
        `;
    }

    renderVoiceList(voices, title = '') {
        const container = this.componentDiv.querySelector("#VoiceListContainer");
        
        if (!voices || voices.length === 0) {
            let message = (this.currentView === 'favorites')
                ? 'No favorite voices saved'
                : 'No voices found';
            container.innerHTML = `<div class="message-state">${message}</div>`;
            return;
        }

        container.innerHTML = '';
        if (title) {
            container.insertAdjacentHTML('beforeend', `<div class="section-title">${title}</div>`);
        }

        const chunkSize = 20;
        let currentIndex = 0;
        const tempContainer = document.createElement('div');

        const renderChunk = () => {
            const chunk = voices.slice(currentIndex, currentIndex + chunkSize);
            
            const html = chunk.map(voice => this.createVoiceItemHTML(voice)).join('');
            tempContainer.innerHTML = html;
            
            while (tempContainer.firstChild) {
                container.appendChild(tempContainer.firstChild);
            }

            currentIndex += chunkSize;

            if (currentIndex < voices.length) {
                requestAnimationFrame(renderChunk);
            }
        };

        requestAnimationFrame(renderChunk);
    }

    renderCollections(collections = null) {
        const container = this.componentDiv.querySelector("#VoiceListContainer");
        const collectionsToRender = collections || this.collectionsData;
        
        if (!collectionsToRender || collectionsToRender.length === 0) {
            container.innerHTML = '<div class="message-state">No collections found</div>';
            return;
        }

        const html = collectionsToRender.map((collection, index) => `
            <div class="collection-item">
                <div class="collection-header" data-collection-id="${collection.collection_id}" data-collection-index="${index}">
                    <div class="collection-info">
                        <span class="collection-name">${collection.collection_name}</span>
                        <span class="collection-count">(${collection.voice_count || 0} voices)</span>
                    </div>
                    <svg id="collection-arrow-${collection.collection_id}" class="collection-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                    </svg>
                </div>
                <div id="collection-voices-${collection.collection_id}" class="collection-voices" style="display: none;">
                    <div class="loading-state-small">Click to load voices...</div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    renderCollectionVoices(collectionId, voices) {
        const voicesContainer = this.componentDiv.querySelector(`#collection-voices-${collectionId}`);
        if (!voicesContainer) return;
        
        if (!voices || voices.length === 0) {
            voicesContainer.innerHTML = '<div class="message-state-small">No voices in this collection</div>';
            return;
        }

        voicesContainer.innerHTML = '';

        const chunkSize = 15;
        let currentIndex = 0;
        const tempContainer = document.createElement('div');

        const renderChunk = () => {
            const chunk = voices.slice(currentIndex, currentIndex + chunkSize);
            
            const html = chunk.map(voice => this.createVoiceItemHTML(voice)).join('');
            tempContainer.innerHTML = html;
            
            while (tempContainer.firstChild) {
                voicesContainer.appendChild(tempContainer.firstChild);
            }

            currentIndex += chunkSize;

            if (currentIndex < voices.length) {
                requestAnimationFrame(renderChunk);
            }
        };

        requestAnimationFrame(renderChunk);
    }

    updateCollectionLoadingState(collectionId, isLoading) {
        const voicesContainer = this.componentDiv.querySelector(`#collection-voices-${collectionId}`);
        if (!voicesContainer) return;
        
        if (isLoading) {
            voicesContainer.innerHTML = `<div class="loading-state-small">${this.svgLoading(20)}</div>`;
        }
    }

    createVoiceItemHTML(voice) {
        if(voice.voice_id === null || voice.voice_name === null || voice.voice_gender === null) return '';

        const genderClass = voice.voice_gender.toLowerCase() === 'male' ? 'male' : 'female';
        const langInfo = this.getLanguageInfo(voice.voice_language_codes);
        const serviceIcon = voice.voice_service_alias 
            ? `<img class="service-icon" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${voice.voice_service_alias}&size=32" alt="${voice.voice_service}" onerror="this.style.display='none'"/>`
            : '';
        
        const detailsUrl = `https://${APP_WEB_DOMAIN}/voice/${voice.voice_service}/${voice.voice_gender}/${voice.voice_speaker_id}`;
        const isDefault = this.defaultVoiceId === voice.voice_id;
        
        return `
            <div class="voice-item" data-voice-id="${voice.voice_id}">
                <div class="hover-action-buttons">
                    <button class="default-voice-btn ${isDefault ? 'is-default' : ''}" data-voice-id="${voice.voice_id}" title="${isDefault ? 'This is your default voice' : 'Make default voice'}">
                        ${this.svgDefaultVoice(18)}
                    </button>
                    <a href="${detailsUrl}" target="_blank" class="details-button" onclick="event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        Details
                    </a>
                </div>

                <div class="voice-left">
                    <div class="gender-circle ${genderClass}"></div>
                    <span class="voice-name">
                        ${voice.voice_name}
                        ${langInfo.primaryCountryCode ? `
                            <img class="flag-icon" src="https://flagsapi.com/${langInfo.primaryCountryCode}/flat/24.png" alt="${langInfo.primaryCountryCode} flag" onerror="this.style.display='none'" />
                            ${langInfo.count > 1 ? `<span class="language-count">(+${langInfo.count - 1})</span>` : ''}
                        ` : ''}

                        ${voice.voice_speed && voice.voice_speed != 1 ? `
                            [${voice.voice_speed}x]
                        ` : ''}

                    </span>
                </div>
                <div class="voice-right">
                    <span class="voice-service">${voice.voice_service}</span>
                    ${serviceIcon}
                </div>
            </div>
        `;
    }

    svgLoading(size = 30) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor"><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle stroke-opacity=".5" cx="18" cy="18" r="18"/><path d="M36 18c0-9.94-8.06-18-18-18"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/></path></g></g></svg>`;
    }
    svgDefaultVoice(size = 18) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
        </svg>`;
    }
    createHTML() {
        return `
            <div style="height:100%; display:grid; grid-template-rows: 50px auto 50px; gap:8px; background: white; border-radius: 8px; padding: 2px;">
                <!-- Search Box -->
                <div style="grid-row:1;">
                    <input 
                        type="text" 
                        id="VoiceSearchInput" 
                        class="search-input" 
                        placeholder="Search voices..."
                    />
                </div>

                <!-- Voice List Container -->
                <div id="VoiceListContainer" style="grid-row:2; overflow-y: auto; padding: 4px;height:174px;width:400px;">
                    <div class="loading-state">${this.svgLoading()}</div>
                </div>

                <!-- Tab Buttons -->
                <div class="tab-buttons" style="grid-row:3;">
                    <button class="tab-button active" id="FavoritesTabBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                            <path fill="currentColor" d="m12 21l-1.45-1.32C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21Z"/>
                        </svg>
                        <span>Favorites</span>
                    </button>
                    <button class="tab-button" id="CollectionsTabBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                        </svg>
                        <span>Collections</span>
                    </button>
                    <button class="tab-button" id="LibraryTabBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M23.998 11.978v.023C23.998 18.628 18.626 24 11.999 24a11.947 11.947 0 0 1-7.553-2.675l.022.018a1.162 1.162 0 0 1-.089-1.724l.545-.545a1.162 1.162 0 0 1 1.546-.094l-.002-.002a8.848 8.848 0 0 0 5.53 1.925A8.903 8.903 0 1 0 5.896 5.517l.005-.004l2.456 2.456a.774.774 0 0 1-.548 1.321H.775a.774.774 0 0 1-.774-.774V1.482A.775.775 0 0 1 1.322.934l2.389 2.389A11.955 11.955 0 0 1 12 0c6.619 0 11.987 5.36 11.999 11.976v.001zm-8.753 3.811l.475-.611a1.158 1.158 0 0 0-.202-1.628l-.003-.002l-1.969-1.532V6.968c0-.641-.52-1.162-1.162-1.162h-.774c-.641 0-1.162.52-1.162 1.162v6.56l3.165 2.461a1.162 1.162 0 0 0 1.63-.197z"/></svg>
                        <span>Recent</span>
                    </button>
                </div>
            </div>
            ${this.style()}
        `;
    }

    style() {
        if (!this.el.querySelector(`#${this.componentIDNAME}_STYLE`)) {
            return `
                <style id="${this.componentIDNAME}_STYLE">
                    /* Search Input */
                    .search-input {
                        width: 100%;
                        padding: 10px 14px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        font-size: 14px;
                        outline: none;
                        transition: border-color 0.2s;
                        box-sizing: border-box;
                    }
                    .search-input:focus {
                        border-color: #3b82f6;
                    }

                    /* Tab Buttons */
                    .tab-buttons {
                        display: flex;
                        gap: 4px;
                        background: #f5f5f5;
                        padding: 4px;
                        border-radius: 8px;
                    }
                    .tab-button {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        padding: 10px;
                        border: none;
                        background: transparent;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        color: #666;
                        transition: all 0.2s;
                    }
                    .tab-button:hover {
                        background: #e8e8e8;
                    }
                    .tab-button.active {
                        background: white;
                        color: #3b82f6;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }

                    /* Voice Item */
                    .voice-item {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: background 0.2s;
                        margin-bottom: 4px;
                        position: relative;
                    }
                    .voice-item:hover {
                        background: #f5f5f5;
                    }
                    .voice-item.selected {
                        background: #e3f2fd;
                        animation: pulse 0.5s;
                    }

                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.02); }
                    }

                    .hover-action-buttons {
                        position: absolute;
                        top: 5px;
                        right: 8px;
                        display: none;
                        align-items: center;
                        gap: 4px;
                        z-index: 10;
                        background-color: #f5f5f5;
                    }

                    .voice-item:hover .hover-action-buttons {
                        display: flex;
                    }

                    .default-voice-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 32px;
                        height: 32px;
                        background: white;
                        color: #9ca3af;
                        border: 1px solid #e0e0e0;
                        border-radius: 4px;
                        cursor: pointer;
                        transition: all 0.2s;
                        padding: 0;
                    }

                    .default-voice-btn:hover {
                        background: #f5f5f5;
                        border-color: #cbd5e0;
                        color: #4a5568;
                    }

                    .default-voice-btn.is-default {
                        color: #10b981;
                        border-color: #10b981;
                        background: #ecfdf5;
                    }

                    /* Update details button styles */
                    .details-button {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        padding: 6px 10px;
                        background: #3b82f6;
                        color: white;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        text-decoration: none;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        border: none;
                    }

                    .details-button:hover {
                        background: #2563eb;
                        transform: translateY(-1px);
                        box-shadow: 0 3px 6px rgba(0,0,0,0.15);
                    }
                    .voice-left {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .voice-right {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .gender-circle {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        flex-shrink: 0;
                    }
                    .gender-circle.male {
                        background-color: #3b82f6;
                    }
                    .gender-circle.female {
                        background-color: #a855f7;
                    }

                    .voice-name {
                        font-size: 14px;
                        font-weight: 500;
                        color: #333;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .flag-icon {
                        height: 14px;
                        width: auto;
                        border-radius: 2px;
                    }

                    .language-count {
                        font-size: 11px;
                        color: #888;
                        font-weight: normal;
                    }

                    .flag-icon-tooltip {
                        height: 20px;
                        width: auto;
                        border-radius: 3px;
                    }

                    .flex-wrap {
                        flex-wrap: wrap;
                    }

                    .voice-service {
                        font-size: 12px;
                        color: #999;
                    }

                    .service-icon {
                        width: 16px;
                        height: 16px;
                        border-radius: 3px;
                    }

                    /* Collection Items */
                    .collection-item {
                        margin-bottom: 8px;
                    }
                    .collection-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    .collection-header:hover {
                        background: #e9ecef;
                    }
                    .collection-info {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .collection-name {
                        font-weight: 600;
                        font-size: 14px;
                        color: #333;
                    }
                    .collection-count {
                        font-size: 12px;
                        color: #999;
                    }
                    .collection-arrow {
                        transition: transform 0.3s;
                    }
                    .collection-arrow.rotated {
                        transform: rotate(180deg);
                    }
                    .collection-voices {
                        padding-left: 20px;
                        margin-top: 4px;
                    }

                    /* Global HTML Tooltip Styles */
                    #global-voice-tooltip {
                        position: fixed;
                        background-color: #1f2937;
                        color: white;
                        padding: 12px 16px;
                        border-radius: 8px;
                        font-size: 13px;
                        line-height: 1.5;
                        opacity: 0;
                        visibility: hidden;
                        pointer-events: none;
                        z-index: 10000;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        white-space: normal;
                        display: block;
                    }

                    #global-voice-tooltip strong {
                        color: white;
                    }

                    #global-voice-tooltip.show-below::after {
                        content: '';
                        position: absolute;
                        bottom: 100%;
                        left: var(--arrow-offset, 50%);
                        transform: translateX(-50%);
                        border-width: 6px;
                        border-style: solid;
                        border-color: transparent transparent #1f2937 transparent;
                    }

                    #global-voice-tooltip.show-above::after {
                        content: '';
                        position: absolute;
                        top: 100%;
                        left: var(--arrow-offset, 50%);
                        transform: translateX(-50%);
                        border-width: 6px;
                        border-style: solid;
                        border-color: #1f2937 transparent transparent transparent;
                    }

                    /* Utility classes for tooltip content */
                    .flex { display: flex; }
                    .inline-flex { display: inline-flex; }
                    .items-center { align-items: center; }
                    .gap-2 { gap: 8px; }
                    .relative { position: relative; }
                    .absolute { position: absolute; }
                    .top-0 { top: 0; }
                    .left-0 { left: 0; }
                    .overflow-hidden { overflow: hidden; }
                    .flex-shrink-0 { flex-shrink: 0; }
                    .w-4 { width: 16px; }
                    .h-4 { height: 16px; }
                    .text-sm { font-size: 14px; }
                    .text-gray-300 { color: #d1d5db; }
                    .text-gray-500 { color: #6b7280; }
                    .text-gray-700 { color: #374151; }
                    .text-gray-400 { color: #9ca3af; }
                    .text-yellow-400 { color: #fbbf24; }
                    .font-semibold { font-weight: 600; }
                    .font-light { font-weight: 300; }
                    .inline-block { display: inline-block; }
                    .ml-1 { margin-left: 4px; }
                    .px-1 { padding-left: 4px; padding-right: 4px; }
                    .rounded-sm { border-radius: 2px; }

                    /* States */
                    .loading-state {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 40px;
                        color: #999;
                    }
                    .loading-state-small {
                        display: flex;
                        justify-content: center;
                        padding: 20px;
                        color: #999;
                        font-size: 13px;
                    }
                    .message-state {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 40px;
                        color: #999;
                        font-size: 14px;
                    }
                    .message-state-small {
                        text-align: center;
                        padding: 20px;
                        color: #999;
                        font-size: 13px;
                    }
                    .section-title {
                        font-size: 12px;
                        font-weight: 600;
                        color: #666;
                        padding: 8px 12px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        margin-bottom: 8px;
                    }

                    /* Scrollbar */
                    #VoiceListContainer::-webkit-scrollbar {
                        width: 6px;
                    }
                    #VoiceListContainer::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 3px;
                    }
                    #VoiceListContainer::-webkit-scrollbar-thumb {
                        background: #ccc;
                        border-radius: 3px;
                    }
                    #VoiceListContainer::-webkit-scrollbar-thumb:hover {
                        background: #999;
                    }
                </style>
            `;
        }
        return '';
    }

    render() {
        this.componentDiv = document.createElement("div");
        this.componentDiv.id = `${this.componentIDNAME}_Component`;
        this.componentDiv.style.height = `100%`;
        this.componentDiv.innerHTML = this.createHTML();

        this.el.append(this.componentDiv);
        this.init();
    }
}
