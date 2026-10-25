<script setup lang="ts">
/**
 * 对话室：在一个具体的时刻与人物相遇。
 * - 时刻：人物在哪里、此刻知道什么；人物先开口
 * - 心防：三个话题，每碰到一个松一格；三格全开，人物会说出心里藏着的那件事
 * - 记忆：每个场景的谈话保存在本机，下次回来接着说
 * - 记得你：访客在相关展厅里的选择会告诉人物（data/figureMemory.ts）
 * - 说话的节奏：回答按说话的速度出现，遇到动作和句号会停一停
 * - 没有后端时，用档案里的录音（预设问答与场景台词）兜底
 * 场景数据见 data/figureScenes.ts；人设提示词由后端按场景组织（backend/routers/chat.py）。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { streamFigureChat } from '@/api/figureChat'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { getDialogueSet, hasDialogue } from '@/data/figureDialogues'
import { scenesOf, splitStage, touchedKeys, type FigureScene } from '@/data/figureScenes'
import { answers, recordAnswer } from '@/data/answers'
import { followUpsFor, visitorFor } from '@/data/figureMemory'

interface FigureLike {
  name: string
  role?: string | null
  description?: string | null
}
const props = defineProps<{ figure: FigureLike; portrait?: string }>()
const emit = defineEmits<{ close: [] }>()

const llmConfig = useLlmConfigStore()
const scenes = computed(() => scenesOf(props.figure.name))
const sceneId = ref(scenes.value[0]?.id ?? '')
const scene = computed<FigureScene | undefined>(() => scenes.value.find((s) => s.id === sceneId.value))

type Msg = { role: 'user' | 'figure'; content: string; offline?: boolean }
const KEY = 'figure-talk-v1'
function loadAll(): Record<string, Msg[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
function saveAll(all: Record<string, Msg[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 存储不可用：只保留在本次访问 */
  }
}
const store = ref<Record<string, Msg[]>>(loadAll())
const messages = computed<Msg[]>(() => store.value[sceneId.value] ?? [])
function setMessages(list: Msg[]) {
  store.value = { ...store.value, [sceneId.value]: list.slice(-60) }
  saveAll(store.value)
}

const input = ref('')
const loading = ref(false)
const offline = ref(false)
const offlineReason = ref('')
const listEl = ref<HTMLElement | null>(null)

/* ---------- 心防 ---------- */
const userLines = computed(() => messages.value.filter((m) => m.role === 'user').map((m) => m.content))
const touched = computed(() => (scene.value ? touchedKeys(scene.value, userLines.value) : new Set<string>()))
const open = computed(() => !!scene.value && touched.value.size >= scene.value.keys.length)
const revealedKey = 'figure-talk-revealed-v1'
function loadRevealed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(revealedKey) || '[]')
  } catch {
    return []
  }
}
const revealed = ref<string[]>(loadRevealed())
const sceneRevealed = computed(() => revealed.value.includes(sceneId.value))

const asked = computed(() => new Set(userLines.value))
const visitor = computed(() => visitorFor(props.figure.name, answers.value))
const lastReply = computed(() => {
  const m = [...messages.value].reverse().find((x) => x.role === 'figure')
  return m?.content ?? ''
})
/** 追问在前（跟着他刚说的话），场景问题在后 */
const suggestions = computed(() => {
  if (!scene.value) return []
  const base = scene.value.questions.filter((q) => !asked.value.has(q))
  if (!messages.value.length) return base
  return [...followUpsFor(lastReply.value, asked.value), ...base.slice(0, 2)]
})

/* ---------- 说话的节奏 ---------- */
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let pending = ''
let pumping: Promise<void> | null = null
function pump(onText: (t: string) => void): Promise<void> {
  if (pumping) return pumping
  pumping = new Promise<void>((resolve) => {
    const step = () => {
      if (!pending) {
        pumping = null
        resolve()
        return
      }
      // 每拍放出两个字；句号、问号、动作结束时停一停
      const take = reduced ? pending.length : 2
      const out = pending.slice(0, take)
      pending = pending.slice(take)
      onText(out)
      const pause = /[。？！）]$/.test(out) ? 420 : 45
      setTimeout(step, reduced ? 0 : pause)
    }
    step()
  })
  return pumping
}

function scrollDown() {
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/** 没有后端时的回答：档案里的预设问答，否则是场景里的兜底台词 */
function offlineReply(q: string, k: number): string {
  const set = hasDialogue(props.figure.name) ? getDialogueSet(props.figure.name) : null
  const hit = set?.qa.find((x) => x.question === q || q.includes(x.question) || x.question.includes(q))
  if (hit) return hit.answer
  const lines = scene.value?.offline ?? ['……']
  return lines[k % lines.length]
}

async function send(text: string) {
  const s = scene.value
  const q = text.trim()
  if (!s || !q || loading.value) return
  const before = messages.value
  const history = before
    .filter((m) => !m.offline)
    .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }))
  const list: Msg[] = [...before, { role: 'user', content: q }]
  setMessages(list)
  input.value = ''
  scrollDown()

  // 这一句是否刚好打开了心防：打开后的这一轮，人物可以把藏着的事说出来
  const willOpen = touchedKeys(s, [...userLines.value]).size >= s.keys.length
  const reply: Msg = { role: 'figure', content: '' }
  setMessages([...list, reply])
  loading.value = true
  let failed = false
  let raw = ''
  let queued = 0
  await streamFigureChat(
    {
      figure_name: props.figure.name,
      figure_role: props.figure.role || undefined,
      figure_description: props.figure.description || undefined,
      message: q,
      history: [{ role: 'assistant', content: s.opening }, ...history].slice(-16),
      scene: {
        title: s.title,
        era: s.era,
        setting: s.setting,
        knows: s.knows,
        mood: s.mood,
        secret: s.secret,
        reveal: willOpen,
        visitor: visitor.value,
      },
      ...llmConfig.requestOverrides,
    },
    (chunk) => {
      raw += chunk
      // 「[智子]……」是后端在模型没接通时流回来的错误文案：不显示，稍后换成档案录音；
      // 还看不出是不是它的时候先攒着，看清楚之后再一起放出来
      const t = raw.trimStart()
      if (t.startsWith('[智子]') || (t.length < 4 && '[智子]'.startsWith(t))) return
      pending += raw.slice(queued)
      queued = raw.length
      void pump((t) => {
        reply.content += t
        setMessages([...list, { ...reply }])
        scrollDown()
      })
    },
    () => {
      failed = true
    },
  )
  // 流结束时还攒着、但不是错误文案的那几个字，也放出来
  if (!raw.trimStart().startsWith('[智子]') && queued < raw.length) {
    pending += raw.slice(queued)
    queued = raw.length
    void pump((t) => {
      reply.content += t
      setMessages([...list, { ...reply }])
    })
  }
  if (pumping) await pumping
  // 后端接通了、模型没有接通时，后端会把「[智子]……」这样的错误文案当作回答流回来
  if (raw.trimStart().startsWith('[智子]')) {
    offlineReason.value = raw.replace(/^\s*\[智子\]\s*/, '').replace(/[。.]\s*$/, '')
    failed = true
  }
  if (failed || !raw.trim()) {
    offline.value = true
    const k = list.filter((m) => m.role === 'user').length - 1
    const content = willOpen && !sceneRevealed.value ? `（沉默了很久，终于开口。）${s.secret}` : offlineReply(q, k)
    setMessages([...list, { role: 'figure', content, offline: true }])
  }
  if (willOpen && !sceneRevealed.value) {
    revealed.value = [...revealed.value, s.id]
    try {
      localStorage.setItem(revealedKey, JSON.stringify(revealed.value))
    } catch {
      /* 忽略 */
    }
    recordAnswer('/sector-p', `在「${s.title}」，${props.figure.name}对你说出了心里藏着的事`)
  }
  loading.value = false
  scrollDown()
}

function submit() {
  send(input.value)
}
function forgetScene() {
  setMessages([])
}

watch(sceneId, scrollDown)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  scrollDown()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="talk" role="dialog" aria-modal="true" :aria-label="`与${figure.name}对话`">
      <aside class="side">
        <button type="button" class="close" @click="emit('close')">离开对话室</button>
        <img v-if="portrait" :src="portrait" :alt="figure.name" class="portrait" />
        <h2 class="who">{{ figure.name }}</h2>
        <p v-if="figure.role" class="role">{{ figure.role }}</p>

        <p class="side-label">在哪个时刻见他</p>
        <div class="scenes" role="radiogroup" aria-label="时刻">
          <button
            v-for="s in scenes"
            :key="s.id"
            type="button"
            role="radio"
            class="scene-opt"
            :aria-checked="s.id === sceneId"
            @click="sceneId = s.id"
          >
            <span class="so-era">{{ s.era }}</span>
            <span class="so-title">{{ s.title }}</span>
          </button>
        </div>

        <template v-if="scene">
          <p class="side-label">心防</p>
          <ol class="guard" :aria-label="`心防，已经松动 ${touched.size} / ${scene.keys.length}`">
            <li v-for="k in scene.keys" :key="k.word" :class="{ on: touched.has(k.word) }">
              <span class="g-notch" aria-hidden="true"></span>
              <span class="g-text">{{ touched.has(k.word) ? k.word : `也许和「${k.hint}」有关` }}</span>
            </li>
          </ol>
          <p class="guard-note">
            {{ sceneRevealed ? '他已经对你说出了心里藏着的事。' : open ? '心防打开了。再问一句。' : '他心里藏着一件事。问到对的话题，他会慢慢松口。' }}
          </p>
        </template>

        <template v-if="visitor">
          <p class="side-label">他听说过你</p>
          <p class="heard">{{ visitor }}</p>
        </template>

        <details class="conn">
          <summary>连接设置</summary>
          <p>默认使用后端配置的模型（未配置时为本地 Ollama）。这里填写的地址与 Key 只在后端允许客户端覆盖时生效。</p>
          <label class="c-row"><input type="checkbox" :checked="llmConfig.useLocalOllama" @change="llmConfig.setUseLocalOllama(($event.target as HTMLInputElement).checked)" /> 使用本地 Ollama</label>
          <label class="c-row">API Key<input type="password" :value="llmConfig.apiKey" placeholder="留空则用本地" @input="llmConfig.setApiKey(($event.target as HTMLInputElement).value)" /></label>
          <label class="c-row">Base URL<input :value="llmConfig.baseUrl" placeholder="https://…/v1" @input="llmConfig.setBaseUrl(($event.target as HTMLInputElement).value)" /></label>
          <label class="c-row">模型<input :value="llmConfig.model" placeholder="如 deepseek-chat" @input="llmConfig.setModel(($event.target as HTMLInputElement).value)" /></label>
        </details>
      </aside>

      <main v-if="scene" class="room">
        <header class="room-head">
          <p class="rh-era"><span aria-hidden="true"></span>{{ scene.era }}</p>
          <h1 class="rh-title">{{ scene.title }}</h1>
          <p class="rh-setting">{{ scene.setting }}</p>
        </header>

        <div ref="listEl" class="transcript" aria-live="polite">
          <div class="msg figure">
            <span class="m-who">{{ figure.name }}</span>
            <p v-for="(p, i) in splitStage(scene.opening)" :key="'o' + i" :class="p.kind">{{ p.text }}</p>
          </div>
          <template v-for="(m, i) in messages" :key="i">
            <div v-if="m.role === 'user'" class="msg user"><p class="line">{{ m.content }}</p></div>
            <div v-else class="msg figure" :class="{ rec: m.offline }">
              <span class="m-who">{{ figure.name }}<em v-if="m.offline">档案录音</em></span>
              <p v-for="(p, j) in splitStage(m.content)" :key="j" :class="p.kind">{{ p.text }}</p>
              <span v-if="loading && i === messages.length - 1" class="cursor" aria-hidden="true"></span>
            </div>
          </template>
        </div>

        <p v-if="offline" class="offline">信号中断：{{ offlineReason || '后端没有接通' }}。你听到的是档案里的录音。</p>

        <div class="composer">
          <div v-if="suggestions.length" class="chips">
            <button v-for="q in suggestions" :key="q" type="button" class="chip" :disabled="loading" @click="send(q)">{{ q }}</button>
          </div>
          <form class="ask" @submit.prevent="submit">
            <label class="sr" for="talk-input">对{{ figure.name }}说</label>
            <input id="talk-input" v-model="input" class="ask-input" :placeholder="`对${figure.name}说点什么…`" :disabled="loading" maxlength="400" autocomplete="off" />
            <button type="submit" class="ask-send" :disabled="!input.trim() || loading">说</button>
          </form>
          <button v-if="messages.length" type="button" class="forget" @click="forgetScene">忘掉这次谈话</button>
        </div>
      </main>
    </div>
  </Teleport>
</template>

<style scoped>
.talk {
  position: fixed;
  inset: 0;
  z-index: 880;
  display: grid;
  grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr);
  background: var(--void);
  color: var(--bone);
  padding-top: env(safe-area-inset-top, 0px);
}
.side { display: flex; flex-direction: column; gap: 0.6rem; padding: 1.25rem; border-right: 1px solid var(--incision-soft); overflow-y: auto; }
.close { align-self: flex-start; padding: 0.4rem 0.9rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.close:hover { border-color: var(--weathered); }
.portrait { width: 100%; max-width: 12rem; aspect-ratio: 3 / 4; object-fit: cover; filter: grayscale(0.6) contrast(1.05); border: 1px solid var(--incision-soft); }
.who { margin: 0.25rem 0 0; font-family: var(--font-title); font-weight: 900; font-size: 1.5rem; letter-spacing: 0.1em; }
.role { margin: 0; font-size: 0.875rem; color: var(--weathered); }
.side-label { margin: 0.75rem 0 0; font-size: 0.75rem; letter-spacing: 0.12em; color: var(--weathered); }
.scenes { display: flex; flex-direction: column; gap: 0.4rem; }
.scene-opt { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.55rem 0.8rem; font: inherit; text-align: left; color: var(--bone); background: transparent; border: 1px solid var(--incision-soft); border-radius: var(--radius-cut); cursor: pointer; }
.scene-opt[aria-checked='true'] { background: var(--slab-raised); border-color: var(--era-archive); }
.so-era { font-size: 0.75rem; color: var(--weathered); }
.so-title { font-family: var(--font-serif); font-size: 1rem; }
.guard { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.guard li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8125rem; color: var(--weathered); }
.g-notch { flex: none; width: 1.75rem; height: 4px; background: var(--incision-soft); }
.guard li.on { color: var(--bone); }
.guard li.on .g-notch { background: var(--cherenkov); }
.guard-note { margin: 0.2rem 0 0; font-family: var(--font-serif); font-size: 0.875rem; line-height: 1.7; color: var(--gray-150); }
.heard { margin: 0; font-size: 0.8125rem; line-height: 1.7; color: var(--gray-150); }
.conn { margin-top: auto; padding-top: 1rem; font-size: 0.8125rem; color: var(--weathered); }
.conn summary { cursor: pointer; }
.conn p { line-height: 1.6; }
.c-row { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.5rem; }
.c-row:has(input[type='checkbox']) { flex-direction: row; align-items: center; gap: 0.4rem; }
.c-row input:not([type='checkbox']) { padding: 0.35rem 0.5rem; font: inherit; color: var(--bone); background: var(--slab); border: 1px solid var(--incision); border-radius: var(--radius-cut); }

.room { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.room-head { padding: 1.5rem clamp(1rem, 4vw, 3rem) 1rem; border-bottom: 1px solid var(--incision-soft); }
.rh-era { display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.5rem; font-family: var(--font-serif); font-size: 0.875rem; letter-spacing: 0.12em; color: var(--weathered); }
.rh-era span { width: 1.5rem; height: 1px; background: var(--weathered); }
.rh-title { margin: 0; font-family: var(--font-title); font-weight: 900; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: 0.08em; }
.rh-setting { margin: 0.6rem 0 0; max-width: 44rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }

.transcript { flex: 1; min-height: 0; overflow-y: auto; padding: 1.5rem clamp(1rem, 4vw, 3rem); display: flex; flex-direction: column; gap: 1.25rem; }
.msg { max-width: 40rem; }
.msg p { margin: 0; }
.msg.figure .line { font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--bone); }
.msg.figure .stage { margin: 0.15rem 0; font-family: var(--font-serif); font-style: italic; font-size: 0.9375rem; line-height: 1.8; color: var(--weathered); }
.m-who { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.75rem; letter-spacing: 0.12em; color: var(--era-archive); }
.m-who em { font-style: normal; color: var(--weathered); }
.msg.user { align-self: flex-end; padding: 0.6rem 0.9rem; background: var(--slab); border: 1px solid var(--incision-soft); border-radius: var(--radius-cut); }
.msg.user .line { font-size: 0.9375rem; line-height: 1.75; color: var(--gray-150); }
.cursor { display: inline-block; width: 0.5em; height: 1em; margin-left: 0.15em; vertical-align: -0.1em; background: var(--cherenkov); animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }

.offline { margin: 0 clamp(1rem, 4vw, 3rem) 0.5rem; padding-left: 0.75rem; border-left: 1px solid var(--c-amber); font-size: 0.8125rem; color: var(--weathered); }
.composer { padding: 0.75rem clamp(1rem, 4vw, 3rem) calc(1rem + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--incision-soft); display: flex; flex-direction: column; gap: 0.6rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.chip { padding: 0.35rem 0.75rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.chip:hover:not(:disabled) { border-color: var(--weathered); }
.chip:disabled { opacity: 0.5; cursor: default; }
.ask { display: flex; gap: 0.5rem; }
.ask-input { flex: 1; min-width: 0; padding: 0.65rem 0.9rem; font: inherit; font-size: 1rem; color: var(--bone); background: var(--slab); border: 1px solid var(--incision); border-radius: var(--radius-cut); }
.ask-input:focus { outline: 1px solid var(--cherenkov); outline-offset: 2px; }
.ask-send { padding: 0 1.25rem; font: inherit; color: var(--cherenkov); background: transparent; border: 1px solid var(--cherenkov); border-radius: var(--radius-cut); cursor: pointer; }
.ask-send:disabled { opacity: 0.4; cursor: default; }
.forget { align-self: flex-start; padding: 0; font: inherit; font-size: 0.8125rem; color: var(--weathered); background: none; border: 0; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.close:focus-visible, .scene-opt:focus-visible, .chip:focus-visible, .ask-send:focus-visible, .forget:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

@media (max-width: 860px) {
  .talk { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .side { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; max-height: 40vh; border-right: 0; border-bottom: 1px solid var(--incision-soft); padding: 0.75rem 1rem; }
  .portrait, .role, .conn { display: none; }
  .who { margin: 0; font-size: 1.25rem; }
  .side-label { width: 100%; margin: 0.25rem 0 0; }
  .scenes { flex-direction: row; flex-wrap: wrap; }
  .guard { flex-direction: row; flex-wrap: wrap; gap: 0.4rem 0.9rem; }
  .guard-note { width: 100%; }
  .room-head { padding: 1rem; }
  .rh-setting { font-size: 0.9375rem; }
}
@media (prefers-reduced-motion: reduce) {
  .cursor { animation: none; }
}
</style>
