<script setup lang="ts">
/**
 * Sector Guzheng：古筝计划
 * 「审判日」号是地球三体组织的大本营，船上存着与三体世界往来的全部信息。
 * 它要驶过巴拿马运河。在两岸之间横起一排纳米丝，船会被切成一片一片——船上的人也一样。
 * 你来决定丝的间距：太疏，有人活下来删掉数据；太密，连硬盘一起切碎。或者，你可以不执行。
 * 逻辑见 sim/guzheng.ts。
 */
import { computed, onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import PageSlicer from '@/components/PageSlicer.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'
import { CREW, SHIP_HEIGHT, run, slices, successRate, type Result } from '@/sim/guzheng'

const question = sectorByPath('/sector-guzheng')?.question

type Act = 'brief' | 'rig' | 'pass' | 'after' | 'refused'
const act = ref<Act>('brief')
const spacing = ref(1)
const estimate = computed(() => Math.round(successRate(spacing.value, 200) * 100))
const result = ref<Result | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(timer))

/* 画面：船高 30 米 → 240 像素 */
const PX = 8
const shipH = SHIP_HEIGHT * PX
const bands = computed(() => {
  const s = (result.value?.spacing ?? spacing.value) * PX
  const n = Math.ceil(shipH / s)
  return Array.from({ length: n }, (_, i) => ({ y: i * s, h: Math.min(s, shipH - i * s) }))
})
const wires = computed(() => Array.from({ length: slices(spacing.value) + 1 }, (_, i) => i * spacing.value * PX).filter((y) => y <= shipH))

/* 船驶过飞刃的那一刻，这一页也被切开（间距越小，条带越细） */
const slicer = ref<InstanceType<typeof PageSlicer> | null>(null)
const band = computed(() => Math.max(6, Math.min(40, Math.round(spacing.value * 24))))
function execute() {
  result.value = run(spacing.value, Math.floor(Math.random() * 1e6))
  act.value = 'pass'
  setTimeout(() => slicer.value?.play(), 1500)
  timer = setTimeout(() => {
    act.value = 'after'
    const r = result.value!
    recordAnswer('/sector-guzheng', `执行了古筝计划，丝距 ${r.spacing.toFixed(2)} 米；${r.obtained ? '拿到了三体信息' : '没有拿到信息'}`)
  }, 4200)
}
function refuse() {
  act.value = 'refused'
  recordAnswer('/sector-guzheng', '没有执行古筝计划')
}
function restart() {
  clearTimeout(timer)
  act.value = 'brief'
  result.value = null
}

const verdict = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.obtained) return '数据完好。人类第一次读到了与三体世界往来的全部记录：三体舰队已经启程，四百年后抵达；智子已经到了地球。'
  if (!r.driveIntact) return '存储阵列被切开了。船上的人都死了，那些信息也和他们一起没了。'
  return '有人活了下来。在船体滑开之前，他删掉了数据。'
})
</script>

<template>
  <div class="sector-guzheng">
    <PageSlicer ref="slicer" :band="band" />
    <SectorHeader
      title="古筝计划"
      subtitle="「审判日」号上住着地球三体组织的核心成员，船上存着他们与三体世界往来的全部信息。它就要驶过巴拿马运河的盖拉德水道。"
      goal="决定纳米丝的间距：太疏，有人活下来删掉数据；太密，连存着信息的硬盘一起切碎。也可以选择不执行。"
      :show-restart="act !== 'brief'"
      restart-label="回到运河"
      @restart="restart"
    />

    <section v-if="act === 'brief'" class="brief">
      <p>汪淼研制的纳米材料「飞刃」，细到看不见，却能切开任何东西。作战中心的方案是：在运河两岸之间平行地拉起一排飞刃，像一架古筝的弦。</p>
      <p>船会照常驶来，没有警报，没有爆炸。它会在几秒钟里被切成很多片，船上的人也一样——包括那些只是在船上干活的人。</p>
      <div class="choose">
        <button type="button" class="plain-btn primary" @click="act = 'rig'">布置飞刃</button>
        <button type="button" class="plain-btn" @click="refuse">不执行</button>
      </div>
    </section>

    <div v-else-if="act === 'rig' || act === 'pass'" class="rig">
      <Vitrine flush>
        <svg class="canal" :viewBox="`0 0 720 ${shipH + 80}`" role="img" aria-label="运河侧视：两岸之间的飞刃，与驶来的审判日号">
          <rect x="0" :y="shipH + 40" width="720" height="40" class="water" />
          <line x1="360" y1="20" x2="360" :y2="shipH + 40" class="post" />
          <g class="wires">
            <line v-for="(y, i) in wires" :key="i" x1="330" :y1="shipH + 40 - y" x2="390" :y2="shipH + 40 - y" />
          </g>
          <g class="ship" :class="{ sailing: act === 'pass' }">
            <g v-for="(b, i) in bands" :key="i" class="band" :style="act === 'pass' ? { transitionDelay: 2200 + 'ms', transform: `translateX(${(i % 2 ? 1 : -1) * Math.min(12, i * 0.6)}px)` } : {}">
              <rect x="0" :y="shipH + 40 - b.y - b.h" width="260" :height="b.h" class="hull" />
            </g>
            <rect x="180" :y="40" width="60" height="70" class="bridge" />
          </g>
        </svg>
        <template #caption>
          <span v-if="act === 'rig'">侧视图。中间的竖线是运河两岸之间的飞刃，每一道短横就是一根丝。</span>
          <span v-else>审判日号驶过。没有声音。</span>
        </template>
      </Vitrine>

      <aside v-if="act === 'rig'" class="panel">
        <label class="slider">
          <span>丝的间距 <b class="num">{{ spacing.toFixed(2) }} 米</b></span>
          <input v-model.number="spacing" type="range" min="0.2" max="3" step="0.05" aria-label="丝的间距" />
        </label>
        <dl class="readouts">
          <div><dt>船会被切成</dt><dd class="num">{{ slices(spacing) }} 片</dd></div>
          <div><dt>作战中心的估算：拿到信息的可能</dt><dd class="num">{{ estimate }}%</dd></div>
        </dl>
        <p class="note">船上约 {{ CREW }} 人。站着的人一米七，坐着的一米二，躺下的不到半米；存储阵列里的硬盘只有十几厘米高。</p>
        <HoldButton tone="rust" :hold-ms="2400" @confirm="execute">按住，让审判日号驶过</HoldButton>
      </aside>
    </div>

    <section v-else-if="act === 'after' && result" class="after">
      <h2 class="a-title">{{ result.obtained ? '拿到了' : '没有拿到' }}</h2>
      <dl class="readouts wide">
        <div><dt>丝距</dt><dd class="num">{{ result.spacing.toFixed(2) }} 米</dd></div>
        <div><dt>切片</dt><dd class="num">{{ result.slices }}</dd></div>
        <div><dt>船上的人</dt><dd class="num">{{ CREW - result.survivors }} 死 / {{ result.survivors }} 活</dd></div>
      </dl>
      <p>{{ verdict }}</p>
      <p class="book">原著里，飞刃的间距是五十厘米。审判日号被切成了许多片，在运河里滑开、搁浅；那些信息被完整地取了回来。从此人类知道了三体舰队与智子，也知道了自己还剩四百年。</p>
      <p>船上的人里，有伊文斯和降临派的核心成员，也有许多只是在船上工作、并不清楚自己在为谁工作的人。他们没有受审，也没有机会投降。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">回到运河</button>
        <RouterLink to="/sector-a" class="plain-btn">信息里写着的：智子</RouterLink>
        <RouterLink to="/sector-r" class="plain-btn">这一切的开始：红岸</RouterLink>
      </div>
    </section>

    <section v-else-if="act === 'refused'" class="after">
      <h2 class="a-title">没有执行</h2>
      <p>审判日号驶过运河，进入太平洋，再也没有人找到它。这是原著之外的一条世界线。</p>
      <p>没有人死在运河里。人类也没有读到那些信息：不知道舰队已经启程，不知道智子正看着每一间实验室。也许要再过很多年，人类才会明白自己面对的是什么。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">回到运河</button>
        <RouterLink to="/sector-blind" class="plain-btn">看不见的敌人：盲区</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-guzheng { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.brief, .after { max-width: 44rem; }
.brief p, .after p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.choose, .links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

.rig { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
.canal { display: block; width: 100%; height: auto; background: #0d0e10; overflow: hidden; }
.water { fill: #15191d; }
.post { stroke: var(--incision); stroke-width: 1; }
.wires line { stroke: rgba(210, 85, 63, 0.75); stroke-width: 1; }
.ship { transform: translateX(20px); }
.ship.sailing { transform: translateX(440px); transition: transform 3s cubic-bezier(0.3, 0, 0.4, 1); }
.band { transition: transform 1.6s ease-out; }
.hull { fill: #3a3c41; stroke: #0d0e10; stroke-width: 0.3; }
.bridge { fill: #4a4c52; }

.panel { display: flex; flex-direction: column; gap: 1.1rem; }
.slider { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9375rem; color: var(--weathered); }
.slider b { font-weight: 400; color: var(--bone); }
.slider input { width: 100%; accent-color: var(--rust-bright); }
.readouts { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 0; }
.readouts dt { font-size: 0.8125rem; color: var(--weathered); }
.readouts dd { margin: 0.15rem 0 0; font-size: 1.375rem; color: var(--bone); }
.readouts.wide { margin: 0 0 1.25rem; }
.note { margin: 0; font-size: 0.875rem; line-height: 1.75; color: var(--weathered); }

.a-title { margin: 0 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.after .book { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.after .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid var(--rust); color: var(--bone); }

.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }

@media (max-width: 900px) {
  .rig { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .ship.sailing, .band { transition-duration: 0.01s; }
}
</style>
