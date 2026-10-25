<script setup lang="ts">
/**
 * Sector Tale：童话
 * 广播纪元。云天明在智子的监视下，给程心讲了三个童话；情报全藏在故事里。
 * 读者是情报解读委员会的一员：为每个童话挑一个意象、选一种读法写进报告，然后等待历史证实。
 * 逻辑与转述文字见 sim/tale.ts。
 */
import { computed, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'
import { TALES, judge, segments, type Image, type Report } from '@/sim/tale'

const question = sectorByPath('/sector-tale')?.question

type Act = 'read' | 'reveal'
const act = ref<Act>('read')
const report = ref<Report>({})
/** 每个童话当前展开的意象 */
const open = ref<Record<string, string | null>>({})

const filled = computed(() => TALES.filter((t) => report.value[t.id]).length)
const verdicts = computed(() => judge(report.value))
const confirmed = computed(() => verdicts.value.filter((v) => v.confirmed).length)

function toggleImage(taleId: string, img: Image) {
  open.value = { ...open.value, [taleId]: open.value[taleId] === img.id ? null : img.id }
}
function choose(taleId: string, imageId: string, readingId: string) {
  report.value = { ...report.value, [taleId]: { image: imageId, reading: readingId } }
  /* 写进报告之后收起读法，故事回到原样；报告栏里能看到写下了什么，再点一次意象可以改 */
  open.value = { ...open.value, [taleId]: null }
}
function picked(taleId: string) {
  const p = report.value[taleId]
  if (!p) return null
  const t = TALES.find((x) => x.id === taleId)!
  const img = t.images.find((i) => i.id === p.image)!
  return { img, reading: img.readings.find((r) => r.id === p.reading)! }
}
function submit() {
  act.value = 'reveal'
  const words = TALES.map((t) => picked(t.id)?.img.word).filter(Boolean)
  recordAnswer('/sector-tale', `报告里写下了「${words.join('」「')}」；${confirmed.value} 条后来被证实`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function restart() {
  act.value = 'read'
  report.value = {}
  open.value = {}
}
</script>

<template>
  <div class="sector-tale">
    <SectorHeader
      title="童话"
      subtitle="云天明的大脑被三体舰队截获，多年以后，他获准与程心见面。智子在听，他不能说出任何情报，于是讲了三个童话。情报解读委员会要从故事里找出他想说的话。"
      goal="为每个童话挑出一个藏着情报的意象，从委员会成员的三种读法里选一种写进报告；交出报告之后，等待历史证实。"
      :show-restart="act === 'reveal' || filled > 0"
      restart-label="回到三个童话"
      @restart="restart"
    />

    <div v-if="act === 'read'" class="desk">
      <div class="tales">
        <Vitrine v-for="(t, ti) in TALES" :key="t.id" class="tale">
          <p class="t-step">第 {{ ti + 1 }} 个童话</p>
          <h2 class="t-title">{{ t.title }}</h2>
          <p class="t-body">
            <template v-for="(s, si) in segments(t)" :key="si">
              <template v-if="'text' in s">{{ s.text }}</template>
              <button
                v-else
                type="button"
                class="img"
                :class="{ open: open[t.id] === s.image.id, chosen: report[t.id]?.image === s.image.id }"
                :aria-expanded="open[t.id] === s.image.id"
                @click="toggleImage(t.id, s.image)"
              >{{ s.image.word }}</button>
            </template>
          </p>

          <div v-for="img in t.images" v-show="open[t.id] === img.id" :key="img.id" class="council" role="radiogroup" :aria-label="`委员会对「${img.word}」的读法`">
            <p class="c-head">委员会对「{{ img.word }}」的三种读法</p>
            <button
              v-for="r in img.readings"
              :key="r.id"
              type="button"
              role="radio"
              class="reading"
              :aria-checked="report[t.id]?.image === img.id && report[t.id]?.reading === r.id"
              @click="choose(t.id, img.id, r.id)"
            >
              <span class="r-by">{{ r.by }}</span>
              <span class="r-text">{{ r.text }}</span>
            </button>
          </div>
          <template #caption>点故事里带下划线的词，看看委员会怎么读它。每个童话只能写进一条。</template>
        </Vitrine>
      </div>

      <aside class="report" aria-label="你的报告">
        <h2 class="rp-title">报告</h2>
        <ol class="slots">
          <li v-for="t in TALES" :key="t.id" :class="{ done: report[t.id] }">
            <span class="s-tale">{{ t.title }}</span>
            <template v-if="picked(t.id)">
              <span class="s-img">「{{ picked(t.id)!.img.word }}」</span>
              <span class="s-read">{{ picked(t.id)!.reading.text }}</span>
            </template>
            <span v-else class="s-empty">还没有写</span>
          </li>
        </ol>
        <p class="rp-note">智子会读到这份报告。委员会能做的，只有把读法写下来，交给后来的人去证实。</p>
        <HoldButton :hold-ms="1800" :disabled="filled < TALES.length" @confirm="submit">按住，交出报告</HoldButton>
        <p v-if="filled < TALES.length" class="rp-left">还差 <span class="num">{{ TALES.length - filled }}</span> 个童话</p>
      </aside>
    </div>

    <section v-else class="reveal" aria-live="polite">
      <p class="rv-lead">多年以后</p>
      <ol class="verdicts">
        <li v-for="(v, i) in verdicts" :key="v.tale.id" class="verdict" :class="{ yes: v.confirmed }" :style="{ '--d': i * 0.9 + 's' }">
          <div class="v-head">
            <h3 class="v-title">{{ v.tale.title }}</h3>
            <span class="v-state">{{ v.confirmed ? '被证实了' : '没有被证实' }}</span>
          </div>
          <p class="v-mine">你写下的是「{{ v.image?.word }}」：{{ v.reading?.text }}</p>
          <p class="v-truth">{{ v.tale.reveal }}</p>
        </li>
      </ol>
      <div class="end">
        <h2 class="end-title">{{ confirmed === 3 ? '你读懂了他' : confirmed === 0 ? '故事还是故事' : `读懂了 ${confirmed} 个` }}</h2>
        <p>
          {{
            confirmed === 3
              ? '你的报告里，三条读法都在后来被证实。可在交出报告的那一天，没有人知道哪一条是对的，包括你自己。'
              : '你的报告里有 ' + confirmed + ' 条读法后来被证实。交出报告的那一天，每一种读法都同样像真的。'
          }}
        </p>
        <p class="book">原著里，委员会花了很多年，才把三个童话读成降维打击、曲率驱动与黑域。大部分情报被读懂的时候，已经来不及了。</p>
        <p class="q">{{ question }}</p>
        <div class="links">
          <button type="button" class="plain-btn" @click="restart">回到三个童话</button>
          <RouterLink to="/sector-s" class="plain-btn">讲故事的人：阶梯计划</RouterLink>
          <RouterLink to="/sector-d" class="plain-btn">第一个童话的答案：二向箔画廊</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-tale { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.desk { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem); gap: 2rem; align-items: start; }
.tales { display: flex; flex-direction: column; gap: 1.75rem; min-width: 0; }
.t-step { margin: 0 0 0.25rem; font-size: 0.8125rem; color: var(--weathered); }
.t-title { margin: 0 0 1rem; font-family: var(--font-title); font-weight: 900; font-size: 1.5rem; letter-spacing: 0.1em; color: var(--bone); }
.t-body { margin: 0; font-family: var(--font-serif); font-size: 1.125rem; line-height: 2.1; color: var(--gray-150); }

/* 意象：骨白虚线下划线；展开时是纪元色，写进报告后是切伦科夫蓝 */
.img {
  padding: 0 0.1em;
  font: inherit;
  color: var(--bone);
  background: none;
  border: 0;
  border-bottom: 1px dashed var(--weathered);
  cursor: pointer;
}
.img:hover, .img.open { border-bottom-color: var(--sector-accent, var(--era-broadcast)); color: var(--era-broadcast); }
.img.chosen { color: var(--cherenkov); border-bottom: 1px solid var(--cherenkov); }
.img:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }

.council { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--incision); display: flex; flex-direction: column; gap: 0.6rem; }
.c-head { margin: 0 0 0.25rem; font-size: 0.875rem; color: var(--weathered); }
.reading {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  font: inherit;
  text-align: left;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision-soft);
  border-radius: var(--radius-cut);
  cursor: pointer;
}
.reading:hover { border-color: var(--weathered); }
.reading[aria-checked='true'] { border-color: var(--cherenkov); background: var(--slab-raised); }
.reading:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.r-by { font-size: 0.8125rem; letter-spacing: 0.06em; color: var(--era-broadcast); }
.r-text { font-size: 0.9375rem; line-height: 1.7; }

.report { position: sticky; top: 5rem; display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.rp-title { margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 1.25rem; letter-spacing: 0.16em; color: var(--bone); }
.slots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.slots li { display: flex; flex-direction: column; gap: 0.15rem; padding-left: 0.75rem; border-left: 1px solid var(--incision); }
.slots li.done { border-left-color: var(--cherenkov); }
.s-tale { font-size: 0.8125rem; color: var(--weathered); }
.s-img { font-family: var(--font-serif); color: var(--cherenkov); }
.s-read { font-size: 0.875rem; line-height: 1.6; color: var(--gray-150); }
.s-empty { font-size: 0.875rem; color: var(--weathered); }
.rp-note { margin: 0; font-size: 0.8125rem; line-height: 1.7; color: var(--weathered); }
.rp-left { margin: 0; font-size: 0.8125rem; color: var(--weathered); }

.reveal { max-width: 52rem; }
.rv-lead { margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 0.875rem; letter-spacing: 0.3em; color: var(--weathered); }
.verdicts { list-style: none; margin: 0 0 2rem; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.verdict { padding: 1.25rem 1.5rem; background: var(--slab); border: 1px solid var(--incision-soft); animation: arrive 1.1s ease-out both; animation-delay: var(--d); }
.verdict.yes { border-color: var(--cherenkov); }
@keyframes arrive { from { opacity: 0; filter: blur(6px); } }
.v-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.v-title { margin: 0; font-family: var(--font-serif); font-weight: 900; font-size: 1.125rem; letter-spacing: 0.08em; color: var(--bone); }
.v-state { font-size: 0.875rem; color: var(--weathered); }
.yes .v-state { color: var(--cherenkov); }
.v-mine { margin: 0.6rem 0 0; font-size: 0.9375rem; line-height: 1.75; color: var(--gray-150); }
.v-truth { margin: 0.5rem 0 0; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--bone); }

.end-title { margin: 0 0 1rem; font-family: var(--font-title); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.12em; color: var(--bone); }
.end p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.end .book { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.end .q { padding-left: 1rem; border-left: 1px solid var(--era-broadcast); color: var(--bone); }
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

@media (max-width: 900px) {
  .desk { grid-template-columns: 1fr; }
  .report { position: static; }
}
@media (prefers-reduced-motion: reduce) {
  .verdict { animation: none; }
}
</style>
