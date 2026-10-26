<script setup lang="ts">
/**
 * 首页 —— 冥王星档案馆的入口。
 * 三体运动背景（异步加载）之上：碑刻「三体」、一句话说明这是什么地方、这座档案馆的问题、
 * 新手路线，以及按纪元排列的展厅索引（深时轴的展开版）。
 */
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUniverseStore } from '@/stores/universe'
import { ERAS, SECTORS } from '@/data/sectors'
import { STARTER_ROUTE, nextStarterIndex, readStarterVisited } from '@/utils/starterRoute'

// 背景是一个真实计算的三体系统（Canvas 2D），可以抓住恒星甩出去；行星此刻的纪元就是读数
const GravityField = defineAsyncComponent(() => import('@/components/GravityField.vue'))

const router = useRouter()
const universe = useUniverseStore()

/* 新手路线：访问记录由路由守卫写入 */
const starterRoute = STARTER_ROUTE
const visited = ref<Set<string>>(readStarterVisited())
const visitedCount = computed(() => starterRoute.filter((s) => visited.value.has(s.path)).length)
const nextIndex = computed(() => nextStarterIndex(visited.value))

/* 按纪元排列的展厅索引（首页本身与跨纪元展厅另列） */
const eraIndex = computed(() =>
  ERAS.map((era) => ({
    era,
    rooms: SECTORS.filter((s) => s.era === era.id && s.path !== '/sector-c'),
  })),
)
const acrossAll = SECTORS.filter((s) => s.era === 'all')

/* 碑文：一次只刻一句，缓慢更替 */
const INSCRIPTIONS = [
  '弱小和无知不是生存的障碍，傲慢才是。',
  '宇宙就是一座黑暗森林，每个文明都是带枪的猎人。',
  '不要回答！不要回答！不要回答！',
  '把海弄干的鱼在海干前上了陆地。',
]
const inscriptionIndex = ref(0)

/* 三体星此刻：由背景里那颗行星的真实处境决定 */
const CLIMATE: Record<string, { era: string; line: string }> = {
  stable: { era: '恒纪元', line: '一颗太阳稳稳地照着，可以浸泡复活了。' },
  chaos: { era: '乱纪元', line: '几颗太阳轮番升起，日夜没有规律。' },
  scorched: { era: '三日凌空', line: '太阳离得太近，大地在燃烧。' },
  frozen: { era: '飞星不动', line: '太阳都远去了，严寒降临。' },
}
const sky = ref<keyof typeof CLIMATE>('chaos')
const trisolarisEra = computed(() => CLIMATE[sky.value].era)
const skyLine = computed(() => CLIMATE[sky.value].line)
/* 标题被背景里的三颗太阳照亮：光源取三颗太阳按亮度加权的位置 */
const titleEl = ref<HTMLElement | null>(null)
const light = ref({ x: 70, y: 30, i: 0.5 })
function onSky(e: { kind: string; suns: { x: number; y: number; b: number }[] }) {
  sky.value = (e.kind in CLIMATE ? e.kind : 'chaos') as keyof typeof CLIMATE
  const r = titleEl.value?.getBoundingClientRect()
  if (!r) return
  const tot = e.suns.reduce((a, s) => a + s.b, 0) || 1
  const x = e.suns.reduce((a, s) => a + s.x * s.b, 0) / tot
  const y = e.suns.reduce((a, s) => a + s.y * s.b, 0) / tot
  light.value = {
    x: Math.max(-60, Math.min(160, ((x - r.left) / r.width) * 100)),
    y: Math.max(-120, Math.min(220, ((y - r.top) / r.height) * 100)),
    i: Math.min(1, tot / 6),
  }
}

let quoteTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  universe.fetchMetrics()
  quoteTimer = setInterval(() => {
    inscriptionIndex.value = (inscriptionIndex.value + 1) % INSCRIPTIONS.length
  }, 9000)
})
onUnmounted(() => {
  clearInterval(quoteTimer)
})

const go = (path: string) => router.push(path)
</script>

<template>
  <div class="home">
    <div class="home-bg" aria-hidden="true">
      <GravityField @sky="onSky" />
      <div class="home-shade"></div>
    </div>

    <div class="home-grid">
      <section class="hero">
        <p class="hero-era"><span class="hero-era-mark" aria-hidden="true"></span>冥王星上的地球文明档案馆</p>
        <h1 ref="titleEl" class="hero-title" :style="{ '--lx': light.x + '%', '--ly': light.y + '%', '--li': light.i }">三体</h1>
        <p class="hero-lede">
          人类知道自己可能会消失，于是把文明刻进石头，留给亿万年后的读者。现在，读者是你。
        </p>
        <p class="hero-question">当文明只剩下档案，档案该记住什么？</p>

        <dl class="readout">
          <div>
            <dt>三体星此刻</dt>
            <dd>{{ trisolarisEra }}</dd>
          </div>
          <div class="sky-line">
            <dt>那颗行星上</dt>
            <dd>{{ skyLine }}</dd>
          </div>
          <div>
            <dt>黑暗森林威慑度</dt>
            <dd><span class="num">{{ (universe.deterrence * 100).toFixed(0) }}%</span></dd>
          </div>
        </dl>

        <p class="drag-hint">背景里的三颗太阳是真实计算的。按住任何一颗，把它甩出去；双击空白处复位。</p>

        <section class="route" aria-label="新手路线">
          <div class="route-head">
            <h2 class="route-title">第一次来，从这四间展厅开始</h2>
            <span class="route-progress">{{ visitedCount }} / {{ starterRoute.length }}</span>
          </div>
          <ol class="route-list">
            <li
              v-for="(stop, i) in starterRoute"
              :key="stop.path"
              :class="{ done: visited.has(stop.path), next: i === nextIndex }"
            >
              <button type="button" class="route-btn" @click="go(stop.path)">
                <span class="route-index" aria-hidden="true">{{ visited.has(stop.path) ? '✓' : i + 1 }}</span>
                <span class="route-text">
                  <span class="route-name">{{ stop.label }}<span class="route-kind">{{ stop.kind }}，约 {{ stop.minutes }} 分钟</span></span>
                  <span class="route-desc">{{ stop.desc }}</span>
                </span>
                <span v-if="i === nextIndex" class="route-next">下一站</span>
              </button>
            </li>
          </ol>
        </section>

        <!-- 碑文：放在左栏压暗的区域里，不压住背景里运动的太阳，也不遮挡任何内容 -->
        <transition name="inscription" mode="out-in">
          <p :key="inscriptionIndex" class="inscription" aria-live="off">{{ INSCRIPTIONS[inscriptionIndex] }}</p>
        </transition>
      </section>

      <nav class="index" aria-label="按纪元排列的展厅">
        <ol class="index-eras">
          <li v-for="row in eraIndex" :key="row.era.id" class="index-era" :class="{ empty: !row.rooms.length }">
            <div class="index-era-head">
              <span class="index-mark" aria-hidden="true"></span>
              <span class="index-era-name">{{ row.era.name }}</span>
            </div>
            <p class="index-era-note">{{ row.era.note }}</p>
            <div v-if="row.rooms.length" class="index-rooms">
              <button v-for="room in row.rooms" :key="room.path" type="button" class="index-room" @click="go(room.path)">
                {{ room.name }}
              </button>
            </div>
          </li>
        </ol>
        <div class="index-all">
          <span class="index-all-label">贯穿所有纪元</span>
          <button v-for="room in acrossAll" :key="room.path" type="button" class="index-room" @click="go(room.path)">
            {{ room.name }}
          </button>
        </div>
      </nav>
    </div>

  </div>
</template>

<style scoped>
.home {
  position: absolute;
  inset: 0;
  overflow: hidden auto;
  color: var(--bone);
  background: var(--void);
}
.home-bg { position: fixed; inset: 0; z-index: 0; opacity: 0.85; }
/* 让三体运动退到文字后面：左侧压暗，保证碑刻标题与正文的对比度 */
.home-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(19, 20, 22, 0.97) 0%, rgba(19, 20, 22, 0.93) 38%, rgba(19, 20, 22, 0.35) 62%, rgba(19, 20, 22, 0.8) 100%),
    radial-gradient(ellipse at 60% 50%, transparent 30%, rgba(19, 20, 22, 0.6) 100%);
}

.home-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 40rem) minmax(0, 1fr) minmax(15rem, 20rem);
  gap: 2rem;
  min-height: 100%;
  padding: 4.5rem clamp(1.25rem, 5vw, 4.5rem) 3rem;
}
.hero { grid-column: 1; }
.index { grid-column: 3; }

.hero-era {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin: 0 0 1.25rem;
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  letter-spacing: 0.18em;
  color: var(--weathered);
}
.hero-era-mark { width: 2rem; height: 1px; background: var(--weathered); }

/* 唯一的大胆：一块碑上的两个字 */
.hero-title {
  margin: 0;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: clamp(5rem, 11vw, 9.5rem);
  line-height: 1;
  letter-spacing: 0.12em;
  color: var(--bone);
  background: radial-gradient(circle at var(--lx, 70%) var(--ly, 30%), #fff6e0 0%, #e8d9b8 calc(18% + var(--li, 0.5) * 22%), var(--bone) 55%, #8f897c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.6));
  animation: light-arrives 1.4s ease-out both;
}
@keyframes light-arrives {
  from { opacity: 0; filter: blur(14px); letter-spacing: 0.3em; }
  to { opacity: 1; filter: blur(0); letter-spacing: 0.12em; }
}
.hero-lede {
  max-width: 30em;
  margin: 1.75rem 0 0;
  font-family: var(--font-serif);
  font-size: 1.125rem;
  line-height: 1.95;
  color: var(--gray-150);
}
.hero-question {
  margin: 1.25rem 0 0;
  padding-left: 1rem;
  border-left: 1px solid var(--weathered);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.7;
  color: var(--bone);
}

.readout {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2.25rem;
  margin: 2rem 0 0;
}
.readout dt { font-size: 0.8125rem; color: var(--weathered); }
.readout dd { margin: 0.2rem 0 0; font-size: 1rem; color: var(--bone); }
.readout .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--cherenkov); }

/* 新手路线 */
.route {
  margin-top: 2.5rem;
  padding: 1.25rem 1.25rem 0.5rem;
  background: rgba(28, 29, 32, 0.82);
  border: 1px solid var(--incision-soft);
}
.route-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
.route-title { margin: 0; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; letter-spacing: 0.06em; }
.route-progress { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--weathered); }
.route-list { list-style: none; margin: 0; padding: 0; }
.route-btn {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 0.75rem 0.25rem;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-top: 1px solid var(--incision-soft);
  cursor: pointer;
}
.route-list li:first-child .route-btn { border-top: 0; }
.route-btn:hover .route-name { color: var(--white); }
.route-index {
  flex: 0 0 1.6rem;
  height: 1.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--weathered);
  border: 1px solid var(--incision);
  border-radius: 50%;
}
.route-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.route-name { font-family: var(--font-serif); font-size: 1rem; color: var(--bone); }
.route-kind { margin-left: 0.6rem; font-family: var(--font-sans); font-size: 0.8125rem; color: var(--weathered); }
.route-desc { font-size: 0.875rem; line-height: 1.6; color: var(--gray-300); }
.route-next { flex-shrink: 0; align-self: center; font-size: 0.8125rem; color: var(--cherenkov); }
/* 一页一个光源：下一站 */
.next .route-index { color: var(--cherenkov); border-color: var(--cherenkov); box-shadow: 0 0 10px rgba(var(--cherenkov-rgb), 0.45); }
.done .route-index { color: var(--bone); border-color: var(--weathered); }
.done .route-name, .done .route-desc { color: var(--weathered); }

/* 按纪元排列的展厅索引 */
.index { align-self: center; }
.index-eras { position: relative; list-style: none; margin: 0; padding: 0; }
.index-eras::before { content: ''; position: absolute; top: 0.6rem; bottom: 0.6rem; left: 3px; width: 1px; background: var(--incision); }
.index-era { position: relative; padding: 0 0 1.1rem 1.4rem; }
.index-era-head { display: flex; align-items: center; gap: 0.7rem; margin-left: -1.4rem; }
.index-mark { width: 7px; height: 1px; background: var(--weathered); }
.index-era-name { font-family: var(--font-serif); font-size: 1rem; letter-spacing: 0.1em; color: var(--bone); }
.index-era-note { margin: 0.15rem 0 0.35rem; font-size: 0.8125rem; line-height: 1.5; color: var(--weathered); }
.empty .index-era-name { color: var(--weathered); }
.index-rooms { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; }
.index-room {
  padding: 0.1rem 0;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--gray-200);
  background: none;
  border: 0;
  border-bottom: 1px solid transparent;
  cursor: pointer;
}
.index-room:hover { color: var(--white); border-bottom-color: var(--weathered); }
.index-all { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.9rem; margin-top: 0.5rem; padding-top: 0.9rem; border-top: 1px solid var(--incision-soft); }
.index-all-label { width: 100%; font-size: 0.8125rem; color: var(--weathered); }

/* 碑文 */
.inscription {
  margin: 1.75rem 0 0;
  padding-left: 1rem;
  border-left: 1px solid var(--incision);
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.8;
  letter-spacing: 0.12em;
  color: var(--weathered);
}
.inscription-enter-active, .inscription-leave-active { transition: opacity 1.6s ease, filter 1.6s ease; }
.inscription-enter-from, .inscription-leave-to { opacity: 0; filter: blur(4px); }

@media (max-width: 1100px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); padding-top: 3rem; }
  .hero, .index { grid-column: 1; }
  .index { align-self: start; max-width: 32rem; }
  .home-shade { background: linear-gradient(180deg, rgba(19, 20, 22, 0.55) 0%, rgba(19, 20, 22, 0.92) 45%, rgba(19, 20, 22, 0.97) 100%); }
}
@media (max-width: 600px) {
  .home-grid { padding: 2.25rem 1rem 3rem; gap: 2.5rem; }
  .hero-lede { font-size: 1.0625rem; }
  .hero-question { font-size: 1.125rem; }
  .route { padding: 1rem 0.9rem 0.25rem; }
}
.drag-hint { margin: -0.5rem 0 1.75rem; font-size: 0.8125rem; color: var(--weathered); }
.sky-line { flex-basis: 100%; }
.home-bg { opacity: 1; }
</style>
