/**
 * ============================================================================
 * VoiceFavoritesList Module
 * ============================================================================
 * Manages the "Voice Favorites" and "Prompt Shortcuts" UI panel within the widget.
 * It renders lists of global and domain-specific text replacement rules or prompts,
 * allowing users to copy them or quickly access the settings to create new ones.
 */
import { getHostName, getInnerText3_raw, copyTextToClipboardFallback } from "../../utils/helpers";
import { CONSTANTS, } from "../../../js/constants/constants";
export default class  VoiceFavorites {
    constructor() {
        this.el = null;
    
        this.componentDiv;
        this.componentIDNAME = "VOICE_FAVORITES";
    }

    initDOM(DOMElement) {
        this.el = DOMElement
    }
    init(){
        try{
            this.getPromptList()

        }catch(e){
            //console.log(e)
        }
    }

    getPromptList(){

        this.componentDiv.querySelector(`.domain-shortcuts-list`).innerHTML = "";
        this.componentDiv.querySelector(`.global-shortcuts-list`).innerHTML = "";

        function createShortcutRuleItem(promptRulesList,container){
            if(promptRulesList.length > 0){
                promptRulesList.filter((rule)=> rule.action === CONSTANTS.PROMPT_RULE_ACTION.REPLACE_TEXT_SHORTCUT ).forEach(ruleItem => {

                    const ruleDiv = document.createElement("div");
                    ruleDiv.className = "rule-item"
                    ruleDiv.innerHTML = `
                    <span class="copy-icon" title="copy prompt"><svg style="z-index:-1" class="copy" title="copy prompt" width="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g fill="none"><path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg></span>
                    <div>${ruleItem.find}</div>
                    <div>${ruleItem.replace}</div>`;
        
                    const createClickListener = (id) => {
                        return async (e) => {

                            if(e.target.className === 'copy-icon'){
                                copyTextToClipboardFallback(ruleItem.replace);

                                VR_Reader.makeToast({
                                    delay:2500,
                                    posX:window.innerWidth/2,
                                    posY:250, 
                                    action:'normal', 
                                    message:`Copied to clipboard`,
                                });
                            }
                        };
                    };

                    ruleDiv.addEventListener('click',createClickListener(ruleItem));

                    container.appendChild(ruleDiv)
                }); 
            }
        }

        createShortcutRuleItem( VR_Reader.savedLocalStorageDomain[CONSTANTS.PROMPT_RULE_KEYNAME],
             this.componentDiv.querySelector(`.domain-shortcuts-list`) );

        createShortcutRuleItem( VR_Reader.savedLocalStorageDomainGlobals[CONSTANTS.PROMPT_RULE_KEYNAME], 
            this.componentDiv.querySelector(`.global-shortcuts-list`) );
    }

    addCreatePromptButtonListener(){
        const createClickListener = (source) => {
            return async (e) => {
                chrome.runtime.sendMessage({
                    action: "openPromptRulesTab",
                    source,
                });	
            };
        };
        this.componentDiv.querySelector(`#AddGobalPromptButton`).addEventListener('click',createClickListener("global"));
        this.componentDiv.querySelector(`#AddDomainPromptButton`).addEventListener('click',createClickListener(getHostName()));


    }

	createHTML() {	  	  
        return ` 
            <div style="height:100%;position: relative;grid-template-rows: auto 40px; display:grid;">                                    
                <div id="${this.componentIDNAME}_LIST">
                    <label>${getHostName()} prompt shortcuts</label>    
                    <div class="domain-shortcuts-list"></div>

                    <label>global prompt shortcuts</label>
                    <div class="global-shortcuts-list"></div>
                </div>
                <div class="playback-buttons-ctn">
                    <button class="button" id="AddDomainPromptButton" style="padding:10px;box-sizing: border-box;">
                        Add ${getHostName()} shortcut
                    </button>   
                    <button class="button" id="AddGobalPromptButton" style="padding:10px;box-sizing: border-box;">
                        Add global shortcut
                    </button>                                     
                </div>
            </div>
            ${this.style()}
        `
    }

    style(){

            return `          
            <style id="${this.componentIDNAME}_STYLE">
            #${this.componentIDNAME}_LIST {
                overflow: auto;
                height: 230px;
            }
            label {
                display:block;
                padding:3px;
                background-color:#ADD8E6;
            }
            .copy-icon svg { 
                z-index: -1;
                user-select: none;
                pointer-events: none;
                display:block; 
            }
            .copy-icon {
                position:absolute;
                top:5px;
                left:5px;
                cursor:pointer;
                padding:5px;
                border-radius:50%;
                display:block;
            }
            .copy-icon:hover {
                background-color: lightgrey;
            }

            .rule-item {
                position:relative;
                border-radius:10px;
                margin:10px;
                padding:5px;
                border-bottom:1px solid gray;
            }
            #${this.componentIDNAME}_Component {
                height:100%;
            }

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


            </style>`
    }
    render(){        
        this.componentDiv = document.createElement("div");
        this.componentDiv.id = `${this.componentIDNAME}_Component`
        this.componentDiv.innerHTML = this.createHTML()

		this.el.append(this.componentDiv);
		this.init();
    }    
}
