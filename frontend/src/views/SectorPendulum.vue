<script setup lang="ts">
/**
 * Sector T：三体摆
 * 三颗恒星的真实混沌运动决定每一天是恒纪元、三日凌空还是严寒；
 * 你决定文明浸泡（发展）还是脱水（熬过去）。历法预测来自一个带误差的副本——越远越不准。
 * 物理见 sim/threeBody.ts，规则见 sim/pendulumGame.ts。
 */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import RoomWeather from '@/components/RoomWeather.vue'
import { sectorByPath } from '@/data/sectors'
import { advanceDay, classify, createSystem, flux, forecast, type Env, type System } from '@/sim/threeBody'
import { AGES, SWITCH_DAYS, ageOf, createCiv, liveDay, order, type CivState } from '@/sim/pendulumGame'

const question = sectorByPath('/sector-t')?.question
const ENV_NAME: Record<Env, string> = { stable: '恒纪元', heat: '三日凌空', cold: '严寒' }
const FORECAST_DAYS = 14

const seed = ref(Math.floor(Math.random() * 1e6))
const sys = shallowRef<System>(createSystem(seed.value))
const civ = ref<CivState>(createCiv())
const today = ref<Env>(classify(flux(sys.value)))
const prediction = ref<Env[]>(forecast(sys.value, FORECAST_DAYS, 0.1, 1))
const history = ref<Env[]>([])
const running = ref(false)
const speed = ref(1)
const trails: { x: number; y: number }[][] = [[], [], []]

const ageIndex = computed(() => AGES.indexOf(ageOf(civ.value.progress)))
const pendingText = computed(() => {
  const p = civ.value.pending
  if (!p) return ''
  return `${p.to ? '浸泡复苏' : '脱水'}还需 ${p.days} 天`
})

function nextDay() {
  advanceDay(sys.value)
  today.value = classify(flux(sys.value))
  civ.value = liveDay(civ.value, today.value)
  history.value = [...history.value.slice(-89), today.value]
  // 历法每天重算一次，误差也重新抽取：近处的预测稳定，远处的预测摇摆
  prediction.value = forecast(sys.value, FORECAST_DAYS, 0.1, civ.value.day + 1)
  if (civ.value.won) running.value = false
}

function setHydrated(h: boolean) {
  civ.value = order(civ.value, h)
}

function restart() {
  seed.value = Math.floor(Math.random() * 1e6)
  sys.value = createSystem(seed.value)
  civ.value = createCiv()
  today.value = classify(flux(sys.value))
  prediction.value = forecast(sys.value, FORECAST_DAYS, 0.1, 1)
  history.value = []
  trails.forEach((t) => (t.length = 0))
  running.value = false
}

/* ---------- 画布：俯视三体系统 ---------- */
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let last = 0
let acc = 0
const DAY_MS = 1100

function draw() {
  const c = canvasRef.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const dpr = window.devicePixelRatio || 1
  const W = c.width
  const H = c.height
  const scale = Math.min(W, H) / 9.5
  const X = (x: number) => W / 2 + x * scale
  const Y = (y: number) => H / 2 + y * scale
  ctx.fillStyle = '#121214'
  ctx.fillRect(0, 0, W, H)

  // 行星轨道
  ctx.strokeStyle = 'rgba(220, 214, 200, 0.14)'
  ctx.lineWidth = 1 * dpr
  ctx.setLineDash([3 * dpr, 5 * dpr])
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, 2 * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // 恒星轨迹与本体
  sys.value.suns.forEach((s, i) => {
    const tr = trails[i]
    ctx.strokeStyle = 'rgba(231, 180, 106, 0.22)'
    ctx.lineWidth = 1 * dpr
    ctx.beginPath()
    tr.forEach((p, k) => (k === 0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y))))
    ctx.stroke()
    const r = (5 + s.m * 4) * dpr
    const g = ctx.createRadialGradient(X(s.x), Y(s.y), 0, X(s.x), Y(s.y), r * 4)
    g.addColorStop(0, 'rgba(255, 236, 200, 1)')
    g.addColorStop(0.25, 'rgba(240, 170, 90, 0.9)')
    g.addColorStop(1, 'rgba(240, 170, 90, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(X(s.x), Y(s.y), r * 4, 0, Math.PI * 2)
    ctx.fill()
  })

  // 行星：光环颜色反映当天的纪元
  const p = sys.value.planet
  const halo = today.value === 'heat' ? 'rgba(240, 120, 60, 0.55)' : today.value === 'cold' ? 'rgba(170, 200, 255, 0.45)' : 'rgba(125, 184, 255, 0.5)'
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(X(p.x), Y(p.y), 9 * dpr, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#dcd6c8'
  ctx.beginPath()
  ctx.arc(X(p.x), Y(p.y), 4 * dpr, 0, Math.PI * 2)
  ctx.fill()
}

function loop(now: number) {
  const dt = last ? now - last : 0
  last = now
  if (running.value) {
    acc += dt * speed.value
    while (acc >= DAY_MS) {
      acc -= DAY_MS
      nextDay()
      sys.value.suns.forEach((s, i) => {
        trails[i].push({ x: s.x, y: s.y })
        if (trails[i].length > 160) trails[i].shift()
      })
    }
  }
  draw()
  raf = requestAnimationFrame(loop)
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = Math.max(1, c.clientWidth * dpr)
  c.height = Math.max(1, c.clientHeight * dpr)
}
let ro: ResizeObserver | undefined
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.code === 'Space') {
    e.preventDefault()
    const target = civ.value.pending ? civ.value.pending.to : civ.value.hydrated
    setHydrated(!target)
  }
}
onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  if (canvasRef.value) ro.observe(canvasRef.value)
  raf = requestAnimationFrame(loop)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
})

const targetHydrated = computed(() => (civ.value.pending ? civ.value.pending.to : civ.value.hydrated))
</script>

<template>
  <div class="sector-t">
    <RoomWeather :env="civ.day > 0 ? today : 'stable'" :dry="civ.day > 0 && !civ.hydrated" />
    <SectorHeader
      title="三体摆"
      subtitle="三颗太阳，一颗行星。没有任何历法能算准明天。"
      goal="文明从脱水状态开始。每天决定浸泡还是脱水：浸泡才会发展，但遇上乱纪元就会毁灭。切换需要两天。发展到信息时代即可。"
      accent="#e7b46a"
      :show-restart="civ.day > 0"
      restart-label="换一片星空"
      @restart="restart"
    />

    <Vitrine flush>
      <div class="board">
        <div class="sky">
          <canvas ref="canvasRef" class="sky-canvas" aria-label="三颗恒星与行星的俯视图"></canvas>
          <p class="sky-day">第 <span class="num">{{ civ.day }}</span> 天</p>
        </div>

        <div class="panel">
          <div class="today" :class="today">
            <span class="today-label">今天</span>
            <span class="today-env">{{ ENV_NAME[today] }}</span>
          </div>

          <div class="civ">
            <div class="civ-head">
              <span>第 <span class="num">{{ civ.civ }}</span> 号文明</span>
              <span class="civ-age">{{ ageOf(civ.progress) }}</span>
            </div>
            <ol class="ages" aria-label="文明进程">
              <li v-for="(a, i) in AGES" :key="a" :class="{ reached: i <= ageIndex }" :title="a"></li>
            </ol>
          </div>

          <div class="decide" role="group" aria-label="浸泡或脱水">
            <button type="button" :aria-pressed="targetHydrated" :class="{ on: targetHydrated }" @click="setHydrated(true)">
              浸泡<span>发展，但怕乱纪元</span>
            </button>
            <button type="button" :aria-pressed="!targetHydrated" :class="{ on: !targetHydrated }" @click="setHydrated(false)">
              脱水<span>熬过一切，时间白费</span>
            </button>
          </div>
          <p class="state">
            此刻{{ civ.hydrated ? '浸泡中' : '已脱水' }}<template v-if="pendingText">，{{ pendingText }}</template>。空格键切换。
          </p>

          <div class="forecast">
            <div class="forecast-head">
              <span>历法预测</span>
              <span class="muted">越远越不可信，每天都会重算</span>
            </div>
            <ol class="days">
              <li
                v-for="(e, i) in prediction"
                :key="i"
                :class="e"
                :style="{ opacity: 1 - i / (FORECAST_DAYS + 4) }"
                :title="`${i + 1} 天后：${ENV_NAME[e]}`"
              ></li>
            </ol>
            <div class="forecast-scale"><span>明天</span><span>两周后</span></div>
          </div>

          <div class="controls">
            <button type="button" class="plain-btn" :class="{ primary: civ.day === 0 && !running }" @click="running = !running">
              {{ running ? '暂停' : civ.day === 0 ? '开始第一天' : '继续' }}
            </button>
            <button type="button" class="plain-btn" @click="speed = speed === 1 ? 3 : 1">{{ speed === 1 ? '加速' : '正常速度' }}</button>
          </div>
        </div>
      </div>
    </Vitrine>

    <div class="below">
      <section class="record">
        <h2 class="section-title">过去 90 天</h2>
        <ol class="history" aria-label="过去的纪元">
          <li v-for="(e, i) in history" :key="i" :class="e"></li>
        </ol>
        <p class="legend"><span class="sw stable"></span>恒纪元<span class="sw heat"></span>三日凌空<span class="sw cold"></span>严寒</p>
      </section>

      <section class="fallen">
        <h2 class="section-title">毁灭的文明</h2>
        <p v-if="!civ.fallen.length" class="muted">还没有。</p>
        <ol v-else class="fallen-list">
          <li v-for="f in [...civ.fallen].reverse().slice(0, 8)" :key="f.civ">
            第 <span class="num">{{ f.civ }}</span> 号文明，发展到{{ f.age }}，毁于{{ ENV_NAME[f.cause] }}。
          </li>
        </ol>
      </section>
    </div>

    <transition name="fade">
      <div v-if="civ.won" class="won" role="dialog" aria-label="通关">
        <div class="won-box">
          <h2>第 {{ civ.civ }} 号文明进入了信息时代</h2>
          <p>在它之前，有 {{ civ.fallen.length }} 个文明毁于乱纪元。</p>
          <p>它终于算清楚了一件事：三颗太阳的运动没有解析解，任何历法都只是暂时的运气。它决定离开这里。</p>
          <p class="won-question">{{ question }}</p>
          <div class="won-actions">
            <button type="button" class="plain-btn" @click="restart">换一片星空</button>
            <RouterLink to="/sector-v" class="plain-btn">他们曾用三千万人去计算它</RouterLink>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.sector-t {
  --heat: #e8814f;
  --cold: #b9d0f5;
  --stable: var(--cherenkov);
  position: relative;
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  max-width: 78rem;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }

.board { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 1fr); }
.sky { position: relative; min-height: 26rem; border-right: 1px solid var(--incision-soft); }
.sky-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.sky-day { position: absolute; left: 1rem; top: 0.8rem; margin: 0; font-size: 0.875rem; color: var(--weathered); }
.sky-day .num { color: var(--bone); font-size: 1.125rem; }

.panel { display: flex; flex-direction: column; gap: 1.25rem; padding: 1.5rem; }
.today { display: flex; flex-direction: column; gap: 0.2rem; }
.today-label { font-size: 0.8125rem; color: var(--weathered); }
.today-env { font-family: var(--font-title); font-weight: 900; font-size: 2.25rem; letter-spacing: 0.1em; transition: color 0.4s; }
.today.stable .today-env { color: var(--bone); }
.today.heat .today-env { color: var(--heat); }
.today.cold .today-env { color: var(--cold); }

.civ-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.9375rem; color: var(--gray-200); }
.civ-age { font-family: var(--font-serif); color: var(--bone); }
.ages { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; list-style: none; margin: 0.5rem 0 0; padding: 0; }
.ages li { height: 6px; background: var(--incision-soft); }
.ages li.reached { background: #e7b46a; }

.decide { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.decide button {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1.125rem;
  text-align: left;
  color: var(--gray-200);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.decide button span { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--weathered); }
.decide button.on { color: var(--bone); border-color: var(--cherenkov); background: rgba(var(--cherenkov-rgb), 0.07); }
.state { margin: -0.6rem 0 0; font-size: 0.8125rem; color: var(--weathered); }

.forecast-head { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.875rem; margin-bottom: 0.5rem; }
.forecast-head .muted { font-size: 0.75rem; }
.days { display: grid; grid-template-columns: repeat(14, 1fr); gap: 2px; list-style: none; margin: 0; padding: 0; }
.days li { height: 22px; }
.days li.stable, .history li.stable, .sw.stable { background: rgba(var(--cherenkov-rgb), 0.55); }
.days li.heat, .history li.heat, .sw.heat { background: var(--heat); }
.days li.cold, .history li.cold, .sw.cold { background: var(--cold); }
.forecast-scale { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.75rem; color: var(--weathered); }

.controls { display: flex; gap: 0.5rem; margin-top: auto; }
.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }

.below { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
.section-title { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; letter-spacing: 0.08em; color: var(--bone); }
.history { display: flex; flex-wrap: wrap; gap: 2px; list-style: none; margin: 0; padding: 0; }
.history li { width: 8px; height: 18px; }
.legend { display: flex; align-items: center; gap: 0.4rem; margin: 0.6rem 0 0; font-size: 0.8125rem; color: var(--weathered); }
.sw { width: 10px; height: 10px; margin-left: 0.6rem; }
.sw:first-child { margin-left: 0; }
.fallen-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.fallen-list li { font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.7; color: var(--gray-200); }

.won {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(10, 10, 12, 0.86);
}
.won-box { max-width: 36rem; padding: 2rem; background: var(--slab); border: 1px solid var(--incision); }
.won-box h2 { margin: 0 0 1rem; font-family: var(--font-title); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.06em; color: var(--bone); }
.won-box p { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.won-question { margin-top: 1.25rem !important; padding-left: 1rem; border-left: 1px solid #e7b46a; color: var(--bone) !important; }
.won-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
.fade-enter-active { transition: opacity 0.8s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .board { grid-template-columns: 1fr; }
  .sky { min-height: 20rem; border-right: 0; border-bottom: 1px solid var(--incision-soft); }
  .below { grid-template-columns: 1fr; }
}
</style>
