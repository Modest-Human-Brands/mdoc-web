import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { registerWebMcp } from './mcp/register'
import router from './router'
import { useWizardStore } from './stores/wizard'
import 'unfonts.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

registerWebMcp({ wizard: useWizardStore(pinia), router })

app.mount('#app')