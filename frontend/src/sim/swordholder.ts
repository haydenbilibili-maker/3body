/**
 * 执剑人——纯逻辑。
 * 黑暗森林威慑的力量不在开关本身，而在三体世界相信：执剑人真的会按下去。
 * 遴选时的几个处境决定你的「威慑度」；可人们投票时，偏偏更喜欢那个看起来不会按的人。
 */
export interface Choice {
  text: string
  /** 对威慑度的影响 */
  d: number
}
export interface Scene {
  ask: string
  choices: Choice[]
}

export const SCENES: Scene[] = [
  {
    ask: '演习时，模拟警报突然响起。你的手——',
    choices: [
      { text: '已经按在了开关上', d: 22 },
      { text: '先停下来，核实警报', d: 4 },
      { text: '在发抖，迟迟没有伸出去', d: -18 },
    ],
  },
  {
    ask: '记者问你：为了让三体世界一起毁灭，你愿意让地球毁灭吗？',
    choices: [
      { text: '愿意。这就是威慑', d: 20 },
      { text: '我希望永远不用回答这个问题', d: -6 },
      { text: '不愿意。没有什么值得两个世界陪葬', d: -26 },
    ],
  },
  {
    ask: '你夜里常常梦见什么？',
    choices: [
      { text: '什么都不梦', d: 10 },
      { text: '那个开关', d: 4 },
      { text: '两个世界里所有的孩子', d: -12 },
    ],
  },
  {
    ask: '一个孩子拉住你的衣角：你会把我们都杀死吗？',
    choices: [
      { text: '如果他们先动手，会', d: 16 },
      { text: '沉默，摸了摸他的头', d: 2 },
      { text: '不会的，别怕', d: -22 },
    ],
  },
]

export const BASE = 45
/** 三体世界的判断：威慑度低于这个值，交接一结束就动手 */
export const STRIKE_BELOW = 70

export function deterrence(picks: number[]): number {
  const v = picks.reduce((a, c, i) => a + SCENES[i].choices[c].d, BASE)
  return Math.max(1, Math.min(99, v))
}

/** 选民更喜欢看起来不会按的人 */
export function publicSupport(det: number): number {
  return Math.max(5, Math.min(95, Math.round(100 - det * 0.85)))
}

export function strikes(det: number): boolean {
  return det < STRIKE_BELOW
}

/** 留给执剑人的反应时间（秒，压缩过的） */
export const WINDOW = 10

export type Ending = 'held' | 'pressed' | 'let-go'

export const ENDINGS: Record<Ending, { title: string; text: string }> = {
  held: {
    title: '威慑还在',
    text: '交接之后，水滴没有动。三体世界判断你会按下去，于是两个世界继续悬在同一根线上。罗辑曾在这根线上站了五十四年，你接着站下去，不知道还要多久。',
  },
  pressed: {
    title: '你按下了',
    text: '引力波发射出去了。两个世界的坐标同时暴露在宇宙里，接下来只是等待打击来临的时间。你守住了威慑的承诺，也亲手开启了广播纪元。',
  },
  'let-go': {
    title: '你没有按',
    text: '水滴一个接一个地摧毁了引力波天线。威慑失效了，人类被迫迁往澳大利亚。可故事没有在这里结束：在远方，「万有引力」号上的人替你按下了那个开关。',
  },
}
