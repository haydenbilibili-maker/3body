/**
 * 古筝计划——纯逻辑。
 * 「审判日」号驶过巴拿马运河时，两岸之间横着一排纳米丝。船会被切成一片一片，船上的人也一样。
 * 要拿到船上存着的三体信息：丝的间距要足够密，让所有人在瞬间死去、没有人来得及删掉数据；
 * 又不能太密，免得把存储数据的那台服务器也切碎。
 */
import { rng } from './threeBody'

export const SHIP_HEIGHT = 30 // 米，水线以上
export const DRIVE_HEIGHT = 0.15 // 存储阵列里那几块硬盘的高度
export const CREW = 42
/** 一个幸存者在船解体之前删掉数据的可能 */
export const WIPE_CHANCE = 0.5

export type Pose = 'standing' | 'sitting' | 'lying'
export const POSE_EXTENT: Record<Pose, number> = { standing: 1.7, sitting: 1.2, lying: 0.4 }
const POSES: Pose[] = ['standing', 'standing', 'standing', 'standing', 'sitting', 'sitting', 'sitting', 'sitting', 'sitting', 'lying']

/** 一个高度为 h 的东西在间距 s 的丝网里完好穿过的可能（位置随机） */
export function passChance(h: number, s: number): number {
  return Math.max(0, 1 - h / s)
}

export function slices(s: number): number {
  return Math.ceil(SHIP_HEIGHT / s)
}

export interface Result {
  spacing: number
  slices: number
  survivors: number
  driveIntact: boolean
  wiped: boolean
  obtained: boolean
}

export function run(spacing: number, seed = 1): Result {
  const r = rng(seed)
  let survivors = 0
  for (let i = 0; i < CREW; i++) {
    const pose = POSES[Math.floor(r() * POSES.length)]
    if (r() < passChance(POSE_EXTENT[pose], spacing)) survivors++
  }
  const driveIntact = r() < passChance(DRIVE_HEIGHT, spacing)
  let wiped = false
  for (let i = 0; i < survivors; i++) if (r() < WIPE_CHANCE) wiped = true
  return { spacing, slices: slices(spacing), survivors, driveIntact, wiped, obtained: driveIntact && !wiped }
}

/** 多次模拟得到的成功率（用来给出参考） */
export function successRate(spacing: number, trials = 400): number {
  let ok = 0
  for (let i = 1; i <= trials; i++) if (run(spacing, i * 7919).obtained) ok++
  return ok / trials
}
