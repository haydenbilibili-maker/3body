<script setup lang="ts">
/**
 * 人类演化树：六个纪元的人类沿一条骨白的主干排下来；读者这一支从危机纪元分出，
 * 画在主干旁边，标出它在「活下去」与「还像地球人」两条轴上的位置。数据见 sim/galaxy.ts。
 */
import { computed } from 'vue'
import { BRANCH_FROM, HUMAN_TREE, branchProfile, outcome } from '@/sim/galaxy'

const props = defineProps<{ choices: number[] }>()
const profile = computed(() => branchProfile(props.choices))
const result = computed(() => outcome(props.choices))
</script>

<template>
  <section class="tree" aria-labelledby="tree-title">
    <h2 id="tree-title" class="t-title">人类演化树</h2>
    <ol class="trunk">
      <li v-for="(n, i) in HUMAN_TREE" :key="n.era" class="node" :class="{ fork: i === BRANCH_FROM }">
        <div class="n-main">
          <span class="n-era">{{ n.era }}</span>
          <h3 class="n-title">{{ n.title }}</h3>
          <p class="n-text">{{ n.text }}</p>
          <p class="n-meta">{{ n.tech }}<span class="sep">·</span>{{ n.culture }}</p>
          <p class="n-quote">「{{ n.quote }}」</p>
        </div>
        <div v-if="i === BRANCH_FROM" class="branch" :class="{ dead: !result.alive }">
          <span class="b-label">你这一支</span>
          <h3 class="b-title">{{ result.title }}</h3>
          <p class="b-culture">{{ result.alive ? profile.culture : '没有后来' }}</p>
          <dl class="axes">
            <div>
              <dt>活下去</dt>
              <dd><span class="bar"><span :style="{ width: profile.survive * 100 + '%' }"></span></span></dd>
            </div>
            <div>
              <dt>还像地球人</dt>
              <dd><span class="bar"><span :style="{ width: profile.bond * 100 + '%' }"></span></span></dd>
            </div>
          </dl>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.tree { margin: 2rem 0; }
.t-title { margin: 0 0 1rem; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.12em; color: var(--bone); }
.trunk { list-style: none; margin: 0; padding: 0 0 0 1.25rem; border-left: 1px solid var(--bone); }
.node { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; padding: 0 0 1.5rem; }
.node::before { content: ''; position: absolute; left: calc(-1.25rem - 4px); top: 0.35rem; width: 7px; height: 7px; background: var(--bone); }
.node.fork { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.n-era { font-family: var(--font-serif); font-size: 0.8125rem; letter-spacing: 0.12em; color: var(--weathered); }
.n-title { margin: 0.15rem 0 0.35rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.125rem; letter-spacing: 0.06em; color: var(--bone); }
.n-text { margin: 0 0 0.35rem; font-size: 0.9375rem; line-height: 1.75; color: var(--gray-150); }
.n-meta { margin: 0 0 0.35rem; font-size: 0.8125rem; color: var(--weathered); }
.sep { margin: 0 0.4rem; }
.n-quote { margin: 0; font-family: var(--font-serif); font-size: 0.9375rem; color: var(--bone); }

/* 读者这一支：从主干横着分出去的一条切伦科夫蓝 */
.branch { position: relative; align-self: start; padding: 1rem 1.1rem; background: var(--slab); border: 1px solid var(--cherenkov); }
.branch::before { content: ''; position: absolute; left: -1rem; top: 1.4rem; width: 1rem; border-top: 1px dashed var(--cherenkov); }
.branch.dead { border-style: dashed; border-color: var(--weathered); }
.branch.dead::before { border-top-color: var(--weathered); }
.b-label { font-size: 0.75rem; letter-spacing: 0.1em; color: var(--cherenkov); }
.dead .b-label { color: var(--weathered); }
.b-title { margin: 0.2rem 0 0.25rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.125rem; color: var(--bone); }
.b-culture { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--gray-150); }
.axes { margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.axes div { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr); align-items: center; gap: 0.5rem; }
.axes dt { font-size: 0.8125rem; color: var(--weathered); }
.axes dd { margin: 0; }
.bar { display: block; height: 4px; background: var(--incision-soft); }
.bar span { display: block; height: 100%; background: var(--cherenkov); }

@media (max-width: 760px) {
  .node.fork { grid-template-columns: 1fr; }
  .branch::before { display: none; }
}
</style>
