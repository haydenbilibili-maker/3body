<script setup lang="ts">
/**
 * Sector M: 宇宙膜「田园时代」
 * 从十维的田园时代开始，亲手把宇宙一维一维折叠下去：光变慢、距离出现、猜疑诞生……
 * 每一次折叠都要按住确认，且不可撤销；走到零维后，可以选择「归零」。
 * 数据见 sim/dimensions.ts。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import { PRESENT_INDEX, STAGES, formatDuration, formatLight, roundTripYears } from '@/sim/dimensions'

const index = ref(0)
const stage = computed(() => STAGES[index.value])
const atEnd = computed(() => index.value === STAGES.length - 1)
const rebooting = ref(false)
const rebootedOnce = ref(false)
const roundTrip = computed(() => formatDuration(roundTripYears(stage.value)))

/* ---------- 按住折叠 ---------- */
const HOLD_MS = 1100
const holdProgress = ref(0)
let holdStart = 0
let holdRaf = 0
let foldAt = 0 // 折叠动画起点（performance.now）

function fold() {
  if (atEnd.value || rebooting.value) return
  index.value += 1
  foldAt = performance.now()
}
function holdTick(now: number) {
  holdProgress.value = Math.min(1, (now - holdStart) / HOLD_MS)
  if (holdProgress.value >= 1) {
    holdProgress.value = 0
    fold()
    return
  }
  holdRaf = requestAnimationFrame(holdTick)
}
function holdDown(e: PointerEvent) {
  if (e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  holdStart = performance.now()
  cancelAnimationFrame(holdRaf)
  holdRaf = requestAnimationFrame(holdTick)
}
function holdUp() {
  cancelAnimationFrame(holdRaf)
  holdProgress.value = 0
}
/** 键盘激活（click 的 detail 为 0）直接折叠，保证无指针设备可用 */
function onFoldClick(e: MouseEvent) {
  if (e.detail === 0) fold()
}

function reboot() {
  rebooting.value = true
  const step = () => {
    if (index.value > 0) {
      index.value -= 1
      foldAt = performance.now()
      setTimeout(step, 260)
    } else {
      rebooting.value = false
      rebootedOnce.value = true
    }
  }
  step()
}

/* ---------- 画布 ---------- */
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ro: ResizeObserver | undefined

function draw(now: number) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const W = canvas.width
  const H = canvas.height
  const dpr = window.devicePixelRatio || 1
  const t = now / 1000
  const s = stage.value
  const d = s.dim
  // 折叠后的 1.2 秒内，波幅先压平再恢复
  const sinceFold = (now - foldAt) / 1200
  const squash = sinceFold < 1 ? Math.abs(Math.cos(sinceFold * Math.PI)) : 1
  const flash = sinceFold < 0.25 ? 1 - sinceFold / 0.25 : 0

  ctx.fillStyle = '#020205'
  ctx.fillRect(0, 0, W, H)

  // 田园的暖光：维度越高越温暖
  const warmth = Math.max(0, Math.min(1, (d - 3) / 7))
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.75)
  g.addColorStop(0, `rgba(${Math.round(120 + 120 * warmth)}, ${Math.round(150 + 60 * warmth)}, ${Math.round(255 - 140 * warmth)}, ${0.1 + 0.22 * warmth})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 膜：每一维一层。三维以下逐渐压扁成直线
  const layers = Math.max(1, d)
  const amp = (d >= 3 ? 1 : d / 3) * squash
  for (let i = 0; i < layers; i += 1) {
    // 暖（田园）≈ 金色 40°，冷（三维及以下）≈ 蓝色 200°
    const hue = 40 + (1 - warmth) * 160 + i * 6
    const alpha = d === 0 ? 0 : 0.1 + 0.5 * (1 - i / layers) * (0.4 + 0.6 * warmth + 0.3)
    ctx.strokeStyle = `hsla(${hue}, ${40 + warmth * 40}%, ${55 + warmth * 15}%, ${Math.min(0.75, alpha)})`
    ctx.lineWidth = (1 + (i === 0 ? 0.6 : 0)) * dpr
    ctx.beginPath()
    const yBase = H * (0.22 + (i / Math.max(1, layers)) * 0.42)
    for (let x = 0; x <= W; x += 8 * dpr) {
      const y =
        yBase +
        amp * (Math.sin(x * 0.004 / dpr + t * (0.3 + i * 0.05) + i) * 26 + Math.sin(x * 0.011 / dpr - t * 0.4 + i * 2) * 10) * dpr
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // 两个文明与它们之间的消息
  // 桌面：放在文字列与刻度之间的空白处；窄屏：放在页面最底部，避开文字
  const narrow = W / dpr < 900
  const y = narrow ? H - 28 * dpr : H * 0.74
  const ax = narrow ? W * 0.1 : W * 0.5
  const bx = narrow ? W * 0.9 : W * 0.8
  const starAlpha = d === 0 ? 0.15 : 1
  for (const x of [ax, bx]) {
    ctx.fillStyle = `rgba(255, 236, 200, ${starAlpha})`
    ctx.beginPath()
    if (d <= 2 && d > 0) ctx.ellipse(x, y, 7 * dpr, 2 * dpr, 0, 0, Math.PI * 2)
    else ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 220, 160, ${0.15 * starAlpha})`
    ctx.beginPath()
    ctx.arc(x, y, 18 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
  if (s.lightFactor === Infinity) {
    // 瞬时：两者之间是一道常亮的光
    const beam = ctx.createLinearGradient(ax, y, bx, y)
    beam.addColorStop(0, 'rgba(255,240,200,0.9)')
    beam.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    beam.addColorStop(1, 'rgba(255,240,200,0.9)')
    ctx.strokeStyle = beam
    ctx.lineWidth = 2 * dpr
    ctx.beginPath()
    ctx.moveTo(ax, y)
    ctx.lineTo(bx, y)
    ctx.stroke()
  } else if (s.lightFactor > 0) {
    // 屏幕上穿越一次所需秒数：随光速对数增长（今天约 9 秒）
    const crossSec = Math.max(0.6, 9 - Math.log10(s.lightFactor) * 1.2) * (s.lightFactor < 1 ? 4 : 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1 * dpr
    ctx.setLineDash([4 * dpr, 6 * dpr])
    ctx.beginPath()
    ctx.moveTo(ax, y)
    ctx.lineTo(bx, y)
    ctx.stroke()
    ctx.setLineDash([])
    for (let k = 0; k < 2; k += 1) {
      const phase = ((t / crossSec + k * 0.5) % 1 + 1) % 1
      const forward = Math.floor(t / crossSec + k * 0.5) % 2 === 0
      const px = forward ? ax + (bx - ax) * phase : bx - (bx - ax) * phase
      ctx.fillStyle = 'rgba(180, 230, 255, 0.95)'
      ctx.beginPath()
      ctx.arc(px, y, 3 * dpr, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(180, 230, 255, 0.18)'
      ctx.beginPath()
      ctx.arc(px, y, 9 * dpr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 零维：只剩一个点
  if (d === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(W / 2, H * 0.45, 1.5 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`
    ctx.fillRect(0, 0, W, H)
  }
  raf = requestAnimationFrame(draw)
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, canvas.clientWidth * dpr)
  canvas.height = Math.max(1, canvas.clientHeight * dpr)
}

onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  if (canvasRef.value) ro.observe(canvasRef.value)
  raf = requestAnimationFrame(draw)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(holdRaf)
  ro?.disconnect()
})
</script>

<template>
  <div class="sector-membrane">
    <canvas ref="canvasRef" class="membrane-canvas" aria-hidden="true"></canvas>

    <div class="m-layout">
      <div class="m-main">
        <SectorHeader
          code="SECTOR M · THE PASTORAL AGE"
          title="田园时代"
          subtitle="宇宙膜 · 维度与光速的往事"
          goal="从十维的田园时代出发，亲手把宇宙一维一维折叠下去，看看我们是怎么走到黑暗森林的。"
          accent="#e8d27a"
          compact
        />

        <transition name="stage" mode="out-in">
          <article :key="stage.dim" class="m-stage">
            <p class="m-stage-dim">
              <span class="m-dim-num">{{ stage.dim }}</span>
              <span class="m-dim-unit">维</span>
              <span class="m-stage-name">{{ stage.name }}</span>
              <span v-if="index === PRESENT_INDEX" class="m-tag now">我们在这里</span>
              <span v-if="stage.imagined" class="m-tag">想象</span>
            </p>
            <p class="m-stage-text">{{ stage.text }}</p>
            <RouterLink v-if="stage.link" :to="stage.link.to" class="m-link">{{ stage.link.label }} →</RouterLink>
          </article>
        </transition>

        <dl class="m-stats">
          <div><dt>光速</dt><dd>{{ formatLight(stage) }}</dd></div>
          <div><dt>相距 100 光年的两个文明，一问一答</dt><dd>{{ roundTrip }}</dd></div>
        </dl>

        <div class="m-actions">
          <button
            v-if="!atEnd"
            type="button"
            class="m-fold"
            :disabled="rebooting"
            :style="{ '--p': holdProgress }"
            @pointerdown="holdDown"
            @pointerup="holdUp"
            @pointercancel="holdUp"
            @pointerleave="holdUp"
            @click="onFoldClick"
          >
            <span class="m-fold-fill" aria-hidden="true"></span>
            <span class="m-fold-label">按住，折叠一个维度</span>
          </button>
          <p v-if="!atEnd" class="m-warn">不可撤销。被用掉的维度不会再长回来。</p>

          <template v-else>
            <p class="m-end">宇宙已经没有维度可以再失去了。</p>
            <button type="button" class="m-reboot" :disabled="rebooting" @click="reboot">
              {{ rebooting ? '正在归还……' : '归零：把维度还回去' }}
            </button>
          </template>

          <p v-if="rebootedOnce && index === 0" class="m-dream">
            这就是回归运动的梦：所有文明放下武器，归还被拿走的维度与质量，让宇宙回到田园时代。<br />
            <RouterLink to="/sector-x" class="m-link">去见归零者 →</RouterLink>
          </p>
        </div>
      </div>

      <ol class="m-ladder" aria-label="维度刻度">
        <li
          v-for="(s, i) in STAGES"
          :key="s.dim"
          :class="{ current: i === index, gone: i < index, present: i === PRESENT_INDEX }"
        >
          <span class="m-ladder-dim">{{ s.dim }}D</span>
          <span class="m-ladder-name">{{ s.name }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.sector-membrane {
  --m-gold: #e8d27a;
  position: relative;
  min-height: 100%;
  /* overflow:hidden 的弹性子项最小高度为 0，会被压扁并裁掉下方内容：禁止收缩，让它随内容长高 */
  flex-shrink: 0;
  background: #020205;
  color: var(--gray-100);
  overflow: hidden;
}
.membrane-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.m-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 34rem) 1fr auto;
  gap: 2rem;
  min-height: 100%;
  padding: 2rem clamp(1rem, 4vw, 3rem);
}
.m-main { grid-column: 1; display: flex; flex-direction: column; gap: 1.25rem; }
.m-ladder { grid-column: 3; }

.m-stage {
  padding: 1.25rem 1.4rem;
  background: rgba(4, 4, 10, 0.62);
  border: 1px solid rgba(232, 210, 122, 0.2);
  backdrop-filter: blur(6px);
}
.m-stage-dim { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 0.75rem; }
.m-dim-num { font-family: var(--font-title); font-size: 3rem; line-height: 1; color: var(--m-gold); }
.m-dim-unit { font-size: 1rem; color: var(--m-gold); }
.m-stage-name { font-size: 1.25rem; font-weight: 600; letter-spacing: 0.1em; margin-left: 0.4rem; color: var(--white); }
.m-tag {
  align-self: center;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  color: var(--gray-300);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 3px;
}
.m-tag.now { color: #050505; background: var(--holo-blue); border-color: var(--holo-blue); }
.m-stage-text { margin: 0; font-family: var(--font-serif); font-size: 1.05rem; line-height: 1.95; color: var(--gray-100); }
.m-link { display: inline-block; margin-top: 0.75rem; font-size: 0.9rem; color: var(--m-gold); text-decoration: none; border-bottom: 1px solid rgba(232, 210, 122, 0.4); }

.m-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin: 0; }
.m-stats div { padding: 0.75rem 1rem; background: rgba(4, 4, 10, 0.55); border-left: 2px solid rgba(180, 230, 255, 0.5); }
.m-stats dt { font-size: 0.75rem; line-height: 1.5; color: var(--gray-350); }
.m-stats dd { margin: 0.25rem 0 0; font-family: var(--font-mono); font-size: 1.05rem; color: #cfeeff; }

.m-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 0.6rem; }
.m-fold {
  position: relative;
  overflow: hidden;
  padding: 0.85rem 1.6rem;
  font: inherit;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: var(--m-gold);
  background: rgba(232, 210, 122, 0.06);
  border: 1px solid var(--m-gold);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}
.m-fold:disabled { opacity: 0.4; cursor: not-allowed; }
.m-fold-fill {
  position: absolute;
  inset: 0;
  transform-origin: left;
  transform: scaleX(var(--p));
  background: linear-gradient(90deg, rgba(232, 210, 122, 0.35), rgba(255, 255, 255, 0.55));
}
.m-fold-label { position: relative; }
.m-fold:focus-visible, .m-reboot:focus-visible { outline: 2px solid var(--m-gold); outline-offset: 3px; }
.m-warn { margin: 0; font-size: 0.8rem; color: var(--gray-350); }
.m-end { margin: 0; font-family: var(--font-serif); font-size: 1.05rem; color: var(--gray-200); }
.m-reboot {
  padding: 0.85rem 1.6rem;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  color: #050505;
  background: var(--m-gold);
  border: 0;
  cursor: pointer;
}
.m-dream { margin: 0.5rem 0 0; font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.9; color: var(--gray-150); }

.m-ladder {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3rem;
}
.m-ladder li {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  color: var(--gray-300);
  border-left: 2px solid rgba(255, 255, 255, 0.12);
  transition: color 0.4s, border-color 0.4s, opacity 0.4s;
}
.m-ladder-dim { width: 2.4rem; font-family: var(--font-mono); }
.m-ladder li.gone { opacity: 0.35; text-decoration: line-through; }
.m-ladder li.present .m-ladder-dim { color: var(--holo-blue); }
.m-ladder li.current { color: var(--white); border-left-color: var(--m-gold); background: rgba(232, 210, 122, 0.08); }
.m-ladder li.current .m-ladder-dim { color: var(--m-gold); }

.stage-enter-active, .stage-leave-active { transition: opacity 0.45s, transform 0.45s; }
.stage-enter-from { opacity: 0; transform: translateY(8px); }
.stage-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 900px) {
  .m-layout { grid-template-columns: 1fr; gap: 1.25rem; padding: 1.25rem 1rem 4.5rem; }
  .m-main, .m-ladder { grid-column: 1; }
  .m-ladder { flex-direction: row; flex-wrap: wrap; gap: 0.35rem; }
  .m-ladder li { border-left: 0; border-bottom: 2px solid rgba(255, 255, 255, 0.12); padding: 0.2rem 0.4rem; }
  .m-ladder li.current { border-bottom-color: var(--m-gold); }
  .m-ladder-name { display: none; }
  .m-ladder-dim { width: auto; }
  .m-stats { grid-template-columns: 1fr; }
  .m-dim-num { font-size: 2.4rem; }
}
</style>
