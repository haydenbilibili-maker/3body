/**
 * 647 号小宇宙「五公斤」——纯逻辑。
 *
 * 流程：田园（照料生态）→ 广播（归零者请求归还质量）→ 抉择
 *   ├─ 归还：从小宇宙里挑出最多 5 公斤留给下一个宇宙，其余全部归还 → 重启结局
 *   └─ 留下：保住小宇宙里的永恒 → 热寂结局
 */

export type Phase = 'garden' | 'broadcast' | 'choose' | 'reboot' | 'eternity'

export interface Relic {
  id: string
  name: string
  /** 千克 */
  mass: number
  desc: string
  /** 选中后在新宇宙里留下的一句话 */
  legacy: string
  /** 不可选择（用于展示「你无法留下自己」） */
  locked?: boolean
}

/** 留给下一个宇宙的质量上限 */
export const MASS_LIMIT = 5

/** 小宇宙的总质量（用于展示「归还了多少」），单位千克 */
export const UNIVERSE_MASS = 186_000

export const RELICS: Relic[] = [
  {
    id: 'bottle',
    name: '漂流瓶',
    mass: 0.4,
    desc: '装着你写给新宇宙的话。它是唯一一件注定会被读到的东西——如果新宇宙里还有读者。',
    legacy: '一只漂流瓶，里面有一个旧宇宙的人写下的话。',
  },
  {
    id: 'ecosphere',
    name: '生态球',
    mass: 2.6,
    desc: '一个封闭的小世界：水、藻类、一条小鱼。不需要照料，它会自己转下去。',
    legacy: '一个仍在转动的生态球——旧宇宙里最后一条鱼在里面游着。',
  },
  {
    id: 'book',
    name: '《时间之外的往事》',
    mass: 1.1,
    desc: '一本写给不存在的读者的书：关于一个文明怎样走完它的路，以及它做错了什么。',
    legacy: '一本书，讲一个文明怎样走完它的路。',
  },
  {
    id: 'seeds',
    name: '种子库',
    mass: 1.5,
    desc: '三百种植物的种子。新宇宙的物理规律未必允许它们发芽。',
    legacy: '三百种不知能否发芽的种子。',
  },
  {
    id: 'soil',
    name: '一捧地球的土',
    mass: 0.8,
    desc: '它来自一个已经变成二维的星球。这是太阳系仅存的三维物质之一。',
    legacy: '一捧土，来自一颗已经被压成画的星球。',
  },
  {
    id: 'radio',
    name: '收音机',
    mass: 1.7,
    desc: '它收到了归零者的广播。带上它，新宇宙的第一个声音也许会被听见。',
    legacy: '一台收音机，调在一个旧宇宙的频率上。',
  },
  {
    id: 'starmap',
    name: '太阳系星图',
    mass: 0.2,
    desc: '一张坐标。在旧宇宙里，暴露坐标意味着死亡。在新宇宙里呢？',
    legacy: '一张坐标——一个不再存在的家的位置。',
  },
  {
    id: 'self',
    name: '你自己',
    mass: 58,
    desc: '远超上限。小宇宙里唯一不能被留下的，是留下它们的人。',
    legacy: '',
    locked: true,
  },
]

export function relicById(id: string): Relic | undefined {
  return RELICS.find((r) => r.id === id)
}

export function totalMass(selected: string[]): number {
  const sum = selected.reduce((acc, id) => acc + (relicById(id)?.mass ?? 0), 0)
  return Math.round(sum * 10) / 10
}

/** 加入后是否仍不超过上限 */
export function canAdd(selected: string[], id: string): boolean {
  const r = relicById(id)
  if (!r || r.locked || selected.includes(id)) return false
  return totalMass([...selected, id]) <= MASS_LIMIT + 1e-9
}

export function toggleRelic(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id)
  return canAdd(selected, id) ? [...selected, id] : selected
}

/** 归还的质量（千克）：小宇宙全部质量减去留下的部分 */
export function returnedMass(selected: string[]): number {
  return UNIVERSE_MASS - totalMass(selected)
}

/** 结局文本：根据留下的东西拼出新宇宙收到的「遗产」 */
export function legacyLines(selected: string[]): string[] {
  return RELICS.filter((r) => selected.includes(r.id) && !r.locked).map((r) => r.legacy)
}

/** 永恒结局里，小宇宙外的大宇宙随时间推移的状态描述 */
export function outsideAt(years: number): string {
  if (years < 1e3) return '大宇宙：仍在膨胀。星系彼此远去。'
  if (years < 1e9) return '大宇宙：恒星一颗接一颗熄灭。'
  if (years < 1e14) return '大宇宙：只剩下黑洞与冷却的余烬。'
  if (years < 1e40) return '大宇宙：质子开始衰变。物质本身在消失。'
  return '大宇宙：一片均匀的、永不再变化的黑暗。'
}

export function formatYears(years: number): string {
  if (years < 1e4) return `${Math.floor(years).toLocaleString('zh-CN')} 年`
  const exp = Math.floor(Math.log10(years))
  return `10^${exp} 年`
}
