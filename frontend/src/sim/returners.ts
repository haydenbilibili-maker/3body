/**
 * 归零者的广播——纯逻辑。
 * 宇宙的质量被无数小宇宙带走了，大宇宙不再能坍缩重启。归零者向所有文明广播：归还质量。
 * 你是收到广播的文明之一。没有人能确认别人会不会归还；每一轮广播之后，大家都看得到总质量涨了多少。
 */
import { rng } from './threeBody'

export interface Civ {
  id: string
  name: string
  share: number
  /** 起初愿意相信这次广播的程度 */
  trust: number
  returned: boolean
  /** 是否留下了一只漂流瓶（一点点质量） */
  bottle: boolean
}

export interface ReturnState {
  round: number
  civs: Civ[]
  seed: number
}

export const ROUNDS = 6
/** 允许缺少的质量：一只漂流瓶大约这么多 */
export const TOLERANCE = 0.002
export const BOTTLE = 0.001
export const YOU = 'you'

export function createReturn(seed = 1): ReturnState {
  const r = rng(seed)
  const named: [string, number][] = [
    ['三体人的后裔', 0.1],
    ['歌者的母世界', 0.02],
  ]
  const others = Array.from({ length: 9 }, (_, i) => [`无名文明 ${i + 1}`, 0.03 + r() * 0.1] as [string, number])
  const weights = [...named, ...others].map(([, t]) => 0.5 + r())
  const sum = weights.reduce((a, b) => a + b, 0)
  const civs: Civ[] = [
    { id: YOU, name: '你', share: 0.06, trust: 0, returned: false, bottle: false },
    ...[...named, ...others].map(([name, trust], i) => ({
      id: `c${i}`,
      name,
      share: (weights[i] / sum) * 0.94,
      trust,
      returned: false,
      bottle: false,
    })),
  ]
  return { round: 0, civs, seed }
}

export function returnedMass(s: ReturnState): number {
  return s.civs.reduce((a, c) => a + (c.returned ? c.share - (c.bottle ? BOTTLE : 0) : 0), 0)
}

export function missing(s: ReturnState): number {
  return Math.max(0, 1 - returnedMass(s))
}

export type YourMove = 'all' | 'bottle' | 'wait'

/** 你先做决定，然后其他文明根据上一轮看到的总质量各自决定 */
export function nextRound(s: ReturnState, move: YourMove): ReturnState {
  if (s.round >= ROUNDS) return s
  const r = rng(s.seed * 97 + s.round * 13 + 5)
  // 每个文明看到的是「有多少个文明已经归还」：先走出第一步的人最重要
  const seen = s.civs.filter((c) => c.returned).length / s.civs.length
  const civs = s.civs.map((c) => {
    if (c.returned) return c
    if (c.id === YOU) return move === 'wait' ? c : { ...c, returned: true, bottle: move === 'bottle' }
    // 看到别人越多地归还，越愿意相信；最后一轮有一点「末班车」效应
    const p = c.trust + seen * 0.8 + (s.round === ROUNDS - 1 ? 0.1 : 0)
    return r() < p ? { ...c, returned: true } : c
  })
  return { ...s, round: s.round + 1, civs }
}

export function restarted(s: ReturnState): boolean {
  return missing(s) <= TOLERANCE
}

export function ending(s: ReturnState): 'restart' | 'held-out' | 'others' {
  if (restarted(s)) return 'restart'
  const you = s.civs.find((c) => c.id === YOU)!
  return you.returned ? 'others' : 'held-out'
}

export const ENDINGS = {
  restart: {
    title: '重启',
    text: '质量回来了。宇宙停止膨胀，开始收缩，最终回到一个奇点，再一次爆炸。新的宇宙也许有十个维度，光也许没有速度的上限——又一个田园时代。',
  },
  others: {
    title: '差了一点',
    text: '你归还了，可总有人没有。大宇宙差了一点质量，将永远膨胀下去，直到最后一颗恒星熄灭。你永远不会知道是谁。',
  },
  'held-out': {
    title: '你留下了',
    text: '你留下了自己的那一份。在你的小宇宙里，你会活得很久很久；外面的宇宙却不会再有田园时代了。也许它本来就差你这一份。',
  },
} as const
