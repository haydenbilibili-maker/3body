<script setup lang="ts">
/**
 * 大低谷：身体的感觉。
 * - 饥饿：页面一点点褪色，四周的暗角越来越重
 * - 健康很低：屏幕边缘随心跳泛起暗红，越虚弱跳得越快
 * - 理智很低：页面上的字会轻轻漂移，偶尔有一句不知道从哪里来的话浮现
 * - 每过一天：画面暗下去，浮出「第 N 天」，再亮起来
 * 数值都是 0–100。作用在 .app-main 的滤镜和挂在 body 上的覆盖层上，不拦截点击。
 */
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ hunger: number; health: number; sanity: number; day: number }>()

const night = ref(false)
const whisper = ref<{ text: string; x: number; y: number } | null>(null)
let nightTimer: ReturnType<typeof setTimeout> | undefined
let whisperTimer: ReturnType<typeof setInterval> | undefined

const WHISPERS = ['再忍一天就好了', '隔壁的灯已经三天没亮了', '他们说舰队造好了，我们就有饭吃', '你上一次吃饱是什么时候？', '不要开门', '有人在敲墙']

const hungerK = computed(() => Math.max(0, (props.hunger - 30) / 70))
const weak = computed(() => props.health < 45)
const beat = computed(() => `${Math.max(0.45, 0.5 + (props.health / 45) * 0.9)}s`)
const lost = computed(() => props.sanity < 40)

function applyFilter() {
  const el = document.querySelector('.app-main') as HTMLElement | null
  if (!el) return
  const k = hungerK.value
  el.style.transition = 'filter 1.5s ease'
  el.style.filter = k > 0.01 ? `saturate(${1 - k * 0.85}) brightness(${1 - k * 0.18}) contrast(${1 + k * 0.08})` : ''
  document.documentElement.classList.toggle('ravine-lost', lost.value)
}
watch(() => [props.hunger, props.sanity], applyFilter, { immediate: true })

watch(
  () => props.day,
  (d, old) => {
    if (old === undefined || d <= old) return
    night.value = true
    clearTimeout(nightTimer)
    nightTimer = setTimeout(() => (night.value = false), 1100)
  },
)

watch(
  lost,
  (l) => {
    clearInterval(whisperTimer)
    whisper.value = null
    if (!l) return
    whisperTimer = setInterval(() => {
      whisper.value = {
        text: WHISPERS[Math.floor(Math.random() * WHISPERS.length)],
        x: 10 + Math.random() * 70,
        y: 15 + Math.random() * 65,
      }
      setTimeout(() => (whisper.value = null), 2600)
    }, 5200)
  },
  { immediate: true },
)

onUnmounted(() => {
  clearTimeout(nightTimer)
  clearInterval(whisperTimer)
  const el = document.querySelector('.app-main') as HTMLElement | null
  if (el) el.style.filter = ''
  document.documentElement.classList.remove('ravine-lost')
})
</script>

<template>
  <Teleport to="body">
    <div class="body-state" aria-hidden="true">
      <div class="vignette" :style="{ opacity: 0.15 + hungerK * 0.75 }"></div>
      <div v-if="weak" class="pulse" :style="{ animationDuration: beat }"></div>
      <transition name="night">
        <div v-if="night" class="night"><span>第 {{ day }} 天</span></div>
      </transition>
      <transition name="whisper">
        <p v-if="whisper" class="whisper" :style="{ left: whisper.x + '%', top: whisper.y + '%' }">{{ whisper.text }}</p>
      </transition>
    </div>
  </Teleport>
</template>

<style scoped>
.body-state { position: fixed; inset: 0; z-index: 860; pointer-events: none; }
.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0, 0, 0, 0.85) 100%); transition: opacity 1.5s; }
.pulse { position: absolute; inset: 0; box-shadow: inset 0 0 120px rgba(150, 30, 20, 0.55); animation: heart 1s ease-out infinite; }
@keyframes heart {
  0% { opacity: 0; }
  12% { opacity: 1; }
  30% { opacity: 0.2; }
  42% { opacity: 0.8; }
  100% { opacity: 0; }
}
.night { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(6, 6, 7, 0.92); }
.night span { font-family: var(--font-serif); font-weight: 900; font-size: clamp(1.75rem, 5vw, 3rem); letter-spacing: 0.3em; color: var(--weathered); }
.night-enter-active { transition: opacity 0.35s; }
.night-leave-active { transition: opacity 0.6s; }
.night-enter-from, .night-leave-to { opacity: 0; }
.whisper { position: absolute; margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; color: rgba(220, 214, 200, 0.55); filter: blur(0.3px); }
.whisper-enter-active, .whisper-leave-active { transition: opacity 1.2s, transform 2.4s; }
.whisper-enter-from { opacity: 0; transform: translateY(8px); }
.whisper-leave-to { opacity: 0; transform: translateY(-10px); }
@media (prefers-reduced-motion: reduce) {
  .pulse { animation: none; opacity: 0.4; }
}
</style>
