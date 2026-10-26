<script setup lang="ts">
/**
 * Sector Sword：执剑人
 * 威慑纪元 62 年，罗辑老了，人类要选出新的执剑人。
 * 遴选时的四个处境决定三体世界眼里的「威慑度」；投票的人却更喜欢那个看起来不会按的人。
 * 交接之后，如果威慑度不够，水滴会立刻动手：你只有几秒钟。
 * 逻辑见 sim/swordholder.ts。
 */
import { computed, onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'
import { ENDINGS, SCENES, WINDOW, deterrence, publicSupport, strikes, type Ending } from '@/sim/swordholder'

const question = sectorByPath('/sector-sword')?.question

type Act = 'assess' | 'result' | 'alarm' | 'end'
const act = ref<Act>('assess')
const picks = ref<number[]>([])
const det = computed(() => deterrence(picks.value))
const support = computed(() => publicSupport(det.value))
const ending = ref<Ending | null>(null)
const left = ref(WINDOW)
let timer: ReturnType<typeof setInterval> | undefined
onUnmounted(() => clearInterval(timer))

function pick(i: number) {
  picks.value = [...picks.value, i]
  if (picks.value.length >= SCENES.length) act.value = 'result'
}
function takeSword() {
  if (!strikes(det.value)) return finish('held')
  act.value = 'alarm'
  left.value = WINDOW
  clearInterval(timer)
  timer = setInterval(() => {
    left.value = Math.max(0, +(left.value - 0.1).toFixed(1))
    if (left.value <= 0) finish('let-go')
  }, 100)
}
function finish(e: Ending) {
  clearInterval(timer)
  ending.value = e
  act.value = 'end'
  recordAnswer('/sector-sword', `威慑度 ${det.value}%；${ENDINGS[e].title}`)
}
function restart() {
  clearInterval(timer)
  picks.value = []
  ending.value = null
  act.value = 'assess'
}
</script>

<template>
  <div class="sector-sword">
    <Teleport to="body">
      <div v-if="act === 'alarm'" class="tunnel" :style="{ '--k': 1 - left / WINDOW }" aria-hidden="true"></div>
    </Teleport>
    <SectorHeader
      title="执剑人"
      subtitle="引力波发射器的开关在执剑人手里：一按下去，三体世界和太阳系的坐标会同时广播给整个宇宙。威慑能不能成立，取决于三体世界相不相信你会按。"
      goal="经历四个处境，看看自己在三体世界眼里的威慑度；然后接过开关。"
      accent="var(--rust-bright)"
      :show-restart="picks.length > 0"
      restart-label="回到遴选"
      @restart="restart"
    />

    <Vitrine v-if="act === 'assess'" class="scene">
      <p class="step">遴选 · 第 {{ picks.length + 1 }} / {{ SCENES.length }} 个处境</p>
      <p class="ask">{{ SCENES[picks.length].ask }}</p>
      <div class="choices">
        <button v-for="(c, i) in SCENES[picks.length].choices" :key="i" type="button" class="opt" @click="pick(i)">{{ c.text }}</button>
      </div>
      <template #caption>智子在看。三体世界关心的不是你说了什么，而是你会做什么。</template>
    </Vitrine>

    <section v-else-if="act === 'result'" class="result">
      <dl class="readouts">
        <div><dt>三体世界眼里的威慑度</dt><dd class="num" :class="{ low: strikes(det) }">{{ det }}%</dd></div>
        <div><dt>如果交给全人类投票，你会得到</dt><dd class="num">{{ support }}% 的票</dd></div>
      </dl>
      <p v-if="strikes(det)">人们喜欢你。在一个温和、精致的时代，没有人愿意把开关交给一个随时会按的人。可三体世界也看出来了。</p>
      <p v-else>很多人怕你，就像他们怕罗辑。可正是因为这一点，三体世界不敢动。</p>
      <HoldButton tone="rust" :hold-ms="2200" @confirm="takeSword">按住，从罗辑手里接过开关</HoldButton>
    </section>

    <Vitrine v-else-if="act === 'alarm'" class="alarm shake">
      <p class="a-head">交接完成。水滴正在加速，朝引力波天线飞来。</p>
      <p class="a-count num">{{ left.toFixed(1) }} 秒</p>
      <HoldButton tone="rust" :hold-ms="1200" @confirm="finish('pressed')">按住，发射引力波</HoldButton>
      <p class="a-note">什么都不做，时间到了，一切就结束了。</p>
    </Vitrine>

    <section v-else-if="ending" class="end">
      <h2 class="end-title">{{ ENDINGS[ending].title }}</h2>
      <p class="num det">威慑度 {{ det }}%</p>
      <p>{{ ENDINGS[ending].text }}</p>
      <p class="book">原著里，接过开关的是程心。据估计她的威慑度只有百分之十左右，交接之后没过多久，水滴就发起了攻击。她没有按。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">回到遴选</button>
        <RouterLink to="/sector-e" class="plain-btn">威慑的来源：黑暗森林</RouterLink>
        <RouterLink to="/sector-j" class="plain-btn">之后的纪元：掩体</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-sword { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 60rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.step { margin: 0 0 0.75rem; font-size: 0.8125rem; color: var(--weathered); }
.ask { margin: 0 0 1.5rem; font-family: var(--font-serif); font-size: 1.25rem; line-height: 1.8; color: var(--bone); }
.choices { display: flex; flex-direction: column; align-items: flex-start; gap: 0.6rem; }
.opt {
  padding: 0.65rem 1.1rem;
  font: inherit;
  font-size: 0.9375rem;
  text-align: left;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.opt:hover { border-color: var(--weathered); }

.result, .end { max-width: 44rem; }
.readouts { display: flex; flex-wrap: wrap; gap: 2.5rem; margin: 0 0 1.5rem; }
.readouts dt { font-size: 0.8125rem; color: var(--weathered); }
.readouts dd { margin: 0.2rem 0 0; font-size: 2rem; color: var(--bone); }
.readouts dd.low { color: var(--rust-bright); }
.result p, .end p { margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }

.alarm :deep(.vitrine-body) { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2.5rem 1.5rem; border-color: var(--rust); }
.a-head { margin: 0; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); text-align: center; }
.a-count { margin: 0; font-size: 3.5rem; color: var(--rust-bright); }
.a-note { margin: 0; font-size: 0.875rem; color: var(--weathered); }

.end-title { margin: 0 0 0.5rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.end .det { font-family: var(--font-mono); font-size: 0.9375rem; color: var(--weathered); }
.end .book { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.end .q { padding-left: 1rem; border-left: 1px solid var(--rust); color: var(--bone); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; }

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
/* 倒计时里，视野一点点收窄，只剩下那个开关 */
.tunnel {
  position: fixed;
  inset: 0;
  z-index: 860;
  pointer-events: none;
  background: radial-gradient(circle at 50% 55%, transparent calc(62% - var(--k) * 42%), rgba(0, 0, 0, 0.92) calc(80% - var(--k) * 40%));
  transition: background 0.1s linear;
}
.shake { animation: shake 0.12s linear infinite; }
@keyframes shake {
  25% { transform: translate(0.6px, -0.4px); }
  50% { transform: translate(-0.5px, 0.5px); }
  75% { transform: translate(0.4px, 0.3px); }
}
@media (prefers-reduced-motion: reduce) {
  .shake { animation: none; }
}
</style>
