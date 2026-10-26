<script setup lang="ts">
/**
 * 对话室：在一个具体的时刻与人物相遇。
 * - 时刻：人物在哪里、此刻知道什么；人物先开口
 * - 心防：三个话题，每碰到一个松一格；三格全开，人物会说出心里藏着的那件事
 * - 记忆：每个场景的谈话保存在本机，下次回来接着说
 * - 记得你：访客在相关展厅里的选择会告诉人物（data/figureMemory.ts）
 * - 说话的节奏：回答按说话的速度出现，遇到动作和句号会停一停
 * - 信物：把一样东西放在人物面前；对的信物直接打开一格心防
 * - 听他说：浏览器的中文语音读出台词（动作不读），每位人物音高不同；默认关闭
 * - 自由对话：不设时刻、没有心防，像在档案馆里随便聊；人物知道自己的一生
 * - 声音：按人物性别挑选系统里的男声或女声，找不到男声时把音高压低
 * - 告别：离开时一张小结：谈了几句、心防开了几格、他最后说了什么
 * - 没有后端时，用档案里的录音（预设问答与场景台词）兜底
 * 场景数据见 data/figureScenes.ts；人设提示词由后端按场景组织（backend/routers/chat.py）。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { streamFigureChat } from '@/api/figureChat'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { getDialogueSet, hasDialogue } from '@/data/figureDialogues'
import { TOKENS, openedKeys, scenesOf, splitStage, type FigureScene } from '@/data/figureScenes'
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
/** 自由对话：一个没有时间、没有心防的「场景」，人物知道自己的一生 */
const FREE = computed(() => `free-${props.figure.name}`)
const freeScene = computed<FigureScene>(() => {
  const set = hasDialogue(props.figure.name) ? getDialogueSet(props.figure.name) : null
  return {
    id: FREE.value,
    figure: props.figure.name,
    title: '自由对话',
    era: '时间之外',
    setting: '冥王星档案馆的一间空房间。没有具体的年份，也没有要完成的事。你可以问他一生里的任何事，或者只是随便聊聊。',
    knows: '',
    mood: '',
    opening: set?.intro || `（${props.figure.name}在你对面坐下。）你想聊什么？`,
    questions: set?.qa.map((x) => x.question) ?? [],
    secret: '',
    keys: [],
    offline: set?.qa.map((x) => x.answer) ?? ['（他想了一会儿。）这件事，我说不好。'],
  }
})
const sceneId = ref(scenes.value[0]?.id ?? FREE.value)
const isFree = computed(() => sceneId.value === FREE.value)
const scene = computed<FigureScene | undefined>(() =>
  isFree.value ? freeScene.value : scenes.value.find((s) => s.id === sceneId.value),
)

type Msg = { role: 'user' | 'figure'; content: string; offline?: boolean; token?: string }
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
const userLines = computed(() => messages.value.filter((m) => m.role === 'user' && !m.token).map((m) => m.content))
const tokensUsed = computed(() => messages.value.filter((m) => m.token).map((m) => m.token!))
const touched = computed(() => (scene.value && !isFree.value ? openedKeys(scene.value, userLines.value, tokensUsed.value) : new Set<string>()))
const open = computed(() => !!scene.value && !isFree.value && touched.value.size >= scene.value.keys.length)
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

async function send(text: string, tokenId?: string) {
  const s = scene.value
  const token = tokenId ? TOKENS.find((t) => t.id === tokenId) : undefined
  const q = token ? `（访客${token.act}。）你看到它，想说什么？` : text.trim()
  if (!s || !q || loading.value) return
  stopVoice()
  const before = messages.value
  const history = before
    .filter((m) => !m.offline)
    .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }))
  const list: Msg[] = [...before, token ? { role: 'user', content: `（你${token.act}。）`, token: token.id } : { role: 'user', content: q }]
  setMessages(list)
  input.value = ''
  scrollDown()

  // 这一句是否刚好打开了心防：打开后的这一轮，人物可以把藏着的事说出来
  const willOpen = !isFree.value && openedKeys(s, [...userLines.value], [...tokensUsed.value]).size >= s.keys.length
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
      history: [{ role: 'assistant' as const, content: s.opening }, ...history].slice(-16),
      // 自由对话不带场景：后端按人物的一生组织人设
      scene: isFree.value
        ? undefined
        : {
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
  const last = messages.value[messages.value.length - 1]
  if (last?.role === 'figure') speak(last.content)
}

/* ---------- 信物 ---------- */
const showTokens = ref(false)
const tokensLeft = computed(() => TOKENS.filter((t) => !tokensUsed.value.includes(t.id)))
function placeToken(id: string) {
  showTokens.value = false
  send('', id)
}

/* ---------- 听他说 ---------- */
const VOICE_KEY = 'figure-talk-voice'
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
const voiceOn = ref(false)
try {
  voiceOn.value = canSpeak && localStorage.getItem(VOICE_KEY) === '1'
} catch {
  /* 忽略 */
}
const PITCH: Record<string, number> = { 叶文洁: 0.95, 程心: 1.1, '智子 (仿生人)': 1.2, 云天明: 1.0, 罗辑: 0.95, 章北海: 0.85, '托马斯·维德': 0.8, 史强: 0.85, 汪淼: 1.0, 丁仪: 0.95 }
/** 女性人物；其余默认男声 */
const FEMALE = new Set(['叶文洁', '程心', '智子 (仿生人)', '智子', '艾AA', '杨冬', '庄颜', '大史的妻子', '关一帆的同伴'])
const isFemale = computed(() => FEMALE.has(props.figure.name) || /女|她/.test(props.figure.role ?? ''))
const MALE_HINT = /yunxi|yunyang|yunjian|yunhao|yunfeng|kangkang|liang|li-mu|zhiwei|male(?!\s*female)|男/i
const FEMALE_HINT = /xiaoxiao|xiaoyi|xiaohan|xiaomo|huihui|tingting|meijia|sinji|yaoyao|hanhan|yating|female|女/i
const voices = ref<SpeechSynthesisVoice[]>([])
function loadVoices() {
  if (canSpeak) voices.value = window.speechSynthesis.getVoices()
}
/** 按性别挑一副中文嗓子；找不到对应性别时返回 null，由音高来补 */
function pickVoice(female: boolean): { voice: SpeechSynthesisVoice | null; matched: boolean } {
  const zh = voices.value.filter((v) => v.lang.toLowerCase().startsWith('zh') || /chinese|中文|普通话/i.test(v.name))
  const mainland = (v: SpeechSynthesisVoice) => (/zh[-_]cn/i.test(v.lang) ? 0 : 1)
  const hint = female ? FEMALE_HINT : MALE_HINT
  const other = female ? MALE_HINT : FEMALE_HINT
  const hit = zh.filter((v) => hint.test(v.name) && !other.test(v.name)).sort((a, b) => mainland(a) - mainland(b))[0]
  if (hit) return { voice: hit, matched: true }
  // 名字看不出性别的嗓子：女声人物可以用，男声人物也用、但要压低音高
  const neutral = zh.filter((v) => !other.test(v.name)).sort((a, b) => mainland(a) - mainland(b))[0]
  return { voice: neutral ?? zh[0] ?? null, matched: false }
}
function stopVoice() {
  if (canSpeak) window.speechSynthesis.cancel()
}
function speak(text: string) {
  if (!canSpeak || !voiceOn.value) return
  const words = splitStage(text).filter((p) => p.kind === 'line').map((p) => p.text).join('')
  if (!words.trim()) return
  stopVoice()
  const u = new SpeechSynthesisUtterance(words)
  u.lang = 'zh-CN'
  if (!voices.value.length) loadVoices()
  const female = isFemale.value
  const { voice, matched } = pickVoice(female)
  if (voice) u.voice = voice
  const base = PITCH[props.figure.name] ?? (female ? 1.05 : 0.9)
  // 系统里只有女声时，男性人物把音高压到最低一档，至少听起来不像女人在说话
  u.pitch = !female && !matched ? Math.min(base, 0.55) : base
  u.rate = female ? 0.95 : 0.9
  window.speechSynthesis.speak(u)
}
function toggleVoice() {
  voiceOn.value = !voiceOn.value
  try {
    localStorage.setItem(VOICE_KEY, voiceOn.value ? '1' : '0')
  } catch {
    /* 忽略 */
  }
  if (voiceOn.value) speak(lastReply.value || scene.value?.opening || '')
  else stopVoice()
}

/* ---------- 告别 ---------- */
const farewell = ref(false)
const rounds = computed(() => messages.value.filter((m) => m.role === 'user').length)
function leave() {
  if (rounds.value > 0 && !farewell.value) {
    farewell.value = true
    return
  }
  stopVoice()
  emit('close')
}
const lastWords = computed(() => {
  const words = splitStage(lastReply.value || scene.value?.opening || '').filter((p) => p.kind === 'line')
  return words.map((p) => p.text).join('').slice(0, 80)
})

function submit() {
  send(input.value)
}
function forgetScene() {
  setMessages([])
}

watch(sceneId, scrollDown)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') leave()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (canSpeak) {
    loadVoices()
    // 部分浏览器的嗓子列表是异步加载的
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
  }
  scrollDown()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (canSpeak) window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices)
  stopVoice()
})
</script>

<template>
  <Teleport to="body">
    <div class="talk" role="dialog" aria-modal="true" :aria-label="`与${figure.name}对话`">
      <aside class="side">
        <button type="button" class="close" @click="leave">离开对话室</button>
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
          <button type="button" role="radio" class="scene-opt free" :aria-checked="isFree" @click="sceneId = FREE">
            <span class="so-era">不在任何一个时刻</span>
            <span class="so-title">自由对话</span>
          </button>
        </div>

        <p v-if="isFree" class="guard-note">没有心防，也没有要打开的秘密。他知道自己的一生，你想问什么都可以。</p>
        <template v-if="scene && !isFree">
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

        <button v-if="canSpeak" type="button" class="voice" :aria-pressed="voiceOn" @click="toggleVoice">
          {{ voiceOn ? '听他说：开' : '听他说：关' }}
        </button>

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
          <div v-if="showTokens" class="tokens" role="group" aria-label="放下一样东西">
            <button v-for="t in tokensLeft" :key="t.id" type="button" class="token" :disabled="loading" @click="placeToken(t.id)">{{ t.name }}</button>
            <span v-if="!tokensLeft.length" class="token-none">能放下的东西都已经放下了。</span>
          </div>
          <form class="ask" @submit.prevent="submit">
            <button type="button" class="ask-token" :aria-expanded="showTokens" :disabled="loading" @click="showTokens = !showTokens">放下一样东西</button>
            <label class="sr" for="talk-input">对{{ figure.name }}说</label>
            <input id="talk-input" v-model="input" class="ask-input" :placeholder="`对${figure.name}说点什么…`" :disabled="loading" maxlength="400" autocomplete="off" />
            <button type="submit" class="ask-send" :disabled="!input.trim() || loading">说</button>
          </form>
          <button v-if="messages.length" type="button" class="forget" @click="forgetScene">忘掉这次谈话</button>
        </div>
      </main>

      <div v-if="farewell && scene" class="farewell" role="alertdialog" aria-labelledby="fw-title">
        <div class="fw-card">
          <p class="fw-era">{{ scene.era }} · {{ scene.title }}</p>
          <h2 id="fw-title" class="fw-title">你和{{ figure.name }}谈了 {{ rounds }} 句</h2>
          <p v-if="isFree" class="fw-guard">没有时刻，也没有心防。只是聊了聊。</p>
          <p v-else class="fw-guard">心防开了 {{ touched.size }} / {{ scene.keys.length }} 格{{ sceneRevealed ? '，他对你说出了心里藏着的事。' : '。' }}</p>
          <p class="fw-last">他最后说：「{{ lastWords }}」</p>
          <div class="fw-acts">
            <button type="button" class="ask-send" @click="farewell = false">再坐一会儿</button>
            <button type="button" class="close" @click="leave">离开</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.talk {
  position: fixed;
  inset: 0;
  /* 盖在人物档案弹窗（naive-ui 的模态层从 2000 起）之上；离开对话室后回到档案 */
  z-index: 3000;
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
.scene-opt.free { border-style: dashed; }
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
.voice { align-self: flex-start; margin-top: 0.75rem; padding: 0.35rem 0.8rem; font: inherit; font-size: 0.8125rem; color: var(--weathered); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.voice[aria-pressed='true'] { color: var(--cherenkov); border-color: var(--cherenkov); }
.tokens { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.6rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.token { padding: 0.35rem 0.75rem; font: inherit; font-family: var(--font-serif); font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px dashed var(--weathered); border-radius: var(--radius-cut); cursor: pointer; }
.token:hover:not(:disabled) { border-style: solid; }
.token-none { font-size: 0.8125rem; color: var(--weathered); }
.ask-token { flex: none; padding: 0 0.8rem; font: inherit; font-size: 0.8125rem; color: var(--weathered); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.ask-token[aria-expanded='true'] { color: var(--bone); border-color: var(--weathered); }
.farewell { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(10, 10, 11, 0.82); }
.fw-card { width: min(28rem, 100%); padding: 1.5rem; background: var(--slab); border: 1px solid var(--incision); display: flex; flex-direction: column; gap: 0.6rem; }
.fw-era { margin: 0; font-family: var(--font-serif); font-size: 0.8125rem; letter-spacing: 0.12em; color: var(--weathered); }
.fw-title { margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.08em; color: var(--bone); }
.fw-guard { margin: 0; font-size: 0.9375rem; color: var(--gray-150); }
.fw-last { margin: 0; padding-left: 0.9rem; border-left: 1px solid var(--era-archive); font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--bone); }
.fw-acts { display: flex; gap: 0.6rem; margin-top: 0.5rem; }
.fw-acts .ask-send { padding: 0.45rem 1rem; }
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
