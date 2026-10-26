<script setup lang="ts">
/**
 * Sector Sleep：冬眠者
 * 一次次躺进冬眠舱，一次次在陌生的时代醒来。可以带一个人一起睡，也可以在任何一次醒来后留下。
 * 结局回到那个问题：跳过的岁月，还算不算你的人生？
 * 逻辑见 sim/hibernation.ts。
 */
import { computed, onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import FrostOverlay from '@/components/FrostOverlay.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'
import { PEOPLE, STATIONS, alive, elapsed, formatYears, summary } from '@/sim/hibernation'

const question = sectorByPath('/sector-sleep')?.question

const companion = ref<string | null>(null)
const index = ref(0)
const started = ref(false)
const sleeping = ref(false)
const stayed = ref(false)
const counter = ref(0)
let raf = 0
onUnmounted(() => cancelAnimationFrame(raf))

const station = computed(() => STATIONS[index.value])
const companionName = computed(() => PEOPLE.find((p) => p.id === companion.value)?.name ?? '')
const result = computed(() => summary(index.value, companion.value))

function sleep() {
  if (!station.value.canSleep) return
  started.value = true
  sleeping.value = true
  const from = elapsed(index.value)
  const to = elapsed(index.value + 1)
  const t0 = performance.now()
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 3400)
    counter.value = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
    if (p < 1) raf = requestAnimationFrame(tick)
    else {
      index.value += 1
      sleeping.value = false
    }
  }
  raf = requestAnimationFrame(tick)
}
function stay() {
  stayed.value = true
  recordAnswer('/sector-sleep', `在${station.value.era}醒来后留下${companion.value ? `，和${companionName.value}一起` : ''}`)
}
function restart() {
  cancelAnimationFrame(raf)
  companion.value = null
  index.value = 0
  started.value = false
  sleeping.value = false
  stayed.value = false
}

function status(id: string) {
  const p = PEOPLE.find((x) => x.id === id)!
  if (p.id === companion.value) return index.value === 0 ? '会和你一起睡' : '和你一起醒来'
  if (alive(p, index.value, companion.value)) return index.value === 0 ? '还在你身边' : '还在'
  return '已经不在了'
}
function noteOf(id: string) {
  const p = PEOPLE.find((x) => x.id === id)!
  return !alive(p, index.value, companion.value) || (p.sleepsUntil === index.value && index.value > 0) ? p.note : ''
}
</script>

<template>
  <div class="sector-sleep">
    <FrostOverlay :active="sleeping" />
    <SectorHeader
      title="冬眠者"
      subtitle="冬眠技术让人可以跳过岁月：躺下，醒来，就是一两百年之后。很多人这样去看人类的结局，程心也是。"
      goal="一次次躺进冬眠舱。每次醒来，看看世界变成了什么样，你认识的人还剩下谁；你可以在任何一次醒来后留下。"
      :show-restart="started"
      restart-label="回到危机纪元 3 年"
      @restart="restart"
    />

    <div class="room">
      <Vitrine class="now" :class="{ asleep: sleeping }">
        <template v-if="sleeping">
          <p class="sleep-label">冬眠中</p>
          <p class="sleep-years num">{{ formatYears(counter) }}</p>
        </template>
        <template v-else>
          <p class="era">{{ station.era }}</p>
          <p v-if="index > 0" class="since">距离你第一次躺下，已经过去 <b class="num">{{ formatYears(elapsed(index)) }}</b></p>
          <p class="world">{{ station.world }}</p>
          <p class="detail">{{ station.detail }}</p>
        </template>
      </Vitrine>

      <aside class="people" aria-label="你认识的人">
        <h2 class="p-title">你认识的人</h2>
        <ul>
          <li v-for="p in PEOPLE" :key="p.id" :class="{ gone: status(p.id) === '已经不在了', with: p.id === companion }">
            <span class="p-name">{{ p.name }}</span>
            <span class="p-status">{{ status(p.id) }}</span>
            <p v-if="noteOf(p.id)" class="p-note">{{ noteOf(p.id) }}</p>
          </li>
        </ul>

        <fieldset v-if="!started" class="bring">
          <legend>说服一个人和你一起冬眠</legend>
          <label><input v-model="companion" type="radio" :value="null" name="bring" />不带任何人</label>
          <label v-for="p in PEOPLE" :key="p.id"><input v-model="companion" type="radio" :value="p.id" name="bring" />{{ p.name }}</label>
        </fieldset>
      </aside>
    </div>

    <div v-if="!stayed && !sleeping" class="actions">
      <HoldButton v-if="station.canSleep" :hold-ms="1800" @confirm="sleep">{{ index === 0 ? '按住，躺进冬眠舱' : '按住，再睡一次' }}</HoldButton>
      <button v-if="index > 0" type="button" class="plain-btn" @click="stay">留下来，在这个时代生活</button>
    </div>

    <section v-if="stayed" class="end">
      <h2 class="end-title">你在{{ station.era }}住了下来</h2>
      <p>你醒着的时间加起来，不过 {{ result.lived }} 年；世界却走过了 {{ formatYears(result.world) }}。</p>
      <p v-if="result.left.length">{{ result.left.join('、') }}，都没能等到你。{{ companion ? `${companionName}陪着你，你们是彼此和出生的那个时代之间唯一的联系。` : '' }}</p>
      <p v-else-if="companion">{{ companionName }}一直在你身边。</p>
      <p>每一次醒来，你都比周围的人更老，也更年轻：你记得他们只在历史书里读过的事，却不会用他们的东西、说他们的话。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">从头再睡一次</button>
        <RouterLink to="/sector-b" class="plain-btn">你跳过的那些年：编年史</RouterLink>
        <RouterLink to="/sector-human" class="plain-btn">更远的地方：银河人类</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-sleep { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 72rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.room { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 1fr); gap: 1.5rem; align-items: start; }
.now :deep(.vitrine-body) { min-height: 18rem; transition: background 1.2s; }
.now.asleep :deep(.vitrine-body) { display: flex; flex-direction: column; justify-content: center; align-items: center; background: #101215; }
.sleep-label { margin: 0; font-size: 0.875rem; letter-spacing: 0.3em; color: var(--weathered); }
.sleep-years { margin: 0.5rem 0 0; font-size: 2.5rem; color: #9fb8d8; }
.era { margin: 0 0 0.4rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.08em; color: var(--bone); animation: arrive 1.2s ease-out; }
@keyframes arrive { from { opacity: 0; filter: blur(6px); } }
.since { margin: 0 0 1rem; font-size: 0.9375rem; color: var(--weathered); }
.since b { font-weight: 400; color: var(--bone); }
.world { margin: 0 0 0.8rem; font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.95; color: var(--bone); }
.detail { margin: 0; font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--weathered); }

.p-title { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; letter-spacing: 0.08em; color: var(--bone); }
.people ul { list-style: none; margin: 0; padding: 0; }
.people li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--incision-soft); }
.p-name { font-family: var(--font-serif); color: var(--bone); }
.p-status { margin-left: auto; font-size: 0.8125rem; color: var(--weathered); }
.people li.gone .p-name { color: var(--weathered); text-decoration: line-through; }
.people li.with .p-status { color: #9fb8d8; }
.p-note { flex-basis: 100%; margin: 0.2rem 0 0; font-size: 0.875rem; line-height: 1.7; color: var(--gray-200); }
.bring { margin: 1.25rem 0 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.9375rem; color: var(--bone); }
.bring legend { margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--weathered); }
.bring label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.bring input { accent-color: #9fb8d8; }

.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
.end { max-width: 44rem; margin-top: 2rem; }
.end-title { margin: 0 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.5rem; letter-spacing: 0.08em; color: var(--bone); }
.end p { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.end .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid var(--era-archive); color: var(--bone); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }

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

@media (max-width: 900px) {
  .room { grid-template-columns: 1fr; }
}
</style>
