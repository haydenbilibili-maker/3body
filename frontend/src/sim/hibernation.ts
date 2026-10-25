/**
 * 冬眠者——纯逻辑。
 * 冬眠技术让人可以跳过岁月，一觉睡到未来。每次醒来世界都变了，认识的人一个个老去、死去。
 * 你可以带一个人和你一起睡；也可以在任何一次醒来后留下，在那个时代过完余生。
 */
export interface Station {
  era: string
  /** 距离上一站过去的年数 */
  gap: number
  world: string
  /** 醒来后的一个细节 */
  detail: string
  /** 这一站之后还能不能再睡 */
  canSleep: boolean
}

export const STATIONS: Station[] = [
  {
    era: '危机纪元 3 年',
    gap: 0,
    world: '三体危机刚刚开始。舰队四百年后才到，冬眠技术已经成熟，很多人决定把自己送到未来去看看结局。',
    detail: '你还年轻，你认识的人都还在。',
    canSleep: true,
  },
  {
    era: '危机纪元 205 年',
    gap: 202,
    world: '大低谷已经过去。人们住在地下城市里，衣服会发光，墙就是屏幕。两千艘恒星级战舰停在太空，人们相信胜利在望。',
    detail: '你带来的钱早就不能用了。年轻人听不懂你说的很多词。',
    canSleep: true,
  },
  {
    era: '威慑纪元 62 年',
    gap: 65,
    world: '末日战役之后，罗辑用黑暗森林威慑换来了六十多年的和平。社会变得温和、精致，人们正在选新的执剑人。',
    detail: '你醒来的冬眠中心里，大多数人都比你大两百多岁，又都和你一样年轻。',
    canSleep: true,
  },
  {
    era: '广播纪元 7 年',
    gap: 8,
    world: '引力波广播已经发出，太阳系的坐标被公之于众。没有人知道打击什么时候来。人们开始讨论躲到巨行星背后去。',
    detail: '你又一次成了旧时代的人。上一次醒来时认识的人，有的已经不在了。',
    canSleep: true,
  },
  {
    era: '掩体纪元 67 年',
    gap: 75,
    world: '人类住进了木星、土星、天王星、海王星背后的太空城。就在这一年，一张小纸条一样的二向箔落进了太阳系。',
    detail: '只有光速飞船能逃出去。你得到了一个上船的位置，可以在船上再睡一次。',
    canSleep: true,
  },
  {
    era: '一千八百九十万年后',
    gap: 18_900_000,
    world: '太阳系早已是一幅二维的画。你醒在银河里一颗陌生的恒星旁边；后来的人类说着你听不懂的语言，他们已经不记得地球。',
    detail: '这是最后一次醒来。再往后，就是宇宙自己的结局了。',
    canSleep: false,
  },
]

export interface Person {
  id: string
  name: string
  /** 醒着的时候还能活多少年 */
  remain: number
  /** 这个人自己也去冬眠，一直睡到第几站才醒（之后就留在那个时代） */
  sleepsUntil?: number
  /** 留给你的话 */
  note: string
}

export const PEOPLE: Person[] = [
  { id: 'mother', name: '母亲', remain: 28, note: '她在留给你的信里说：别回头看，往前走。' },
  { id: 'friend', name: '最好的朋友', remain: 52, sleepsUntil: 1, note: '他和你约好在危机纪元 205 年见面，然后留在了那个时代。' },
  { id: 'love', name: '爱人', remain: 58, note: '' },
]

/** 醒着度过的时间：每一站醒来之后、睡下之前，大约过一年 */
export const AWAKE_PER_STOP = 1

export function elapsed(index: number): number {
  return STATIONS.slice(0, index + 1).reduce((a, s) => a + s.gap, 0)
}

/** 第 index 站时，这个人还在不在 */
export function alive(p: Person, index: number, companion: string | null): boolean {
  if (p.id === companion) return true
  const from = p.sleepsUntil ?? 0
  if (index <= from) return true
  return elapsed(index) - elapsed(from) + (index - from) * AWAKE_PER_STOP < p.remain
}

export function formatYears(y: number): string {
  if (y >= 10000) return `${Math.round(y / 10000).toLocaleString('zh-CN')} 万年`
  return `${y} 年`
}

export function summary(index: number, companion: string | null) {
  const world = elapsed(index)
  const lived = index * AWAKE_PER_STOP
  const left = PEOPLE.filter((p) => !alive(p, index, companion)).map((p) => p.name)
  return { world, lived, left }
}
