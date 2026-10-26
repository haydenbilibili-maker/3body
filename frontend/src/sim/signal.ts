/**
 * 留言的信号——纯逻辑。
 * 发出去的话以光速离开地球，永远追不回来。一条信号走了多远，只取决于它发出了多久。
 */
const SEC = 1
const MIN = 60
const HOUR = 3600
const DAY = 86400
const YEAR = 365.25 * DAY

/** 沿途的地标：到地球的光行时间（秒） */
export const LANDMARKS: { at: number; name: string }[] = [
  { at: 1.3 * SEC, name: '月球' },
  { at: 8.3 * MIN, name: '太阳' },
  { at: 43 * MIN, name: '木星轨道' },
  { at: 80 * MIN, name: '土星轨道' },
  { at: 4.1 * HOUR, name: '海王星轨道' },
  { at: 24 * HOUR, name: '旅行者 1 号' },
  { at: 1 * YEAR, name: '奥尔特云深处' },
  { at: 4.24 * YEAR, name: '比邻星' },
  { at: 4.37 * YEAR, name: '半人马座 α（三体世界）' },
  { at: 8.6 * YEAR, name: '天狼星' },
  { at: 25 * YEAR, name: '织女星' },
  { at: 50 * YEAR, name: '五十光年内的上千颗恒星' },
]

export function lightSeconds(sentAt: number, now: number): number {
  return Math.max(0, (now - sentAt) / 1000)
}

export function formatDistance(s: number): string {
  if (s < MIN) return `${s.toFixed(s < 10 ? 1 : 0)} 光秒`
  if (s < HOUR) return `${(s / MIN).toFixed(1)} 光分`
  if (s < DAY) return `${(s / HOUR).toFixed(1)} 光时`
  if (s < YEAR) return `${(s / DAY).toFixed(1)} 光日`
  return `${(s / YEAR).toFixed(1)} 光年`
}

/** 信号最近越过的地标，以及下一个 */
export function whereIs(s: number): { passed: string | null; next: string | null } {
  let passed: string | null = null
  let next: string | null = null
  for (const l of LANDMARKS) {
    if (s >= l.at) passed = l.name
    else {
      next = l.name
      break
    }
  }
  return { passed, next }
}

export interface Signal {
  id: number
  text: string
  /** 毫秒时间戳；null 表示没有发出，只留在留言簿里 */
  sentAt: number | null
  by: string
}

/** 档案里两条真实（或原著里）的、早已离开地球的信号 */
export const ANCIENT: Signal[] = [
  { id: -1, text: '阿雷西博信息：数字 1 到 10、DNA 的结构、一个人形、太阳系和发射它的望远镜。', sentAt: Date.UTC(1974, 10, 16), by: '阿雷西博射电望远镜，朝向武仙座球状星团 M13' },
  { id: -2, text: '到这里来吧，我将帮助你们获得这个世界。', sentAt: Date.UTC(1979, 5, 1), by: '叶文洁，红岸基地，收到「不要回答」之后（原著）' },
]

/**
 * 远处的回声：宇宙里不只有你在说话（恢复自旧版留言簿的弹幕，改为按光年远近慢慢传来的弱信号）。
 * 文字是本项目的转述。
 */
export interface Echo {
  text: string
  from: string
  /** 距离，光年 */
  ly: number
}
export const ECHOES: Echo[] = [
  { text: '不要回答！不要回答！不要回答！', from: '三体世界，1379 号监听站', ly: 4.2 },
  { text: '一串没有人能读懂的素数，重复了三遍，然后停了。', from: '方向不明', ly: 37 },
  { text: '我们无害。我们已经把自己关进了光速很慢的地方。', from: '一个低光速文明的安全声明', ly: 210 },
  { text: '这里曾经有一个文明。现在只剩下这段录音。', from: '一颗已经熄灭的恒星附近', ly: 1300 },
  { text: '海干了，鱼就要聚集在水洼里。', from: '四维碎片，「魔戒」', ly: 0.0001 },
  { text: '归还质量。宇宙需要重新开始。', from: '归零者，所有方向', ly: 0 },
]
