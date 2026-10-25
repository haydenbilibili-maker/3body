/**
 * 智子展开到二维后刻上的电路——纯逻辑。
 * 从中心出发的几条走线在网格上前进、转弯、分叉，不与已有的线重叠；
 * 每段线带一个先后次序，画面按次序把电路一笔一笔「刻」出来。
 */
import { rng } from './threeBody'

export interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
  order: number
  /** 终点是否放一个焊点 */
  pad: boolean
}

const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

export function circuit(cols: number, rows: number, seed = 1, maxSegs = 900): Seg[] {
  const r = rng(seed)
  const used = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  used.add(key(cx, cy))
  type Walker = { x: number; y: number; d: number; order: number }
  let walkers: Walker[] = DIRS.map((_, d) => ({ x: cx, y: cy, d, order: 0 }))
  const segs: Seg[] = []
  while (walkers.length && segs.length < maxSegs) {
    const next: Walker[] = []
    for (const w of walkers) {
      let d = w.d
      if (r() < 0.22) d = (d + (r() < 0.5 ? 1 : 3)) % 4
      // 撞上边界或已有的线时，先试着转弯，实在走不通才停下并放一个焊点
      const tries = [d, (d + 1) % 4, (d + 3) % 4]
      let nx = -1
      let ny = -1
      let ok = false
      for (const t of tries) {
        const [dx, dy] = DIRS[t]
        nx = w.x + dx
        ny = w.y + dy
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !used.has(key(nx, ny))) {
          d = t
          ok = true
          break
        }
      }
      if (!ok) {
        if (segs.length) segs[segs.length - 1].pad = true
        continue
      }
      used.add(key(nx, ny))
      segs.push({ x1: w.x, y1: w.y, x2: nx, y2: ny, order: w.order + 1, pad: false })
      next.push({ x: nx, y: ny, d, order: w.order + 1 })
      if (r() < 0.16 && next.length < 60) next.push({ x: nx, y: ny, d: (d + (r() < 0.5 ? 1 : 3)) % 4, order: w.order + 1 })
    }
    walkers = next
  }
  return segs
}

/** 拖动的距离对应的维度：0–0.95 是 11 维到 3 维；0.95–1.15 是二维（留宽一点，好松手）；再往外拉就成了 1 维 */
export function dimensionAt(d: number): number {
  if (d >= 1.15) return 1
  if (d >= 0.95) return 2
  return Math.max(3, 11 - Math.floor((Math.max(0, d) / 0.95) * 8.999))
}

/** dimensionAt 的反函数：某一维的中间位置 */
export function distanceFor(dim: number): number {
  if (dim <= 1) return 1.2
  if (dim === 2) return 1.05
  return ((11 - dim + 0.5) / 8.999) * 0.95
}
