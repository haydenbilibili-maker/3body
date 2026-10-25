<script setup lang="ts">
/**
 * 黑暗森林的前厅：一盏灯。
 * 移动鼠标（或在屏幕上拖动），灯光跟着走，照见星星和文明；灯光也让附近的猎人注意到你。
 * 空格键或按钮熄灯。远处偶尔有别的文明点亮自己的灯，你会看见它们怎样熄灭。
 * 逻辑见 sim/lamp.ts。
 */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { FLIGHT, RADIUS, createLamp, step, tally, type LampState } from '@/sim/lamp'

const canvas = ref<HTMLCanvasElement | null>(null)
const state = shallowRef<LampState>(createLamp(Math.floor(Math.random() * 1e6)))
const lampOn = ref(true)
const pointer = ref<{ x: number; y: number } | null>(null)
const flash = ref(0)
let raf = 0
let last = 0
let W = 0
let H = 0
let dpr = 1
let prevStrikes = 0

const counts = computed(() => tally(state.value))
const exposed = computed(() => Math.round(state.value.exposed))
const lamp = () => (lampOn.value && pointer.value ? pointer.value : null)

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.width = Math.floor(c.clientWidth * dpr)
  H = c.height = Math.floor(c.clientHeight * dpr)
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const s = state.value
  const L = lamp()
  ctx.fillStyle = '#060607'
  ctx.fillRect(0, 0, W, H)

  // 远处别人的灯
  for (const b of s.beacons) {
    const x = b.x * W
    const y = b.y * H
    if (!b.struck) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 40 * dpr)
      g.addColorStop(0, 'rgba(232, 196, 131, 0.55)')
      g.addColorStop(1, 'rgba(232, 196, 131, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, 40 * dpr, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const k = Math.max(0, b.life / 1.2)
      ctx.strokeStyle = `rgba(210, 85, 63, ${k})`
      ctx.lineWidth = 1.5 * dpr
      ctx.beginPath()
      ctx.moveTo(x - (1 - k) * 0 - W * 0.6 * k, y - H * 0.3 * k)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.fillStyle = `rgba(255, 240, 220, ${k * 0.8})`
      ctx.beginPath()
      ctx.arc(x, y, (1 - k) * 30 * dpr + 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 灯光
  if (L) {
    const lx = L.x * W
    const ly = L.y * H
    // 灯光的形状跟随画布比例（与逻辑里的距离一致）
    ctx.save()
    ctx.translate(lx, ly)
    ctx.scale(1, H / W)
    const R = RADIUS * W
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R)
    g.addColorStop(0, 'rgba(232, 214, 180, 0.18)')
    g.addColorStop(0.7, 'rgba(232, 214, 180, 0.06)')
    g.addColorStop(1, 'rgba(232, 214, 180, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  for (const p of s.points) {
    const x = p.x * W
    const y = p.y * H
    const inLight = L ? Math.hypot(p.x - L.x, p.y - L.y) < RADIUS : false
    if (!inLight && !p.seen) continue
    const a = inLight ? 1 : 0.18
    if (p.kind === 'star') {
      ctx.fillStyle = `rgba(220, 214, 200, ${0.8 * a})`
      ctx.fillRect(x, y, 1.6 * dpr, 1.6 * dpr)
    } else if (p.kind === 'civ') {
      ctx.fillStyle = `rgba(125, 184, 255, ${a})`
      ctx.beginPath()
      ctx.arc(x, y, 2.6 * dpr, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(125, 184, 255, ${0.4 * a})`
      ctx.beginPath()
      ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(176, 67, 47, ${0.9 * a})`
      ctx.beginPath()
      ctx.arc(x, y, 2.4 * dpr, 0, Math.PI * 2)
      ctx.fill()
      if (p.aware > 0.02) {
        ctx.strokeStyle = `rgba(210, 85, 63, ${0.3 + p.aware * 0.7})`
        ctx.lineWidth = 1 * dpr
        ctx.beginPath()
        ctx.arc(x, y, (4 + p.aware * 14) * dpr, -Math.PI / 2, -Math.PI / 2 + p.aware * Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  // 正在飞来的打击
  if (s.incoming !== null && pointer.value) {
    const h = s.points.reduce((a, b) => (b.kind === 'hunter' && b.aware >= (a?.aware ?? -1) ? b : a), null as null | (typeof s.points)[number])
    if (h) {
      const k = 1 - s.incoming / FLIGHT
      const tx = pointer.value.x * W
      const ty = pointer.value.y * H
      const x = h.x * W + (tx - h.x * W) * k
      const y = h.y * H + (ty - h.y * H) * k
      ctx.strokeStyle = 'rgba(255, 236, 214, 0.9)'
      ctx.lineWidth = 2 * dpr
      ctx.beginPath()
      ctx.moveTo(h.x * W + (tx - h.x * W) * Math.max(0, k - 0.15), h.y * H + (ty - h.y * H) * Math.max(0, k - 0.15))
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  if (flash.value > 0) {
    ctx.fillStyle = `rgba(255, 238, 220, ${flash.value})`
    ctx.fillRect(0, 0, W, H)
  }
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  state.value = step(state.value, dt, lamp())
  if (state.value.strikes > prevStrikes) {
    prevStrikes = state.value.strikes
    flash.value = 0.9
  }
  flash.value = Math.max(0, flash.value - dt * 1.2)
  draw()
  raf = requestAnimationFrame(loop)
}

function onMove(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  pointer.value = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
function onLeave() {
  pointer.value = null
}
function onKey(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  const el = document.activeElement
  if (el && /input|textarea/i.test(el.tagName)) return
  const r = canvas.value?.getBoundingClientRect()
  if (!r || r.bottom < 0 || r.top > window.innerHeight) return
  e.preventDefault()
  lampOn.value = !lampOn.value
}
function restart() {
  state.value = createLamp(Math.floor(Math.random() * 1e6))
  prevStrikes = 0
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKey)
  last = performance.now()
  raf = requestAnimationFrame(loop)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <section class="lamp" aria-label="黑暗森林的前厅：一盏灯">
    <canvas
      ref="canvas"
      class="cv"
      :class="{ off: !lampOn }"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="onLeave"
    ></canvas>
    <div class="hud">
      <span>看见的文明 <b class="num">{{ counts.civs }}</b></span>
      <span>看见的猎人 <b class="num">{{ counts.hunters }}</b></span>
      <span>亮着灯 <b class="num">{{ exposed }}</b> 秒</span>
      <span :class="{ hit: state.strikes }">被打击 <b class="num">{{ state.strikes }}</b> 次</span>
      <button type="button" class="toggle" :aria-pressed="!lampOn" @click="lampOn = !lampOn">{{ lampOn ? '熄灯（空格）' : '点灯（空格）' }}</button>
      <button v-if="state.strikes" type="button" class="toggle" @click="restart">换一片森林</button>
    </div>
    <p class="cap">移动鼠标，灯光跟着走。照见的东西会留在记忆里；红色的是猎人，圆弧越满，它越清楚你在哪里。远处偶尔有别人点灯——看看它们怎样熄灭。</p>
  </section>
</template>

<style scoped>
.lamp { margin: 0 0 2rem; }
.cv { display: block; width: 100%; height: min(62vh, 32rem); background: #060607; cursor: none; touch-action: none; border: 1px solid var(--incision-soft); }
.cv.off { cursor: crosshair; }
.hud { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.5rem; margin-top: 0.75rem; font-size: 0.875rem; color: var(--weathered); }
.hud b { font-weight: 400; color: var(--bone); font-family: var(--font-mono); }
.hud .hit b { color: var(--rust-bright); }
.toggle { margin-left: auto; padding: 0.35rem 0.9rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: 2px; cursor: pointer; }
.toggle + .toggle { margin-left: 0; }
.cap { margin: 0.5rem 0 0; font-size: 0.8125rem; line-height: 1.7; color: var(--weathered); }
</style>
