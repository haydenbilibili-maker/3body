<script setup lang="ts">
/**
 * 整页的宇宙事件（加在根元素上的一次性动画，样式在 main.css）：
 * - crunch：大坍缩——整页旋转着收向屏幕中心的一个点，白光一闪，再从那个点重新膨胀开来
 * - gforce：前进四——整页被巨大的加速度压向深处，深海状态液从屏幕底部涌上来，再退去
 * play(kind) 返回一个 Promise，在动画结束时完成。「减少动态」时直接完成。
 */
import { onUnmounted, ref } from 'vue'

type Kind = 'crunch' | 'gforce'
const flash = ref(false)
const liquid = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []

const DUR: Record<Kind, number> = { crunch: 4200, gforce: 4600 }

function play(kind: Kind): Promise<void> {
  let reduce = false
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reduce = false
  }
  if (reduce) return Promise.resolve()
  const root = document.documentElement
  root.classList.add(`page-${kind}`)
  if (kind === 'crunch') timers.push(setTimeout(() => (flash.value = true), 1750), setTimeout(() => (flash.value = false), 2350))
  if (kind === 'gforce') timers.push(setTimeout(() => (liquid.value = true), 300), setTimeout(() => (liquid.value = false), 3400))
  return new Promise((resolve) => {
    timers.push(
      setTimeout(() => {
        root.classList.remove(`page-${kind}`)
        resolve()
      }, DUR[kind]),
    )
  })
}
onUnmounted(() => {
  timers.forEach(clearTimeout)
  document.documentElement.classList.remove('page-crunch', 'page-gforce')
})
defineExpose({ play })
</script>

<template>
  <Teleport to="body">
    <transition name="flash">
      <div v-if="flash" class="flash" aria-hidden="true"></div>
    </transition>
    <transition name="liquid">
      <div v-if="liquid" class="liquid" aria-hidden="true">
        <svg class="wave" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 20 Q 150 0 300 20 T 600 20 T 900 20 T 1200 20 V40 H0 Z" /></svg>
        <span class="liquid-label">深海状态</span>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.flash { position: fixed; inset: 0; z-index: 960; pointer-events: none; background: radial-gradient(circle at 50% 50%, #fff, #fff6e0 30%, rgba(255, 246, 224, 0.6)); }
.flash-enter-active { transition: opacity 0.12s; }
.flash-leave-active { transition: opacity 0.9s; }
.flash-enter-from, .flash-leave-to { opacity: 0; }
.liquid { position: fixed; left: 0; right: 0; bottom: 0; height: 100vh; z-index: 940; pointer-events: none; background: linear-gradient(180deg, rgba(40, 110, 140, 0.5), rgba(10, 50, 70, 0.78)); }
.wave { position: absolute; left: 0; top: -38px; width: 200%; height: 40px; fill: rgba(40, 110, 140, 0.5); animation: wave 2.4s linear infinite; }
@keyframes wave { to { transform: translateX(-50%); } }
.liquid-label { position: absolute; left: 50%; top: 45%; transform: translateX(-50%); font-family: var(--font-serif); font-size: 1.125rem; letter-spacing: 0.4em; color: rgba(220, 240, 245, 0.7); }
.liquid-enter-active { transition: transform 1.4s cubic-bezier(0.3, 0, 0.2, 1); }
.liquid-leave-active { transition: transform 1.2s ease-in; }
.liquid-enter-from, .liquid-leave-to { transform: translateY(105%); }
</style>
