<script setup lang="ts">
/**
 * Sector Stamp：钢印
 * 危机纪元，思想钢印能让一个命题被无条件地判断为真。
 * 读者先自由回答五个处境，再接受一枚钢印，然后回答同样的五个处境：
 * 与钢印相反的选项仍然看得见，可是每次去选它，手都会落到另一边。逻辑见 sim/stamp.ts。
 */
import { computed, onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'
import { SITUATIONS, STAMPS, agreedBefore, allowed, compare, landing, type Answers, type Choice, type StampId } from '@/sim/stamp'

const question = sectorByPath('/sector-stamp')?.question

type Act = 'before' | 'choose' | 'stamping' | 'after' | 'end'
const act = ref<Act>('before')
const step = ref(0)
const before = ref<Answers>({})
const after = ref<Answers>({})
const stamp = ref<StampId>('win')
const resist = ref(0)
/** 第二轮里，读者刚伸手去够、却落空的那个选项 */
const slipped = ref<string | null>(null)
const released = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(timer))

const current = computed(() => SITUATIONS[step.value])
const diffs = computed(() => compare(before.value, after.value))
const changed = computed(() => diffs.value.filter((d) => d.changed).length)
const agreed = computed(() => agreedBefore(stamp.value, before.value))

function answerBefore(c: Choice) {
  before.value = { ...before.value, [current.value.id]: c.id }
  if (step.value < SITUATIONS.length - 1) step.value += 1
  else act.value = 'choose'
}
function accept() {
  act.value = 'stamping'
  step.value = 0
  clearTimeout(timer)
  timer = setTimeout(() => (act.value = 'after'), 2600)
}
function answerAfter(c: Choice) {
  if (slipped.value) return
  const s = current.value
  const land = landing(stamp.value, s, c)
  if (land.id !== c.id) {
    /* 伸手去够另一边：那一项被划掉，手落在钢印的那一边 */
    resist.value += 1
    slipped.value = c.id
    after.value = { ...after.value, [s.id]: land.id }
    clearTimeout(timer)
    timer = setTimeout(next, 2200)
  } else {
    after.value = { ...after.value, [s.id]: c.id }
    clearTimeout(timer)
    timer = setTimeout(next, 450)
  }
}
function next() {
  slipped.value = null
  if (step.value < SITUATIONS.length - 1) step.value += 1
  else finish()
}
function finish() {
  act.value = 'end'
  recordAnswer(
    '/sector-stamp',
    `接受了「${STAMPS[stamp.value].sentence}」的钢印；${changed.value} 个回答变了，试着反抗 ${resist.value} 次`,
  )
}
function restart() {
  clearTimeout(timer)
  act.value = 'before'
  step.value = 0
  before.value = {}
  after.value = {}
  resist.value = 0
  slipped.value = null
  released.value = false
}
const slippedText = computed(() => current.value.choices.find((c) => c.id === slipped.value)?.text)
const landedText = computed(() => current.value.choices.find((c) => c.id === after.value[current.value.id])?.text)
</script>

<template>
  <div class="sector-stamp">
    <Teleport to="body">
      <div v-if="act === 'stamping'" class="press" aria-hidden="true">
        <p class="press-line">{{ STAMPS[stamp].sentence }}</p>
      </div>
      <p v-if="act === 'after' || act === 'end'" class="watermark" aria-hidden="true">{{ STAMPS[stamp].sentence }}</p>
    </Teleport>

    <SectorHeader
      title="钢印"
      subtitle="面壁者希恩斯的研究走到了尽头：一台机器，能让一个命题在大脑里被无条件地判断为真。它被叫做思想钢印。太空军里，有人自愿排队接受它。"
      goal="先凭自己回答五个处境；然后选一句话刻进脑子里，再回答一次同样的五个处境。"
      :show-restart="act !== 'before' || step > 0"
      restart-label="回到第一个处境"
      @restart="restart"
    />

    <Vitrine v-if="act === 'before' || act === 'after'" class="scene" :class="{ stamped: act === 'after' }">
      <p class="step">
        {{ act === 'before' ? '钢印之前' : '钢印之后' }} · 第 <span class="num">{{ step + 1 }}</span> / {{ SITUATIONS.length }} 个处境
      </p>
      <p class="ask">{{ current.ask }}</p>
      <div class="choices">
        <button
          v-for="c in current.choices"
          :key="c.id"
          type="button"
          class="opt"
          :class="{
            slip: slipped === c.id,
            landed: act === 'after' && after[current.id] === c.id,
          }"
          :disabled="!!slipped"
          @click="act === 'before' ? answerBefore(c) : answerAfter(c)"
        >
          {{ c.text }}
        </button>
      </div>
      <p v-if="act === 'after' && slipped" class="slip-note" aria-live="polite">
        你想选「{{ slippedText }}」。你知道它是错的，却说不出为什么知道。你发现自己已经选了「{{ landedText }}」。
      </p>
      <template #caption>
        {{ act === 'before' ? '这一轮没有对错，只是记下你现在怎么想。' : '钢印不会拦住你。它只是让另一边看起来显然是错的。' }}
      </template>
    </Vitrine>

    <section v-else-if="act === 'choose'" class="choose">
      <p class="lead">五个回答都记下了。现在选一句话，让它在你的脑子里成为不需要证明的真理。</p>
      <div class="stamps" role="radiogroup" aria-label="钢印的内容">
        <button
          v-for="(s, id) in STAMPS"
          :key="id"
          type="button"
          role="radio"
          class="stamp-opt"
          :aria-checked="stamp === id"
          @click="stamp = id as StampId"
        >
          <span class="s-sent">{{ s.sentence }}</span>
          <span class="s-note">{{ s.note }}</span>
        </button>
      </div>
      <p class="warn">钢印不可解除。</p>
      <HoldButton tone="rust" :hold-ms="2400" @confirm="accept">按住，接受钢印</HoldButton>
    </section>

    <section v-else-if="act === 'stamping'" class="stamping" aria-live="polite">
      <p>正在写入。</p>
    </section>

    <section v-else class="end">
      <h2 class="end-title">{{ changed ? `${changed} 个回答变了` : '没有一个回答变了' }}</h2>
      <p v-if="changed">
        你试着选另一边 <span class="num">{{ resist }}</span> 次，每一次都落在了「{{ STAMPS[stamp].sentence }}」这一边。你记得自己曾经那样想，可是现在回头看，那些想法显然是错的。
      </p>
      <p v-else>
        钢印之前，你的五个回答就已经和「{{ STAMPS[stamp].sentence }}」一致。钢印什么都没有改变。那么，你原来的信念和一枚钢印，区别在哪里？
      </p>

      <table class="diff">
        <thead>
          <tr><th scope="col">处境</th><th scope="col">钢印之前</th><th scope="col">钢印之后</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in diffs" :key="d.situation.id" :class="{ changed: d.changed }">
            <td class="d-ask">{{ d.situation.ask }}</td>
            <td>{{ d.before?.text }}</td>
            <td>{{ d.after?.text }}<span v-if="d.changed" class="d-tag">变了</span></td>
          </tr>
        </tbody>
      </table>

      <p class="agreed">第一次回答里，有 <span class="num">{{ agreed }}</span> / {{ SITUATIONS.length }} 处本来就和钢印一致。</p>

      <div class="release">
        <button v-if="!released" type="button" class="plain-btn" @click="released = true">申请解除钢印</button>
        <p v-else class="released">申请被驳回：钢印不可解除。你也并不真的想解除它，你只是记得自己曾经会想。</p>
      </div>

      <p class="book">原著里，接受了「人类必将胜利」钢印的人被称为钢印族。他们是太空军里最坚定的一群人，坚定得不需要任何理由。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">回到第一个处境</button>
        <RouterLink to="/sector-ns" class="plain-btn">不需要钢印的人：自然选择号</RouterLink>
        <RouterLink to="/sector-blind" class="plain-btn">智子看不见的地方：盲区</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-stamp { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 60rem; }
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
  border-radius: var(--radius-cut);
  cursor: pointer;
  transition: border-color var(--dur-quick), color var(--dur-quick), opacity 0.6s;
}
.opt:hover:not(:disabled) { border-color: var(--weathered); }
.opt:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.opt:disabled { cursor: default; }
/* 够不着的那一项：被划掉、褪色 */
.opt.slip { color: var(--weathered); text-decoration: line-through; text-decoration-color: var(--rust-bright); opacity: 0.55; }
.opt.landed { border-color: var(--cherenkov); color: var(--cherenkov); }
.slip-note { margin: 1.25rem 0 0; padding-left: 1rem; border-left: 1px solid var(--rust-bright); font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }

.choose, .end { max-width: 46rem; }
.lead, .end p { margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.stamps { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
.stamp-opt {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  font: inherit;
  text-align: left;
  color: var(--bone);
  background: var(--slab);
  border: 1px solid var(--incision-soft);
  border-radius: var(--radius-cut);
  cursor: pointer;
}
.stamp-opt[aria-checked='true'] { border-color: var(--rust-bright); background: var(--slab-raised); }
.stamp-opt:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.s-sent { font-family: var(--font-title); font-weight: 900; font-size: 1.5rem; letter-spacing: 0.1em; }
.s-note { font-size: 0.875rem; line-height: 1.7; color: var(--weathered); }
.warn { margin: 0 0 1rem; font-size: 0.875rem; color: var(--rust-bright); }

.stamping { min-height: 30vh; display: flex; align-items: center; }
.stamping p { margin: 0; font-family: var(--font-serif); color: var(--weathered); letter-spacing: 0.2em; }

/* 写入：那句话从远处压过来，然后淡成背景里的水印 */
.press { position: fixed; inset: 0; z-index: 850; display: flex; align-items: center; justify-content: center; pointer-events: none; background: rgba(10, 10, 11, 0.86); animation: press-bg 2.6s ease-in-out both; }
.press-line { margin: 0; padding: 0 1rem; text-align: center; font-family: var(--font-title); font-weight: 900; font-size: clamp(2.5rem, 9vw, 7rem); letter-spacing: 0.12em; color: var(--bone); animation: press-in 2.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@keyframes press-in {
  0% { opacity: 0; transform: scale(2.4); filter: blur(12px); }
  45% { opacity: 1; transform: scale(1); filter: blur(0); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: scale(0.96); }
}
@keyframes press-bg { 0%, 100% { opacity: 0; } 15%, 85% { opacity: 1; } }
.watermark {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 0;
  margin: 0;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: clamp(3rem, 12vw, 10rem);
  letter-spacing: 0.12em;
  color: var(--bone);
  opacity: 0.045;
  pointer-events: none;
}
.scene, .end { position: relative; z-index: 1; }

.end-title { margin: 0 0 0.75rem; font-family: var(--font-title); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.diff { width: 100%; margin: 0 0 1.25rem; border-collapse: collapse; font-size: 0.9375rem; line-height: 1.7; }
.diff th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 400; font-size: 0.8125rem; color: var(--weathered); border-bottom: 1px solid var(--incision); }
.diff td { padding: 0.75rem; vertical-align: top; color: var(--gray-150); border-bottom: 1px solid var(--incision-soft); }
.diff .d-ask { width: 40%; color: var(--weathered); }
.diff tr.changed td:last-child { color: var(--bone); }
.d-tag { margin-left: 0.5rem; padding: 0 0.4rem; font-size: 0.75rem; color: var(--rust-bright); border: 1px solid var(--rust-bright); border-radius: var(--radius-cut); white-space: nowrap; }
.agreed { font-size: 0.9375rem !important; color: var(--weathered) !important; }
.release { margin: 0 0 1.5rem; }
.released { margin: 0 !important; padding-left: 1rem; border-left: 1px solid var(--rust-bright); }
.end .book { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.end .q { padding-left: 1rem; border-left: 1px solid var(--era-crisis); color: var(--bone); }
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
  border-radius: var(--radius-cut);
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }

@media (max-width: 640px) {
  .diff thead { display: none; }
  .diff tr { display: block; padding: 0.75rem 0; border-bottom: 1px solid var(--incision-soft); }
  .diff td { display: block; padding: 0.15rem 0; border: 0; }
  .diff .d-ask { width: auto; }
  .diff td:nth-child(2)::before { content: '之前：'; color: var(--weathered); }
  .diff td:nth-child(3)::before { content: '之后：'; color: var(--weathered); }
}
@media (prefers-reduced-motion: reduce) {
  .press, .press-line { animation-duration: 0.01s; }
}
</style>
