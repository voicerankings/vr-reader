/**
 * ============================================================================
 * widgetTemplate Module
 * ============================================================================
 * Generates the HTML structure for the main TTSWidget interface.
 * Combines SVG icons, UI sections, and the dynamically injected CSS styles
 * to build the complete DOM layout that gets rendered inside the Shadow DOM.
 */
import * as Icons from '../shared/icons.js';
import * as Styles from './widgetStyles.js';
import { defaultCSS } from '../../config/defaultCSS.js';

export function createHTML({ readMode, SWITCH_SECTIONS, panelPlacement = "bottom" }) {
    return ` 
        <div id="VR-Reader" class="hidden placement-${panelPlacement} ${readMode ? readMode : ''}">
            <div class="content">
                <div id="SectionSwitchTabContainer" class=""  style="display:flex;">                    
                    <div id="MainSection" class="mouseover-view main-content">
                        
                        <div id="OptionsSwitchTabContainer" class="message-content"></div>
                    
                        <div id="SummarySwitchTabContainer"></div>

                        <div id="PlaybackSwitchTabContainer" class="message-content"> </div>

                        <div id="VoiceFavoritesSwitchTabContainer" class="message-content"></div>

                        <div id="VoiceSpeedSwitchTabContainer" class="message-content"></div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div id="OptionButtons">
                            
                            <div style="width: 40px;display: flex;flex-direction: column; align-items: center;">
                                <div id="CloseButtonContainer">
                                    
                                    <button id="CloseButton" data-tooltip="Close [Esc]" class="invisible-button left-tooltip">
                                    ${Icons.closeSVG('margin-right:3px;')}  
                                    </button>

                                     <button data-tooltip="Pin:Open details" id="PinExpandedButton" class="invisible-button left-tooltip">
                                        <div class="ON" style="display: flex; align-items: center;">
                                            <span class="audio-on">${Icons.svgPinExpanded(16)}</span>
                                            <span class="audio-off">${Icons.svgPinExpanded(16)}</span>
                                        <div>
                                    </button>
                                </div>

                                <div id="MoreListContainer" class="is-hidden">
                                    
                                    ${(readMode === "") ? `
                                    <button data-tooltip="Playback" id="PlaybackButton" class="invisible-button left-tooltip">
                                    ${Icons.svgPlayback('margin-right:3px;')}
                                    </button>` : ``}

                                    <hr class="toolbar-hr">
                                </div>

                                <div id="MoreSelectContainer" ${(readMode != "") ? 'style="display:none"' : '""'}>
                                    <hr class="toolbar-hr">
                                    <button id="MoreButton" data-tooltip="View all options"  class="invisible-button left-tooltip">
                                    ${Icons.svgMore()}
                                    </button>
                                    <hr class="toolbar-hr">
                                </div>

                                ${(readMode === "readWithVRR" || readMode === "readHighlightedText") ? `
                                    <button data-tooltip="Playback" id="PlaybackButton" class="invisible-button left-tooltip">
                                    ${Icons.svgPlayback('margin-right:3px;')}
                                    </button>` : ``}

                                <button data-tooltip="Chat voices" id="VoiceFavoritesButton" class="invisible-button left-tooltip">
                                    ${Icons.svgVoiceFavorites()}
                                </button>

                                <button data-tooltip="Voice Speed" id="VoiceSpeedButton" class="invisible-button left-tooltip">
                                    ${Icons.svgVoiceSpeed()}
                                </button>

                                <button data-tooltip="Read Area Selector" id="ReadTextAreaSelectorButton" class="invisible-button left-tooltip">
                                    <div class="ON" style="display: flex; align-items: center;">
                                        <span class="audio-on">${Icons.svgTextSelector('margin-right:3px;')} </span>
                                        <span class="audio-off">${Icons.svgTextSelector('margin-right:3px;')} </span>
                                    <div>
                                </button>

                                <button data-tooltip="Settings" id="SettingsButton" class="invisible-button left-tooltip">
                                    ${Icons.svgSettings()}
                                </button>

                            </div>                        
                        </div>

                        <div id="VoicePlayerContainer"></div>

                        <div id="HighlightAudioMessage" class="mini-alert-box" title="Tip: Press 'Enter' to play highlighted text">
                            <div style="position:relative; width:100%; height:100%; overflow:hidden;    align-items: center; justify-content: center;display: flex;">
                                <div style="position:absolute;top:0px;bottom:0px;left:0px;right:0px;display: flex; align-items: center; justify-content: center;">
                                    <span class="press-text text">PRESS</span>
                                    <span class="enter-text text">"ENTER"</span>
                                    <div class="request-loader">
                                        <span>${Icons.svgPlay()}</span>                            
                                    </div>                                        
                                </div>
                            </div>
                        </div>

                        <div id="PreviewContainer">

                            <button data-tooltip="Read aloud" id="ReadAloudButton" class="invisible-button left-tooltip" ${(readMode != "") ? 'style="display:none"' : 'style="margin-bottom:10px;"'}>
                                
                                <div class="ON" style="display: flex; align-items: center;">
                                    <span class="audio-on">${Icons.svgAudioOn()}</span>
                                    <span class="audio-off">${Icons.svgAudioOff()}</span>
                                <div>
                                
                                <div id="AutoPlayEnterKeyIcon" ${(readMode != "") ? 'style="display:none"' : '""'}>
                                    ${Icons.svgAutoPlayEnterKey()}                                        
                                </div>

                            </button>

                            <div style="height: 16px; width:100%; position: relative;">
                                <div  style="display:flex;width:100%; position: absolute; top: 0px; left: 0px; right: 0px; justify-content: center; gap: 4px;">
                                    <button class="playback-action-btn play-rewind-button left-tooltip" data-tooltip="Prev">
                                        ${Icons.svgRewind(16)}
                                    </button>
                                    <button class="playback-action-btn play-fast-forward-button left-tooltip" data-tooltip="Next">
                                        ${Icons.svgFastForward(16)}
                                    </button>
                                </div>
                            </div>

                            <button id="ReadAloudEstimateTime" class="playback-action-btn play-timer-button invisible-button-2 left-tooltip">                                    
                            00:00
                            </button>

                            <div id="PlayReadButtonContainer">

                                <div id="cont" data-pct="100">
                                    
                                    <svg id="svg" width="28" height="28" viewPort="0 0 28 28" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                        <circle r="13" cx="14" cy="14" fill="transparent" stroke-dasharray="81.68" stroke-dashoffset="0" stroke-width="1"></circle>
                                        <circle id="bar" r="13" cx="14" cy="14" fill="transparent" stroke-dasharray="81.68" stroke-dashoffset="0" stroke-width="1"></circle>
                                    </svg>

                                    <div style="position:absolute;top:0px;">
                                        
                                        <button id="PlayReadButton" class="main-button">                                           
                                            <div id="NotifyCtn" style="display:none">
                                                <span class="circle-notify"><span id="speechIndex">0%</span></span>
                                            </div>

                                            <div class="audio-circle" >
                                                <span class="audio-off">${Icons.svgAudioOff()}</span>
                                            </div>
                                            <span>
                                                <div class="loader-container" style="display:none">
                                                    <div class="rectangle-4"></div>
                                                    <div class="rectangle-5"></div>
                                                    <div class="rectangle-6"></div>
                                                    <div class="rectangle-5"></div>
                                                    <div class="rectangle-4"></div>		
                                                </div>

                                                <div id="LoaderExternalPlayer" class="external-loader-container">
                                                    ${Icons.svgAnimateExternalAudioLoader()}
                                                </div>

                                                <div id="LoaderChatModel" class="left-tooltip audio-loader-container">
                                                
                                                </div>

                                                <div id="LoaderIssue" class="left-tooltip issue-loader-container">
                                                ${Icons.svgError()}
                                                </div>
                                            </span>

                                            <span id="PlayAndStopAudio" class="stop-audio left-tooltip" data-tooltip="Play/Stop">
                                                <span  class="pause">${Icons.svgPause(12)}</span>
                                                <span  class="play">${Icons.svgPlay(20)}</span>
                                            </span>
                                            <span class="close-icon">
                                                ${Icons.thickClose()}
                                            </span>
                                        </button>

                                    </div>
                                </div>
                            </div>                           
                        </div>

                    </div>                  
                </div>                                    
            </div>      
        </div>
        ${Styles.style()}
        ${Styles.styleTooltip()}
        ${Styles.styleWave()}
        ${Styles.stylePlayAnimation()}
        ${Styles.styleSwitchSections(SWITCH_SECTIONS)}
        ${Styles.styleWindowSizes()}
        ${defaultCSS()}
    `
}
