/**
 * 刻在石头上——纯逻辑。
 * 字刻得越大，保存得越久，能写下的就越少：这是冥王星博物馆面对的取舍。
 * 一块石碑：选字号 → 写下留言（超出容量的部分刻不下）→ 看它在时间里风化。
 */
import { erode } from './erosion'

export interface Size {
  id: number
  name: string
  /** 这块石碑能刻下的字数 */
  capacity: number
  /** 字迹能保存的年数 */
  lifespan: number
}

export const SIZES: Size[] = [
  { id: 0, name: '微缩刻印', capacity: 400, lifespan: 1e4 },
  { id: 1, name: '蝇头小字', capacity: 160, lifespan: 1e5 },
  { id: 2, name: '碑文', capacity: 60, lifespan: 1e7 },
  { id: 3, name: '斗大的字', capacity: 24, lifespan: 1e8 },
  { id: 4, name: '一字一石', capacity: 8, lifespan: 1e10 },
]

/** 时间轴上的几个刻度（年） */
export const EPOCHS = [0, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]

export function epochLabel(y: number): string {
  if (y === 0) return '刻下的那天'
  if (y >= 1e8) return `${y / 1e8} 亿年后`
  if (y >= 1e4) return `${y / 1e4} 万年后`
  return `${y} 年后`
}

/** 只数非空白字符 */
export function fit(text: string, size: Size): { kept: string; lost: string } {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  let n = 0
  let cut = chars.length
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ' ') n++
    if (n > size.capacity) {
      cut = i
      break
    }
  }
  return { kept: chars.slice(0, cut).join(''), lost: chars.slice(cut).join('') }
}

/** 风化程度：寿命的 1/10 之前完好，到寿命时全部磨平（对数尺度上线性） */
export function wear(years: number, size: Size): number {
  if (years <= 0) return 0
  const start = Math.log10(size.lifespan / 10)
  const end = Math.log10(size.lifespan)
  return Math.max(0, Math.min(1, (Math.log10(years) - start) / (end - start)))
}

export function weathered(text: string, years: number, size: Size, seed = 7): string {
  return erode(text, wear(years, size), seed)
}
