<script setup lang="ts">
/**
 * Sector V：人列计算机
 * 四关：为士兵方阵选择口令，搭出非门、异或、半加器、全加器；
 * 终章：秦始皇一号用这台计算机预测三颗太阳——再看着预测与天空分道扬镳。
 * 电路逻辑见 sim/humanComputer.ts，天空见 sim/threeBody.ts。
 */
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import { sectorByPath } from '@/data/sectors'
import { GATE_INFO, LEVELS, evaluate, solved, truthTable, type Assignment, type Gate } from '@/sim/humanComputer'
import { advanceDay, classify, cloneSystem, createSystem, flux, forecast, type Env } from '@/sim/threeBody'

const question = sectorByPath('/sector-v')?.question
const STORE = '3body:computer-solved'
function readSolved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const solvedIds = ref<string[]>(readSolved())
function markSolved(id: string) {
  if (solvedIds.value.includes(id)) return
  solvedIds.value = [...solvedIds.value, id]
  try {
    localStorage.setItem(STORE, JSON.stringify(solvedIds.value))
  } catch {
    /* 存储不可用时忽略 */
  }
}

const levelIndex = ref(0)
const finale = ref(false)
const level = computed(() => LEVELS[levelIndex.value])
const assignments = reactive<Record<string, Assignment>>(Object.fromEntries(LEVELS.map((l) => [l.id, {}])))
const assign = computed(() => assignments[level.value.id])
const inputBits = ref<number[]>([0, 0, 0])
const bits = computed(() => inputBits.value.slice(0, level.value.inputs.length))
const values = computed(() => evaluate(level.value, assign.value, bits.value))
const rows = computed(() => truthTable(level.value, assign.value))
const isSolved = computed(() => solved(level.value, assign.value))
const allSolved = computed(() => LEVELS.every((l) => solvedIds.value.includes(l.id)))
const selectedNode = ref<string | null>(null)
const selectedInfo = computed(() => {
  const n = level.value.nodes.find((x) => x.id === selectedNode.value)
  const g = n ? assign.value[n.id] : undefined
  return g ? GATE_INFO[g] : null
})

watch(isSolved, (ok) => ok && markSolved(level.value.id))

function cycle(nodeId: string) {
  const n = level.value.nodes.find((x) => x.id === nodeId)
  if (!n) return
  const cur = assign.value[nodeId]
  const i = cur ? n.choices.indexOf(cur) : -1
  assignments[level.value.id] = { ...assign.value, [nodeId]: n.choices[(i + 1) % n.choices.length] as Gate }
  selectedNode.value = nodeId
}
function toggleInput(i: number) {
  const next = [...inputBits.value]
  next[i] = next[i] ? 0 : 1
  inputBits.value = next
}
function openLevel(i: number) {
  finale.value = false
  levelIndex.value = i
  inputBits.value = [0, 0, 0]
  selectedNode.value = null
}
function resetLevel() {
  assignments[level.value.id] = {}
}

/** 输入在图上的纵向位置 */
const inputY = (i: number) => ((i + 1) / (level.value.inputs.length + 1)) * 100
const outputY = (i: number) => ((i + 1) / (level.value.outputs.length + 1)) * 100
function pos(id: string): { x: number; y: number } {
  const ii = level.value.inputs.indexOf(id)
  if (ii >= 0) return { x: 9, y: inputY(ii) }
  const n = level.value.nodes.find((x) => x.id === id)
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 }
}
const rowMatches = (r: { bits: number[] }) => r.bits.every((b, i) => b === bits.value[i])

/* ---------- 终章：秦始皇一号 ---------- */
const ENV_NAME: Record<Env, string> = { stable: '恒纪元', heat: '三日凌空', cold: '严寒' }
const DAYS = 60
const phase = ref<'idle' | 'computing' | 'done'>('idle')
const predicted = ref<Env[]>([])
const actual = ref<Env[]>([])
const shownDays = ref(0)
const firstMiss = computed(() => predicted.value.findIndex((e, i) => i < shownDays.value && e !== actual.value[i]))
const phalanx = ref<HTMLCanvasElement | null>(null)
let raf = 0
let dayTimer: ReturnType<typeof setInterval> | undefined

function runEmperor() {
  phase.value = 'computing'
  const sys = createSystem(Math.floor(Math.random() * 1e6))
  predicted.value = forecast(sys, DAYS, 0.1, 7)
  const truth = cloneSystem(sys)
  actual.value = Array.from({ length: DAYS }, () => {
    advanceDay(truth)
    return classify(flux(truth))
  })
  shownDays.value = 0
  nextTick(drawPhalanx)
}
function drawPhalanx() {
  const c = phalanx.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const dpr = window.devicePixelRatio || 1
  c.width = c.clientWidth * dpr
  c.height = c.clientHeight * dpr
  const cols = 96
  const rowsN = 30
  const cw = c.width / cols
  const ch = c.height / rowsN
  const start = performance.now()
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const DURATION = reduce ? 1 : 5200
  const frame = (now: number) => {
    const t = (now - start) / DURATION
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, c.width, c.height)
    for (let y = 0; y < rowsN; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        // 一道道波从左向右扫过方阵：每个人只看身边的人
        const wave = Math.sin(x * 0.35 - now * 0.012 + y * 0.6) + Math.sin(x * 0.11 + y * 0.9 - now * 0.007)
        const up = wave > 0.6
        ctx.fillStyle = up ? 'rgba(201, 164, 92, 0.95)' : 'rgba(220, 214, 200, 0.16)'
        ctx.fillRect(x * cw + cw * 0.3, y * ch + ch * (up ? 0.15 : 0.45), cw * 0.4, ch * (up ? 0.55 : 0.25))
      }
    }
    if (t < 1) raf = requestAnimationFrame(frame)
    else revealDays()
  }
  raf = requestAnimationFrame(frame)
}
function revealDays() {
  phase.value = 'done'
  clearInterval(dayTimer)
  dayTimer = setInterval(() => {
    shownDays.value += 1
    if (shownDays.value >= DAYS) clearInterval(dayTimer)
  }, 90)
}
onUnmounted(() => {
  cancelAnimationFrame(raf)
  clearInterval(dayTimer)
})
</script>

<template>
  <div class="sector-v">
    <SectorHeader
      title="人列计算机"
      subtitle="冯·诺依曼的设计，秦始皇的三千万大军。一个人，就是一个比特。"
      goal="为每个方阵选择口令，让电路的真值表与目标一致。四关之后，用它去计算三颗太阳。"
      accent="#c9a45c"
    />

    <nav class="levels" aria-label="关卡">
      <button
        v-for="(l, i) in LEVELS"
        :key="l.id"
        type="button"
        :class="{ active: !finale && i === levelIndex, done: solvedIds.includes(l.id) }"
        @click="openLevel(i)"
      >
        {{ l.title }}<span v-if="solvedIds.includes(l.id)" class="tick" aria-label="已完成">✓</span>
      </button>
      <button type="button" class="finale-tab" :class="{ active: finale }" :disabled="!allSolved" @click="finale = true">
        终章：秦始皇一号
      </button>
    </nav>

    <template v-if="!finale">
      <p class="intro">{{ level.intro }}</p>
      <div class="work">
        <Vitrine>
          <div class="circuit" :class="`n-${level.inputs.length}`">
            <svg class="wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <template v-for="n in level.nodes" :key="n.id">
                <line
                  v-for="src in n.inputs"
                  :key="src"
                  :x1="pos(src).x"
                  :y1="pos(src).y"
                  :x2="n.x"
                  :y2="n.y"
                  :class="{ hot: values[src] === 1 }"
                />
              </template>
              <line
                v-for="(o, i) in level.outputs"
                :key="o.name"
                :x1="pos(o.node).x"
                :y1="pos(o.node).y"
                x2="92"
                :y2="outputY(i)"
                :class="{ hot: values[o.node] === 1 }"
              />
            </svg>

            <button
              v-for="(name, i) in level.inputs"
              :key="name"
              type="button"
              class="soldier input"
              :class="{ up: bits[i] === 1 }"
              :style="{ left: '9%', top: inputY(i) + '%' }"
              :aria-pressed="bits[i] === 1"
              :aria-label="`输入 ${name}，${bits[i] ? '举旗' : '不举旗'}`"
              @click="toggleInput(i)"
            >
              <span class="flag" aria-hidden="true"></span>
              <span class="soldier-name">{{ name }}</span>
            </button>

            <button
              v-for="n in level.nodes"
              :key="n.id"
              type="button"
              class="formation"
              :class="{ empty: !assign[n.id], up: values[n.id] === 1, selected: selectedNode === n.id }"
              :style="{ left: n.x + '%', top: n.y + '%' }"
              :aria-label="`方阵，口令：${assign[n.id] ? GATE_INFO[assign[n.id]!].name : '未定'}，点击切换`"
              @click="cycle(n.id)"
            >
              <span class="formation-gate">{{ assign[n.id] ? GATE_INFO[assign[n.id]!].name : '？' }}</span>
              <span class="flag" aria-hidden="true"></span>
            </button>

            <div
              v-for="(o, i) in level.outputs"
              :key="o.name"
              class="output"
              :class="{ up: values[o.node] === 1 }"
              :style="{ left: '92%', top: outputY(i) + '%' }"
            >
              <span class="flag" aria-hidden="true"></span>
              <span class="soldier-name">{{ o.name }}</span>
            </div>
          </div>
          <template #caption>
            点击左侧士兵切换输入，点击方阵切换口令。<template v-if="selectedInfo">「{{ selectedInfo.name }}」：{{ selectedInfo.rule }}。</template>
          </template>
        </Vitrine>

        <aside class="table">
          <h2 class="table-title">真值表</h2>
          <table>
            <thead>
              <tr>
                <th v-for="name in level.inputs" :key="name">{{ name }}</th>
                <th v-for="o in level.outputs" :key="o.name">{{ o.name }}</th>
                <th><span class="sr-only">结果</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, k) in rows" :key="k" :class="{ current: rowMatches(r), ok: r.ok }">
                <td v-for="(b, i) in r.bits" :key="i" class="num">{{ b }}</td>
                <td v-for="(e, i) in r.expected" :key="'e' + i" class="num">
                  {{ e }}<span v-if="r.got[i] !== null && r.got[i] !== e" class="miss">（得 {{ r.got[i] }}）</span>
                </td>
                <td class="mark">{{ r.ok ? '✓' : '' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="table-actions">
            <button type="button" class="plain-btn" @click="resetLevel">清空口令</button>
          </div>
          <transition name="fade">
            <div v-if="isSolved" class="solved">
              <p>方阵运转无误。</p>
              <button v-if="levelIndex < LEVELS.length - 1" type="button" class="plain-btn primary" @click="openLevel(levelIndex + 1)">
                下一关
              </button>
              <button v-else type="button" class="plain-btn primary" @click="finale = true">启动秦始皇一号</button>
            </div>
          </transition>
        </aside>
      </div>
    </template>

    <Vitrine v-else caption="三千万名士兵组成的计算机，按照你搭好的电路，计算三颗太阳在未来六十天里的位置。">
      <div class="emperor">
        <template v-if="phase === 'idle'">
          <p class="emperor-text">方阵已经列好。秦始皇举起令旗。</p>
          <button type="button" class="plain-btn primary" @click="runEmperor">开始计算</button>
        </template>
        <canvas v-show="phase === 'computing'" ref="phalanx" class="phalanx" aria-label="三千万人举旗、放旗"></canvas>
        <template v-if="phase === 'done'">
          <div class="strips">
            <div class="strip">
              <span class="strip-label">预测</span>
              <ol><li v-for="(e, i) in predicted" :key="i" :class="[e, { hidden: i >= shownDays }]"></li></ol>
            </div>
            <div class="strip">
              <span class="strip-label">天空</span>
              <ol><li v-for="(e, i) in actual" :key="i" :class="[e, { hidden: i >= shownDays, miss: i === firstMiss }]"></li></ol>
            </div>
          </div>
          <p class="legend"><span class="sw stable"></span>恒纪元<span class="sw heat"></span>三日凌空<span class="sw cold"></span>严寒</p>
          <div v-if="shownDays >= DAYS" class="emperor-end">
            <p v-if="firstMiss >= 0">
              前 {{ firstMiss }} 天，人列计算机给出的历法比任何巫师都准。第 {{ firstMiss + 1 }} 天，预测说「{{ ENV_NAME[predicted[firstMiss]] }}」，天空给出的却是「{{ ENV_NAME[actual[firstMiss]] }}」。
            </p>
            <p v-else>六十天里，预测与天空分毫不差。这一次运气很好——再算一次，看看它能撑多久。</p>
            <p>计算是秩序：三千万人，每人只看身边的两个人。三颗太阳没有这种秩序。</p>
            <p class="end-question">{{ question }}</p>
            <div class="end-actions">
              <button type="button" class="plain-btn" @click="runEmperor">再算一次</button>
              <RouterLink to="/sector-t" class="plain-btn">去三体摆亲自过一过这样的日子</RouterLink>
            </div>
          </div>
        </template>
      </div>
    </Vitrine>
  </div>
</template>

<style scoped>
.sector-v {
  --bronze: #c9a45c;
  --heat: #e8814f;
  --cold: #b9d0f5;
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  max-width: 78rem;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.levels { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
.levels button {
  padding: 0.5rem 0.9rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision-soft);
  border-radius: 2px;
  cursor: pointer;
}
.levels button.active { color: var(--bone); border-color: var(--bronze); }
.levels button:disabled { opacity: 0.4; cursor: not-allowed; }
.tick { margin-left: 0.4rem; color: var(--bronze); }
.intro { max-width: 40rem; margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }

.work { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
.circuit { position: relative; aspect-ratio: 16 / 9; }
.wires { position: absolute; inset: 0; width: 100%; height: 100%; }
.wires line { stroke: var(--incision); stroke-width: 0.5; vector-effect: non-scaling-stroke; }
.wires line.hot { stroke: var(--bronze); stroke-width: 2; }

.soldier, .formation, .output {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.soldier, .formation { font: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
.flag {
  width: 14px;
  height: 22px;
  border-left: 2px solid var(--weathered);
  position: relative;
}
.flag::after {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 11px;
  height: 7px;
  background: var(--incision);
  transition: top 0.25s, background 0.25s;
}
.up .flag::after { top: 0; background: var(--bronze); }
.soldier-name { font-size: 0.8125rem; color: var(--gray-200); }
.formation {
  min-width: 4.5rem;
  padding: 0.5rem 0.6rem 0.4rem;
  background: var(--slab-raised);
  border: 1px solid var(--incision);
  border-radius: 2px;
}
.formation.empty { border-style: dashed; }
.formation.selected { border-color: var(--bronze); }
.formation:focus-visible, .soldier:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }
.formation-gate { font-family: var(--font-serif); font-size: 1rem; color: var(--bone); }
.empty .formation-gate { color: var(--weathered); }

.table-title { margin: 0 0 0.6rem; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; color: var(--bone); }
table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
th { padding: 0.35rem 0.5rem; font-weight: 400; font-size: 0.8125rem; color: var(--weathered); text-align: left; border-bottom: 1px solid var(--incision); }
td { padding: 0.4rem 0.5rem; color: var(--gray-200); border-bottom: 1px solid var(--incision-soft); }
tr.current td { background: rgba(var(--cherenkov-rgb), 0.07); color: var(--bone); }
td.mark { color: var(--bronze); width: 1.5rem; }
.miss { margin-left: 0.25rem; font-family: var(--font-sans); font-size: 0.75rem; color: var(--rust-bright); }
.table-actions { margin-top: 0.75rem; }
.solved { margin-top: 1rem; padding: 1rem; border: 1px solid var(--bronze); background: rgba(201, 164, 92, 0.07); }
.solved p { margin: 0 0 0.75rem; font-family: var(--font-serif); color: var(--bone); }

.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn.primary { border-color: var(--bronze); color: var(--bronze); }

.emperor { min-height: 18rem; }
.emperor-text { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); }
.phalanx { width: 100%; height: 18rem; display: block; }
.strips { display: flex; flex-direction: column; gap: 0.6rem; }
.strip { display: grid; grid-template-columns: 3rem 1fr; align-items: center; gap: 0.75rem; }
.strip-label { font-size: 0.875rem; color: var(--weathered); }
.strip ol { display: grid; grid-template-columns: repeat(60, 1fr); gap: 2px; list-style: none; margin: 0; padding: 0; }
.strip li { height: 22px; transition: opacity 0.3s; }
.strip li.hidden { opacity: 0; }
.strip li.stable, .sw.stable { background: rgba(var(--cherenkov-rgb), 0.55); }
.strip li.heat, .sw.heat { background: var(--heat); }
.strip li.cold, .sw.cold { background: var(--cold); }
.strip li.miss { outline: 2px solid var(--rust-bright); outline-offset: 1px; }
.legend { display: flex; align-items: center; gap: 0.4rem; margin: 0.75rem 0 0; font-size: 0.8125rem; color: var(--weathered); }
.sw { width: 10px; height: 10px; margin-left: 0.6rem; }
.sw:first-child { margin-left: 0; }
.emperor-end { max-width: 40rem; margin-top: 1.5rem; }
.emperor-end p { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.end-question { margin-top: 1.25rem !important; padding-left: 1rem; border-left: 1px solid var(--bronze); color: var(--bone) !important; }
.end-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.25rem; }
.fade-enter-active { transition: opacity 0.6s; }
.fade-enter-from { opacity: 0; }

@media (max-width: 900px) {
  .work { grid-template-columns: 1fr; }
  .circuit { aspect-ratio: 4 / 3; }
  .formation { min-width: 3.4rem; padding: 0.35rem 0.4rem; }
  .strip { grid-template-columns: 2.5rem 1fr; }
  .strip ol { grid-template-columns: repeat(30, 1fr); }
  .strip li:nth-child(n + 31) { display: none; }
}
</style>
