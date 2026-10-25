<script setup lang="ts">
/**
 * MainLayout - The Viewport
 * "The ship was a small world, and the universe was a dark forest."
 */
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useUniverseStore } from '@/stores/universe'
import { useUserStore } from '@/stores/user'
import AppNav from '@/components/AppNav.vue'
import DeepTimeRail from '@/components/DeepTimeRail.vue'
import WarpTransition from '@/components/WarpTransition.vue'
import AmbientSound from '@/components/AmbientSound.vue'
import { ERAS, sectorByPath } from '@/data/sectors'
import SophonIntercept from '@/components/commercial/SophonIntercept.vue'
import { soundManager } from '@/utils/sound'

const universe = useUniverseStore()
const userStore = useUserStore()
const route = useRoute()
/** 页脚的「此刻」：当前展厅所在的纪元（跨纪元的展厅与首页沿用全局读数） */
const roomEra = computed(() => {
  const sec = sectorByPath(route.path)
  if (!sec || sec.era === 'all' || route.path === '/sector-c') return universe.currentEra
  return ERAS.find((e) => e.id === sec.era)?.name ?? universe.currentEra
})
const isHome = computed(() => route.path === '/sector-c')

// --- Global Sound Handling ---
const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // Check if clicked element is interactive
  if (target.closest('button') || target.closest('a') || target.closest('.n-tab-tab') || target.closest('.control-item')) {
    soundManager.playClick()
  }
}

const handleGlobalHover = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // Using a throttle might be better, but simple check is fine for now
  if (target.closest('button') || target.closest('a') || target.closest('.n-tab-tab')) {
    // Only play if we haven't played recently for this element? 
    // For now, let's keep it simple. The soundManager is short.
    soundManager.playHover()
  }
}

// Watch route changes for "navigation" sound
watch(() => route.path, () => {
  soundManager.playConfirm()
})

let metricsInterval: ReturnType<typeof setInterval>
onMounted(() => {
  // 延迟首请求，让首屏先完成渲染，提升可感知加载速度
  setTimeout(() => universe.fetchMetrics().catch(() => {}), 80)
  metricsInterval = setInterval(universe.fetchMetrics, 30_000)
  
  // Attach listeners
  window.addEventListener('click', handleGlobalClick)
  // Mouseover can be noisy, let's try it. If too much, we remove.
  // window.addEventListener('mouseover', handleGlobalHover) 
  
  userStore.init()
})

onUnmounted(() => {
  clearInterval(metricsInterval)
  window.removeEventListener('click', handleGlobalClick)
  // window.removeEventListener('mouseover', handleGlobalHover)
})
</script>

<template>
  <div class="app-layout">
    <!-- The Void Canvas -->
    <div class="cosmic-void">
      <div class="void-noise"></div>
      <div class="void-dust"></div>
      <div class="void-vignette"></div>
    </div>

    <header class="app-header">
      <AppNav />
    </header>

    <WarpTransition />
    <div class="app-body">
    <aside v-if="!isHome" class="app-rail">
      <DeepTimeRail />
    </aside>
    <main class="app-main" :class="{ 'app-main--full': isHome }">
      <RouterView v-slot="{ Component }">
        <transition name="dimension-unfold" mode="out-in">
          <Suspense>
            <template #default>
              <component :is="Component" :key="route.fullPath" />
            </template>
            <template #fallback>
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>正在调取档案……</span>
              </div>
            </template>
          </Suspense>
        </transition>
      </RouterView>
    </main>
    </div>

    <SophonIntercept />

    <footer class="app-footer">
      <span class="slogan">给岁月以文明，而不是给文明以岁月</span>
      <span class="meta">
        <AmbientSound class="meta-item" />
        <span class="meta-item">此刻<b>{{ roomEra }}</b></span>
        <span class="meta-item">威慑度<b class="num">{{ (universe.deterrence * 100).toFixed(0) }}%</b></span>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--bone);
  position: relative;
}

.app-body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  position: relative;
  z-index: 10;
}
.app-rail {
  flex: 0 0 8.5rem;
  border-right: 1px solid var(--incision-soft);
}
.app-body > .app-main {
  flex: 1 1 0;
  min-width: 0;
}
@media (max-width: 1279px) {
  .app-rail { display: none; }
}

.app-main {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 2rem 3rem;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
}

/* 扇区根节点：去除强制高度，避免 padding 导致溢出 */
.app-main > * {
  width: 100%;
  /* 不收缩：页面根节点若带 overflow:hidden，弹性收缩会把它压成一屏高并裁掉下方内容 */
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}

/* 首页全屏铺满，无内边距，避免 100vh 导致底部大量空白 */
.app-main--full {
  padding: 0;
}
.app-main--full > * {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.7rem 2.5rem;
  font-size: 0.8125rem;
  color: var(--weathered);
  border-top: 1px solid var(--incision-soft);
  background: rgba(19, 20, 22, 0.92);
  position: relative;
  z-index: 50;
}
.meta { display: flex; gap: 1.75rem; min-width: 0; }
.meta-item b { margin-left: 0.5rem; font-weight: 500; color: var(--bone); }
.meta-item .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

/* 小屏：外层与扇区根节点的左右边距合计约 16px（原为 3rem + 各页 2rem，内容区只剩约 230px） */
@media (max-width: 768px) {
  .app-main {
    padding: 0.75rem 0.5rem;
  }
  .app-main:not(.app-main--full) > * {
    padding-left: 0.5rem !important;
    padding-right: 0.5rem !important;
  }
  .app-footer {
    justify-content: center;
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
  }
  .app-footer .slogan {
    display: none;
  }
  .meta { gap: 1rem; flex-wrap: wrap; justify-content: center; min-width: 0; }
}

@media (min-width: 769px) and (max-width: 1100px) {
  .app-main {
    padding: 1.5rem;
  }
}

/* --- COSMIC VOID BACKGROUND --- */
.cosmic-void {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--gray-950);
  overflow: hidden;
  pointer-events: none;
}

.void-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  opacity: 0.03;
  mix-blend-mode: overlay;
}

.void-dust {
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background-image: 
    radial-gradient(1px 1px at 10% 10%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 20% 20%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 30% 30%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 40% 40%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 50% 50%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 60% 60%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 70% 70%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 80% 80%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 90% 90%, var(--white) 100%, transparent);
  background-size: 500px 500px;
  opacity: 0.3;
  animation: cosmic-drift 200s linear infinite;
}

.void-dust::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(1px 1px at 15% 15%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 25% 25%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 35% 35%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 45% 45%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 55% 55%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 65% 65%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 75% 75%, var(--white) 100%, transparent),
    radial-gradient(1px 1px at 85% 85%, var(--white) 100%, transparent),
    radial-gradient(2px 2px at 95% 95%, var(--white) 100%, transparent);
  background-size: 700px 700px;
  opacity: 0.2;
  animation: cosmic-drift 300s linear infinite reverse;
}

.void-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 80%, var(--black) 100%);
  mix-blend-mode: multiply;
}

@keyframes cosmic-drift {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.slogan {
  font-family: var(--font-serif);
  letter-spacing: 0.12em;
  color: var(--weathered);
}

/* --- DIMENSIONAL UNFOLDING TRANSITION --- */
/* Simulates an object emerging from a higher dimension into the viewport */

.loading-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--weathered);
  font-family: var(--font-serif);
  letter-spacing: 0.2em;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(var(--cherenkov-rgb), 0.3);
  border-top-color: var(--c-cyan);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 展厅切换：像远处的光抵达——由模糊变清晰，只此一次的出场 */
.dimension-unfold-enter-active {
  transition: opacity 0.9s ease, filter 0.9s ease;
}
.dimension-unfold-leave-active {
  transition: opacity 0.25s ease;
}
.dimension-unfold-enter-from {
  opacity: 0;
  filter: blur(6px);
}
.dimension-unfold-leave-to {
  opacity: 0;
}
</style>
