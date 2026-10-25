<script setup lang="ts">
/**
 * 黑域：光速降到每秒十几公里之后，这一页的光也慢了下来。
 * - 你的光标留下一个迟到的影子：它看到的是你零点八秒之前的位置
 * - 页面上正在播放的动画都慢到原来的十分之一
 * active 为假时一切恢复。挂在 body 上，不拦截点击。
 */
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ active: boolean }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const LAG = 800
let raf = 0
let slowTimer: ReturnType<typeof setInterval> | undefined
const trail: { x: number; y: number; t: number }[] = []

function onMove(e: PointerEvent) {
  trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
  if (trail.length > 400) trail.splice(0, trail.length - 400)
}
function slowAll(rate: number) {
  try {
    for (const a of document.getAnimations()) a.playbackRate = rate
  } catch {
    /* 旧浏览器没有 getAnimations */
  }
}
function draw(now: number) {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (c.width !== Math.floor(innerWidth * dpr)) {
    c.width = Math.floor(innerWidth * dpr)
    c.height = Math.floor(innerHeight * dpr)
  }
  ctx.clearRect(0, 0, c.width, c.height)
  const pts = trail.filter((p) => now - p.t >= LAG && now - p.t < LAG + 900)
  for (let i = 1; i < pts.length; i++) {
    const a = 1 - (now - pts[i].t - LAG) / 900
    ctx.strokeStyle = `rgba(125, 184, 255, ${a * 0.5})`
    ctx.lineWidth = 2 * dpr
    ctx.beginPath()
    ctx.moveTo(pts[i - 1].x * dpr, pts[i - 1].y * dpr)
    ctx.lineTo(pts[i].x * dpr, pts[i].y * dpr)
    ctx.stroke()
  }
  const ghost = [...trail].reverse().find((p) => now - p.t >= LAG)
  if (ghost) {
    const g = ctx.createRadialGradient(ghost.x * dpr, ghost.y * dpr, 0, ghost.x * dpr, ghost.y * dpr, 14 * dpr)
    g.addColorStop(0, 'rgba(220, 214, 200, 0.9)')
    g.addColorStop(1, 'rgba(125, 184, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(ghost.x * dpr, ghost.y * dpr, 14 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
  raf = requestAnimationFrame(draw)
}

function start() {
  window.addEventListener('pointermove', onMove)
  slowAll(0.1)
  slowTimer = setInterval(() => slowAll(0.1), 300)
  raf = requestAnimationFrame(draw)
}
function stop() {
  window.removeEventListener('pointermove', onMove)
  clearInterval(slowTimer)
  cancelAnimationFrame(raf)
  slowAll(1)
  trail.length = 0
}
watch(
  () => props.active,
  (on) => (on ? start() : stop()),
)
onUnmounted(stop)
</script>

<template>
  <Teleport to="body">
    <div v-if="active" class="slow" aria-hidden="true">
      <canvas ref="canvas" class="cv"></canvas>
      <p class="banner">此处光速：每秒 16.7 公里。你看到的光标，是零点八秒以前的你。</p>
    </div>
  </Teleport>
</template>

<style scoped>
.slow { position: fixed; inset: 0; z-index: 870; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(60, 20, 16, 0.25)); }
.cv { position: absolute; inset: 0; width: 100vw; height: 100vh; }
.banner {
  position: absolute;
  left: 50%;
  bottom: 3.5rem;
  transform: translateX(-50%);
  margin: 0;
  padding: 0.45rem 1rem;
  font-size: 0.875rem;
  color: var(--bone);
  background: rgba(13, 14, 16, 0.85);
  border: 1px solid var(--incision);
  white-space: nowrap;
}
@media (max-width: 640px) {
  .banner { white-space: normal; width: calc(100% - 2rem); text-align: center; }
}
</style>
