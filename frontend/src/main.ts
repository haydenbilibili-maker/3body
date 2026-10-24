import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 自托管字体（@fontsource）：按 unicode-range 分片，只下载页面用到的字形
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/300.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/orbitron/400.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/700.css'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
