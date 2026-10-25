<script setup lang="ts">
/**
 * 古筝计划：切开这一页。
 * play() 之后：一排红色的细线从左到右扫过整个屏幕；扫过之后，页面被一个 SVG 位移滤镜切成一条一条，
 * 相邻的条带朝相反方向滑开，停一下，再慢慢合拢。
 * 滤镜作用在 .app-main 上；「减少动态」时只闪一下细线。
 */
import { onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{ band?: number }>(), { band: 14 })
const sweeping = ref(false)
const scale = ref(0)
let raf = 0
let target: HTMLElement | null = null

/** 条带图块：上半 R=255（向右推），下半 R=0（向左推），G 保持中性 */
const tile = () => {
  const h = props.band * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="${h}"><rect width="8" height="${props.band}" fill="rgb(255,128,0)"/><rect y="${props.band}" width="8" height="${props.band}" fill="rgb(0,128,0)"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function play() {
  let reduce = false
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reduce = false
  }
  sweeping.value = true
  setTimeout(() => (sweeping.value = false), 1300)
  if (reduce) return
  target = document.querySelector('.app-main')
  if (!target) return
  const t0 = performance.now() + 900
  const frame = (now: number) => {
    const t = (now - t0) / 1000
    // 0–0.5 秒滑开，停 1.2 秒，1.2 秒合拢
    let s = 0
    if (t < 0) s = 0
    else if (t < 0.5) s = (t / 0.5) ** 0.6
    else if (t < 1.7) s = 1
    else if (t < 2.9) s = 1 - ((t - 1.7) / 1.2) ** 2
    scale.value = s * 46
    if (target) target.style.filter = s > 0.001 ? 'url(#gz-slice)' : ''
    if (t < 3) raf = requestAnimationFrame(frame)
    else if (target) target.style.filter = ''
  }
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(frame)
}
onUnmounted(() => {
  cancelAnimationFrame(raf)
  if (target) target.style.filter = ''
})
defineExpose({ play })
</script>

<template>
  <Teleport to="body">
    <svg class="defs" width="0" height="0" aria-hidden="true">
      <filter id="gz-slice" x="-5%" y="0" width="110%" height="100%" color-interpolation-filters="sRGB">
        <feImage :href="tile()" x="0" y="0" width="8" :height="band * 2" result="t" />
        <feTile in="t" result="stripes" />
        <feDisplacementMap in="SourceGraphic" in2="stripes" :scale="scale" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div v-if="sweeping" class="wires" :style="{ backgroundImage: `repeating-linear-gradient(180deg, rgba(210, 85, 63, 0.75) 0 1px, transparent 1px ${band}px)` }" aria-hidden="true"></div>
  </Teleport>
</template>

<style scoped>
.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.wires {
  position: fixed;
  inset: 0;
  z-index: 890;
  pointer-events: none;
  animation: wires 1.3s cubic-bezier(0.5, 0, 0.3, 1) forwards;
}
@keyframes wires {
  0% { clip-path: inset(0 100% 0 0); opacity: 1; }
  70% { clip-path: inset(0 0 0 0); opacity: 1; }
  100% { clip-path: inset(0 0 0 0); opacity: 0; }
}
</style>
