<script setup lang="ts">
/**
 * Sector W: The Droplet (水滴)
 * 核心：绝对光滑 (Mirror), 动态打击 (Strike), 太阳封锁 (Blockade)
 * 技术：WebGL 着色器（镜面水滴）, Canvas (2D Game)
 */
import { ref, onMounted, computed, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import { NTabs, NTabPane } from 'naive-ui'
import SectorHeader from '@/components/SectorHeader.vue'
import { sectorByPath } from '@/data/sectors'
import DropletMirror from '@/components/DropletMirror.vue'
import HoldButton from '@/components/HoldButton.vue'
const activeTab = ref('mirror')
/* 镜面水滴：按住后一瞬间加速离去，再从远处回来 */
const go = ref(0)
const going = ref(false)
function launch() {
  going.value = true
  const t0 = performance.now()
  const tick = (now: number) => {
    const p = (now - t0) / 1600
    go.value = p < 1 ? p : Math.max(0, 1 - (p - 1) * 1.5)
    if (p < 1.67) requestAnimationFrame(tick)
    else {
      go.value = 0
      going.value = false
    }
  }
  requestAnimationFrame(tick)
}

// --- 1. Mirror Inspection (3D) ---
const magnification = ref(1)
const cameraZ = ref(5)

// 水滴航程：它从三体星系飞向地球，镜面倒映出沿途的每一处（DropletMirror 的 stage 与这里的顺序一一对应）
interface Waypoint {
  id: string
  name: string
  /** 镜面里此刻倒映着什么 */
  mirror: string
  /** 这一段航程里发生的事 */
  story: string
}
const WAYPOINTS: Waypoint[] = [
  { id: 'deep', name: '深空', mirror: '银河的一条暗带，和稀疏的星点。', story: '它比三体舰队早出发，在星际空间里独自飞了很多年。没有人看见它。' },
  { id: 'nebula', name: '星云边缘', mirror: '远处恒星诞生区的气体，在镜面上拉成一道彩色的弧。', story: '镜面把一切都还给宇宙，自己不留下一点颜色。' },
  { id: 'stellar', name: '掠过恒星', mirror: '一个巨大的日面和翻卷的日冕。', story: '离一颗恒星这么近，它的表面温度仍然接近绝对零度：没有一个分子在振动。' },
  { id: 'oort', name: '奥尔特云', mirror: '冰冷、稀疏的冰尘，远处一颗暗淡的太阳和一颗彗星。', story: '它进入了太阳系最外层。人类的观测站第一次捕捉到它，把它叫做「探测器」。' },
  { id: 'jupiter', name: '木星阴影', mirror: '木星的条纹铺满了它的半边。', story: '它在减速。人类计算出它的轨道，认定它会被俘获。' },
  { id: 'belt', name: '小行星带', mirror: '碎石与冰尘从它身边掠过。', story: '没有一块碎石能在它表面留下痕迹。人类还不知道，这意味着什么。' },
  { id: 'cislunar', name: '地月空间', mirror: '灰白的月面，和一束刺眼的日光。', story: '人们第一次看清它：一滴水银，头圆尾尖，完美得像一件艺术品。' },
  { id: 'earth', name: '地球附近', mirror: '蓝色的海、白色的云、一圈薄薄的大气。', story: '有人说它像一滴眼泪。有人提议，把它当作三体世界的善意。' },
  { id: 'station', name: '联合舰队', mirror: '两千艘恒星级战舰的灯光，排成整齐的阵列。', story: '舰队派出一艘战舰去俘获它，其余的列阵观礼。接下来发生的事，在「末日战役」里。' },
]
const currentWaypointIndex = ref(0)
const currentWaypoint = computed(() => WAYPOINTS[currentWaypointIndex.value] ?? WAYPOINTS[0])

function goToWaypoint(index: number) {
  const i = Math.max(0, Math.min(index, WAYPOINTS.length - 1))
  currentWaypointIndex.value = i
}

function nextWaypoint() {
  goToWaypoint(currentWaypointIndex.value + 1)
}

function prevWaypoint() {
  goToWaypoint(currentWaypointIndex.value - 1)
}

const surfaceInfo = computed(() => {
  const mag = magnification.value
  if (mag < 10) return `倍率: x${mag.toFixed(1)} (宏观)`
  if (mag < 1000) return `倍率: x${mag.toFixed(0)} (显微)`
  if (mag < 1000000) return `倍率: x${(mag/1000).toFixed(1)}k (纳米)`
  if (mag < 1000000000) return `倍率: x${(mag/1000000).toFixed(1)}M (皮米)`
  return `倍率: x${(mag/1000000000).toFixed(1)}B (强互作用力)`
})

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  // Zoom In/Out
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  magnification.value *= delta
  if (magnification.value < 1) magnification.value = 1
  
  // Camera Loop effect for "Infinite Smoothness"
  // Move camera from 5 to 2. When it hits 2, reset to 5 but keep magnification high.
  // This illusion shows that "zooming in changes nothing".
  // Actually, let's just let OrbitControls handle real zoom, and we just track the "virtual" magnification.
  // Wait, OrbitControls clamps zoom.
  // Let's manually adjust camera position for the visual effect.
  
  let newZ = cameraZ.value / delta
  if (newZ < 2.5) newZ = 4.5 // Loop back to simulate infinite smooth surface
  if (newZ > 5) newZ = 5
  cameraZ.value = newZ
}


// --- 2. Kinetic Strike (2D Game) ---
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isStriking = ref(false)
const strikeScore = ref(0)
const question = sectorByPath('/sector-w')?.question
/** 末日战役前，舰队里流传的话（转述，表现人类当时的自信） */
const FLEET_VOICES = [
  '「它只是一个探测器，连武器都没有。」',
  '「我们派出了两千艘恒星级战舰，去迎接一个几米长的东西。」',
  '「这将是人类历史上最壮观的一次检阅。」',
]
const fleet = ref<Array<{x: number, y: number, alive: boolean}>>([])
const fleetDown = computed(() => fleet.value.length > 0 && fleet.value.every((s) => !s.alive))
const pathPoints = ref<Array<{x: number, y: number}>>([])

function initFleet() {
  fleet.value = []
  for (let i = 0; i < 50; i++) {
    fleet.value.push({
      x: Math.random() * 800,
      y: Math.random() * 400 + 100,
      alive: true
    })
  }
}

function handleMouseDown(e: MouseEvent) {
  if (isStriking.value) return
  const rect = canvasRef.value!.getBoundingClientRect()
  pathPoints.value = [{
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }]
}

function handleMouseMove(e: MouseEvent) {
  if (isStriking.value || pathPoints.value.length === 0) return
  const rect = canvasRef.value!.getBoundingClientRect()
  pathPoints.value.push({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  })
}

function handleMouseUp() {
  if (!isStriking.value && pathPoints.value.length > 5) {
    executeStrike()
  } else {
    pathPoints.value = []
  }
}

function handleTouchStart(e: TouchEvent) {
  if (isStriking.value) return
  const rect = canvasRef.value!.getBoundingClientRect()
  const touch = e.touches[0]
  pathPoints.value = [{
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  }]
}

function handleTouchMove(e: TouchEvent) {
  if (isStriking.value || pathPoints.value.length === 0) return
  e.preventDefault() // Prevent scroll while drawing
  const rect = canvasRef.value!.getBoundingClientRect()
  const touch = e.touches[0]
  pathPoints.value.push({
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  })
}

function handleTouchEnd() {
  handleMouseUp()
}

function executeStrike() {
  isStriking.value = true
  let step = 0
  const totalSteps = pathPoints.value.length
  
  const interval = setInterval(() => {
    if (step >= totalSteps) {
      clearInterval(interval)
      isStriking.value = false
      pathPoints.value = []
      return
    }
    
    const pos = pathPoints.value[step]
    // Check collisions
    fleet.value.forEach(ship => {
      if (!ship.alive) return
      const dx = ship.x - pos.x
      const dy = ship.y - pos.y
      if (Math.sqrt(dx*dx + dy*dy) < 30) {
        ship.alive = false
        strikeScore.value++
      }
    })
    step+=2 // speed
  }, 10)
}

// --- 3. Sun Blockade ---
const jammingIntensity = ref(0)
const isJammed = computed(() => jammingIntensity.value > 80)

function toggleJamming() {
  jammingIntensity.value = jammingIntensity.value === 0 ? 100 : 0
}

onMounted(() => {
  initFleet()
})


/* ---------- 读者的档案 ---------- */
watch(fleetDown, (d) => {
  if (d) recordAnswer('/sector-w', '看着舰队在末日战役里被一个水滴摧毁')
})
</script>

<template>
  <div class="sector-w">
    <SectorHeader
      title="水滴"
      subtitle="一个用强相互作用力材料制成的三体探测器。绝对光滑，表面温度接近绝对零度。"
      goal="看它的镜面倒映出什么；在末日战役里，亲手画出它穿过舰队的路线。"
    />

    <NTabs type="segment" v-model:value="activeTab" class="w-tabs">
      
      <!-- Tab 1: Mirror -->
      <NTabPane name="mirror" tab="绝对光滑">
        <div class="scene-3d" @wheel="handleWheel">
          <DropletMirror :go="go" :stage="currentWaypointIndex" class="mirror-gl" />
          <div class="mirror-act">
            <HoldButton :hold-ms="1200" :disabled="going" @confirm="launch">按住，让它动起来</HoldButton>
            <span class="mirror-hint">拖动可以转动它。它的表面光滑到分子级别：你看到的不是它，是它周围的宇宙。</span>
          </div>
          
          <div class="journey-panel">
            <h3 class="journey-title">水滴航程 · 镜面反射</h3>
            <p class="journey-desc">它从三体星系飞向地球。镜面里倒映着它此刻经过的地方：换一站，看它表面的世界怎么变。</p>
            <div class="journey-current">
              <span class="journey-label">当前经过</span>
              <div class="journey-name">{{ currentWaypoint.name }}</div>
              <div class="journey-detail reason">镜中：{{ currentWaypoint.mirror }}</div>
              <p class="journey-story" aria-live="polite">{{ currentWaypoint.story }}</p>
              <div class="journey-nav">
                <button type="button" class="journey-btn" :disabled="currentWaypointIndex <= 0" @click="prevWaypoint">上一站</button>
                <span class="journey-progress">{{ currentWaypointIndex + 1 }} / {{ WAYPOINTS.length }}</span>
                <button v-if="currentWaypointIndex < WAYPOINTS.length - 1" type="button" class="journey-btn" @click="nextWaypoint">下一站</button>
                <button v-else type="button" class="journey-btn" @click="activeTab = 'strike'">进入末日战役</button>
              </div>
            </div>
            <div class="waypoint-list">
              <button
                v-for="(wp, i) in WAYPOINTS"
                :key="wp.id"
                type="button"
                class="waypoint-chip"
                :class="{ active: currentWaypointIndex === i }"
                @click="goToWaypoint(i)"
              >
                {{ wp.name }}
              </button>
            </div>
          </div>
          <div class="hud-overlay">
            <div class="data-row">
              <span class="label">表面温度:</span>
              <span class="val">~0 K</span>
            </div>
            <div class="data-row">
              <span class="label">反射率:</span>
              <span class="val">100.00%</span>
            </div>
            <div class="data-row highlight">
              <span class="label">{{ surfaceInfo }}</span>
            </div>
            <div class="hint-text">
              滚动鼠标滚轮放大观察表面细节；换一站，镜面里就是另一个世界
            </div>
          </div>
        </div>
      </NTabPane>

      <!-- Tab 2: Strike -->
      <NTabPane name="strike" tab="末日战役">
        <ul class="voices" aria-label="战役之前">
          <li v-for="(v, i) in FLEET_VOICES" :key="i">{{ v }}</li>
        </ul>
        <div class="game-container">
          <div class="game-header">
            <span>目标: 联合舰队 ({{ fleet.filter(s => s.alive).length }} / 50)</span>
            <span>击毁数: {{ strikeScore }}</span>
            <span class="hint">拖动鼠标规划水滴轨迹</span>
          </div>
          <canvas 
            ref="canvasRef" 
            width="800" 
            height="500" 
            class="strike-canvas"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          ></canvas>
          
          <!-- Canvas Logic in Template via overlays for simplicity -->
          <div v-if="fleetDown" class="strike-end" role="status">
            <p>舰队覆灭。从「迎接」到「覆灭」，不到一个小时。</p>
            <p class="q">{{ question }}</p>
          </div>
          <div class="canvas-overlay">
            <!-- Ships -->
            <div 
              v-for="(ship, i) in fleet" 
              :key="i" 
              class="ship" 
              :class="{ destroyed: !ship.alive }"
              :style="{ left: ship.x + 'px', top: ship.y + 'px' }"
            >
              <div v-if="!ship.alive" class="explosion" aria-hidden="true"></div>
            </div>
            
            <!-- Droplet (only when striking) -->
            <!-- Simplified: Actual logic handles logic, visuals via CSS for ships, Canvas for path? -->
            <!-- Actually let's just use CSS for ships for easier reactivity -->
          </div>
        </div>
      </NTabPane>

      <!-- Tab 3: Blockade -->
      <NTabPane name="blockade" tab="太阳封锁">
        <div class="blockade-ui">
          <div class="sun-view" :class="{ jammed: isJammed }">
            <div class="sun-core"></div>
            <div class="droplet-silhouette"></div>
            <div class="waves">
              <div class="wave" v-for="n in 5" :key="n"></div>
            </div>
          </div>
          
          <div class="controls">
            <h2>恒星电波放大功能</h2>
            <div class="status" :class="isJammed ? 'danger' : 'ok'">
              {{ isJammed ? '全频段阻塞：太阳不再能放大任何电波' : '正常：太阳仍可作为电波放大器' }}
            </div>
            <button class="jam-btn" @click="toggleJamming">
              {{ isJammed ? '解除封锁' : '发射干扰波' }}
            </button>
          </div>
        </div>
      </NTabPane>

    </NTabs>
  </div>
</template>

<style scoped>
.sector-w {
  height: 100%;
  min-height: 0;
  background: var(--black);
  color: var(--gray-100);
  font-family: var(--font-sans);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--gray-700);
  background: var(--gray-950);
}

.title {
  margin: 0;
  color: var(--c-cyan);
  font-family: var(--font-mono);
  letter-spacing: 2px;
}

.subtitle {
  color: var(--gray-400);
  font-size: 0.8rem;
}

.w-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Tab 1: 3D */
.scene-3d {
  width: 100%;
  flex: 1;
  min-height: 32rem;
  position: relative;
}

/* 水滴航程：主玩法面板（VI：碑面、刻痕、衬线站名） */
.journey-panel {
  position: absolute;
  top: 1rem;
  left: auto;
  right: 1rem;
  max-width: 320px;
  background: rgba(19, 20, 22, 0.86);
  border: 1px solid var(--incision);
  color: var(--bone);
  padding: 1rem 1.1rem;
  z-index: 10;
  border-radius: var(--radius-cut);
}

.journey-title {
  margin: 0 0 0.4rem;
  font-family: var(--font-serif);
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.12em;
  color: var(--bone);
}

.journey-desc {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--weathered);
  line-height: 1.6;
}

.journey-current {
  margin-bottom: 0.75rem;
  padding: 0.6rem 0 0.6rem 0.8rem;
  border-left: 1px solid var(--era-crisis);
}

.journey-label {
  font-size: 0.75rem;
  color: var(--weathered);
  letter-spacing: 0.1em;
}

.journey-name {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  color: var(--bone);
  margin: 0.15rem 0 0.3rem;
}

.journey-detail {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--weathered);
  margin-bottom: 0.4rem;
}

.journey-story {
  margin: 0 0 0.6rem;
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.8;
  color: var(--gray-150);
}

.journey-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.journey-btn {
  appearance: none;
  border: 1px solid var(--c-cyan);
  background: transparent;
  color: var(--c-cyan);
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
  cursor: pointer;
  border-radius: var(--radius-cut);
  transition: background 0.2s;
}

.journey-btn:hover:not(:disabled) {
  background: rgba(var(--cherenkov-rgb), 0.15);
}

.journey-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.journey-progress {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--weathered);
}

.waypoint-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.waypoint-chip {
  appearance: none;
  border: 1px solid var(--incision);
  background: transparent;
  color: var(--weathered);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: var(--radius-cut);
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.waypoint-chip:hover {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
  background: rgba(var(--cherenkov-rgb), 0.08);
}

.waypoint-chip.active {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
  background: rgba(var(--cherenkov-rgb), 0.2);
}

.hud-overlay {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 2;
  max-width: 18rem;
  padding: 0.75rem 1rem;
  color: var(--weathered);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.data-row { margin-bottom: 0.5rem; }
.data-row.highlight .label { color: var(--bone); }
.label { opacity: 0.7; margin-right: 1rem; }
.val { color: var(--bone); }
.reason { color: var(--weathered); font-size: 0.8125rem; }
.hint-text { margin-top: 0.5rem; font-family: var(--font-sans); font-size: 0.75rem; line-height: 1.6; color: var(--weathered); }

/* Tab 2: Game */
.game-container {
  position: relative;
  width: 800px;
  height: 500px;
  margin: 2rem auto;
  border: 2px solid var(--gray-700);
  background: #050510;
  overflow: hidden;
}

.game-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  padding: 0.5rem;
  background: rgba(var(--cherenkov-rgb),0.1);
  display: flex;
  justify-content: space-between;
  color: var(--c-cyan);
  font-family: var(--font-mono);
  z-index: 10;
}

.strike-canvas {
  position: absolute;
  top: 0; left: 0;
  z-index: 5;
  cursor: crosshair;
}

.ship {
  position: absolute;
  width: 6px; height: 6px;
  background: var(--white);
  border-radius: 50%;
  box-shadow: none;
  transition: all 0.2s;
}

.ship.destroyed {
  background: transparent;
  box-shadow: none;
}

.explosion {
  font-size: 20px;
  position: absolute;
  transform: translate(-50%, -50%);
  animation: fadeOut 1s forwards;
}

@keyframes fadeOut { to { opacity: 0; transform: scale(2); } }

/* Tab 3: Blockade */
.blockade-ui {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 2rem;
}

.sun-view {
  width: 300px;
  height: 300px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sun-core {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--c-yellow), #ff8c00, #ff4500);
  box-shadow: none;
  z-index: 1;
}

.droplet-silhouette {
  width: 20px;
  height: 30px;
  background: var(--black);
  border: 1px solid var(--white); /* Rim light */
  border-radius: 50% 50% 5px 5px;
  position: absolute;
  z-index: 2;
}

.waves .wave {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 0, 0.5);
  border-radius: 50%;
  width: 220px; height: 220px;
  animation: ripple 2s infinite;
}

.jammed .waves .wave {
  display: none;
}

.jammed .sun-core {
  filter: grayscale(0.8) brightness(0.5);
  box-shadow: none;
}

.controls {
  text-align: center;
}

.status {
  font-size: 1.5rem;
  margin: 1rem 0;
  font-family: var(--font-mono);
}
.ok { color: var(--holo-green); }
.danger { color: var(--c-red); }

.jam-btn {
  padding: 1rem 2rem;
  background: transparent;
  border: 1px solid var(--c-cyan);
  color: var(--c-cyan);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
}
.jam-btn:hover { background: rgba(var(--cherenkov-rgb),0.1); }

@keyframes ripple {
  0% { width: 220px; height: 220px; opacity: 1; }
  100% { width: 400px; height: 400px; opacity: 0; }
}

:deep(.n-tabs-nav) { background: var(--gray-900); }
:deep(.n-tabs-tab) { color: var(--gray-400); }
:deep(.n-tabs-tab--active) { color: var(--c-cyan); font-weight: bold; }
:deep(.n-tabs-pane-wrapper) { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
:deep(.n-tab-pane) { flex: 1; display: flex; flex-direction: column; height: 100%; width: 100%; }

@media (max-width: 640px) {
  .journey-panel {
    max-width: calc(100% - 2rem);
    top: 0.5rem;
    left: 0.5rem;
    padding: 0.75rem;
  }
  .journey-title { font-size: 0.9rem; }
  .waypoint-chip { font-size: 0.75rem; padding: 0.2rem 0.4rem; }
}
/* ------------------------------------------------------------------
 * 冥王星档案馆皮肤（视觉方案批次 2）
 * ------------------------------------------------------------------ */
.sector-w { background: transparent; color: var(--bone); padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; height: auto; }
.journey-panel, .hud-overlay { background: rgba(19, 20, 22, 0.86); border: 1px solid var(--incision); border-radius: 2px; }
.journey-title { font-family: var(--font-serif); color: var(--bone); }
.game-container { background: #0e0f12; border: 1px solid var(--incision); }
.ship { background: #9fb8d8; box-shadow: none; }
.explosion { position: absolute; left: -6px; top: -6px; width: 18px; height: 18px; border: 1px solid var(--rust-bright); border-radius: 50%; opacity: 0.6; }
.voices { list-style: none; margin: 1rem 0 0; padding: 0 0 0 1rem; border-left: 1px solid var(--incision); }
.voices li { font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--gray-200); }
.strike-end { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.75rem; padding: 1.5rem; text-align: center; background: rgba(14, 15, 18, 0.86); }
.strike-end p { margin: 0; max-width: 30rem; font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.85; color: var(--bone); }
.strike-end .q { color: var(--gray-200); font-size: 1rem; }
:deep(.w-tabs .n-tabs-tab) { font-family: var(--font-serif); font-size: 1rem; }
.mirror-gl { position: absolute; inset: 0; }
.mirror-act { position: absolute; left: 1.25rem; bottom: 1.25rem; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; max-width: 34rem; }
.mirror-hint { font-size: 0.8125rem; line-height: 1.6; color: var(--weathered); text-shadow: 0 1px 2px #000; }
@media (max-width: 760px) {
  .scene-3d { display: flex; flex-direction: column; }
  .mirror-gl { position: relative; height: 22rem; }
  .journey-panel, .mirror-act, .hud-overlay { position: static; max-width: none; margin: 0.75rem 0 0; }
}
</style>
