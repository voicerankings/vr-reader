/**
 * ============================================================================
 * VRR_Toast Module
 * ============================================================================
 * This class creates a temporary, self-dismissing toast notification that is 
 * rendered within its own Shadow DOM. It supports custom icons, themes, and 
 * an animated progress bar indicating when it will disappear.
 * 
 * It is typically instantiated and managed globally via the \`makeToast\` 
 * factory function in \`js/content/modalFactories.js\`.
 * 
 * @example
 * // Example usage in the app via the global factory:
 * window.VR_Reader.makeToast({
 *     title: "Success",
 *     message: "Voice saved to favorites!",
 *     icon: "🎉", // SVG or Emoji
 *     action: "success", // Adds success styling class (e.g., green theme)
 *     delay: 3000,       // Closes automatically after 3 seconds
 *     posX2: 20,         // Anchors 20px from the right
 *     posY2: 20,         // Anchors 20px from the bottom
 *     callback: () => {
 *         console.log("Toast closed automatically");
 *     }
 * });
 */
export default class VRR_Toast {
    constructor({
        hideProgressBar = false,
        icon = '',
        title = '',
        message = '',
        action = 'none',
        delay = 4000,
        callback,
        forceCloseCallback
    }) {
        this.shadow = null
        this.el;
        this.hideProgressBar = hideProgressBar;
        this.title = title;
        this.icon = icon;
        this.message = message;
        this.action = action;
        this.delay = delay;
        this.posX;
        this.posY;
        this.toastTimeout;
        this.callback = callback;
        this.forceCloseCallback = forceCloseCallback;

        // Bind the handler for removal later
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
    }

    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({ mode: 'open' });
    }

    init() {
        console.log("this.delay", this.delay)
        clearTimeout(this.toastTimeout)
        this.toastTimeout = null;

        // 1. Initialize Event Listeners (Click outside + Close Button)
        this.initListeners();

        if (this.delay === false) {} else {
            console.log("this.delay+1000", this.delay + 1000)
            this.toastTimeout = setTimeout(() => {
                this.close(false);
            }, this.delay + 1000);
        }
    }

    initListeners() {
        const superUltraRoot = this.shadow;

        // 1. Handle Close (X) Button
        const closeBtn = superUltraRoot.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent document click from firing immediately
                this.close(true); // Force close
            });
        }

        // 2. Handle Click Outside
        // Add a small delay to prevent the click that opened the toast from closing it immediately
        setTimeout(() => {
            document.addEventListener('click', this.handleDocumentClick);
        }, 100);
    }

    handleDocumentClick(e) {
        const target = e.target;
        const hostElement = document.querySelector('#shadowdom-vrr-toast');

        if(target.closest('#quick-access') || 
            target.closest('#vrr-quick-access-host')){
            return 
        }
        // If the click target is NOT inside our shadow host, close the toast
        if (hostElement && !hostElement.contains(e.target)) {
            this.close(true); // Force close implies manual interaction
        }
    }

    close(force = false) {
        // 1. Clean up document listener to prevent memory leaks
        document.removeEventListener('click', this.handleDocumentClick);

        clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
        const elem = document.querySelector('#shadowdom-vrr-toast');

        if (elem) {
            elem.parentNode.removeChild(elem);
            if (VR_Reader.toastClass)
                delete VR_Reader.toastClass

            if (force === false) {
                if (this.callback) {
                    this.callback()
                }
            } else {
                if (this.forceCloseCallback) {
                    this.forceCloseCallback()
                }
            }
        }
    }

    createHTML({ posX, posY, posX2, posY2 }) {
        return `  
            <div class="popup-wrapper">
                <div class"container">
                    <div class="toast ${(this.delay !== false) ? 'fade-away' : ''} ${this.action}">                
                    ${typeof this.delay === 'number' && this.hideProgressBar === false ? `
                        <button class="close-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    ` : ''}
                        <div class="status-bar-ctn">
                            <div class="status-bar expandWidth"></div>
                        </div>
                        <div style="display:flex;align-items:center;">
                            ${(this.icon ? `
                            <div style="display:flex; align-items:center; justify-cotent:center; padding:10px;border-right:1px solid #CCC;">
                                ${this.icon}
                            </div>`: ``)}
                            ${this.title || this.message ? `
                            <div style="padding:10px;">
                                ${this.title ? `<h3>${this.title}</h3>`: ``}
                                ${this.message ? `<p>${this.message}</p>`: ``}
                            </div>
                            `: ``}
                        </div>
                    </div>
                </div>
            </div>
            ${this.style({ posX, posY, posX2, posY2 })}
            `
    }

    style({ posX, posY, posX2, posY2 }) {
        return `
        <style>
        h3 {
            margin:0px;
  
            font-size:15px;
        }
        p {
            margin:5px 0;
        }
        .popup-wrapper{
            z-index:100000000000;
            ${posX2 ? `right:${posX2}px;`: ``}
            ${posX ? `left:${posX}px;`: ``}

            ${posY2 ? `bottom:${posY2}px;`: ``}
            ${posY ? `top:${posY}px;`: ``}

            position: fixed;
            display: block;
            background-color:transparent;
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
           animation:expandWidth ${this.delay / 1000}s linear 1;
         }

        .status-bar-ctn {
            width:100%;
            background-color:black;
            height:5px;
            opacity:${this.hideProgressBar === true ? '0' : '100'};
         }

         .status-bar {
            width:0%;
            background-color:green;
            height:5px;

            border-top-right-radius: 10px;
            border-top-left-radius: 10px;
         }

        .close-btn {
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: white;
            border: 1px solid black;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            transition: all 0.2s ease;
            z-index: 2;
        }

        .toast:hover .close-btn {
            opacity: 1;
        }

        .toast:hover .close-btn{
            background: #ff4444;
            border-color: #ff4444;
            color: white;
        }

        .toast { 
            border-radius: 10px;
            border: 1px solid rgb(155, 135, 123);
            /* text-align: center; */
             transform: translate(-50%,-50%);
            
            color: #5A5A5A;
            margin: 3px;
            font-size: 15px;
            margin-top: 3px;
            background-color: #F0F0F0;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 6px 12px -2px, rgba(0, 0, 0, 0.3) 0px 3px 7px -3px;
     
            ${posY2 ? `bottom:0px;`: ``}
            ${posY ? `top:0px;`: ``}
            
            /* white-space: nowrap; */
            right: 0px;
            font-family: arial, sans-serif;
        } 

        .toast.success {
          background-color:#6CED6C;
          border: 1px solid rgb(155, 135, 123);
          color:white;
        }   
        .toast.purple-blue {
            background: linear-gradient(180deg, rgba(0, 121, 255, 1) 0%, rgb(123 41 255) 66%);
            border: 1px solid #bab2fe94;
            color:white;
        } 

        .toast.error {
          background-color:#FF9797;
          border: 1px solid rgb(155, 135, 123);
          color:#3C3C3C;
        }   

      .fade-away {
          animation: fadeAway 0.6s ease-out forwards;
          animation-delay: ${((this.delay) / 1000)}s;
          animation-iteration-count: 1;
      }
      
                  
      @keyframes fadeAway {
        ${posY ? `
        0% { opacity:1; top:0px; }           
          100% { opacity: 0; top:-50px; }
          `: ``}
        ${posY2 ? `
        0% { opacity:1; bottom:0px; transform: scale(1);}           
          100% { opacity: 0; bottom:50px; transform: scale(0.7); }
        `: ``}
          
      }
        </style>
      `
    }

    render(posX, posY, posX2, posY2) {
        this.posX = posX;
        this.posY = posY;
        console.log("create toast")
        this.shadow.innerHTML = this.createHTML({
            posY,
            posX,
            posX2,
            posY2,
        });

        this.init();
    }
}
