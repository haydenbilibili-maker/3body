<script setup lang="ts">
/**
 * UniverseView - 三体宇宙观测终端 (首页 v2.1)
 * 核心：3D 三体运动背景 + 战术 HUD 布局
 * 优化：全面汉化，修复乱纪元文字抖动导致的布局错乱
 */
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useUniverseStore } from '@/stores/universe'
// 三体动画依赖 Three.js（约 900 KB）：异步加载，首页文字与入口卡片先渲染，3D 背景随后淡入
const ThreeBodyBackground = defineAsyncComponent(() => import('@/components/ThreeBodyBackground.vue'))
import GlitchText from '@/components/GlitchText.vue'
import { STARTER_ROUTE, nextStarterIndex, readStarterVisited } from '@/utils/starterRoute'

const router = useRouter()
const universe = useUniverseStore()

// 五大分类导航数据
const navGroups = [
  {
    code: 'ORIGINS',
    label: '起源与接触',
    desc: '红岸 · 三体摆 · 智子',
    path: '/sector-r',
    color: '#ff4400'
  },
  {
    code: 'CRISIS',
    label: '危机与战略',
    desc: '面壁 · 阶梯 · 水滴 · 森林',
    path: '/sector-f',
    color: '#ffaa00'
  },
  {
    code: 'UNIVERSE',
    label: '宇宙与维度',
    desc: '掩体 · 曲率 · 四维',
    path: '/sector-j',
    color: '#00ccff'
  },
  {
    code: 'HISTORY',
    label: '岁月与文明',
    desc: '编年史 · 原著阅读 · 人物 · 画廊',
    path: '/sector-b',
    color: '#00ffaa'
  },
  {
    code: 'ETERNITY',
    label: '时间与尽头',
    desc: '小宇宙 · 未知 · 重启',
    path: '/sector-u',
    color: '#aa00ff'
  }
]

// 新手路线：数据与访问记录见 utils/starterRoute（访问记录由路由守卫写入）
const starterRoute = STARTER_ROUTE
const visited = ref<Set<string>>(readStarterVisited())
const visitedCount = computed(() => starterRoute.filter((s) => visited.value.has(s.path)).length)
const nextIndex = computed(() => nextStarterIndex(visited.value))

// 随机生成的环境状态 (汉化)
const eraStatus = ref('乱纪元')
const sunDistance = ref('0.8 AU')
const surfaceTemp = ref('62°C')

function updateEnvironment() {
  const eras = ['乱纪元', '恒纪元', '三日凌空', '永夜']
  eraStatus.value = eras[Math.floor(Math.random() * eras.length)]
  sunDistance.value = (0.5 + Math.random() * 2).toFixed(2) + ' AU'
  surfaceTemp.value = Math.floor(Math.random() * 200 - 100) + '°C'
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  universe.fetchMetrics()
  timer = setInterval(updateEnvironment, 5000)
  updateEnvironment()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function handleNavClick(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="terminal">
    <!-- Layer 0: 3D Background -->
    <div class="terminal__bg">
      <ThreeBodyBackground />
      <div class="terminal__vignette"></div>
      <div class="terminal__scanlines"></div>
    </div>

    <!-- Layer 1: HUD UI -->
    <div class="terminal__ui">
      
      <!-- 左上：标题 + 状态栏（独立左侧区域，避免被右侧导航遮挡） -->
      <header class="hud-header">
        <div class="hud-left">
          <div class="hud-brand">
            <h1 class="brand-title">THREE BODY</h1>
            <div class="brand-sub">PLANETARY DEFENSE SYSTEM <span class="nowrap">// 行星防御系统</span></div>
          </div>
          <div class="hud-status-grid">
            <div class="status-item">
              <span class="label">恒星纪元</span>
              <div class="value-container">
                <GlitchText :text="eraStatus" class="value value--alert" />
              </div>
            </div>
            <div class="status-item">
              <span class="label">文明纪元</span>
              <div class="value-container">
                <span class="value">No. 192</span>
              </div>
            </div>
            <div class="status-item">
              <span class="label">日地距离</span>
              <div class="value-container">
                <span class="value">{{ sunDistance }}</span>
              </div>
            </div>
            <div class="status-item">
              <span class="label">地表温度</span>
              <div class="value-container">
                <span class="value">{{ surfaceTemp }}</span>
              </div>
            </div>
          </div>

          <!-- 新手路线：按原著顺序的四站，走过的打勾，下一站高亮 -->
          <section class="starter-route" aria-label="新手推荐路线">
            <div class="route-head">
              <span class="route-title">第一次来？按这条路线走</span>
              <span class="route-progress">{{ visitedCount }} / {{ starterRoute.length }}</span>
            </div>
            <ol class="route-list">
              <li
                v-for="(stop, i) in starterRoute"
                :key="stop.path"
                class="route-stop"
                :class="{ done: visited.has(stop.path), next: i === nextIndex }"
              >
                <button type="button" class="route-btn" @click="handleNavClick(stop.path)">
                  <span class="route-index" aria-hidden="true">{{ visited.has(stop.path) ? '✓' : i + 1 }}</span>
                  <span class="route-text">
                    <span class="route-name">
                      {{ stop.label }}
                      <span class="route-kind">{{ stop.kind }} · {{ stop.minutes }} 分钟</span>
                    </span>
                    <span class="route-desc">{{ stop.desc }}</span>
                  </span>
                  <span v-if="i === nextIndex" class="route-next">下一站 →</span>
                </button>
              </li>
            </ol>
          </section>
        </div>
      </header>

      <!-- Center: Reticle (Visual Only) -->
      <div class="hud-center-reticle">
        <svg viewBox="0 0 100 100" class="reticle-svg">
          <circle cx="50" cy="50" r="48" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" fill="none" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" />
        </svg>
      </div>

      <!-- Right: Navigation Modules -->
      <nav class="hud-nav">
        <div 
          v-for="(item, idx) in navGroups" 
          :key="item.code"
          class="nav-module"
          :style="{ '--module-color': item.color }"
          @click="handleNavClick(item.path)"
        >
          <div class="module-code">0{{ idx + 1 }} // {{ item.code }}</div>
          <div class="module-content">
            <div class="module-label">{{ item.label }}</div>
            <div class="module-desc">{{ item.desc }}</div>
          </div>
          <div class="module-bar"></div>
        </div>
      </nav>

      <!-- Bottom: Ticker -->
      <footer class="hud-footer">
        <div class="scrolling-ticker">
          <div class="ticker-content">
            生存是文明的第一需要 /// 宇宙就是一座黑暗森林，每个文明都是带枪的猎人 /// 弱小和无知不是生存的障碍，傲慢才是 /// 不要回答！不要回答！不要回答！ ///
            生存是文明的第一需要 /// 宇宙就是一座黑暗森林，每个文明都是带枪的猎人 /// 弱小和无知不是生存的障碍，傲慢才是 /// 不要回答！不要回答！不要回答！ ///
          </div>
        </div>
      </footer>

    </div>
  </div>
</template>

<style scoped>
/* Base Layout：绝对定位填满父容器，强制解决 flex 高度计算偏差 */
.terminal {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--black);
  font-family: var(--font-sans);
  color: var(--white);
}

/* Background Layer */
.terminal__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.terminal__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 40%, var(--black) 100%);
  pointer-events: none;
}

.terminal__scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.2) 0px,
    rgba(0, 0, 0, 0.2) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  opacity: 0.5;
}

/* UI Layer */
.terminal__ui {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  padding: 2rem;
  padding-top: 100px; /* 避开顶部导航栏 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Header：左侧集中，避免与右侧导航重叠 */
.hud-header {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
}

.hud-left {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 420px; /* 限制宽度，与右侧导航留出安全距离 */
}

.brand-title {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  line-height: 1;
  margin: 0;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
}

.brand-sub .nowrap {
  white-space: nowrap;
  display: inline-block;
}

.brand-sub {
  font-size: 0.8rem;
  letter-spacing: 0.4em;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.hud-status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem 2rem;
  text-align: left;
}

.status-item {
  display: flex;
  flex-direction: column;
}

.status-item .label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.value-container {
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.status-item .value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--c-sky);
}

.status-item .value--alert {
  color: var(--holo-red);
  text-shadow: 0 0 10px var(--holo-red);
}

/* Center Reticle */
.hud-center-reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60vh;
  height: 60vh;
  pointer-events: none;
  opacity: 0.3;
}

.reticle-svg {
  width: 100%;
  height: 100%;
  animation: rotate-reticle 60s linear infinite;
}

@keyframes rotate-reticle {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Right Navigation */
.hud-nav {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 2rem;
  align-items: flex-end;
}

.nav-module {
  position: relative;
  width: 260px;
  background: rgba(0, 10, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.nav-module:hover {
  width: 300px;
  background: rgba(0, 20, 40, 0.8);
  border-color: var(--module-color);
  box-shadow: -10px 0 30px rgba(0,0,0,0.5);
}

.nav-module:hover .module-bar {
  background: var(--module-color);
  box-shadow: 0 0 10px var(--module-color);
}

.module-code {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.module-label {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 0.2rem;
}

.nav-module:hover .module-label {
  color: var(--module-color);
  text-shadow: 0 0 8px var(--module-color);
}

.module-desc {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
}

.module-bar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}

/* Footer Ticker */
.hud-footer {
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.5);
  padding: 0.5rem 0;
  overflow: hidden;
}

.scrolling-ticker {
  white-space: nowrap;
  overflow: hidden;
}

.ticker-content {
  display: inline-block;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: rgba(0, 240, 255, 0.7);
  animation: ticker-move 40s linear infinite; /* 调慢一点 */
}

@keyframes ticker-move {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Responsive */
/* 新手路线 */
.starter-route {
  margin-top: 0.5rem;
  padding: 0.9rem 1rem 0.6rem;
  background: rgba(2, 6, 23, 0.72);
  border: 1px solid rgba(0, 240, 255, 0.18);
  border-left: 3px solid var(--holo-blue);
  backdrop-filter: blur(6px);
}
.route-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}
.route-title {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text);
}
.route-progress {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.route-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.route-btn {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.55rem 0.4rem;
  background: none;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
}
.route-stop:first-child .route-btn { border-top: 0; }
.route-btn:hover { background: rgba(0, 240, 255, 0.06); }
.route-btn:focus-visible { outline: 2px solid var(--holo-blue); outline-offset: -2px; }
.route-index {
  flex: 0 0 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  border: 1px solid var(--gray-550);
  border-radius: 50%;
  color: var(--gray-300);
}
.route-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.route-name { font-size: 0.9rem; color: var(--gray-100); }
.route-kind { margin-left: 0.4rem; font-size: 0.75rem; color: var(--text-muted); }
.route-desc { font-size: 0.8rem; line-height: 1.5; color: var(--gray-350); }
.route-next {
  flex-shrink: 0;
  align-self: center;
  font-size: 0.75rem;
  color: var(--holo-blue);
  white-space: nowrap;
}
.route-stop.next .route-index { border-color: var(--holo-blue); color: var(--holo-blue); box-shadow: 0 0 8px rgba(0, 255, 200, 0.35); }
.route-stop.next .route-name { color: var(--white); }
.route-stop.done .route-index { background: rgba(0, 255, 200, 0.15); border-color: rgba(0, 255, 200, 0.5); color: var(--holo-blue); }
.route-stop.done .route-name, .route-stop.done .route-desc { opacity: 0.6; }

/* 矮屏桌面：路线收起说明文字，避免压到底部滚动条 */
@media (min-width: 769px) and (max-height: 820px) {
  .route-desc { display: none; }
}

@media (max-width: 768px) {
  /* 手机端内容高于一屏：此前 overflow:hidden 把 04、05 两个入口裁掉且无法滚动 */
  .terminal { overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .terminal__bg { position: fixed; }
  .terminal__ui { height: auto; min-height: 100%; padding-bottom: 4rem; }
  .hud-footer { margin-top: 2rem; }
  .hud-left { max-width: none; }

  .hud-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .hud-status-grid {
    grid-template-columns: 1fr 1fr;
    text-align: left;
    width: 100%;
  }

  .value-container {
    justify-content: flex-start;
  }

  .hud-nav {
    position: relative;
    top: auto;
    right: auto;
    transform: none;
    align-items: stretch;
    margin-top: 2rem;
    padding: 0;
  }

  .nav-module {
    width: 100%;
  }
  
  .nav-module:hover {
    width: 100%;
  }
}
</style>
