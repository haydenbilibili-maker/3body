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

// --- 魔戒：四维碎片里的一座坟墓（对话大意依原著改写，问题是固定的几条）---
const RING_QA: { q: string; a: string }[] = [
  { q: '你是谁？', a: '我是一座坟墓。建造我的那个文明，已经不在了。' },
  { q: '你们为什么会在这里？', a: '我们的世界是四维的。海干了，鱼只好到别的地方去。' },
  { q: '海是谁弄干的？', a: '把海弄干的鱼，在海干之前就上了陆地，从一片黑暗森林奔向另一片黑暗森林。' },
  { q: '你会伤害我们吗？', a: '你们太小了。在我看来，你们和你们的飞船，就像画在纸上的。' },
  { q: '高维空间会一直存在吗？', a: '它在消失。每一块碎片都在慢慢跌落到更低的维度里，你们看到的我，也是。' },
]
const chatHistory = reactive<{ role: 'ring' | 'human'; text: string }[]>([
  { role: 'ring', text: '……' },
])
const asked = reactive(new Set<number>())
const isTyping = ref(false)
let ringTimer: ReturnType<typeof setTimeout> | undefined

function ask(i: number) {
  if (isTyping.value || asked.has(i)) return
  asked.add(i)
  chatHistory.push({ role: 'human', text: RING_QA[i].q })
  isTyping.value = true
  ringTimer = setTimeout(() => {
    chatHistory.push({ role: 'ring', text: RING_QA[i].a })
    isTyping.value = false
  }, 1400)
}
onUnmounted(() => clearTimeout(ringTimer))

</script>

<template>
  <div class="sector-g">
    <SectorHeader
      title="四维碎片"
      subtitle="方寸之间，深不见底"
      goal="用升维取走平面国密室里的所有东西，一面墙都不打破——在碎片蒸发之前。"
      accent="#a99cc4"
      class="g-header"
    />

    <NTabs v-model:value="activeTab" type="segment" class="g-tabs">
      <!-- Module 0: Flatland（核心玩法）-->
      <NTabPane name="flatland" tab="方寸之间">
        <div class="flatland-pane">
          <FlatlandPuzzle />
        </div>
      </NTabPane>

      <!-- 超立方体 -->
      <NTabPane name="tesseract" tab="超立方体">
        <div class="tess">
          <div class="canvas-container">
            <TresCanvas clear-color="#0d0e10">
              <TresPerspectiveCamera :position="[4, 4, 4]" :look-at="[0, 0, 0]" />
              <OrbitControls :enable-zoom="true" :auto-rotate="true" :auto-rotate-speed="1" />
              <TresAmbientLight :intensity="1" />
              <The4DTesseract />
            </TresCanvas>
          </div>
          <p class="tess-note">这是一个四维超立方体在三维里的影子，正如立方体在纸上的影子是两个套在一起的方框。你看到的「里面的方块」和「外面的方块」，在四维里一样大——只是离你远近不同。拖动可以转动它。</p>
        </div>
      </NTabPane>

      <!-- 魔戒 -->
      <NTabPane name="ring" tab="魔戒">
        <div class="ring">
          <p class="ring-intro">「蓝色空间」号和「万有引力」号在四维碎片里遇到一个巨大的环。它自称是一座坟墓，愿意回答几个问题。</p>
          <ol class="chat-flow" aria-live="polite">
            <li v-for="(msg, i) in chatHistory" :key="i" class="msg-row" :class="msg.role">
              <span class="role-label">{{ msg.role === 'ring' ? '魔戒' : '你' }}</span>
              <span class="msg-text">{{ msg.text }}</span>
            </li>
            <li v-if="isTyping" class="msg-row ring">
              <span class="role-label">魔戒</span>
              <span class="msg-text wait">……</span>
            </li>
          </ol>
          <div class="ring-asks">
            <button
              v-for="(qa, i) in RING_QA"
              :key="i"
              type="button"
              :disabled="isTyping || asked.has(i)"
              @click="ask(i)"
            >{{ qa.q }}</button>
          </div>
          <p v-if="asked.size === RING_QA.length" class="ring-end">它不再回答了。环在慢慢变暗，像一块正在冷却的炭。</p>
        </div>
      </NTabPane>

    </NTabs>
  </div>
</template>

<style scoped>
.sector-g { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; color: var(--bone); }
.flatland-pane { padding: 1.5rem 0 0; color: var(--gray-150); }

:deep(.n-tabs-rail) { background: var(--slab) !important; border: 1px solid var(--incision-soft); border-radius: 2px !important; }
:deep(.n-tabs-capsule) { background: var(--slab-raised) !important; border-radius: 2px !important; }
:deep(.n-tabs-tab) { color: var(--weathered) !important; }
:deep(.n-tabs-tab--active) { color: var(--bone) !important; }

.tess { padding-top: 1.5rem; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 1.5rem; align-items: center; }
.canvas-container { position: relative; height: 26rem; background: #0d0e10; border: 1px solid var(--incision-soft); }
.tess-note { margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }

.ring { max-width: 44rem; padding-top: 1.5rem; }
.ring-intro { margin: 0 0 1.25rem; font-size: 0.9375rem; line-height: 1.8; color: var(--weathered); }
.chat-flow { list-style: none; margin: 0 0 1.25rem; padding: 0; border-left: 1px solid var(--incision); }
.msg-row { display: flex; gap: 1rem; padding: 0.5rem 0 0.5rem 1rem; line-height: 1.85; }
.role-label { flex: none; width: 2.5rem; font-size: 0.8125rem; color: var(--weathered); }
.msg-text { font-family: var(--font-serif); font-size: 1.0625rem; }
.msg-row.ring .msg-text { color: #c9c0dc; }
.msg-row.human .msg-text { color: var(--bone); }
.wait { animation: breathe 1.4s ease-in-out infinite; }
@keyframes breathe { 50% { opacity: 0.3; } }
.ring-asks { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.ring-asks button {
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.ring-asks button:hover:not(:disabled) { border-color: var(--weathered); }
.ring-asks button:disabled { opacity: 0.35; cursor: default; }
.ring-end { margin: 1.25rem 0 0; font-family: var(--font-serif); color: var(--weathered); }

@media (max-width: 900px) {
  .tess { grid-template-columns: 1fr; }
  .canvas-container { height: 20rem; }
}
</style>
