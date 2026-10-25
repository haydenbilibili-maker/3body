/**
 * 三体摆：在乱纪元与恒纪元之间决定浸泡还是脱水。纯逻辑。
 *
 * - 浸泡（hydrated）：文明在恒纪元里发展；遇上三日凌空或严寒就会毁灭。
 * - 脱水：熬过任何纪元，但时间白白流走。
 * - 切换需要两天才能完成（脱水与浸泡复苏都需要时间），所以只能依靠对未来的预测。
 * - 发展到信息时代即通关：这个文明终于明白，三体问题没有解。
 */
import type { Env } from './threeBody'

export const AGES = ['农耕时代', '青铜时代', '铁器时代', '蒸汽时代', '电气时代', '原子时代', '信息时代']
export const GROWTH_PER_DAY = 2.5
export const SWITCH_DAYS = 2
export const FIRST_CIV = 184

export interface CivState {
  civ: number
  progress: number
  hydrated: boolean
  /** 正在进行中的切换：目标状态与剩余天数 */
  pending: { to: boolean; days: number } | null
  day: number
  fallen: { civ: number; age: string; cause: Env }[]
  won: boolean
}

export function createCiv(): CivState {
  return { civ: FIRST_CIV, progress: 0, hydrated: true, pending: null, day: 0, fallen: [], won: false }
}

export function ageOf(progress: number): string {
  const i = Math.min(AGES.length - 1, Math.floor((progress / 100) * (AGES.length - 1)))
  return AGES[i]
}

/** 下令切换（浸泡 ↔ 脱水）。已在切换中则改变目标；与当前状态相同则取消切换。 */
export function order(s: CivState, hydrate: boolean): CivState {
  if (s.won) return s
  if (hydrate === s.hydrated) return { ...s, pending: null }
  return { ...s, pending: { to: hydrate, days: SWITCH_DAYS } }
}

/** 过一天：先完成到期的切换，再按当天纪元结算 */
export function liveDay(s: CivState, env: Env): CivState {
  if (s.won) return s
  const next: CivState = { ...s, fallen: [...s.fallen], day: s.day + 1 }
  if (next.pending) {
    const days = next.pending.days - 1
    if (days <= 0) {
      next.hydrated = next.pending.to
      next.pending = null
    } else {
      next.pending = { ...next.pending, days }
    }
  }
  if (!next.hydrated) return next
  if (env === 'stable') {
    next.progress = Math.min(100, next.progress + GROWTH_PER_DAY)
    if (next.progress >= 100) next.won = true
    return next
  }
  // 浸泡状态遭遇乱纪元：文明毁灭，下一个文明从头开始
  next.fallen.push({ civ: next.civ, age: ageOf(next.progress), cause: env })
  next.civ += 1
  next.progress = 0
  next.hydrated = false
  next.pending = null
  return next
}
