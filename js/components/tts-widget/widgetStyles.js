/**
 * ============================================================================
 * widgetStyles Module
 * ============================================================================
 * Contains functions that return template literals containing CSS styles
 * for the TTS widget. It separates CSS definitions (animations, tooltips, 
 * layout, media queries) from the HTML templates and component logic.
 */
export function stylePlayAnimation() {
    return `
    <style>
        #HighlightAudioMessage {
            width:100px;
        }
        #HighlightAudioMessage:hover {
            width:200px;
        }
        #HighlightAudioMessage .text{
            opacity:0;
        }
        #HighlightAudioMessage:hover .text{
            opacity:1;
        }
        .mini-alert-box {
            display: flex;
            padding: 0px;
            margin: 0;
            border: 2px solid #03030454;
            border-radius: 10px;
            font-size: 10px;
            background-color: #111827;
            box-shadow: rgba(0, 121, 255, 1) -1px 0px 8px -2px;
            position: fixed;
            bottom: 90px;
            right: 99px;
            font-family: sans-serif;
            align-items: center;
            font-weight: bold;
            display: none;
            width: 200px;
            height: 27px;
            cursor: pointer;
            color: #dbdbdb;
        }
        .mini-alert-box.highlighted {
            display:block;
        }
        .mini-alert-box .press-text {
            position:absolute;
            font-family: sans-serif;
            left: 11px;
            top: 50%;
            transform: translateY(-45%);
            font-size: 12px;
        }
        .mini-alert-box .enter-text {
            position:absolute;
            font-family: sans-serif;
            right: 8px;
            top: 50%;
            transform: translateY(-45%);
            font-size: 12px;
        }
        .mini-alert-box.clicked {
            background: #4285f4;
            transition: all 0.5s linear;
            animation-name: playfadeout;
            animation-duration: 1s;
            animation-delay: 0.15s;
            animation-iteration-count: 1;
            animation-timing-function: cubic-bezier(0.65, 0, 0.34, 1);
        }
        @keyframes playfadeout {
            from {
                opacity: 1;
                bottom: 90px;
            }
            to {
                opacity: 0;
                bottom: 0px;
            }
        }
        .request-loader {
            position: relative;
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            height:50px;
            width: 50px;
            border-radius: 100%;
            background: #3a69d3;
            box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.25);
        }
        .request-loader:hover {
            background: #4285f4;
            color: #fff;
        }
        .request-loader span {
            position: relative;
            font-size: 40px;
            top: 0px;
            left: 0px;
        }
        .request-loader::after {
            opacity: 0;
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            position: absolute;
            content: '';
            height: 100%;
            width: 100%;
            border: 8px solid rgba(255, 255, 255, 0.2);
            border-radius: 100%;
            animation-name: ripple;
            animation-duration: 3s;
            animation-delay: 0s;
            animation-iteration-count: infinite;
            animation-timing-function: cubic-bezier(0.65, 0, 0.34, 1);
            z-index: -1;
        }
        .request-loader::before {
            opacity: 0;
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            position: absolute;
            content: '';
            height: 100%;
            width: 100%;
            border: 8px solid rgba(255, 255, 255, 0.2);
            border-radius: 100%;
            animation-name: ripple;
            animation-duration: 3s;
            animation-delay: 0.5s;
            animation-iteration-count: infinite;
            animation-timing-function: cubic-bezier(0.65, 0, 0.34, 1);
            z-index: -1;
        }
        @keyframes ripple {
            from {
                opacity: 1;
                transform: scale3d(0.75, 0.75, 1);
            }
            to {
                opacity: 0;
                transform: scale3d(1.5, 1.5, 1);
            }
        }
    </style>
    `
}

export function styleSwitchSections(SWITCH_SECTIONS) {
    return `
    <style>

    #SectionSwitchTabContainer #OptionsSwitchTabContainer { display:none;}
    #SectionSwitchTabContainer #SummarySwitchTabContainer { display:none;}
    #SectionSwitchTabContainer #ChatboxSettingSwitchTabContainer { display:none;}
    #SectionSwitchTabContainer #PlaybackSwitchTabContainer { display:none;}
    #SectionSwitchTabContainer #VoiceFavoritesSwitchTabContainer { display:none;}
    #SectionSwitchTabContainer #VoiceSpeedSwitchTabContainer { display:none;}
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.DEFAULT} #SummarySwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.OPTIONS} #OptionsSwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.OPTIONS} #SettingsButton { 
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #ececec;
    }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.CHATBOX_SETTING} #ChatboxSettingSwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.CHATBOX_SETTING} #ChatboxSelectorsButton { 
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #111827;
    }

    #SectionSwitchTabContainer.${SWITCH_SECTIONS.PLAYBACK} #PlaybackSwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.PLAYBACK} #PlaybackButton { 
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #111827;
    }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.VOICE_FAVORITES} #VoiceFavoritesSwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.VOICE_FAVORITES} #VoiceFavoritesButton { 
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #111827;
    }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.VOICE_SPEED} #VoiceSpeedSwitchTabContainer { display:block; }
    #SectionSwitchTabContainer.${SWITCH_SECTIONS.VOICE_SPEED} #VoiceSpeedButton { 
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #111827;
    }
    #SelectChatbox option {
        padding:5px;
    }
    .toggle-click {
        color:gray;
        text-decoration:underline;
        cursor:pointer;
        font-size:12px;
    }
    #ReadAloudButton span { display:none; }
    #ReadAloudButton .ON .audio-on { display:inline-block; color:#ff0d0d; }
    #ReadAloudButton .OFF .audio-off { display:inline-block;   }
    #PinExpandedButton span { display:none; }
    #PinExpandedButton .ON .audio-on { display:inline-block; color:#ff0d0d; }
    #PinExpandedButton .OFF .audio-off { display:inline-block;  }
    #ReadTextAreaSelectorButton span { display:none; }
    #ReadTextAreaSelectorButton .ON .audio-on { display:inline-block; color:#ff0d0d; }
    #ReadTextAreaSelectorButton .OFF .audio-off { display:inline-block; }
    </style>
    `
}

export function styleWave() {
    return `
    <style>
    #NotifyCtn {
        position: absolute;
        bottom: 0px;
        right: 2px;
        padding: 3px;
        border: 1px solid white;    
        background-color: #5373F9;
        text-align:center;
        color: white;
        border-radius: 5px;
        font-size: 9px;
        font-weight: bold;
        transform: translate(50%,50%);
        font-family: arial;
    }
    #PlayReadButtonContainer {
        display: flex;
        justify-content: center;
    }
    #PlayReadButton{
        font-family:arial;
        font-weight:bold;
    }
    #PlayReadButton .external-loader-container {
        position: absolute;
        top: 1px;
        left: 1px;
        transform: translate(1px, 1px);
        background: #c19bff;
        border-radius: 100%;
        color: white;
        display: none; 
        width: 24px;
        height: 24px;
        z-index: 10000000000;
        justify-content: center;
        align-items: center;
    }
    #PlayReadButton .external-loader-container.show {
        display:flex;
    }
    #PlayReadButton .audio-loader-container {
        position: absolute;
        top: 1px;
        left: 1px;
        transform: translate(1px, 1px);
        background: #c19bff;
        border-radius: 100%;
        color: white;
        display: none; 
        width: 24px;
        height: 24px;
        z-index: 10000000000;
        justify-content: center;
        align-items: center;
        color:black;
    }
    #PlayReadButton .audio-loader-container.show {
        display:flex;
        justify-content:center;
        align-items:center;
    }
    #PlayReadButton .audio-loader-container svg {
        animation: pulse-chat-model-svg 2s ease-in-out infinite;
    }
    @keyframes pulse-chat-model-svg {
        0% { transform: scale(1); }
        50% { transform: scale(0.7); }
        100% { transform: scale(1); }
    }
    #PlayReadButton .issue-loader-container {
        position: absolute;
        top: 1px;
        left: 1px;
        transform: translate(1px, 1px);
        background: #c19bff;
        border-radius: 100%;
        color: white;
        display: none; 
        width: 24px;
        height: 24px;
        z-index: 10000000000;
        justify-content: center;
        align-items: center;
        color: black;
        cursor: default;
        box-shadow: 0 0 0 0 #c19bff;
        outline: 2px solid orange;
        animation: issue-glow 1.8s ease-in-out infinite;
    }
    @keyframes issue-glow {
        0% { box-shadow: 0 0 0 0 #c19bff, 0 0 0 0 #fff0; }
        50% { box-shadow: 0 0 16px 6px #c19bff, 0 0 32px 12px #fff3; }
        100% { box-shadow: 0 0 0 0 #c19bff, 0 0 0 0 #fff0; }
    }
    #PlayReadButton .issue-loader-container.show {
        display:flex;
        justify-content:center;
        align-items:center;
    }
    #PlayReadButton:hover .loader-container{
        opacity:0 !important
    }
    #PlayReadButton .stop-audio{
        color:white;
        position:absolute;
        width: 24px;
        height: 24px;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    #PlayReadButton:hover .stop-audio{
        display:flex;
    }
    #PlayAndStopAudio.playing .pause { display:block; }
    #PlayAndStopAudio.playing .play { display:none; }
    #PlayAndStopAudio .pause { display:none; }
    #PlayAndStopAudio .play { display:block; }
    #PlayReadButton.pulse .loader-container > div {
        position: relative;
        display:block;
        background: #03A9F4;
        height: 100%;
        width: 2px;
        margin: 1px;
        animation: load 3s ease-in-out;
        animation-iteration-count: infinite;
    }

    .loader-container {
        position: relative;
        height: 5px;
        margin: 10px auto 10px;
        display:flex;
    }
    .loader-container > div {
        position: relative;
        display: block;
        background: #03A9F4;
        height: 100%;
        width: 2px;
        margin: 1px;
    }
    #PlayReadButton.finished .loader-container .rectangle-2 { transform: scaleY(0.7); }
    #PlayReadButton.finished .loader-container .rectangle-3 { transform: scaleY(0.1); }
    #PlayReadButton.finished .loader-container .rectangle-4 { transform: scaleY(1.5); }
    #PlayReadButton.finished .loader-container .rectangle-5 { transform: scaleY(1); }
    #PlayReadButton.finished .loader-container .rectangle-6 { transform: scaleY(0.7); }
    #PlayReadButton .loader-container .rectangle-2 { transform: scaleY(1); }
    #PlayReadButton .loader-container .rectangle-3{ transform: scaleY(1); }
    #PlayReadButton .loader-container .rectangle-4 { transform: scaleY(1); }
    #PlayReadButton .loader-container .rectangle-5 { transform: scaleY(1); }
    #PlayReadButton .loader-container .rectangle-6 { transform: scaleY(1); }
    #PlayReadButton.pulse .loader-container .rectangle-2 { animation-delay: 0.1s; }
    #PlayReadButton.pulse .loader-container .rectangle-3 { animation-delay: 0.2s; }
    #PlayReadButton.pulse .loader-container .rectangle-4 { animation-delay: 0.3s; }
    #PlayReadButton.pulse .loader-container .rectangle-5 { animation-delay: 0.4s; }
    #PlayReadButton.pulse .loader-container .rectangle-6 { animation-delay: 0.5s; }
    @keyframes load {
        0%, 100% { transform: scaleY(1); background: #03A9F4; }
        16.67% { transform: scaleY(3); background: #FF5722; }
        33.33% { transform: scaleY(1); background: #FF5252; }
        50% { transform: scaleY(3); background: #E91E63; }
        66.67% { transform: scaleY(1); background: #9C27B0; }
        83.34% { transform: scaleY(3); background: #673AB7; }
    } 
    </style>
    `
}

export function styleTooltip() {
    return `
    <style>
    [data-tooltip] {
      position: relative;
      z-index: 10000000;
      cursor: pointer;
    }
    [data-tooltip]:before,
    [data-tooltip]:after {
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
    }
    [data-tooltip].multiline:before {
        white-space: normal !important;
        width: 300px !important;
        text-align:center;
    }
    [data-tooltip]:before {
      position: absolute;
      padding: 7px 12px;
      border-radius: 5px;
      background-color: hsla(0, 0%, 5%, 0.8);
      color: #fff;
      content: attr(data-tooltip);
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      line-height: 1.2;
      transition: all 0.2s ease-in-out;
      white-space: nowrap;
    }
    .tooltip-maxwidth[data-tooltip]:before {
        white-space:pre-wrap;
    }
    [data-tooltip]:after {
      position: absolute;
      content: " ";
      font-size: 0;
      line-height: 0;
      transition: all 0.2s ease-in-out;
    }
    [data-tooltip]:hover:before,
    [data-tooltip]:hover:after,
    .tooltip-visible[data-tooltip]:before, 
    .tooltip-visible[data-tooltip]:after {
      visibility: visible;
      opacity: 1;
    }
    .left-tooltip[data-tooltip]:before {
      bottom: 0;
      left: 0%;
      margin-left: -5px;
      transform:translateX(-100%);
    }
    .left-tooltip[data-tooltip]:after {
        top: 50%;
        transform:translateY(-5px);
        left:-10px;
        width: 0;
        border-left: 5px solid hsla(0, 0%, 5%, 0.8);
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
    }
    .left-tooltip[data-tooltip]:hover:before {
      margin-left: -12px;
    }
    .left-tooltip[data-tooltip]:hover:after {
      margin-left: -3px;
    }
    .top-tooltip[data-tooltip]:before {
      bottom: 0px;
      left: 50%;
      transform:translate(-50%, 100%);
    }
    .top-tooltip[data-tooltip]:after {
      width: 0;
      left:50%;
      bottom: 0px;
      transform:translate(-50%,100%);
      border-bottom: 5px solid hsla(0, 0%, 5%, 0.8);
      border-right: 5px solid transparent;
      border-left: 5px solid transparent;
      opacity:0;
    }
    .top-tooltip[data-tooltip]:hover:before {
      margin-bottom: -5px;
    }
    .top-tooltip[data-tooltip]:hover:after {
      margin-bottom: -5px;
    }
    /* Main panel Next/Prev tooltips: vertically centered on the small buttons */
    .play-rewind-button[data-tooltip]:before,
    .play-fast-forward-button[data-tooltip]:before {
      bottom: auto;
      top: 50%;
      transform: translate(-100%, -50%);
      margin-left: -6px;
      font-size: 12px;
    }
    .play-rewind-button[data-tooltip]:after,
    .play-fast-forward-button[data-tooltip]:after {
      top: 50%;
      transform: translateY(-50%);
      left: -6px;
    }
    .play-rewind-button[data-tooltip]:hover:before,
    .play-fast-forward-button[data-tooltip]:hover:before {
      margin-left: -6px;
    }
    .play-rewind-button[data-tooltip]:hover:after,
    .play-fast-forward-button[data-tooltip]:hover:after {
      margin-left: 0;
    }
    /* Shift the "Next" tooltip further left so it clears the "Prev" icon */
    .play-fast-forward-button[data-tooltip]:before {
      transform: translate(calc(-100% - 20px), -50%);
    }
    .play-fast-forward-button[data-tooltip]:after {
      left: -26px;
    }
    </style>
    `
}



export function style() {
    return `          
    <style id="StyleChat">
    #AutoPlayEnterKeyIcon {
        position:absolute;
        bottom:0px;
        left:0px;
        display:none;
    }
    #AutoPlayEnterKeyIcon.ON { display:block; }
    #AutoPlayEnterKeyIcon.OFF { display:none; }
    .toolbar-hr {
        margin:2px 0px;
        background:rgba(0, 0, 0, 0.28);
        height:1px;
    }
    svg { display:block; }
    #svg circle {
        stroke-dashoffset: 0;
        transition: stroke-dashoffset 1s linear;
        stroke: #666;
        stroke-width: 2px;
    }
    #svg #bar { stroke: #FF9F1E; }
    #cont {
        display: block;
        height: 28px;
        width: 28px;
        border-radius: 100%;
        position: relative;
    }
    #PreviewContainer {
        background-color:#111827;
        border-radius:25px;
        padding:10px;
    }
    #PlayReadButton{
        background-color: inherit;
        position: relative;
        width: 28px;
        height: 28px;
        justify-content: center;
        margin:0px;
        padding:0px;
    }

    #PlayReadButton .close-icon { display:none; }
    #PlayReadButton.finished {
        background-image: linear-gradient(
           to right,
          #ff2400, #e81d1d, #e8b71d, #e3e81d, #1de840, #1ddde8, #2b1de8, #dd00f3, #dd00f3
        ) !important;
        background-repeat: repeat-x;
        background-position: 0 0;
        background-size: 500px 100%;
        background-clip: text;
        color: transparent;
        animation-name: rainbow;
        animation-duration: 2s;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
    }
    @keyframes rainbow {
         to { background-position: -500px 0; }
    }

    #VR-Reader.hidden #OptionButtons {
        height:0px;
        min-height:0px;
        opacity:0;
        transition: height 0.7s ease-in,min-height 0.7s ease-in, opacity 0.2s ease-in;
        transition-delay:0.5s,0.5s, 0.2s;
        overflow:hidden;
    }
    #OptionButtons {
        height:-webkit-fill-available;
        min-height:198px;
        opacity:1;
        transition:height 0.7s ease-in, min-height 0.7s ease-in, opacity 0.2s ease-in;
        transition-delay:0.5s, 0.5s, 0.2s;
    }
    #VR-Reader.hidden.compact #PreviewContainer { display:none; }

    #VR-Reader.hidden .mouseover-view,
    #VR-Reader.hidden #VoicePlayerContainer,
    #VR-Reader.hidden .message-content {
        display:none;
        overflow:hidden;
    }
    #VR-Reader.hidden .content { background: transparent; }
    #VR-Reader.hidden { box-shadow: none; }
    #VR-Reader.not-supported-browser #CloseButton,
    #VR-Reader.not-supported-browser #VoicePlayerContainer,
    #VR-Reader.not-supported-browser .message-content,
    #VR-Reader.not-supported-browser #OptionButtons {
        display:none;
    }
    #VR-Reader.not-supported-browser .content { background: transparent; }
    #VR-Reader.not-supported-browser {
        background:transparent;
        width:136px;
        box-shadow: none;
    }
    #VR-Reader {
        background: linear-gradient(180deg, rgba(0, 121, 255, 1) 0%, rgb(123 41 255) 66%);
        padding:3px;
        border-radius:25px;
        max-width: 800px;
        margin: auto;
        box-shadow: rgb(0 0 0 / 16%) 0px 1px 4px;
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index:10000000000000000;
        max-height: 96vh;   
    }
    #VR-Reader.placement-bottom { bottom: 140px; }
    #VR-Reader.placement-middle {
        transform: translateY(60px);
        bottom: 50%;
    }

    #VR-Reader.mouse-over{ opacity: 1 !important; }
    #VR-Reader .content {
        color: black;
        border-radius: 23px;                  
    }
    #OptionButtons { display:flex; }
    .main-content{
        display:flex;text-align: right;justify-content: right;flex-grow:1;
        max-height: 90vh;
        overflow:auto;
    }
    #PlayReadButton.invalid-content { color:#72777d; cursor:not-allowed;}
    #PlayReadButton.invalid-content:hover { color:white;}
    #PlayReadButton.audio-state-off .audio-circle { display:block;}


    .message-content{
        line-height: 1.3em;
        font-size: 14px;
        font-weight: bold;
        padding:10px;                    
        color: rgb(0 0 0 / 60%);
        font-family: "Maniac-Logo";   
        margin: 10px;   
        background-color: white;
        border-radius: 12px;                              
    }
    .message-content p { margin:0px; }
    .main-button {
        height: -webkit-fill-available;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        border: none;
        font-family: "Maniac-Logo";
        display: flex;
        background: #ececec;
        border-radius: 50%;
        cursor: pointer;
        align-items: center;
        position:relative;
        transition: 0.15s linear;
    }
    .audio-circle {
        position:absolute;
        top:0px;
        left:0px;
        background-color:rgba(256,256,256,0.75);
        border-radius:50%;
        display:none;
        zoom: 0.7;
        color:black;
        transform: translate(-25%, -25%);
    }
    .invisible-button {
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        border: none;
        color: white;
        padding: 5px 5px 5px 5px;
        margin: 5px auto;
        display: flex;
        background: transparent;
        border-radius: 15px;
        cursor: pointer;
        align-items: center;
        transition: 0.15s linear;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .invisible-button:hover {
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        background: #111827;
        color:white;
    }
    .invisible-button-2 {
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        border: none;
        color: white;
        padding: 0px;
        padding-bottom:5px;
        margin: 5px auto;
        display: flex;
        background: transparent;
        border-radius: 15px;
        cursor: pointer;
        align-items: center;
        transition: 0.15s linear;
        align-items: center;
        justify-content: center;
    }
    .play-timer-button{ padding-bottom:5px !important; }
    .playback-action-btn {
        cursor: pointer;
        border: none;
        color: white;
        padding: 0px;
        display: flex;
        align-items: center;
        background: transparent;
        justify-content: center;
        transition: all 0.2s ease;
        opacity: 0.7;
    }
    .playback-action-btn:hover {
        opacity: 1;
        transform: scale(1.15);
        color: #4285f4;
    }
    .playback-action-btn:active {
        transform: scale(0.95);
        color: #2563eb;
    }
    @keyframes button-press {
        0% { transform: scale(1); }
        50% { transform: scale(0.9); }
        100% { transform: scale(1); }
    }
    .playback-action-btn.clicked {
        animation: button-press 0.3s ease;
    }
    .main-button:hover {
        background-color:#F2642F !important;
        color:white;
    }
    #PlayReadButton.pulse {
        animation: pulse 2s linear both;
        animation-iteration-count: infinite;
    }
    #PlayReadButton.ending {
        animation: pulse 2s linear both;
        animation-iteration-count: 1;
    }
    @keyframes pulse {
        10%, 90% {
            box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        }
        20%, 80% {
            box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 3px, rgb(0 94 236 / 60%) 0px 1px 24px 3px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        }
        30%, 50%, 70% {
            box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        }
        40%, 60% {
            box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 3px, rgb(0 94 236 / 60%) 0px 1px 24px 3px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        }
        100% {
            box-shadow: rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
        }
    }
    @keyframes rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .main-button button { }
    .main-button{
        box-shadow:rgb(0 94 236 / 40%) 0px 0px 0px 2px, rgb(0 94 236 / 60%) 0px 4px 6px -1px, rgb(255 255 255 / 8%) 0px 1px 0px inset;
    }
    </style>
    `
}

export function styleWindowSizes() {
    return `<style>
    @media only screen and (max-width: 400px) {
        #VR-Reader { zoom:0.8; }
    }
    @media only screen and (min-width: 450px) {
        #VR-Reader { zoom:0.9; }
    }
    @media only screen and (min-width: 600px) {
        #VR-Reader { zoom:1; }
    }
    </style>`
}
