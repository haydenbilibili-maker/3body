<script setup lang="ts">
/**
 * Sector Ledger：读者的档案
 * 档案馆记下了你在每间展厅里的选择。按纪元从田园时代排到时间之外，就是一份「一个读者的深时档案」。
 * 数据见 data/answers.ts，只保存在本机浏览器里。
 */
import { computed, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { ERAS, SECTORS, eraById } from '@/data/sectors'
import { answers, forgetAll, visits } from '@/data/answers'

const SELF = '/sector-ledger'
const question = SECTORS.find((s) => s.path === SELF)?.question

const order = (era: string) => (era === 'all' ? ERAS.length : ERAS.findIndex((e) => e.id === era))
const rooms = computed(() =>
  SECTORS.filter((s) => s.path !== SELF && s.path !== '/sector-c')
    .map((s, i) => ({ s, i }))
    .sort((a, b) => order(a.s.era) - order(b.s.era) || a.i - b.i)
    .map(({ s }) => ({
      ...s,
      eraName: s.era === 'all' ? '跨越纪元' : (eraById(s.era)?.name ?? ''),
      answer: answers.value[s.path]?.text ?? '',
      visited: visits.value.includes(s.path),
    })),
)
const answered = computed(() => rooms.value.filter((r) => r.answer))
const visitedCount = computed(() => rooms.value.filter((r) => r.visited || r.answer).length)

const archiveText = computed(() =>
  ['一个读者的深时档案', '', ...answered.value.map((r) => `${r.eraName} · ${r.name}：${r.answer}`)].join('\n'),
)
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(archiveText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="sector-ledger">
    <SectorHeader
      title="读者的档案"
      subtitle="你在每间展厅里做过的选择，档案馆都记了下来：回答了谁，留下了什么，归还了什么。这些就是你在这里的全部痕迹。"
      goal="看看自己走过了哪些纪元、在哪里做了什么决定。还没去过的展厅，可以从这里出发。"
      accent="#c9b48a"
    />

    <dl class="tally">
      <div><dt>走进过的展厅</dt><dd class="num">{{ visitedCount }} / {{ rooms.length }}</dd></div>
      <div><dt>留下了选择的展厅</dt><dd class="num">{{ answered.length }}</dd></div>
    </dl>

    <ol class="rooms">
      <li v-for="r in rooms" :key="r.path" class="room" :class="{ done: r.answer, seen: r.visited && !r.answer }">
        <div class="r-head">
          <RouterLink :to="r.path" class="r-name">{{ r.name }}</RouterLink>
          <span class="r-era">{{ r.eraName }}</span>
        </div>
        <p class="r-q">{{ r.question }}</p>
        <p v-if="r.answer" class="r-a">{{ r.answer }}</p>
        <p v-else-if="r.visited" class="r-none">走进过，没有留下选择。</p>
        <p v-else class="r-none">还没有走进这间展厅。</p>
      </li>
    </ol>

    <Vitrine v-if="answered.length" class="sum" caption="复制下来，可以刻进文明墓碑，也可以留给自己。">
      <pre class="archive">{{ archiveText }}</pre>
      <div class="sum-actions">
        <button type="button" class="plain-btn primary" @click="copy">{{ copied ? '已复制' : '复制这份档案' }}</button>
        <RouterLink to="/sector-tomb" class="plain-btn">把它刻在石头上：文明墓碑</RouterLink>
      </div>
    </Vitrine>

    <p class="q">{{ question }}</p>
    <div v-if="answered.length || visitedCount" class="forget">
      <HoldButton tone="rust" :hold-ms="2000" @confirm="forgetAll">按住，抹去这份档案</HoldButton>
      <span>只会清除这台设备上的记录。</span>
    </div>
  </div>
</template>

<style scoped>
.sector-ledger { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 60rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.tally { display: flex; flex-wrap: wrap; gap: 2.5rem; margin: 0 0 2rem; }
.tally dt { font-size: 0.8125rem; color: var(--weathered); }
.tally dd { margin: 0.15rem 0 0; font-size: 1.75rem; color: var(--bone); }

.rooms { list-style: none; margin: 0 0 2rem; padding: 0; border-left: 1px solid var(--incision); }
.room { position: relative; padding: 0 0 1.25rem 1.25rem; }
.room::before { content: ''; position: absolute; left: -4px; top: 0.5rem; width: 7px; height: 7px; border: 1px solid var(--incision); background: var(--void); }
.room.seen::before { border-color: var(--weathered); }
.room.done::before { background: #c9b48a; border-color: #c9b48a; }
.r-head { display: flex; align-items: baseline; gap: 0.75rem; }
.r-name { font-family: var(--font-serif); font-weight: 600; font-size: 1.0625rem; color: var(--bone); text-decoration: none; }
.r-name:hover { color: var(--cherenkov); }
.r-era { font-size: 0.8125rem; color: var(--weathered); }
.r-q { margin: 0.25rem 0; font-size: 0.9375rem; line-height: 1.75; color: var(--weathered); }
.r-a { margin: 0.25rem 0 0; padding-left: 0.9rem; border-left: 1px solid #c9b48a; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--bone); }
.r-none { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--incision); }
.room.seen .r-none { color: var(--weathered); }

.archive { margin: 0 0 1rem; white-space: pre-wrap; font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--bone); }
.sum-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.q { margin: 2rem 0 1rem; padding-left: 1rem; border-left: 1px solid #c9b48a; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); }
.forget { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; font-size: 0.8125rem; color: var(--weathered); }

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
</style>
