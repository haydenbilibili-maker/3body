<script setup lang="ts">
/**
 * 三体摆：天气落在整页上。
 * - 三日凌空：上方压下一片白热的光，整页像隔着热浪看（SVG 湍流位移）
 * - 严寒：冷蓝的暗角与霜点，整页失去颜色
 * - 文明脱水：整页像晒干的纸，泛黄、发脆
 * 通过根元素的 data-room-env 切换（样式在 main.css），离开展厅时清除。
 */
import { onUnmounted, watch } from 'vue'

const props = defineProps<{ env: 'stable' | 'heat' | 'cold'; dry: boolean }>()

function apply() {
  const v = props.env === 'heat' ? 'heat' : props.env === 'cold' ? 'cold' : props.dry ? 'dry' : ''
  if (v) document.documentElement.dataset.roomEnv = v
  else delete document.documentElement.dataset.roomEnv
}
watch(() => [props.env, props.dry], apply, { immediate: true })
onUnmounted(() => delete document.documentElement.dataset.roomEnv)
</script>

<template>
  <Teleport to="body">
    <svg class="defs" width="0" height="0" aria-hidden="true">
      <filter id="heat-haze" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="2" seed="3" result="n">
          <animate attributeName="baseFrequency" dur="3s" values="0.004 0.03;0.005 0.036;0.004 0.03" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div class="weather" :class="env === 'stable' ? (dry ? 'dry' : '') : env" aria-hidden="true"></div>
  </Teleport>
</template>

<style scoped>
.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.weather { position: fixed; inset: 0; z-index: 850; pointer-events: none; opacity: 0; transition: opacity 1.2s ease; }
.weather.heat {
  opacity: 1;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(255, 246, 224, 0.55), rgba(255, 200, 120, 0.18) 40%, transparent 70%),
    linear-gradient(180deg, rgba(255, 170, 80, 0.08), transparent 60%);
  mix-blend-mode: screen;
}
.weather.cold {
  opacity: 1;
  background:
    radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(120, 160, 210, 0.35) 100%),
    radial-gradient(circle at 10% 20%, rgba(220, 235, 255, 0.12) 0 2px, transparent 3px) 0 0 / 46px 46px;
}
.weather.dry { opacity: 1; background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(80, 60, 30, 0.35) 100%); }
</style>
