/**
 * 黑暗森林的前厅：一盏灯——纯逻辑。
 * 宇宙是黑的。你手里有一盏灯，照到哪里，就能看见哪里的星星和文明；
 * 可灯光也让你被看见：附近的猎人会慢慢注意到你，注意力满了，打击就来了。
 * 远处偶尔也有别的文明点亮自己的灯——你会看见它们是怎么熄灭的。
 */
import { rng } from './threeBody'

export type Kind = 'star' | 'civ' | 'hunter'
export interface Point {
  id: number
  x: number
  y: number
  kind: Kind
  /** 被灯光照见过 */
  seen: boolean
  /** 猎人的注意力（0–1） */
  aware: number
}
export interface Beacon {
  x: number
  y: number
  life: number
  struck: boolean
}
export interface LampState {
  points: Point[]
  beacons: Beacon[]
  exposed: number
  strikes: number
  t: number
  /** 打击正在飞向你：剩余秒数；null 表示没有 */
  incoming: number | null
  seed: number
}

export const RADIUS = 0.14
export const NOTICE = 0.42 // 每秒，猎人在灯光范围附近时注意力增长
export const FORGET = 0.18 // 每秒，熄灯后注意力衰减
export const FLIGHT = 1.4 // 光粒飞行时间（秒）

export function createLamp(seed = 1): LampState {
  const r = rng(seed)
  const points: Point[] = Array.from({ length: 140 }, (_, i) => {
    const u = r()
    const kind: Kind = u < 0.08 ? 'hunter' : u < 0.2 ? 'civ' : 'star'
    return { id: i, x: r(), y: r(), kind, seen: false, aware: 0 }
  })
  return { points, beacons: [], exposed: 0, strikes: 0, t: 0, incoming: null, seed }
}

export function step(s: LampState, dt: number, lamp: { x: number; y: number } | null): LampState {
  const r = rng(Math.floor((s.t + dt) * 1000) + s.seed)
  const t = s.t + dt
  let incoming = s.incoming
  let strikes = s.strikes
  const points = s.points.map((p) => {
    const d = lamp ? Math.hypot(p.x - lamp.x, p.y - lamp.y) : Infinity
    const seen = p.seen || d < RADIUS
    let aware = p.aware
    if (p.kind === 'hunter') {
      aware = lamp && d < RADIUS * 2.2 ? Math.min(1, aware + NOTICE * dt * (1.6 - d / (RADIUS * 2.2))) : Math.max(0, aware - FORGET * dt)
    }
    return { ...p, seen, aware }
  })
  if (incoming === null && points.some((p) => p.kind === 'hunter' && p.aware >= 1)) incoming = FLIGHT
  if (incoming !== null) {
    incoming -= dt
    if (incoming <= 0) {
      incoming = null
      if (lamp) strikes += 1
      for (const p of points) if (p.kind === 'hunter') p.aware = 0
    }
  }
  // 远处的文明偶尔点灯，过一会儿被打击
  let beacons = s.beacons
    .map((b) => ({ ...b, life: b.life - dt, struck: b.struck || b.life - dt < 1.2 }))
    .filter((b) => b.life > 0)
  if (r() < dt * 0.25 && beacons.length < 3) beacons = [...beacons, { x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.8, life: 5 + r() * 3, struck: false }]
  return { ...s, points, beacons, t, incoming, strikes, exposed: s.exposed + (lamp ? dt : 0) }
}

export function tally(s: LampState) {
  return {
    civs: s.points.filter((p) => p.kind === 'civ' && p.seen).length,
    hunters: s.points.filter((p) => p.kind === 'hunter' && p.seen).length,
    stars: s.points.filter((p) => p.seen).length,
  }
}
