<script setup lang="ts">
/**
 * Sector A：智子
 * - 视网膜：继续研究，就会有一行只有你看得见的倒计时悬在一切之上；坚持下去，整个宇宙会为你闪烁。
 * - 展开：从十一维到一维，看一个质子如何被展开、刻上电路、再折叠回去。
 * - 对话：与智子说话（大模型流式回复，见 api/chat）。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { streamChat } from '@/api/chat'
import type { Message } from '@/types/sophon'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import SophonUnfold from '@/components/SophonUnfold.vue'
import { sectorByPath } from '@/data/sectors'

const question = sectorByPath('/sector-a')?.question

/* ---------- 视网膜：研究与倒计时 ---------- */
type Research = 'idle' | 'on' | 'flicker' | 'stopped'
const research = ref<Research>('idle')
const remainingMs = ref(1200 * 3600 * 1000)
const elapsed = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
const countdown = computed(() => {
  const ms = Math.max(0, remainingMs.value)
  const h = Math.floor(ms / 3.6e6)
  const m = Math.floor((ms % 3.6e6) / 6e4)
  const s = Math.floor((ms % 6e4) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${h}:${p(m)}:${p(s)}:${p(cs)}`
})
function startResearch() {
  research.value = 'on'
  elapsed.value = 0
  clearInterval(tick)
  tick = setInterval(() => {
    // 倒计时走得比真实时间快：它不是在等你，而是在催你
    remainingMs.value -= 50 * 37
    elapsed.value += 50
    if (research.value === 'on' && elapsed.value > 20000) research.value = 'flicker'
  }, 50)
}
function stopResearch() {
  clearInterval(tick)
  research.value = 'stopped'
}
const RESEARCH_TEXT: Record<Research, string> = {
  idle: '你是一名纳米材料研究员。你的项目，可能是人类将来唯一能造出太空电梯的材料。',
  on: '倒计时出现在你看到的一切东西上：照片里、天花板上、闭上眼睛的黑暗里。只有你看得见。',
  flicker: '你仍然没有停下。今夜，整个宇宙背景辐射在为你一个人闪烁。',
  stopped: '你停止了研究。倒计时消失了，宇宙恢复平静。没有人逼你，你只是不再往前走。',
}

/* ---------- 展开 ---------- */
const dimension = ref(11)
const DIM_TEXT: Record<number, string> = {
  11: '十一维：质子在微观尺度上的完整形态，比一个点更小。',
  10: '把高维一层层展开，每展开一维，它就在低维里变得更大。',
  9: '继续展开。',
  8: '继续展开。',
  7: '继续展开。',
  6: '六维：卷曲的空间开始舒展，像一团揉皱的纸。',
  5: '继续展开。',
  4: '四维：它在三维里看起来时大时小，像从另一个方向经过。',
  3: '三维：一个巨大的球体，大到环绕行星，遮住天空。',
  2: '二维：展开成一张薄膜，覆盖整个行星的面积。工程师在上面刻下电路，然后把它重新折叠回去。',
  1: '一维：一根无限细的弦。展开过头了，它什么也做不了。',
}

/* ---------- 对话 ---------- */
const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const bugs = ref(false)
const genId = () => `MSG-${Date.now().toString(16).toUpperCase()}${Math.random().toString(16).slice(2, 6)}`
function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  })
}
async function send() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return
  if (/虫子|bug/i.test(text)) {
    bugs.value = true
    setTimeout(() => (bugs.value = false), 3200)
  }
  isLoading.value = true
  inputText.value = ''
  messages.value.push({ id: genId(), role: 'user', content: text, timestamp: Date.now(), status: 'done' })
  const reply: Message = { id: genId(), role: 'sophon', content: '', timestamp: Date.now(), status: 'streaming' }
  messages.value.push(reply)
  const live = messages.value[messages.value.length - 1]
  scrollToBottom()
  try {
    await streamChat(messages.value, (chunk) => {
      live.content += chunk
      scrollToBottom()
    })
    live.status = 'done'
  } catch {
    live.content += '（连接中断。智子沉默了。）'
    live.status = 'error'
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

onMounted(() => {
  messages.value.push({
    id: genId(),
    role: 'sophon',
    content: '我是智子。在我眼里，你们的世界是透明的。',
    timestamp: Date.now(),
    status: 'done',
  })
})
onUnmounted(() => clearInterval(tick))
</script>

<template>
  <div class="sector-a" :class="{ flicker: research === 'flicker' }">
    <SectorHeader
      title="智子"
      subtitle="一个被展开成二维、刻上电路、再折叠回微观的质子。它锁死了人类的基础物理，也看着人类的一举一动。"
      goal="和智子说话；或者继续你的研究，看看会发生什么。"
    />

    <!-- 只有你看得见的倒计时：悬在整个页面之上（挂到 body，避免被闪烁滤镜改变定位） -->
    <Teleport to="body">
      <div v-if="research === 'on' || research === 'flicker'" class="sophon-retina" aria-live="off">
        <span class="num">{{ countdown }}</span>
      </div>
      <transition name="bugs">
        <div v-if="bugs" class="sophon-bugs" aria-hidden="true">
          <span v-for="i in 24" :key="i" :style="{ left: ((i * 37) % 92) + '%', top: ((i * 53) % 88) + '%' }">你们是虫子</span>
        </div>
      </transition>
    </Teleport>

    <div class="layout">
      <Vitrine class="chat-vitrine" caption="智子的回答由大模型生成，不代表原著。它很傲慢，也很诚实。">
        <div class="chat">
          <div ref="chatContainer" class="messages">
            <div v-for="m in messages" :key="m.id" class="msg" :class="m.role">
              <span class="who">{{ m.role === 'user' ? '你' : '智子' }}</span>
              <p class="text">{{ m.content }}<span v-if="m.status === 'streaming'" class="cursor">▍</span></p>
            </div>
          </div>
          <form class="ask" @submit.prevent="send">
            <input v-model="inputText" type="text" placeholder="对智子说话" :disabled="isLoading" aria-label="对智子说话" />
            <button type="submit" :disabled="isLoading || !inputText.trim()">发出</button>
          </form>
        </div>
      </Vitrine>

      <div class="side">
        <Vitrine>
          <h2 class="v-title">视网膜</h2>
          <p class="v-text">{{ RESEARCH_TEXT[research] }}</p>
          <div class="v-actions">
            <button v-if="research === 'idle' || research === 'stopped'" type="button" class="plain-btn" @click="startResearch">
              {{ research === 'stopped' ? '重新开始研究' : '继续研究' }}
            </button>
            <button v-else type="button" class="plain-btn warn" @click="stopResearch">停止研究</button>
          </div>
          <p v-if="research === 'stopped'" class="v-question">{{ question }}</p>
        </Vitrine>

      </div>
    </div>

    <Vitrine class="unfold-vitrine" caption="三体世界用一个质子造出了智子：把它从十一维展开到二维，在膜上刻好电路，再折叠回去。">
      <div class="unfold-head">
        <h2 class="v-title">展开</h2>
        <span class="dim-read">维度 <b class="num">{{ dimension }}</b></span>
      </div>
      <SophonUnfold @dim="(d) => (dimension = d)" />
      <p class="v-text small">{{ DIM_TEXT[dimension] }}</p>
    </Vitrine>
  </div>
</template>

<style scoped>
.sector-a {
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  max-width: 78rem;
  transition: filter 1.2s;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

/* 宇宙为你闪烁：整页缓慢地明暗起伏 */
.sector-a.flicker { animation: cosmos-blink 3.2s ease-in-out infinite; }
@keyframes cosmos-blink { 50% { filter: brightness(1.45) contrast(0.92); } }

.sophon-retina {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.sophon-retina .num {
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  letter-spacing: 0.05em;
  color: rgba(220, 214, 200, 0.42);
  text-shadow: 0 0 18px rgba(220, 214, 200, 0.25);
  mix-blend-mode: screen;
}

.sophon-bugs { position: fixed; inset: 0; z-index: 130; pointer-events: none; }
.sophon-bugs span { position: absolute; font-family: var(--font-title); font-weight: 900; font-size: 1.25rem; color: var(--rust-bright); opacity: 0.85; }
.bugs-enter-active, .bugs-leave-active { transition: opacity 0.6s; }
.bugs-enter-from, .bugs-leave-to { opacity: 0; }

.layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 1fr); gap: 1.5rem; align-items: start; }
.side { display: flex; flex-direction: column; gap: 1.5rem; }

.chat { display: flex; flex-direction: column; height: min(62vh, 36rem); }
.messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1.1rem; padding-right: 0.5rem; }
.msg { display: flex; flex-direction: column; gap: 0.25rem; max-width: 40rem; }
.msg.user { align-self: flex-end; text-align: right; }
.who { font-size: 0.8125rem; color: var(--weathered); }
.msg.sophon .who { color: var(--cherenkov); }
.text { margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); white-space: pre-wrap; }
.msg.user .text { color: var(--bone); }
.cursor { color: var(--cherenkov); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.ask { display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--incision-soft); }
.ask input {
  flex: 1;
  min-width: 0;
  padding: 0.65rem 0.8rem;
  font: inherit;
  font-size: 1rem;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision);
  border-radius: 2px;
}
.ask input:focus { outline: none; border-color: var(--cherenkov); }
.ask button, .plain-btn {
  padding: 0.6rem 1.1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.ask button:disabled { opacity: 0.4; cursor: not-allowed; }
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn.warn { color: var(--rust-bright); border-color: rgba(210, 85, 63, 0.6); }

.v-title { margin: 0 0 0.6rem; font-family: var(--font-serif); font-size: 1.125rem; font-weight: 600; letter-spacing: 0.08em; color: var(--bone); }
.v-text { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }
.v-text.small { font-size: 0.9375rem; margin: 0.75rem 0 0; }
.v-actions { display: flex; gap: 0.5rem; }
.v-question { margin: 1.25rem 0 0; padding-left: 1rem; border-left: 1px solid var(--cherenkov); font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.8; color: var(--bone); }
.unfold { width: 100%; height: auto; display: block; background: var(--void); border: 1px solid var(--incision-soft); }
.dim { display: block; margin-top: 0.75rem; }
.dim > span { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--weathered); }
.dim b { font-weight: 400; color: var(--bone); }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .chat { height: 60vh; }
}
.unfold-vitrine { margin-top: 1.5rem; }
.unfold-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; }
.dim-read { font-size: 0.875rem; color: var(--weathered); }
.dim-read b { font-weight: 400; font-size: 1.25rem; color: var(--cherenkov); }
</style>
