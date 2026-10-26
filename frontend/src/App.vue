<script setup lang="ts">
/**
 * App.vue - 全局配置
 * 强制暗色 + 切伦科夫蓝主色，MainLayout 负责沉浸式背景与状态栏。
 * 零点计划：全服共振状态注入 + 三体摆环境系统
 */
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import { computed } from 'vue'
import MainLayout from '@/layouts/MainLayout.vue'
import { useUniverseStore } from '@/stores/universe'

const universe = useUniverseStore()

const appClass = computed(() => {
  const classes = [`theme-tint-${universe.themeTint}`]
  if (universe.resonanceState === '2d') classes.push('resonance-2d')
  if (universe.resonanceState === '1d') classes.push('resonance-1d')
  
  // Phase 1.2: Environment System
  if (universe.dehydrated) classes.push('mode-dehydrated')
  else if (universe.environment === 'cold') classes.push('env-cold')
  else if (universe.environment === 'heat') classes.push('env-heat')
  else if (universe.environment === 'rip') classes.push('env-rip')
  
  // Phase 1.7: Mental Seal Filter
  if (universe.mentalSeal) {
    classes.push(`seal-${universe.mentalSeal.seal_type.toLowerCase()}`)
  }
  
  return classes
})

// Naive UI 主题：跟随冥王星档案馆色板（切伦科夫蓝为唯一的光，碑面底色，2px 圆角，宋体不用于控件）
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7DB8FF',
    primaryColorHover: '#A3CCFF',
    primaryColorPressed: '#5A9AE6',
    primaryColorSuppl: '#5A9AE6',
    errorColor: '#D2553F',
    errorColorHover: '#E06B55',
    warningColor: '#C9A45C',
    successColor: '#8FC79A',
    infoColor: '#7DB8FF',
    textColorBase: '#DCD6C8',
    textColor1: '#DCD6C8',
    textColor2: '#C4BEB0',
    textColor3: '#9A9588',
    bodyColor: '#131416',
    cardColor: '#1C1D20',
    modalColor: '#1C1D20',
    popoverColor: '#232428',
    borderColor: '#3A3C41',
    dividerColor: '#2A2C30',
    borderRadius: '2px',
    borderRadiusSmall: '2px',
    fontFamily: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    fontFamilyMono: "'JetBrains Mono', Menlo, Consolas, monospace",
  },
  Tabs: {
    tabTextColorLine: '#9A9588',
    tabTextColorActiveLine: '#DCD6C8',
    tabTextColorHoverLine: '#DCD6C8',
    barColor: '#7DB8FF',
    tabTextColorSegment: '#9A9588',
    tabTextColorActiveSegment: '#DCD6C8',
    tabColorSegment: '#232428',
    colorSegment: '#1C1D20',
  },
}
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <div :class="appClass">
        <MainLayout />
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
/* 全局共振样式 */
.resonance-2d {
  filter: contrast(1.2) grayscale(0.3);
  --depth-perspective: 0;
  --shadow-opacity: 0;
}
.resonance-2d * {
  transform: none !important;
  box-shadow: none !important;
  transition: none !important;
}

.resonance-1d {
  font-family: var(--font-mono) !important;
  background: var(--black) !important;
  color: var(--holo-green) !important;
}
.resonance-1d * {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
.resonance-1d img, .resonance-1d video, .resonance-1d canvas {
  display: none !important;
}
.resonance-1d ::before, .resonance-1d ::after {
  content: ' [一维信息流] ' !important;
  color: #050;
  font-size: 10px;
}

/* --- Environment System --- */

/* Dehydrated: Minimal HTML Mode */
.mode-dehydrated {
  background: var(--white) !important;
  color: var(--black) !important;
  font-family: var(--font-serif) !important;
}
.mode-dehydrated * {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  filter: none !important;
  animation: none !important;
  transition: none !important;
}
.mode-dehydrated img, .mode-dehydrated canvas, .mode-dehydrated svg {
  display: none !important;
}
.mode-dehydrated .app-header, .mode-dehydrated .app-footer {
  border-bottom: 1px solid var(--black) !important;
  border-top: 1px solid var(--black) !important;
}

/* Chaotic Cold: Frost */
/*
 * 环境滤镜只调冷暖与明暗，不再整体旋转色相：hue-rotate(180deg) 会把全站配色翻成补色
 * （紫变绿、青变红），各扇区精心设定的主题色因此随服务器状态随机失真。
 */
.env-cold {
  filter: brightness(0.88) contrast(1.08) saturate(0.7);
}
.env-cold::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(140, 190, 255, 0.10), rgba(120, 170, 255, 0.04) 60%);
  pointer-events: none;
  z-index: 9998;
}
.env-cold::after {
  content: '';
  position: fixed;
  inset: 0;
  background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" /></filter><rect width="100%" height="100%" filter="url(%23noise)" opacity="0.1"/></svg>');
  pointer-events: none;
  z-index: 9999;
  mix-blend-mode: overlay;
}

/* Chaotic Heat: Heat */
.env-heat {
  filter: brightness(1.05) contrast(1.05) sepia(0.18);
}
.env-heat::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 50% 100%, rgba(255, 120, 40, 0.10), transparent 65%);
  pointer-events: none;
  z-index: 9998;
}
.env-heat body {
  animation: heat-shimmer 0.1s infinite;
}
@keyframes heat-shimmer {
  0% { transform: translate(0, 0); }
  50% { transform: translate(1px, 1px); }
  100% { transform: translate(-1px, -1px); }
}

/* Big Rip：只让页面主体轻微漂移。此前作用于所有元素（.env-rip *），
   会让 fixed 元素失位、交互元素持续移动而难以点击，并显著拖慢渲染 */
.env-rip .app-main > * {
  animation: float-random 5s ease-in-out infinite;
}
@keyframes float-random {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(10px, -10px) rotate(2deg); }
}

/* --- Mental Seal Filters --- */
/* Triumph: Saturation+20%, Brightness+10% */
.seal-triumph {
  filter: saturate(1.2) brightness(1.1);
}
/* Defeat: Grayscale, Noise */
.seal-defeat {
  filter: grayscale(0.8) contrast(1.2);
}
/* Advent: Invert */
.seal-advent {
  filter: invert(0.9) hue-rotate(180deg);
}
/* Survive: Night Vision */
.seal-survive {
  filter: sepia(1) hue-rotate(50deg) saturate(3) contrast(1.2);
}
</style>
