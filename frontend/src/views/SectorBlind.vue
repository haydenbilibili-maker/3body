<script setup lang="ts">
/**
 * Sector Blind：思想的盲区
 * 智子看得见一切说出口、写下来的东西，唯独看不见人脑里的念头——面壁计划就建立在这一点上。
 * 写下一个念头，选择说出口、写下来，还是只在心里想；左边是你，右边是智子传回三体世界的东西。
 * 换成三体人的头脑：思维透明，想到即说出，没有盲区。
 * 逻辑见 sim/blind.ts。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import { sectorByPath } from '@/data/sectors'
import { CHANNELS, record, sophonLine, tally, type Channel, type Mind, type Thought } from '@/sim/blind'

const question = sectorByPath('/sector-blind')?.question

const mind = ref<Mind>('human')
const channel = ref<Channel>('think')
const draft = ref('')
const thoughts = ref<{ t: Thought; mind: Mind; body: string }[]>([])
let nextId = 1

const SUGGEST = ['把舰队开往木星', '我不相信我们能赢', '真正的计划，是让他们以为我在骗他们']

const counts = computed(() => tally(thoughts.value.map((x) => x.t)))
const sophonLog = ref<HTMLElement | null>(null)

/* ---------- 智子看得见的身体：打字的节奏、手的移动 ---------- */
let keyTimes: number[] = []
function onType() {
  keyTimes.push(performance.now())
}
function cadence(): string {
  if (keyTimes.length < 3) return ''
  let longest = 0
  let at = 0
  for (let i = 1; i < keyTimes.length; i++) {
    const g = keyTimes[i] - keyTimes[i - 1]
    if (g > longest) {
      longest = g
      at = i
    }
  }
  const total = (keyTimes[keyTimes.length - 1] - keyTimes[0]) / 1000
  if (longest < 700) return `他打字很快，${total.toFixed(1)} 秒，没有犹豫。`
  return `他在第 ${at + 1} 个字之前停了 ${(longest / 1000).toFixed(1)} 秒。`
}
const trail = ref<{ x: number; y: number }[]>([])
let lastPt = 0
function onPointer(e: PointerEvent) {
  const now = performance.now()
  if (now - lastPt < 40) return
  lastPt = now
  trail.value = [...trail.value.slice(-160), { x: e.clientX / innerWidth, y: e.clientY / innerHeight }]
}
const trailPath = computed(() => trail.value.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(1)} ${(p.y * 60).toFixed(1)}`).join(' '))
onMounted(() => window.addEventListener('pointermove', onPointer))
onUnmounted(() => window.removeEventListener('pointermove', onPointer))

function submit(text = draft.value) {
  if (!text.trim()) return
  thoughts.value.push({ t: record(nextId++, text, channel.value, mind.value), mind: mind.value, body: cadence() })
  keyTimes = []
  draft.value = ''
  nextTick(() => sophonLog.value?.scrollTo({ top: sophonLog.value.scrollHeight }))
}

function setMind(m: Mind) {
  mind.value = m
}

const channelNote = computed(() => {
  if (mind.value === 'trisolaran') return '三体人用脑电波交流，思维对彼此完全透明：想到，就等于说出。'
  if (channel.value === 'think') return '智子看不见它。可也没有任何人知道，没有人能替你去做。'
  return '智子会在同一瞬间把它传回四光年外。'
})

function chLabel(c: Channel, m: Mind) {
  return m === 'trisolaran' ? '想到即说出' : (CHANNELS.find((x) => x.id === c)?.name ?? '')
}

function restart() {
  thoughts.value = []
  mind.value = 'human'
  channel.value = 'think'
}

/* ---------- 读者的档案 ---------- */
watch(
  () => thoughts.value.length,
  (n) => {
    if (n >= 3) recordAnswer('/sector-blind', `智子看见了 ${counts.value.seen} 个念头，只有自己知道 ${counts.value.hidden} 个`)
  },
)
</script>

<template>
  <div class="sector-blind">
    <SectorHeader
      title="盲区"
      subtitle="智子展开在地球的每一个角落，看得见每一张纸、听得见每一句话。只有一个地方它进不去：人的头脑。"
      goal="写下一个念头，选择说出口、写下来，或只在心里想。看看哪些会传回三体世界，哪些能被人照着去做。"
      :show-restart="thoughts.length > 0"
      restart-label="清空"
      @restart="restart"
    />

    <div class="mind-switch" role="group" aria-label="头脑">
      <button type="button" :class="{ on: mind === 'human' }" :aria-pressed="mind === 'human'" @click="setMind('human')">人类的头脑</button>
      <button type="button" :class="{ on: mind === 'trisolaran' }" :aria-pressed="mind === 'trisolaran'" @click="setMind('trisolaran')">三体人的头脑</button>
    </div>

    <div class="room">
      <Vitrine class="pane you">
        <h2 class="pane-title">你</h2>
        <ol class="log">
          <li v-if="!thoughts.length" class="empty">还什么都没有想。</li>
          <li v-for="x in thoughts" :key="x.t.id" :class="{ hidden: !x.t.seen }">
            <span class="ch">{{ chLabel(x.t.channel, x.mind) }}</span>
            <span class="txt">{{ x.t.text }}</span>
            <span v-if="!x.t.seen" class="only">只有你知道</span>
          </li>
        </ol>
        <form class="compose" @submit.prevent="submit()">
          <div class="channels" role="radiogroup" aria-label="怎样处理这个念头">
            <button
              v-for="c in CHANNELS"
              :key="c.id"
              type="button"
              role="radio"
              :aria-checked="channel === c.id"
              :class="{ on: channel === c.id }"
              :disabled="mind === 'trisolaran' && c.id === 'think'"
              @click="channel = c.id"
            >{{ c.name }}</button>
          </div>
          <div class="field">
            <input v-model="draft" maxlength="80" placeholder="写下一个念头" aria-label="念头" @input="onType" />
            <button type="submit" class="plain-btn primary" :disabled="!draft.trim()">好</button>
          </div>
          <p class="ch-note">{{ channelNote }}</p>
          <div v-if="!thoughts.length" class="suggest">
            <button v-for="s in SUGGEST" :key="s" type="button" class="chip" @click="submit(s)">{{ s }}</button>
          </div>
        </form>
      </Vitrine>

      <Vitrine class="pane sophon">
        <h2 class="pane-title">智子传回三体世界的</h2>
        <ol ref="sophonLog" class="log mono">
          <li v-if="!thoughts.length" class="empty">信道静默。</li>
          <li v-for="(x, i) in thoughts" :key="x.t.id" :class="{ wall: !x.t.seen }">
            <span class="stamp num">{{ String(i + 1).padStart(3, '0') }}</span>
            <span>{{ sophonLine(x.t, x.mind) }}<em v-if="x.body" class="body">{{ x.body }}</em></span>
          </li>
        </ol>
        <figure class="hand" aria-label="智子记录下的你的手的轨迹">
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
            <path :d="trailPath" />
            <circle v-if="trail.length" :cx="trail[trail.length - 1].x * 100" :cy="trail[trail.length - 1].y * 60" r="0.9" />
          </svg>
          <figcaption>它也看着你的手：这是你刚才在屏幕上移动的轨迹。它能记下你的一切动作，只是读不出你在想什么。</figcaption>
        </figure>
        <dl class="tally">
          <div><dt>智子看见</dt><dd class="num">{{ counts.seen }}</dd></div>
          <div><dt>只有你知道</dt><dd class="num">{{ counts.hidden }}</dd></div>
          <div><dt>能被人照着去做</dt><dd class="num">{{ counts.shared }}</dd></div>
        </dl>
      </Vitrine>
    </div>

    <transition name="fade">
      <section v-if="thoughts.length >= 3" class="reflect">
        <p>一个计划只要说出口，智子就知道了；只要不说出口，就没有人能执行它。面壁者被允许调动巨大的资源而不必解释，正是为了在这道缝隙里做事——用别人看得见的行动，去执行只有自己知道的计划。</p>
        <p>三体人没有这道缝隙。他们不会撒谎，也就很难理解谋略；在他们眼里，人类的头脑是整个宇宙里最可怕的东西之一。</p>
        <p>可盲区也是一座牢：面壁者不能向任何人证明自己，连最亲的人也无法知道他在想什么。</p>
        <p class="q">{{ question }}</p>
        <div class="actions">
          <RouterLink to="/sector-f" class="plain-btn">在缝隙里做事的人：面壁计划</RouterLink>
          <RouterLink to="/sector-a" class="plain-btn">看得见一切的东西：智子</RouterLink>
        </div>
      </section>
    </transition>
  </div>
</template>

<style scoped>
.sector-blind { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.mind-switch { display: inline-flex; margin-bottom: 1.25rem; border: 1px solid var(--incision); }
.mind-switch button {
  padding: 0.5rem 1.1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--weathered);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.mind-switch button + button { border-left: 1px solid var(--incision); }
.mind-switch button.on { color: var(--bone); background: var(--slab-raised); }

.room { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.25rem; align-items: stretch; }
.pane :deep(.vitrine-body) { height: 100%; display: flex; flex-direction: column; }
.pane-title { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; letter-spacing: 0.08em; color: var(--bone); }
.log { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 12rem; max-height: 22rem; overflow-y: auto; }
.log li { padding: 0.55rem 0; border-bottom: 1px solid var(--incision-soft); font-size: 0.9375rem; line-height: 1.7; color: var(--bone); }
.log .empty { color: var(--weathered); border: 0; }
.you .log li { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: baseline; }
.ch { font-size: 0.75rem; color: var(--weathered); min-width: 4.5rem; }
.txt { font-family: var(--font-serif); flex: 1; }
.you li.hidden .txt { color: #b9c4cf; }
.only { font-size: 0.75rem; color: var(--cherenkov); }
.mono li { display: flex; gap: 0.75rem; font-family: var(--font-mono); font-size: 0.8125rem; color: #b8c0c8; }
.mono li.wall { color: var(--weathered); font-style: italic; }
.stamp { color: var(--weathered); }

.compose { margin-top: 1rem; }
.channels { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.channels button, .chip {
  padding: 0.35rem 0.8rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.channels button.on { color: var(--bone); border-color: var(--bone); }
.channels button:disabled { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
.chip:hover { color: var(--bone); }
.field { display: flex; gap: 0.5rem; }
.field input {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0.8rem;
  font: inherit;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision);
  border-radius: 2px;
}
.field input:focus { outline: none; border-color: var(--cherenkov); }
.ch-note { margin: 0.6rem 0 0; font-size: 0.8125rem; line-height: 1.7; color: var(--weathered); }
.suggest { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }

.tally { display: flex; flex-wrap: wrap; gap: 1.75rem; margin: 1rem 0 0; padding-top: 0.75rem; border-top: 1px solid var(--incision-soft); }
.tally dt { font-size: 0.8125rem; color: var(--weathered); }
.tally dd { margin: 0.15rem 0 0; font-size: 1.375rem; color: var(--bone); }

.reflect { max-width: 44rem; margin-top: 2rem; }
.reflect p { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.reflect .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid var(--era-crisis); color: var(--bone); }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

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
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }
.fade-enter-active { transition: opacity 0.8s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .room { grid-template-columns: 1fr; }
}
.body { display: block; margin-top: 0.15rem; font-style: normal; font-size: 0.75rem; color: var(--weathered); }
.hand { margin: 1rem 0 0; }
.hand svg { display: block; width: 100%; height: 5.5rem; background: #0b0c0e; border: 1px solid var(--incision-soft); }
.hand path { fill: none; stroke: rgba(125, 184, 255, 0.55); stroke-width: 1; vector-effect: non-scaling-stroke; }
.hand circle { fill: var(--cherenkov); }
.hand figcaption { margin-top: 0.4rem; font-size: 0.75rem; line-height: 1.6; color: var(--weathered); }
</style>
