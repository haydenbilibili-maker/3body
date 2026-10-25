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

// 三体动画依赖 Three.js（约 900 KB）：异步加载，首页文字先渲染，3D 背景随后淡入
const ThreeBodyBackground = defineAsyncComponent(() => import('@/components/ThreeBodyBackground.vue'))

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
  '给岁月以文明，而不是给文明以岁月。',
  '弱小和无知不是生存的障碍，傲慢才是。',
  '宇宙就是一座黑暗森林，每个文明都是带枪的猎人。',
  '不要回答！不要回答！不要回答！',
  '把海弄干的鱼在海干前上了陆地。',
]
const inscriptionIndex = ref(0)

/* 三体星此刻：唯一的实时读数 */
const trisolarisEra = ref('乱纪元')
const sunDistance = ref('0.80')
function updateTrisolaris() {
  trisolarisEra.value = Math.random() < 0.7 ? '乱纪元' : '恒纪元'
  sunDistance.value = (0.5 + Math.random() * 2).toFixed(2)
}

let envTimer: ReturnType<typeof setInterval> | undefined
let quoteTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  universe.fetchMetrics()
  updateTrisolaris()
  envTimer = setInterval(updateTrisolaris, 6000)
  quoteTimer = setInterval(() => {
    inscriptionIndex.value = (inscriptionIndex.value + 1) % INSCRIPTIONS.length
  }, 9000)
})
onUnmounted(() => {
  clearInterval(envTimer)
  clearInterval(quoteTimer)
})

const go = (path: string) => router.push(path)
</script>

<template>
  <div class="home">
    <div class="home-bg" aria-hidden="true">
      <ThreeBodyBackground />
      <div class="home-shade"></div>
    </div>

    <div class="home-grid">
      <section class="hero">
        <p class="hero-era"><span class="hero-era-mark" aria-hidden="true"></span>冥王星上的地球文明档案馆</p>
        <h1 class="hero-title">三体</h1>
        <p class="hero-lede">
          人类知道自己可能会消失，于是把文明刻进石头，留给亿万年后的读者。现在，读者是你。
        </p>
        <p class="hero-question">当文明只剩下档案，档案该记住什么？</p>

        <dl class="readout">
          <div>
            <dt>三体星此刻</dt>
            <dd>{{ trisolarisEra }}</dd>
          </div>
          <div>
            <dt>日地距离</dt>
            <dd><span class="num">{{ sunDistance }}</span> 天文单位</dd>
          </div>
          <div>
            <dt>黑暗森林威慑度</dt>
            <dd><span class="num">{{ (universe.deterrence * 100).toFixed(0) }}%</span></dd>
          </div>
        </dl>

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

    <transition name="inscription" mode="out-in">
      <p :key="inscriptionIndex" class="inscription">{{ INSCRIPTIONS[inscriptionIndex] }}</p>
    </transition>
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
    linear-gradient(90deg, rgba(19, 20, 22, 0.96) 0%, rgba(19, 20, 22, 0.7) 42%, rgba(19, 20, 22, 0.25) 70%, rgba(19, 20, 22, 0.75) 100%),
    radial-gradient(ellipse at 60% 50%, transparent 30%, rgba(19, 20, 22, 0.6) 100%);
}

.home-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 40rem) minmax(0, 1fr) minmax(15rem, 20rem);
  gap: 2rem;
  min-height: 100%;
  padding: 4.5rem clamp(1.25rem, 5vw, 4.5rem) 6rem;
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
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
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
  position: fixed;
  left: 0;
  right: 0;
  bottom: 3.25rem;
  z-index: 1;
  margin: 0;
  text-align: center;
  font-family: var(--font-serif);
  font-size: 1rem;
  letter-spacing: 0.3em;
  color: var(--weathered);
  pointer-events: none;
}
.inscription-enter-active, .inscription-leave-active { transition: opacity 1.6s ease, filter 1.6s ease; }
.inscription-enter-from, .inscription-leave-to { opacity: 0; filter: blur(4px); }

@media (max-width: 1100px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); padding-top: 3rem; }
  .hero, .index { grid-column: 1; }
  .index { align-self: start; max-width: 32rem; }
  .home-shade { background: linear-gradient(180deg, rgba(19, 20, 22, 0.55) 0%, rgba(19, 20, 22, 0.92) 45%, rgba(19, 20, 22, 0.97) 100%); }
  .inscription { position: static; padding: 0 1.25rem 2rem; letter-spacing: 0.15em; }
}
@media (max-width: 600px) {
  .home-grid { padding: 2.25rem 1rem 3rem; gap: 2.5rem; }
  .hero-lede { font-size: 1.0625rem; }
  .hero-question { font-size: 1.125rem; }
  .route { padding: 1rem 0.9rem 0.25rem; }
}
</style>
