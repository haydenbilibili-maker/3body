<script setup lang="ts">
/**
 * 太空城图鉴：六种构型，每座城有外观与内景两张图。
 * 外观里的转动是实际转速的 10 倍（实际转速见读数，ω = √(g / r)）；内景画出人站在哪里、重力从哪里来。
 * 图是示意（不按比例）；数据见 sim/spaceCity.ts。
 */
import { computed, ref } from 'vue'
import { CITIES, rpmFor } from '@/sim/spaceCity'

const props = withDefaults(defineProps<{ initial?: string }>(), { initial: '亚洲一号' })
const idx = ref(Math.max(0, CITIES.findIndex((c) => c.name === props.initial)))
const view = ref<'exterior' | 'interior'>('exterior')
const city = computed(() => CITIES[idx.value])
const rpm = computed(() => rpmFor(city.value.radius))
/** 画面里转一圈的秒数：实际周期的十分之一 */
const spinSeconds = computed(() => (60 / rpm.value / 10).toFixed(1) + 's')

/** 内景里沿地面排开的房子：每座城的密度不同 */
const houses = computed(() => {
  const n = city.value.shape === 'ring' ? 36 : city.value.shape === 'cylinder' ? 28 : 20
  return Array.from({ length: n }, (_, i) => ({ a: (360 / n) * i, h: 6 + ((i * 37) % 9) }))
})
</script>

<template>
  <section class="atlas" aria-labelledby="atlas-title">
    <div class="a-head">
      <h2 id="atlas-title" class="a-title">太空城图鉴</h2>
      <div class="a-tabs" role="tablist" aria-label="太空城">
        <button
          v-for="(c, i) in CITIES"
          :key="c.name"
          type="button"
          role="tab"
          class="a-tab"
          :aria-selected="i === idx"
          @click="idx = i"
        >
          {{ c.name }}<span>{{ c.type }}</span>
        </button>
      </div>
    </div>

    <div class="a-body">
      <figure class="a-fig">
        <svg class="a-svg" viewBox="-160 -105 320 210" role="img" :aria-label="`${city.name}（${city.type}）的${view === 'exterior' ? '外观' : '内景'}示意图`" :style="{ '--spin': spinSeconds }">
          <!-- 外观 -->
          <g v-if="view === 'exterior'">
            <g v-if="city.shape === 'wheel'" class="spin">
              <circle r="80" class="hull" stroke-width="12" />
              <circle r="80" class="win" stroke-width="2" stroke-dasharray="2 7" />
              <line v-for="a in [0, 90, 180, 270]" :key="a" x1="0" y1="0" x2="0" y2="-74" class="spoke" :transform="`rotate(${a})`" />
              <circle r="13" class="core" />
            </g>
            <g v-else-if="city.shape === 'ring'" class="spin">
              <circle r="92" class="hull" stroke-width="4" />
              <circle r="92" class="win" stroke-width="1.5" stroke-dasharray="1.5 6" />
              <line v-for="a in [0, 120, 240]" :key="a" x1="0" y1="0" x2="0" y2="-90" class="cable" :transform="`rotate(${a})`" />
              <circle r="6" class="core" />
            </g>
            <g v-else-if="city.shape === 'cylinder'">
              <clipPath id="cyl-clip"><rect x="-140" y="-38" width="280" height="76" rx="4" /></clipPath>
              <rect x="-140" y="-38" width="280" height="76" rx="4" class="body" />
              <g clip-path="url(#cyl-clip)">
                <g class="roll">
                  <rect v-for="k in 8" :key="k" x="-140" :y="-38 + (k - 1) * 19" width="280" height="6" class="strip" />
                </g>
              </g>
              <ellipse cx="-140" cy="0" rx="10" ry="38" class="cap" />
              <ellipse cx="140" cy="0" rx="10" ry="38" class="cap" />
              <line x1="-150" y1="0" x2="150" y2="0" class="axis" />
            </g>
            <g v-else-if="city.shape === 'composite'">
              <line x1="-130" y1="0" x2="130" y2="0" class="truss" />
              <line x1="-130" y1="6" x2="130" y2="6" class="truss" />
              <rect x="-130" y="-26" width="90" height="52" rx="3" class="body" />
              <circle cx="10" cy="3" r="30" class="body" />
              <g transform="translate(95 3)"><g class="spin"><circle r="34" class="hull" stroke-width="6" /><circle r="5" class="core" /></g></g>
            </g>
            <g v-else-if="city.shape === 'sphere'">
              <circle r="78" class="body" />
              <ellipse v-for="k in [-50, -25, 0, 25, 50]" :key="k" cx="0" :cy="k" :rx="Math.sqrt(78 * 78 - k * k)" :ry="6" class="lat" />
              <ellipse cx="0" cy="0" rx="78" ry="6" class="win flow" stroke-width="2" stroke-dasharray="2 6" />
              <line x1="0" y1="-95" x2="0" y2="95" class="axis" />
            </g>
            <g v-else>
              <path d="M -145 0 Q 0 -92 145 0 Q 0 92 -145 0 Z" class="body" />
              <ellipse cx="0" cy="0" rx="10" ry="46" class="win flow" stroke-width="2" stroke-dasharray="2 6" />
              <line x1="-155" y1="0" x2="155" y2="0" class="axis" />
            </g>
          </g>

          <!-- 内景 -->
          <g v-else>
            <template v-if="city.shape === 'sphere'">
              <circle r="82" class="ground" />
              <ellipse v-for="k in [-60, -30, 30, 60]" :key="k" cx="0" :cy="k" :rx="Math.sqrt(82 * 82 - k * k)" ry="5" class="lat" />
              <text x="0" y="-88" text-anchor="middle" class="lbl">极点 · 失重</text>
              <text x="90" y="4" class="lbl">赤道 · 1 倍重力</text>
              <circle r="4" class="sun" />
            </template>
            <template v-else-if="city.shape === 'composite'">
              <g v-for="(m, i) in [{ x: -95, r: 38, g: '0.3 倍：工厂' }, { x: 0, r: 46, g: '1 倍：学校与医院' }, { x: 95, r: 30, g: '0.6 倍：港口' }]" :key="i" :transform="`translate(${m.x} 0)`">
                <circle :r="m.r" class="ground" />
                <text x="0" :y="m.r + 16" text-anchor="middle" class="lbl">{{ m.g }}</text>
              </g>
            </template>
            <template v-else-if="city.shape === 'spindle'">
              <path d="M -145 0 Q 0 -92 145 0 Q 0 92 -145 0 Z" class="ground" />
              <line x1="-145" y1="0" x2="145" y2="0" class="sunline" />
              <text x="0" y="62" text-anchor="middle" class="lbl">中央最宽：1 倍重力</text>
              <text x="-120" y="-20" text-anchor="middle" class="lbl">尖端：几乎失重</text>
            </template>
            <template v-else>
              <circle :r="city.shape === 'ring' ? 88 : 84" class="ground" :stroke-width="city.shape === 'ring' ? 8 : 3" />
              <rect
                v-for="(h, i) in houses"
                :key="i"
                x="-2.5"
                :y="-83"
                width="5"
                :height="h.h"
                class="house"
                :transform="`rotate(${h.a})`"
              />
              <circle v-if="city.shape === 'cylinder'" r="7" class="sun" />
              <template v-if="city.shape === 'wheel'">
                <line v-for="a in [45, 135, 225, 315]" :key="a" x1="0" y1="0" x2="0" y2="-80" class="spoke" :transform="`rotate(${a})`" />
              </template>
              <!-- 站在地面上的人：头朝向轴心 -->
              <line x1="0" y1="84" x2="0" y2="70" class="person" />
              <circle cx="0" cy="67" r="3" class="person-head" />
              <text x="10" y="64" class="lbl">你站在这里，头朝向轴心</text>
              <text x="0" y="-14" text-anchor="middle" class="lbl">{{ city.shape === 'cylinder' ? '人造太阳' : '轴心 · 失重' }}</text>
            </template>
          </g>
        </svg>
        <figcaption class="a-cap">示意图，不按比例。{{ view === 'exterior' ? '画面里的转动比实际快 10 倍。' : '' }}</figcaption>
      </figure>

      <div class="a-info">
        <div class="a-views" role="radiogroup" aria-label="视图">
          <button type="button" role="radio" class="a-view" :aria-checked="view === 'exterior'" @click="view = 'exterior'">外观</button>
          <button type="button" role="radio" class="a-view" :aria-checked="view === 'interior'" @click="view = 'interior'">内景</button>
        </div>
        <h3 class="a-name">{{ city.name }}<span>{{ city.giant }}背阳面 · {{ city.type }}</span></h3>
        <p class="a-text">{{ view === 'exterior' ? city.exterior : city.interior }}</p>
        <dl class="a-reads">
          <div><dt>重力环半径</dt><dd class="num">{{ city.radius.toLocaleString('zh-CN') }} 米</dd></div>
          <div><dt>一倍重力所需转速</dt><dd class="num">{{ rpm.toFixed(2) }} 转 / 分钟</dd></div>
          <div><dt>设计人口</dt><dd class="num">{{ city.population }} 万</dd></div>
        </dl>
        <p class="a-voice">「{{ city.voice }}」</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.atlas { margin: 0 0 2rem; }
.a-head { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.a-title { margin: 0; font-family: var(--font-title); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.12em; color: var(--bone); }
.a-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.a-tab {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  text-align: left;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: var(--radius-cut);
  cursor: pointer;
}
.a-tab span { font-family: var(--font-sans); font-size: 0.75rem; color: var(--weathered); }
.a-tab[aria-selected='true'] { border-color: var(--era-bunker); background: var(--slab-raised); }
.a-tab:focus-visible, .a-view:focus-visible { outline: 1px solid var(--cherenkov); outline-offset: 3px; }

.a-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.a-fig { margin: 0; padding: 1rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.a-svg { display: block; width: 100%; height: auto; max-height: 22rem; }
.a-cap { margin-top: 0.5rem; font-size: 0.8125rem; color: var(--weathered); }

.hull { fill: none; stroke: var(--bone); }
.win { fill: none; stroke: var(--cherenkov); }
.spoke, .cable { stroke: var(--weathered); stroke-width: 2; }
.cable { stroke-dasharray: 3 4; stroke-width: 1; }
.core { fill: var(--slab-raised); stroke: var(--bone); stroke-width: 1.5; }
.body { fill: var(--slab-raised); stroke: var(--bone); stroke-width: 1.5; }
.cap { fill: var(--slab); stroke: var(--bone); stroke-width: 1.5; }
.strip { fill: rgba(125, 184, 255, 0.22); }
.axis { stroke: var(--weathered); stroke-width: 1; stroke-dasharray: 4 4; }
.truss { stroke: var(--weathered); stroke-width: 1.5; }
.lat { fill: none; stroke: var(--incision); stroke-width: 1; }
.ground { fill: none; stroke: var(--bone); stroke-width: 3; }
.house { fill: var(--weathered); }
.sun { fill: #f3dfb4; }
.sunline { stroke: #f3dfb4; stroke-width: 2; }
.person { stroke: var(--cherenkov); stroke-width: 2; }
.person-head { fill: var(--cherenkov); }
.lbl { fill: var(--weathered); font-family: var(--font-serif); font-size: 10px; }

.spin { animation: spin var(--spin) linear infinite; transform-box: fill-box; transform-origin: center; }
.roll { animation: roll calc(var(--spin) / 2) linear infinite; }
.flow { animation: flow 3s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes roll { to { transform: translateY(19px); } }
@keyframes flow { to { stroke-dashoffset: -16; } }

.a-info { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
.a-views { display: flex; gap: 0.5rem; }
.a-view { padding: 0.4rem 1rem; font: inherit; font-size: 0.875rem; color: var(--bone); background: transparent; border: 1px solid var(--incision); border-radius: var(--radius-cut); cursor: pointer; }
.a-view[aria-checked='true'] { border-color: var(--cherenkov); color: var(--cherenkov); }
.a-name { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.375rem; letter-spacing: 0.08em; color: var(--bone); }
.a-name span { font-family: var(--font-sans); font-weight: 400; font-size: 0.8125rem; letter-spacing: 0; color: var(--weathered); }
.a-text { margin: 0; font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--gray-150); }
.a-reads { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin: 0; }
.a-reads dt { font-size: 0.75rem; color: var(--weathered); }
.a-reads dd { margin: 0.2rem 0 0; font-size: 1rem; color: var(--bone); }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.a-voice { margin: 0; padding-left: 0.9rem; border-left: 1px solid var(--era-bunker); font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.8; color: var(--bone); }

@media (max-width: 900px) {
  .a-body { grid-template-columns: 1fr; }
}
@media (max-width: 420px) {
  .a-reads { grid-template-columns: 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .spin, .roll, .flow { animation: none; }
}
</style>
