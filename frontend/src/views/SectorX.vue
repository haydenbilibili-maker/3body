<script setup lang="ts">
/**
 * Sector X：归零者
 * 宇宙的质量被无数个小宇宙带走，大宇宙不再能坍缩重启。归零者用无数种语言向所有文明广播：归还质量。
 * 你是收到广播的文明之一。六轮广播，每一轮你都可以归还、留下一只漂流瓶再归还，或者再等等。
 * 你看得到总质量和谁已经归还，却永远看不到别人在想什么。
 * 逻辑见 sim/returners.ts。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import PageCosmos from '@/components/PageCosmos.vue'
import { sectorByPath } from '@/data/sectors'
import {
  ENDINGS,
  ROUNDS,
  TOLERANCE,
  YOU,
  createReturn,
  ending,
  nextRound,
  returnedMass,
  type ReturnState,
  type YourMove,
} from '@/sim/returners'

const question = sectorByPath('/sector-x')?.question

/* ---------- 广播 ---------- */
const LINES = [
  '归还质量。宇宙需要重新开始。',
  'Return the mass. The universe must begin again.',
  '回归运动声明：所有小宇宙，请归还你们带走的质量。',
  '我们知道你们在害怕。我们也是。',
]
const line = ref(0)
let lineTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  lineTimer = setInterval(() => (line.value = (line.value + 1) % LINES.length), 4200)
})
onUnmounted(() => clearInterval(lineTimer))

/* ---------- 质量 ---------- */
const state = ref<ReturnState>(createReturn(Math.floor(Math.random() * 1e6)))
const you = computed(() => state.value.civs.find((c) => c.id === YOU)!)
const others = computed(() => state.value.civs.filter((c) => c.id !== YOU))
const massPct = computed(() => returnedMass(state.value) * 100)
const finished = computed(() => state.value.round >= ROUNDS)
const end = computed(() => (finished.value ? ENDINGS[ending(state.value)] : null))
const lastNews = ref('')

function play(move: YourMove) {
  const othersBack = () => state.value.civs.filter((c) => c.id !== YOU && c.returned).length
  const before = othersBack()
  state.value = nextRound(state.value, move)
  const n = othersBack() - before
  lastNews.value =
    n > 0
      ? `第 ${state.value.round} 轮广播之后，又有 ${n} 个文明归还了质量。`
      : `第 ${state.value.round} 轮广播之后，没有新的文明归还。`
}
function restart() {
  state.value = createReturn(Math.floor(Math.random() * 1e6))
  lastNews.value = ''
}

/* ---------- 读者的档案 ---------- */
/* 质量回来了：整页坍缩成一个点，再重新膨胀 */
const cosmos = ref<InstanceType<typeof PageCosmos> | null>(null)
watch(finished, (f) => {
  if (!f) return
  if (ending(state.value) === 'restart') cosmos.value?.play('crunch')
  const mine = you.value.returned ? (you.value.bottle ? '归还了质量，留下一只漂流瓶' : '归还了全部质量') : '没有归还质量'
  recordAnswer('/sector-x', `${mine}；宇宙${end.value?.title === '重启' ? '重启了' : '没有重启'}`)
})
</script>

<template>
  <div class="sector-x">
    <PageCosmos ref="cosmos" />
    <SectorHeader
      title="归零者"
      subtitle="无数文明把质量带进了自己的小宇宙，躲开时间与战争。大宇宙因此少了太多质量，再也不能坍缩、重新开始。"
      goal="六轮广播。每一轮你都可以归还全部质量、留下一只漂流瓶再归还，或者再等等，看看别人怎么做。"
      accent="#d6d2c8"
      :show-restart="state.round > 0"
      restart-label="回到第一轮广播"
      @restart="restart"
    />

    <Vitrine class="broadcast" caption="归零者的广播，以无数种语言同时发出，覆盖整个宇宙。">
      <transition name="line" mode="out-in">
        <p :key="line" class="b-line">{{ LINES[line] }}</p>
      </transition>
    </Vitrine>

    <div class="field">
      <section class="mass" aria-label="宇宙质量">
        <div class="m-head">
          <span>已归还的质量</span>
          <b class="num">{{ massPct.toFixed(1) }}%</b>
        </div>
        <div class="m-bar" role="progressbar" :aria-valuenow="Math.round(massPct)" aria-valuemin="0" aria-valuemax="100">
          <span class="m-fill" :style="{ width: massPct + '%' }"></span>
          <span class="m-mark" :style="{ left: (1 - TOLERANCE) * 100 + '%' }" aria-hidden="true"></span>
        </div>
        <p class="m-note">要让宇宙重新开始，几乎每一份质量都必须回来。刻度线就是那条门槛。</p>

        <ul class="civs">
          <li class="civ you" :class="{ back: you.returned }">
            <span class="dot" aria-hidden="true"></span>你<em>{{ you.returned ? (you.bottle ? '已归还，留下了漂流瓶' : '已归还') : '还在小宇宙里' }}</em>
          </li>
          <li v-for="c in others" :key="c.id" class="civ" :class="{ back: c.returned }">
            <span class="dot" aria-hidden="true"></span>{{ c.name }}<em>{{ c.returned ? '已归还' : '沉默' }}</em>
          </li>
        </ul>
      </section>

      <section class="decide" aria-label="你的决定">
        <p class="round">第 <span class="num">{{ Math.min(state.round + 1, ROUNDS) }}</span> / {{ ROUNDS }} 轮广播</p>
        <p v-if="lastNews" class="news">{{ lastNews }}</p>

        <template v-if="!finished">
          <div v-if="!you.returned" class="moves">
            <HoldButton :hold-ms="2000" @confirm="play('all')">按住，归还全部质量</HoldButton>
            <HoldButton :hold-ms="2000" @confirm="play('bottle')">按住，归还，但留下一只漂流瓶</HoldButton>
            <button type="button" class="plain-btn" @click="play('wait')">再等一轮，看看别人</button>
            <p class="hint">漂流瓶只有几公斤：几行字，几张图，一点点来自旧宇宙的东西。</p>
          </div>
          <div v-else class="moves">
            <p class="hint">你已经回到了大宇宙。现在只能等待别人。</p>
            <button type="button" class="plain-btn primary" @click="play('wait')">听下一轮广播</button>
          </div>
        </template>

        <div v-else-if="end" class="end">
          <h2 class="end-title">{{ end.title }}</h2>
          <p>{{ end.text }}</p>
          <p class="book">在原著的结尾，程心和关一帆收到了这条广播。他们把 647 号小宇宙的质量还给了大宇宙，只留下一个五公斤的生态球，里面有一条鱼、一点水和阳光，作为一只漂流瓶。没有人知道，这五公斤会不会让宇宙差那么一点。</p>
          <p class="q">{{ question }}</p>
          <div class="links">
            <button type="button" class="plain-btn" @click="restart">再听一次广播</button>
            <RouterLink to="/sector-u" class="plain-btn">那个小宇宙：647 号</RouterLink>
            <RouterLink to="/sector-m" class="plain-btn">宇宙曾经的样子：田园时代</RouterLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sector-x { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.broadcast { margin-bottom: 2rem; }
.b-line { margin: 0; min-height: 3.5rem; display: flex; align-items: center; font-family: var(--font-serif); font-size: clamp(1.125rem, 2.4vw, 1.5rem); line-height: 1.7; color: #ece8de; letter-spacing: 0.04em; }
.line-enter-active, .line-leave-active { transition: opacity 0.9s, filter 0.9s; }
.line-enter-from, .line-leave-to { opacity: 0; filter: blur(4px); }

.field { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 2rem; align-items: start; }
.m-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.9375rem; color: var(--weathered); }
.m-head b { font-weight: 400; font-size: 1.5rem; color: var(--bone); }
.m-bar { position: relative; height: 6px; margin: 0.6rem 0; background: var(--incision-soft); }
.m-fill { position: absolute; inset: 0 auto 0 0; background: #d6d2c8; transition: width 1.2s ease-out; }
.m-mark { position: absolute; top: -5px; bottom: -5px; width: 1px; background: var(--cherenkov); }
.m-note { margin: 0 0 1.25rem; font-size: 0.875rem; line-height: 1.7; color: var(--weathered); }

.civs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1.5rem; }
.civ { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid var(--incision-soft); font-size: 0.9375rem; color: var(--weathered); }
.civ em { margin-left: auto; font-style: normal; font-size: 0.8125rem; color: var(--incision); }
.civ .dot { flex: none; width: 8px; height: 8px; border: 1px solid var(--weathered); border-radius: 50%; }
.civ.back { color: var(--bone); }
.civ.back em { color: var(--weathered); }
.civ.back .dot { background: #d6d2c8; border-color: #d6d2c8; }
.civ.you { color: var(--bone); font-weight: 600; }

.round { margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--weathered); }
.news { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.8; color: var(--bone); }
.moves { display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; }
.hint { margin: 0; font-size: 0.875rem; line-height: 1.7; color: var(--weathered); }

.end-title { margin: 0.5rem 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.end p { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.end .book { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.end .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid #d6d2c8; color: var(--bone); }
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
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }

@media (max-width: 900px) {
  .field { grid-template-columns: 1fr; }
  .civs { grid-template-columns: 1fr; }
}
</style>
