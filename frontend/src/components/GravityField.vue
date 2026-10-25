<script setup lang="ts">
/**
 * 首页背景：一个真实计算的三体系统。
 * 三颗恒星（暖色）与一颗行星（切伦科夫蓝），留下渐隐的轨迹。
 * 在页面任何地方按住一颗恒星可以拖动它，松手时按拖动的速度甩出去；双击空白处复位。
 * 每隔几帧把行星所处的纪元和恒星在屏幕上的位置报告给首页（用来点亮标题）。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { CLIMATE_TEXT, climate, createField, step, type Climate, type Field } from '@/sim/gravity'

const emit = defineEmits<{ sky: [{ kind: Climate; suns: { x: number; y: number; b: number }[] }] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let field: Field = createField()
let raf = 0
let W = 0
let H = 0
let dpr = 1
let scale = 100
let ox = 0
let oy = 0
let held = -1
let drag: { x: number; y: number; t: number; vx: number; vy: number } | null = null
let frame = 0
const reduce = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
})()

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.width = Math.floor(c.clientWidth * dpr)
  H = c.height = Math.floor(c.clientHeight * dpr)
  scale = Math.min(W, H) / 6.5
  ox = W * (W > H * 1.2 ? 0.64 : 0.5)
  oy = H * 0.46
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#0d0e10'
    ctx.fillRect(0, 0, W, H)
  }
}
const sx = (x: number) => ox + x * scale
const sy = (y: number) => oy + y * scale

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  // 渐隐：轨迹慢慢沉进黑暗里
  ctx.fillStyle = 'rgba(13, 14, 16, 0.06)'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < field.suns.length; i++) {
    const s = field.suns[i]
    const x = sx(s.x)
    const y = sy(s.y)
    const r = (i === held ? 34 : 26) * dpr
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255, 246, 224, 0.95)')
    g.addColorStop(0.25, 'rgba(232, 196, 131, 0.55)')
    g.addColorStop(1, 'rgba(232, 196, 131, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const p = field.planet
  ctx.fillStyle = 'rgba(125, 184, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(sx(p.x), sy(p.y), 2.2 * dpr, 0, Math.PI * 2)
  ctx.fill()
}

function loop() {
  const sub = reduce ? 1 : 4
  for (let i = 0; i < sub; i++) step(field, 0.004, held)
  draw()
  if (++frame % 6 === 0) {
    const c = canvas.value!.getBoundingClientRect()
    const fl = field.suns.map((s) => 1 / ((s.x - field.planet.x) ** 2 + (s.y - field.planet.y) ** 2 + 0.05))
    emit('sky', {
      kind: climate(field).kind,
      suns: field.suns.map((s, i) => ({ x: c.left + sx(s.x) / dpr, y: c.top + sy(s.y) / dpr, b: fl[i] })),
    })
  }
  raf = requestAnimationFrame(loop)
}

/* ---------- 抓住一颗恒星 ---------- */
function hit(e: PointerEvent): number {
  const c = canvas.value?.getBoundingClientRect()
  if (!c) return -1
  const px = (e.clientX - c.left) * dpr
  const py = (e.clientY - c.top) * dpr
  let best = -1
  let bd = 34 * dpr
  field.suns.forEach((s, i) => {
    const d = Math.hypot(sx(s.x) - px, sy(s.y) - py)
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}
function toWorld(e: PointerEvent) {
  const c = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - c.left) * dpr - ox) / scale, y: ((e.clientY - c.top) * dpr - oy) / scale }
}
function down(e: PointerEvent) {
  if (e.button !== 0) return
  const i = hit(e)
  if (i < 0) return
  e.preventDefault()
  held = i
  const w = toWorld(e)
  drag = { x: w.x, y: w.y, t: performance.now(), vx: 0, vy: 0 }
  document.body.style.cursor = 'grabbing'
}
function move(e: PointerEvent) {
  if (held < 0) {
    document.body.style.cursor = hit(e) >= 0 ? 'grab' : ''
    return
  }
  const w = toWorld(e)
  const now = performance.now()
  const dt = Math.max(1, now - drag!.t) / 1000
  drag = { x: w.x, y: w.y, t: now, vx: ((w.x - drag!.x) / dt) * 0.25, vy: ((w.y - drag!.y) / dt) * 0.25 }
  const s = field.suns[held]
  s.x = w.x
  s.y = w.y
}
function up() {
  if (held < 0) return
  const s = field.suns[held]
  s.vx = Math.max(-2, Math.min(2, drag?.vx ?? 0))
  s.vy = Math.max(-2, Math.min(2, drag?.vy ?? 0))
  held = -1
  drag = null
  document.body.style.cursor = ''
}
function dbl(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, button, input')) return
  field = createField()
  resize()
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('dblclick', dbl)
  raf = requestAnimationFrame(loop)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerdown', down)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', up)
  window.removeEventListener('dblclick', dbl)
  document.body.style.cursor = ''
})
defineExpose({ CLIMATE_TEXT })
</script>

<template>
  <canvas ref="canvas" class="gravity" aria-hidden="true"></canvas>
</template>

<style scoped>
.gravity { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
