<script setup lang="ts">
/**
 * 三体·深时 标志（见 VI「标志」）：一圈轨道和三颗大小不同、位置不对称的天体。
 * 没有稳定的构型，这就是三体。轨道上最小的那颗是唯一可以发光的点（切伦科夫蓝）。
 * 轨道与两颗星取 currentColor；lit=false 时第三颗星也取 currentColor（单色版）。
 * 不旋转、不加描边、不改变三颗星的位置关系。
 */
withDefaults(defineProps<{ size?: number; lit?: boolean }>(), { size: 24, lit: true })
</script>

<template>
  <svg
    class="brand-mark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" :stroke-width="size < 32 ? 6 : 2" />
    <circle cx="40" cy="52" r="10" fill="currentColor" />
    <circle cx="86" cy="76" r="7" fill="currentColor" />
    <circle cx="67.6" cy="16.7" :r="size < 32 ? 8 : 5" :fill="lit ? 'var(--cherenkov)' : 'currentColor'" />
  </svg>
</template>

<style scoped>
.brand-mark { display: block; flex: none; overflow: visible; }
</style>
