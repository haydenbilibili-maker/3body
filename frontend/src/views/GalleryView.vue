<script setup lang="ts">
/**
 * Sector D：二向箔画廊
 * 选一件展品（或上传一张图），按住让它跌入二维：它的每一层都摊开在同一个平面上，首尾相接排成一条没有厚度的画。
 * 然后是冥王星上看到的那一幕：太阳系变成了一幅画。
 * 逻辑见 sim/flatten.ts。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { LAYERS, SPECIMENS, flatExtent, slices, type SpecimenId } from '@/sim/flatten'

const question = sectorByPath('/sector-d')?.question
const SIZE = 240

/* ---------- 展品：用画布现画，不依赖外部图片 ---------- */
function paint(id: SpecimenId): string {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE * 2
  const g = c.getContext('2d')!
  g.scale(2, 2)
  g.fillStyle = '#0d0e10'
  g.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(220, 214, 200, ${0.2 + ((i * 37) % 10) / 20})`
    g.fillRect((i * 97) % SIZE, (i * 53) % SIZE, 1, 1)
  }
  const cx = SIZE / 2
  if (id === 'earth') {
    const grd = g.createRadialGradient(cx - 30, cx - 30, 10, cx, cx, 80)
    grd.addColorStop(0, '#6fa3d8')
    grd.addColorStop(1, '#1d3c66')
    g.fillStyle = grd
    g.beginPath()
    g.arc(cx, cx, 80, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#5f8a4f'
    for (const [x, y, r] of [[-25, -20, 28], [20, 15, 22], [35, -35, 14], [-30, 40, 16]]) {
      g.beginPath()
      g.ellipse(cx + x, cx + y, r, r * 0.7, 0.6, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = 'rgba(255,255,255,0.55)'
    g.lineWidth = 4
    for (let k = 0; k < 4; k++) {
      g.beginPath()
      g.arc(cx, cx, 60 - k * 12, k, k + 1.6)
      g.stroke()
    }
  } else if (id === 'saturn') {
    g.strokeStyle = '#a8916a'
    g.lineWidth = 10
    g.beginPath()
    g.ellipse(cx, cx, 105, 28, -0.3, Math.PI, Math.PI * 2)
    g.stroke()
    const grd = g.createLinearGradient(0, cx - 60, 0, cx + 60)
    grd.addColorStop(0, '#e3cd9b')
    grd.addColorStop(0.5, '#c09a5e')
    grd.addColorStop(1, '#8a6a3c')
    g.fillStyle = grd
    g.beginPath()
    g.arc(cx, cx, 60, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.ellipse(cx, cx, 105, 28, -0.3, 0, Math.PI)
    g.stroke()
  } else if (id === 'starry') {
    // 星月夜：漩涡状的夜空、明亮的星与新月、一株柏树的剪影（按档案馆的笔法重画，不是原画）
    g.fillStyle = '#1c2f5c'
    g.fillRect(0, 0, SIZE, SIZE)
    for (let k = 0; k < 140; k++) {
      const t = k / 140
      const r = 20 + t * 110
      const a0 = t * 9
      g.strokeStyle = `rgba(${120 + (k % 3) * 30}, ${150 + (k % 5) * 15}, 220, 0.55)`
      g.lineWidth = 3
      g.beginPath()
      g.arc(cx + 10, cx - 30, r, a0, a0 + 0.6)
      g.stroke()
    }
    for (const [x, y, rr] of [[40, 50, 9], [95, 35, 7], [160, 70, 8], [210, 40, 7], [70, 110, 6], [190, 120, 6]]) {
      const glow = g.createRadialGradient(x, y, 0, x, y, rr * 2.4)
      glow.addColorStop(0, 'rgba(250, 230, 140, 1)')
      glow.addColorStop(0.4, 'rgba(240, 210, 110, 0.75)')
      glow.addColorStop(1, 'rgba(240, 210, 110, 0)')
      g.fillStyle = glow
      g.beginPath()
      g.arc(x, y, rr * 2.4, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#f3d978'
    g.beginPath()
    g.arc(225, 30, 16, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1c2f5c'
    g.beginPath()
    g.arc(231, 26, 14, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#20263a'
    g.fillRect(0, SIZE - 46, SIZE, 46)
    g.fillStyle = '#141a14'
    g.beginPath()
    g.moveTo(40, SIZE)
    g.bezierCurveTo(30, SIZE - 80, 55, SIZE - 160, 62, SIZE - 210)
    g.bezierCurveTo(72, SIZE - 150, 88, SIZE - 80, 82, SIZE)
    g.fill()
  } else {
    g.strokeStyle = '#9a9588'
    g.lineWidth = 3
    g.beginPath()
    g.arc(cx, cx, 90, 0, Math.PI * 2)
    g.stroke()
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      g.beginPath()
      g.moveTo(cx, cx)
      g.lineTo(cx + Math.cos(a) * 90, cx + Math.sin(a) * 90)
      g.stroke()
    }
    g.fillStyle = '#d8b56a'
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2
      g.fillRect(cx + Math.cos(a) * 82 - 2, cx + Math.sin(a) * 82 - 2, 4, 4)
    }
    g.fillStyle = '#3a3c41'
    g.beginPath()
    g.arc(cx, cx, 18, 0, Math.PI * 2)
    g.fill()
  }
  return c.toDataURL('image/png')
}

const specimen = ref<SpecimenId | 'upload'>('earth')
const images = ref<Record<string, string>>({})
const src = computed(() => images.value[specimen.value] ?? '')
onMounted(() => {
  for (const s of SPECIMENS) images.value[s.id] = paint(s.id)
})

const fileInput = ref<HTMLInputElement | null>(null)
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    images.value = { ...images.value, upload: String(reader.result) }
    choose('upload')
  }
  reader.readAsDataURL(f)
}

/* ---------- 跌落 ---------- */
const flat = ref(false)
const done = ref(false)
const stage = ref<HTMLElement | null>(null)
const layers = computed(() => slices(SIZE, flat.value))
const extent = flatExtent(SIZE)
let doneTimer: ReturnType<typeof setTimeout> | undefined

function choose(id: SpecimenId | 'upload') {
  specimen.value = id
  flat.value = false
  done.value = false
}
function fall() {
  flat.value = true
  clearTimeout(doneTimer)
  doneTimer = setTimeout(async () => {
    done.value = true
    await nextTick()
    stage.value?.scrollTo({ left: 0 })
  }, 2400 + LAYERS * 80)
}
/* 整页跌入二维：给根元素加一个类，样式在 main.css 里 */
const pageFlat = ref(false)
let pageTimer: ReturnType<typeof setTimeout> | undefined
function fallPage() {
  document.documentElement.classList.add('page-flattening')
  clearTimeout(pageTimer)
  pageTimer = setTimeout(() => (pageFlat.value = true), 3200)
}
function restorePage() {
  pageFlat.value = false
  document.documentElement.classList.remove('page-flattening')
}
onUnmounted(() => {
  clearTimeout(doneTimer)
  clearTimeout(pageTimer)
  document.documentElement.classList.remove('page-flattening')
})

function nameOf(id: SpecimenId | 'upload') {
  return id === 'upload' ? '你的图像' : (SPECIMENS.find((s) => s.id === id)?.name ?? '')
}

/* ---------- 读者的档案 ---------- */
watch(done, (d) => {
  if (d) recordAnswer('/sector-d', `让${nameOf(specimen.value)}跌入了二维`)
})
</script>

<template>
  <div class="sector-d">
    <SectorHeader
      title="二向箔画廊"
      subtitle="一张小纸条，接触到什么，什么就开始向二维跌落。跌下去的一切，都被画进了同一幅画里。"
      goal="选一件展品，按住让它跌入二维，看它的每一层怎样摊开在同一个平面上。"
    />

    <div class="studio">
      <div class="picker" role="radiogroup" aria-label="展品">
        <button
          v-for="s in SPECIMENS"
          :key="s.id"
          type="button"
          role="radio"
          :aria-checked="specimen === s.id"
          :class="{ on: specimen === s.id }"
          @click="choose(s.id)"
        >{{ s.name }}</button>
        <button type="button" :class="{ on: specimen === 'upload' }" @click="fileInput?.click()">上传一张图</button>
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
      </div>

      <Vitrine flush>
        <div ref="stage" class="stage" :class="{ flat }">
          <div class="frame" :style="{ width: (flat ? extent.width : SIZE) + 'px', height: SIZE + 'px' }">
            <span
              v-for="(l, i) in layers"
              :key="i"
              class="layer"
              :style="{
                width: SIZE + 'px',
                height: SIZE / LAYERS + 'px',
                backgroundImage: src ? `url(${src})` : 'none',
                backgroundSize: `${SIZE}px ${SIZE}px`,
                backgroundPosition: `0 -${l.srcY}px`,
                transform: flat
                  ? `translate(${l.x}px, ${SIZE / 2 - (SIZE / LAYERS) * 2}px) scaleY(4)`
                  : `translate(${l.x}px, ${l.y}px)`,
                transitionDelay: flat ? i * 80 + 'ms' : '0ms',
              }"
            ></span>
            <span v-if="flat" class="plane" aria-hidden="true"></span>
          </div>
        </div>
        <template #caption>
          <span v-if="!flat">{{ nameOf(specimen) }}：三维，厚度 {{ SIZE }}，被切成 {{ LAYERS }} 层只是为了让你看清它怎样摊开。</span>
          <span v-else-if="!done">正在跌落……</span>
          <span v-else>{{ nameOf(specimen) }}：二维，厚度 0。它的每一层都在这里，并排躺着，再也不会重叠。左右拖动可以看完整幅画。</span>
        </template>
      </Vitrine>

      <div class="act">
        <HoldButton v-if="!flat" tone="rust" :hold-ms="1800" :disabled="!src" @confirm="fall">按住，让它跌入二维</HoldButton>
        <button v-else-if="done" type="button" class="plain-btn" @click="choose(specimen)">换一件展品</button>
      </div>
    </div>

    <transition name="fade">
      <section v-if="done" class="pluto">
        <h2 class="p-title">冥王星上看到的</h2>
        <p>二向箔到来的时候，程心和艾 AA 在冥王星上。她们看着太阳跌进平面，摊开成一片巨大的、有着同心环纹的光；地球、木星、土星一颗接一颗落下去，在那个平面上展开它们的全部结构，没有一处被遮挡。</p>
        <p>那是一幅画，像极了梵高的《星空》。太阳系所有的历史、城市和人，都在这幅画里，一笔也不少，只是永远没有了厚度。</p>
        <p>冥王星上的地球文明博物馆，是人类留下的最后一件三维的东西。</p>
        <div class="page-fall">
          <HoldButton tone="rust" :hold-ms="2400" @confirm="fallPage">按住，让这一页也跌进去</HoldButton>
          <span>你正在看的这一页，也只是三维空间里的一样东西。</span>
        </div>
        <p class="q">{{ question }}</p>
        <div class="links">
          <RouterLink to="/sector-j" class="plain-btn">躲在阴影里的人：掩体</RouterLink>
          <RouterLink to="/sector-tomb" class="plain-btn">博物馆里的留言：文明墓碑</RouterLink>
        </div>
      </section>
    </transition>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="pageFlat" class="flat-over" role="dialog" aria-label="这一页已经跌入二维">
          <p class="fo-line">这一页也成了画的一部分。</p>
          <p class="fo-sub">导航、标题、你读过的每一行字，都摊在同一个平面上，厚度为零。</p>
          <button type="button" class="fo-btn" @click="restorePage">从画里出来</button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sector-d { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }

.picker { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.picker button {
  padding: 0.45rem 1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.picker button.on { color: var(--bone); border-color: var(--bone); }

.stage { position: relative; height: 20rem; overflow-x: auto; overflow-y: hidden; background: #0d0e10; display: flex; align-items: center; padding: 0 2rem; }
.stage:not(.flat) { justify-content: center; }
.frame { position: relative; flex: none; transition: width 0.1s; }
.layer {
  position: absolute;
  left: 0;
  top: 0;
  background-repeat: no-repeat;
  transform-origin: 0 0;
  transition: transform 2.4s cubic-bezier(0.6, 0, 0.2, 1), filter 2.4s;
}
.flat .layer { filter: saturate(1.35) contrast(1.1); }
.plane { position: absolute; left: -2rem; right: -2rem; top: 50%; height: 1px; background: rgba(201, 180, 138, 0.35); }

.act { margin-top: 1rem; min-height: 2.75rem; }

.pluto { max-width: 44rem; margin-top: 2.5rem; }
.p-title { margin: 0 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.5rem; letter-spacing: 0.1em; color: var(--bone); }
.pluto p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.pluto .q { margin-top: 1.5rem; padding-left: 1rem; border-left: 1px solid var(--era-bunker); color: var(--bone); }
.links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
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
.fade-enter-active { transition: opacity 1s; }
.fade-enter-from { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .layer { transition-duration: 0.01s; }
}
@media (max-width: 640px) {
  .stage { height: 17rem; padding: 0 1rem; }
}
.page-fall { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin: 1.5rem 0; font-size: 0.875rem; color: var(--weathered); }
.flat-over {
  position: fixed;
  inset: 0;
  z-index: 950;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.5rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 100%, rgba(232, 196, 131, 0.12), transparent 60%);
}
.fo-line { margin: 0; font-family: var(--font-serif); font-weight: 900; font-size: clamp(1.5rem, 4vw, 2.5rem); letter-spacing: 0.15em; color: var(--bone); }
.fo-sub { margin: 0; max-width: 32rem; font-family: var(--font-serif); line-height: 1.9; color: var(--weathered); }
.fo-btn { margin-top: 0.5rem; padding: 0.6rem 1.4rem; font: inherit; color: var(--bone); background: rgba(19, 20, 22, 0.8); border: 1px solid var(--incision); cursor: pointer; }
</style>
