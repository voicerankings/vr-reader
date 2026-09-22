/**
 * ============================================================================
 * WidgetEvents Module
 * ============================================================================
 * Centralizes the DOM event listeners and handlers for the TTSWidget.
 * This includes binding click events for playback buttons, UI toggles (pin, read aloud,
 * text selector), tab switching, and window visibility/focus tracking.
 */
import {
    deleteSettingPropertyInAllDomains,
    setDomainSettings,
    getHostName,
    saveToLocalStorage,
    getQuadrantPlacementCSS
} from "../../utils/helpers";
import { CONSTANTS } from "../../../js/constants/constants"
import { toggleTab } from './TabController.js';

export function initVisibilityListeners(widget) {
    widget.visibilityHandler = () => {
        const isFocused = !document.hidden && document.hasFocus();
        console.log(`Tab Visibility Change: ${isFocused ? 'Focused' : 'Background'}`);
        try {
            chrome.runtime.sendMessage({
                action: "tab-visibility-change",
                isFocused: isFocused
            });
        } catch (e) {
            console.warn("Could not send visibility change (extension context invalid?)", e);
        }
    };

    document.addEventListener("visibilitychange", widget.visibilityHandler);
    window.addEventListener("focus", widget.visibilityHandler);
    window.addEventListener("blur", widget.visibilityHandler);
    widget.visibilityHandler();
}

export async function initListeners(widget) {
    const root = widget.superUltraRoot;
    const VR_Reader = window.VR_Reader;

    // ESC key handling:
    //   - If the ratings overlay is up, ESC closes it (first press).
    //   - If a modal (e.g. Power-off confirm) is already open, ESC closes it.
    //   - Otherwise ESC triggers the widget's close modal (Power off).
    widget.escKeyHandler = (e) => {
        if (e.key !== 'Escape') return;

        // Never hijack Escape inside editable fields (e.g. the comment modal).
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            return;
        }

        // Priority 1: close the ratings overlay if it's up.
        if (VR_Reader.ratingsOverlayClass || document.querySelector('#shadowdom-vk-ratings-overlay')) {
            if (VR_Reader.ratingsOverlayClass) {
                VR_Reader.ratingsOverlayClass.close();
            }
            return;
        }

        // Priority 2: close any open modal (e.g. Power-off confirm) so ESC can
        // back out of it before re-triggering the close modal.
        if (document.querySelector('#shadowdom-modal-large')) {
            if (VR_Reader.modalLargeClass) {
                VR_Reader.modalLargeClass.close();
            }
            return;
        }

        // Priority 3: trigger the widget's close modal (same as the X button).
        root.querySelector("#CloseButton")?.click();
    };
    document.addEventListener('keydown', widget.escKeyHandler);

    root.querySelector("#HighlightAudioMessage")?.addEventListener("mousedown", (e) => {
        widget.voiceClass.stop(true, true);
        widget.playAudioHighlightedText()
        widget.closeMiniAlertMessagePopup("HighlightAudioMessage")
    })

    root.querySelector("#ReadTextAreaSelectorButton")?.addEventListener("click", async (e) => {
        let btn = root.querySelector("#ReadTextAreaSelectorButton")
        let newState = false;

        if (btn.querySelector("div").classList.contains("ON")) {
            btn.querySelector("div").className = "OFF";
            btn.setAttribute('data-tooltip', `Text Area Selector(OFF)`);
            newState = false;
            await saveToLocalStorage({ 'DEFAULT_READ_TEXT_AREA_SELECTOR_STATE': false }, true);
        } else {
            btn.querySelector("div").className = "ON";
            btn.setAttribute('data-tooltip', `Text Area Selector(ON)`);
            newState = true;
            await saveToLocalStorage({ 'DEFAULT_READ_TEXT_AREA_SELECTOR_STATE': true }, true);
        }

        if (widget.voiceClass) {
            widget.voiceClass.toggleTextSelection(newState);
        }
    })

    root.querySelector("#PinExpandedButton")?.addEventListener("click", async () => {
        let currentState = VR_Reader.savedLocalStorageGlobal['WIDGET_PIN_EXPANDED'];
        if (currentState === undefined || currentState === null) {
            currentState = false;
        }
        let newState = !currentState;
        widget.setPinButtonState(newState)
        VR_Reader.savedLocalStorageGlobal['WIDGET_PIN_EXPANDED'] = newState;
        await saveToLocalStorage({ 'WIDGET_PIN_EXPANDED': newState }, true);
    });

    root.querySelector("#ReadAloudButton")?.addEventListener("click", (e) => {
        widget.addHiddenToWidget()

        function openModal(actions) {
            VR_Reader.makeModalLarge({
                title: `
                <div style="text-align:center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"  height="50" viewBox="0 -960 960 960" width="50"><path d="M404.667-407.334 632-560 404.667-712v304.666ZM80-80v-733.334q0-27 19.833-46.833T146.666-880h666.668q27 0 46.833 19.833T880-813.334v506.668q0 27-19.833 46.833T813.334-240H240L80-80Zm131.333-226.666h602.001v-506.668H146.666v575.002l64.667-68.334Zm-64.667 0v-506.668 506.668Z"/></svg>
                </div>
                <div>Auto Play</div>
                `,
                message: "Enable or disable automatic read aloud while text is streaming.",
                actions
            })
        }

        let btn = root.querySelector("#ReadAloudButton")
        if (btn.querySelector("div").classList.contains("ON")) {
            openModal([
                {
                    buttonText: '<b>Disable</b> only on ' + getHostName(),
                    callback: async () => {
                        btn.querySelector("div").className = "OFF"
                        btn.setAttribute('data-tooltip', `Read aloud(OFF)`);
                        await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_READER_STATE_KEYNAME, false)
                        await VR_Reader.storeDefaults()
                        root.querySelector("#PlayReadButton").classList.add("audio-state-off")
                        widget.voiceClass.stop(true);
                        widget.voiceClass.updateDefaultReaderState(false)
                    }
                },
                {
                    buttonText: '<b>Disable</b> globally',
                    callback: async () => {
                        btn.querySelector("div").className = "OFF"
                        btn.setAttribute('data-tooltip', `Read aloud(OFF)`);
                        await deleteSettingPropertyInAllDomains(CONSTANTS.DOMAIN_READER_STATE_KEYNAME);
                        await saveToLocalStorage({ 'DEFAULT_READER_STATE': false }, true);
                        await VR_Reader.storeDefaults()
                        root.querySelector("#PlayReadButton").classList.add("audio-state-off")
                        widget.voiceClass.stop(true);
                        widget.voiceClass.updateDefaultReaderState(false)
                    }
                },
                { type: 'hr' },
                widget.enterKeyModalButton()
            ]);
        } else {
            openModal([
                {
                    buttonText: '<b>Enable</b> only on ' + getHostName(),
                    callback: async () => {
                        btn.querySelector("div").className = "ON";
                        btn.setAttribute('data-tooltip', `Read aloud(ON)`);
                        await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_READER_STATE_KEYNAME, true)
                        await VR_Reader.storeDefaults()
                        root.querySelector("#PlayReadButton").classList.remove("audio-state-off")
                        widget.voiceClass.updateDefaultReaderState(true)
                    }
                },
                {
                    buttonText: '<b>Enable</b> globally',
                    callback: async () => {
                        btn.querySelector("div").className = "ON"
                        btn.setAttribute('data-tooltip', `Read aloud(ON)`);
                        await deleteSettingPropertyInAllDomains(CONSTANTS.DOMAIN_READER_STATE_KEYNAME)
                        await saveToLocalStorage({ 'DEFAULT_READER_STATE': true }, true);
                        await VR_Reader.storeDefaults()
                        root.querySelector("#PlayReadButton").classList.remove("audio-state-off")
                        widget.voiceClass.updateDefaultReaderState(true)
                    }
                },
                { type: 'hr' },
                widget.enterKeyModalButton()
            ]);
        }
    });

    root.querySelector(".play-rewind-button")?.addEventListener("click", () => {
        if (widget.playbackClass) {
            widget.playbackClass.playbackAction('playback-previous-line');
        }
    });

    root.querySelector(".play-fast-forward-button")?.addEventListener("click", () => {
        if (widget.playbackClass) {
            widget.playbackClass.playbackAction('playback-next-line');
        }
    });

    root.querySelector(".play-timer-button")?.addEventListener("click", () => {
        toggleTab(root, widget.SWITCH_SECTIONS, 'PLAYBACK');
    });

    if (root.querySelector("#PlaybackButton")) {
        root.querySelector("#PlaybackButton")?.addEventListener("click", () => {
            toggleTab(root, widget.SWITCH_SECTIONS, 'PLAYBACK');
        })
    }

    root.querySelector("#VoiceFavoritesButton")?.addEventListener("click", () => {
        toggleTab(root, widget.SWITCH_SECTIONS, 'VOICE_FAVORITES');
    })

    root.querySelector("#VoiceSpeedButton")?.addEventListener("click", () => {
        toggleTab(root, widget.SWITCH_SECTIONS, 'VOICE_SPEED');
        setTimeout(() => {
            widget.voiceSpeedClass.rerender()
        }, 200);
    })

    root.querySelector("#SettingsButton")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "open-sidepanel", route: "/settings", data: { tab: 'general' } });
    });

    root.querySelector("#MoreButton")?.addEventListener("click", () => {
        root.querySelector("#MoreSelectContainer").classList.add("is-hidden")
        root.querySelector("#MoreListContainer").classList.remove("is-hidden")
    });

    root.querySelector("#PlayReadButton")?.addEventListener("click", () => {
        if (widget.voiceClass.speaking()) {
            widget.voiceClass.stop(true);
        } else {
            let playbackIndex = widget.voiceClass.getPlaybackIndex()
            widget.playbackClass.playbackSelectedIndex(playbackIndex)
            widget.changePlayingButtonStatus(true)
        }
    })

    root.querySelector("#PlayReadButtonContainer")?.addEventListener("mouseover", () => {
        root.querySelector("#VR-Reader").classList.remove("hidden");
    })

    root.querySelector("#CloseButton")?.addEventListener("click", (e) => {
        widget.addHiddenToWidget();

        function openModal(actions) {
            VR_Reader.makeModalLarge({
                title: `
                <div style="text-align:center">
                    <svg width="50" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="currentColor"><path d="M12 13a1 1 0 0 0 1-1V2a1 1 0 0 0-2 0v10a1 1 0 0 0 1 1z"/><path d="M16.59 3.11a1 1 0 0 0-.92 1.78a8 8 0 1 1-7.34 0a1 1 0 1 0-.92-1.78a10 10 0 1 0 9.18 0z"/></g></svg>
                </div>
                <div>Power</div>
                `,
                message: "Turn off VoiceRankings Reader",
                actions
            })
        }

        if (!widget.readMode) {
            openModal([
                {
                    buttonText: '<b>Power</b> off',
                    callback: async () => {
                        VR_Reader.setPowerOff();
                        widget.close();
                    }
                },
                {
                    buttonText: '<b>Power</b> off always on ' + getHostName(),
                    callback: async () => {
                        await setDomainSettings(getHostName(), CONSTANTS.DOMAIN_POWER_STATE_KEYNAME, false)
                        VR_Reader.savedLocalStorageDomainProxy['DOMAIN_POWER_STATE'] = false;
                        VR_Reader.setPowerOff();
                        widget.close();
                    }
                },
                {
                    buttonText: '<b>Power</b> off globally',
                    callback: async () => {
                        await deleteSettingPropertyInAllDomains(CONSTANTS.DOMAIN_POWER_STATE_KEYNAME);
                        VR_Reader.setPowerOff();
                        widget.close();
                    }
                },
                {
                    type: `hr`,
                },
                {
                    buttonText: `${VR_Reader.savedLocalStorageDomain['DOMAIN_COMPACT_MODE_STATE'] === true ? 'Unminimize' : 'Minimize'}`,
                    callback: async () => {
                        if (VR_Reader.savedLocalStorageDomain['DOMAIN_COMPACT_MODE_STATE'] === true) {
                            await setDomainSettings(getHostName(), 'DOMAIN_COMPACT_MODE_STATE', false)
                        } else {
                            await setDomainSettings(getHostName(), 'DOMAIN_COMPACT_MODE_STATE', true)
                        }
                        await VR_Reader.storeDefaults();
                        widget.setDefaultCompactMode();
                    }
                }
            ]);
        } else {
            openModal([
                {
                    buttonText: '<b>Power</b> off',
                    callback: async () => {
                        VR_Reader.setPowerOff();
                        widget.close();
                        if (VR_Reader.ratingsOverlayClass) {
                            VR_Reader.ratingsOverlayClass.close()
                        }
                        setTimeout(() => {
                            VR_Reader.start_VRR()
                        }, 500)
                    }
                }
            ]);
        }
    })

    root.querySelector("#VR-Reader")?.addEventListener("mouseout", () => {
        widget.timeoutHideWidget = setTimeout(() => {
            root.querySelector("#VR-Reader").classList.remove("mouse-over");
            widget.addHiddenToWidget()
        }, 500);
    })

    root.querySelector("#VR-Reader")?.addEventListener("mouseover", () => {
        root.querySelector("#VR-Reader").classList.remove("hidden");
        root.querySelector("#VR-Reader").classList.add("mouse-over");
        clearTimeout(widget.timeoutHideWidget);
        if (root.querySelector("#SectionSwitchTabContainer").classList.contains(widget.SWITCH_SECTIONS.PLAYBACK)) {
            widget.playbackClass.setPlayerFocus()
        }
    })

    // Pointer dragging for #VR-Reader widget
    // Drag is only triggered from the mini player controls area (#PreviewContainer)
    const vrReaderEl = root.querySelector("#VR-Reader");
    const dragHandle = root.querySelector("#PreviewContainer");
    if (vrReaderEl && dragHandle) {
        let isDragging    = false;
        let startX        = 0;
        let startY        = 0;
        let initialLeft   = 0;
        let initialTop    = 0;
        let hasMoved      = false;
        let expandedW     = 0;
        let expandedH     = 0;
        let collapsedW    = 0;
        let collapsedH    = 0;
        let wasExpandUp   = false;
        let wasAlignRight = false;

        const handlePointerDown = (e) => {
            // Only drag on the mini player controls — ignore clicks on interactive controls
            const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
            if (interactiveTags.includes(e.target.tagName)) return;

            isDragging = true;
            hasMoved   = false;
            startX     = e.clientX;
            startY     = e.clientY;

            const rect    = vrReaderEl.getBoundingClientRect();
            initialLeft   = rect.left;
            initialTop    = rect.top;

            // Capture initial expanded dimensions and expand state BEFORE is-dragging collapses the widget
            expandedW     = vrReaderEl.offsetWidth;
            expandedH     = vrReaderEl.offsetHeight;
            wasExpandUp   = vrReaderEl.classList.contains('expand-up');
            wasAlignRight = vrReaderEl.classList.contains('align-right');
        };

        const handlePointerMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            if (Math.hypot(deltaX, deltaY) > 5) {
                if (!hasMoved) {
                    hasMoved = true;
                    // Add is-dragging class to collapse hover panels via CSS
                    vrReaderEl.classList.add('is-dragging');

                    // Read collapsed dimensions immediately after CSS applies (transition:none)
                    collapsedW = vrReaderEl.offsetWidth;
                    collapsedH = vrReaderEl.offsetHeight;

                    // If drag started from an expanded state in bottom half (expand-up),
                    // the Play Button was at the BOTTOM of the expanded box (rect.top + expandedH - collapsedH).
                    // Shift initialTop down so the collapsed Play Button stays directly under the cursor.
                    if (wasExpandUp) {
                        initialTop += (expandedH - collapsedH);
                    }

                    // If drag started from an expanded state in right half (align-right),
                    // the Play Button was at the RIGHT of the expanded box (rect.left + expandedW - collapsedW).
                    // Shift initialLeft right so the collapsed Play Button stays directly under the cursor.
                    if (wasAlignRight) {
                        initialLeft += (expandedW - collapsedW);
                    }
                }

                const VW = window.innerWidth;
                const VH = window.innerHeight;

                const newLeft = initialLeft + deltaX;
                const newTop  = initialTop  + deltaY;

                // Clamp: keep at least 20% of the collapsed widget on-screen
                const clampedLeft = Math.min(Math.max(newLeft, -collapsedW * 0.8), VW - collapsedW * 0.2);
                const clampedTop  = Math.min(Math.max(newTop,  0), VH - 20);

                // Drive position with raw pixels during the drag for perfect 1:1 tracking
                vrReaderEl.style.left   = `${clampedLeft}px`;
                vrReaderEl.style.right  = 'auto';
                vrReaderEl.style.top    = `${clampedTop}px`;
                vrReaderEl.style.bottom = 'auto';

                // Update expand-direction and align-side classes based on collapsed pill center
                const pillCenterX  = clampedLeft + collapsedW / 2;
                const pillCenterY  = clampedTop  + collapsedH / 2;
                const isRightHalf  = pillCenterX >= VW / 2;
                const isBottomHalf = pillCenterY >= VH / 2;

                vrReaderEl.classList.remove('expand-up', 'expand-down', 'align-left', 'align-right', 'placement-bottom', 'placement-middle');
                vrReaderEl.classList.add(isBottomHalf ? 'expand-up' : 'expand-down');
                vrReaderEl.classList.add(isRightHalf ? 'align-right' : 'align-left');
            }
        };

        const handlePointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            vrReaderEl.classList.remove('is-dragging');

            if (hasMoved) {
                const VW = window.innerWidth;
                const VH = window.innerHeight;

                const leftPx = parseFloat(vrReaderEl.style.left) || 0;
                const topPx  = parseFloat(vrReaderEl.style.top)  || 0;

                const pillCenterX  = leftPx + collapsedW / 2;
                const pillCenterY  = topPx  + collapsedH / 2;
                const isRightHalf  = pillCenterX >= VW / 2;
                const isBottomHalf = pillCenterY >= VH / 2;

                let saveX, saveY;

                if (isRightHalf) {
                    // Right half anchor: right edge of the collapsed pill
                    saveX = ((leftPx + collapsedW) / VW) * 100;
                } else {
                    // Left half anchor: left edge of the collapsed pill
                    saveX = (leftPx / VW) * 100;
                }

                if (isBottomHalf) {
                    // Bottom half anchor: bottom edge of the collapsed pill
                    saveY = ((topPx + collapsedH) / VH) * 100;
                } else {
                    // Top half anchor: top edge of the collapsed pill
                    saveY = (topPx / VH) * 100;
                }

                saveX = Math.min(Math.max(Math.round(saveX), 0), 100);
                saveY = Math.min(Math.max(Math.round(saveY), 0), 100);

                const quadrant = getQuadrantPlacementCSS(saveX, saveY);
                vrReaderEl.style.left   = quadrant.style.left;
                vrReaderEl.style.right  = quadrant.style.right;
                vrReaderEl.style.top    = quadrant.style.top;
                vrReaderEl.style.bottom = quadrant.style.bottom;

                const placementValue = JSON.stringify({ x: saveX, y: saveY });
                saveToLocalStorage({ 'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE': placementValue }, true);
                chrome.runtime.sendMessage({
                    action: "update-contentscript-storage",
                    key: 'DEFAULT_QUICK_ACCESS_CONTROLS_PANEL_PLACEMENT_STATE',
                    value: placementValue
                });
            }
        };

        dragHandle.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    }
}
