<script setup lang="ts">
/**
 * 展柜：装游戏、仪器与展品的框。碑面底色、1px 刻痕边框、四角各一段刻度；
 * 下方可选一块铭牌（#caption 插槽或 caption 参数），写这件展品是什么、怎么用，三行以内。
 */
defineProps<{ caption?: string; flush?: boolean }>()
</script>

<template>
  <figure class="vitrine" :class="{ flush }">
    <div class="vitrine-body">
      <span class="tick tl" aria-hidden="true"></span>
      <span class="tick tr" aria-hidden="true"></span>
      <span class="tick bl" aria-hidden="true"></span>
      <span class="tick br" aria-hidden="true"></span>
      <slot />
    </div>
    <figcaption v-if="caption || $slots.caption" class="vitrine-caption">
      <slot name="caption">{{ caption }}</slot>
    </figcaption>
  </figure>
</template>

<style scoped>
.vitrine { margin: 0; }
.vitrine-body {
  position: relative;
  padding: 1.5rem;
  background: var(--slab);
  border: 1px solid var(--incision-soft);
}
.flush .vitrine-body { padding: 0; }
.tick {
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: var(--weathered);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}
.tl { top: -1px; left: -1px; border-top-width: 1px; border-left-width: 1px; }
.tr { top: -1px; right: -1px; border-top-width: 1px; border-right-width: 1px; }
.bl { bottom: -1px; left: -1px; border-bottom-width: 1px; border-left-width: 1px; }
.br { bottom: -1px; right: -1px; border-bottom-width: 1px; border-right-width: 1px; }
.vitrine-caption {
  max-width: 40rem;
  margin-top: 0.75rem;
  padding-left: 0.9rem;
  border-left: 1px solid var(--incision);
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--weathered);
}
@media (max-width: 768px) {
  .vitrine-body { padding: 1rem; }
  .flush .vitrine-body { padding: 0; }
}
</style>
