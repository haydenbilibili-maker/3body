<script setup lang="ts">
/**
 * SectorHeader v2 —— 展厅页头（冥王星档案馆视觉方案）。
 *
 * 自上而下：时间坐标（纪元）→ 碑刻标题 → 一句话 → 这间展厅提出的问题 → 怎么玩 / 状态 / 再来一次。
 * 纪元与问题默认从 data/sectors.ts 按当前路由读取，也可以用 props 覆盖。
 * 旧的 code（英文代号）参数仍然接受，但不再显示。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { eraById, sectorByPath } from '@/data/sectors'

const props = withDefaults(
  defineProps<{
    /** 已停用：英文代号不再显示，保留参数以兼容旧调用 */
    code?: string
    title: string
    subtitle?: string
    /** 怎么玩：一句话说清怎么算赢 */
    goal?: string
    /** 覆盖登记表里的问题 */
    question?: string
    accent?: string
    showRestart?: boolean
    restartLabel?: string
    /** 窄容器（如侧栏）里使用：字号略小 */
    compact?: boolean
  }>(),
  {
    code: undefined,
    subtitle: undefined,
    goal: undefined,
    question: undefined,
    accent: undefined,
    showRestart: false,
    restartLabel: '再来一次',
    compact: false,
  },
)

defineEmits<{ restart: [] }>()

const route = useRoute()
const sector = computed(() => sectorByPath(route.path))
const eraName = computed(() => {
  const era = sector.value?.era
  if (!era) return ''
  return era === 'all' ? '跨越全部纪元' : eraById(era)?.name ?? ''
})
const questionText = computed(() => props.question ?? sector.value?.question)
/* 纪元色：没有显式传入时按展厅所在纪元取（VI：每间展厅唯一的场景色） */
const accentColor = computed(() => {
  if (props.accent) return props.accent
  const era = sector.value?.era
  if (!era) return 'var(--cherenkov)'
  return `var(--era-${era === 'all' ? 'archive' : era})`
})
</script>

<template>
  <header class="sector-header" :class="{ compact }" :style="{ '--sector-accent': accentColor }">
    <p v-if="eraName" class="sh-era"><span class="sh-era-mark" aria-hidden="true"></span>{{ eraName }}</p>
    <h1 class="sh-title">{{ title }}</h1>
    <p v-if="subtitle" class="sh-subtitle">{{ subtitle }}</p>
    <p v-if="questionText" class="sh-question">{{ questionText }}</p>

    <div v-if="goal || $slots.meta || showRestart" class="sh-foot">
      <p v-if="goal" class="sh-goal"><span class="sh-goal-label">怎么玩</span>{{ goal }}</p>
      <div v-if="$slots.meta || showRestart" class="sh-meta">
        <slot name="meta" />
        <button v-if="showRestart" type="button" class="sh-restart" @click="$emit('restart')">{{ restartLabel }}</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.sector-header {
  position: relative;
  z-index: 2;
  min-width: 0;
  max-width: 52rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--incision);
}

/* 时间坐标：信息，不是装饰 */
.sh-era {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 0.9rem;
  font-family: var(--font-serif);
  font-size: 0.875rem;
  letter-spacing: 0.12em;
  color: var(--weathered);
}
.sh-era-mark {
  width: 1.5rem;
  height: 1px;
  background: var(--weathered);
}

/* 碑刻标题：宋体 900，由模糊变清晰地出现（远处的光抵达） */
.sh-title {
  margin: 0;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: clamp(2.25rem, 4.2vw, 3.5rem);
  line-height: 1.15;
  letter-spacing: 0.08em;
  color: var(--bone);
  text-transform: none;
  animation: light-arrives 0.9s ease-out both;
}
@keyframes light-arrives {
  from { opacity: 0; filter: blur(8px); letter-spacing: 0.16em; }
  to { opacity: 1; filter: blur(0); letter-spacing: 0.08em; }
}

.sh-subtitle {
  margin: 0.75rem 0 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--weathered);
}

/* 这间展厅提出的问题：最重要的一句话 */
.sh-question {
  margin: 1.25rem 0 0;
  max-width: 36em;
  font-family: var(--font-serif);
  font-size: clamp(1.125rem, 1.6vw, 1.375rem);
  line-height: 1.7;
  color: var(--bone);
}

.sh-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem 2rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
}
.sh-goal {
  /* 不用固定的 flex-basis：它会撑大页头的最小宽度，在手机上把整页挤出屏幕 */
  flex: 1 1 auto;
  min-width: 0;
  max-width: 44rem;
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--gray-200);
}
.sh-goal-label {
  margin-right: 0.75rem;
  padding-right: 0.75rem;
  border-right: 1px solid var(--incision);
  color: var(--sector-accent);
}

.sh-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.sh-restart {
  padding: 0.45rem 1rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.sh-restart:hover { border-color: var(--sector-accent); color: var(--white); }
.sh-restart:focus-visible { outline: 1px solid var(--sector-accent); outline-offset: 2px; }

.compact .sh-title { font-size: 2rem; }
.compact .sh-question { font-size: 1.0625rem; }

@media (max-width: 768px) {
  .sector-header { margin-bottom: 1.5rem; padding-bottom: 1.25rem; }
  .sh-title { font-size: 2.125rem !important; letter-spacing: 0.06em !important; }
}
</style>
