import bulma from '../../css/bulma.min.css?inline'
export const defaultCSS = ()=>{
    return `
    <style>
    body {
        font-size: initial;
    }

    select {
        background-color: #f0f0f0;
        font-family: Arial, sans-serif;
        border: 1px solid #ddd;
        padding: 5px;
        border-radius: 5px;
        color:black;
    }
    
    select option {
        background-color: #fff;
        color: black;
    }
    
    div {
        font-family: arial,sans-serif;
    }
    ${bulma}

    </style>
    `
}