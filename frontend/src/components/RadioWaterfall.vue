<script setup lang="ts">
/**
 * 红岸接收机：瀑布图。
 * 横轴是频率，纵轴是时间（新数据从上方流下）。噪声里藏着一条很弱的、断续的信号。
 * 拖动（或用 ← →）移动调谐线；戴上耳机能听到：越接近信号，噪声越小、那个断续的音越清楚。
 * 在信号上稳住一秒半，就锁定了。也可以让监听员代你调谐。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{ locked: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const tuner = ref(0.2)
const target = 0.37 + Math.random() * 0.4
const hold = ref(0)
const locked = ref(false)
const listening = ref(false)
const auto = ref(false)
let raf = 0
let last = 0
let t = 0
let W = 0
let H = 0
let dpr = 1
let dragging = false

const off = computed(() => Math.abs(tuner.value - target))
const quality = computed(() => Math.max(0, 1 - off.value / 0.06))

/* ---------- 声音（只在访客点开后才创建） ---------- */
let ac: AudioContext | null = null
let noiseGain: GainNode | null = null
let toneGain: GainNode | null = null
let osc: OscillatorNode | null = null
function listen() {
  if (listening.value) {
    ac?.close()
    ac = null
    listening.value = false
    return
  }
  try {
    ac = new AudioContext()
    const len = ac.sampleRate * 2
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const noise = ac.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 0.6
    noiseGain = ac.createGain()
    noiseGain.gain.value = 0.12
    noise.connect(bp).connect(noiseGain).connect(ac.destination)
    noise.start()
    osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 880
    toneGain = ac.createGain()
    toneGain.gain.value = 0
    osc.connect(toneGain).connect(ac.destination)
    osc.start()
    listening.value = true
  } catch {
    listening.value = false
  }
}
/** 信号是断续的：像一串有规律的脉冲 */
function pulseOn(time: number) {
  const pattern = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0]
  return pattern[Math.floor(time * 6) % pattern.length] === 1
}

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  W = c.width = Math.floor(c.clientWidth * dpr)
  H = c.height = Math.floor(c.clientHeight * dpr)
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#0a0b0c'
    ctx.fillRect(0, 0, W, H)
  }
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  t += dt
  const ctx = canvas.value?.getContext('2d')
  if (ctx && W) {
    // 整幅图下移一行，在顶部画新的一行
    const row = Math.max(1, Math.round(2 * dpr))
    ctx.drawImage(ctx.canvas, 0, 0, W, H - row, 0, row, W, H - row)
    const img = ctx.createImageData(W, row)
    const on = pulseOn(t)
    for (let x = 0; x < W; x++) {
      const f = x / W
      let v = Math.random() * 0.55 + Math.random() * Math.random() * 0.4
      // 地面干扰：几条固定的宽带
      v += Math.exp(-(((f - 0.12) / 0.01) ** 2)) * 0.25 + Math.exp(-(((f - 0.86) / 0.02) ** 2)) * 0.2
      if (on) v += Math.exp(-(((f - target) / 0.0045) ** 2)) * 0.55
      const c = Math.min(1, v)
      for (let y = 0; y < row; y++) {
        const i = (y * W + x) * 4
        img.data[i] = 20 + c * 150
        img.data[i + 1] = 22 + c * 120
        img.data[i + 2] = 26 + c * 90
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }
  if (auto.value && !locked.value) tuner.value += (target - tuner.value) * Math.min(1, dt * 1.8)
  if (!locked.value) {
    hold.value = off.value < 0.012 ? hold.value + dt : Math.max(0, hold.value - dt * 2)
    if (hold.value >= 1.5) {
      locked.value = true
      emit('locked')
    }
  }
  if (ac && noiseGain && toneGain) {
    const q = quality.value
    noiseGain.gain.setTargetAtTime(0.12 * (1 - q * 0.85), ac.currentTime, 0.05)
    toneGain.gain.setTargetAtTime(pulseOn(t) ? 0.08 * q * q : 0, ac.currentTime, 0.01)
  }
  raf = requestAnimationFrame(frame)
}

function setFromEvent(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  tuner.value = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
}
function down(e: PointerEvent) {
  if (locked.value) return
  dragging = true
  auto.value = false
  canvas.value?.setPointerCapture(e.pointerId)
  setFromEvent(e)
}
function move(e: PointerEvent) {
  if (dragging) setFromEvent(e)
}
function up() {
  dragging = false
}
function key(e: KeyboardEvent) {
  if (locked.value) return
  const step = e.shiftKey ? 0.002 : 0.01
  if (e.key === 'ArrowLeft') tuner.value = Math.max(0, tuner.value - step)
  else if (e.key === 'ArrowRight') tuner.value = Math.min(1, tuner.value + step)
  else return
  e.preventDefault()
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
  ac?.close()
})

const mhz = computed(() => (1400 + tuner.value * 60).toFixed(2))
</script>

<template>
  <div class="wf">
    <div
      class="screen"
      tabindex="0"
      role="slider"
      aria-label="接收频率"
      :aria-valuenow="Number(mhz)"
      aria-valuemin="1400"
      aria-valuemax="1460"
      @keydown="key"
    >
      <canvas ref="canvas" class="cv" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"></canvas>
      <span class="tuner" :class="{ near: quality > 0.4, locked }" :style="{ left: tuner * 100 + '%' }"></span>
      <span v-if="locked" class="lock">信号锁定</span>
    </div>
    <div class="row">
      <span class="freq"><b class="num">{{ mhz }}</b> 兆赫</span>
      <span class="meter" aria-hidden="true"><span :style="{ width: (locked ? 100 : Math.min(100, (hold / 1.5) * 100)) + '%' }"></span></span>
      <button type="button" class="btn" :aria-pressed="listening" @click="listen">{{ listening ? '摘下耳机' : '戴上耳机听' }}</button>
      <button v-if="!locked" type="button" class="btn" @click="auto = true">让监听员调谐</button>
    </div>
    <p class="hint">拖动调谐线，或聚焦后用 ← →（按住 Shift 微调）。那条断续的细线就是它。</p>
  </div>
</template>

<style scoped>
.screen { position: relative; outline: none; }
.screen:focus-visible { box-shadow: 0 0 0 1px var(--cherenkov); }
.cv { display: block; width: 100%; height: 16rem; background: #0a0b0c; cursor: ew-resize; touch-action: none; }
.tuner { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(210, 85, 63, 0.7); transform: translateX(-0.5px); pointer-events: none; }
.tuner::before { content: ''; position: absolute; top: 0; left: -10px; width: 21px; bottom: 0; background: rgba(210, 85, 63, 0.06); }
.tuner.near { background: #e8c483; }
.tuner.locked { background: var(--cherenkov); box-shadow: 0 0 12px rgba(var(--cherenkov-rgb), 0.8); }
.lock { position: absolute; top: 0.75rem; right: 0.75rem; padding: 0.2rem 0.6rem; font-size: 0.8125rem; color: var(--cherenkov); border: 1px solid rgba(var(--cherenkov-rgb), 0.6); background: rgba(10, 11, 12, 0.8); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; margin-top: 0.75rem; font-size: 0.875rem; color: var(--weathered); }
.freq b { font-weight: 400; font-size: 1.125rem; color: var(--bone); }
.meter { flex: 1; min-width: 6rem; height: 3px; background: var(--incision-soft); }
.meter span { display: block; height: 100%; background: var(--cherenkov); transition: width 0.1s; }
.btn { padding: 0.35rem 0.85rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: 2px; cursor: pointer; }
.hint { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--weathered); }
.num { font-family: var(--font-mono); }
</style>
