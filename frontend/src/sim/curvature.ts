/**
 * 曲率驱动——纯逻辑。
 * 飞船抹平身后的空间来前进，航迹里的光速会降下来。
 * 航迹绕恒星一圈，就成了「黑域」：外面看来，这个星系再也无法向外伸手——一份安全声明；
 * 航迹一直延伸到远方，则是一条谁都看得见的路标：这里有人会造光速飞船。
 */
export const W = 800
export const H = 560
export const STAR = { x: W / 2, y: H / 2 }
/** 包裹带：离恒星这个距离范围内的航迹，才算在围住它 */
export const BAND = { inner: 70, outer: 170 }
export const BINS = 36
export const DOMAIN_COVERAGE = 0.92
export const MAX_SPEED = 4
export const FRICTION = 0.985
export const TRAIL_LIFE = 2400 // 帧
/** 航迹点离恒星超过这个距离，就会被远方看见 */
export const FAR = 250
export const EXPOSE_LIMIT = 260

export interface Ship {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
}
export interface TrailPoint {
  x: number
  y: number
  age: number
}
export interface Input {
  turn: number // -1..1
  thrust: number // 0..1
}
export interface FlightState {
  ship: Ship
  trail: TrailPoint[]
  frame: number
  /** 被远方看见的航迹累计 */
  exposure: number
  ending: null | 'domain' | 'escape' | 'exposed'
}

export function createFlight(): FlightState {
  return {
    ship: { x: STAR.x, y: STAR.y + 120, vx: 0, vy: 0, angle: 0 },
    trail: [],
    frame: 0,
    exposure: 0,
    ending: null,
  }
}

export function speedOf(s: Ship): number {
  return Math.hypot(s.vx, s.vy)
}

/** 洛伦兹收缩（为了看得见，夸大处理）：速度趋近上限时，船身沿航向缩短 */
export function contraction(s: Ship): number {
  const r = Math.min(1, speedOf(s) / MAX_SPEED)
  return Math.sqrt(1 - r * r * 0.9)
}

export function coverage(trail: TrailPoint[]): number {
  const bins = new Array<boolean>(BINS).fill(false)
  for (const p of trail) {
    const d = Math.hypot(p.x - STAR.x, p.y - STAR.y)
    if (d < BAND.inner || d > BAND.outer) continue
    const a = Math.atan2(p.y - STAR.y, p.x - STAR.x)
    bins[Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS] = true
  }
  return bins.filter(Boolean).length / BINS
}

export function step(st: FlightState, input: Input): FlightState {
  if (st.ending) return st
  const s = { ...st.ship }
  s.angle += input.turn * 0.07
  const thrust = Math.max(0, Math.min(1, input.thrust)) * 0.14
  s.vx = (s.vx + Math.cos(s.angle) * thrust) * FRICTION
  s.vy = (s.vy + Math.sin(s.angle) * thrust) * FRICTION
  const v = speedOf(s)
  if (v > MAX_SPEED) {
    s.vx = (s.vx / v) * MAX_SPEED
    s.vy = (s.vy / v) * MAX_SPEED
  }
  s.x += s.vx
  s.y += s.vy
  const frame = st.frame + 1
  let exposure = st.exposure
  let trail = st.trail.map((p) => ({ ...p, age: p.age + 1 })).filter((p) => p.age < TRAIL_LIFE)
  if (thrust > 0 && frame % 3 === 0) {
    const p = { x: s.x - Math.cos(s.angle) * 14, y: s.y - Math.sin(s.angle) * 14, age: 0 }
    trail.push(p)
    if (Math.hypot(p.x - STAR.x, p.y - STAR.y) > FAR) exposure += 1
  }
  if (trail.length > 1200) trail = trail.slice(-1200)

  let ending: FlightState['ending'] = null
  if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) ending = 'escape'
  else if (exposure >= EXPOSE_LIMIT) ending = 'exposed'
  else if (coverage(trail) >= DOMAIN_COVERAGE) ending = 'domain'
  return { ship: s, trail, frame, exposure, ending }
}

export const ENDINGS: Record<'domain' | 'escape' | 'exposed', { title: string; lines: string[] }> = {
  domain: {
    title: '黑域',
    lines: [
      '航迹合拢了。太阳被一圈低光速的空间裹住，光在里面每秒只走十几公里。',
      '从外面看，这里成了一个永远伸不出手的地方——一份写给宇宙的安全声明。',
      '代价是，从此谁也出不去了。',
    ],
  },
  escape: {
    title: '离开',
    lines: [
      '你飞出了太阳系。身后的航迹慢慢淡去，像一条没人会再走的路。',
      '光速飞船只装得下极少数人。留下来的人，会怎样看待那些离开的人？',
    ],
  },
  exposed: {
    title: '路标',
    lines: [
      '你的航迹在远处拖得太长了。在宇宙的眼睛里，那是一行字：这里的文明，已经会造光速飞船。',
      '对黑暗森林里的猎人而言，这比任何广播都危险。',
    ],
  },
}
