<script setup lang="ts">
/**
 * Sector U: 647 号小宇宙「五公斤」
 * 田园 → 广播 → 抉择（留下 ≤5 公斤，其余归还 / 留下来守着永恒）→ 两种结局。
 * 逻辑见 sim/miniUniverse.ts。
 */
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { NSlider } from 'naive-ui'
import SectorHeader from '@/components/SectorHeader.vue'
import { soundManager } from '@/utils/sound'
import {
  MASS_LIMIT,
  RELICS,
  canAdd,
  formatYears,
  legacyLines,
  outsideAt,
  returnedMass,
  toggleRelic,
  totalMass,
  type Phase,
} from '@/sim/miniUniverse'

const phase = ref<Phase>('garden')
const PHASES: { id: Phase | 'end'; label: string }[] = [
  { id: 'garden', label: '田园' },
  { id: 'broadcast', label: '广播' },
  { id: 'choose', label: '抉择' },
  { id: 'end', label: '结局' },
]
const phaseIndex = computed(() =>
  phase.value === 'reboot' || phase.value === 'eternity' ? 3 : PHASES.findIndex((p) => p.id === phase.value),
)

/* ---------- 田园：维生系统 ---------- */
const life = reactive({ light: 55, gravity: 1.0, recycling: 85 })
const eco = reactive({ day: 1, stability: 100, biomass: 45, oxygen: 97 })
const SIGNAL_DAY = 12

function tickEcosystem() {
  eco.day += 1
  let stress = 0
  if (life.light < 40 || life.light > 70) stress += 5
  if (life.gravity < 0.8 || life.gravity > 1.2) stress += 10
  if (life.recycling < 80) stress += 2
  eco.stability = stress > 0 ? Math.max(0, eco.stability - stress * 0.4) : Math.min(100, eco.stability + 2)
  if (eco.stability > 70 && life.light > 30) eco.biomass = Math.min(100, eco.biomass + 2)
  else if (eco.stability < 40) eco.biomass = Math.max(0, eco.biomass - 3)
  eco.oxygen = 95 + eco.biomass / 25
}
const signalArrived = computed(() => eco.day >= SIGNAL_DAY)
const ecoMood = computed(() => {
  if (eco.stability > 80) return '一切安好。风是人工的，但很温柔。'
  if (eco.stability > 40) return '叶子边缘有些发黄。调一调光照和重力。'
  return '这里正在变成一个封闭的坟墓。'
})
const plants = computed(() =>
  Array.from({ length: Math.floor(eco.biomass / 4) }, (_, i) => ({
    x: 6 + ((i * 37) % 88),
    h: 10 + ((i * 13) % 22),
    d: (i % 7) * 0.4,
  })),
)

/* ---------- 时间胶囊（沿用旧版存储键，保留用户写过的信） ---------- */
interface Note {
  id: number
  content: string
  date: string
}
const NOTES_KEY = 'sector-u-notes'
const notes = ref<Note[]>([])
const noteInput = ref('')
function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]')
    notes.value = Array.isArray(raw) ? raw : []
  } catch {
    notes.value = []
  }
}
function addNote() {
  const text = noteInput.value.trim()
  if (!text) return
  notes.value.unshift({ id: Date.now(), content: text, date: `第 ${eco.day} 天` })
  noteInput.value = ''
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes.value.slice(0, 30)))
  } catch {
    /* 存储不可用时只保留在本次会话 */
  }
}

/* ---------- 广播 ---------- */
const BROADCAST = [
  '致所有小宇宙中的生命——',
  '大宇宙的总质量正在减少。每一克被带进小宇宙的物质，都让它离重新坍缩更远一步。',
  '如果质量不再回来，大宇宙会永远膨胀下去：冷却，熄灭，再也不会有下一次开始。',
  '我们请求你们归还质量。',
  '你们可以留下一点东西给下一个宇宙。但不要多。',
]
const shownLines = ref(0)
let broadcastTimer: ReturnType<typeof setInterval> | undefined
function openBroadcast() {
  phase.value = 'broadcast'
  shownLines.value = 0
  clearInterval(broadcastTimer)
  broadcastTimer = setInterval(() => {
    shownLines.value += 1
    if (shownLines.value >= BROADCAST.length) clearInterval(broadcastTimer)
  }, 1400)
}

/* ---------- 抉择 ---------- */
const selected = ref<string[]>(['bottle'])
const bottleText = ref('')
const mass = computed(() => totalMass(selected.value))
const massPct = computed(() => Math.min(100, (mass.value / MASS_LIMIT) * 100))
function toggle(id: string) {
  selected.value = toggleRelic(selected.value, id)
}
function goChoose() {
  if (!bottleText.value) bottleText.value = notes.value[0]?.content ?? ''
  phase.value = 'choose'
}

/* ---------- 结局：重启 ---------- */
const rebootCanvas = ref<HTMLCanvasElement | null>(null)
const rebootDone = ref(false)
let rebootRaf = 0
async function confirmReturn() {
  phase.value = 'reboot'
  rebootDone.value = false
  await nextTick()
  runReboot()
}
function runReboot() {
  const canvas = rebootCanvas.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) {
    rebootDone.value = true
    return
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const W = (canvas.width = canvas.clientWidth * devicePixelRatio)
  const H = (canvas.height = canvas.clientHeight * devicePixelRatio)
  const cx = W / 2
  const cy = H / 2
  const N = 700
  const pts = Array.from({ length: N }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    a: Math.random() * Math.PI * 2,
    s: 0.4 + Math.random() * 2.4,
    warm: Math.random() < 0.6,
  }))
  const start = performance.now()
  const DURATION = reduce ? 1 : 9000
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION)
    ctx.fillStyle = 'rgba(4, 3, 8, 0.28)'
    ctx.fillRect(0, 0, W, H)
    if (t < 0.45) {
      // 坍缩：田园的质量流向中心
      const k = t / 0.45
      for (const p of pts) {
        p.x += (cx - p.x) * 0.02 * (1 + k * 3)
        p.y += (cy - p.y) * 0.02 * (1 + k * 3)
        ctx.fillStyle = p.warm ? 'rgba(240,180,90,0.8)' : 'rgba(160,200,255,0.7)'
        ctx.fillRect(p.x, p.y, 2, 2)
      }
    } else if (t < 0.55) {
      // 奇点与闪光
      const k = (t - 0.45) / 0.1
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * k)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      for (const p of pts) {
        p.x = cx
        p.y = cy
      }
    } else {
      // 新宇宙：膨胀，星系成形
      const k = (t - 0.55) / 0.45
      for (const p of pts) {
        p.x += Math.cos(p.a) * p.s * (2 - k) * devicePixelRatio
        p.y += Math.sin(p.a) * p.s * (2 - k) * devicePixelRatio
        ctx.fillStyle = `rgba(${200 + 55 * k},${210 + 30 * k},255,${0.9 - k * 0.3})`
        ctx.fillRect(p.x, p.y, 1.6, 1.6)
      }
      // 漂流瓶：一个缓慢飘远的暖色光点
      const bx = cx + k * W * 0.18
      const by = cy - k * H * 0.12
      ctx.fillStyle = 'rgba(255,200,120,1)'
      ctx.beginPath()
      ctx.arc(bx, by, 3 * devicePixelRatio, 0, Math.PI * 2)
      ctx.fill()
    }
    if (t < 1) rebootRaf = requestAnimationFrame(frame)
    else rebootDone.value = true
  }
  rebootRaf = requestAnimationFrame(frame)
}
const legacy = computed(() => legacyLines(selected.value))
const returnedTons = computed(() => (returnedMass(selected.value) / 1000).toFixed(1))

/* ---------- 结局：永恒 ---------- */
const years = ref(1)
let eternityTimer: ReturnType<typeof setInterval> | undefined
function chooseStay() {
  phase.value = 'eternity'
  years.value = 1
  clearInterval(eternityTimer)
  eternityTimer = setInterval(() => {
    years.value = Math.min(1e100, years.value * 4.2 + 1)
    if (years.value >= 1e100) clearInterval(eternityTimer)
  }, 160)
}
const eternityEnded = computed(() => years.value >= 1e100)
const outsideText = computed(() => outsideAt(years.value))
/** 窗外的光：随时间对数衰减 */
const windowLight = computed(() => Math.max(0, 1 - Math.log10(years.value + 1) / 60))

/* ---------- 生命周期 ---------- */
let ecoTimer: ReturnType<typeof setInterval> | undefined
function resetAll() {
  clearInterval(broadcastTimer)
  clearInterval(eternityTimer)
  cancelAnimationFrame(rebootRaf)
  Object.assign(life, { light: 55, gravity: 1.0, recycling: 85 })
  Object.assign(eco, { day: 1, stability: 100, biomass: 45, oxygen: 97 })
  selected.value = ['bottle']
  phase.value = 'garden'
}
watch(phase, (p) => {
  if (p === 'broadcast') soundManager.stopAmbient()
  if (p === 'garden') soundManager.startAmbient('nature')
})
onMounted(() => {
  loadNotes()
  ecoTimer = setInterval(() => {
    if (phase.value === 'garden' || phase.value === 'eternity') tickEcosystem()
  }, 1000)
  soundManager.startAmbient('nature')
})
onUnmounted(() => {
  clearInterval(ecoTimer)
  clearInterval(broadcastTimer)
  clearInterval(eternityTimer)
  cancelAnimationFrame(rebootRaf)
  soundManager.stopAmbient()
})
</script>

<template>
  <div class="sector-u" :class="`phase-${phase}`">
    <SectorHeader
      code="SECTOR U · UNIVERSE 647"
      title="647 号小宇宙"
      subtitle="一千米见方的永恒"
      goal="照料这座小小的田园，直到外面的声音传进来。然后决定：留下五公斤，还是留下自己。"
      accent="#f0b45a"
      :show-restart="phase !== 'garden'"
      restart-label="回到第一天"
      @restart="resetAll"
    />

    <ol class="u-steps" aria-label="进度">
      <li v-for="(p, i) in PHASES" :key="p.id" :class="{ done: i < phaseIndex, current: i === phaseIndex }">
        <span class="u-step-dot">{{ i + 1 }}</span>{{ p.label }}
      </li>
    </ol>

    <!-- ===== 田园 ===== -->
    <section v-if="phase === 'garden'" class="u-garden">
      <div class="u-scene" :style="{ '--light': life.light / 100 }">
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMax slice" class="u-scene-svg" aria-hidden="true">
          <defs>
            <radialGradient id="u-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff3d0" />
              <stop offset="100%" stop-color="#f0b45a" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="76" cy="14" :r="6 + life.light / 12" fill="url(#u-sun)" class="u-sun" />
          <path d="M0 48 Q 25 42 50 46 T 100 44 V60 H0Z" fill="#3b2a1d" />
          <g v-for="(p, i) in plants" :key="i" class="u-plant" :style="{ animationDelay: p.d + 's' }">
            <path :d="`M ${p.x} 50 Q ${p.x - 1.5} ${50 - p.h / 2} ${p.x} ${50 - p.h}`" stroke="#8fbf6a" stroke-width="0.6" fill="none" />
            <circle :cx="p.x" :cy="50 - p.h" r="1" fill="#c6e39a" />
          </g>
          <g transform="translate(18 37)">
            <rect width="12" height="9" fill="#6d4c35" />
            <path d="M-1 0 L6 -5 L13 0Z" fill="#8a5a3c" />
            <rect x="4.5" y="3" width="3" height="3" fill="#ffd98a" class="u-window" />
          </g>
        </svg>
        <div class="u-scene-hud">
          <span>第 {{ eco.day }} 天</span>
          <span>氧气 {{ eco.oxygen.toFixed(1) }}%</span>
          <span :class="{ warn: eco.stability < 60 }">稳定度 {{ Math.round(eco.stability) }}%</span>
        </div>
      </div>

      <div class="u-panels">
        <div class="u-card">
          <h2 class="u-card-title">维生系统</h2>
          <p class="u-mood">{{ ecoMood }}</p>
          <label class="u-ctrl">
            <span>人造太阳 <em>{{ life.light }}</em></span>
            <NSlider v-model:value="life.light" :step="1" />
          </label>
          <label class="u-ctrl">
            <span>人工重力 <em>{{ life.gravity.toFixed(1) }} G</em></span>
            <NSlider v-model:value="life.gravity" :min="0.1" :max="2" :step="0.1" />
          </label>
          <label class="u-ctrl">
            <span>物质循环 <em>{{ life.recycling }}%</em></span>
            <NSlider v-model:value="life.recycling" :step="1" />
          </label>
        </div>

        <div class="u-card">
          <h2 class="u-card-title">时间胶囊</h2>
          <p class="u-hint">写给谁都可以。在这里，时间不会流走。</p>
          <div class="u-capsule-row">
            <textarea v-model="noteInput" rows="2" maxlength="200" placeholder="写给新宇宙的信……" class="u-textarea"></textarea>
            <button type="button" class="u-btn" :disabled="!noteInput.trim()" @click="addNote">封存</button>
          </div>
          <ul v-if="notes.length" class="u-notes">
            <li v-for="n in notes.slice(0, 4)" :key="n.id"><span>{{ n.date }}</span>{{ n.content }}</li>
          </ul>
        </div>

        <div class="u-card u-receiver" :class="{ live: signalArrived }">
          <h2 class="u-card-title">接收器</h2>
          <div class="u-noise" aria-hidden="true"><span v-for="i in 24" :key="i" :style="{ animationDelay: i * 0.07 + 's' }"></span></div>
          <p v-if="!signalArrived" class="u-hint">只有噪音。小宇宙与外界隔绝——几乎。（第 {{ SIGNAL_DAY }} 天前后会有变化）</p>
          <template v-else>
            <p class="u-hint strong">噪音里出现了一个有规律的信号。它来自小宇宙之外。</p>
            <button type="button" class="u-btn primary" @click="openBroadcast">接收广播</button>
          </template>
        </div>
      </div>
    </section>

    <!-- ===== 广播 ===== -->
    <section v-else-if="phase === 'broadcast'" class="u-broadcast">
      <div class="u-broadcast-frame">
        <p class="u-broadcast-src">来源：小宇宙之外 · 全频段 · 循环播放</p>
        <transition-group name="line" tag="div" class="u-broadcast-text">
          <p v-for="(line, i) in BROADCAST.slice(0, shownLines)" :key="i">{{ line }}</p>
        </transition-group>
        <div v-if="shownLines >= BROADCAST.length" class="u-broadcast-actions">
          <p class="u-question">这里有你的田园、你的信、你剩下的全部时间。<br />外面是一个正在死去、也可能重新开始的宇宙。</p>
          <div class="u-row">
            <button type="button" class="u-btn primary" @click="goChoose">归还质量</button>
            <button type="button" class="u-btn" @click="chooseStay">留下来</button>
          </div>
        </div>
        <button v-else type="button" class="u-skip" @click="shownLines = BROADCAST.length">跳过</button>
      </div>
    </section>

    <!-- ===== 抉择 ===== -->
    <section v-else-if="phase === 'choose'" class="u-choose">
      <div class="u-scale">
        <div class="u-scale-head">
          <span>留给下一个宇宙</span>
          <span class="u-scale-num" :class="{ full: mass >= MASS_LIMIT }">{{ mass.toFixed(1) }} / {{ MASS_LIMIT }} kg</span>
        </div>
        <div class="u-scale-bar"><div :style="{ width: massPct + '%' }"></div></div>
        <p class="u-hint">其余的一切——土壤、空气、房子、太阳——都要还回去。</p>
      </div>

      <div class="u-relics">
        <button
          v-for="r in RELICS"
          :key="r.id"
          type="button"
          class="u-relic"
          :class="{ on: selected.includes(r.id), locked: r.locked, blocked: !selected.includes(r.id) && !canAdd(selected, r.id) }"
          :disabled="r.locked"
          :aria-pressed="selected.includes(r.id)"
          @click="toggle(r.id)"
        >
          <span class="u-relic-head">
            <span class="u-relic-name">{{ r.name }}</span>
            <span class="u-relic-mass">{{ r.mass }} kg</span>
          </span>
          <span class="u-relic-desc">{{ r.desc }}</span>
        </button>
      </div>

      <div v-if="selected.includes('bottle')" class="u-card u-bottle">
        <h2 class="u-card-title">瓶子里的话</h2>
        <textarea v-model="bottleText" rows="3" maxlength="240" class="u-textarea" placeholder="新宇宙里的谁会读到它？"></textarea>
      </div>

      <div class="u-row u-confirm">
        <button type="button" class="u-btn" @click="phase = 'broadcast'">再想想</button>
        <button type="button" class="u-btn primary" @click="confirmReturn">归还其余 {{ returnedTons }} 吨</button>
      </div>
    </section>

    <!-- ===== 结局：重启 ===== -->
    <section v-else-if="phase === 'reboot'" class="u-reboot">
      <canvas ref="rebootCanvas" class="u-reboot-canvas"></canvas>
      <transition name="fade">
        <div v-if="rebootDone" class="u-ending">
          <p class="u-ending-kicker">新宇宙收到了</p>
          <ul class="u-legacy">
            <li v-for="(l, i) in legacy" :key="i">{{ l }}</li>
            <li v-if="!legacy.length">什么也没有。你把一切都还了回去。</li>
          </ul>
          <blockquote v-if="selected.includes('bottle') && bottleText.trim()" class="u-bottle-quote">{{ bottleText }}</blockquote>
          <p class="u-ending-text">
            旧宇宙的质量回来了一点点。它会再次坍缩，然后重新开始——<br />带着你留下的这 {{ mass.toFixed(1) }} 公斤。
          </p>
          <div class="u-row">
            <button type="button" class="u-btn" @click="resetAll">回到第一天</button>
            <RouterLink to="/sector-x" class="u-btn primary">去见归零者 →</RouterLink>
          </div>
        </div>
      </transition>
    </section>

    <!-- ===== 结局：永恒 ===== -->
    <section v-else class="u-eternity">
      <div class="u-window-out" :style="{ '--out': windowLight }">
        <span class="u-window-label">窗外</span>
        <span class="u-window-stars" aria-hidden="true"></span>
      </div>
      <div class="u-eternity-text">
        <p class="u-years">{{ formatYears(years) }}</p>
        <p class="u-outside">{{ outsideText }}</p>
        <p class="u-inside">小宇宙里：第 {{ eco.day }} 天。太阳照常升起。</p>
        <transition name="fade">
          <div v-if="eternityEnded" class="u-ending">
            <p class="u-ending-text">你拥有了永恒——在一个已经死去的宇宙里。</p>
            <p class="u-hint">广播还在重复。它会一直重复下去。</p>
            <div class="u-row">
              <button type="button" class="u-btn primary" @click="goChoose">改变主意，归还质量</button>
              <button type="button" class="u-btn" @click="resetAll">回到第一天</button>
            </div>
          </div>
        </transition>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-u {
  --u-amber: #f0b45a;
  --u-ink: #f3e6d3;
  --u-dim: #b9a58b;
  --u-card: rgba(48, 34, 22, 0.55);
  --u-line: rgba(240, 180, 90, 0.22);
  min-height: 100%;
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  background:
    radial-gradient(ellipse at 70% -10%, rgba(240, 180, 90, 0.18), transparent 55%),
    linear-gradient(180deg, #1c140d 0%, #120c08 100%);
  color: var(--u-ink);
  font-family: var(--font-sans);
  transition: background 1.2s;
}
.sector-u.phase-broadcast,
.sector-u.phase-choose {
  background:
    radial-gradient(ellipse at 50% -20%, rgba(150, 190, 255, 0.14), transparent 60%),
    linear-gradient(180deg, #0b0e15 0%, #07080c 100%);
}
.sector-u.phase-reboot { background: #040308; }
.sector-u.phase-eternity { background: linear-gradient(180deg, #17110b, #0a0705); }

.u-steps {
  display: flex;
  gap: 0.5rem 1.5rem;
  flex-wrap: wrap;
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0;
  font-size: 0.85rem;
  color: var(--u-dim);
}
.u-steps li { display: flex; align-items: center; gap: 0.45rem; }
.u-step-dot {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--u-line);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
.u-steps li.done { color: var(--u-ink); }
.u-steps li.done .u-step-dot { background: rgba(240, 180, 90, 0.2); border-color: var(--u-amber); }
.u-steps li.current { color: var(--u-amber); }
.u-steps li.current .u-step-dot { background: var(--u-amber); color: #1c140d; border-color: var(--u-amber); }

.u-card {
  background: var(--u-card);
  border: 1px solid var(--u-line);
  border-radius: 6px;
  padding: 1.1rem 1.25rem;
}
.u-card-title { margin: 0 0 0.6rem; font-size: 1rem; font-weight: 600; letter-spacing: 0.08em; color: var(--u-amber); }
.u-hint { margin: 0 0 0.75rem; font-size: 0.875rem; line-height: 1.6; color: var(--u-dim); }
.u-hint.strong { color: var(--u-ink); }
.u-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.u-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1.2rem;
  font: inherit;
  font-size: 0.9rem;
  color: var(--u-ink);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(243, 230, 211, 0.3);
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s, border-color 0.2s;
}
.u-btn:hover:not(:disabled) { border-color: var(--u-amber); }
.u-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.u-btn.primary { background: var(--u-amber); border-color: var(--u-amber); color: #1c140d; font-weight: 600; }
.u-btn:focus-visible { outline: 2px solid var(--u-amber); outline-offset: 2px; }

.u-textarea {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--u-ink);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--u-line);
  border-radius: 4px;
  resize: vertical;
}

/* 田园 */
.u-garden { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.u-scene {
  position: relative;
  aspect-ratio: 5 / 3;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--u-line);
  background: linear-gradient(180deg,
    color-mix(in srgb, #ffd98a calc(var(--light) * 60%), #2a2a3a) 0%,
    color-mix(in srgb, #f6e7c8 calc(var(--light) * 70%), #1b1a24) 70%);
  transition: background 0.6s;
}
.u-scene-svg { width: 100%; height: 100%; display: block; }
.u-sun { transition: r 0.6s; }
.u-plant { transform-box: fill-box; transform-origin: bottom center; animation: sway 4s ease-in-out infinite alternate; }
@keyframes sway { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
.u-window { animation: glow 3s ease-in-out infinite alternate; }
@keyframes glow { to { opacity: 0.6; } }
.u-scene-hud {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.6rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: #f6ead6;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.u-scene-hud .warn { color: #ff9b7a; }
.u-panels { display: flex; flex-direction: column; gap: 1rem; }
.u-mood { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 0.95rem; color: var(--u-ink); }
.u-ctrl { display: block; margin-bottom: 0.4rem; }
.u-ctrl > span { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--u-dim); }
.u-ctrl em { font-style: normal; font-family: var(--font-mono); color: var(--u-ink); }
.u-capsule-row { display: flex; gap: 0.6rem; align-items: stretch; }
.u-notes { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.u-notes li { font-family: var(--font-serif); font-size: 0.9rem; line-height: 1.5; color: var(--u-ink); }
.u-notes li span { margin-right: 0.5rem; font-family: var(--font-mono); font-size: 0.75rem; color: var(--u-dim); }

.u-noise { display: flex; gap: 3px; height: 24px; align-items: flex-end; margin-bottom: 0.6rem; }
.u-noise span { flex: 1; background: rgba(243, 230, 211, 0.25); animation: noise 0.9s steps(3) infinite alternate; height: 30%; }
@keyframes noise { 0% { height: 20%; } 50% { height: 55%; } 100% { height: 35%; } }
.u-receiver.live { border-color: rgba(150, 190, 255, 0.55); box-shadow: 0 0 24px rgba(150, 190, 255, 0.15); }
.u-receiver.live .u-noise span { background: rgba(150, 190, 255, 0.7); animation-duration: 0.35s; }

/* 广播 */
.u-broadcast { display: flex; justify-content: center; padding: 2rem 0; }
.u-broadcast-frame { max-width: 40rem; width: 100%; }
.u-broadcast-src { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.15em; color: #8fa6c9; margin: 0 0 1.5rem; }
.u-broadcast-text p { margin: 0 0 1.1rem; font-family: var(--font-serif); font-size: 1.15rem; line-height: 1.9; color: #e4ecf8; }
.u-question { font-size: 0.95rem; line-height: 1.8; color: #b8c4d8; margin: 2rem 0 1.25rem; }
.u-skip { margin-top: 1rem; background: none; border: 0; color: #8fa6c9; font: inherit; font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
.line-enter-active { transition: opacity 1.2s, transform 1.2s; }
.line-enter-from { opacity: 0; transform: translateY(6px); }
.phase-broadcast .u-btn.primary, .phase-choose .u-btn.primary { background: #cfe0ff; border-color: #cfe0ff; color: #0b0e15; }

/* 抉择 */
.u-choose { max-width: 60rem; }
.u-scale { margin-bottom: 1.25rem; }
.u-scale-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
.u-scale-num { font-family: var(--font-mono); font-size: 1.4rem; color: #e4ecf8; }
.u-scale-num.full { color: var(--u-amber); }
.u-scale-bar { height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; margin-bottom: 0.6rem; }
.u-scale-bar div { height: 100%; background: linear-gradient(90deg, #8fa6c9, var(--u-amber)); transition: width 0.3s; }
.u-relics { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.u-relic {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.9rem 1rem;
  text-align: left;
  font: inherit;
  color: var(--u-ink);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(207, 224, 255, 0.18);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, opacity 0.2s;
}
.u-relic:hover:not(:disabled) { border-color: rgba(207, 224, 255, 0.5); }
.u-relic.on { border-color: var(--u-amber); background: rgba(240, 180, 90, 0.1); }
.u-relic.blocked { opacity: 0.5; }
.u-relic.locked { opacity: 0.55; cursor: not-allowed; border-style: dashed; }
.u-relic-head { display: flex; justify-content: space-between; gap: 0.5rem; }
.u-relic-name { font-weight: 600; }
.u-relic-mass { font-family: var(--font-mono); font-size: 0.8rem; color: var(--u-dim); white-space: nowrap; }
.u-relic-desc { font-size: 0.85rem; line-height: 1.6; color: #b8c4d8; }
.u-bottle { margin-bottom: 1.25rem; background: rgba(240, 180, 90, 0.06); }
.u-confirm { justify-content: flex-end; }

/* 结局：重启 */
.u-reboot { position: relative; min-height: 70vh; }
.u-reboot-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.u-ending {
  position: relative;
  max-width: 38rem;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.u-reboot .u-ending { padding-top: 12vh; text-shadow: 0 0 20px #040308; }
.u-ending-kicker { margin: 0; font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.25em; color: #9fb4d6; }
.u-legacy { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; font-family: var(--font-serif); font-size: 1rem; color: #e9eef7; }
.u-bottle-quote {
  margin: 0.5rem 0;
  padding: 1rem 1.25rem;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  line-height: 1.8;
  color: #ffe2b0;
  border-left: 2px solid var(--u-amber);
  background: rgba(240, 180, 90, 0.08);
  white-space: pre-wrap;
  text-align: left;
}
.u-ending-text { margin: 0.5rem 0 0.5rem; font-family: var(--font-serif); font-size: 1.15rem; line-height: 1.9; color: var(--u-ink); }

/* 结局：永恒 */
.u-eternity { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 2rem; align-items: center; min-height: 60vh; }
.u-window-out {
  position: relative;
  aspect-ratio: 3 / 4;
  max-height: 60vh;
  border: 10px solid #4a3424;
  border-radius: 4px;
  background: radial-gradient(circle at 40% 40%, rgba(120, 150, 220, calc(var(--out) * 0.6)), #000 70%);
  overflow: hidden;
  box-shadow: inset 0 0 40px #000;
}
.u-window-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 20% 30%, #fff, transparent),
    radial-gradient(1px 1px at 70% 60%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 40% 80%, #fff, transparent),
    radial-gradient(1px 1px at 85% 20%, #fff, transparent),
    radial-gradient(1px 1px at 55% 45%, #fff, transparent);
  opacity: var(--out);
  transition: opacity 0.4s;
}
.u-window-label { position: absolute; top: 0.5rem; left: 0.6rem; font-size: 0.75rem; color: var(--u-dim); z-index: 1; }
.u-years { margin: 0; font-family: var(--font-mono); font-size: clamp(2rem, 5vw, 3.2rem); color: var(--u-amber); }
.u-outside { margin: 0.75rem 0 0.25rem; font-size: 1rem; color: #b8c4d8; }
.u-inside { margin: 0; font-size: 0.95rem; color: var(--u-ink); }
.u-eternity .u-ending { text-align: left; align-items: flex-start; padding: 2rem 0 0; margin: 0; }

.fade-enter-active { transition: opacity 1.6s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .u-garden, .u-eternity { grid-template-columns: 1fr; }
  .u-window-out { max-height: 40vh; aspect-ratio: 4 / 3; }
  .u-confirm { justify-content: stretch; }
  .u-confirm .u-btn { flex: 1; }
  .u-broadcast-text p { font-size: 1.05rem; }
}
</style>
