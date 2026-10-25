<script setup lang="ts">
/**
 * 科学边界：三个思想实验
 * 一、台球与对撞：同样的击球，同样的结果——直到智子开始干扰。
 * 二、农场主：火鸡科学家的定律，在感恩节的早上失效。
 * 三、射手：靶面上的「物理规律」，只是射手的习惯。
 * 逻辑见 sim/boundary.ts。
 */
import { computed, onUnmounted, ref } from 'vue'
import { NSlider, NSwitch } from 'naive-ui'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import { sectorByPath } from '@/data/sectors'
import { TABLE, THANKSGIVING, endPoint, holes, laplace, shoot, type Pt } from '@/sim/boundary'

const question = sectorByPath('/sector-boundary')?.question
const tab = ref<'billiard' | 'farmer' | 'shooter'>('billiard')
const TABS = [
  { id: 'billiard', label: '台球与对撞' },
  { id: 'farmer', label: '农场主' },
  { id: 'shooter', label: '射手' },
] as const

/* ---------- 一、台球 ---------- */
const angle = ref(24)
const power = ref(60)
const sophon = ref(false)
const runs = ref<Pt[][]>([])
const runCount = ref(0)
const toPath = (p: Pt[]) => p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')
function hit() {
  runCount.value += 1
  const path = shoot(angle.value, power.value, sophon.value ? 0.7 : 0, runCount.value)
  runs.value = [...runs.value.slice(-11), path]
}
function clearRuns() {
  runs.value = []
}
/** 最近几次结果终点的离散程度（桌面单位） */
const spread = computed(() => {
  const ends = runs.value.map(endPoint)
  if (ends.length < 2) return null
  const mx = ends.reduce((a, p) => a + p.x, 0) / ends.length
  const my = ends.reduce((a, p) => a + p.y, 0) / ends.length
  return Math.sqrt(ends.reduce((a, p) => a + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / ends.length)
})
const billiardVerdict = computed(() => {
  if (spread.value === null) return '至少击两次球，才能谈论「规律」。'
  if (spread.value < 0.01) return '每一次，母球都停在同一个位置。无论在何时何地做这个实验，结果都一样——这就是物理学存在的理由。'
  return '同样的力度、同样的角度，结果却每一次都不同。如果实验不能重复，物理学就无从谈起。'
})

/* ---------- 二、农场主 ---------- */
const day = ref(0)
const farmerCame = ref(false)
let farmTimer: ReturnType<typeof setInterval> | undefined
const confidence = computed(() => (farmerCame.value ? 0 : laplace(day.value)))
const confHistory = ref<number[]>([])
function liveDays(n: number) {
  for (let i = 0; i < n && !farmerCame.value; i += 1) {
    day.value += 1
    confHistory.value.push(laplace(day.value))
    if (day.value >= THANKSGIVING) {
      farmerCame.value = true
      confHistory.value.push(0)
    }
  }
}
function autoLive() {
  clearInterval(farmTimer)
  farmTimer = setInterval(() => {
    liveDays(1)
    if (farmerCame.value) clearInterval(farmTimer)
  }, 70)
}
function resetFarm() {
  clearInterval(farmTimer)
  day.value = 0
  farmerCame.value = false
  confHistory.value = []
}
const chartPath = computed(() => {
  const h = confHistory.value
  if (!h.length) return ''
  return h.map((v, i) => `${i ? 'L' : 'M'}${((i / (THANKSGIVING + 1)) * 300).toFixed(1)} ${(80 - v * 70).toFixed(1)}`).join(' ')
})

/* ---------- 三、射手 ---------- */
const shots = ref(9)
const changed = ref(false)
const BROKEN_AT = ref(Infinity)
const holeList = computed(() => holes(shots.value, BROKEN_AT.value))
function observe() {
  shots.value = Math.min(45, shots.value + 9)
}
function oneDay() {
  if (changed.value) return
  changed.value = true
  BROKEN_AT.value = shots.value
  shots.value += 6
}
function resetShooter() {
  shots.value = 9
  changed.value = false
  BROKEN_AT.value = Infinity
}

onUnmounted(() => clearInterval(farmTimer))
</script>

<template>
  <div class="sector-sb">
    <SectorHeader
      title="科学边界"
      subtitle="一批顶尖物理学家相继自杀。其中一人留下的遗言说：物理学从来就没有存在过。"
      goal="做三个思想实验，想一想：如果规律可以被别人改写，你还能相信什么。"
      accent="#9fb8d8"
    />

    <nav class="tabs" aria-label="思想实验">
      <button
        v-for="(t, i) in TABS"
        :key="t.id"
        type="button"
        :aria-pressed="tab === t.id"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        <span class="tab-no">思想实验{{ ['一', '二', '三'][i] }}</span>{{ t.label }}
      </button>
    </nav>

    <!-- 一、台球 -->
    <Vitrine v-if="tab === 'billiard'" caption="同一个台球实验，换一个时间、换一个地点做，结果应当完全一样。智子能干扰的是粒子对撞，这里用随机偏转来比喻：结果不再可重复。">
      <div class="exp">
        <svg class="table" :viewBox="`0 0 ${TABLE.w} ${TABLE.h}`" role="img" aria-label="台球桌与历次击球的轨迹">
          <rect x="0.5" y="0.5" :width="TABLE.w - 1" :height="TABLE.h - 1" fill="#1d2420" stroke="var(--incision)" />
          <path v-for="(p, i) in runs" :key="i" :d="toPath(p)" fill="none" :stroke="i === runs.length - 1 ? 'var(--cherenkov)' : 'rgba(220,214,200,0.25)'" stroke-width="0.6" />
          <circle v-for="(p, i) in runs" :key="'e' + i" :cx="endPoint(p).x" :cy="endPoint(p).y" r="2" :fill="i === runs.length - 1 ? 'var(--cherenkov)' : 'rgba(220,214,200,0.45)'" />
          <circle cx="40" :cy="TABLE.h / 2" r="2.6" fill="var(--bone)" />
        </svg>
        <div class="exp-side">
          <label class="ctrl"><span>角度 <b class="num">{{ angle }}°</b></span><NSlider v-model:value="angle" :min="5" :max="80" :tooltip="false" /></label>
          <label class="ctrl"><span>力度 <b class="num">{{ power }}</b></span><NSlider v-model:value="power" :min="30" :max="90" :tooltip="false" /></label>
          <label class="switch"><NSwitch v-model:value="sophon" /><span>智子干扰</span></label>
          <div class="row">
            <button type="button" class="plain-btn primary" @click="hit">击球</button>
            <button type="button" class="plain-btn" @click="clearRuns">清空</button>
          </div>
          <p class="readout">已击球 <span class="num">{{ runs.length }}</span> 次 <template v-if="spread !== null">，终点离散 <span class="num">{{ spread.toFixed(2) }}</span></template></p>
          <p class="verdict">{{ billiardVerdict }}</p>
        </div>
      </div>
    </Vitrine>

    <!-- 二、农场主 -->
    <Vitrine v-else-if="tab === 'farmer'" caption="一个农场里有一群火鸡。农场主每天上午十一点来喂食。火鸡中的一名科学家观察了将近一百天，得出了一条定律。">
      <div class="exp">
        <div class="farm" :class="{ dark: farmerCame }">
          <p class="farm-day">第 <span class="num">{{ day }}</span> 天</p>
          <p class="farm-law" v-if="!farmerCame">定律：每天上午十一点，食物会降临。</p>
          <p class="farm-law fallen" v-else>这一天上午十一点，食物没有降临。农场主来了。</p>
          <svg class="conf" viewBox="0 0 300 90" role="img" aria-label="火鸡科学家对定律的信心随天数变化">
            <line x1="0" y1="10" x2="300" y2="10" stroke="var(--incision-soft)" stroke-dasharray="2 4" />
            <line x1="0" y1="80" x2="300" y2="80" stroke="var(--incision)" />
            <text x="2" y="8" fill="var(--weathered)" font-size="7">确信</text>
            <path :d="chartPath" fill="none" :stroke="farmerCame ? 'var(--rust-bright)' : 'var(--cherenkov)'" stroke-width="1.2" />
          </svg>
        </div>
        <div class="exp-side">
          <p class="readout big">信心 <span class="num">{{ (confidence * 100).toFixed(1) }}%</span></p>
          <p class="note">按拉普拉斯继承法则：连续 n 天食物都来了，明天还来的概率是 (n+1)/(n+2)。</p>
          <div class="row">
            <button type="button" class="plain-btn primary" :disabled="farmerCame" @click="liveDays(1)">又过了一天</button>
            <button type="button" class="plain-btn" :disabled="farmerCame" @click="autoLive">一直过下去</button>
            <button type="button" class="plain-btn" @click="resetFarm">重来</button>
          </div>
          <p v-if="farmerCame" class="verdict">信心从未像那天早上那么高。归纳出来的规律，只在规律的制定者不改主意时成立。</p>
        </div>
      </div>
    </Vitrine>

    <!-- 三、射手 -->
    <Vitrine v-else caption="一名神枪手在靶上每隔十厘米打一个洞。靶面上住着二维生物，它们的科学家把这总结为宇宙的基本规律。">
      <div class="exp">
        <svg class="target" viewBox="0 0 200 110" role="img" aria-label="靶面上的弹孔">
          <rect x="0.5" y="0.5" width="199" height="109" fill="#1c1d20" stroke="var(--incision)" />
          <circle v-for="(h, i) in holeList" :key="i" :cx="h.x" :cy="h.y" r="2.4" :fill="changed && i >= BROKEN_AT ? 'var(--rust-bright)' : 'var(--bone)'" />
        </svg>
        <div class="exp-side">
          <p class="readout">观测到的弹孔 <span class="num">{{ holeList.length }}</span></p>
          <p class="law">{{ changed ? '定律失效：弹孔不再每隔十厘米出现。' : '二维科学家的定律：宇宙中每隔十厘米，必有一个洞。' }}</p>
          <div class="row">
            <button type="button" class="plain-btn primary" :disabled="changed || shots >= 45" @click="observe">再观测一个世纪</button>
            <button type="button" class="plain-btn" :disabled="changed" @click="oneDay">某一天</button>
            <button type="button" class="plain-btn" @click="resetShooter">重来</button>
          </div>
          <p v-if="changed" class="verdict">射手只是换了一种打法。对靶面上的生物来说，这就是物理规律的崩塌。</p>
        </div>
      </div>
    </Vitrine>

    <p class="closing">{{ question }}</p>
  </div>
</template>

<style scoped>
.sector-sb {
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  max-width: 76rem;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.tabs button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.6rem 1rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision-soft);
  border-radius: 2px;
  cursor: pointer;
}
.tab-no { font-family: var(--font-sans); font-size: 0.75rem; }
.tabs button.active { color: var(--bone); border-color: #9fb8d8; }

.exp { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 1fr); gap: 1.75rem; align-items: start; }
.table, .target, .conf { width: 100%; height: auto; display: block; }
.exp-side { display: flex; flex-direction: column; gap: 0.9rem; }
.ctrl > span { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--weathered); }
.ctrl b { font-weight: 400; color: var(--bone); }
.switch { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9375rem; color: var(--bone); cursor: pointer; }
.row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.plain-btn {
  padding: 0.5rem 1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.plain-btn:hover:not(:disabled) { border-color: var(--weathered); }
.plain-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }
.readout { margin: 0; font-size: 0.9375rem; color: var(--gray-200); }
.readout.big { font-size: 1.125rem; }
.readout.big .num { font-size: 1.75rem; color: var(--bone); margin-left: 0.25rem; }
.note { margin: 0; font-size: 0.8125rem; line-height: 1.6; color: var(--weathered); }
.verdict, .law { margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }

.farm { padding: 1rem 1.25rem; background: #1a1b1e; border: 1px solid var(--incision-soft); transition: background 1s; }
.farm.dark { background: #120d0c; }
.farm-day { margin: 0; font-size: 0.9375rem; color: var(--weathered); }
.farm-day .num { font-size: 2rem; color: var(--bone); }
.farm-law { margin: 0.5rem 0 1rem; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); }
.farm-law.fallen { color: var(--rust-bright); }

.closing { max-width: 40rem; margin: 2rem 0 0; padding-left: 1rem; border-left: 1px solid #9fb8d8; font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.8; color: var(--bone); }

@media (max-width: 900px) {
  .exp { grid-template-columns: 1fr; }
}
</style>
