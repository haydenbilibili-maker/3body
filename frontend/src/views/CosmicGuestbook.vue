<script setup lang="ts">
/**
 * 宇宙留言簿
 * 写下你想对宇宙说的话，然后决定：把它发射出去，还是只留在留言簿里。
 * 发出去的信号以光速离开，永远追不回来；页面会一直告诉你它现在走到了哪里。
 * 在一座黑暗森林里，每一次发声也都是一次暴露。
 * 逻辑见 sim/signal.ts；留言只保存在本机浏览器里。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { ANCIENT, formatDistance, lightSeconds, whereIs, type Signal } from '@/sim/signal'

const question = sectorByPath('/sector-guestbook')?.question
const KEY = 'guestbook-signals-v2'

const mine = ref<Signal[]>([])
const draft = ref('')
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (Array.isArray(raw)) mine.value = raw
  } catch {
    mine.value = []
  }
  clock = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(clock))

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(mine.value.slice(0, 50)))
  } catch {
    /* 存储不可用时只保留在本次访问 */
  }
}
function add(send: boolean) {
  const text = draft.value.trim()
  if (!text) return
  mine.value = [{ id: Date.now(), text, sentAt: send ? Date.now() : null, by: '你' }, ...mine.value]
  draft.value = ''
  save()
}

const sent = computed(() => mine.value.filter((s) => s.sentAt !== null).length)
const silent = computed(() => mine.value.filter((s) => s.sentAt === null).length)
const all = computed(() => [...mine.value, ...ANCIENT])

function distance(s: Signal) {
  return s.sentAt === null ? 0 : lightSeconds(s.sentAt, now.value)
}
function place(s: Signal) {
  if (s.sentAt === null) return '没有发出。它只在这本留言簿里。'
  const w = whereIs(distance(s))
  if (!w.passed) return `正在离开地球，下一站：${w.next}`
  return w.next ? `已经越过${w.passed}，下一站：${w.next}` : `已经越过${w.passed}，还在往前走`
}
function when(s: Signal) {
  if (s.sentAt === null) return ''
  const d = new Date(s.sentAt)
  return s.id < 0 ? `${d.getUTCFullYear()} 年发出` : `${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 发出`
}

/* ---------- 读者的档案 ---------- */
watch(
  () => mine.value.length,
  (n) => {
    if (n) recordAnswer('/sector-guestbook', `向宇宙发出了 ${sent.value} 条信号，${silent.value} 条只留在留言簿里`)
  },
)
</script>

<template>
  <div class="guestbook">
    <SectorHeader
      title="宇宙留言簿"
      subtitle="人类曾经向宇宙发出过几次信号。它们至今还在路上，以光速离开，没有任何办法追回。"
      goal="写下你想对宇宙说的话，然后选择：按住把它发射出去，或者只留在这本留言簿里。"
      accent="#c9b48a"
    />

    <Vitrine class="compose">
      <label class="field">
        <span class="label">你想对宇宙说</span>
        <textarea v-model="draft" rows="3" maxlength="140" placeholder="写下一句话" aria-label="你想对宇宙说的话"></textarea>
      </label>
      <div class="actions">
        <HoldButton tone="rust" :hold-ms="2000" :disabled="!draft.trim()" @confirm="add(true)">按住，向宇宙发射</HoldButton>
        <button type="button" class="plain-btn" :disabled="!draft.trim()" @click="add(false)">只写在留言簿里</button>
      </div>
      <p class="warn">一旦发射，信号会带着地球的方位一直走下去。你没法知道谁会收到它，也没法收回。</p>
    </Vitrine>

    <ol class="signals" aria-label="信号">
      <li v-for="s in all" :key="s.id" class="sig" :class="{ silent: s.sentAt === null, ancient: s.id < 0 }">
        <p class="text">{{ s.text }}</p>
        <p class="by">{{ s.by }}<span v-if="when(s)"> · {{ when(s) }}</span></p>
        <p class="where">
          <b v-if="s.sentAt !== null" class="num">{{ formatDistance(distance(s)) }}</b>
          <span>{{ place(s) }}</span>
        </p>
      </li>
    </ol>

    <section v-if="mine.length" class="reflect">
      <p>你发出了 <span class="num">{{ sent }}</span> 条，留下了 <span class="num">{{ silent }}</span> 条没有发出。</p>
      <p v-if="sent">叶文洁的回答出发四十多年了，它早已越过三体世界，还在继续往前走。你的信号也会这样，一直走到比人类更久的地方。</p>
      <p v-else>你选择了沉默。在黑暗森林里，这也许是唯一安全的话。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <RouterLink to="/sector-r" class="plain-btn">第一次发声：红岸</RouterLink>
        <RouterLink to="/sector-e" class="plain-btn">为什么要沉默：黑暗森林</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.guestbook { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 56rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.field { display: block; }
.label { display: block; margin-bottom: 0.4rem; font-size: 0.9375rem; color: var(--weathered); }
textarea {
  width: 100%;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  line-height: 1.8;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision);
  border-radius: 2px;
  resize: vertical;
}
textarea:focus { outline: none; border-color: var(--cherenkov); }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
.warn { margin: 0.75rem 0 0; font-size: 0.875rem; line-height: 1.7; color: var(--weathered); }

.signals { list-style: none; margin: 2rem 0 0; padding: 0; border-left: 1px solid var(--incision); }
.sig { position: relative; padding: 0 0 1.5rem 1.25rem; }
.sig::before { content: ''; position: absolute; left: -4px; top: 0.6rem; width: 7px; height: 7px; background: var(--rust-bright); }
.sig.silent::before { background: transparent; border: 1px solid var(--weathered); }
.sig.ancient::before { background: #c9b48a; }
.text { margin: 0 0 0.3rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--bone); }
.by { margin: 0 0 0.3rem; font-size: 0.8125rem; color: var(--weathered); }
.where { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.75rem; margin: 0; font-size: 0.875rem; color: var(--gray-200); }
.where b { font-weight: 400; font-size: 1rem; color: var(--bone); }
.silent .text { color: var(--gray-200); }

.reflect { max-width: 42rem; margin-top: 1.5rem; }
.reflect p { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.reflect .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid #c9b48a; color: var(--bone); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }

.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn:disabled { opacity: 0.45; cursor: default; }
</style>
