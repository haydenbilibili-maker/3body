/**
 * 掩体计划——纯逻辑。
 * 太空城停在巨行星背向太阳的一侧，躲进行星的阴影里：太阳若被光粒击中爆发，阴影里的城市才能幸存。
 * 城市会慢慢偏离阴影（摄动），需要消耗推进剂校正；预警之后，打击会在几秒内到来。
 */
import { rng } from './threeBody'

export interface Giant {
  id: string
  name: string
  /** 轨道半径（画面单位） */
  orbit: number
  /** 行星半径（画面单位） */
  radius: number
  /** 公转角速度（弧度/秒） */
  speed: number
  angle: number
}

export interface City {
  id: string
  name: string
  giant: string
  /** 相对「背向太阳方向」的偏角（弧度），0 = 阴影正中 */
  offset: number
  /** 偏移漂移速度（弧度/秒） */
  drift: number
  alive: boolean
}

export interface BunkerState {
  t: number
  giants: Giant[]
  cities: City[]
  fuel: number
  alertAt: number
  strikeAt: number
  struck: boolean
}

export const MAX_FUEL = 6
export const FUEL_REGEN = 0.25 // 每秒
export const WARNING_SECONDS = 8

/** 阴影的半张角：行星越大、离城市越近，阴影越宽（简化为与行星半径成正比） */
export function shadowHalfAngle(g: Giant): number {
  return Math.min(0.6, (g.radius / 10) * 0.22)
}

export function inShadow(city: City, giants: Giant[]): boolean {
  const g = giants.find((x) => x.id === city.giant)
  return !!g && Math.abs(city.offset) < shadowHalfAngle(g)
}

export function createBunker(seed = 1): BunkerState {
  const r = rng(seed)
  const giants: Giant[] = [
    { id: 'jupiter', name: '木星', orbit: 150, radius: 14, speed: 0.06, angle: r() * 6.28 },
    { id: 'saturn', name: '土星', orbit: 215, radius: 12, speed: 0.045, angle: r() * 6.28 },
    { id: 'uranus', name: '天王星', orbit: 275, radius: 8, speed: 0.032, angle: r() * 6.28 },
    { id: 'neptune', name: '海王星', orbit: 330, radius: 8, speed: 0.025, angle: r() * 6.28 },
  ]
  const names: [string, string][] = [
    ['亚洲一号', 'jupiter'],
    ['北美一号', 'jupiter'],
    ['欧洲三号', 'saturn'],
    ['太平洋一号', 'saturn'],
    ['天王星城', 'uranus'],
    ['海王星城', 'neptune'],
  ]
  const cities: City[] = names.map(([name, giant], i) => ({
    id: `c${i}`,
    name,
    giant,
    offset: (r() - 0.5) * 0.1,
    drift: (r() < 0.5 ? -1 : 1) * (0.012 + r() * 0.02),
    alive: true,
  }))
  const alertAt = 22 + r() * 18
  return { t: 0, giants, cities, fuel: MAX_FUEL, alertAt, strikeAt: alertAt + WARNING_SECONDS, struck: false }
}

/** 推进 dt 秒（返回新状态） */
export function tick(s: BunkerState, dt: number, seed = 0): BunkerState {
  if (s.struck) return s
  const r = rng(Math.floor((s.t + dt) * 1000) + seed)
  const t = s.t + dt
  const giants = s.giants.map((g) => ({ ...g, angle: g.angle + g.speed * dt }))
  const cities = s.cities.map((c) => {
    // 摄动：漂移会慢慢变向
    const drift = c.drift + (r() - 0.5) * 0.004 * dt * 10
    return { ...c, drift, offset: c.offset + drift * dt }
  })
  const next: BunkerState = { ...s, t, giants, cities, fuel: Math.min(MAX_FUEL, s.fuel + FUEL_REGEN * dt) }
  if (t >= s.strikeAt) {
    next.struck = true
    next.cities = next.cities.map((c) => ({ ...c, alive: inShadow(c, giants) }))
  }
  return next
}

/** 校正一座城市回到阴影正中，消耗 1 份推进剂 */
export function correct(s: BunkerState, cityId: string): BunkerState {
  if (s.struck || s.fuel < 1) return s
  return {
    ...s,
    fuel: s.fuel - 1,
    cities: s.cities.map((c) => (c.id === cityId ? { ...c, offset: 0, drift: c.drift * 0.4 } : c)),
  }
}

export function phase(s: BunkerState): 'calm' | 'alert' | 'struck' {
  if (s.struck) return 'struck'
  return s.t >= s.alertAt ? 'alert' : 'calm'
}

export type Plan = 'bunker' | 'domain' | 'lightspeed'

export const PLANS: { id: Plan; name: string; desc: string; cost: string }[] = [
  {
    id: 'bunker',
    name: '掩体计划',
    desc: '在木星、土星、天王星、海王星背后建造太空城，借巨行星的阴影躲过太阳被击中时的爆发。',
    cost: '整个人类要搬进太空城；它只能防住针对太阳的那一种打击。',
  },
  {
    id: 'domain',
    name: '黑域计划',
    desc: '把太阳系内的光速降到极低，让太阳系变成一个外界看来无害、也永远出不去的「黑域」。',
    cost: '人类将永远被关在自己的星系里，与宇宙隔绝。',
  },
  {
    id: 'lightspeed',
    name: '光速飞船',
    desc: '造出能以光速航行的飞船，在打击到来之前离开太阳系。',
    cost: '飞船只能带走少数人；曲率航迹还会暴露自己。',
  },
]
