/**
 * ============================================================================
 * Playback Module
 * ============================================================================
 * Manages the playback controls UI (play, pause, next, previous) and the
 * sentence tracking queue (dropdown list). It handles the rendering of 
 * playback-related metrics like elapsed time, remaining time, and characters read.
 * Communicates with the TTSVoicePlayer to synchronize UI state with audio output.
 */
import { getChatURL, getHostName, getInnerText3_raw } from "../../utils/helpers";

export default class  Playback {
    constructor() {
        this.el = null;
    
        this.componentDiv;
        this.componentIDNAME = "PLAYBACK";
    }

    initDOM(DOMElement) {
        this.el = DOMElement
    }
    init(){
        this.getShortcutCommands()

        try{
            this.componentDiv.querySelector("#PlaybackPreviousButton").addEventListener("click",()=>this.playbackShortcuts("playback-previous-line"));
            this.componentDiv.querySelector("#PlaybackNextButton").addEventListener("click",()=>this.playbackShortcuts("playback-next-line"));
            this.componentDiv.querySelector("#PlaybackPauseButton").addEventListener("click",()=>this.playbackShortcuts("playback-pause-play"));
    
            this.componentDiv.querySelector("#SelectPlayback").addEventListener("change",()=>{
                let selectedIndex = this.componentDiv.querySelector("#SelectPlayback").selectedIndex
                
                VR_Reader.ttsWidget.voiceClass.playbackListNewStartQueue(this.componentDiv.querySelector("#SelectPlayback").value);
            
            });
    

        }catch(e){
            console.log(e)
        }
    }
    setPlayerFocus(){

        this.componentDiv.querySelector("#SelectPlayback").focus()
    }
    getShortcutCommands(){
        let callbackID = "getShortcutCommands_"+Math.floor(Math.random() * 1000) + 100;
            
        VR_Reader.saveRequest(callbackID,(commands)=>{
            
            let commandPlaybackPauseShortcut = commands.find((command)=>command.name === 'playback-pause-play');

            if(commandPlaybackPauseShortcut && commandPlaybackPauseShortcut.shortcut && commandPlaybackPauseShortcut.shortcut !== ""){
                this.componentDiv.querySelector("#PlaybackPauseButton").setAttribute('data-tooltip', commandPlaybackPauseShortcut.shortcut);
            }else this.componentDiv.querySelector("#PlaybackPauseButton").setAttribute('data-tooltip', `no shortcut`);
                        
            let commandPlaybackPrevShortcut = commands.find((command)=>command.name === 'playback-previous-line');
            if(commandPlaybackPrevShortcut && commandPlaybackPrevShortcut.shortcut && commandPlaybackPrevShortcut.shortcut !== ""){
                this.componentDiv.querySelector("#PlaybackPreviousButton").setAttribute('data-tooltip', commandPlaybackPrevShortcut.shortcut);
            }else this.componentDiv.querySelector("#PlaybackPreviousButton").setAttribute('data-tooltip', `no shortcut`);
        
            let commandPlaybackNextShortcut = commands.find((command)=>command.name === 'playback-next-line');
            if(commandPlaybackNextShortcut && commandPlaybackNextShortcut.shortcut && commandPlaybackNextShortcut.shortcut !== ""){
                this.componentDiv.querySelector("#PlaybackNextButton").setAttribute('data-tooltip', commandPlaybackNextShortcut.shortcut);
            }else this.componentDiv.querySelector("#PlaybackNextButton").setAttribute('data-tooltip', `no shortcut`);

            // --- MAIN PANEL BUTTONS (TTSWidget) ---
            // The main panel's Play/Stop and Prev/Next controls live in the
            // widget's shadow root, not this Playback sub-component. Update
            // their tooltips to surface the keyboard shortcuts.
            const mainRoot = VR_Reader.ttsWidget && VR_Reader.ttsWidget.superUltraRoot;
            if (mainRoot) {
                const playStopBtn = mainRoot.querySelector("#PlayAndStopAudio");
                if (playStopBtn) {
                    const pauseShortcut = (commandPlaybackPauseShortcut && commandPlaybackPauseShortcut.shortcut) ? commandPlaybackPauseShortcut.shortcut : "";
                    playStopBtn.setAttribute('data-tooltip', pauseShortcut ? `Play/Stop [${pauseShortcut}]` : 'Play/Stop');
                }

                const prevBtn = mainRoot.querySelector(".play-rewind-button");
                if (prevBtn) {
                    const prevShortcut = (commandPlaybackPrevShortcut && commandPlaybackPrevShortcut.shortcut) ? commandPlaybackPrevShortcut.shortcut : "";
                    prevBtn.setAttribute('data-tooltip', prevShortcut ? `<< Prev [${prevShortcut}]` : '<< Prev');
                }

                const nextBtn = mainRoot.querySelector(".play-fast-forward-button");
                if (nextBtn) {
                    const nextShortcut = (commandPlaybackNextShortcut && commandPlaybackNextShortcut.shortcut) ? commandPlaybackNextShortcut.shortcut : "";
                    nextBtn.setAttribute('data-tooltip', nextShortcut ? `>> Next [${nextShortcut}]` : '>> Next');
                }
            }
        })
        
        chrome.runtime.sendMessage({
            action: "getShortcutCommands",
            callbackID,
        });
    }
    playbackSelectedIndex(index){
        let selectedIndex = index;
        const select = this.componentDiv.querySelector("#SelectPlayback");
        var event = new Event("change");

        select.selectedIndex = (selectedIndex === -1 || selectedIndex === null)? 0 : selectedIndex;
        select.dispatchEvent(event);
    }
    playbackShortcuts(action){
        let selectedIndex = this.componentDiv.querySelector("#SelectPlayback").selectedIndex;
        const select = this.componentDiv.querySelector("#SelectPlayback");
        
        var event = new Event("change");
        
        if(action === "playback-next-line"){
            select.selectedIndex = selectedIndex + 1;
            select.dispatchEvent(event);
        }else if(action === "playback-previous-line"){
            select.selectedIndex = selectedIndex - 1;
            select.dispatchEvent(event);
        }else{
 
            if(VR_Reader.ttsWidget.voiceClass.speaking()){
                VR_Reader.ttsWidget.voiceClass.stop(true)
            }else{
                select.selectedIndex = (selectedIndex === -1 || selectedIndex === null)? 0 : selectedIndex;
                select.dispatchEvent(event);
            }
        }
    }
    playbackAction(action){
        let selectedIndex = this.componentDiv.querySelector("#SelectPlayback").selectedIndex;
        const select = this.componentDiv.querySelector("#SelectPlayback");
        
        var event = new Event("change");
        
        if(action === "playback-next-line"){
            select.selectedIndex = selectedIndex + 1;
            select.dispatchEvent(event);
        }else if(action === "playback-previous-line"){
            select.selectedIndex = selectedIndex - 1;
            select.dispatchEvent(event);
        }
    }
updateTimerDisplay(elapsed, remaining, total, force = false) {
        const elapsedEl = this.componentDiv.querySelector("#ElapsedTime");
        const remainingEl = this.componentDiv.querySelector("#RemainingTime");
        const totalEl = this.componentDiv.querySelector("#TotalTime");
        
        // ✅ FIX: Sticky Display Logic
        // If something tries to set 00:00 (like a pause event), but we have an existing time 
        // and 'force' is not true, ignore the update to prevent flickering.
        if (force === false && remaining === "00:00" && total === "00:00") {
            // Check if we currently have a valid time displayed
            if (remainingEl && remainingEl.textContent !== "00:00" && remainingEl.textContent !== "") {
                console.log('⏭️ Skipping 00:00 reset - keeping current display');
                return; 
            }
        }
        
        if (VR_Reader.ttsWidget && VR_Reader.ttsWidget.updateReadEstimateTime) {
            VR_Reader.ttsWidget.updateReadEstimateTime(remaining);
        }

        if (elapsedEl) elapsedEl.textContent = elapsed;
        if (remainingEl) remainingEl.textContent = remaining;
        if (totalEl) totalEl.textContent = total;
    }

    updateCharDisplay(read, remaining, total) {
        const readEl = this.componentDiv.querySelector("#SessionCharsRead");
        const remainingEl = this.componentDiv.querySelector("#RemainingChars");
        const totalEl = this.componentDiv.querySelector("#TotalChars");

        if (readEl) readEl.textContent = read;
        if (remainingEl) remainingEl.textContent = remaining;
        if (totalEl) totalEl.textContent = total;
    }

// Add inside Playback class

    disableOptionsFromIndex(startIndex) {
        console.log("🚫 Disabling playback options starting from index:", startIndex);
        
        if (!this.componentDiv) {
            console.error("Playback componentDiv not found");
            return;
        }

        const select = this.componentDiv.querySelector("#SelectPlayback");
        if (!select) {
            console.error("SelectPlayback element not found");
            return;
        }

        const options = select.options;
        const start = parseInt(startIndex, 10);

        if (isNaN(start)) {
            console.error("Invalid start index for disabling options:", startIndex);
            return;
        }

        let disabledCount = 0;

        for (let i = 0; i < options.length; i++) {
            // Ensure we parse the option value correctly
            const optionValue = parseInt(options[i].value, 10);

            if (!isNaN(optionValue) && optionValue >= start) {
                if (!options[i].disabled) {
                    options[i].disabled = true;
                    options[i].style.color = "#a0a0a0"; // Gray color
                    
                    // Add text label if not present
                    if (!options[i].text.includes("(No Credits)")) {
                        options[i].text = `${options[i].text} (No Credits)`;
                    }
                    disabledCount++;
                }
            }
        }
        console.log(`🚫 Disabled ${disabledCount} options in the list.`);
    }

    // ✅ ADD THIS METHOD to Playback.js
    enableAllOptions() {
        console.log("🔓 Re-enabling playback options for new voice context");
        
        if (!this.componentDiv) return;
        const select = this.componentDiv.querySelector("#SelectPlayback");
        if (!select) return;

        const options = select.options;

        for (let i = 0; i < options.length; i++) {
            if (options[i].disabled) {
                options[i].disabled = false;
                options[i].style.color = ""; // Reset to default color
                
                // Clean up the label text
                options[i].text = options[i].text
                    ;}
        }
    }

	createHTML() {	  	  
        return ` 
            <div style="height:100%;position: relative;grid-template-rows: auto 40px 25px 25px; display:grid;grid-gap:4px;">                                    
                <div style="grid-row:1; display: flex; flex-direction: column;">
                    <select id="SelectPlayback" size="10" style="max-width:600px;min-width:200px;height:100%">
                    </select>
                </div>
                <div class="playback-buttons-ctn" style="grid-row:2">
                    <button class="button  top-tooltip" id="PlaybackPreviousButton" style="font-size:12px;padding:10px;box-sizing: border-box;">
                        <div>${this.svgPlayback()}</div>
                        <div>Prev Line</div> 
                    </button>   
                    <button class="button  top-tooltip" id="PlaybackPauseButton" style="font-size:12px;padding:10px;box-sizing: border-box;">
                        <div>${this.svgPlayPause()} </div>
                        <div>Play/Stop</div> 
                    </button>   
                    <button class="button  top-tooltip" id="PlaybackNextButton" style="font-size:12px;padding:10px;box-sizing: border-box;">
                        
                        <div>Next line</div>     
                        <div>${this.svgFastForward()}</div>                                    
                    </button>                                    
                </div>
                <div id="TimerDisplay" style="grid-row:3; display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-family: monospace; font-size: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Elapsed:</span>
                        <span id="ElapsedTime" style="font-weight: bold; color: #2563eb;">00:00</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Remaining:</span>
                        <span id="RemainingTime" style="font-weight: bold; color: #dc2626;">00:00</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Total:</span>
                        <span id="TotalTime" style="font-weight: bold;">00:00</span>
                    </div>
                </div>
                <div id="CharDisplay" style="grid-row:4; display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-family: monospace; font-size: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Chars Read:</span>
                        <span id="SessionCharsRead" style="font-weight: bold; color: #2563eb;">0</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Remaining:</span>
                        <span id="RemainingChars" style="font-weight: bold; color: #dc2626;">0</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666;">Total:</span>
                        <span id="TotalChars" style="font-weight: bold;">0</span>
                    </div>
                </div>
            </div>
            ${this.style()}
        `
    }
    svgPlayback(style){
        return `<svg style="${style}"  xmlns="http://www.w3.org/2000/svg" height="15" viewBox="0 -960 960 960" width="15"><path fill="currentColor" d="M860-240 500-480l360-240v480Zm-400 0L100-480l360-240v480Z"/></svg>`
    }

    svgFastForward(){
        return `<svg xmlns="http://www.w3.org/2000/svg" height="15" viewBox="0 -960 960 960" width="15"><path fill="currentColor" d="M100-240v-480l360 240-360 240Zm400 0v-480l360 240-360 240Z"/></svg>`
    }

    svgPlayPause(){
        return `<svg xmlns="http://www.w3.org/2000/svg" height="25" viewBox="0 -960 960 960" width="25"><path fill="currentColor" d="M200-312v-336l240 168-240 168Zm320-8v-320h80v320h-80Zm160 0v-320h80v320h-80Z"/></svg>`
    }
    style(){
        if( !this.el.querySelector(`#${this.componentIDNAME}_STYLE`) ){
            return `          
            <style id="${this.componentIDNAME}_STYLE">
            .playback-buttons-ctn {
                display:flex;
                gap:2px;
            }
            .playback-buttons-ctn button{
                width:100%;;
                display:flex;
                white-space: nowrap;
                word-wrap: break-word;
                height: 43px;
                justify-content: center;
                align-items: center;
            }

            .playback-buttons-ctn div{
                padding:2px;
                display: flex;
                align-items: center;
            }

            .playback-buttons-ctn span{
            padding-left:4px;
            }

            #SelectPlayback option {
                padding:2px;
                white-space: nowrap; /* Prevent text from wrapping */
                overflow: hidden; /* Hide overflow text */
                text-overflow: ellipsis; /* Display an ellipsis for overflow text */        
            }


.upgrade-button {
    margin-bottom:7px;
    display: flex;
    align-items: center;
    gap: 5px;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    padding: 10px 15px;
    font-family: sans-serif;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 14px;
    text-align: center;
    color: #ffffff;
    background: linear-gradient(to top right, #2563eb, #3b82f6);
    border-radius: 5px;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
    transition: all 0.3s ease-in-out;
    cursor: pointer;
}

.upgrade-button:hover {
    box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.4);
}

.upgrade-button:active {
    opacity: 0.85;
}

.upgrade-button:disabled {
    opacity: 0.5;
    pointer-events: none;
    box-shadow: none;
}

.button-text {
    flex-grow: 1;
    color: #ffffff;
    text-align: left;
}

.button-icon {
    position: absolute;
    right: 0;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 100%;
    background-color: #2563eb;
    transition: background-color 0.3s ease-in-out;
}

.button-icon:hover {
    background-color: #1d4ed8;
}
            </style>`
        }
        return ''
    }
    render(){        
        this.componentDiv = document.createElement("div");
        this.componentDiv.id = `${this.componentIDNAME}_Component`
        this.componentDiv.style.height = `100%`;
        this.componentDiv.innerHTML = this.createHTML()

		this.el.append(this.componentDiv);
		this.init();
    }    
}
