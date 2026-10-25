<script setup lang="ts">
/**
 * Sector L：曲率驱动
 * 序 云天明的童话：把肥皂抹在船尾，水的张力变了，纸船就自己往前走。
 * 航行：驾驶一艘曲率飞船。航迹里的光速会降下来——
 *   绕太阳一圈，航迹合拢成黑域（安全声明，也是牢笼）；
 *   一直往外飞，就离开了太阳系；
 *   航迹在远处拖得太长，就成了给猎人看的路标。
 * 逻辑见 sim/curvature.ts。
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import SlowLight from '@/components/SlowLight.vue'
import { sectorByPath } from '@/data/sectors'
import {
  BAND,
  ENDINGS,
  EXPOSE_LIMIT,
  FAR,
  H,
  MAX_SPEED,
  STAR,
  TRAIL_LIFE,
  W,
  contraction,
  coverage,
  createFlight,
  speedOf,
  step,
  type FlightState,
} from '@/sim/curvature'

const question = sectorByPath('/sector-l')?.question

/* ---------- 序：纸船 ---------- */
const soap = ref(false)
let soapTimer: ReturnType<typeof setTimeout> | undefined
function dropSoap() {
  soap.value = true
  clearTimeout(soapTimer)
  soapTimer = setTimeout(() => (soap.value = false), 3200)
}

/* ---------- 航行 ---------- */
const canvas = ref<HTMLCanvasElement | null>(null)
const flight = shallowRef<FlightState>(createFlight())
const flying = ref(false)
const ending = computed(() => flight.value.ending)
const keys = { up: false, left: false, right: false }
const pointer = { active: false, x: 0, y: 0 }
let raf = 0

function onKey(e: KeyboardEvent) {
  const down = e.type === 'keydown'
  const k = e.key.toLowerCase()
  if (k === 'w' || k === 'arrowup') keys.up = down
  else if (k === 'a' || k === 'arrowleft') keys.left = down
  else if (k === 'd' || k === 'arrowright') keys.right = down
  else return
  if (flying.value) e.preventDefault()
}
function toCanvas(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onPointerDown(e: PointerEvent) {
  if (!flying.value) return
  canvas.value?.setPointerCapture(e.pointerId)
  pointer.active = true
  Object.assign(pointer, toCanvas(e))
}
function onPointerMove(e: PointerEvent) {
  if (pointer.active) Object.assign(pointer, toCanvas(e))
}
function onPointerUp() {
  pointer.active = false
}

function input() {
  const s = flight.value.ship
  if (pointer.active) {
    let diff = Math.atan2(pointer.y - s.y, pointer.x - s.x) - s.angle
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    const dist = Math.hypot(pointer.x - s.x, pointer.y - s.y)
    return { turn: Math.max(-1, Math.min(1, diff * 3)), thrust: dist > 24 ? 1 : 0 }
  }
  return { turn: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), thrust: keys.up ? 1 : 0 }
}

function loop() {
  flight.value = step(flight.value, input())
  draw()
  if (flight.value.ending) {
    stop()
    return
  }
  raf = requestAnimationFrame(loop)
}
function ignite() {
  flight.value = createFlight()
  flying.value = true
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(loop)
}
function stop() {
  flying.value = false
  pointer.active = false
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKey)
  cancelAnimationFrame(raf)
}
onMounted(draw)
onUnmounted(() => {
  stop()
  clearTimeout(soapTimer)
})

/* ---------- 绘制 ---------- */
function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const st = flight.value
  ctx.fillStyle = '#0d0e10'
  ctx.fillRect(0, 0, W, H)

  // 包裹带
  ctx.setLineDash([2, 6])
  ctx.strokeStyle = 'rgba(154, 149, 136, 0.25)'
  for (const r of [BAND.inner, BAND.outer]) {
    ctx.beginPath()
    ctx.arc(STAR.x, STAR.y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(176, 67, 47, 0.25)'
  ctx.beginPath()
  ctx.arc(STAR.x, STAR.y, FAR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // 太阳
  const dim = st.ending === 'domain'
  const g = ctx.createRadialGradient(STAR.x, STAR.y, 0, STAR.x, STAR.y, 40)
  g.addColorStop(0, dim ? '#6b2a1f' : '#fff6e0')
  g.addColorStop(0.45, dim ? '#3a1712' : '#e8c483')
  g.addColorStop(1, 'rgba(232, 196, 131, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(STAR.x, STAR.y, 40, 0, Math.PI * 2)
  ctx.fill()

  // 航迹：低光速区，越老越淡；远处被看见的部分是锈红
  for (const p of st.trail) {
    const a = (1 - p.age / TRAIL_LIFE) * 0.55
    const far = Math.hypot(p.x - STAR.x, p.y - STAR.y) > FAR
    ctx.fillStyle = far ? `rgba(210, 85, 63, ${a})` : `rgba(125, 184, 255, ${a})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3 + (p.age / TRAIL_LIFE) * 9, 0, Math.PI * 2)
    ctx.fill()
  }

  // 飞船：沿航向收缩
  const s = st.ship
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate(s.angle)
  ctx.scale(contraction(s), 1)
  ctx.fillStyle = '#dcd6c8'
  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(-10, 7)
  ctx.lineTo(-6, 0)
  ctx.lineTo(-10, -7)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (dim) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, W, H)
  }
}

/* ---------- 读数（每帧随 flight 刷新） ---------- */
const speedPct = computed(() => Math.round((speedOf(flight.value.ship) / MAX_SPEED) * 100))
const wrapPct = computed(() => Math.round(coverage(flight.value.trail) * 100))
const seenPct = computed(() => Math.round((flight.value.exposure / EXPOSE_LIMIT) * 100))

/* ---------- 读者的档案 ---------- */
watch(ending, (e) => {
  if (e) recordAnswer('/sector-l', `曲率航行的结局：${ENDINGS[e].title}`)
})
</script>

<template>
  <div class="sector-curv">
    <SlowLight :active="ending === 'domain'" />
    <SectorHeader
      title="曲率驱动"
      subtitle="抹平身后的空间，船就会被前方的空间拉着走。这是唯一能接近光速的办法，也是人类曾经立法禁止的技术。"
      goal="驾驶曲率飞船。绕太阳一圈让航迹合拢，或者一直飞出去——但别让远处的航迹被看见。"
    />

    <section class="tale">
      <div class="tale-text">
        <p class="tale-quote">「把肥皂抹在船尾的水里，水的张力变了，船就自己往前走。」</p>
        <p class="tale-cite">云天明讲给程心的童话里，赫尔辛根默斯肯的纸船。程心后来才读懂：肥皂是曲率，水是空间。</p>
        <button type="button" class="plain-btn" :disabled="soap" @click="dropSoap">{{ soap ? '纸船在走' : '在船尾抹一点肥皂' }}</button>
      </div>
      <svg class="lake" viewBox="0 0 320 90" aria-hidden="true">
        <line x1="0" y1="62" x2="320" y2="62" class="water" />
        <g class="boat" :class="{ go: soap }">
          <path d="M0,52 L36,52 L30,60 L6,60 Z" class="hull" />
          <path d="M18,52 L18,22 L32,48 Z" class="sail" />
          <g v-if="soap" class="ripples">
            <ellipse cx="-4" cy="61" rx="6" ry="1.5" />
            <ellipse cx="-14" cy="61" rx="10" ry="2" />
            <ellipse cx="-28" cy="61" rx="14" ry="2.5" />
          </g>
        </g>
      </svg>
    </section>

    <div class="flight">
      <Vitrine flush class="flight-frame">
        <div class="stage">
          <canvas
            ref="canvas"
            :width="W"
            :height="H"
            class="cv"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          ></canvas>
          <div v-if="!flying && !ending" class="brief">
            <p>太阳周围的虚线是包裹带，航迹落在里面，才算在围住它。最外圈的锈红虚线之外，航迹会被远方看见。</p>
            <p class="muted">按住画面，飞船朝手指的方向飞；键盘用 W / ← / →。</p>
            <button type="button" class="plain-btn primary" @click="ignite">点火</button>
          </div>
        </div>
        <template #caption>
          <span class="read">速度 <b class="num">{{ speedPct }}%</b> 光速上限</span>
          <span class="read">航迹包裹太阳 <b class="num">{{ wrapPct }}%</b></span>
          <span class="read" :class="{ warn: seenPct > 60 }">被远方看见 <b class="num">{{ Math.min(100, seenPct) }}%</b></span>
        </template>
      </Vitrine>

      <transition name="fade">
        <aside v-if="ending" class="ending">
          <h2 class="end-title">{{ ENDINGS[ending].title }}</h2>
          <p v-for="l in ENDINGS[ending].lines" :key="l">{{ l }}</p>
          <p class="history">在原著里，人类最终选择了掩体计划，并立法禁止研究光速飞船：它只能带走少数人，航迹会暴露自己，而一个人人都想逃走的社会会先从内部瓦解。维德的星环集团违背了这条法律。很多年后，二向箔到来，能逃出去的只有光速飞船。</p>
          <p class="q">{{ question }}</p>
          <div class="end-actions">
            <button type="button" class="plain-btn primary" @click="ignite">再飞一次</button>
            <RouterLink to="/sector-j" class="plain-btn">人类选的那条路：掩体</RouterLink>
            <RouterLink to="/sector-human" class="plain-btn">离开的人：银河人类</RouterLink>
          </div>
        </aside>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.sector-curv { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }

.tale { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 20rem); gap: 2rem; align-items: center; margin-bottom: 2rem; }
.tale-quote { margin: 0 0 0.6rem; font-family: var(--font-serif); font-size: 1.1875rem; line-height: 1.8; color: var(--bone); }
.tale-cite { margin: 0 0 1rem; font-size: 0.9375rem; line-height: 1.75; color: var(--weathered); }
.lake { width: 100%; height: auto; overflow: visible; }
.water { stroke: var(--incision); stroke-width: 1; }
.hull { fill: var(--bone); }
.sail { fill: var(--gray-200); }
.ripples ellipse { fill: none; stroke: var(--cherenkov); stroke-width: 0.8; opacity: 0.6; }
.boat { transform: translateX(40px); transition: transform 3s cubic-bezier(0.3, 0, 0.2, 1); }
.boat.go { transform: translateX(270px); }

.flight { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
.stage { position: relative; }
.cv { display: block; width: 100%; height: auto; background: #0d0e10; touch-action: none; cursor: crosshair; }
.brief {
  position: absolute;
  inset: auto 1.25rem 1.25rem 1.25rem;
  max-width: 30rem;
  padding: 1rem 1.25rem;
  background: rgba(19, 20, 22, 0.88);
  border: 1px solid var(--incision);
}
.brief p { margin: 0 0 0.6rem; font-size: 0.9375rem; line-height: 1.75; color: var(--bone); }
.read { margin-right: 1.5rem; white-space: nowrap; }
.read b { font-weight: 400; color: var(--bone); }
.read.warn, .read.warn b { color: var(--rust-bright); }

.end-title { margin: 0 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.ending p { margin: 0 0 0.8rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.ending .history { font-family: var(--font-sans); font-size: 0.875rem; line-height: 1.8; color: var(--weathered); }
.ending .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid var(--cherenkov); color: var(--bone); }
.end-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

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
.plain-btn:disabled { opacity: 0.5; cursor: default; }
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }
.fade-enter-active { transition: opacity 0.8s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .tale, .flight { grid-template-columns: 1fr; }
  .brief { position: static; max-width: none; border-width: 1px 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .boat { transition: none; }
}
</style>
