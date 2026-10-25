/**
 * 「方寸之间」——平面国解谜的纯逻辑（不依赖 Vue / DOM，便于测试）。
 *
 * 玩家是一个三维存在，俯视一个二维世界：
 * - 在平面上（plane）只能沿地面走，墙不可穿过，视野被墙遮挡；
 * - 升维（lift）后离开平面，可以从任何格子「上方」经过，看见所有密室内部；
 * - 升维和在高处移动都会消耗「四维碎片」，碎片耗尽时被迫落回平面——落在墙里即失败。
 * 目标：取走所有物品（经过即取），回到出口并落在平面上。
 */

export type Tile = '#' | '.' | 'E'

export interface FlatLevel {
  id: string
  title: string
  /** 开场说明 */
  intro: string
  /** 通关后的一段话 */
  outro: string
  /** 地图：# 墙  . 地面  P 起点  i 物品  E 出口 */
  map: string[]
  /** 四维碎片的初始体积（能量） */
  fragment: number
  /** 最少消耗（由测试中的搜索验证），用于评星 */
  par: number
}

export interface Pos {
  r: number
  c: number
}

export type Status = 'playing' | 'won' | 'lost'

export interface FlatState {
  levelId: string
  tiles: Tile[][]
  items: string[]
  pos: Pos
  facing: Pos
  lifted: boolean
  fragment: number
  carried: number
  totalItems: number
  moves: number
  lifts: number
  status: Status
  message: string
  /** 曾经见过的格子（平面上的记忆） */
  seen: string[]
}

export const key = (p: Pos) => `${p.r},${p.c}`

export function parseLevel(level: FlatLevel): FlatState {
  const tiles: Tile[][] = []
  const items: string[] = []
  let start: Pos = { r: 0, c: 0 }
  level.map.forEach((row, r) => {
    tiles.push(
      [...row].map((ch, c) => {
        if (ch === 'P') start = { r, c }
        if (ch === 'i') items.push(`${r},${c}`)
        if (ch === '#') return '#'
        if (ch === 'E') return 'E'
        return '.'
      }),
    )
  })
  const state: FlatState = {
    levelId: level.id,
    tiles,
    items,
    pos: start,
    facing: { r: 0, c: 1 },
    lifted: false,
    fragment: level.fragment,
    carried: 0,
    totalItems: items.length,
    moves: 0,
    lifts: 0,
    status: 'playing',
    message: level.intro,
    seen: [],
  }
  state.seen = visibleCells(state)
  return state
}

const inBounds = (s: FlatState, p: Pos) => p.r >= 0 && p.c >= 0 && p.r < s.tiles.length && p.c < s.tiles[0].length
const isWall = (s: FlatState, p: Pos) => s.tiles[p.r]?.[p.c] === '#'

function clone(s: FlatState): FlatState {
  return { ...s, pos: { ...s.pos }, facing: { ...s.facing }, items: [...s.items], seen: [...s.seen] }
}

function pickUpAndCheck(s: FlatState) {
  const k = key(s.pos)
  const idx = s.items.indexOf(k)
  if (idx >= 0) {
    s.items.splice(idx, 1)
    s.carried += 1
    s.message = s.lifted
      ? '你从上方伸手，把它取了出来。墙完好无损。'
      : '取到了。'
  }
  if (!s.lifted && s.items.length === 0 && s.tiles[s.pos.r][s.pos.c] === 'E') {
    s.status = 'won'
    s.message = '回到出口。平面国里没有一面墙被打破。'
  }
}

function remember(s: FlatState) {
  const set = new Set(s.seen)
  for (const k of visibleCells(s)) set.add(k)
  s.seen = [...set]
}

export function move(state: FlatState, dr: number, dc: number): FlatState {
  if (state.status !== 'playing') return state
  const s = clone(state)
  s.facing = { r: dr, c: dc }
  const target = { r: s.pos.r + dr, c: s.pos.c + dc }
  if (!inBounds(s, target)) return s
  if (!s.lifted) {
    if (isWall(s, target)) {
      s.message = '墙。对平面上的你来说，这就是世界的尽头。'
      return s
    }
    s.pos = target
    s.moves += 1
    pickUpAndCheck(s)
    remember(s)
    return s
  }
  // 高处移动：可越过墙，但碎片在蒸发
  s.pos = target
  s.moves += 1
  s.fragment -= 1
  pickUpAndCheck(s)
  if (s.fragment <= 0) {
    s.fragment = 0
    s.lifted = false
    if (isWall(s, s.pos)) {
      s.status = 'lost'
      s.message = '碎片蒸发殆尽。你跌回平面——正落在一堵墙里。'
      return s
    }
    s.message = '碎片耗尽，你落回了平面。'
    pickUpAndCheck(s)
  }
  remember(s)
  return s
}

export function lift(state: FlatState): FlatState {
  if (state.status !== 'playing' || state.lifted) return state
  if (state.fragment <= 0) {
    return { ...state, message: '碎片已经耗尽，你再也离不开这个平面了。' }
  }
  const s = clone(state)
  s.lifted = true
  s.fragment -= 1
  s.lifts += 1
  s.message =
    s.fragment > 0 ? '你离开了平面。所有密室的内部同时展现在眼前。' : '你升了起来——但碎片在同一刻耗尽。'
  if (s.fragment <= 0) {
    s.lifted = false
  }
  remember(s)
  return s
}

export function drop(state: FlatState): FlatState {
  if (state.status !== 'playing' || !state.lifted) return state
  if (isWall(state, state.pos)) {
    return { ...state, message: '下方是墙，不能落在这里。' }
  }
  const s = clone(state)
  s.lifted = false
  s.message = '你落回平面。'
  pickUpAndCheck(s)
  remember(s)
  return s
}

/**
 * 平面上的视野：以视线（格子中心连线）判断，墙遮挡其后的格子，墙本身可见。
 * 升维时一切可见。
 */
export function visibleCells(s: FlatState, radius = 7): string[] {
  const out: string[] = []
  const rows = s.tiles.length
  const cols = s.tiles[0].length
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (s.lifted) {
        out.push(`${r},${c}`)
        continue
      }
      const dr = r - s.pos.r
      const dc = c - s.pos.c
      if (dr * dr + dc * dc > radius * radius) continue
      if (lineOfSight(s, s.pos, { r, c })) out.push(`${r},${c}`)
    }
  }
  return out
}

function lineOfSight(s: FlatState, a: Pos, b: Pos): boolean {
  const steps = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c)) * 3
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps
    const r = Math.round(a.r + (b.r - a.r) * t)
    const c = Math.round(a.c + (b.c - a.c) * t)
    if (r === b.r && c === b.c) return true
    if (r === a.r && c === a.c) continue
    if (s.tiles[r][c] === '#') return false
  }
  return true
}

export interface RetinaSample {
  kind: 'wall' | 'item' | 'exit' | 'void'
  /** 0 近 … 1 远 */
  depth: number
}

/**
 * 二维生物的「视网膜」：一条一维的线。从所在位置朝面向方向投射若干射线，
 * 记录每条射线最先碰到的东西与距离。
 */
export function castRetina(s: FlatState, rays = 48, fovDeg = 100, maxDist = 9): RetinaSample[] {
  const base = Math.atan2(s.facing.r, s.facing.c)
  const fov = (fovDeg * Math.PI) / 180
  const items = new Set(s.items)
  const out: RetinaSample[] = []
  for (let i = 0; i < rays; i += 1) {
    const a = base - fov / 2 + (fov * (i + 0.5)) / rays
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let hit: RetinaSample = { kind: 'void', depth: 1 }
    for (let d = 0.3; d < maxDist; d += 0.08) {
      const r = Math.round(s.pos.r + dy * d)
      const c = Math.round(s.pos.c + dx * d)
      if (r < 0 || c < 0 || r >= s.tiles.length || c >= s.tiles[0].length) break
      if (r === s.pos.r && c === s.pos.c) continue
      if (s.tiles[r][c] === '#') {
        hit = { kind: 'wall', depth: d / maxDist }
        break
      }
      if (items.has(`${r},${c}`)) {
        hit = { kind: 'item', depth: d / maxDist }
        break
      }
      if (s.tiles[r][c] === 'E') {
        hit = { kind: 'exit', depth: d / maxDist }
        break
      }
    }
    out.push(hit)
  }
  return out
}

export function stars(level: FlatLevel, s: FlatState): number {
  if (s.status !== 'won') return 0
  const used = level.fragment - s.fragment
  if (used <= level.par) return 3
  if (used <= level.par + 2) return 2
  return 1
}

export const FLAT_LEVELS: FlatLevel[] = [
  {
    id: 'sealed-room',
    title: '一、密室',
    intro: '你是一个三维的存在，正俯视着一个二维世界。对平面上的生物来说，一个闭合的方框就是绝对的密室。取出里面的东西，再走到出口。',
    outro: '你没有打破任何一面墙。对平面国来说，那件东西是凭空消失的。',
    map: [
      '#########',
      '#P......#',
      '#.......#',
      '#..###..#',
      '#..#i#..#',
      '#..###..#',
      '#......E#',
      '#########',
    ],
    fragment: 8,
    par: 5,
  },
  {
    id: 'two-vaults',
    title: '二、墙只在它的维度里成立',
    intro: '两间密室，出口也被封在墙里。平面上的人会说这是不可能完成的任务。',
    outro: '褚岩他们在四维碎片里看到了另一艘飞船的全部内部：每一个舱室，每一个人的内脏。你刚才看到的，就是那种感觉低一维的样子。',
    map: [
      '###########',
      '#P........#',
      '#.###.###.#',
      '#.#i#.#i#.#',
      '#.###.###.#',
      '#.........#',
      '#...###...#',
      '#...#E#...#',
      '#...###...#',
      '###########',
    ],
    fragment: 15,
    par: 12,
  },
  {
    id: 'dark-rooms',
    title: '三、看见的代价',
    intro: '四间密室，只有两间里有东西。在平面上，你只能看见墙；升起来，所有房间的内部同时展开——知识的代价是碎片。',
    outro: '「方寸之间，深不见底。」在高维里，「内部」这个词失去了意义。',
    map: [
      '#############',
      '#P..........#',
      '#.#####.###.#',
      '#.#..i#.#.#.#',
      '#.#####.###.#',
      '#...........#',
      '#.###.#####.#',
      '#.#i#.#...#.#',
      '#.###.#####.#',
      '#..........E#',
      '#############',
    ],
    fragment: 13,
    par: 10,
  },
  {
    id: 'surgery',
    title: '四、无创手术',
    intro: '最后一件：取出封在三重墙里的东西，不留任何伤口。碎片已经所剩无几。',
    outro: '把这一切再升高一维：三维世界的飞船、保险箱、心脏，都对四维空间里的人敞开。可是碎片正在蒸发——高维从来不是馈赠，而是一段正在退潮的过去。',
    map: [
      '###########',
      '#P........#',
      '#.#######.#',
      '#.#.....#.#',
      '#.#.###.#.#',
      '#.#.#i#.#.#',
      '#.#.###.#.#',
      '#.#.....#.#',
      '#.#######.#',
      '#........E#',
      '###########',
    ],
    fragment: 10,
    par: 9,
  },
]
