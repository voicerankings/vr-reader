
export default function useLangRegionDisplayName() {
  
    function getLangName(voice_language_code){
        const lang = new Intl.DisplayNames(['en'], { type: 'language' });

        return lang.of(voice_language_code.split("-")[0]);
    }

    function getRegionName(voice_language_code){
        const lang = new Intl.DisplayNames(['en'], { type: 'region' });

        const splitCount = voice_language_code.split("-").length
        const parts = voice_language_code.split("-");
   
        if((splitCount > 2 && parts[1].length === 2) || (splitCount === 2 && parts[1].length === 2 ) ){
            return lang.of(parts[1]);
        }else if(splitCount > 2 && parts[2].length === 2){
            return lang.of(parts[2]);
        }else {
            return ""
        }
    }
      
    return { getLangName, getRegionName };
  }