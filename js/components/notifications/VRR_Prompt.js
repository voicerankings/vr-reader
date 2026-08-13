/**
 * ============================================================================
 * VRR_Prompt Module
 * ============================================================================
 * This class creates a customizable, interactive prompt modal that is rendered
 * within its own Shadow DOM. It supports multiple action buttons (including 
 * asynchronous actions with loading states) and a cancel button.
 * 
 * It is typically instantiated and managed globally via the \`makePrompt\` 
 * factory function in \`js/content/modalFactories.js\`.
 * 
 * @example
 * // Example usage in the app via the global factory:
 * window.VR_Reader.makePrompt({
 *     title: "Delete Voice",
 *     message: "Are you sure you want to delete this voice?",
 *     icon: "<svg>...</svg>",
 *     action: "error", // Adds error styling class (e.g., red theme)
 *     posX: 100,
 *     posY: 100,
 *     actions: [
 *         {
 *             buttonText: "Delete",
 *             asyncCallback: async (pos) => {
 *                 await deleteVoiceFromDatabase();
 *                 return true;
 *             }
 *         }
 *     ],
 *     cancel: {
 *         buttonText: "Cancel"
 *     }
 * });
 */
export default class VRR_Prompt {
    constructor({action = 'none',
    title = '',
    icon = '',
    message = '', 
    promptInfo = null,
    promptType = 'alert',
    actions = [],
    cancel = null}) {
        this.shadow = null
        this.promptType = promptType;
        this.promptInfo = promptInfo;
        this.cancel = cancel;
        this.className = ''
        this.message = message;
        this.title = title;
        this.icon = icon;
        this.action = action;
        this.actions = actions;
        this.posX;
        this.posY;
        // Track loading state for each action button
        this.actionLoading = actions.map(() => false);
    }

    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({mode: 'open'});
    }
    
    init(){
        this.initListeners();
        const superUltraRoot = document.querySelector('#shadowdom-highlight-prompt').shadowRoot;
        
        var rect = superUltraRoot.querySelector(".toast ").getBoundingClientRect();
        if(rect.left < 0){
            superUltraRoot.querySelector(".popup-wrapper").classList.add("reposition");
        }
    }
    
    initListeners(){
        const superUltraRoot = document.querySelector('#shadowdom-highlight-prompt').shadowRoot;

        this.actions.forEach((item, index) => {
            const clickHandler = async (index) => {
                // Check if this action is async
                const isAsync = !!this.actions[index].asyncCallback;
                
                if (isAsync) {
                    // Set loading state for this button
                    this.actionLoading[index] = true;
                    this.updateButtonState(index);
                    
                    try {
                        // Call the async function
                        const result = await this.actions[index].asyncCallback({
                            posX: this.posX,
                            posY: this.posY
                        });
                        
                        // Reset loading state
                        this.actionLoading[index] = false;
                        this.updateButtonState(index);
                        
                        // Call the result callback with the fetch result
                        if (this.actions[index].resultCallback) {
                            this.actions[index].resultCallback(result);
                        }
                        
                        // Close if closeAfterAsync is true
                        if (this.actions[index].closeAfterAsync !== false) {
                            this.close();
                        }
                    } catch (error) {
                        // Handle errors
                        console.error("Async operation failed:", error);
                        this.actionLoading[index] = false;
                        this.updateButtonState(index);
                        
                        // Call error callback if provided
                        if (this.actions[index].errorCallback) {
                            this.actions[index].errorCallback(error);
                        }
                    }
                } else {
                    // Regular non-async action
                    this.close();
                    this.actions[index].callback({
                        posX: this.posX,
                        posY: this.posY
                    });
                }
            };
            
            superUltraRoot.querySelector(`#Action${index}Btn`).addEventListener("click", () => clickHandler(index));
        });

        if(superUltraRoot.querySelector("#CancelBtn")){
            superUltraRoot.querySelector("#CancelBtn").addEventListener("click", () => {
                this.close();
            });
        }

        if(superUltraRoot.querySelector("#CloseXBtn")){
            superUltraRoot.querySelector("#CloseXBtn").addEventListener("click", () => {
                this.close();
            });
        }
    }
    
    updateButtonState(index) {
        const superUltraRoot = document.querySelector('#shadowdom-highlight-prompt').shadowRoot;
        const button = superUltraRoot.querySelector(`#Action${index}Btn`);
        
        if (button) {
            if (this.actionLoading[index]) {
                // Save original text
                button.dataset.originalText = button.innerHTML;
                // Show loading state
                button.innerHTML = `
                    <div class="spinner"></div>
                    <span>Loading...</span>
                `;
                button.classList.add("loading");
                button.disabled = true;
            } else {
                // Restore original text if available
                if (button.dataset.originalText) {
                    button.innerHTML = button.dataset.originalText;
                }
                button.classList.remove("loading");
                button.disabled = false;
            }
        }
    }
	
    close(instantClose = false) {
        const superUltraRoot = document.querySelector('#shadowdom-highlight-prompt').shadowRoot;
        
        if(superUltraRoot){
            superUltraRoot.querySelector(".toast").classList.add("fade-away")
            const timeoutDelay = (instantClose)? 20 : 1000;
            if(instantClose === true){
                const elem = document.querySelector('#shadowdom-highlight-prompt');
                if(elem) elem.parentNode.removeChild(elem);
            }
            setTimeout(()=>{
                if(instantClose === false){
                    const elem = document.querySelector('#shadowdom-highlight-prompt');
                    if(elem) elem.parentNode.removeChild(elem);
                }
            
                delete VR_Reader.promptClass;

            },timeoutDelay);
        }
	}
	
    createHTML({posX,posY}) {	  	  
        return `
        
            <div class="popup-wrapper">
                <div class="container">
                    <div class="toast ${this.action}">                
                        <button id="CloseXBtn" class="close-x-btn" aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        <div style="display:flex; min-width: 250px;">
                            ${(this.icon ? `
                            <div style="display:flex; align-items:center; justify-cotent:center; padding: 15px;    border-right: 1px solid #8297ff5c;">
                                ${this.icon}
                            </div>`:``)}
                            
                            <div style="padding:30px;">
                                <h3>${this.title}</h3>
                                <p style="line-height:1.2em;">${this.message}</p>

                                <div style="display:flex;gap:10px;">
                                    ${ (this.actions[0])? `<button id="Action0Btn">${this.actions[0].buttonText}</button>`:''}
                                    ${ (this.actions[1])? `<button id="Action1Btn">${this.actions[1].buttonText}</button>`:''}
                                    ${ (this.actions[2])? `<button id="Action2Btn">${this.actions[2].buttonText}</button>`:''}
                                    ${ (this.cancel !== null)? `<button id="CancelBtn">${this.cancel.buttonText}</button>`:''}
                                </div>   

                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ${this.style({posX,posY})}
     
        `
    }
    
    style({posX,posY}){
        return `
        <style>
        h3 {
            margin:0px;
            white-space: nowrap;
            font-size:15px;
        }
        button {
            white-space: nowrap;
            display:flex;
            align-items: center;
            gap:4px;
        }
        .close-x-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent !important;
            border: none !important;
            padding: 4px !important;
            cursor: pointer;
            color: inherit;
            opacity: 0.6;
            transition: opacity 0.2s, background-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px !important;
        }
        .close-x-btn:hover {
            opacity: 1;
            background: rgba(128, 128, 128, 0.2) !important;
        }
        .close-x-btn svg {
            width: 16px;
            height: 16px;
        }
        button.loading {
            opacity: 0.8;
            cursor: not-allowed;
        }
        .spinner {
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .popup-wrapper{
            z-index:10000000000;
            
            right:${posX}px;
            top:${posY}px;
            position: fixed;
            display: block;
            background-color:transparent;
        }
        .popup-wrapper.reposition{
            right:10px !important;
            transform:scale(0.9);
        }

        .container {
          min-width:300px;
          height:300px;
          position:relative;            
        }

        @keyframes expandWidth {
            0% { background-color:#5cff59;
                 width: 0px; 
               }
           
            100% { background-color:#5cff59;
                   width: 100%; 
            }
         }
         
         .expandWidth {
           animation:expandWidth ${this.delay/1000}s linear 1;
         }

        .status-bar-ctn {
            width:100%;
            background-color:black;
            height:5px;
         }

         .status-bar {
            width:0%;
            background-color:green;
            height:5px;
         }

        .toast { 
            border-radius: 10px;
            border: 1px solid rgb(155, 135, 123);
            /* text-align: center; */
            /* transform: translateX(-50%); */
            border-radius: 10px;
            color: #5A5A5A;
            margin: 3px;
            font-size: 15px;
            margin-top: 3px;
            background-color: #F0F0F0;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 6px 12px -2px, rgba(0, 0, 0, 0.3) 0px 3px 7px -3px;
            position: absolute;
            top:0px;
            /* bottom: 0px; */
            overflow: hidden;
            /* white-space: nowrap; */
            right: 0px;
            font-family: arial, sans-serif;
        } 

        .toast.purple-blue {
            background: linear-gradient(180deg, rgba(0, 121, 255, 1) 0%, rgb(123 41 255) 66%);
            border: 1px solid rgb(155, 135, 123);
            color:white;
        }

        .toast.vrr-theme h3 {
            font-size: 17px;
            color: white;
        }

        .toast.vrr-theme {
            background: #142853;
            border: 1px transparent;
            color:#dae8ff;
        }

        .toast.vrr-theme button {
            background-color: #4f46e5;
            color: white;
            border: 1px;
            border-radius: 10px;
            padding: 5px 15px;
            cursor:pointer;
        }

        .toast.vrr-theme button:hover {
            background-color: #4338ca;
        }
        

        .toast.success {
          background-color:#6CED6C;
          border: 1px solid rgb(155, 135, 123);
          color:white;
        }    

        .toast.error {
          background-color:#FF9797;
          border: 1px solid rgb(155, 135, 123);
          color:#3C3C3C;
        }   

      .fade-away {
          animation: fadeAway 0.6s ease-out forwards;
      }
      
                  
      @keyframes fadeAway {
          0% { opacity:1; top:0px; }           
          100% { opacity: 0; top:-50px; }
      }
        </style>
      `
    }
    
    render(posX,posY){
        this.posX = posX;
        this.posY = posY;

		this.shadow.innerHTML = this.createHTML({
            posY,
            posX
        });

		this.init();
    }     
}
