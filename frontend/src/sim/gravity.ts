/**
 * 首页的三体——纯逻辑。
 * 三颗恒星和一颗行星，牛顿引力（加软化），蛙跳积分。访客可以抓住一颗恒星甩出去。
 * 行星上的「纪元」由它此刻收到的光照决定：一颗太阳稳定地照着是恒纪元，否则是乱纪元。
 */
export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  m: number
}
export interface Field {
  suns: Body[]
  planet: Body
  t: number
}

const G = 1
const SOFT = 0.15

export function createField(): Field {
  return {
    suns: [
      { x: -1.1, y: 0.2, vx: 0.12, vy: 0.42, m: 1 },
      { x: 1.0, y: -0.1, vx: -0.08, vy: -0.46, m: 1 },
      { x: 0.1, y: 1.0, vx: -0.36, vy: 0.04, m: 0.9 },
    ],
    planet: { x: 0.2, y: -1.6, vx: 0.7, vy: 0.05, m: 0 },
    t: 0,
  }
}

function accel(b: Body, suns: Body[], skip?: Body) {
  let ax = 0
  let ay = 0
  for (const s of suns) {
    if (s === skip) continue
    const dx = s.x - b.x
    const dy = s.y - b.y
    const r2 = dx * dx + dy * dy + SOFT * SOFT
    const inv = (G * s.m) / (r2 * Math.sqrt(r2))
    ax += dx * inv
    ay += dy * inv
  }
  return [ax, ay]
}

/** 推进 dt（原地修改并返回），被抓住的恒星不参与积分 */
export function step(f: Field, dt: number, held = -1): Field {
  const all = [...f.suns, f.planet]
  const acc = all.map((b) => accel(b, f.suns, b))
  all.forEach((b, i) => {
    if (i === held) return
    b.vx += acc[i][0] * dt * 0.5
    b.vy += acc[i][1] * dt * 0.5
    b.x += b.vx * dt
    b.y += b.vy * dt
  })
  const acc2 = all.map((b) => accel(b, f.suns, b))
  all.forEach((b, i) => {
    if (i === held) return
    b.vx += acc2[i][0] * dt * 0.5
    b.vy += acc2[i][1] * dt * 0.5
  })
  // 质心拉回画面中央，免得整个系统飘走
  const M = f.suns.reduce((a, s) => a + s.m, 0)
  const cx = f.suns.reduce((a, s) => a + s.x * s.m, 0) / M
  const cy = f.suns.reduce((a, s) => a + s.y * s.m, 0) / M
  if (held < 0) {
    for (const b of all) {
      b.x -= cx * 0.02
      b.y -= cy * 0.02
    }
  }
  // 行星飞得太远就重新放回一条轨道上（三体世界的又一次文明重启）
  if (Math.hypot(f.planet.x, f.planet.y) > 6) {
    f.planet.x = 0
    f.planet.y = -1.8
    f.planet.vx = 0.75
    f.planet.vy = 0
  }
  f.t += dt
  return f
}

export type Climate = 'stable' | 'chaos' | 'scorched' | 'frozen'

export function climate(f: Field): { kind: Climate; flux: number } {
  const fl = f.suns.map((s) => s.m / ((s.x - f.planet.x) ** 2 + (s.y - f.planet.y) ** 2 + 0.01))
  const flux = fl.reduce((a, b) => a + b, 0)
  if (flux > 6) return { kind: 'scorched', flux }
  if (flux < 0.12) return { kind: 'frozen', flux }
  return { kind: Math.max(...fl) / flux > 0.8 ? 'stable' : 'chaos', flux }
}

export const CLIMATE_TEXT: Record<Climate, { era: string; line: string }> = {
  stable: { era: '恒纪元', line: '一颗太阳稳稳地照着，可以浸泡复活了。' },
  chaos: { era: '乱纪元', line: '几颗太阳轮番升起，日夜没有规律。' },
  scorched: { era: '三日凌空', line: '太阳离得太近，大地在燃烧。' },
  frozen: { era: '飞星不动', line: '太阳都远去了，严寒降临。' },
}
