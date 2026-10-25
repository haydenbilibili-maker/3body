/**
 * 科学边界 —— 三个思想实验的纯逻辑。
 * 台球：同样的击球得到同样的轨迹（物理规律可以重复）；智子干扰时，每次结果都不同。
 * 农场主：火鸡科学家用拉普拉斯继承法则估计「明天上午十一点还有食物」的信心。
 * 射手：靶面上的洞看起来服从规律，直到射手换了主意。
 */
import { rng } from './threeBody'

export interface Pt {
  x: number
  y: number
}

export const TABLE = { w: 200, h: 110 }

/**
 * 模拟一次击球，返回母球轨迹（桌面坐标）。确定性：相同参数 → 相同轨迹。
 * noise > 0 时，在每次碰撞库边时加入随机偏转（智子干扰）。
 */
export function shoot(angleDeg: number, power: number, noise = 0, seed = 1): Pt[] {
  const r = rng(seed)
  let x = 40
  let y = TABLE.h / 2
  let vx = Math.cos((angleDeg * Math.PI) / 180) * power
  let vy = Math.sin((angleDeg * Math.PI) / 180) * power
  const path: Pt[] = [{ x, y }]
  for (let i = 0; i < 4000; i += 1) {
    x += vx * 0.05
    y += vy * 0.05
    let hit = false
    if (x < 4 || x > TABLE.w - 4) {
      vx = -vx
      x = Math.min(TABLE.w - 4, Math.max(4, x))
      hit = true
    }
    if (y < 4 || y > TABLE.h - 4) {
      vy = -vy
      y = Math.min(TABLE.h - 4, Math.max(4, y))
      hit = true
    }
    if (hit && noise > 0) {
      const a = (r() - 0.5) * noise
      const c = Math.cos(a)
      const s = Math.sin(a)
      ;[vx, vy] = [vx * c - vy * s, vx * s + vy * c]
    }
    vx *= 0.996
    vy *= 0.996
    if (i % 6 === 0) path.push({ x, y })
    if (Math.hypot(vx, vy) < 0.4) break
  }
  path.push({ x, y })
  return path
}

export function endPoint(path: Pt[]): Pt {
  return path[path.length - 1]
}

/** 拉普拉斯继承法则：连续 n 次成功后，下一次成功的概率 (n+1)/(n+2) */
export function laplace(n: number): number {
  return (n + 1) / (n + 2)
}

export const THANKSGIVING = 100

/** 射手的靶面：前若干次每隔固定间距一个洞，之后由于射手换了主意，洞的位置不再服从这个规律 */
export function holes(count: number, brokenAfter = Infinity, seed = 3): Pt[] {
  const r = rng(seed)
  const out: Pt[] = []
  for (let i = 0; i < count; i += 1) {
    if (i < brokenAfter) {
      const col = i % 9
      const row = Math.floor(i / 9) % 5
      out.push({ x: 20 + col * 20, y: 15 + row * 20 })
    } else {
      out.push({ x: 10 + r() * 180, y: 8 + r() * 94 })
    }
  }
  return out
}
