<script setup lang="ts">
/**
 * Sector Human：银河人类
 * 你在一艘离开太阳系、再也回不去的战舰上，要做四个决定。
 * 每个决定都在「活下去」和「还像地球人」之间取舍；结局回到那个问题：离开地球的人，还是人类吗？
 * 逻辑见 sim/galaxy.ts。
 */
import { computed, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import HumanTree from '@/components/HumanTree.vue'
import { sectorByPath } from '@/data/sectors'
import { STEPS, outcome } from '@/sim/galaxy'

const question = sectorByPath('/sector-human')?.question
const choices = ref<number[]>([])
const step = computed(() => choices.value.length)
const finished = computed(() => step.value >= STEPS.length)
const result = computed(() => (finished.value ? outcome(choices.value) : null))
/** 离地球的距离（光年），只是为了让每一步都更远 */
const DIST = [0.01, 4.2, 23, 160, 420]

function pick(i: number) {
  if (finished.value) return
  choices.value = [...choices.value, i]
}
function restart() {
  choices.value = []
}

/* ---------- 读者的档案 ---------- */
watch(result, (r) => {
  if (r) recordAnswer('/sector-human', `离开地球之后的结局：${r.title}`)
})
</script>

<template>
  <div class="sector-human">
    <SectorHeader
      title="银河人类"
      subtitle="末日战役之后，有几艘战舰逃出了太阳系。它们再也没有回来，地球上的人很快开始争论：船上的人，还算不算人类。"
      goal="你在其中一艘船上。做四个决定，每一个都在「活下去」和「还像地球人」之间取舍。"
      :show-restart="choices.length > 0"
      restart-label="回到启程"
      @restart="restart"
    />

    <div class="voyage">
      <ol class="log" aria-label="航行记录">
        <li v-for="(c, i) in choices" :key="i" class="entry">
          <p class="dist">离地球 <span class="num">{{ DIST[i] }}</span> 光年</p>
          <p class="scene">{{ STEPS[i].scene }}</p>
          <p class="chosen">你选择了：{{ STEPS[i].options[c].text }}</p>
          <p class="after">{{ STEPS[i].options[c].after }}</p>
        </li>
      </ol>

      <Vitrine v-if="!finished" class="now">
        <p class="dist">离地球 <span class="num">{{ DIST[step] }}</span> 光年 · 第 {{ step + 1 }} / {{ STEPS.length }} 个决定</p>
        <p class="scene big">{{ STEPS[step].scene }}</p>
        <div class="opts">
          <template v-for="(o, i) in STEPS[step].options" :key="step + '-' + i">
            <HoldButton v-if="o.grave" tone="rust" :hold-ms="1800" @confirm="pick(i)">按住，{{ o.text }}</HoldButton>
            <button v-else type="button" class="opt" @click="pick(i)">{{ o.text }}</button>
          </template>
        </div>
      </Vitrine>

      <section v-else-if="result" class="end">
        <p class="dist">离地球 <span class="num">{{ DIST[STEPS.length] }}</span> 光年</p>
        <h2 class="end-title">{{ result.title }}</h2>
        <p class="end-text">{{ result.text }}</p>
        <HumanTree :choices="choices" />
        <p class="book">在原著里，逃出太阳系的「蓝色空间」号与「万有引力」号在宇宙深处活了下来；后来又有星环号这样的光速飞船离开。太阳系跌入二维之后，散落在银河里的这些人，就是全部的人类。他们说的还是地球上的语言，记得的也还是地球上的事。</p>
        <p class="q">{{ question }}</p>
        <div class="links">
          <button type="button" class="plain-btn" @click="restart">再走一次</button>
          <RouterLink to="/sector-l" class="plain-btn">他们是怎么离开的：曲率驱动</RouterLink>
          <RouterLink to="/sector-u" class="plain-btn">更远的地方：647 号小宇宙</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sector-human { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 56rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.log { list-style: none; margin: 0 0 1.5rem; padding: 0; border-left: 1px solid var(--incision); }
.entry { padding: 0 0 1.25rem 1.25rem; position: relative; }
.entry::before { content: ''; position: absolute; left: -4px; top: 0.45rem; width: 7px; height: 7px; background: #b7a2b8; }
.entry .scene { margin: 0.25rem 0; font-size: 0.9375rem; line-height: 1.75; color: var(--weathered); }
.chosen { margin: 0.25rem 0; font-size: 0.9375rem; color: var(--bone); }
.after { margin: 0; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }
.dist { margin: 0; font-size: 0.8125rem; color: var(--weathered); }

.scene.big { margin: 0.75rem 0 1.25rem; font-family: var(--font-serif); font-size: 1.1875rem; line-height: 1.9; color: var(--bone); }
.opts { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.opt {
  padding: 0.65rem 1.2rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.opt:hover { border-color: var(--weathered); }

.end { padding-top: 0.5rem; }
.end-title { margin: 0.5rem 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 2rem; letter-spacing: 0.12em; color: var(--bone); }
.end p { max-width: 42rem; }
.end-text { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.95; color: var(--bone); }
.book { margin: 0 0 1rem; font-size: 0.9375rem; line-height: 1.85; color: var(--weathered); }
.q { margin: 1.25rem 0 0; padding-left: 1rem; border-left: 1px solid var(--era-galaxy); font-family: var(--font-serif); font-size: 1.0625rem; color: var(--bone); }
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
</style>
