<script setup lang="ts">
/**
 * Sector NS：自然选择号
 * 章北海从危机纪元初就确信人类会输。两百年后，他成了「自然选择」号的代理舰长。
 * 主机车钟只有前进一、二、三。你可以照常试航，也可以下达一个不存在的命令：前进四。
 * 结局回到那个问题：如果你确信人类会输，背叛是不是另一种忠诚？
 */
import { onUnmounted, ref } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import HoldButton from '@/components/HoldButton.vue'
import { sectorByPath } from '@/data/sectors'
import { recordAnswer } from '@/data/answers'

const question = sectorByPath('/sector-ns')?.question

type Act = 'bridge' | 'trial' | 'chase' | 'fled'
const act = ref<Act>('bridge')
const gear = ref(0)
const GEARS = ['停车', '前进一', '前进二', '前进三']
const GEAR_REPLY = [
  '主机停车。舰体静止在编队里。',
  '主机前进一。飞船平稳地离开编队。',
  '主机前进二。加速度在增加，深海状态液开始注入舱室。',
  '主机前进三。这是试航允许的最大推力。',
]

/* 追击：四艘战舰追上来，然后传来末日战役的消息 */
const PURSUERS = ['蓝色空间号', '企业号', '深空号', '终极规律号']
const chaseLine = ref(0)
const CHASE = [
  '「自然选择」号以前进四脱离编队，向太阳系外加速。舰上的人都在深海状态液里昏迷。',
  '舰队命令四艘战舰追击：蓝色空间号、企业号、深空号、终极规律号。',
  '追击持续了很久。它们越追越远，离太阳系也越来越远。',
  '消息传来：末日战役。一个水滴，摧毁了人类几乎全部的两千艘恒星级战舰。',
  '五艘船再也没有可以回去的舰队了。',
]
let chaseTimer: ReturnType<typeof setInterval> | undefined
onUnmounted(() => clearInterval(chaseTimer))

function setGear(i: number) {
  gear.value = i
}
function returnToFleet() {
  act.value = 'trial'
  recordAnswer('/sector-ns', '照常试航，回到了舰队')
}
function forwardFour() {
  act.value = 'chase'
  chaseLine.value = 0
  clearInterval(chaseTimer)
  chaseTimer = setInterval(() => {
    chaseLine.value += 1
    if (chaseLine.value >= CHASE.length - 1) clearInterval(chaseTimer)
  }, 1800)
  recordAnswer('/sector-ns', '下达了「前进四」，带着自然选择号逃离太阳系')
}
function restart() {
  clearInterval(chaseTimer)
  gear.value = 0
  act.value = 'bridge'
}
</script>

<template>
  <div class="sector-ns">
    <SectorHeader
      title="自然选择号"
      subtitle="章北海从危机纪元初就确信人类会输，却把这个念头藏了两百年。现在，他是「自然选择」号恒星级战舰的代理舰长。"
      goal="今天是试航。你可以照常操作车钟，也可以下达一个车钟上没有的命令。"
      accent="#9fb8d8"
      :show-restart="act !== 'bridge'"
      restart-label="回到舰桥"
      @restart="restart"
    />

    <div v-if="act === 'bridge'" class="bridge">
      <Vitrine class="telegraph" caption="主机车钟：试航只允许到前进三。">
        <ol class="gears" role="radiogroup" aria-label="主机车钟">
          <li v-for="(g, i) in GEARS" :key="g">
            <button type="button" role="radio" :aria-checked="gear === i" :class="{ on: gear === i }" @click="setGear(i)">{{ g }}</button>
          </li>
          <li class="four" aria-hidden="true"><span>前进四</span></li>
        </ol>
        <p class="reply">{{ GEAR_REPLY[gear] }}</p>
      </Vitrine>

      <aside class="decide">
        <p>你的父亲曾对你说：多想想。你想了两百年。舰队会在末日战役里全军覆没——你这样相信。为了让人类将来有船可以逃，你在危机纪元初亲手杀死了三位主张工质推进的专家。</p>
        <p>现在只要一个命令，这艘船就会带着全舰官兵离开太阳系，再也不回来。</p>
        <div class="acts">
          <HoldButton tone="rust" :hold-ms="2400" @confirm="forwardFour">按住，前进四</HoldButton>
          <button type="button" class="plain-btn" @click="returnToFleet">结束试航，返回编队</button>
        </div>
      </aside>
    </div>

    <section v-else-if="act === 'chase'" class="chase">
      <ol class="log">
        <li v-for="(l, i) in CHASE.slice(0, chaseLine + 1)" :key="i">{{ l }}</li>
      </ol>
      <ul v-if="chaseLine >= 1" class="ships">
        <li class="self">自然选择号</li>
        <li v-for="p in PURSUERS" :key="p">{{ p }}</li>
      </ul>
      <div v-if="chaseLine >= CHASE.length - 1" class="end">
        <p>后来的事在「银河人类」那间展厅里：五艘船的物资只够一艘抵达最近的恒星。在黑暗战役里，自然选择号被击毁。据说章北海最后说的是：「没关系的，都一样。」</p>
        <p>他背叛了舰队，也让人类的一部分活到了末日战役之后。</p>
        <p class="q">{{ question }}</p>
        <div class="links">
          <RouterLink to="/sector-human" class="plain-btn">之后的黑暗战役：银河人类</RouterLink>
          <RouterLink to="/sector-pdc" class="plain-btn">那支舰队是怎么造出来的：行星防御</RouterLink>
          <button type="button" class="plain-btn" @click="restart">回到舰桥</button>
        </div>
      </div>
      <button v-else type="button" class="skip" @click="chaseLine = CHASE.length - 1">跳过</button>
    </section>

    <section v-else class="end solo">
      <h2 class="end-title">你回到了编队</h2>
      <p>自然选择号停回两千艘恒星级战舰的矩阵里。不久之后，一个水滴抵达，末日战役开始，舰队在不到一个小时里几乎全军覆没。</p>
      <p>你没有背叛任何人。你和他们一起留在了那里。</p>
      <p class="q">{{ question }}</p>
      <div class="links">
        <button type="button" class="plain-btn" @click="restart">回到舰桥</button>
        <RouterLink to="/sector-w" class="plain-btn">那一个小时：水滴</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sector-ns { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 72rem; }

.bridge { display: grid; grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr); gap: 2rem; align-items: start; }
.gears { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column-reverse; gap: 0.4rem; }
.gears button, .gears .four span {
  display: block;
  width: 100%;
  padding: 0.7rem 1rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1rem;
  text-align: left;
  color: var(--weathered);
  background: var(--void);
  border: 1px solid var(--incision-soft);
  border-radius: 2px;
  cursor: pointer;
}
.gears button.on { color: var(--bone); border-color: #9fb8d8; background: var(--slab-raised); }
.gears .four span { color: var(--incision); border-style: dashed; cursor: default; }
.reply { margin: 1rem 0 0; font-size: 0.9375rem; line-height: 1.8; color: var(--gray-150); }

.decide p, .chase p, .end p { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.95; color: var(--gray-150); }
.acts, .links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }

.chase, .solo { max-width: 46rem; }
.log { list-style: none; margin: 0 0 1.25rem; padding: 0; border-left: 1px solid var(--incision); }
.log li { padding: 0 0 0.9rem 1.25rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.9; color: var(--bone); animation: arrive 1s ease-out; }
@keyframes arrive { from { opacity: 0; filter: blur(4px); } }
.ships { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; margin: 0 0 1.5rem; padding: 0; }
.ships li { padding: 0.3rem 0.75rem; font-size: 0.875rem; color: var(--weathered); border: 1px solid var(--incision); }
.ships li.self { color: var(--bone); border-color: #9fb8d8; }
.skip { padding: 0.3rem 0.8rem; font: inherit; font-size: 0.875rem; color: var(--weathered); background: none; border: 1px solid var(--incision); cursor: pointer; }
.end-title { margin: 0 0 1rem; font-family: var(--font-serif); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.1em; color: var(--bone); }
.q { padding-left: 1rem; border-left: 1px solid #9fb8d8; color: var(--bone) !important; }

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

@media (max-width: 900px) {
  .bridge { grid-template-columns: 1fr; }
}
</style>
