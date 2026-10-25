/**
 * 人物记得你：访客在相关展厅里留下的选择（读者的档案），作为场景的 visitor 传给后端。
 * 每位人物只「听说」和他有关的那几间展厅。
 */
import { SECTORS } from './sectors'

const RELATED: Record<string, string[]> = {
  罗辑: ['/sector-sword', '/sector-e', '/sector-f'],
  叶文洁: ['/sector-r', '/sector-guzheng'],
  章北海: ['/sector-ns', '/sector-stamp'],
  程心: ['/sector-sword', '/sector-tale', '/sector-j'],
  '托马斯·维德': ['/sector-l', '/sector-s'],
  史强: ['/sector-guzheng', '/sector-v'],
  汪淼: ['/sector-boundary', '/sector-a'],
  丁仪: ['/sector-w', '/sector-boundary'],
  云天明: ['/sector-s', '/sector-tale'],
  '智子 (仿生人)': ['/sector-a', '/sector-blind'],
}

/** 访客与这位人物有关的经历，一句话；没有就返回 undefined */
export function visitorFor(figure: string, answers: Record<string, { text: string } | undefined>): string | undefined {
  const paths = RELATED[figure] ?? []
  const lines = paths
    .map((p) => {
      const a = answers[p]
      if (!a) return null
      const room = SECTORS.find((s) => s.path === p)?.name ?? p
      return `在「${room}」里，${a.text}`
    })
    .filter(Boolean) as string[]
  return lines.length ? lines.join('；').slice(0, 580) : undefined
}

/** 通用的追问：跟在人物上一句话后面 */
export const FOLLOW_UPS = ['为什么？', '然后呢？', '你在怕什么？', '如果换作是你呢？', '你真的这么想吗？']

/** 根据人物刚说的话挑两三个追问：问句之后适合「为什么」，沉默之后适合「你在怕什么」 */
export function followUpsFor(lastReply: string, asked: Set<string>): string[] {
  const picks: string[] = []
  if (/[？?]\s*$/.test(lastReply.trim())) picks.push('如果换作是你呢？')
  if (/沉默|没有说话|停了|很久/.test(lastReply)) picks.push('你在怕什么？')
  picks.push('为什么？', '然后呢？', '你真的这么想吗？')
  return [...new Set(picks)].filter((q) => !asked.has(q)).slice(0, 3)
}
