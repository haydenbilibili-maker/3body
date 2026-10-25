<script setup lang="ts">
/**
 * Sector G: The 4th Dimension (四维碎片)
 * 核心：方寸之间（平面国升维解谜，见 components/FlatlandPuzzle.vue + sim/flatland.ts）、超立方体投影、魔戒对话
 * 风格：故障艺术 (Glitch), 深紫/霓虹
 */
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { NTabs, NTabPane } from 'naive-ui'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import The4DTesseract from '@/components/The4DTesseract.vue'
import { soundManager } from '@/utils/sound'
import SectorHeader from '@/components/SectorHeader.vue'
import FlatlandPuzzle from '@/components/FlatlandPuzzle.vue'

onMounted(() => {
  soundManager.startAmbient('void')
})

onUnmounted(() => {
  soundManager.stopAmbient()
})

const activeTab = ref('flatland')

// --- Tab 2: The Ring (Chat) ---
const chatHistory = reactive([
  { role: 'ring', text: '我是墓地。我是死人。我是死的。' },
  { role: 'ring', text: '海干了。鱼要到水洼里去，只有那里有水。' }
])
const userInput = ref('')
const isTyping = ref(false)

function sendToRing() {
  if (!userInput.value.trim()) return
  
  const q = userInput.value
  chatHistory.push({ role: 'human', text: q })
  userInput.value = ''
  isTyping.value = true
  
  setTimeout(() => {
    let reply = '...'
    if (q.includes('海') || q.includes('干')) reply = '把海弄干的鱼在海干前上了陆地，从一片黑暗森林奔向另一片黑暗森林。'
    else if (q.includes('你') || q.includes('谁')) reply = '我只是一个记忆体。'
    else if (q.includes('四维') || q.includes('高维')) reply = '方寸之间，深不见底。'
    else if (q.includes('人类')) reply = '弱小的鱼。'
    else reply = '不懂。数据已丢失。'
    
    chatHistory.push({ role: 'ring', text: reply })
    isTyping.value = false
  }, 1500)
}

</script>

<template>
  <div class="sector-g">
    <SectorHeader
      code="SECTOR G · THE FOURTH DIMENSION"
      title="四维碎片"
      subtitle="方寸之间，深不见底"
      goal="用升维取走平面国密室里的所有东西，一面墙都不打破——在碎片蒸发之前。"
      accent="#c58bff"
      class="g-header"
    />

    <NTabs v-model:value="activeTab" type="segment" class="g-tabs">
      <!-- Module 0: Flatland（核心玩法）-->
      <NTabPane name="flatland" tab="方寸之间">
        <div class="flatland-pane">
          <FlatlandPuzzle />
        </div>
      </NTabPane>

      <!-- Module 1: Tesseract -->
      <NTabPane name="tesseract" tab="超立方体">
        <div class="canvas-container">
          <TresCanvas window-size clear-color="#050005" presets="realistic">
            <TresPerspectiveCamera :position="[4, 4, 4]" :look-at="[0, 0, 0]" />
            <OrbitControls :enable-zoom="true" :auto-rotate="true" :auto-rotate-speed="1" />
            <TresAmbientLight :intensity="1" />
            <The4DTesseract />
          </TresCanvas>
          <div class="overlay-info">
            <p>"方寸之间，深不见底。"</p>
            <p class="sub-info">超立方体投影 (TESSERACT PROJECTION)</p>
          </div>
        </div>
      </NTabPane>

      <!-- Module 2: The Ring -->
      <NTabPane name="ring" tab="魔戒对话">
        <div class="ring-interface">
          <div class="ring-monitor">
            <div class="scan-line"></div>
            <div class="chat-flow">
              <div v-for="(msg, i) in chatHistory" :key="i" class="msg-row" :class="msg.role">
                <span class="role-label">{{ msg.role === 'ring' ? '魔戒' : '你' }} ></span>
                <span class="msg-text">{{ msg.text }}</span>
              </div>
              <div v-if="isTyping" class="msg-row ring">
                <span class="role-label">魔戒 ></span>
                <span class="msg-text blink">_</span>
              </div>
            </div>
          </div>
          <div class="ring-input">
            <input 
              v-model="userInput" 
              @keyup.enter="sendToRing" 
              type="text" 
              placeholder="向它提问..." 
              :disabled="isTyping"
            />
            <button @click="sendToRing" :disabled="isTyping">发送 (SEND)</button>
          </div>
        </div>
      </NTabPane>

    </NTabs>
  </div>
</template>

<style scoped>
.sector-g {
  min-height: 0;
  background: #050005;
  color: #d0a0ff;
  font-family: var(--font-mono);
  display: flex;
  flex-direction: column;
}

.g-header {
  padding: 1.25rem 2rem 0;
  margin-bottom: 0;
}

.flatland-pane {
  padding: 1.5rem 2rem 2rem;
  font-family: var(--font-sans);
  color: var(--gray-150);
}

.g-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.n-tabs-nav) {
  background: #0a000a;
  border-bottom: 1px solid #330033;
}
:deep(.n-tabs-tab) { color: #b9a3d6 !important; }
:deep(.n-tabs-tab--active) { color: #f0e2ff !important; font-weight: 600; }

/* Tesseract */
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 60vh;
}
.overlay-info {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  pointer-events: none;
  background: rgba(0,0,0,0.5);
  padding: 1rem;
  border: 1px solid var(--c-magenta);
}
.sub-info { font-size: 0.75rem; color: var(--c-cyan); }

/* The Ring */
.ring-interface {
  max-width: 800px;
  margin: 2rem auto;
  border: 4px solid var(--gray-700);
  background: var(--black);
  display: flex;
  flex-direction: column;
  height: 60vh;
}
.ring-monitor {
  flex: 1;
  background: radial-gradient(circle, #1a001a 0%, var(--black) 100%);
  padding: 2rem;
  overflow-y: auto;
  position: relative;
  font-family: var(--font-mono);
}
.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: rgba(255, 0, 255, 0.1);
  animation: scan 3s linear infinite;
  pointer-events: none;
}
@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }

.msg-row { margin-bottom: 1rem; line-height: 1.4; }
.role-label { margin-right: 1rem; opacity: 0.5; }
.msg-row.ring { color: var(--c-magenta); text-shadow: 0 0 5px var(--c-magenta); }
.msg-row.human { color: var(--c-cyan); }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.ring-input {
  display: flex;
  border-top: 2px solid var(--gray-700);
}
.ring-input input {
  flex: 1;
  background: var(--gray-900);
  border: none;
  color: var(--white);
  padding: 1rem;
  font-family: inherit;
}
.ring-input button {
  background: #330033;
  color: var(--c-magenta);
  border: none;
  padding: 0 2rem;
  cursor: pointer;
  font-weight: bold;
}
.ring-input button:hover { background: #550055; }

@media (max-width: 768px) {
  .g-header { padding: 1rem 1rem 0; }
  .flatland-pane { padding: 1rem; }
}
</style>
