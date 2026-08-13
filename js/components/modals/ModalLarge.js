export default class ModalLarge {
    constructor({
        styleCSS,
        customFunction,
        title,
        message, 
        actions = [],
        callbackData,
        closeCallback  // Added closeCallback parameter
    }) {
        this.customFunction = customFunction;
        this.styleCSS = styleCSS || "";
        this.shadow = null;
        this.actions = actions;
        this.message = message;
        this.title = title;
        this.callbackData = callbackData;
        this.closeCallback = closeCallback; // Store the closeCallback
    }

    initShadowDOM(DOMElement) {
        this.shadow = DOMElement.attachShadow({mode: 'open'});
    }
    
    init(){
        this.initListeners();
    }
    
    initListeners(){
        const superUltraRoot = document.querySelector('#shadowdom-modal-large').shadowRoot;

        this.actions.forEach((item,index)=>{
            if(item.type === "hr"){
                return;
            }
            const clickHandler = (index) => {
                let result = this.actions[index].callback(this.callbackData);  
                
                if(result === "keep-open"){
                    return false;
                }
                this.close();
            }
            
            superUltraRoot.querySelector(`#Action${index}Btn`).addEventListener("click",()=>clickHandler(index));             
        });

        // Add event listener for close button
        superUltraRoot.querySelector(`#CloseButton`).addEventListener("click", () => this.close());

        superUltraRoot.querySelector(`.popup-wrapper`).addEventListener("click",(e)=>{
            e.stopPropagation();
            e.preventDefault();
        }); 
        
        superUltraRoot.querySelector(`.modal-bg`).addEventListener("click",()=>this.close()); 
        
        setTimeout(() => {
            superUltraRoot.querySelector(`.popup-wrapper`).classList.add("zoom-fadein"); 
        }, 250);

        if(this.customFunction){
            this.customFunction(this.shadow);
        }
    }
    
    close(instant = false) {
        // Execute closeCallback if provided
        if (this.closeCallback && typeof this.closeCallback === 'function') {
            this.closeCallback();
        }
        
        const elem = document.querySelector('#shadowdom-modal-large');
        if(elem) elem.parentNode.removeChild(elem);

        if(instant){
            delete VR_Reader.modalLargeClass;
        }else{
            setTimeout(()=>{
                delete VR_Reader.modalLargeClass;
            },20);
        }
    }
    
    createElement(action,index){
        if(action.type && action.type === 'hr'){
            return `<hr>`;
        }else{
            return `
            <a id="Action${index}Btn" class="button ${action.buttonClass}"><span>${action.buttonText}</span></a>
            `;
        }
    }
    
    createHTML() {     
        return ` 
        <div class="modal-bg"> 
            <div class="modal-content">
                <div id="CloseButton">
                    <svg width="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M13.314 11.9l3.535-3.536a1 1 0 1 0-1.414-1.414l-3.536 3.535L8.364 6.95A1 1 0 1 0 6.95 8.364l3.535 3.535l-3.535 3.536a1 1 0 1 0 1.414 1.414l3.535-3.535l3.536 3.535a1 1 0 1 0 1.414-1.414l-3.535-3.536z" fill="currentColor"/></svg>                </div>
                <div class="popup-wrapper">
                    <div class"container">
                        <div class="grid">
                            <div>
                                <div class="modal-content-inner">
                                    <div class="title">${this.title}</div>
                                    ${(this.message)? `<p class="message">
                                    ${this.message}
                                </p>`:``}
                                    <div class="buttons-container" style="margin-top: 1.5rem;">
                                    ${ 
                                        (this.actions.map((action,index) => {
                                                return `
                                                ${this.createElement(action,index)}
                                                `;                   
                                        })).join(" ")
                                    }
                                    </div>    
                                </div>
                            </div>
                        </div>                                    
                    </div>
                </div>
            </div>
        </div>

          <style>
          #CloseButton{
            position:absolute;
            top:10px;
            right:10px;
            cursor:pointer;
            opacity:0.8;
            color:white;
            z-index:10000;
          }
          #CloseButton:hover{
            opacity:1;
          }
            .modal-bg {
                position:fixed;
                display:flex;
                top:0px;
                bottom:0px;
                right:0px;
                left:0px;
                z-index:10000000;
                background-color:rgba(31, 41, 55,0.7);
                -webkit-text-size-adjust: 100%;
                -moz-tab-size: 4;
                tab-size: 4;
                font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                font-feature-settings: normal;
                font-variation-settings: normal;
                -webkit-tap-highlight-color: transparent;
            }

            .modal-content {
                position:relative;
                height:100%;
           
                max-width:600px;  
                margin: auto;
                display: inline-block;          
            }
          .popup-wrapper{
              z-index:2002;
              transform:translate(-50%, -50%) scale(0.8);
              left:50%;
              top:50%;
              position: absolute;
              display: block;
              background-color: rgb(17, 24, 39);
              border-radius: 0.5rem;
               /*max-width: 36rem;*/
              width:100%;
              transition-property: all;
              transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
              transition-duration: 150ms;
              --tw-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
              --tw-shadow-colored: 0 25px 50px -12px var(--tw-shadow-color);
              box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
              opacity:0;
          }
          .container {
            padding-left: 6rem;
            padding-right: 6rem; 
            max-width: 80rem;
            width: 100%;  
            position:relative;      
          }
          .grid {
            grid-template-columns: repeat(1, minmax(0, 1fr));
            display: grid;            
          }

          .grid > div {
            --tw-bg-opacity: 1;
            background-color: rgb(17, 24, 39);
            transform: translateX(-50%);
    

            margin-top: 1rem;

            margin-bottom: 1rem;

            margin-right: auto;

            margin-left: auto;

            display:flex;

            align-items:center;
            border-radius: 20px;
            min-width: 400px;
            text-align: center;
            justify-content: center;
          }

          .modal-content-inner {
                padding:50px;

                align-items: center;

                flex-direction: column;

                display: flex;
          }

         .title {
            color: rgb(255, 255, 255 );
            letter-spacing: -0.05em;
            line-height: 1;
            font-weight: 600;
            font-size: 1.5rem;
            line-height: 2rem;
            margin-top: 2rem;
            width:100%;
            text-align:center;
         }
         .message {
            color: rgb(229, 231, 235 );
            font-size: 1rem;
            line-height: 1.5rem;
            text-align: center;
            margin-top: 0.75rem;
         }

         .button:hover {
            background-color: rgb(67, 56, 202);
         }
         .button {
            margin-top:10px;

            cursor:pointer;
            display:block;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 500ms;
            transition-property: color, background-color, border-color, fill, stroke, opacity, box-shadow, transform, filter, -webkit-text-decoration-color, -webkit-backdrop-filter;
            transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
            transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, -webkit-text-decoration-color, -webkit-backdrop-filter;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
            --tw-text-opacity: 1;
            color: rgb(255 255 255 / var(--tw-text-opacity));
            font-weight: 500;
            font-size: 18px;
            line-height: 150%;
            text-align: center;
            padding-right: 20px;

            padding-left: 20px;

            padding-bottom: 15px;

            padding-top: 15px;

            background-color: rgb(79, 70, 229);

            border-radius: 15px;

            justify-content: center;
 
         }

        .button.btn-outline:hover {
        background-color:rgba(0,0,0,.2);
        }

        .is-hidden {
            display:none !important;
        }
        .button.btn-outline {
                  outline:1px solid rgb(79, 70, 229);

            display:block;
 
            color: white
            font-weight: 500;
            font-size: 1rem;
            line-height: 1.5rem;
            text-align: center;
            padding-right: 20px;
            padding-left: 20px;
            padding-bottom: 15px;
            padding-top: 15px;
            background-color: transparent;
            border-radius: 0.75rem;
            justify-content: center;
 
         }

        .button.no-style,
        .button.no-style-text{
            background-color: transparent;
            color:white;
            display:table-cell;
            margin-top:10px;
        }

        .button.no-style-text:hover .btn-title {
            color:#4f46e5;
        }
        
        .button.no-style-text > span {

            display:flex;
            align-items:center;
            gap:10px;
        }

         .zoom-fadein {
            /* Animation */
            animation: zoomFadeIn 0.25s ease-out forwards;
         }

         @keyframes zoomFadeIn {
            from {
                opacity: 0;
                transform:translate(-50%, -50%) scale(0.8);
            }
            to {
                opacity: 1;
                transform:translate(-50%, -50%) scale(1);
            }
        }

  .select-wrapper {
      position: relative;

    }

    .select-wrapper::after {
      content: "▼";
      font-size: 12px;
      color: #fff;
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }

    select {
      width: 100%;
      padding: 12px 35px 12px 15px;
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      appearance: none;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    select:hover {
      border-color: #6366f1;
    }

    select:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    option {
      background-color: #1e293b;
      color: white;
      padding: 8px;
    }

    option[data-selected="true"]::before {
    content: "➤ ";
    }

    option[data-selected="true"] {

        font-weight: bold;
    }


          </style>
          ${this.styleCSS};
        `;
    }
    
    render(){
        this.shadow.innerHTML = this.createHTML();
        this.init();
    }     
}
