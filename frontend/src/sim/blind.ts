/**
 * 思想的盲区——纯逻辑。
 * 智子能看见一切说出口、写下来的东西，却看不见人脑里的念头。
 * 可一个只在心里的计划，也没有人能替你去做。
 * 三体人的思维是透明的：想到，就等于说出。
 */
export type Channel = 'say' | 'write' | 'think'
export type Mind = 'human' | 'trisolaran'

export interface Thought {
  id: number
  text: string
  channel: Channel
  /** 智子是否看见了内容 */
  seen: boolean
  /** 别人能否照着去做 */
  shared: boolean
}

export const CHANNELS: { id: Channel; name: string }[] = [
  { id: 'say', name: '说出口' },
  { id: 'write', name: '写下来' },
  { id: 'think', name: '只在心里想' },
]

export function record(id: number, text: string, channel: Channel, mind: Mind): Thought {
  const transparent = mind === 'trisolaran'
  const hidden = channel === 'think' && !transparent
  return { id, text: text.trim(), channel, seen: !hidden, shared: !hidden }
}

/** 智子看见的那一行。看不见内容时，它只看见一个人在面对墙壁出神 */
export function sophonLine(t: Thought, mind: Mind): string {
  if (t.seen) {
    const how = t.channel === 'say' ? '说' : t.channel === 'write' ? '写下' : '想'
    const who = mind === 'trisolaran' ? '它' : '他'
    return `${who}${how}：「${t.text}」`
  }
  return `他对着墙坐了 ${stareSeconds(t.text)} 秒，没有说话。`
}

export function stareSeconds(text: string): number {
  return Math.max(3, Math.round(text.length * 0.6))
}

export function tally(ts: Thought[]) {
  return {
    seen: ts.filter((t) => t.seen).length,
    hidden: ts.filter((t) => !t.seen).length,
    shared: ts.filter((t) => t.shared).length,
  }
}
