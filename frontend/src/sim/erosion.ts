/**
 * 记忆的风化——纯逻辑。
 * 从越远的未来回看，没有刻在石头上的历史就磨损得越厉害；冥王星的石碑只刻得下几件事。
 */
export interface Vantage {
  id: number
  label: string
  /** 一句话：那时候还剩下什么 */
  note: string
  /** 未刻入石碑的文字被磨掉的比例 */
  level: number
}

export const VANTAGES: Vantage[] = [
  { id: 0, label: '此刻', note: '一切都还记得，只是太多了。', level: 0 },
  { id: 1, label: '一千年后', note: '纸张和硬盘开始失效，细节最先消失。', level: 0.3 },
  { id: 2, label: '一百万年后', note: '只剩零星的残片，没有人读得懂完整的句子。', level: 0.75 },
  { id: 3, label: '一千八百九十万年后', note: '只有刻在石头上的字还在。', level: 1 },
]

export const CARVE_SLOTS = 5

/** 确定性的伪随机：同一段文字、同一个位置，每次磨损的结果都一样 */
function hash(seed: number, i: number): number {
  let h = (seed * 2654435761) ^ (i * 40503)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const KEEP = /[\s，。、；：！？「」『』（）《》·—…,.;:!?()]/

/** 把文字磨损到 level（0–1）。标点和空白保留，像碑上残存的刻痕。 */
export function erode(text: string, level: number, seed: number): string {
  if (level <= 0) return text
  if (level >= 1) return ''
  return Array.from(text)
    .map((ch, i) => (KEEP.test(ch) || hash(seed, i) >= level ? ch : '□'))
    .join('')
}

export function toggleCarve(carved: number[], id: number): number[] {
  if (carved.includes(id)) return carved.filter((x) => x !== id)
  if (carved.length >= CARVE_SLOTS) return carved
  return [...carved, id]
}
