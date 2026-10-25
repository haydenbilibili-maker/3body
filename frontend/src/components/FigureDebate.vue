<script setup lang="ts">
/**
 * 对谈：两位人物在同一个问题上交锋，访客坐在中间。
 * 两轮，每轮 A 说、B 回应；两轮之间访客可以插一句话；最后判断谁说服了自己。
 * 数据见 data/figureDebates.ts；人物各用自己的场景提示词（backend/routers/chat.py）。
 */
import { computed, ref } from 'vue'
import { streamFigureChat } from '@/api/figureChat'
import { useLlmConfigStore } from '@/stores/llmConfig'
import { DEBATES, type Debate } from '@/data/figureDebates'
import { sceneById, splitStage } from '@/data/figureScenes'
import { recordAnswer } from '@/data/answers'

const llmConfig = useLlmConfigStore()
const debateId = ref(DEBATES[0].id)
const debate = computed<Debate>(() => DEBATES.find((d) => d.id === debateId.value)!)

type Line = { who: 'a' | 'b' | 'you'; text: string; offline?: boolean }
const lines = ref<Line[]>([])
const busy = ref(false)
const interject = ref('')
const verdict = ref<'a' | 'b' | 'none' | null>(null)
const turns = computed(() => lines.value.filter((l) => l.who !== 'you').length)
const nameOf = (who: 'a' | 'b') => debate.value[who].figure

function reset() {
  lines.value = []
  verdict.value = null
  interject.value = ''
}
function choose(id: string) {
  if (busy.value) return
  debateId.value = id
  reset()
}

async function speak(who: 'a' | 'b', message: string) {
  const d = debate.value
  const s = sceneById(d[who].scene)!
  const line: Line = { who, text: '' }
  lines.value = [...lines.value, line]
  let raw = ''
  let failed = false
  await streamFigureChat(
    {
      figure_name: d[who].figure,
      message,
      scene: { title: s.title, era: s.era, setting: s.setting, knows: s.knows, mood: s.mood },
      ...llmConfig.requestOverrides,
    },
    (chunk) => {
      raw += chunk
      if (raw.trimStart().startsWith('[')) return
      line.text = raw
      lines.value = [...lines.value]
    },
    () => {
      failed = true
    },
  )
  if (failed || !raw.trim() || raw.trimStart().startsWith('[智子]')) {
    const k = lines.value.filter((l) => l.who !== 'you').length - 1
    line.text = d.offline[Math.min(k, d.offline.length - 1)]
    line.offline = true
    lines.value = [...lines.value]
  }
}

/** 一轮：A 说，B 回应 */
async function round() {
  if (busy.value) return
  busy.value = true
  const d = debate.value
  const you = interject.value.trim()
  if (you) lines.value = [...lines.value, { who: 'you', text: you }]
  interject.value = ''
  const lastB = [...lines.value].reverse().find((l) => l.who === 'b')
  const toA = lastB
    ? `${d.b.figure}刚才说：「${lastB.text}」${you ? `访客插了一句：「${you}」` : ''}你怎么回应？两到四句。`
    : `访客请你和${d.b.figure}谈一谈：${d.topic}你先说。两到四句。`
  await speak('a', toA)
  const lastA = [...lines.value].reverse().find((l) => l.who === 'a')!
  await speak('b', `${d.a.figure}刚才说：「${lastA.text}」话题是：${d.topic}你怎么回应？两到四句。`)
  busy.value = false
}

function judge(v: 'a' | 'b' | 'none') {
  verdict.value = v
  const d = debate.value
  recordAnswer(
    '/sector-p',
    v === 'none' ? `在「${d.topic}」的对谈里，两个人都没有说服你` : `在「${d.topic}」的对谈里，${nameOf(v)}说服了你`,
  )
}
</script>

<template>
  <section class="debate" aria-labelledby="debate-title">
    <h2 id="debate-title" class="d-title">对谈</h2>
    <p class="d-lead">两个人，一个问题。你坐在中间，可以插话，最后由你判断谁说服了你。</p>
    <div class="topics" role="radiogroup" aria-label="对谈的问题">
      <button
        v-for="d in DEBATES"
        :key="d.id"
        type="button"
        role="radio"
        class="topic"
        :aria-checked="d.id === debateId"
        :disabled="busy"
        @click="choose(d.id)"
      >
        <span class="t-q">{{ d.topic }}</span>
        <span class="t-who">{{ d.a.figure }} · {{ d.b.figure }}</span>
      </button>
    </div>

    <div class="stage">
      <p class="opener">{{ debate.opener }}</p>
      <div class="seats" aria-hidden="true">
        <span class="seat a">{{ debate.a.figure }}</span>
        <span class="seat you">你</span>
        <span class="seat b">{{ debate.b.figure }}</span>
      </div>
      <ol class="lines" aria-live="polite">
        <li v-for="(l, i) in lines" :key="i" class="ln" :class="[l.who, { rec: l.offline }]">
          <span class="ln-who">{{ l.who === 'you' ? '你' : nameOf(l.who) }}<em v-if="l.offline">档案录音</em></span>
          <template v-if="l.who === 'you'"><p class="line">{{ l.text }}</p></template>
          <template v-else>
            <p v-for="(p, j) in splitStage(l.text || '……')" :key="j" :class="p.kind">{{ p.text }}</p>
          </template>
        </li>
      </ol>

      <div v-if="!verdict" class="controls">
        <template v-if="turns < 4">
          <form v-if="turns > 0" class="inter" @submit.prevent="round">
            <label class="sr" for="debate-input">插一句话</label>
            <input id="debate-input" v-model="interject" class="inter-input" placeholder="插一句话（可以不说）" maxlength="200" :disabled="busy" autocomplete="off" />
          </form>
          <button type="button" class="go" :disabled="busy" @click="round">{{ turns ? '请他们接着说' : '请他们开始' }}</button>
        </template>
        <div v-else class="judge" role="group" aria-label="谁说服了你">
          <p class="j-q">{{ debate.topic }}谁说服了你？</p>
          <button type="button" class="go" @click="judge('a')">{{ debate.a.figure }}</button>
          <button type="button" class="go" @click="judge('b')">{{ debate.b.figure }}</button>
          <button type="button" class="plain" @click="judge('none')">两个人都没有</button>
        </div>
      </div>
      <div v-else class="after">
        <p>{{ verdict === 'none' ? '你没有被任何一个人说服。这个问题，原著也没有给出答案。' : `你站到了${nameOf(verdict)}这一边。另一个人的话，你也许还会想起。` }}</p>
        <button type="button" class="plain" @click="reset">换一种问法，再听一次</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.debate { max-width: 52rem; }
.d-title { margin: 0 0 0.4rem; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.12em; color: var(--bone); }
.d-lead { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }
.topics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; margin-bottom: 1.25rem; }
.topic { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem 0.9rem; font: inherit; text-align: left; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.topic[aria-checked='true'] { background: var(--slab-raised); border-color: var(--era-archive); }
.topic:disabled { cursor: default; }
.t-q { font-family: var(--font-serif); font-size: 1rem; }
.t-who { font-size: 0.8125rem; color: var(--weathered); }

.stage { padding: 1.25rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.opener { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.8; color: var(--weathered); }
.seats { display: flex; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--incision); font-family: var(--font-serif); font-size: 0.875rem; color: var(--weathered); }
.seat.you { color: var(--cherenkov); }
.lines { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.ln { max-width: 80%; }
.ln.b { align-self: flex-end; text-align: right; }
.ln.you { align-self: center; text-align: center; max-width: 70%; }
.ln p { margin: 0; }
.ln-who { display: block; margin-bottom: 0.2rem; font-size: 0.75rem; letter-spacing: 0.1em; color: var(--era-archive); }
.ln-who em { margin-left: 0.4rem; font-style: normal; color: var(--weathered); }
.ln.you .ln-who { color: var(--cherenkov); }
.line { font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--bone); }
.ln.you .line { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--gray-150); }
.stage-text, .ln .stage { margin: 0.1rem 0; font-family: var(--font-serif); font-style: italic; font-size: 0.9375rem; color: var(--weathered); }

.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.inter { flex: 1 1 16rem; min-width: 0; }
.inter-input { width: 100%; padding: 0.6rem 0.8rem; font: inherit; color: var(--bone); background: var(--void); border: 1px solid var(--incision); border-radius: var(--radius-cut); }
.go { padding: 0.55rem 1.1rem; font: inherit; color: var(--cherenkov); background: transparent; border: 1px solid var(--cherenkov); border-radius: var(--radius-cut); cursor: pointer; }
.go:disabled { opacity: 0.4; cursor: default; }
.plain { padding: 0.55rem 1.1rem; font: inherit; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.judge { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.j-q { width: 100%; margin: 0 0 0.25rem; font-family: var(--font-serif); color: var(--bone); }
.after p { margin: 0 0 0.75rem; font-family: var(--font-serif); line-height: 1.85; color: var(--gray-150); }
.topic:focus-visible, .go:focus-visible, .plain:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 760px) {
  .topics { grid-template-columns: 1fr; }
  .ln { max-width: 100%; }
}
</style>
