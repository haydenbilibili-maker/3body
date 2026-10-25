/**
 * 人列计算机 —— 用士兵方阵搭电路。纯逻辑。
 *
 * 每关给出固定的连线与若干「方阵」，玩家为每个方阵选择口令（门的类型），
 * 使电路的真值表与目标一致。四关从非门走到全加器。
 */

export type Gate = 'PASS' | 'NOT' | 'AND' | 'OR' | 'XOR'

export const GATE_INFO: Record<Gate, { name: string; rule: string; arity: 1 | 2 }> = {
  PASS: { name: '传令', rule: '看见前方举旗，就举旗', arity: 1 },
  NOT: { name: '非', rule: '看见前方举旗，就放下；没举，就举起', arity: 1 },
  AND: { name: '与', rule: '两边都举旗，才举旗', arity: 2 },
  OR: { name: '或', rule: '任意一边举旗，就举旗', arity: 2 },
  XOR: { name: '异或', rule: '两边恰好一边举旗，才举旗', arity: 2 },
}

export interface CNode {
  id: string
  inputs: string[]
  choices: Gate[]
  /** 图上的位置（0–100） */
  x: number
  y: number
}

export interface CLevel {
  id: string
  title: string
  intro: string
  inputs: string[]
  nodes: CNode[]
  outputs: { name: string; node: string }[]
  /** 目标：给定输入位，返回各输出位 */
  target: (bits: number[]) => number[]
}

export function applyGate(g: Gate, a: number, b = 0): number {
  switch (g) {
    case 'PASS':
      return a
    case 'NOT':
      return a ? 0 : 1
    case 'AND':
      return a && b ? 1 : 0
    case 'OR':
      return a || b ? 1 : 0
    case 'XOR':
      return a !== b ? 1 : 0
  }
}

export type Assignment = Record<string, Gate | undefined>

/** 计算一组输入下每个节点的值（节点按拓扑顺序给出） */
export function evaluate(level: CLevel, assign: Assignment, bits: number[]): Record<string, number | null> {
  const v: Record<string, number | null> = {}
  level.inputs.forEach((name, i) => (v[name] = bits[i]))
  for (const n of level.nodes) {
    const g = assign[n.id]
    const ins = n.inputs.map((id) => v[id])
    if (!g || ins.some((x) => x === null || x === undefined)) {
      v[n.id] = null
      continue
    }
    v[n.id] = applyGate(g, ins[0] as number, (ins[1] ?? 0) as number)
  }
  return v
}

export function allBits(n: number): number[][] {
  return Array.from({ length: 2 ** n }, (_, k) => Array.from({ length: n }, (_, i) => (k >> (n - 1 - i)) & 1))
}

export interface Row {
  bits: number[]
  expected: number[]
  got: (number | null)[]
  ok: boolean
}

export function truthTable(level: CLevel, assign: Assignment): Row[] {
  return allBits(level.inputs.length).map((bits) => {
    const v = evaluate(level, assign, bits)
    const expected = level.target(bits)
    const got = level.outputs.map((o) => v[o.node])
    return { bits, expected, got, ok: got.every((g, i) => g === expected[i]) }
  })
}

export function solved(level: CLevel, assign: Assignment): boolean {
  return truthTable(level, assign).every((r) => r.ok)
}

/** 枚举所有解（用于测试与提示） */
export function solutions(level: CLevel): Assignment[] {
  const out: Assignment[] = []
  const walk = (i: number, a: Assignment) => {
    if (i === level.nodes.length) {
      if (solved(level, a)) out.push({ ...a })
      return
    }
    for (const g of level.nodes[i].choices) walk(i + 1, { ...a, [level.nodes[i].id]: g })
  }
  walk(0, {})
  return out
}

export const LEVELS: CLevel[] = [
  {
    id: 'not',
    title: '一、非门',
    intro: '一名士兵盯着前方的人：前面举旗，他就放下；前面没举，他就举起。这就是最小的计算。',
    inputs: ['A'],
    nodes: [{ id: 'n1', inputs: ['A'], choices: ['PASS', 'NOT'], x: 55, y: 50 }],
    outputs: [{ name: '输出', node: 'n1' }],
    target: ([a]) => [a ? 0 : 1],
  },
  {
    id: 'xor',
    title: '二、用与、或、非拼出异或',
    intro: '手里只有「与」「或」「非」三种口令。四个方阵，拼出「两边恰好一边举旗」。',
    inputs: ['A', 'B'],
    nodes: [
      { id: 'n1', inputs: ['A', 'B'], choices: ['AND', 'OR'], x: 32, y: 28 },
      { id: 'n2', inputs: ['A', 'B'], choices: ['AND', 'OR'], x: 32, y: 72 },
      { id: 'n3', inputs: ['n2'], choices: ['PASS', 'NOT'], x: 55, y: 72 },
      { id: 'n4', inputs: ['n1', 'n3'], choices: ['AND', 'OR'], x: 78, y: 50 },
    ],
    outputs: [{ name: '输出', node: 'n4' }],
    target: ([a, b]) => [a !== b ? 1 : 0],
  },
  {
    id: 'half',
    title: '三、半加器',
    intro: '把两个一位数相加：一个方阵给出本位，一个方阵给出进位。',
    inputs: ['A', 'B'],
    nodes: [
      { id: 'n1', inputs: ['A', 'B'], choices: ['AND', 'OR', 'XOR'], x: 55, y: 30 },
      { id: 'n2', inputs: ['A', 'B'], choices: ['AND', 'OR', 'XOR'], x: 55, y: 70 },
    ],
    outputs: [
      { name: '本位', node: 'n1' },
      { name: '进位', node: 'n2' },
    ],
    target: ([a, b]) => [a ^ b, a & b],
  },
  {
    id: 'full',
    title: '四、全加器',
    intro: '再加上来自低位的进位。有了它，三千万人就能做任意位数的加法——也就能做任何计算。',
    inputs: ['A', 'B', '进位'],
    nodes: [
      { id: 'n1', inputs: ['A', 'B'], choices: ['AND', 'OR', 'XOR'], x: 30, y: 26 },
      { id: 'n2', inputs: ['n1', '进位'], choices: ['AND', 'OR', 'XOR'], x: 62, y: 22 },
      { id: 'n3', inputs: ['A', 'B'], choices: ['AND', 'OR', 'XOR'], x: 30, y: 74 },
      { id: 'n4', inputs: ['n1', '进位'], choices: ['AND', 'OR', 'XOR'], x: 50, y: 56 },
      { id: 'n5', inputs: ['n3', 'n4'], choices: ['AND', 'OR', 'XOR'], x: 74, y: 70 },
    ],
    outputs: [
      { name: '本位', node: 'n2' },
      { name: '进位', node: 'n5' },
    ],
    target: ([a, b, c]) => [a ^ b ^ c, (a & b) | (c & (a ^ b))],
  },
]
