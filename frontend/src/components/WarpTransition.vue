<script setup lang="ts">
/**
 * 深时跃迁：在展厅之间穿行时，画面沿时间轴跃迁。
 * - 去往更晚的纪元：星光向外拉长（向未来）；去往更早的纪元：星光向内收拢（时间倒流）
 * - 中央滚过途经的纪元名，停在目的地
 * - 同一纪元内只做一次很短的闪光；首次进入、「减少动态」时不播放
 * 纯 Canvas 2D，约 1.1 秒，不拦截点击。
 */
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ERAS, sectorByPath } from '@/data/sectors'

const route = useRoute()
const canvas = ref<HTMLCanvasElement | null>(null)
const active = ref(false)
const label = ref('')
const passing = ref<string[]>([])
const dir = ref(1)
let raf = 0
let first = true

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function eraIndexOf(path: string): number {
  const s = sectorByPath(path)
  if (!s) return -1
  if (s.era === 'all') return -1
  return ERAS.findIndex((e) => e.id === s.era)
}

interface Star {
  a: number
  r: number
  v: number
  w: number
}

function play(from: number, to: number) {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = (c.width = Math.floor(window.innerWidth * dpr))
  const H = (c.height = Math.floor(window.innerHeight * dpr))
  const span = from >= 0 && to >= 0 ? to - from : 0
  dir.value = span >= 0 ? 1 : -1
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  passing.value = from >= 0 && to >= 0 ? ERAS.slice(lo, hi + 1).map((e) => e.name) : []
  if (dir.value < 0) passing.value.reverse()
  const toEra = to >= 0 ? ERAS[to].name : '跨越纪元'
  label.value = toEra
  const strength = Math.min(1, 0.35 + Math.abs(span) * 0.18)
  const dur = span === 0 ? 650 : 1400
  const stars: Star[] = Array.from({ length: 260 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: Math.random() * Math.hypot(W, H) * 0.5,
    v: 0.4 + Math.random() * 1.2,
    w: (0.6 + Math.random()) * dpr,
  }))
  const cx = W / 2
  const cy = H / 2
  const t0 = performance.now()
  active.value = true
  cancelAnimationFrame(raf)
  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / dur)
    // 速度先升后降；透明度在两端淡出
    const speed = Math.sin(p * Math.PI) * strength
    const alpha = Math.min(1, Math.sin(p * Math.PI) * 1.6)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = `rgba(13, 14, 16, ${alpha * 0.82})`
    ctx.fillRect(0, 0, W, H)
    for (const s of stars) {
      const len = speed * s.v * 140 * dpr
      s.r += dir.value * speed * s.v * 26 * dpr
      if (s.r > Math.hypot(W, H) * 0.6) s.r = Math.random() * 40 * dpr
      if (s.r < 0) s.r = Math.hypot(W, H) * 0.6
      const x1 = cx + Math.cos(s.a) * s.r
      const y1 = cy + Math.sin(s.a) * s.r
      const x2 = cx + Math.cos(s.a) * (s.r - dir.value * len)
      const y2 = cy + Math.sin(s.a) * (s.r - dir.value * len)
      const g = ctx.createLinearGradient(x1, y1, x2, y2)
      g.addColorStop(0, `rgba(220, 214, 200, ${alpha * 0.9})`)
      g.addColorStop(1, 'rgba(125, 184, 255, 0)')
      ctx.strokeStyle = g
      ctx.lineWidth = s.w
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    if (p < 1) raf = requestAnimationFrame(frame)
    else {
      ctx.clearRect(0, 0, W, H)
      active.value = false
    }
  }
  raf = requestAnimationFrame(frame)
}

watch(
  () => route.path,
  (to, from) => {
    if (first) {
      first = false
      return
    }
    if (!from || reduce()) return
    if (!to.startsWith('/sector-') && to !== '/') return
    play(eraIndexOf(from), eraIndexOf(to))
  },
)
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="warp" :class="{ on: active, back: dir < 0 }" aria-hidden="true">
    <canvas ref="canvas"></canvas>
    <div v-if="active" class="w-text">
      <ol v-if="passing.length > 1" class="w-pass" :style="{ '--n': passing.length }">
        <li v-for="(n, i) in passing" :key="n" :style="{ '--i': i }">{{ n }}</li>
      </ol>
      <p v-else class="w-label">{{ label }}</p>
    </div>
  </div>
</template>

<style scoped>
.warp { position: fixed; inset: 0; z-index: 900; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
.warp.on { opacity: 1; }
.warp canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.w-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.w-label, .w-pass li {
  font-family: var(--font-serif);
  font-weight: 900;
  font-size: clamp(1.75rem, 5vw, 3.25rem);
  letter-spacing: 0.2em;
  color: var(--bone);
  text-shadow: 0 0 24px rgba(13, 14, 16, 0.9);
}
.w-label { margin: 0; animation: w-in 0.65s ease-out both; }
.w-pass { position: relative; list-style: none; margin: 0; padding: 0; height: 1.6em; width: 100%; font-size: clamp(1.75rem, 5vw, 3.25rem); }
.w-pass li {
  position: absolute;
  inset: 0;
  text-align: center;
  font-size: inherit;
  opacity: 0;
  animation: w-pass 0.9s linear both;
  animation-delay: calc(var(--i) / var(--n) * 0.75s);
}
.w-pass li:last-child { animation-name: w-last; }
@keyframes w-in { from { opacity: 0; filter: blur(8px); letter-spacing: 0.5em; } }
@keyframes w-pass {
  0% { opacity: 0; transform: scale(0.85); filter: blur(6px); }
  15% { opacity: 1; transform: scale(1); filter: blur(0); }
  35% { opacity: 0; transform: scale(1.2); filter: blur(4px); }
  100% { opacity: 0; }
}
@keyframes w-last {
  0% { opacity: 0; transform: scale(0.85); filter: blur(6px); }
  30% { opacity: 1; transform: scale(1); filter: blur(0); }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
