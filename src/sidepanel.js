import { createApp , onMounted} from 'vue'
import SidePanel from './SidePanel.vue'
import './index.css';
import 'floating-vue/dist/style.css'
import './css/github-dark-dimmed.css';
import FloatingVue from 'floating-vue';
FloatingVue.options.themes.tooltip.delay = {
    show: 500,
    hide: 0
  }
const app = createApp(SidePanel);

app.use(FloatingVue);

app.mount('#app');

window.focus();