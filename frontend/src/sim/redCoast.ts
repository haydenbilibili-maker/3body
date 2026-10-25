/**
 * 红岸 —— 1971 年的一次发射、八年的等待、一个回答与否的选择。纯逻辑，便于测试。
 *
 * 第一幕：校准天线对准太阳，打开太阳增益，按住发射（不可撤销）。
 * 第二幕：信号以光速走 4.22 光年抵达半人马座 α，回信再走回来。
 * 第三幕：收到「不要回答」，由你决定是否回答。
 * 回信与独白均为转述，不是原著原文。
 */

export type Phase = 'calibrate' | 'travel' | 'reply' | 'answered' | 'silent' | 'faded'

/** 半人马座 α 的距离（光年） */
export const ALPHA_CEN_LY = 4.22
export const LAUNCH_YEAR = 1971

/** 天线指向与太阳的吻合度，0–100 */
export function alignment(az: number, el: number, targetAz: number, targetEl: number): number {
  const d = Math.hypot(az - targetAz, el - targetEl)
  return Math.max(0, Math.round(100 - d * 5))
}

export const ALIGNED_AT = 95

/** 未经太阳放大的信号在多远处消散（光年）——只是给玩家一个直观的对比 */
export const WEAK_SIGNAL_REACH_LY = 0.0001

/**
 * 发射结果：只有对准太阳并打开增益，信号才足以抵达另一颗恒星。
 */
export function transmit(aligned: boolean, solarGain: boolean): 'reaches' | 'fades' {
  return aligned && solarGain ? 'reaches' : 'fades'
}

/** 往返进度 0–1 对应的年份与信号位置（0 = 太阳，1 = 半人马座 α） */
export function travelAt(progress: number): { year: number; position: number; returning: boolean } {
  const p = Math.min(1, Math.max(0, progress))
  const years = p * 2 * ALPHA_CEN_LY
  return {
    year: LAUNCH_YEAR + years,
    position: p <= 0.5 ? p * 2 : 2 - p * 2,
    returning: p > 0.5,
  }
}

export interface Beat {
  /** 进度阈值 0–1 */
  at: number
  text: string
}

export const TRAVEL_BEATS: Beat[] = [
  { at: 0, text: '信号离开了。它比任何人想象的都要强，因为它借了太阳的力量。' },
  { at: 0.12, text: '你走出发射控制室。雷达峰上在下雪，没有人知道刚才发生了什么。' },
  { at: 0.5, text: '四年零三个月后，信号抵达半人马座 α。那里有人在听。' },
  { at: 0.62, text: '回信启程了。它也要走四年。' },
  { at: 0.88, text: '你几乎已经忘了那一次发射。' },
]

export function beatsUntil(progress: number): Beat[] {
  return TRAVEL_BEATS.filter((b) => b.at <= progress)
}

/** 回信（转述）。中间一行是唯一被直接写出的原话。 */
export const REPLY_LINES = [
  '我是这个世界的一名监听员。你们的信息，被我收到了。',
  '不要回答！不要回答！不要回答！',
  '只要你们不回答，这个世界就无法确定发射源的方向。',
  '如果回答，发射源会被定位，你们的世界将被入侵、被占领。',
]

/** 选择之前：叶文洁的处境（转述） */
export const BEFORE_CHOICE =
  '你见过人类最坏的样子。你不再相信人类能依靠自己变好。现在，宇宙里有另一种力量，只差一次回答。'

export const ENDINGS: Record<'answered' | 'silent' | 'faded', { title: string; lines: string[] }> = {
  answered: {
    title: '你回答了',
    lines: [
      '回答在四年后抵达。又过了一些时间，一支舰队启程，它将在四百多年后到达。',
      '你替所有人做了决定，却没有问过其中任何一个人。',
    ],
  },
  silent: {
    title: '你没有回答',
    lines: [
      '接收器关上了。那一夜，没有人知道宇宙里有人为你们说过话。',
      '人类还是那个让你失望的人类。你没有替它选择，也就把选择留给了它自己。',
    ],
  },
  faded: {
    title: '信号消散了',
    lines: [
      '没有太阳的放大，信号走出不到一光年的万分之一就淹没在噪声里。',
      '没有人会听见。也许这本来就是更好的结局——但你可以再试一次。',
    ],
  },
}
