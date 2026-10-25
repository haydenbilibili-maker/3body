<script setup lang="ts">
/**
 * Sector J：掩体纪元
 * 一 表决：掩体、黑域、光速飞船，人类只能选一条路
 * 二 太空城：人类要住进去的六座城，每种构型的外观、内景与自转重力（components/SpaceCityAtlas.vue）
 * 三 守影：太空城藏在巨行星的阴影里，摄动会把它们推出去；预警响起后八秒，太阳被击中
 * 四 真相：来的不是光粒——躲起来的人，躲开了他们以为的那种死亡
 * 逻辑见 sim/bunker.ts。（原先的三维城市与阴影模拟占用主线程过重，已改为二维沙盘。）
 */
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import SpaceCityAtlas from '@/components/SpaceCityAtlas.vue'
import { cityByName } from '@/sim/spaceCity'
import { sectorByPath } from '@/data/sectors'
import {
  MAX_FUEL,
  PLANS,
  correct,
  createBunker,
  inShadow,
  phase as phaseOf,
  shadowHalfAngle,
  tick,
  type BunkerState,
  type City,
  type Giant,
  type Plan,
} from '@/sim/bunker'

const question = sectorByPath('/sector-j')?.question

type Act = 'vote' | 'atlas' | 'hold' | 'struck' | 'truth'
const act = ref<Act>('vote')
const chosen = ref<Plan | null>(null)

const VOTE_NOTE: Record<Plan, string> = {
  bunker: '你和大多数人想的一样。联合国通过了掩体计划，人类开始在四颗巨行星背后建造太空城。',
  domain: '黑域需要把光速降到每秒十几公里，没有人知道怎么做到。表决之后，人类选择了掩体计划。',
  lightspeed: '光速飞船只能带走极少数人，而且曲率航迹会让太阳系更早暴露。舰队国际随后立法禁止研究光速飞船，人类选择了掩体计划。',
}

/* ---------- 守影 ---------- */
const seed = ref(Math.floor(Math.random() * 1e6))
const state = shallowRef<BunkerState>(createBunker(seed.value))
let raf = 0
let last = 0
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  state.value = tick(state.value, dt, seed.value)
  if (state.value.struck) {
    raf = 0
    act.value = 'struck'
    return
  }
  raf = requestAnimationFrame(loop)
}
function startHold() {
  cancelAnimationFrame(raf)
  seed.value = Math.floor(Math.random() * 1e6)
  state.value = createBunker(seed.value)
  act.value = 'hold'
  last = performance.now()
  raf = requestAnimationFrame(loop)
}
onUnmounted(() => cancelAnimationFrame(raf))

const ph = computed(() => phaseOf(state.value))
const countdown = computed(() => Math.max(0, state.value.strikeAt - state.value.t))
const survivors = computed(() => state.value.cities.filter((c) => c.alive).length)

function fix(c: City) {
  state.value = correct(state.value, c.id)
}

/* ---------- 画面几何 ---------- */
const giantOf = (c: City) => state.value.giants.find((g) => g.id === c.giant) as Giant
const gx = (g: Giant) => Math.cos(g.angle) * g.orbit
const gy = (g: Giant) => Math.sin(g.angle) * g.orbit
function cityXY(c: City) {
  const g = giantOf(c)
  const a = g.angle + c.offset
  const d = g.radius + 13
  return { x: gx(g) + Math.cos(a) * d, y: gy(g) + Math.sin(a) * d }
}
function shadowPath(g: Giant) {
  const h = shadowHalfAngle(g)
  const L = 70
  const x = gx(g)
  const y = gy(g)
  const p1 = [x + Math.cos(g.angle + h) * L, y + Math.sin(g.angle + h) * L]
  const p2 = [x + Math.cos(g.angle - h) * L, y + Math.sin(g.angle - h) * L]
  return `M${x},${y} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z`
}
const safe = (c: City) => inShadow(c, state.value.giants)
/** 离开阴影边缘还有多远（0–1，1 = 正中） */
function margin(c: City) {
  const h = shadowHalfAngle(giantOf(c))
  return Math.max(0, 1 - Math.abs(c.offset) / h)
}

function restart() {
  cancelAnimationFrame(raf)
  act.value = 'vote'
  chosen.value = null
}

/* ---------- 读者的档案 ---------- */
watch(act, (a) => {
  if (a === 'struck') recordAnswer('/sector-j', `投票给${PLANS.find((p) => p.id === chosen.value)?.name ?? '掩体计划'}；${survivors.value} 座太空城留在了阴影里`)
})
</script>

<template>
  <div class="sector-bunker">
    <Teleport to="body">
      <div v-if="act === 'struck'" class="sun-flash" aria-hidden="true"></div>
    </Teleport>
    <SectorHeader
      title="掩体"
      subtitle="广播纪元之后，太阳系的坐标已经暴露。人类有几十年时间，为一场不知何时到来的打击做准备。"
      goal="选一条生路；然后守住藏在巨行星阴影里的六座太空城，直到打击到来。"
      :show-restart="act !== 'vote'"
      restart-label="回到表决"
      @restart="restart"
    />

    <!-- 一 表决 -->
    <section v-if="act === 'vote'" class="vote">
      <p class="lede">人类知道打击会来，却不知道会是什么。三条路摆在面前，每一条都要放弃一些东西。</p>
      <div class="plans">
        <button
          v-for="p in PLANS"
          :key="p.id"
          type="button"
          class="plan"
          :class="{ on: chosen === p.id }"
          :aria-pressed="chosen === p.id"
          @click="chosen = p.id"
        >
          <span class="plan-name">{{ p.name }}</span>
          <span class="plan-desc">{{ p.desc }}</span>
          <span class="plan-cost">代价：{{ p.cost }}</span>
        </button>
      </div>
      <transition name="fade">
        <div v-if="chosen" class="vote-result">
          <p>{{ VOTE_NOTE[chosen] }}</p>
          <button type="button" class="plain-btn primary" @click="act = 'atlas'">看看人类要住进去的城市</button>
        </div>
      </transition>
    </section>

    <!-- 二 太空城 -->
    <section v-else-if="act === 'atlas'" class="atlas-act">
      <p class="lede">人类在木星、土星、天王星和海王星背后建起了六座太空城。它们靠自转产生重力：城越大，转得越慢。</p>
      <SpaceCityAtlas />
      <HoldButton :hold-ms="1600" @confirm="startHold">按住，把人类搬进阴影</HoldButton>
    </section>

    <!-- 三 守影 / 打击 -->
    <div v-else-if="act === 'hold' || act === 'struck'" class="hold">
      <Vitrine flush class="orrery-frame" :class="{ alert: ph === 'alert', struck: act === 'struck' }">
        <svg class="orrery" viewBox="-360 -360 720 720" role="img" aria-label="太阳系沙盘：四颗巨行星与它们阴影里的太空城">
          <defs>
            <radialGradient id="bk-sun">
              <stop offset="0" stop-color="#fff6e0" />
              <stop offset="0.4" stop-color="#e8c483" />
              <stop offset="1" stop-color="#e8c483" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle v-for="g in state.giants" :key="'o' + g.id" :r="g.orbit" class="orbit" />
          <circle class="sun" :r="act === 'struck' ? 360 : 42" fill="url(#bk-sun)" />
          <path v-for="g in state.giants" :key="'s' + g.id" :d="shadowPath(g)" class="shadow" />
          <g v-for="g in state.giants" :key="'g' + g.id">
            <circle :cx="gx(g)" :cy="gy(g)" :r="g.radius" class="giant" />
            <text :x="gx(g)" :y="gy(g) - g.radius - 8" class="g-label">{{ g.name }}</text>
          </g>
          <g
            v-for="c in state.cities"
            :key="c.id"
            class="city"
            :class="{ out: !safe(c), dead: act === 'struck' && !c.alive }"
            @click="fix(c)"
          >
            <circle :cx="cityXY(c).x" :cy="cityXY(c).y" r="14" class="hit" />
            <circle :cx="cityXY(c).x" :cy="cityXY(c).y" r="4.5" class="dot" />
          </g>
        </svg>
        <template #caption>
          <span v-if="act === 'struck'">太阳被击中了。阴影之外的一切，都在那一刻气化。</span>
          <span v-else-if="ph === 'alert'" class="alarm">光粒预警：距离打击 <b class="num">{{ countdown.toFixed(1) }}</b> 秒</span>
          <span v-else>轻点一座正在漂出阴影的城市，用推进剂把它推回去。</span>
        </template>
      </Vitrine>

      <aside class="panel">
        <p class="fuel">
          推进剂
          <span class="fuel-bar" aria-hidden="true"><span :style="{ width: (state.fuel / MAX_FUEL) * 100 + '%' }"></span></span>
          <span class="num">{{ Math.floor(state.fuel) }} / {{ MAX_FUEL }}</span>
        </p>
        <ul class="cities">
          <li v-for="c in state.cities" :key="c.id" :class="{ out: !safe(c), dead: act === 'struck' && !c.alive }">
            <span class="c-name">{{ c.name }}<small>{{ cityByName(c.name)?.type }}</small></span>
            <span class="c-margin" aria-hidden="true"><span :style="{ width: margin(c) * 100 + '%' }"></span></span>
            <button
              v-if="act === 'hold'"
              type="button"
              class="c-fix"
              :disabled="state.fuel < 1"
              @click="fix(c)"
            >校正</button>
            <span v-else class="c-fate">{{ c.alive ? '幸存' : '气化' }}</span>
          </li>
        </ul>
        <div v-if="act === 'struck'" class="verdict">
          <p>六座太空城，<span class="num">{{ survivors }}</span> 座留在了阴影里。</p>
          <p>你守住了人们以为会来的那种死亡。</p>
          <button type="button" class="plain-btn primary" @click="act = 'truth'">可是，来的是什么？</button>
        </div>
      </aside>
    </div>

    <!-- 四 真相 -->
    <Vitrine v-else class="truth">
      <div class="truth-body">
        <p>真正到来的不是光粒，而是一张小小的纸条：二向箔。</p>
        <p>它接触到太阳系的那一刻，三维空间开始向二维跌落。太阳、巨行星、藏在阴影里的城市，都被摊平成一幅没有厚度的画。阴影救不了任何人——阴影本身也是三维的。</p>
        <p>人类预备好了一种死亡，宇宙给了另一种。唯一能逃出去的是光速飞船，而那条路，是人类亲手禁止的。</p>
        <p class="q">{{ question }}</p>
        <div class="truth-actions">
          <RouterLink to="/sector-d" class="plain-btn">看那幅画：二向箔画廊</RouterLink>
          <RouterLink to="/sector-l" class="plain-btn">那条被禁止的路：曲率驱动</RouterLink>
          <button type="button" class="plain-btn" @click="startHold">再守一次</button>
          <button type="button" class="plain-btn" @click="act = 'atlas'">再看一次这些城市</button>
        </div>
      </div>
    </Vitrine>
  </div>
</template>

<style scoped>
.sector-bunker { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.lede { max-width: 42rem; margin: 0 0 1.5rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }

.plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.plan {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.25rem;
  text-align: left;
  font: inherit;
  color: var(--bone);
  background: var(--slab);
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.3s, background 0.3s;
}
.plan:hover { border-color: var(--weathered); }
.plan.on { border-color: #c9b48a; background: var(--slab-raised); }
.plan-name { font-family: var(--font-serif); font-weight: 900; font-size: 1.25rem; letter-spacing: 0.08em; }
.plan-desc { font-size: 0.9375rem; line-height: 1.75; color: var(--gray-150); }
.plan-cost { font-size: 0.875rem; line-height: 1.7; color: var(--weathered); }
.vote-result { max-width: 42rem; margin-top: 1.5rem; }
.vote-result p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--bone); }

.hold { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
.orrery { display: block; width: 100%; height: auto; max-height: 70vh; background: #0d0e10; }
.orbit { fill: none; stroke: var(--incision-soft); stroke-width: 1; }
.sun { transition: r 0.6s ease-out; }
.shadow { fill: rgba(0, 0, 0, 0.55); stroke: rgba(125, 184, 255, 0.18); stroke-width: 1; }
.giant { fill: #4a4740; stroke: #6b665b; }
.g-label { fill: var(--weathered); font-size: 13px; text-anchor: middle; font-family: var(--font-sans); }
.city { cursor: pointer; }
.city .hit { fill: transparent; }
.city .dot { fill: var(--cherenkov); transition: fill 0.3s; }
.city.out .dot { fill: var(--rust-bright); animation: blink 0.8s steps(2) infinite; }
.city.dead .dot { fill: #555; animation: none; }
@keyframes blink { 50% { opacity: 0.3; } }
.orrery-frame.alert { box-shadow: 0 0 0 1px var(--rust); }
.alarm { color: var(--rust-bright); }
.alarm b { font-weight: 400; font-size: 1.125rem; }

.panel { display: flex; flex-direction: column; gap: 1rem; }
.fuel { display: flex; align-items: center; gap: 0.75rem; margin: 0; font-size: 0.9375rem; color: var(--weathered); }
.fuel-bar { flex: 1; height: 4px; background: var(--incision-soft); }
.fuel-bar span { display: block; height: 100%; background: var(--cherenkov); transition: width 0.2s; }
.cities { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--incision-soft); }
.cities li { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--incision-soft); }
.c-name { width: 6rem; display: flex; flex-direction: column; font-family: var(--font-serif); color: var(--bone); }
.c-margin { flex: 1; height: 3px; background: var(--incision-soft); }
.c-margin span { display: block; height: 100%; background: var(--cherenkov); }
.cities li.out .c-margin span { background: var(--rust-bright); }
.c-name small { font-family: var(--font-sans); font-size: 0.75rem; color: var(--weathered); }
.atlas-act { display: flex; flex-direction: column; align-items: flex-start; }
.atlas-act .atlas { align-self: stretch; }
.cities li.dead .c-name { color: var(--weathered); text-decoration: line-through; }
.c-fix {
  padding: 0.25rem 0.7rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.c-fix:disabled { opacity: 0.4; cursor: not-allowed; }
.cities li.out .c-fix { border-color: var(--rust-bright); color: var(--rust-bright); }
.c-fate { font-size: 0.8125rem; color: var(--weathered); }
.verdict p { margin: 0 0 0.6rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.8; color: var(--bone); }

.truth-body { max-width: 42rem; }
.truth-body p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.truth-body .q { margin-top: 1.5rem; padding-left: 1rem; border-left: 1px solid var(--era-bunker); color: var(--bone); }
.truth-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }

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
.fade-enter-active { transition: opacity 0.8s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .plans { grid-template-columns: 1fr; }
  .hold { grid-template-columns: 1fr; }
}
/* 太阳被击中：整个屏幕先被白光吞没，再慢慢退成焦黄 */
.sun-flash {
  position: fixed;
  inset: 0;
  z-index: 880;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, #fffaf0, #ffd9a0 45%, #b0432f 100%);
  animation: sun-flash 3.2s ease-out forwards;
}
@keyframes sun-flash {
  0% { opacity: 0; }
  6% { opacity: 1; }
  30% { opacity: 0.85; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sun-flash { animation-duration: 0.6s; }
}
</style>
