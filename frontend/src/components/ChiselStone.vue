<script setup lang="ts">
/**
 * 文明墓碑：亲手刻字。
 * 石面上是留言的浅浅轮廓。在石头上按住来回磨（拖动），凿子一点一点把字刻进去，石屑往下落；
 * 字越大，每个字要磨得越久。按住空格也能刻。刻完全部的字，发出 done。
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ text: string; px: number }>()
const emit = defineEmits<{ done: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const pct = ref(0)
let W = 0
let H = 0
let dpr = 1
let raf = 0
let down = false
let spaceHeld = false
let last: { x: number; y: number } | null = null
let pointer = { x: 0, y: 0 }
let chars: { ch: string; x: number; y: number; w: number; p: number }[] = []
let cur = 0
const chips: { x: number; y: number; vx: number; vy: number; life: number }[] = []
let ac: AudioContext | null = null
let lastTick = 0

function layout() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.width = Math.floor(c.clientWidth * dpr)
  H = c.height = Math.floor(c.clientHeight * dpr)
  const ctx = c.getContext('2d')!
  const size = props.px * dpr
  ctx.font = `900 ${size}px "Noto Serif SC", serif`
  const lineH = size * 1.45
  const maxW = W * 0.84
  const rows: { ch: string; w: number }[][] = [[]]
  let rowW = 0
  for (const ch of Array.from(props.text)) {
    const w = ctx.measureText(ch).width + size * 0.08
    if (rowW + w > maxW && rows[rows.length - 1].length) {
      rows.push([])
      rowW = 0
    }
    rows[rows.length - 1].push({ ch, w })
    rowW += w
  }
  const prev = chars
  chars = []
  const top = H / 2 - ((rows.length - 1) * lineH) / 2
  rows.forEach((row, r) => {
    const total = row.reduce((a, b) => a + b.w, 0)
    let x = W / 2 - total / 2
    for (const c2 of row) {
      chars.push({ ch: c2.ch, x, y: top + r * lineH, w: c2.w, p: prev[chars.length]?.p ?? 0 })
      x += c2.w
    }
  })
}

function tick() {
  try {
    if (!ac) ac = new AudioContext()
    const now = ac.currentTime
    if (now - lastTick < 0.06) return
    lastTick = now
    const len = Math.floor(ac.sampleRate * 0.03)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4)
    const src = ac.createBufferSource()
    src.buffer = buf
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2200
    const g = ac.createGain()
    g.gain.value = 0.05
    src.connect(hp).connect(g).connect(ac.destination)
    src.start()
  } catch {
    /* 没有声音也能刻 */
  }
}

function carve(amount: number) {
  if (cur >= chars.length) return
  const need = props.px * 7
  chars[cur].p = Math.min(1, chars[cur].p + amount / need)
  for (let i = 0; i < 2; i++) {
    chips.push({ x: pointer.x, y: pointer.y, vx: (Math.random() - 0.5) * 3 * dpr, vy: -Math.random() * 2 * dpr, life: 1 })
  }
  if (chars[cur].p >= 1) cur++
  pct.value = chars.length ? Math.round((chars.reduce((a, c) => a + c.p, 0) / chars.length) * 100) : 0
  if (cur >= chars.length) emit('done')
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const g = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.7)
  g.addColorStop(0, '#34353a')
  g.addColorStop(1, '#222327')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const size = props.px * dpr
  ctx.font = `900 ${size}px "Noto Serif SC", serif`
  ctx.textBaseline = 'middle'
  for (const c of chars) {
    // 未刻的轮廓
    ctx.strokeStyle = 'rgba(220, 214, 200, 0.14)'
    ctx.lineWidth = Math.max(0.6, size / 60)
    ctx.strokeText(c.ch, c.x, c.y)
    if (c.p <= 0) continue
    ctx.save()
    ctx.beginPath()
    ctx.rect(c.x - 2, c.y - size, c.w * c.p + 2, size * 2)
    ctx.clip()
    // 刻痕：暗的槽，加一条下沿的高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)'
    ctx.fillText(c.ch, c.x, c.y + Math.max(1, size / 40))
    ctx.fillStyle = '#121315'
    ctx.fillText(c.ch, c.x, c.y)
    ctx.restore()
  }
  // 凿子的位置
  if (down || spaceHeld) {
    const c = chars[cur]
    if (c) {
      ctx.strokeStyle = 'rgba(232, 214, 180, 0.6)'
      ctx.lineWidth = 1 * dpr
      ctx.beginPath()
      ctx.moveTo(c.x + c.w * c.p, c.y - size * 0.6)
      ctx.lineTo(c.x + c.w * c.p, c.y + size * 0.6)
      ctx.stroke()
    }
  }
  for (let i = chips.length - 1; i >= 0; i--) {
    const p = chips[i]
    p.vy += 0.25 * dpr
    p.x += p.vx
    p.y += p.vy
    p.life -= 0.03
    if (p.life <= 0 || p.y > H) {
      chips.splice(i, 1)
      continue
    }
    ctx.fillStyle = `rgba(200, 195, 182, ${p.life})`
    ctx.fillRect(p.x, p.y, 2 * dpr, 2 * dpr)
  }
}

function loop() {
  if (spaceHeld) {
    const c = chars[cur]
    if (c) pointer = { x: c.x + c.w * c.p, y: c.y }
    carve(props.px * 0.35)
    tick()
  }
  draw()
  raf = requestAnimationFrame(loop)
}

function pos(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }
}
function pdown(e: PointerEvent) {
  down = true
  canvas.value?.setPointerCapture(e.pointerId)
  last = pos(e)
  pointer = last
}
function pmove(e: PointerEvent) {
  if (!down || !last) return
  const p = pos(e)
  const dist = Math.hypot(p.x - last.x, p.y - last.y) / dpr
  last = p
  pointer = p
  if (dist > 0.5) {
    carve(dist)
    tick()
  }
}
function pup() {
  down = false
  last = null
}
function key(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  e.preventDefault()
  spaceHeld = e.type === 'keydown'
}

onMounted(() => {
  layout()
  window.addEventListener('resize', layout)
  raf = requestAnimationFrame(loop)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', layout)
  ac?.close()
})
</script>

<template>
  <div class="chisel">
    <canvas
      ref="canvas"
      class="cv"
      tabindex="0"
      aria-label="在石头上来回拖动来刻字，或按住空格"
      @pointerdown="pdown"
      @pointermove="pmove"
      @pointerup="pup"
      @pointercancel="pup"
      @keydown="key"
      @keyup="key"
    ></canvas>
    <p class="bar"><span>已刻</span><span class="track" aria-hidden="true"><span :style="{ width: pct + '%' }"></span></span><b class="num">{{ pct }}%</b></p>
    <p class="hint">在石头上按住来回磨，一个字一个字地刻进去；也可以聚焦石面后按住空格。</p>
  </div>
</template>

<style scoped>
.cv { display: block; width: 100%; height: 18rem; cursor: crosshair; touch-action: none; outline: none; background: #26272a; }
.cv:focus-visible { box-shadow: 0 0 0 1px var(--cherenkov); }
.bar { display: flex; align-items: center; gap: 0.75rem; margin: 0.75rem 0 0; font-size: 0.875rem; color: var(--weathered); }
.track { flex: 1; height: 3px; background: var(--incision-soft); }
.track span { display: block; height: 100%; background: var(--bone); }
.bar b { font-weight: 400; color: var(--bone); font-family: var(--font-mono); }
.hint { margin: 0.4rem 0 0; font-size: 0.8125rem; color: var(--weathered); }
</style>
