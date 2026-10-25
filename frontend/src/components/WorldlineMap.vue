<script setup lang="ts">
/**
 * 世界线图：原著是一条骨白的直线，读者的世界线是一条切伦科夫蓝的线。
 * 在第一次与原著不同的地方，蓝线离开骨白线，从此走在另一条轨道上。
 * 图本身只是示意（aria-hidden）；下面的列表给出同样的信息与每处分岔的后果。
 */
import { computed } from 'vue'
import { answers } from '@/data/answers'
import { readWorldline, summarize } from '@/sim/worldline'

const states = computed(() => readWorldline(answers.value))
const sum = computed(() => summarize(states.value))

const W = 700
const X0 = 40
const X1 = 660
const CANON_Y = 46
const MINE_Y = 104
const xs = computed(() => states.value.map((_, i) => X0 + ((X1 - X0) * i) / (states.value.length - 1)))
const firstIdx = computed(() => states.value.findIndex((s) => s.diverged))

/** 读者那条线的折线：分岔之前与原著重合，第一次分岔处斜着离开 */
const minePath = computed(() => {
  const k = firstIdx.value
  const pts = xs.value.map((x, i) => [x, k >= 0 && i >= k ? MINE_Y : CANON_Y] as const)
  if (k > 0) {
    const bend = (xs.value[k - 1] + xs.value[k]) / 2
    return `M ${pts[0][0]} ${CANON_Y} L ${bend} ${CANON_Y} L ${xs.value[k]} ${MINE_Y} L ${X1} ${MINE_Y}`
  }
  if (k === 0) return `M ${X0 - 24} ${CANON_Y} L ${X0} ${MINE_Y} L ${X1} ${MINE_Y}`
  return `M ${X0} ${CANON_Y} L ${X1} ${CANON_Y}`
})
const nodeY = (i: number) => (firstIdx.value >= 0 && i >= firstIdx.value ? MINE_Y : CANON_Y)
</script>

<template>
  <section class="wl" aria-labelledby="wl-title">
    <h2 id="wl-title" class="wl-title">你的世界线</h2>
    <p class="wl-sum">
      <template v-if="!sum.visited">七个分岔点，你还一个都没有经过。从红岸开始吧。</template>
      <template v-else-if="!sum.diverged">经过了 {{ sum.visited }} / 7 个分岔点，每一处都和原著走得一样。</template>
      <template v-else>
        经过了 {{ sum.visited }} / 7 个分岔点，有 <b class="num">{{ sum.diverged }}</b> 处和原著不同。你的世界线最早在「{{ sum.first?.fork.room }}」离开了原著。
      </template>
    </p>

    <svg class="wl-map" :viewBox="`0 0 ${W} 150`" aria-hidden="true">
      <text :x="X1 + 8" :y="CANON_Y + 4" class="t-canon">原著</text>
      <text v-if="firstIdx >= 0" :x="X1 + 8" :y="MINE_Y + 4" class="t-mine">你</text>
      <line :x1="X0" :y1="CANON_Y" :x2="X1" :y2="CANON_Y" class="l-canon" />
      <path :d="minePath" class="l-mine" fill="none" />
      <g v-for="(s, i) in states" :key="s.fork.id">
        <circle :cx="xs[i]" :cy="CANON_Y" r="4" class="d-canon" />
        <circle
          :cx="xs[i]"
          :cy="nodeY(i)"
          :r="s.diverged ? 7 : 5"
          :class="s.mine === null ? 'd-none' : s.diverged ? 'd-div' : 'd-mine'"
        />
        <text :x="xs[i]" y="140" text-anchor="middle" class="t-room">{{ s.fork.room }}</text>
      </g>
    </svg>

    <ol class="wl-list">
      <li v-for="s in states" :key="s.fork.id" :class="{ div: s.diverged, none: s.mine === null }">
        <div class="wl-head">
          <RouterLink :to="s.fork.path" class="wl-room">{{ s.fork.room }}</RouterLink>
          <span class="wl-era">{{ s.fork.era }}</span>
          <span v-if="s.diverged" class="wl-pill">分岔</span>
        </div>
        <p class="wl-row">
          原著：{{ s.fork.options[s.fork.canon].label }}<span class="sep">　</span>你：{{
            s.mine ? s.fork.options[s.mine]?.label ?? '—' : '还没有经过'
          }}
        </p>
        <p v-if="s.diverged" class="wl-cons">{{ s.fork.options[s.mine!]?.consequence }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.wl { margin: 0 0 2.5rem; }
.wl-title { margin: 0 0 0.5rem; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.12em; color: var(--bone); }
.wl-sum { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }
.wl-sum b { font-weight: 400; color: var(--cherenkov); }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.wl-map { display: block; width: 100%; max-width: 760px; height: auto; margin: 0 0 1.25rem; overflow: visible; }
.l-canon { stroke: var(--bone); stroke-width: 1.5; }
.l-mine { stroke: var(--cherenkov); stroke-width: 2; }
.d-canon { fill: var(--bone); }
.d-mine { fill: var(--cherenkov); }
.d-div { fill: var(--void); stroke: var(--cherenkov); stroke-width: 2; }
.d-none { fill: var(--void); stroke: var(--weathered); stroke-width: 1; }
.t-canon, .t-room { fill: var(--weathered); font-family: var(--font-serif); font-size: 13px; }
.t-mine { fill: var(--cherenkov); font-family: var(--font-serif); font-size: 13px; }

.wl-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.75rem; }
.wl-list li { padding: 0.75rem 0.9rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.wl-list li.div { border-color: var(--cherenkov); }
.wl-head { display: flex; align-items: baseline; gap: 0.6rem; }
.wl-room { font-family: var(--font-serif); font-size: 1rem; color: var(--bone); text-decoration: none; }
.wl-room:hover { color: var(--cherenkov); }
.wl-era { font-size: 0.8125rem; color: var(--weathered); }
.wl-pill { margin-left: auto; padding: 0 0.45rem; font-size: 0.75rem; color: var(--cherenkov); border: 1px solid var(--cherenkov); border-radius: var(--radius-cut); }
.wl-row { margin: 0.35rem 0 0; font-size: 0.875rem; color: var(--weathered); }
.none .wl-row { color: var(--weathered); }
.wl-cons { margin: 0.4rem 0 0; font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.75; color: var(--bone); }

@media print {
  .wl-list li { background: transparent; }
}
</style>
