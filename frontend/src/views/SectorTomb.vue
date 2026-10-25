<script setup lang="ts">
/**
 * Sector Tomb：文明墓碑
 * 冥王星上的地球文明博物馆，最后选择了最古老的办法：把字刻在石头上。
 * 字刻得越大保存得越久，能写下的就越少。选字号、写留言、按住刻下，再拖动时间看它风化。
 * 逻辑见 sim/stone.ts。
 */
import { computed, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import ChiselStone from '@/components/ChiselStone.vue'
import { sectorByPath } from '@/data/sectors'
import { EPOCHS, SIZES, epochLabel, fit, wear, weathered } from '@/sim/stone'

const question = sectorByPath('/sector-tomb')?.question

const sizeId = ref(2)
const size = computed(() => SIZES[sizeId.value])
const draft = ref('给岁月以文明，而不是给文明以岁月。')
const fitted = computed(() => fit(draft.value, size.value))
const used = computed(() => Array.from(fitted.value.kept.replace(/\s/g, '')).length)

const carved = ref<{ text: string; size: number } | null>(null)
const epoch = ref(0)
const years = computed(() => EPOCHS[epoch.value])
const carvedSize = computed(() => (carved.value ? SIZES[carved.value.size] : size.value))
const shown = computed(() => (carved.value ? weathered(carved.value.text, years.value, carvedSize.value) : ''))
const wornPct = computed(() => Math.round(wear(years.value, carvedSize.value) * 100))

/* 亲手刻：先拿起凿子，在石面上磨；也可以按住让石匠代刻 */
const chiseling = ref(false)
const CHISEL_PX = [14, 18, 26, 42, 64]
function pickChisel() {
  if (fitted.value.kept) chiseling.value = true
}
function carve() {
  chiseling.value = false
  if (!fitted.value.kept) return
  carved.value = { text: fitted.value.kept, size: sizeId.value }
  epoch.value = 0
}
function again() {
  carved.value = null
  epoch.value = 0
}

function life(y: number) {
  if (y >= 1e8) return `约 ${y / 1e8} 亿年`
  if (y >= 1e4) return `约 ${y / 1e4} 万年`
  return `约 ${y} 年`
}

/* ---------- 读者的档案 ---------- */
watch(carved, (c) => {
  if (c) recordAnswer('/sector-tomb', `用「${SIZES[c.size].name}」刻下：${c.text}`)
})
</script>

<template>
  <div class="sector-tomb">
    <SectorHeader
      title="文明墓碑"
      subtitle="冥王星上，人类为自己建了一座博物馆。硬盘、胶片、纸张都撑不过一千万年，最后他们回到了最古老的办法：把字刻在石头上。"
      goal="选字号，写下留给后来者的话，按住刻进石碑；再拖动时间，看看十亿年后还剩下什么。"
      :show-restart="!!carved"
      restart-label="换一块石头"
      @restart="again"
    />

    <div class="work">
      <section v-if="!carved && chiseling" class="compose">
        <ChiselStone :text="fitted.kept" :px="CHISEL_PX[sizeId]" @done="carve" />
        <button type="button" class="plain-btn" @click="chiseling = false">放下凿子</button>
      </section>
      <section v-else-if="!carved" class="compose">
        <fieldset class="sizes">
          <legend>字刻多大</legend>
          <label v-for="s in SIZES" :key="s.id" class="size" :class="{ on: sizeId === s.id }">
            <input v-model.number="sizeId" type="radio" name="size" :value="s.id" />
            <span class="s-name">{{ s.name }}</span>
            <span class="s-meta">刻得下 <b class="num">{{ s.capacity }}</b> 字 · 保存{{ life(s.lifespan) }}</span>
          </label>
        </fieldset>

        <label class="msg">
          <span class="msg-head">留给后来者的话<em class="num" :class="{ over: fitted.lost }">{{ used }} / {{ size.capacity }}</em></span>
          <textarea v-model="draft" rows="4" maxlength="600" aria-label="留给后来者的话"></textarea>
        </label>
        <p class="preview">
          <span class="kept">{{ fitted.kept }}</span><s v-if="fitted.lost" class="lost">{{ fitted.lost }}</s>
        </p>
        <p v-if="fitted.lost" class="note">划掉的部分刻不下。要么换小一点的字，要么想想哪些话最重要。</p>
        <div class="carve-acts">
          <button type="button" class="plain-btn primary" :disabled="!fitted.kept" @click="pickChisel">拿起凿子，亲手刻</button>
          <HoldButton :hold-ms="2000" :disabled="!fitted.kept" @confirm="carve">按住，刻进石碑</HoldButton>
        </div>
      </section>

      <section v-else class="time">
        <Vitrine flush>
          <div class="stone" :class="'sz' + carved.size">
            <p class="engraving" :aria-label="carved.text">{{ shown || '　' }}</p>
            <p v-if="!shown" class="smooth">石面已经磨平了。</p>
          </div>
          <template #caption>{{ SIZES[carved.size].name }}，{{ epochLabel(years) }}，磨损 <span class="num">{{ wornPct }}%</span></template>
        </Vitrine>
        <label class="scrub">
          <span>时间</span>
          <input
            v-model.number="epoch"
            type="range"
            min="0"
            :max="EPOCHS.length - 1"
            step="1"
            :aria-valuetext="epochLabel(years)"
            aria-label="时间"
          />
          <b>{{ epochLabel(years) }}</b>
        </label>

        <div v-if="epoch === EPOCHS.length - 1" class="verdict">
          <p v-if="shown">十亿年后，读到这块石头的人，只知道人类说过这些话：「{{ shown }}」</p>
          <p v-else>十亿年后，这块石头上什么都没有了。字太小，话太多。</p>
          <p class="muted">原著里，为了让文明的记忆留得更久，人们最终发现：能保存上亿年的办法只有一种，把字大大地刻在石头上。代价是能留下的话少得可怜。</p>
          <p class="q">{{ question }}</p>
          <div class="links">
            <button type="button" class="plain-btn" @click="again">换一块石头再刻</button>
            <RouterLink to="/sector-b" class="plain-btn">还有哪些事值得刻：编年史</RouterLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sector-tomb { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 64rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }

.sizes { margin: 0 0 1.5rem; padding: 0; border: 0; display: grid; gap: 0.5rem; }
.sizes legend { margin-bottom: 0.6rem; font-size: 0.9375rem; color: var(--weathered); }
.size { display: flex; align-items: baseline; gap: 1rem; padding: 0.7rem 1rem; border: 1px solid var(--incision-soft); cursor: pointer; }
.size input { position: absolute; opacity: 0; pointer-events: none; }
.size.on { border-color: var(--bone); background: var(--slab); }
.size:focus-within { outline: 1px solid var(--cherenkov); }
.s-name { width: 6rem; font-family: var(--font-serif); font-weight: 600; color: var(--bone); }
.s-meta { font-size: 0.875rem; color: var(--weathered); }
.s-meta b { font-weight: 400; color: var(--bone); }

.msg { display: block; }
.msg-head { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.9375rem; color: var(--weathered); }
.msg-head em { font-style: normal; }
.msg-head em.over { color: var(--rust-bright); }
textarea {
  width: 100%;
  padding: 0.75rem 0.9rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  line-height: 1.8;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision);
  border-radius: 2px;
  resize: vertical;
}
textarea:focus { outline: none; border-color: var(--cherenkov); }
.preview { margin: 0.9rem 0 0.4rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.8; word-break: break-all; }
.kept { color: var(--bone); }
.lost { color: var(--weathered); opacity: 0.7; }
.note { margin: 0 0 1rem; font-size: 0.875rem; color: var(--weathered); }

.stone {
  position: relative;
  min-height: 18rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 2rem;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.05), transparent 55%),
    radial-gradient(ellipse at 80% 90%, rgba(0, 0, 0, 0.35), transparent 60%),
    #2a2b2e;
}
.engraving {
  margin: 0;
  max-width: 40rem;
  text-align: center;
  font-family: var(--font-serif);
  font-weight: 900;
  color: #c9c3b4;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.08), 0 -1px 0 rgba(0, 0, 0, 0.6);
  word-break: break-all;
  white-space: pre-wrap;
}
.sz0 .engraving { font-size: 0.75rem; font-weight: 400; line-height: 1.6; }
.sz1 .engraving { font-size: 0.9375rem; font-weight: 600; line-height: 1.8; }
.sz2 .engraving { font-size: 1.375rem; line-height: 1.9; letter-spacing: 0.06em; }
.sz3 .engraving { font-size: 2.25rem; line-height: 1.6; letter-spacing: 0.1em; }
.sz4 .engraving { font-size: 3.75rem; line-height: 1.4; letter-spacing: 0.15em; }
.smooth { margin: 0; font-family: var(--font-serif); color: var(--weathered); }

.scrub { display: flex; align-items: center; gap: 1rem; margin: 1.25rem 0 0; font-size: 0.9375rem; color: var(--weathered); }
.scrub input { flex: 1; accent-color: var(--cherenkov); }
.scrub b { min-width: 7rem; font-family: var(--font-serif); font-weight: 600; color: var(--bone); text-align: right; }

.verdict { max-width: 42rem; margin-top: 2rem; }
.verdict p { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.verdict .muted { font-family: var(--font-sans); font-size: 0.9375rem; color: var(--weathered); }
.verdict .q { margin-top: 1.25rem; padding-left: 1rem; border-left: 1px solid var(--era-bunker); color: var(--bone); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

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

@media (max-width: 640px) {
  .size { flex-direction: column; gap: 0.2rem; }
  .sz3 .engraving { font-size: 1.75rem; }
  .sz4 .engraving { font-size: 2.5rem; }
  .scrub { flex-wrap: wrap; }
  .scrub b { text-align: left; }
}
.carve-acts { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
.compose > .plain-btn { margin-top: 1rem; }
.plain-btn.primary { border-color: var(--cherenkov); color: var(--cherenkov); }
.plain-btn:disabled { opacity: 0.45; cursor: default; }
</style>
