<script setup lang="ts">
/**
 * 深时之声：每个纪元一种持续的低音。
 * 田园时代温暖、危机纪元紧张、威慑纪元冰冷、广播纪元刺耳、掩体纪元低沉、银河纪元空旷、时间之外几乎无声。
 * 在展厅之间穿行时，旧的和弦在两秒里淡出，新的淡入。
 * 默认关闭；打开后记住选择，下次在访客第一次点击页面时恢复（浏览器要求声音必须由操作触发）。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { sectorByPath, type EraId } from '@/data/sectors'

const KEY = 'deep-time-sound'
const route = useRoute()
const on = ref(false)
let ac: AudioContext | null = null
let master: GainNode | null = null
let voices: { osc: OscillatorNode[]; gain: GainNode } | null = null

const CHORDS: Record<EraId, { f: number[]; lp: number; g: number; type: OscillatorType }> = {
  pastoral: { f: [220, 277.18, 329.63, 493.88], lp: 1800, g: 0.9, type: 'sine' },
  common: { f: [146.83, 174.61, 220, 293.66], lp: 1200, g: 0.8, type: 'triangle' },
  crisis: { f: [130.81, 185, 196, 261.63], lp: 900, g: 0.8, type: 'triangle' },
  deterrence: { f: [110, 164.81, 246.94, 329.63], lp: 2600, g: 0.6, type: 'sine' },
  broadcast: { f: [155.56, 164.81, 174.61, 233.08], lp: 1400, g: 0.55, type: 'sawtooth' },
  bunker: { f: [55, 82.41, 110], lp: 420, g: 1, type: 'sawtooth' },
  galaxy: { f: [196, 293.66, 440, 587.33], lp: 3200, g: 0.55, type: 'sine' },
  beyond: { f: [65.41, 98], lp: 300, g: 0.5, type: 'sine' },
}

const era = computed<EraId>(() => {
  const s = sectorByPath(route.path)
  if (!s || s.era === 'all') return 'beyond'
  return s.era
})

function build(id: EraId) {
  if (!ac || !master) return null
  const c = CHORDS[id]
  const gain = ac.createGain()
  gain.gain.value = 0
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = c.lp
  lp.Q.value = 0.4
  lp.connect(gain).connect(master)
  const osc: OscillatorNode[] = []
  c.f.forEach((f, i) => {
    for (const det of [-4, 4]) {
      const o = ac!.createOscillator()
      o.type = c.type
      o.frequency.value = f
      o.detune.value = det + i
      const g = ac!.createGain()
      g.gain.value = 0.22 / c.f.length
      o.connect(g).connect(lp)
      o.start()
      osc.push(o)
    }
  })
  gain.gain.setTargetAtTime(c.g, ac.currentTime, 1.2)
  return { osc, gain }
}

function switchTo(id: EraId) {
  if (!ac) return
  const old = voices
  if (old) {
    old.gain.gain.setTargetAtTime(0, ac.currentTime, 0.7)
    setTimeout(() => old.osc.forEach((o) => o.stop()), 3500)
  }
  voices = build(id)
}

function start() {
  try {
    if (!ac) {
      ac = new AudioContext()
      master = ac.createGain()
      master.gain.value = 0.06
      // 很慢的呼吸
      const lfo = ac.createOscillator()
      lfo.frequency.value = 0.07
      const lg = ac.createGain()
      lg.gain.value = 0.02
      lfo.connect(lg).connect(master.gain)
      lfo.start()
      master.connect(ac.destination)
    }
    ac.resume()
    switchTo(era.value)
    on.value = true
  } catch {
    on.value = false
  }
}
function stop() {
  if (ac && voices) {
    const v = voices
    v.gain.gain.setTargetAtTime(0, ac.currentTime, 0.4)
    setTimeout(() => v.osc.forEach((o) => o.stop()), 2000)
  }
  voices = null
  on.value = false
}
function toggle() {
  if (on.value) stop()
  else start()
  try {
    localStorage.setItem(KEY, on.value ? '1' : '0')
  } catch {
    /* 不能记住也没关系 */
  }
}

watch(era, (id) => {
  if (on.value) switchTo(id)
})

function resumeOnGesture() {
  window.removeEventListener('pointerdown', resumeOnGesture)
  if (!on.value) start()
}
onMounted(() => {
  let pref = '0'
  try {
    pref = localStorage.getItem(KEY) ?? '0'
  } catch {
    pref = '0'
  }
  if (pref === '1') window.addEventListener('pointerdown', resumeOnGesture, { once: true })
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', resumeOnGesture)
  ac?.close()
})
</script>

<template>
  <button type="button" class="sound" :aria-pressed="on" @click="toggle">
    <span class="bars" :class="{ on }" aria-hidden="true"><i></i><i></i><i></i></span>
    深时之声
  </button>
</template>

<style scoped>
.sound { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0; font: inherit; font-size: inherit; color: var(--weathered); background: none; border: 0; cursor: pointer; }
.sound[aria-pressed='true'] { color: var(--bone); }
.bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 10px; }
.bars i { display: block; width: 2px; height: 3px; background: currentColor; }
.bars.on i { animation: bar 1.4s ease-in-out infinite; }
.bars.on i:nth-child(2) { animation-delay: 0.3s; }
.bars.on i:nth-child(3) { animation-delay: 0.6s; }
@keyframes bar { 50% { height: 10px; } }
@media (prefers-reduced-motion: reduce) { .bars.on i { animation: none; height: 7px; } }
</style>
