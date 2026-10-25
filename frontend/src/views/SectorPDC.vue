<script setup lang="ts">
/**
 * Sector PDC：行星防御理事会「四百年预算」
 * 十届理事会、每届二十年：决定多少资源造舰队、多少留给活着的人。
 * 末日战役里，一个水滴摧毁了几乎整支舰队——然后回头看，每一代人为它付出了什么。
 * 逻辑见 sim/pdc.ts。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import { NSlider } from 'naive-ui'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import { sectorByPath } from '@/data/sectors'
import { TERMS, YEARS_PER_TERM, createPdc, doomsday, hardship, lifeOf, runTerm, type PdcState } from '@/sim/pdc'

const question = sectorByPath('/sector-pdc')?.question
const state = ref<PdcState>(createPdc())
const defense = ref(50)
const finished = computed(() => state.value.term >= TERMS)
const termStart = computed(() => state.value.term * YEARS_PER_TERM + 1)
const preview = computed(() => lifeOf(defense.value, false))

function pass() {
  state.value = runTerm(state.value, defense.value)
  if (finished.value) startDoomsday()
}

/* ---------- 末日战役 ---------- */
const battle = ref<'idle' | 'array' | 'strike' | 'after'>('idle')
const destroyedShown = ref(0)
const result = computed(() => doomsday(state.value.fleet))
let timer: ReturnType<typeof setInterval> | undefined
function startDoomsday() {
  battle.value = 'array'
  destroyedShown.value = 0
  setTimeout(() => {
    battle.value = 'strike'
    const total = result.value.destroyed
    const step = Math.max(1, Math.ceil(total / 60))
    timer = setInterval(() => {
      destroyedShown.value = Math.min(total, destroyedShown.value + step)
      if (destroyedShown.value >= total) {
        clearInterval(timer)
        setTimeout(() => (battle.value = 'after'), 900)
      }
    }, 50)
  }, 2200)
}
const hardTerms = computed(() => state.value.history.filter((t) => t.defense > 50 || t.ravine).length)
const sacrificed = computed(() => hardship(state.value.history))

function restart() {
  clearInterval(timer)
  state.value = createPdc()
  defense.value = 50
  battle.value = 'idle'
}
onUnmounted(() => clearInterval(timer))

/* ---------- 读者的档案 ---------- */
watch(battle, (b) => {
  if (b === 'after') recordAnswer('/sector-pdc', `${hardTerms.value} 代人为舰队过紧日子；末日战役后逃出 ${result.value.escaped} 艘`)
})
</script>

<template>
  <div class="sector-pdc">
    <SectorHeader
      title="行星防御理事会"
      subtitle="危机纪元元年，三体舰队启程。理事会要为一场四百年后的战争做预算。"
      goal="十届理事会，每届二十年：决定多少资源造舰队，多少留给活着的人。"
      accent="#9fb8d8"
      :show-restart="state.term > 0"
      restart-label="回到危机纪元元年"
      @restart="restart"
    />

    <div v-if="!finished" class="council">
      <Vitrine>
        <p class="term-no">第 <span class="num">{{ state.term + 1 }}</span> 届理事会<span class="term-years">危机纪元 {{ termStart }}–{{ termStart + YEARS_PER_TERM - 1 }} 年</span></p>
        <label class="budget">
          <span>投向太空军备 <b class="num">{{ defense }}%</b><em>留给活着的人 {{ 100 - defense }}%</em></span>
          <NSlider v-model:value="defense" :min="10" :max="90" :step="5" :tooltip="false" />
        </label>
        <p class="preview">这一代人将会：{{ preview }}</p>
        <dl class="readouts">
          <div><dt>民心</dt><dd class="num" :class="{ low: state.morale < 35 }">{{ Math.round(state.morale) }}</dd></div>
          <div><dt>人口（以元年为 100）</dt><dd class="num">{{ state.population }}</dd></div>
          <div><dt>恒星级战舰</dt><dd class="num">{{ state.fleet }}</dd></div>
        </dl>
        <button type="button" class="plain-btn primary" @click="pass">通过预算，度过这二十年</button>
        <p v-if="state.stalled > 0" class="note">大低谷之后，舰队建设停顿中（还剩 {{ state.stalled }} 届）。</p>
      </Vitrine>

      <section class="ledger" aria-label="历届理事会">
        <h2 class="ledger-title">历届理事会</h2>
        <p v-if="!state.history.length" class="muted">还没有通过任何预算。</p>
        <ol v-else class="terms">
          <li v-for="t in state.history" :key="t.year" :class="{ ravine: t.ravine }">
            <div class="t-head">
              <span>危机纪元 {{ t.year }} 年起</span>
              <span class="t-bar" aria-hidden="true"><span :style="{ width: t.defense + '%' }"></span></span>
              <span class="num">{{ t.defense }}%</span>
            </div>
            <p class="t-life">{{ t.life }}</p>
            <RouterLink v-if="t.ravine" to="/sector-ravine" class="t-link">走进大低谷里的一天</RouterLink>
          </li>
        </ol>
      </section>
    </div>

    <Vitrine v-else class="doomsday" caption="末日战役：危机纪元第三个世纪初，一个三体探测器抵达太阳系边缘。人类派出了全部舰队去迎接它。">
      <div class="battle">
        <p class="battle-line">{{ state.fleet }} 艘恒星级战舰列成矩阵，迎接一个只有几米长的探测器。</p>
        <div class="fleet" aria-hidden="true">
          <span
            v-for="i in Math.min(240, state.fleet)"
            :key="i"
            :class="{ gone: battle !== 'array' && i <= Math.round((destroyedShown / Math.max(1, state.fleet)) * Math.min(240, state.fleet)) }"
          ></span>
        </div>
        <p v-if="battle !== 'array'" class="battle-count">
          被摧毁 <span class="num">{{ destroyedShown }}</span> / {{ state.fleet }}
        </p>
        <transition name="fade">
          <div v-if="battle === 'after'" class="after">
            <p>它不是探测器，是一颗强相互作用力材料制成的水滴。不到一个小时，舰队只剩下 {{ result.escaped }} 艘逃了出去。</p>
            <p v-if="hardTerms">为了这支舰队，{{ hardTerms }} 代人过着紧日子<template v-if="state.history.some((t) => t.ravine)">，其中一代经历了大低谷</template>。</p>
            <p v-else>你没有让任何一代人为舰队吃苦。它小一些，结局也并没有不同。</p>
            <p>真正让三体人停下来的，不是舰队，而是一个人想通的一个道理。</p>
            <p class="q">{{ question }}</p>
            <div class="after-actions">
              <button type="button" class="plain-btn" @click="restart">重新编一次预算</button>
              <RouterLink to="/sector-e" class="plain-btn">那个道理：黑暗森林</RouterLink>
            </div>
            <p class="sacrifice muted">累计「为舰队吃苦」的人口·年：<span class="num">{{ sacrificed.toLocaleString('zh-CN') }}</span>（相对值）</p>
          </div>
        </transition>
      </div>
    </Vitrine>
  </div>
</template>

<style scoped>
.sector-pdc { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }
.council { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.75rem; align-items: start; }
.term-no { margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 1.25rem; color: var(--bone); }
.term-no .num { font-size: 1.75rem; }
.term-years { margin-left: 0.9rem; font-family: var(--font-sans); font-size: 0.875rem; color: var(--weathered); }
.budget > span { display: flex; align-items: baseline; gap: 0.6rem; font-size: 0.9375rem; color: var(--weathered); }
.budget b { font-weight: 400; font-size: 1.25rem; color: var(--bone); }
.budget em { margin-left: auto; font-style: normal; font-size: 0.875rem; }
.preview { margin: 1rem 0; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.8; color: var(--gray-150); }
.readouts { display: flex; gap: 2rem; flex-wrap: wrap; margin: 0 0 1.25rem; }
.readouts dt { font-size: 0.8125rem; color: var(--weathered); }
.readouts dd { margin: 0.15rem 0 0; font-size: 1.375rem; color: var(--bone); }
.readouts dd.low { color: var(--rust-bright); }
.note { margin: 0.75rem 0 0; font-size: 0.8125rem; color: var(--weathered); }
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

.ledger-title { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.125rem; font-weight: 600; letter-spacing: 0.08em; color: var(--bone); }
.terms { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--incision); }
.terms li { position: relative; padding: 0 0 1rem 1.1rem; }
.terms li::before { content: ''; position: absolute; left: -4px; top: 0.45rem; width: 7px; height: 1px; background: var(--weathered); }
.terms li.ravine::before { background: var(--rust-bright); width: 9px; height: 9px; left: -5px; top: 0.2rem; border-radius: 50%; }
.t-head { display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; color: var(--weathered); }
.t-bar { flex: 1; max-width: 8rem; height: 3px; background: var(--incision-soft); }
.t-bar span { display: block; height: 100%; background: #9fb8d8; }
.ravine .t-bar span { background: var(--rust-bright); }
.t-life { margin: 0.3rem 0 0; font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.75; color: var(--gray-200); }
.t-link { display: inline-block; margin-top: 0.3rem; font-size: 0.875rem; color: var(--rust-bright); }

.battle-line { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); }
.fleet { display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; max-width: 34rem; }
.fleet span { height: 6px; background: #9fb8d8; transition: background 0.3s, opacity 0.3s; }
.fleet span.gone { background: var(--rust-bright); opacity: 0.25; }
.battle-count { margin: 1rem 0 0; font-size: 0.9375rem; color: var(--weathered); }
.battle-count .num { font-size: 1.5rem; color: var(--rust-bright); }
.after { max-width: 40rem; margin-top: 1.5rem; }
.after p { margin: 0 0 0.8rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.after .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid #9fb8d8; color: var(--bone); }
.after-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.25rem; }
.after .sacrifice { margin-top: 1rem; font-family: var(--font-sans); font-size: 0.8125rem; }
.fade-enter-active { transition: opacity 1s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .council { grid-template-columns: 1fr; }
  .fleet { grid-template-columns: repeat(16, 1fr); }
}
</style>
