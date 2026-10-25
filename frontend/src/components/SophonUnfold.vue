<script setup lang="ts">
/**
 * 智子：把一个质子展开。
 * 从中心向外拖：十一维的卷曲一层层舒展——一团打结的弦、一个越来越大的球、一张覆盖整个画面的膜。
 * 在二维时松手，工程师开始在膜上刻电路（覆盖到整个页面）；刻完以后按住，把它折叠回微观。
 * 拉过头就成了一维的弦，什么也做不了。松手时没到二维，它会缩回去。
 * 电路的走法见 sim/circuit.ts。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import HoldButton from '@/components/HoldButton.vue'
import { circuit, dimensionAt, distanceFor, type Seg } from '@/sim/circuit'

const emit = defineEmits<{ dim: [number]; done: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
type Stage = 'drag' | 'etch' | 'etched' | 'fold' | 'live'
const stage = ref<Stage>('drag')
const sweep = ref(false)
let d = 0
let target = 0
let dragging = false
let etch = 0
let fold = 0
let raf = 0
let last = 0
let W = 0
let H = 0
let dpr = 1
let segs: Seg[] = []
const CELL = 14

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.width = Math.floor(c.clientWidth * dpr)
  H = c.height = Math.floor(c.clientHeight * dpr)
  segs = circuit(Math.ceil(W / (CELL * dpr)), Math.ceil(H / (CELL * dpr)), 7, 2400)
}

function distFrom(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  const x = e.clientX - r.left - r.width / 2
  const y = e.clientY - r.top - r.height / 2
  return Math.hypot(x, y) / (Math.min(r.width, r.height) * 0.48)
}
function down(e: PointerEvent) {
  if (stage.value !== 'drag') return
  dragging = true
  canvas.value?.setPointerCapture(e.pointerId)
  target = distFrom(e)
}
function move(e: PointerEvent) {
  if (dragging) target = Math.min(1.25, distFrom(e))
}
function up() {
  if (!dragging) return
  dragging = false
  if (dimensionAt(d) === 2) {
    stage.value = 'etch'
    etch = 0
    sweep.value = true
    setTimeout(() => (sweep.value = false), 2600)
  } else target = 0
}
/** 键盘：↑ 展开一维，↓ 收回一维，Enter 在二维时开始刻电路 */
function key(e: KeyboardEvent) {
  if (stage.value !== 'drag') return
  const dim = dimensionAt(d)
  if (e.key === 'ArrowUp' && dim > 1) target = distanceFor(dim - 1)
  else if (e.key === 'ArrowDown' && dim < 11) target = distanceFor(dim + 1)
  else if (e.key === 'Enter' && dim === 2) {
    dragging = true
    up()
  } else return
  e.preventDefault()
}
function startFold() {
  stage.value = 'fold'
  fold = 0
}
function reset() {
  stage.value = 'drag'
  d = target = 0
  etch = fold = 0
}

function drawKnot(ctx: CanvasRenderingContext2D, t: number, k: number) {
  const cx = W / 2
  const cy = H / 2
  const R = (6 + k * 70) * dpr
  const loops = 3 + Math.round(k * 9)
  ctx.strokeStyle = 'rgba(125, 184, 255, 0.75)'
  ctx.lineWidth = 1 * dpr
  for (let i = 0; i < loops; i++) {
    ctx.beginPath()
    const ph = t * (0.6 + i * 0.07) + i
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
      const rr = R * (0.55 + 0.45 * Math.sin(a * (2 + (i % 3)) + ph))
      const x = cx + Math.cos(a + i) * rr
      const y = cy + Math.sin(a + i) * rr * (0.6 + 0.4 * Math.cos(ph))
      if (a === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}
function drawSphere(ctx: CanvasRenderingContext2D, t: number, R: number, wire: boolean) {
  const cx = W / 2
  const cy = H / 2
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.05, cx, cy, R)
  g.addColorStop(0, 'rgba(220, 230, 245, 0.35)')
  g.addColorStop(0.5, 'rgba(125, 184, 255, 0.10)')
  g.addColorStop(1, 'rgba(125, 184, 255, 0.02)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  if (!wire) return
  ctx.strokeStyle = 'rgba(125, 184, 255, 0.45)'
  ctx.lineWidth = 1 * dpr
  for (let i = 0; i < 7; i++) {
    const a = t * 0.5 + (i * Math.PI) / 7
    ctx.beginPath()
    ctx.ellipse(cx, cy, R, Math.abs(Math.cos(a)) * R, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}
function drawCircuit(ctx: CanvasRenderingContext2D, p: number) {
  const maxOrder = segs.reduce((a, s) => Math.max(a, s.order), 1)
  const lim = p * maxOrder
  const c = CELL * dpr
  ctx.strokeStyle = 'rgba(125, 184, 255, 0.75)'
  ctx.lineWidth = 1.1 * dpr
  ctx.beginPath()
  for (const s of segs) {
    if (s.order > lim) continue
    ctx.moveTo(s.x1 * c + c / 2, s.y1 * c + c / 2)
    ctx.lineTo(s.x2 * c + c / 2, s.y2 * c + c / 2)
  }
  ctx.stroke()
  ctx.fillStyle = 'rgba(232, 214, 180, 0.85)'
  for (const s of segs) {
    if (!s.pad || s.order > lim) continue
    ctx.fillRect(s.x2 * c + c / 2 - 2 * dpr, s.y2 * c + c / 2 - 2 * dpr, 4 * dpr, 4 * dpr)
  }
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  const t = now / 1000
  const ctx = canvas.value?.getContext('2d')
  if (!ctx || !W) {
    raf = requestAnimationFrame(frame)
    return
  }
  if (stage.value === 'drag') d += (target - d) * Math.min(1, dt * (dragging ? 10 : 3))
  const dim = stage.value === 'drag' ? dimensionAt(d) : 2
  emit('dim', stage.value === 'live' ? 11 : dim)

  ctx.fillStyle = '#0b0c0e'
  ctx.fillRect(0, 0, W, H)
  const minD = Math.min(W, H)

  if (stage.value === 'drag') {
    if (dim >= 7) drawKnot(ctx, t, Math.min(1, d / 0.47))
    else if (dim >= 4) drawSphere(ctx, t, minD * (0.06 + Math.max(0, (d - 0.47) / 0.37) * 0.3), true)
    else if (dim === 3) drawSphere(ctx, t, minD * (0.4 + Math.max(0, (d - 0.84) / 0.11) * 0.6), false)
    else if (dim === 2) {
      ctx.fillStyle = 'rgba(125, 184, 255, 0.06)'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(125, 184, 255, 0.12)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += CELL * dpr * 4) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += CELL * dpr * 4) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }
    } else {
      ctx.strokeStyle = 'rgba(125, 184, 255, 0.9)'
      ctx.lineWidth = 1 * dpr
      ctx.beginPath()
      ctx.moveTo(0, H / 2 + Math.sin(t * 9) * 2)
      ctx.lineTo(W, H / 2 - Math.sin(t * 9) * 2)
      ctx.stroke()
    }
  } else if (stage.value === 'etch' || stage.value === 'etched') {
    ctx.fillStyle = 'rgba(125, 184, 255, 0.06)'
    ctx.fillRect(0, 0, W, H)
    if (stage.value === 'etch') {
      etch = Math.min(1, etch + dt / 3.2)
      if (etch >= 1) stage.value = 'etched'
    }
    drawCircuit(ctx, etch)
  } else if (stage.value === 'fold') {
    fold = Math.min(1, fold + dt / 1.8)
    // 一折、再折：膜沿两个方向交替对折，越来越小
    const steps = 8
    const k = fold * steps
    const n = Math.floor(k)
    const frac = k - n
    const sx = Math.pow(0.5, Math.ceil(n / 2) + (n % 2 === 0 ? frac : 0))
    const sy = Math.pow(0.5, Math.floor(n / 2) + (n % 2 === 1 ? frac : 0))
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(Math.max(0.004, sx), Math.max(0.004, sy))
    ctx.translate(-W / 2, -H / 2)
    ctx.fillStyle = 'rgba(125, 184, 255, 0.12)'
    ctx.fillRect(0, 0, W, H)
    drawCircuit(ctx, 1)
    ctx.restore()
    if (fold >= 1) {
      stage.value = 'live'
      emit('done')
    }
  } else {
    const r = (2 + Math.sin(t * 3) * 1) * dpr
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r * 8)
    g.addColorStop(0, 'rgba(125, 184, 255, 0.9)')
    g.addColorStop(1, 'rgba(125, 184, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, r * 8, 0, Math.PI * 2)
    ctx.fill()
  }
  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  last = performance.now()
  raf = requestAnimationFrame(frame)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="unfold-box">
    <canvas
      ref="canvas"
      class="cv"
      :class="stage"
      tabindex="0"
      aria-label="展开智子：从中心向外拖动，或用上下方向键"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @keydown="key"
    ></canvas>
    <div class="acts">
      <span v-if="stage === 'drag'" class="hint">从中心向外拖，在二维时松手。</span>
      <span v-else-if="stage === 'etch'" class="hint">工程师正在膜上刻电路……</span>
      <HoldButton v-else-if="stage === 'etched'" :hold-ms="1600" @confirm="startFold">按住，把它折叠回去</HoldButton>
      <span v-else-if="stage === 'fold'" class="hint">折叠中。</span>
      <template v-else>
        <span class="hint">它又变回了一个质子。现在，它是一台计算机，也是一双眼睛。</span>
        <button type="button" class="again" @click="reset">再展开一次</button>
      </template>
    </div>
    <Teleport to="body">
      <div v-if="sweep" class="sweep" aria-hidden="true"></div>
    </Teleport>
  </div>
</template>

<style scoped>
.cv { display: block; width: 100%; height: 18rem; background: #0b0c0e; cursor: grab; touch-action: none; outline: none; }
.cv:focus-visible { box-shadow: 0 0 0 1px var(--cherenkov); }
.cv.drag:active { cursor: grabbing; }
.cv:not(.drag) { cursor: default; }
.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-top: 0.75rem; min-height: 2.5rem; }
.hint { font-size: 0.875rem; line-height: 1.6; color: var(--weathered); }
.again { padding: 0.35rem 0.85rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: 2px; cursor: pointer; }
/* 膜展开到整个行星的面积：一层网格扫过整个页面 */
.sweep {
  position: fixed;
  inset: 0;
  z-index: 880;
  pointer-events: none;
  background:
    repeating-linear-gradient(0deg, rgba(125, 184, 255, 0.16) 0 1px, transparent 1px 56px),
    repeating-linear-gradient(90deg, rgba(125, 184, 255, 0.16) 0 1px, transparent 1px 56px),
    rgba(125, 184, 255, 0.04);
  animation: sweep 2.6s ease-out forwards;
}
@keyframes sweep {
  0% { clip-path: circle(0% at 50% 50%); opacity: 1; }
  55% { clip-path: circle(80% at 50% 50%); opacity: 1; }
  100% { clip-path: circle(80% at 50% 50%); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sweep { display: none; }
}
</style>
