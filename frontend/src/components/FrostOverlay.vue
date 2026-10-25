<script setup lang="ts">
/**
 * 冬眠：屏幕结霜。
 * active 为真时，冰晶从屏幕四边向中间生长（枝晶，按 60° 分叉）；醒来时霜慢慢化掉。
 * 纯 Canvas 2D，挂在 body 上，不拦截点击；「减少动态」时只显示一层静止的霜色。
 */
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ active: boolean }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const visible = ref(false)
const melting = ref(false)
let raf = 0
let meltTimer: ReturnType<typeof setTimeout> | undefined

interface Tip {
  x: number
  y: number
  a: number
  len: number
  max: number
  w: number
}

function grow() {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = (c.width = Math.floor(window.innerWidth * dpr))
  const H = (c.height = Math.floor(window.innerHeight * dpr))
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  // 边缘的一层白霜
  const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6)
  edge.addColorStop(0, 'rgba(200, 220, 240, 0)')
  edge.addColorStop(1, 'rgba(200, 220, 240, 0.28)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, W, H)

  const tips: Tip[] = []
  const seed = (x: number, y: number, a: number) =>
    tips.push({ x, y, a: a + (Math.random() - 0.5) * 0.8, len: 0, max: (60 + Math.random() * 160) * dpr, w: (0.7 + Math.random() * 0.6) * dpr })
  for (let i = 0; i < 40; i++) {
    seed(Math.random() * W, 0, Math.PI / 2)
    seed(Math.random() * W, H, -Math.PI / 2)
  }
  for (let i = 0; i < 26; i++) {
    seed(0, Math.random() * H, 0)
    seed(W, Math.random() * H, Math.PI)
  }
  let segs = 0
  const step = () => {
    if (!props.active) return
    ctx.strokeStyle = 'rgba(225, 238, 250, 0.32)'
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(200, 225, 255, 0.6)'
    ctx.shadowBlur = 3 * dpr
    for (let i = tips.length - 1; i >= 0; i--) {
      const t = tips[i]
      const s = 2.2 * dpr
      t.a += (Math.random() - 0.5) * 0.08
      const nx = t.x + Math.cos(t.a) * s
      const ny = t.y + Math.sin(t.a) * s
      ctx.lineWidth = t.w
      ctx.beginPath()
      ctx.moveTo(t.x, t.y)
      ctx.lineTo(nx, ny)
      ctx.stroke()
      t.x = nx
      t.y = ny
      t.len += s
      segs++
      if (Math.random() < 0.13 && t.w > 0.3 * dpr && tips.length < 1400) {
        const side = Math.random() < 0.5 ? 1 : -1
        tips.push({ x: t.x, y: t.y, a: t.a + side * (Math.PI / 3), len: 0, max: (t.max - t.len) * 0.5, w: t.w * 0.75 })
      }
      if (t.len >= t.max) tips.splice(i, 1)
    }
    if (tips.length && segs < 70000) raf = requestAnimationFrame(step)
  }
  let reduce = false
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reduce = false
  }
  if (!reduce) raf = requestAnimationFrame(step)
}

watch(
  () => props.active,
  (on) => {
    clearTimeout(meltTimer)
    cancelAnimationFrame(raf)
    if (on) {
      melting.value = false
      visible.value = true
      requestAnimationFrame(grow)
    } else if (visible.value) {
      melting.value = true
      meltTimer = setTimeout(() => {
        visible.value = false
        melting.value = false
      }, 1600)
    }
  },
)
onUnmounted(() => {
  cancelAnimationFrame(raf)
  clearTimeout(meltTimer)
})
</script>

<template>
  <Teleport to="body">
    <canvas v-show="visible" ref="canvas" class="frost" :class="{ melting }" aria-hidden="true"></canvas>
  </Teleport>
</template>

<style scoped>
.frost { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 860; pointer-events: none; transition: opacity 1.6s ease-in, filter 1.6s; }
.frost.melting { opacity: 0; filter: blur(6px); }
</style>
