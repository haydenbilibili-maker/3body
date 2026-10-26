<script setup lang="ts">
/**
 * 大低谷：一个普通人在地下城的三十天。
 * 每天一个选择，在饥饿、健康与理智之间取舍；不时有人敲门。
 * 结局记下你活下来的方式，以及你分给别人的口粮——然后回到本页的问题。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import BodyState from '@/components/BodyState.vue'
import { sectorByPath } from '@/data/sectors'

const question = sectorByPath('/sector-ravine')?.question

interface Stats {
  health: number
  hunger: number
  sanity: number
  day: number
}
type Tone = 'plain' | 'bad' | 'good'
interface Entry {
  day: number
  text: string
  tone: Tone
}

const stats = ref<Stats>({ health: 100, hunger: 30, sanity: 100, day: 1 })
const diary = ref<Entry[]>([])
const shared = ref(0)
const refused = ref(0)
const knock = ref<null | Knock>(null)
const ended = ref<null | { survived: boolean; text: string }>(null)
const diaryEl = ref<HTMLElement | null>(null)

function write(text: string, tone: Tone = 'plain') {
  diary.value.push({ day: stats.value.day, text, tone })
  nextTick(() => diaryEl.value?.scrollTo({ top: diaryEl.value.scrollHeight, behavior: 'smooth' }))
}
const clamp = (n: number) => Math.max(0, Math.min(100, n))
function change(d: Partial<Stats>) {
  stats.value = {
    ...stats.value,
    health: clamp(stats.value.health + (d.health ?? 0)),
    hunger: clamp(stats.value.hunger + (d.hunger ?? 0)),
    sanity: clamp(stats.value.sanity + (d.sanity ?? 0)),
  }
}

function start() {
  stats.value = { health: 100, hunger: 30, sanity: 100, day: 1 }
  diary.value = []
  shared.value = 0
  refused.value = 0
  knock.value = null
  ended.value = null
  write('危机纪元的头几十年。资源全部倾向太空防御，地表农业崩溃，配给一减再减。')
  write('你在地下城的公寓里醒来。空气里是霉味和合成食品甜腻的气味。你已经两天没吃东西了。', 'bad')
}
start()

/* ---------- 每天的选择 ---------- */
const ACTIONS = [
  { id: 'queue', label: '去救济站排队', hint: '能领到口粮，也可能遇上骚乱' },
  { id: 'work', label: '去建设队搬砖', hint: '换两份口粮，很累' },
  { id: 'market', label: '去黑市碰运气', hint: '可能换到罐头，也可能被抓' },
  { id: 'search', label: '翻找房间', hint: '也许还剩下点什么' },
  { id: 'rest', label: '躺着保存体力', hint: '饿得慢一些' },
  { id: 'read', label: '读一本旧书', hint: '让脑子离开地下城' },
] as const
type ActionId = (typeof ACTIONS)[number]['id']

/* 每个行动的几种结果：w 是权重（恢复并扩充了旧版大低谷的事件） */
interface Outcome {
  w: number
  text: string
  tone: Tone
  d: Partial<Stats>
}
const OUTCOMES: Record<ActionId, Outcome[]> = {
  queue: [
    { w: 4, text: '队伍很长。你排了六个小时，领到一天的配给。', tone: 'good', d: { hunger: -45 } },
    { w: 3, text: '救济站发生了骚乱。你被推倒，受了伤，但抢到了一碗粥。', tone: 'bad', d: { health: -12, hunger: -35, sanity: -8 } },
    { w: 2, text: '排到你的时候，粥已经发完了。窗口拉下来的声音很响。', tone: 'bad', d: { sanity: -8 } },
    { w: 1, text: '排在你前面的人说，太空军又征了一批人去造战舰。去的人每天有三顿饭。', tone: 'plain', d: { hunger: -30, sanity: -4 } },
  ],
  work: [
    { w: 3, text: '建设队让你搬了一整天砖。腰快断了，但领到了两份口粮。', tone: 'plain', d: { health: -6, hunger: -50, sanity: 4 } },
    { w: 1, text: '今天建设队多发了一份合成蛋白。这是几个月来唯一的好消息。', tone: 'good', d: { health: -4, hunger: -60, sanity: 8 } },
    { w: 1, text: '脚手架塌了一截。你没事，旁边那个人没能站起来。', tone: 'bad', d: { health: -10, hunger: -40, sanity: -14 } },
  ],
  market: [
    { w: 3, text: '你用最后一个零件换到一罐肉罐头。', tone: 'good', d: { hunger: -40 } },
    { w: 3, text: '你被巡逻队撞见，东西被没收，还挨了一顿打。', tone: 'bad', d: { health: -16, sanity: -10 } },
    { w: 1, text: '黑市上有人卖「地表的真土豆」。你买了一个，发现是用淀粉捏的。', tone: 'bad', d: { hunger: -10, sanity: -6 } },
  ],
  search: [
    { w: 2, text: '你在床底找到一块过期的压缩饼干。它硬得像石头，你一点一点含化了。', tone: 'good', d: { hunger: -25 } },
    { w: 3, text: '什么也没找到，只有灰尘，和一只死老鼠。', tone: 'plain', d: { sanity: -4 } },
    { w: 1, text: '你翻出一张旧照片：大低谷之前，一家人在海边。你看了很久，又把它放了回去。', tone: 'plain', d: { sanity: 6 } },
  ],
  rest: [
    { w: 3, text: '你睡了一整天，梦见了大低谷之前的世界：阳光，草地，没有配给。', tone: 'plain', d: { health: 5, hunger: -4, sanity: 2 } },
    { w: 1, text: '你饿得睡不着，盯着天花板数裂缝，数到天亮。', tone: 'bad', d: { health: 2, sanity: -6 } },
  ],
  read: [
    { w: 3, text: '你翻出一本旧书，读了一整天。有那么几个小时，你不在这里。', tone: 'plain', d: { sanity: 14, hunger: 4 } },
    { w: 1, text: '书里写的是公元的一场饥荒。你合上书，发现自己并不比他们更有办法。', tone: 'plain', d: { sanity: 6, hunger: 4 } },
  ],
}
function pickOutcome(list: Outcome[]): Outcome {
  const total = list.reduce((a, o) => a + o.w, 0)
  let r = Math.random() * total
  for (const o of list) {
    r -= o.w
    if (r < 0) return o
  }
  return list[list.length - 1]
}

function act(id: ActionId) {
  if (ended.value || knock.value) return
  stats.value = { ...stats.value, day: stats.value.day + 1 }
  change({ hunger: 10 })
  const o = pickOutcome(OUTCOMES[id])
  write(o.text, o.tone)
  change(o.d)
  milestone()
  if (!check() && Math.random() < 0.28) openKnock()
}

function milestone() {
  const d = stats.value.day
  const lines: Record<number, [string, Tone]> = {
    3: ['广播：地表农业已经全面停产，资源优先保障太空防御。', 'bad'],
    6: ['广播：本周配给再次削减。请市民保持秩序。', 'bad'],
    9: ['你在救济站听到有人说，人口已经从八十亿跌到不足一半。', 'bad'],
    12: ['传闻第七区出了人吃人的事。你不敢多想。', 'bad'],
    15: ['停暖了三天。走廊里有人一直在咳嗽。', 'bad'],
    18: ['救济站有人说，地表的农场又开始试种了。', 'good'],
    21: ['广播里在读一份宣言：生存是第一位的，文明可以等一等。', 'plain'],
    24: ['广播里第一次提到「复兴」这个词。像一根很细的线。', 'good'],
    27: ['有人在墙上写：技术复兴在望，再撑几年就好。没有人把它擦掉。', 'good'],
  }
  if (lines[d]) write(lines[d][0], lines[d][1])
}

/* ---------- 敲门 ---------- */
interface Knock {
  who: string
  ask: string
  /** 分享后的结果 */
  share: { text: string; tone: Tone; d: Partial<Stats> }
  refuse: { text: string; d: Partial<Stats> }
}
const KNOCKS: Knock[] = [
  {
    who: '一个孩子',
    ask: '门外是一个很瘦的孩子：「阿姨……叔叔……有吃的吗？」',
    share: { text: '你把半份口粮给了他。他没说谢谢，跑得很快。你饿着，但那天晚上睡得很踏实。', tone: 'good', d: { hunger: 18, sanity: 8 } },
    refuse: { text: '你没有开门。脚步声在门外停了很久。', d: { sanity: -14 } },
  },
  {
    who: '一个老人',
    ask: '「我不是来要饭的。」一个老人隔着门说，「我只想要一点热水。」',
    share: { text: '你给了她热水，又给了一块饼干。她留下一张写着地表农场地址的纸条。', tone: 'good', d: { hunger: 10, sanity: 10 } },
    refuse: { text: '你告诉她没有热水。她说了声「好」，走了。', d: { sanity: -10 } },
  },
  {
    who: '一个陌生男人',
    ask: '「为了人类文明，分我一点吧……」门外的男人声音很急。',
    share: { text: '门一开，他冲进来抢走了你所有的存粮，还打伤了你。', tone: 'bad', d: { health: -25, hunger: 25, sanity: -12 } },
    refuse: { text: '敲门声越来越重，后来变成了哭声，最后消失了。', d: { sanity: -12 } },
  },
  {
    who: '隔壁的女人',
    ask: '隔壁的女人敲门：「我男人病了。你要是有多余的口粮，我用这件棉衣跟你换。」',
    share: { text: '你换了。那件棉衣让你在停暖的夜里活了下来。', tone: 'good', d: { hunger: 15, health: 10 } },
    refuse: { text: '你说你也没有。隔壁那夜很安静。', d: { sanity: -8 } },
  },
  {
    who: '配给员',
    ask: '配给员敲开门：「这一户的配给卡登记的是三个人。另外两个人呢？」',
    share: { text: '你说了实话：他们不在了。配给员在本子上划掉了两个名字，什么也没说。', tone: 'plain', d: { sanity: -6 } },
    refuse: { text: '你说他们去建设队了。配给员看了你很久，把三份口粮放在了门口。', d: { hunger: -20, sanity: -10 } },
  },
  {
    who: '一个讲故事的人',
    ask: '「我不要吃的。」门外的人说，「我在走廊里讲故事，换一个能睡觉的角落。」',
    share: { text: '你让他进来。他讲了一个关于公元的故事，讲到一半睡着了。那天晚上屋里好像没那么冷。', tone: 'good', d: { sanity: 14, hunger: 4 } },
    refuse: { text: '你没有开门。走廊里，他的声音讲给别人听了。', d: { sanity: -4 } },
  },
]
function openKnock() {
  knock.value = KNOCKS[Math.floor(Math.random() * KNOCKS.length)]
  write(knock.value.ask, 'plain')
}
function answer(share: boolean) {
  const k = knock.value
  if (!k) return
  knock.value = null
  if (share) {
    shared.value += 1
    write(k.share.text, k.share.tone)
    change(k.share.d)
  } else {
    refused.value += 1
    write(k.refuse.text, 'plain')
    change(k.refuse.d)
  }
  check()
}

function check(): boolean {
  const s = stats.value
  if (s.hunger >= 100) return finish(false, '你饿死在第 ' + s.day + ' 天。大低谷又吞没了一个人。')
  if (s.health <= 0) return finish(false, '你在第 ' + s.day + ' 天伤重不治。')
  if (s.sanity <= 0) return finish(false, '第 ' + s.day + ' 天，你走出了地下城，再也没有回来。')
  if (s.day > 30) return finish(true, '你熬过了大低谷最黑暗的三十天。')
  return false
}
function finish(survived: boolean, text: string): boolean {
  ended.value = { survived, text }
  write(text, survived ? 'good' : 'bad')
  return true
}

const reflection = computed(() => {
  if (!ended.value) return ''
  if (shared.value === 0 && refused.value === 0) return '这些天里没有人来敲你的门。'
  if (shared.value === 0) return `有 ${refused.value} 次，有人敲门，你没有开。`
  if (refused.value === 0) return `有人敲门时，你每一次都开了门，一共分出去 ${shared.value} 次口粮。`
  return `有人敲门时，你开过 ${shared.value} 次门，也有 ${refused.value} 次没有开。`
})
const bars = computed(() => [
  { id: 'health', label: '健康', v: stats.value.health, bad: stats.value.health < 30 },
  { id: 'hunger', label: '饥饿', v: stats.value.hunger, bad: stats.value.hunger > 75 },
  { id: 'sanity', label: '理智', v: stats.value.sanity, bad: stats.value.sanity < 30 },
])

/* ---------- 读者的档案 ---------- */
watch(ended, (e) => {
  if (e) recordAnswer('/sector-ravine', `${e.survived ? '活过了大低谷' : '没能活过大低谷'}；分出食物 ${shared.value} 次，拒绝 ${refused.value} 次`)
})
</script>

<template>
  <div class="sector-ravine">
    <BodyState :hunger="stats.hunger" :health="stats.health" :sanity="stats.sanity" :day="stats.day" />
    <SectorHeader
      title="大低谷"
      subtitle="为了四百年后的舰队，人类曾让一代人挨饿。这是那一代人里，一个普通人的三十天。"
      goal="每天做一个选择，在饥饿、健康与理智之间取舍，活过第 30 天。有人敲门时，决定开还是不开。"
      show-restart
      restart-label="重新开始"
      @restart="start"
    />

    <div class="room">
      <Vitrine class="diary-v">
        <div class="diary-head">
          <span class="diary-title">地下城日记</span>
          <span class="diary-day">第 <span class="num">{{ Math.min(30, stats.day) }}</span> / 30 天</span>
        </div>
        <div ref="diaryEl" class="diary" aria-live="polite">
          <p v-for="(e, i) in diary" :key="i" class="entry" :class="e.tone">
            <span class="entry-day num">{{ e.day }}</span>{{ e.text }}
          </p>
        </div>
      </Vitrine>

      <div class="side">
        <dl class="bars">
          <div v-for="b in bars" :key="b.id" :class="{ bad: b.bad }">
            <dt>{{ b.label }}</dt>
            <dd><span class="bar"><span :style="{ width: b.v + '%' }"></span></span><span class="num">{{ b.v }}</span></dd>
          </div>
        </dl>

        <div v-if="ended" class="ending">
          <h2>{{ ended.survived ? '你活了下来' : '你没能活下来' }}</h2>
          <p>{{ reflection }}</p>
          <p v-if="ended.survived">大低谷结束时，人口只剩下不到一半。活下来的人后来很少谈起这些年。</p>
          <p class="q">{{ question }}</p>
          <div class="row">
            <button type="button" class="plain-btn" @click="start">再过一次这三十天</button>
            <RouterLink to="/sector-pdc" class="plain-btn">换个位置：做理事会的预算</RouterLink>
          </div>
        </div>

        <div v-else-if="knock" class="knock" role="group" :aria-label="`${knock.who}在敲门`">
          <p class="knock-who">有人敲门：{{ knock.who }}</p>
          <div class="row">
            <button type="button" class="plain-btn primary" @click="answer(true)">开门，分一点出去</button>
            <button type="button" class="plain-btn" @click="answer(false)">不开</button>
          </div>
        </div>

        <ul v-else class="actions">
          <li v-for="a in ACTIONS" :key="a.id">
            <button type="button" @click="act(a.id)">
              <span class="a-label">{{ a.label }}</span>
              <span class="a-hint">{{ a.hint }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sector-ravine { --ochre: #c8a96a; padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 76rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.room { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 1fr); gap: 1.5rem; align-items: start; }
.diary-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.75rem; }
.diary-title { font-family: var(--font-serif); font-size: 1.125rem; font-weight: 600; letter-spacing: 0.1em; color: var(--bone); }
.diary-day { font-size: 0.875rem; color: var(--weathered); }
.diary-day .num { font-size: 1.25rem; color: var(--bone); }
.diary { height: min(56vh, 30rem); overflow-y: auto; padding-right: 0.5rem; }
.entry { display: flex; gap: 0.9rem; margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }
.entry-day { flex: 0 0 1.6rem; padding-top: 0.15rem; font-size: 0.8125rem; color: var(--weathered); text-align: right; }
.entry.bad { color: #d9a08f; }
.entry.good { color: var(--bone); }

.side { display: flex; flex-direction: column; gap: 1.5rem; }
.bars { margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.bars div { display: grid; grid-template-columns: 3rem 1fr; align-items: center; }
.bars dt { font-size: 0.875rem; color: var(--weathered); }
.bars dd { margin: 0; display: flex; align-items: center; gap: 0.6rem; }
.bar { flex: 1; height: 4px; background: var(--incision-soft); }
.bar span { display: block; height: 100%; background: var(--ochre); transition: width 0.4s; }
.bars .bad .bar span { background: var(--rust-bright); }
.bars .num { width: 2rem; text-align: right; font-size: 0.875rem; color: var(--bone); }

.actions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.actions button {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.9rem;
  font: inherit;
  text-align: left;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.actions button:hover { border-color: var(--ochre); }
.a-label { font-family: var(--font-serif); font-size: 1rem; }
.a-hint { font-size: 0.8125rem; color: var(--weathered); }
.knock { padding: 1rem; border: 1px solid var(--ochre); background: rgba(200, 169, 106, 0.06); }
.knock-who { margin: 0 0 0.9rem; font-family: var(--font-serif); font-size: 1.0625rem; color: var(--bone); }
.row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.1rem;
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
.plain-btn.primary { border-color: var(--ochre); color: var(--ochre); }
.ending h2 { margin: 0 0 0.75rem; font-family: var(--font-title); font-weight: 900; font-size: 1.75rem; letter-spacing: 0.08em; color: var(--bone); }
.ending p { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--gray-150); }
.ending .q { margin-top: 1rem; padding-left: 1rem; border-left: 1px solid var(--ochre); color: var(--bone); }

@media (max-width: 900px) {
  .room { grid-template-columns: 1fr; }
  .diary { height: 44vh; }
}
</style>
