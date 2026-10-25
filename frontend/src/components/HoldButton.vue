<script setup lang="ts">
/**
 * 按住确认：不可逆的操作必须按住一段时间才会发生，进度在按钮内填满。
 * 键盘（Enter / 空格）激活时直接触发，保证无指针设备可用。
 * tone="rust" 用于危险与不可逆（红岸色），默认是切伦科夫蓝。
 */
import { onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{ holdMs?: number; tone?: 'light' | 'rust'; disabled?: boolean }>(), {
  holdMs: 1100,
  tone: 'light',
  disabled: false,
})
const emit = defineEmits<{ confirm: [] }>()

const progress = ref(0)
let start = 0
let raf = 0

function tick(now: number) {
  progress.value = Math.min(1, (now - start) / props.holdMs)
  if (progress.value >= 1) {
    progress.value = 0
    emit('confirm')
    return
  }
  raf = requestAnimationFrame(tick)
}
function down(e: PointerEvent) {
  if (props.disabled || e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  start = performance.now()
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}
function up() {
  cancelAnimationFrame(raf)
  progress.value = 0
}
function click(e: MouseEvent) {
  if (!props.disabled && e.detail === 0) emit('confirm')
}
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <button
    type="button"
    class="hold"
    :class="`tone-${tone}`"
    :disabled="disabled"
    :style="{ '--p': progress }"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="up"
    @pointerleave="up"
    @click="click"
  >
    <span class="hold-fill" aria-hidden="true"></span>
    <span class="hold-label"><slot /></span>
  </button>
</template>

<style scoped>
.hold {
  --tone: var(--cherenkov);
  --tone-rgb: var(--cherenkov-rgb);
  position: relative;
  overflow: hidden;
  padding: 0.8rem 1.6rem;
  font: inherit;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: var(--tone);
  background: rgba(var(--tone-rgb), 0.06);
  border: 1px solid var(--tone);
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
}
.tone-rust {
  --tone: var(--rust-bright);
  --tone-rgb: 210, 85, 63;
}
.hold:disabled { opacity: 0.4; cursor: not-allowed; }
.hold:focus-visible { outline: 1px solid var(--tone); outline-offset: 3px; }
.hold-fill {
  position: absolute;
  inset: 0;
  transform-origin: left;
  transform: scaleX(var(--p));
  background: rgba(var(--tone-rgb), 0.35);
}
.hold-label { position: relative; }
</style>
