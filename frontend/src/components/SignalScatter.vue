<script setup lang="ts">
/**
 * 宇宙留言簿：话变成光。
 * play(text) 之后，这句话先以大字出现在屏幕中央，然后每一笔都碎成光点，
 * 朝着屏幕右上方很远的一点飞去，越飞越小、越淡。纯 Canvas 2D，挂在 body 上，约 3.2 秒。
 */
import { onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
const on = ref(false)
let raf = 0

interface P {
  x: number
  y: number
  vx: number
  vy: number
  delay: number
  a: number
}

function play(text: string) {
  let reduce = false
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reduce = false
  }
  if (reduce) return
  on.value = true
  requestAnimationFrame(() => start(text))
}

function start(text: string) {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = (c.width = Math.floor(innerWidth * dpr))
  const H = (c.height = Math.floor(innerHeight * dpr))
  const ctx = c.getContext('2d')!
  // 先把字画在离屏画布上，按像素取样
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const o = off.getContext('2d')!
  const size = Math.min(W / Math.max(4, Array.from(text).length) * 1.1, 96 * dpr)
  o.font = `900 ${size}px "Noto Serif SC", serif`
  o.textAlign = 'center'
  o.textBaseline = 'middle'
  o.fillStyle = '#fff'
  // 太长就折成两行
  const chars = Array.from(text)
  const lines = chars.length > 14 ? [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')] : [text]
  lines.forEach((l, i) => o.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.25))
  const data = o.getImageData(0, 0, W, H).data
  const pts: P[] = []
  const stepPx = Math.max(2, Math.round(2.5 * dpr))
  const tx = W * 0.92
  const ty = H * 0.06
  for (let y = 0; y < H; y += stepPx) {
    for (let x = 0; x < W; x += stepPx) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const dx = tx - x
        const dy = ty - y
        const d = Math.hypot(dx, dy)
        pts.push({ x, y, vx: dx / d, vy: dy / d, delay: (x / W) * 0.6 + Math.random() * 0.4, a: 1 })
      }
    }
  }
  const t0 = performance.now()
  const frame = (now: number) => {
    const t = (now - t0) / 1000
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = `rgba(13, 14, 16, ${Math.min(0.75, t * 2) * (t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.6) : 1)})`
    ctx.fillRect(0, 0, W, H)
    for (const p of pts) {
      const k = Math.max(0, t - 0.7 - p.delay)
      const travel = k * k * 900 * dpr
      const x = p.x + p.vx * travel + Math.sin(p.y * 0.05 + k * 6) * k * 6 * dpr
      const y = p.y + p.vy * travel
      const fade = Math.max(0, 1 - k / 1.6)
      if (fade <= 0) continue
      const r = (k > 0 ? 1.2 : 1.4) * dpr * (0.4 + fade * 0.6)
      ctx.fillStyle = k > 0 ? `rgba(125, 184, 255, ${fade})` : 'rgba(220, 214, 200, 0.95)'
      ctx.fillRect(x, y, r, r)
    }
    if (t < 3.2) raf = requestAnimationFrame(frame)
    else {
      ctx.clearRect(0, 0, W, H)
      on.value = false
    }
  }
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}
onUnmounted(() => cancelAnimationFrame(raf))
defineExpose({ play })
</script>

<template>
  <Teleport to="body">
    <canvas v-show="on" ref="canvas" class="scatter" aria-hidden="true"></canvas>
  </Teleport>
</template>

<style scoped>
.scatter { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 880; pointer-events: none; }
</style>
