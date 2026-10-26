<script setup lang="ts">
/**
 * 墓志铭墙：别的文明最后留下的话。点「借用这一句」会把它放进读者的草稿里。
 */
import { EPITAPHS } from '@/sim/epitaphs'

defineEmits<{ borrow: [line: string] }>()
</script>

<template>
  <section class="wall" aria-labelledby="wall-title">
    <h2 id="wall-title" class="w-title">已知灭绝文明</h2>
    <p class="w-lead">在刻下自己的之前，先读别人的。宇宙里，每一个文明最后都只剩一句话。</p>
    <ul class="stones">
      <li v-for="e in EPITAPHS" :key="e.name" class="stone">
        <p class="s-line">「{{ e.line }}」</p>
        <h3 class="s-name">{{ e.name }}</h3>
        <p class="s-meta">{{ e.era }} · {{ e.cause }}</p>
        <p class="s-life">{{ e.life }}</p>
        <button type="button" class="s-borrow" @click="$emit('borrow', e.line)">借用这一句</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.wall { margin: 0 0 2.5rem; }
.w-title { margin: 0 0 0.4rem; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.12em; color: var(--bone); }
.w-lead { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.85; color: var(--gray-150); }
.stones { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
.stone { display: flex; flex-direction: column; gap: 0.35rem; padding: 1.1rem 1.1rem 1rem; background: var(--slab); border: 1px solid var(--incision-soft); border-top: 3px solid var(--weathered); }
.s-line { margin: 0 0 0.3rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.0625rem; line-height: 1.6; letter-spacing: 0.04em; color: var(--bone); }
.s-name { margin: 0; font-family: var(--font-serif); font-size: 0.9375rem; color: var(--bone); }
.s-meta { margin: 0; font-size: 0.8125rem; color: var(--weathered); }
.s-life { margin: 0.2rem 0 0.4rem; font-size: 0.875rem; line-height: 1.7; color: var(--gray-150); }
.s-borrow { align-self: flex-start; margin-top: auto; padding: 0.25rem 0.6rem; font: inherit; font-size: 0.8125rem; color: var(--weathered); background: none; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.s-borrow:hover { color: var(--bone); border-color: var(--weathered); }
.s-borrow:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
@media (max-width: 900px) { .stones { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .stones { grid-template-columns: 1fr; } }
</style>
