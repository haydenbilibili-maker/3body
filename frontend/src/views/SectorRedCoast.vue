<script setup lang="ts">
/**
 * Sector R：红岸基地（1971）
 * 第一幕 发射：对准太阳、打开太阳增益、按住发射（不可撤销）
 * 第二幕 等待：信号以光速往返半人马座 α，八年压缩成十几秒
 * 第三幕 回答：收到「不要回答」，由你决定
 * 逻辑与文本见 sim/redCoast.ts。
 */
import { computed, onUnmounted, reactive, ref } from 'vue'
import { NSlider, NSwitch } from 'naive-ui'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import ETOAssembly from '@/components/ETOAssembly.vue'
import { sectorByPath } from '@/data/sectors'
import {
  ALIGNED_AT,
  ALPHA_CEN_LY,
  BEFORE_CHOICE,
  ENDINGS,
  REPLY_LINES,
  alignment,
  beatsUntil,
  transmit,
  travelAt,
  type Phase,
} from '@/sim/redCoast'

const phase = ref<Phase>('calibrate')
const question = sectorByPath('/sector-r')?.question

/* ---------- 第一幕：天线 ---------- */
const SUN = { az: 216, el: 38 }
const antenna = reactive({ az: 140, el: 20, tracking: false })
const solarGain = ref(false)
const quality = computed(() => alignment(antenna.az, antenna.el, SUN.az, SUN.el))
const aligned = computed(() => quality.value >= ALIGNED_AT)
let trackTimer: ReturnType<typeof setInterval> | undefined

function toggleTracking() {
  antenna.tracking = !antenna.tracking
  clearInterval(trackTimer)
  if (!antenna.tracking) return
  trackTimer = setInterval(() => {
    antenna.az += Math.sign(SUN.az - antenna.az) * Math.min(1.5, Math.abs(SUN.az - antenna.az))
    antenna.el += Math.sign(SUN.el - antenna.el) * Math.min(1, Math.abs(SUN.el - antenna.el))
    if (antenna.az === SUN.az && antenna.el === SUN.el) {
      antenna.tracking = false
      clearInterval(trackTimer)
    }
  }, 40)
}

/** 天穹图坐标：方位 0–360 映射到宽，仰角 0–90 映射到高 */
const px = (az: number) => (az / 360) * 100
const py = (el: number) => 100 - (el / 90) * 100

function fire() {
  if (transmit(aligned.value, solarGain.value) === 'fades') {
    phase.value = 'faded'
    return
  }
  startTravel()
}

/* ---------- 第二幕：等待 ---------- */
const TRAVEL_MS = 16000
const progress = ref(0)
let travelRaf = 0
let travelStart = 0
function startTravel() {
  phase.value = 'travel'
  progress.value = 0
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  travelStart = performance.now()
  const step = (now: number) => {
    progress.value = reduce ? 1 : Math.min(1, (now - travelStart) / TRAVEL_MS)
    if (progress.value < 1) travelRaf = requestAnimationFrame(step)
    else setTimeout(openReply, 900)
  }
  travelRaf = requestAnimationFrame(step)
}
function skipTravel() {
  cancelAnimationFrame(travelRaf)
  progress.value = 1
  openReply()
}
const travel = computed(() => travelAt(progress.value))
const beats = computed(() => beatsUntil(progress.value))

/* ---------- 第三幕：回答 ---------- */
const replyShown = ref(0)
let replyTimer: ReturnType<typeof setInterval> | undefined
function openReply() {
  if (phase.value === 'reply') return
  phase.value = 'reply'
  replyShown.value = 0
  clearInterval(replyTimer)
  replyTimer = setInterval(() => {
    replyShown.value += 1
    if (replyShown.value >= REPLY_LINES.length + 1) clearInterval(replyTimer)
  }, 1500)
}
const choiceReady = computed(() => replyShown.value > REPLY_LINES.length)

const showEto = ref(false)
const ending = computed(() =>
  phase.value === 'answered' || phase.value === 'silent' || phase.value === 'faded' ? ENDINGS[phase.value] : null,
)

function restart() {
  cancelAnimationFrame(travelRaf)
  clearInterval(replyTimer)
  clearInterval(trackTimer)
  Object.assign(antenna, { az: 140, el: 20, tracking: false })
  solarGain.value = false
  progress.value = 0
  showEto.value = false
  phase.value = 'calibrate'
}

onUnmounted(() => {
  cancelAnimationFrame(travelRaf)
  clearInterval(replyTimer)
  clearInterval(trackTimer)
})

const ACTS = [
  { id: 'send', label: '发射' },
  { id: 'wait', label: '等待' },
  { id: 'answer', label: '回答' },
]
const actIndex = computed(() =>
  phase.value === 'calibrate' || phase.value === 'faded' ? 0 : phase.value === 'travel' ? 1 : 2,
)
</script>

<template>
  <div class="sector-r">
    <SectorHeader
      title="红岸基地"
      subtitle="1971 年，大兴安岭，雷达峰。一座被当作秘密武器研究的巨型天线。"
      goal="把天线对准太阳，借太阳把信号放大，发向宇宙。然后等待。"
      accent="#d2553f"
      :show-restart="phase !== 'calibrate'"
      restart-label="回到 1971 年"
      @restart="restart"
    />

    <ol class="acts" aria-label="三幕">
      <li v-for="(a, i) in ACTS" :key="a.id" :class="{ done: i < actIndex, current: i === actIndex }">
        <span class="act-no">第{{ ['一', '二', '三'][i] }}幕</span>{{ a.label }}
      </li>
    </ol>

    <!-- 第一幕：发射 -->
    <Vitrine v-if="phase === 'calibrate'" caption="太阳表层能把特定频率的电波放大成千上万倍。用太阳作天线，信号就能抵达其他恒星——前提是先对准它。">
      <div class="calibrate">
        <div class="sky" role="img" :aria-label="`天线与太阳的吻合度 ${quality}%`">
          <div class="sky-grid" aria-hidden="true"></div>
          <span class="sky-label h">方位</span>
          <span class="sky-label v">仰角</span>
          <span class="sun" :class="{ locked: aligned }" :style="{ left: px(SUN.az) + '%', top: py(SUN.el) + '%' }"></span>
          <span class="aim" :class="{ locked: aligned }" :style="{ left: px(antenna.az) + '%', top: py(antenna.el) + '%' }"></span>
        </div>

        <div class="controls">
          <label class="ctrl">
            <span>方位角 <b class="num">{{ antenna.az.toFixed(1) }}°</b></span>
            <NSlider v-model:value="antenna.az" :min="0" :max="360" :step="0.5" :disabled="antenna.tracking" :tooltip="false" />
          </label>
          <label class="ctrl">
            <span>仰角 <b class="num">{{ antenna.el.toFixed(1) }}°</b></span>
            <NSlider v-model:value="antenna.el" :min="0" :max="90" :step="0.5" :disabled="antenna.tracking" :tooltip="false" />
          </label>
          <button type="button" class="plain-btn" :aria-pressed="antenna.tracking" @click="toggleTracking">
            {{ antenna.tracking ? '停止追踪' : '自动追踪太阳' }}
          </button>

          <dl class="readouts">
            <div><dt>吻合度</dt><dd class="num" :class="{ ok: aligned }">{{ quality }}%</dd></div>
            <div><dt>发射机功率</dt><dd><span class="num">15</span> 兆瓦</dd></div>
          </dl>

          <label class="gain">
            <NSwitch v-model:value="solarGain" />
            <span>太阳增益<em>{{ solarGain ? '已打开：以太阳为放大器' : '关闭：信号只靠发射机本身' }}</em></span>
          </label>

          <HoldButton tone="rust" :hold-ms="1600" class="fire" @confirm="fire">按住，向太阳发射</HoldButton>
          <p class="note">发出去的信号收不回来。</p>
        </div>
      </div>
    </Vitrine>

    <!-- 第二幕：等待 -->
    <Vitrine v-else-if="phase === 'travel'" caption="信号与回信都以光速前进。八年在这里被压缩成十几秒。">
      <div class="travel">
        <p class="year"><span class="num">{{ Math.floor(travel.year) }}</span> 年</p>
        <div class="track" aria-hidden="true">
          <span class="body sol">太阳</span>
          <span class="body cen">半人马座 α</span>
          <span class="track-line"></span>
          <span class="pulse" :class="{ back: travel.returning }" :style="{ left: travel.position * 100 + '%' }"></span>
          <span class="distance">{{ ALPHA_CEN_LY }} 光年</span>
        </div>
        <transition-group name="beat" tag="ol" class="beats">
          <li v-for="b in beats" :key="b.at">{{ b.text }}</li>
        </transition-group>
        <button type="button" class="link-btn" @click="skipTravel">跳过等待</button>
      </div>
    </Vitrine>

    <!-- 第三幕：回答 -->
    <Vitrine v-else-if="phase === 'reply'">
      <div class="reply">
        <p class="reply-head">1979 年。接收器里出现了一段有规律的信号，来源是半人马座 α。</p>
        <transition-group name="beat" tag="div" class="reply-lines">
          <p v-for="(line, i) in REPLY_LINES.slice(0, replyShown)" :key="i" :class="{ warn: line.includes('不要回答') }">
            {{ line }}
          </p>
        </transition-group>
        <transition name="beat">
          <div v-if="choiceReady" class="choice">
            <p class="before">{{ BEFORE_CHOICE }}</p>
            <div class="choice-actions">
              <HoldButton tone="rust" :hold-ms="2400" @confirm="phase = 'answered'">按住，回答它</HoldButton>
              <button type="button" class="plain-btn" @click="phase = 'silent'">不回答</button>
            </div>
          </div>
        </transition>
      </div>
    </Vitrine>

    <!-- 结局 -->
    <Vitrine v-else-if="ending">
      <div class="ending">
        <h2 class="ending-title">{{ ending.title }}</h2>
        <p v-for="(l, i) in ending.lines" :key="i" class="ending-line">{{ l }}</p>
        <p v-if="phase !== 'faded'" class="ending-question">{{ question }}</p>
        <div class="ending-actions">
          <button type="button" class="plain-btn" @click="restart">回到 1971 年</button>
          <template v-if="phase === 'answered'">
            <RouterLink to="/sector-pdc" class="plain-btn">进入危机纪元</RouterLink>
            <button type="button" class="plain-btn" :aria-expanded="showEto" @click="showEto = !showEto">
              {{ showEto ? '收起' : '你回答之后，地球三体组织' }}
            </button>
          </template>
          <RouterLink v-else-if="phase === 'silent'" to="/sector-e" class="plain-btn">沉默的另一面：黑暗森林</RouterLink>
        </div>
      </div>
    </Vitrine>

    <div v-if="showEto && phase === 'answered'" class="eto">
      <ETOAssembly />
    </div>
  </div>
</template>

<style scoped>
.sector-r {
  --r-rust: #d2553f;
  padding: 2rem clamp(1rem, 4vw, 3rem) 3rem;
  max-width: 76rem;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.acts { display: flex; gap: 2rem; list-style: none; margin: 0 0 1.25rem; padding: 0; font-family: var(--font-serif); font-size: 0.9375rem; color: var(--weathered); }
.acts li { display: flex; align-items: baseline; gap: 0.5rem; }
.act-no { font-size: 0.8125rem; }
.acts .current { color: var(--bone); }
.acts .current .act-no { color: var(--r-rust); }
.acts .done { color: var(--gray-300); }

.plain-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.2rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.2s;
}
.plain-btn:hover { border-color: var(--weathered); }
.plain-btn[aria-pressed='true'] { border-color: var(--cherenkov); color: var(--cherenkov); }
.link-btn { margin-top: 1rem; padding: 0; font: inherit; font-size: 0.875rem; color: var(--weathered); background: none; border: 0; text-decoration: underline; cursor: pointer; }

/* 第一幕 */
.calibrate { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 1fr); gap: 2rem; align-items: start; }
.sky {
  position: relative;
  aspect-ratio: 2 / 1;
  background:
    radial-gradient(ellipse at 60% 110%, rgba(210, 85, 63, 0.12), transparent 60%),
    linear-gradient(180deg, #17181b, #1f1d1c);
  border: 1px solid var(--incision-soft);
  overflow: hidden;
}
.sky-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(220, 214, 200, 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(220, 214, 200, 0.06) 1px, transparent 1px);
  background-size: 8.333% 25%;
}
.sky-label { position: absolute; font-size: 0.75rem; color: var(--weathered); }
.sky-label.h { right: 0.6rem; bottom: 0.4rem; }
.sky-label.v { left: 0.6rem; top: 0.4rem; }
.sun, .aim { position: absolute; transform: translate(-50%, -50%); }
.sun {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffe2a8 0%, #e89a4e 55%, rgba(232, 154, 78, 0) 72%);
}
.sun.locked { box-shadow: 0 0 0 10px rgba(232, 154, 78, 0.12), 0 0 40px rgba(232, 154, 78, 0.5); }
.aim {
  width: 34px;
  height: 34px;
  border: 1px solid var(--bone);
  border-radius: 50%;
  transition: border-color 0.3s;
}
.aim::before, .aim::after { content: ''; position: absolute; background: var(--bone); }
.aim::before { left: 50%; top: -8px; bottom: -8px; width: 1px; }
.aim::after { top: 50%; left: -8px; right: -8px; height: 1px; }
.aim.locked { border-color: var(--cherenkov); }
.aim.locked::before, .aim.locked::after { background: var(--cherenkov); }

.controls { display: flex; flex-direction: column; gap: 0.9rem; }
.ctrl > span { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--weathered); }
.ctrl b { font-weight: 400; color: var(--bone); }
.readouts { display: flex; gap: 2rem; margin: 0.25rem 0 0; }
.readouts dt { font-size: 0.8125rem; color: var(--weathered); }
.readouts dd { margin: 0.15rem 0 0; font-size: 1.125rem; color: var(--bone); }
.readouts dd.ok { color: var(--cherenkov); }
.gain { display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; }
.gain span { display: flex; flex-direction: column; font-size: 0.9375rem; color: var(--bone); }
.gain em { font-style: normal; font-size: 0.8125rem; color: var(--weathered); }
.fire { margin-top: 0.5rem; width: 100%; }
.note { margin: -0.4rem 0 0; font-size: 0.8125rem; color: var(--weathered); }

/* 第二幕 */
.travel { padding: 1rem 0 0.5rem; }
.year { margin: 0 0 1.5rem; font-family: var(--font-serif); font-size: 1.25rem; color: var(--weathered); }
.year .num { font-size: clamp(3rem, 7vw, 4.5rem); color: var(--bone); margin-right: 0.25rem; }
.track { position: relative; height: 4.5rem; margin: 0 1.5rem 1.5rem; }
.track-line { position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--incision); }
.body { position: absolute; top: 0; font-family: var(--font-serif); font-size: 0.875rem; color: var(--gray-200); }
.body::after { content: ''; position: absolute; top: calc(2.25rem - 5px); width: 10px; height: 10px; border-radius: 50%; background: #e7b46a; }
.body.sol { left: 0; transform: translateX(-50%); }
.body.sol::after { left: calc(50% - 5px); }
.body.cen { right: 0; transform: translateX(50%); }
.body.cen::after { left: calc(50% - 5px); background: var(--bone); }
.distance { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); font-size: 0.8125rem; color: var(--weathered); }
.pulse {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--cherenkov);
  box-shadow: 0 0 14px rgba(var(--cherenkov-rgb), 0.9), 0 0 0 6px rgba(var(--cherenkov-rgb), 0.12);
}
.pulse.back { background: var(--bone); box-shadow: 0 0 14px rgba(220, 214, 200, 0.7); }
.beats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; max-width: 38rem; }
.beats li { font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }

/* 第三幕 */
.reply { max-width: 40rem; }
.reply-head { margin: 0 0 1.5rem; font-size: 0.9375rem; color: var(--weathered); }
.reply-lines p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.9; color: var(--gray-150); }
.reply-lines p.warn { font-size: clamp(1.4rem, 2.6vw, 1.9rem); font-weight: 900; letter-spacing: 0.08em; color: var(--r-rust); }
.choice { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--incision); }
.before { margin: 0 0 1.25rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--bone); }
.choice-actions { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; }

/* 结局 */
.ending { max-width: 40rem; padding: 0.5rem 0; }
.ending-title { margin: 0 0 1rem; font-family: var(--font-title); font-weight: 900; font-size: 2rem; letter-spacing: 0.1em; color: var(--bone); }
.ending-line { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--gray-150); }
.ending-question { margin: 1.5rem 0 0; padding-left: 1rem; border-left: 1px solid var(--r-rust); font-family: var(--font-serif); font-size: 1.125rem; line-height: 1.8; color: var(--bone); }
.ending-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.75rem; }
.eto { margin-top: 1.5rem; }

.beat-enter-active { transition: opacity 1.2s, filter 1.2s; }
.beat-enter-from { opacity: 0; filter: blur(4px); }

@media (max-width: 900px) {
  .calibrate { grid-template-columns: 1fr; }
  .acts { gap: 1rem; font-size: 0.875rem; }
  .track { margin: 0 2.5rem 1.5rem; }
}
</style>
