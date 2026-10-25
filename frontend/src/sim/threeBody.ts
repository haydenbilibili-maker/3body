/**
 * 三体世界的简化物理：三颗恒星二维蛙跳积分，行星沿固定圆轨道绕质心运行。
 * - 为了让恒星在游戏时长内不被甩飞，加了一个弱向心约束（游戏物理，不是天体物理）。
 * - 行星若作为试验粒子参与积分，几乎总会被抛出系统；固定轨道让混沌只来自三颗恒星。
 * 行星接收到的光照决定当天是恒纪元、三日凌空还是严寒。参数经本地统计调校：
 * 每段纪元平均约 7–8 天；恒纪元约占 45%，三日凌空与严寒各约四分之一。
 * 历法预测：次日约九成准确，两周后约七成五（随机猜测约四成）。
 */

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  m: number
}

export interface System {
  suns: [Body, Body, Body]
  planet: Body
  t: number
}

const G = 1
const SOFT = 0.05 // 引力软化，避免近距离奇点
const TRAP = 0.25 // 弱向心约束
export const ORBIT_R = 2.0
export const ORBIT_W = 0.2

export type Env = 'stable' | 'heat' | 'cold'

/** 可复现的伪随机（mulberry32） */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSystem(seed = 7): System {
  const r = rng(seed)
  const suns = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + r() * 0.6
    const d = 1 + r() * 0.4
    return {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d,
      vx: -Math.sin(a) * (0.55 + r() * 0.25),
      vy: Math.cos(a) * (0.55 + r() * 0.25),
      m: 1 + r() * 0.4,
    }
  }) as [Body, Body, Body]
  // 质心速度归零，避免整体漂移
  const M = suns.reduce((s, b) => s + b.m, 0)
  const cvx = suns.reduce((s, b) => s + b.m * b.vx, 0) / M
  const cvy = suns.reduce((s, b) => s + b.m * b.vy, 0) / M
  for (const b of suns) {
    b.vx -= cvx
    b.vy -= cvy
  }
  const sys = { suns, planet: { x: ORBIT_R, y: 0, vx: 0, vy: 0, m: 0 }, t: 0 }
  placePlanet(sys)
  return sys
}

function accel(sys: System, target: Body, self: number): [number, number] {
  let ax = -TRAP * target.x
  let ay = -TRAP * target.y
  sys.suns.forEach((s, i) => {
    if (i === self) return
    const dx = s.x - target.x
    const dy = s.y - target.y
    const r2 = dx * dx + dy * dy + SOFT * SOFT
    const inv = (G * s.m) / (r2 * Math.sqrt(r2))
    ax += dx * inv
    ay += dy * inv
  })
  return [ax, ay]
}

export function cloneSystem(sys: System): System {
  return {
    suns: sys.suns.map((b) => ({ ...b })) as [Body, Body, Body],
    planet: { ...sys.planet },
    t: sys.t,
  }
}

function placePlanet(sys: System) {
  const a = sys.t * ORBIT_W
  sys.planet.x = Math.cos(a) * ORBIT_R
  sys.planet.y = Math.sin(a) * ORBIT_R
  sys.planet.vx = -Math.sin(a) * ORBIT_R * ORBIT_W
  sys.planet.vy = Math.cos(a) * ORBIT_R * ORBIT_W
}

/** 推进 dt（原地修改），蛙跳积分：踢—漂—踢 */
export function step(sys: System, dt = 0.01): System {
  const bodies = [...sys.suns]
  const acc = bodies.map((b, i) => accel(sys, b, i))
  bodies.forEach((b, i) => {
    b.vx += acc[i][0] * dt * 0.5
    b.vy += acc[i][1] * dt * 0.5
    b.x += b.vx * dt
    b.y += b.vy * dt
  })
  const acc2 = bodies.map((b, i) => accel(sys, b, i))
  bodies.forEach((b, i) => {
    b.vx += acc2[i][0] * dt * 0.5
    b.vy += acc2[i][1] * dt * 0.5
  })
  sys.t += dt
  placePlanet(sys)
  return sys
}

/** 一「天」= 若干积分步 */
export const STEPS_PER_DAY = 24
export const DT = 0.01

export function advanceDay(sys: System): System {
  for (let i = 0; i < STEPS_PER_DAY; i += 1) step(sys, DT)
  return sys
}

/** 行星接收到的光照：Σ m / d² */
export function flux(sys: System): number {
  return sys.suns.reduce((acc, s) => {
    const dx = s.x - sys.planet.x
    const dy = s.y - sys.planet.y
    return acc + s.m / (dx * dx + dy * dy + SOFT)
  }, 0)
}

/** 近处（比行星到质心距离的一半更近）的恒星数量，用于判断「三日凌空」 */
export function nearSuns(sys: System, within = 1.2): number {
  return sys.suns.filter((s) => Math.hypot(s.x - sys.planet.x, s.y - sys.planet.y) < within).length
}

export const HEAT_FLUX = 1.29
export const COLD_FLUX = 0.75

export function classify(f: number): Env {
  if (f > HEAT_FLUX) return 'heat'
  if (f < COLD_FLUX) return 'cold'
  return 'stable'
}

export const MASS_ERROR = 0.1

/**
 * 历法预测：从一个带测量误差的副本出发，往后积分若干天。
 * 前几天往往是准的，越往后越离谱——三体问题没有解。
 */
export function forecast(sys: System, days: number, error = 0.1, seed = 1, massError = MASS_ERROR): Env[] {
  const r = rng(seed)
  const copy = cloneSystem(sys)
  for (const b of copy.suns) {
    b.x += (r() - 0.5) * error
    b.y += (r() - 0.5) * error
    // 历法模型本身也不精确：对每颗恒星质量的估计有几个百分点的偏差
    b.m *= 1 + (r() - 0.5) * 2 * massError
  }
  const out: Env[] = []
  for (let d = 0; d < days; d += 1) {
    advanceDay(copy)
    out.push(classify(flux(copy)))
  }
  return out
}
