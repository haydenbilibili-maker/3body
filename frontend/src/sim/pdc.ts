/**
 * 行星防御理事会「四百年预算」——纯逻辑。
 *
 * 十届理事会，每届二十年，从危机纪元元年到末日战役。每届决定多少资源投向太空军备、多少留给活着的人。
 * - 军备越多，舰队越大，但这一代人越苦；民心跌破底线会引发「大低谷」：人口锐减、建设停顿两届。
 * - 大低谷之后迎来技术复兴（原著中的走向），建造效率翻倍。
 * - 最后一届结束时，末日战役：一个水滴摧毁了几乎整支舰队——无论它有多大。
 */

export const TERMS = 10
export const YEARS_PER_TERM = 20

export interface Term {
  /** 本届起始年份（危机纪元） */
  year: number
  defense: number
  population: number
  morale: number
  ships: number
  /** 这一代人的处境 */
  life: string
  ravine: boolean
}

export interface PdcState {
  term: number
  population: number
  morale: number
  fleet: number
  tech: number
  ravineUsed: boolean
  stalled: number
  history: Term[]
}

export function createPdc(): PdcState {
  return { term: 0, population: 100, morale: 70, fleet: 0, tech: 1, ravineUsed: false, stalled: 0, history: [] }
}

/** 这一代人的生活，按军备比例描述 */
export function lifeOf(defense: number, ravine: boolean): string {
  if (ravine) return '大低谷。地表农业崩溃，配给一减再减，人口在二十年里少了一半。'
  if (defense >= 75) return '一切为了舰队。配给制，停电，孩子们在防空洞里上学。'
  if (defense >= 55) return '紧日子。城市灯光减半，大多数人把工资的一大半交给了天上。'
  if (defense >= 35) return '寻常的日子。人们一边纳税造船，一边照常恋爱、生孩子。'
  return '这一代人过得很好。他们几乎忘了四百年后还有一支舰队要来。'
}

/** 推进一届。defense：0–100，投向军备的百分比 */
export function runTerm(s: PdcState, defense: number): PdcState {
  if (s.term >= TERMS) return s
  const d = Math.max(0, Math.min(100, defense))
  const next: PdcState = { ...s, history: [...s.history] }
  let ravine = false

  next.morale = Math.max(0, Math.min(100, next.morale + (50 - d) * 0.7))
  if (next.morale < 20 && !next.ravineUsed) {
    ravine = true
    next.ravineUsed = true
    next.population = Math.round(next.population * 0.5)
    next.morale = 45
    next.stalled = 2
    next.tech = next.tech * 2 // 大低谷后的技术复兴
  } else {
    next.population = Math.round(next.population * (1 + (60 - d) / 600))
  }

  if (next.stalled > 0) {
    next.stalled -= 1
  } else {
    // 舰队：投入 × 人口 × 技术，随届数累积（以「艘恒星级战舰」计）
    next.fleet += Math.round(d * (next.population / 100) * next.tech * 2)
  }
  next.tech = next.tech * 1.12

  next.history.push({
    year: s.term * YEARS_PER_TERM + 1,
    defense: d,
    population: next.population,
    morale: Math.round(next.morale),
    ships: next.fleet,
    life: lifeOf(d, ravine),
    ravine,
  })
  next.term += 1
  return next
}

/** 末日战役：一个水滴对整支舰队。逃出去的永远只有两艘。 */
export function doomsday(fleet: number): { destroyed: number; escaped: number } {
  const escaped = fleet >= 2 ? 2 : fleet
  return { destroyed: fleet - escaped, escaped }
}

/** 为舰队吃过苦的人：军备比例超过一半的届，人口 × 年数（以「亿人·年」的相对值） */
export function hardship(history: Term[]): number {
  return history.reduce((n, t) => n + (t.defense > 50 || t.ravine ? t.population * YEARS_PER_TERM : 0), 0)
}
