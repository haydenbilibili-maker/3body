<script setup lang="ts">
/**
 * SectorHeader — 扇区统一页头。
 *
 * 结构：代号行（英文、等宽、主题色）→ 中文主标题 → 副标题 → 「本局目标」一句话。
 * 右侧可放状态标签（#meta 插槽）与「重新开始」按钮。
 * 主题色通过 accent 传入，写入 --sector-accent，页面其他元素也可以复用。
 *
 * 对应 docs/DEVELOPMENT-RULES.md「游戏化原则」：每个子模块首屏一句「本局目标」，
 * 并提供显眼的「再玩一局」入口。
 */
withDefaults(
  defineProps<{
    /** 代号行，如 "SECTOR E · DARK FOREST" */
    code: string
    /** 中文主标题 */
    title: string
    subtitle?: string
    /** 本局目标：一句话说清怎么算赢 */
    goal?: string
    accent?: string
    showRestart?: boolean
    restartLabel?: string
    /** 窄容器（如侧栏）里使用：纵向排列、字号略小 */
    compact?: boolean
  }>(),
  {
    subtitle: undefined,
    goal: undefined,
    accent: 'var(--holo-blue)',
    showRestart: false,
    restartLabel: '重新开始',
    compact: false,
  },
)

defineEmits<{ restart: [] }>()
</script>

<template>
  <header class="sector-header" :class="{ compact }" :style="{ '--sector-accent': accent }">
    <div class="sh-row">
      <div class="sh-main">
        <p class="sh-code">{{ code }}</p>
        <h1 class="sh-title">{{ title }}</h1>
        <p v-if="subtitle" class="sh-subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.meta || showRestart" class="sh-meta">
        <slot name="meta" />
        <button v-if="showRestart" type="button" class="sh-restart" @click="$emit('restart')">
          <span aria-hidden="true">↻</span> {{ restartLabel }}
        </button>
      </div>
    </div>
    <p v-if="goal" class="sh-goal">
      <span class="sh-goal-label">本局目标</span>
      <span class="sh-goal-text">{{ goal }}</span>
    </p>
  </header>
</template>

<style scoped>
.sector-header {
  --sh-line: color-mix(in srgb, var(--sector-accent) 28%, transparent);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--sh-line);
  position: relative;
  z-index: 2;
}

.sh-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem 1.5rem;
  flex-wrap: wrap;
}

.sh-main {
  min-width: 0;
}

.sh-code {
  margin: 0 0 0.35rem;
  font-family: var(--font-title);
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sector-accent);
}

.sh-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1.25;
  color: #f2fbff;
  text-shadow: 0 0 18px color-mix(in srgb, var(--sector-accent) 35%, transparent);
}

.sh-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  color: rgba(224, 255, 248, 0.68);
}

.sh-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sh-restart {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--sector-accent);
  background: color-mix(in srgb, var(--sector-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--sector-accent) 45%, transparent);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.sh-restart:hover {
  background: color-mix(in srgb, var(--sector-accent) 18%, transparent);
  border-color: var(--sector-accent);
}
.sh-restart:focus-visible {
  outline: 2px solid var(--sector-accent);
  outline-offset: 2px;
}

.sh-goal {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.95rem;
  line-height: 1.55;
  color: rgba(224, 255, 248, 0.88);
}

.sh-goal-label {
  flex-shrink: 0;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--gray-950);
  background: var(--sector-accent);
  border-radius: 3px;
}

.compact .sh-row {
  flex-direction: column;
  align-items: flex-start;
}
.compact .sh-title {
  font-size: 1.5rem;
}
.compact .sh-goal {
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
}

@media (max-width: 768px) {
  .sh-goal {
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
  }
}
</style>
