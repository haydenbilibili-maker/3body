<script setup lang="ts">
/**
 * 「方寸之间」——平面国解谜（四维碎片扇区）。
 * 逻辑在 sim/flatland.ts；这里只负责渲染与输入。
 * 操作：方向键 / WASD 移动，空格 升维·落下，R 重来。手机用屏幕按键。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  FLAT_LEVELS,
  castRetina,
  drop,
  lift,
  move,
  parseLevel,
  stars,
  visibleCells,
  type FlatState,
} from '@/sim/flatland'

const emit = defineEmits<{ complete: [] }>()

const STARS_KEY = '3body:flatland-stars'
function readStars(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STARS_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
const bestStars = ref<Record<string, number>>(readStars())

const levelIndex = ref(0)
const level = computed(() => FLAT_LEVELS[levelIndex.value])
const state = ref<FlatState>(parseLevel(level.value))
const showIntro = ref(true)

const visible = computed(() => new Set(visibleCells(state.value)))
const seen = computed(() => new Set(state.value.seen))
const items = computed(() => new Set(state.value.items))
const retina = computed(() => castRetina(state.value, 64))
const cols = computed(() => state.value.tiles[0].length)
const fragmentPct = computed(() => Math.round((state.value.fragment / level.value.fragment) * 100))
const earned = computed(() => stars(level.value, state.value))

function load(i: number) {
  levelIndex.value = i
  state.value = parseLevel(FLAT_LEVELS[i])
  showIntro.value = true
}
function restart() {
  state.value = parseLevel(level.value)
}

function act(fn: (s: FlatState) => FlatState) {
  if (showIntro.value) showIntro.value = false
  state.value = fn(state.value)
}
const step = (dr: number, dc: number) => act((s) => move(s, dr, dc))
const toggleLift = () => act((s) => (s.lifted ? drop(s) : lift(s)))

watch(
  () => state.value.status,
  (st) => {
    if (st !== 'won') return
    const id = level.value.id
    const got = stars(level.value, state.value)
    if (got > (bestStars.value[id] ?? 0)) {
      bestStars.value = { ...bestStars.value, [id]: got }
      try {
        localStorage.setItem(STARS_KEY, JSON.stringify(bestStars.value))
      } catch {
        /* 存储不可用时忽略 */
      }
    }
    if (levelIndex.value === FLAT_LEVELS.length - 1) emit('complete')
  },
)

function cellClass(r: number, c: number) {
  const k = `${r},${c}`
  const t = state.value.tiles[r][c]
  const vis = visible.value.has(k)
  return {
    wall: t === '#',
    exit: t === 'E',
    visible: vis,
    remembered: !vis && seen.value.has(k),
    hidden: !vis && !seen.value.has(k),
  }
}
const isPlayer = (r: number, c: number) => state.value.pos.r === r && state.value.pos.c === c
const showItem = (r: number, c: number) => items.value.has(`${r},${c}`) && visible.value.has(`${r},${c}`)

function retinaColor(kind: string, depth: number) {
  const light = Math.round(100 - depth * 80)
  if (kind === 'wall') return `hsl(190 10% ${Math.max(12, light * 0.7)}%)`
  if (kind === 'item') return `hsl(42 95% ${Math.max(30, light * 0.75)}%)`
  if (kind === 'exit') return `hsl(170 90% ${Math.max(25, light * 0.6)}%)`
  return 'transparent'
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  const map: Record<string, [number, number]> = {
    ArrowUp: [-1, 0], KeyW: [-1, 0],
    ArrowDown: [1, 0], KeyS: [1, 0],
    ArrowLeft: [0, -1], KeyA: [0, -1],
    ArrowRight: [0, 1], KeyD: [0, 1],
  }
  if (map[e.code]) {
    e.preventDefault()
    step(...map[e.code])
  } else if (e.code === 'Space') {
    e.preventDefault()
    toggleLift()
  } else if (e.code === 'KeyR') {
    restart()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flatland" :class="{ lifted: state.lifted }">
    <div class="fl-levels" role="tablist" aria-label="关卡">
      <button
        v-for="(l, i) in FLAT_LEVELS"
        :key="l.id"
        type="button"
        class="fl-level"
        :class="{ active: i === levelIndex }"
        :aria-selected="i === levelIndex"
        @click="load(i)"
      >
        <span>{{ l.title }}</span>
        <span class="fl-level-stars" :aria-label="`${bestStars[l.id] ?? 0} 星`">
          {{ '★'.repeat(bestStars[l.id] ?? 0) }}{{ '☆'.repeat(3 - (bestStars[l.id] ?? 0)) }}
        </span>
      </button>
    </div>

    <div class="fl-stage">
      <div class="fl-board-wrap">
        <div class="fl-board" :style="{ '--cols': cols }" aria-label="平面国地图">
          <template v-for="(row, r) in state.tiles" :key="r">
            <div v-for="(_t, c) in row" :key="`${r}-${c}`" class="fl-cell" :class="cellClass(r, c)">
              <span v-if="showItem(r, c)" class="fl-item" aria-label="物品">◆</span>
              <span v-if="isPlayer(r, c)" class="fl-player" :class="{ up: state.lifted }" aria-label="你"></span>
            </div>
          </template>
        </div>

        <transition name="fade">
          <div v-if="showIntro && state.status === 'playing'" class="fl-overlay">
            <h3>{{ level.title }}</h3>
            <p>{{ level.intro }}</p>
            <button type="button" class="fl-btn primary" @click="showIntro = false">开始</button>
            <p class="fl-keys">方向键 / WASD 移动 · 空格 升维 / 落下 · R 重来</p>
          </div>
        </transition>
        <transition name="fade">
          <div v-if="state.status === 'won'" class="fl-overlay won">
            <p class="fl-stars-big">{{ '★'.repeat(earned) }}{{ '☆'.repeat(3 - earned) }}</p>
            <p class="fl-outro">{{ level.outro }}</p>
            <div class="fl-overlay-actions">
              <button type="button" class="fl-btn" @click="restart">再来一次</button>
              <button
                v-if="levelIndex < FLAT_LEVELS.length - 1"
                type="button"
                class="fl-btn primary"
                @click="load(levelIndex + 1)"
              >
                下一关
              </button>
              <RouterLink v-else to="/sector-m" class="fl-btn primary">去看宇宙曾经的样子 →</RouterLink>
            </div>
          </div>
        </transition>
        <transition name="fade">
          <div v-if="state.status === 'lost'" class="fl-overlay lost">
            <p class="fl-outro">{{ state.message }}</p>
            <button type="button" class="fl-btn primary" @click="restart">重来</button>
          </div>
        </transition>
      </div>

      <aside class="fl-side">
        <div class="fl-meter">
          <div class="fl-meter-head">
            <span>四维碎片</span>
            <span class="mono">{{ state.fragment }} / {{ level.fragment }}</span>
          </div>
          <div class="fl-meter-bar"><div class="fl-meter-fill" :style="{ width: fragmentPct + '%' }"></div></div>
          <p class="fl-meter-note">升维、在高处每走一步都会消耗碎片。最少需要 {{ level.par }}。</p>
        </div>

        <div class="fl-stats mono">
          <span>物品 {{ state.carried }} / {{ state.totalItems }}</span>
          <span>步数 {{ state.moves }}</span>
          <span>{{ state.lifted ? '高于平面' : '在平面上' }}</span>
        </div>

        <p class="fl-message" aria-live="polite">{{ state.message }}</p>

        <div class="fl-retina">
          <div class="fl-retina-head">
            <span>二维生物的视网膜</span>
            <span class="muted">{{ state.lifted ? '你已不再需要它' : '它看到的全部世界：一条线' }}</span>
          </div>
          <div class="fl-retina-strip" :class="{ off: state.lifted }">
            <span
              v-for="(s, i) in retina"
              :key="i"
              :style="{ background: retinaColor(s.kind, s.depth) }"
            ></span>
          </div>
        </div>

        <div class="fl-pad" aria-label="操作">
          <button type="button" class="fl-key up" aria-label="上" @click="step(-1, 0)">↑</button>
          <button type="button" class="fl-key left" aria-label="左" @click="step(0, -1)">←</button>
          <button
            type="button"
            class="fl-key lift"
            :class="{ on: state.lifted }"
            :disabled="!state.lifted && state.fragment <= 0"
            @click="toggleLift"
          >
            {{ state.lifted ? '落下' : '升维' }}
          </button>
          <button type="button" class="fl-key right" aria-label="右" @click="step(0, 1)">→</button>
          <button type="button" class="fl-key down" aria-label="下" @click="step(1, 0)">↓</button>
        </div>
        <button type="button" class="fl-btn ghost" @click="restart">↻ 重来本关</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.flatland {
  --fl-accent: #c58bff;
  --fl-wall: #3a3550;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mono { font-family: var(--font-mono); }
.muted { color: var(--text-muted); }

.fl-levels {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.fl-level {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.8rem;
  background: rgba(197, 139, 255, 0.05);
  border: 1px solid rgba(197, 139, 255, 0.2);
  color: var(--gray-200);
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.fl-level.active { border-color: var(--fl-accent); color: var(--white); background: rgba(197, 139, 255, 0.12); }
.fl-level-stars { font-size: 0.75rem; color: var(--c-gold); letter-spacing: 0.1em; }

.fl-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1.25rem;
  align-items: start;
}

.fl-board-wrap { position: relative; }
.fl-board {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  width: min(100%, calc(var(--cols) * 44px));
  aspect-ratio: auto;
  margin: 0 auto;
  background: #05030a;
  border: 1px solid rgba(197, 139, 255, 0.25);
  box-shadow: 0 0 40px rgba(120, 60, 200, 0.15) inset;
}
.fl-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.35s, opacity 0.35s, box-shadow 0.35s;
}
.fl-cell.visible { background: #14101f; }
.fl-cell.visible.wall { background: var(--fl-wall); box-shadow: inset 0 0 0 1px #5a5378; }
.fl-cell.remembered { background: #0c0914; }
.fl-cell.remembered.wall { background: #211d2e; }
.fl-cell.hidden { background: #030206; }
.fl-cell.exit.visible,
.fl-cell.exit.remembered { box-shadow: inset 0 0 0 2px rgba(0, 255, 200, 0.6); }
.fl-cell.exit.visible::after { content: '出口'; font-size: 0.75rem; color: var(--holo-blue); opacity: 0.8; }

/* 升维：墙退化成细线，所有内部一览无余 */
.lifted .fl-board { box-shadow: 0 0 60px rgba(197, 139, 255, 0.25) inset; }
.lifted .fl-cell.visible { background: #1a1428; }
.lifted .fl-cell.visible.wall {
  background: #1a1428;
  box-shadow: inset 0 0 0 1px rgba(197, 139, 255, 0.55);
}

.fl-item {
  color: var(--c-gold);
  font-size: 1.1rem;
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.7);
  animation: pulse 2s ease-in-out infinite;
}
.fl-player {
  position: absolute;
  width: 56%;
  height: 56%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff, var(--fl-accent));
  box-shadow: 0 0 12px rgba(197, 139, 255, 0.8);
  transition: transform 0.25s, box-shadow 0.25s;
  z-index: 2;
}
.fl-player.up {
  transform: translateY(-22%) scale(1.15);
  box-shadow: 0 0 22px rgba(197, 139, 255, 1), 0 14px 10px -6px rgba(0, 0, 0, 0.8);
}
@keyframes pulse { 50% { opacity: 0.55; } }

.fl-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 1.5rem;
  text-align: center;
  background: rgba(5, 3, 10, 0.9);
  backdrop-filter: blur(3px);
  z-index: 5;
}
.fl-overlay h3 { margin: 0; font-size: 1.2rem; letter-spacing: 0.1em; color: var(--white); }
.fl-overlay p { margin: 0; max-width: 34rem; line-height: 1.8; color: var(--gray-150); }
.fl-outro { font-family: var(--font-serif); font-size: 1rem; }
.fl-keys { font-size: 0.75rem; color: var(--text-muted) !important; }
.fl-stars-big { font-size: 1.8rem; color: var(--c-gold) !important; letter-spacing: 0.2em; }
.fl-overlay-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }

.fl-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.1rem;
  font: inherit;
  font-size: 0.9rem;
  color: var(--gray-100);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  text-decoration: none;
}
.fl-btn.primary { color: #0b0612; background: var(--fl-accent); border-color: var(--fl-accent); font-weight: 600; }
.fl-btn.ghost { width: 100%; justify-content: center; }

.fl-side { display: flex; flex-direction: column; gap: 1rem; }
.fl-meter-head, .fl-retina-head { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.4rem; }
.fl-meter-bar { height: 8px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
.fl-meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #6a3fbf, var(--fl-accent));
  box-shadow: 0 0 12px var(--fl-accent);
  transition: width 0.3s;
}
.fl-meter-note { margin: 0.4rem 0 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; }
.fl-stats { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--gray-300); }
.fl-message {
  margin: 0;
  min-height: 3.2em;
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--gray-150);
  border-left: 2px solid var(--fl-accent);
  background: rgba(197, 139, 255, 0.06);
}
.fl-retina-head .muted { font-size: 0.75rem; }
.fl-retina-strip {
  display: flex;
  height: 26px;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: opacity 0.4s, filter 0.4s;
}
.fl-retina-strip span { flex: 1; }
.fl-retina-strip.off { opacity: 0.25; filter: grayscale(1); }

.fl-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas: '. up .' 'left lift right' '. down .';
  gap: 0.4rem;
}
.fl-key {
  height: 2.6rem;
  font: inherit;
  font-size: 1rem;
  color: var(--gray-150);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  touch-action: manipulation;
}
.fl-key:active { background: rgba(197, 139, 255, 0.2); }
.fl-key.up { grid-area: up; }
.fl-key.down { grid-area: down; }
.fl-key.left { grid-area: left; }
.fl-key.right { grid-area: right; }
.fl-key.lift { grid-area: lift; font-size: 0.85rem; color: var(--fl-accent); border-color: rgba(197, 139, 255, 0.5); }
.fl-key.lift.on { background: var(--fl-accent); color: #0b0612; }
.fl-key:disabled { opacity: 0.35; cursor: not-allowed; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .fl-stage { grid-template-columns: 1fr; }
  .fl-overlay p { font-size: 0.875rem; }
}
</style>
