/**
 * ============================================================================
 * TabController Module
 * ============================================================================
 * A utility module that manages the switching and visibility of various tabs 
 * (Playback, Options, Voice Favorites, Voice Speed, etc.) within the TTS widget's 
 * UI container. It handles toggling CSS classes to show/hide sections.
 */
export function openSwitchTab(root, SWITCH_SECTIONS, open, tabName) {
    console.log("openSwitchTab", open, tabName)
    if (open) {
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.DEFAULT
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS[tabName]
    } else {
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS[tabName]
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.DEFAULT
    }
}

export function isSwitchTabOpen(root, SWITCH_SECTIONS, tabName) {
    return root.querySelector("#SectionSwitchTabContainer").classList.contains(SWITCH_SECTIONS[tabName])
}

export function toggleTab(root, SWITCH_SECTIONS, tabName) {
    if (root.querySelector("#SectionSwitchTabContainer").classList.contains(SWITCH_SECTIONS[tabName])) {
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS[tabName]
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.DEFAULT
    } else {
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.DEFAULT
        root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS[tabName]
    }
}

export function openPlaybackList(root, SWITCH_SECTIONS) {
    root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.DEFAULT
    root.querySelector("#SectionSwitchTabContainer").className = SWITCH_SECTIONS.PLAYBACK
}
