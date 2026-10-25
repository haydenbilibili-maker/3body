/**
 * 世界线：读者在关键展厅里的选择，与原著的走向比较。
 *
 * 七个分岔点按时间顺序排列。每个分岔点从「读者的档案」里那间展厅留下的回答推断读者选了哪一边
 * （回答的文字由各展厅写入，见 data/answers.ts），不需要各展厅另存一份状态。
 * 与原著不同的选择会改变后面展厅的前提：notesFor 给出某间展厅此刻应该提醒读者的那一句。
 */

export type ForkId = 'reply' | 'guzheng' | 'staircase' | 'ns' | 'sword' | 'mini' | 'return'

export interface ForkOption {
  /** 在世界线图上的短标签 */
  label: string
  /** 选了这一边之后，世界线变成什么样（与原著相同时不显示） */
  consequence: string
}

export interface Fork {
  id: ForkId
  path: string
  room: string
  era: string
  canon: string
  options: Record<string, ForkOption>
  /** 从回答文字推断读者选了哪一边；推断不出返回 null */
  read: (text: string) => string | null
}

export const FORKS: Fork[] = [
  {
    id: 'reply',
    path: '/sector-r',
    room: '红岸',
    era: '公元',
    canon: 'reply',
    options: {
      reply: { label: '回答了', consequence: '' },
      silent: {
        label: '沉默',
        consequence: '三体世界没有收到地球的回答。在你的世界线里，危机纪元没有开始。',
      },
    },
    read: (t) => (t.includes('回答了三体世界') ? 'reply' : t.includes('保持了沉默') ? 'silent' : null),
  },
  {
    id: 'guzheng',
    path: '/sector-guzheng',
    room: '古筝计划',
    era: '公元',
    canon: 'executed',
    options: {
      executed: { label: '切开了', consequence: '' },
      spared: {
        label: '没有切',
        consequence: '审判日号上的三体信息没有被拿到。人类不知道智子已经抵达，也不知道舰队要四百年后才到。',
      },
    },
    read: (t) => (t.startsWith('没有执行') ? 'spared' : t.startsWith('执行了') ? 'executed' : null),
  },
  {
    id: 'staircase',
    path: '/sector-s',
    room: '阶梯计划',
    era: '危机纪元',
    canon: 'sent',
    options: {
      sent: { label: '送出了', consequence: '' },
      lost: {
        label: '偏航',
        consequence: '云天明的大脑没有被三体舰队截获。后来不会有人回到地球讲那三个童话。',
      },
    },
    read: (t) => (t.includes('送上了') ? 'sent' : t.includes('偏离') ? 'lost' : null),
  },
  {
    id: 'ns',
    path: '/sector-ns',
    room: '自然选择号',
    era: '危机纪元',
    canon: 'fled',
    options: {
      fled: { label: '前进四', consequence: '' },
      stayed: {
        label: '回编队',
        consequence: '末日战役之后，没有一艘恒星级战舰离开太阳系。「蓝色空间」号与「星舰地球」都不会存在。',
      },
    },
    read: (t) => (t.includes('前进四') ? 'fled' : t.includes('回到了舰队') ? 'stayed' : null),
  },
  {
    id: 'sword',
    path: '/sector-sword',
    room: '执剑人',
    era: '威慑纪元',
    canon: 'let-go',
    options: {
      'let-go': { label: '没有按', consequence: '' },
      held: {
        label: '威慑还在',
        consequence: '三体世界不敢动手，威慑纪元延续下去。广播纪元与掩体纪元在你的世界线里还没有到来。',
      },
      pressed: {
        label: '按下了',
        consequence: '是你亲手发出了引力波广播，而不是远方的「万有引力」号。两个世界的坐标同时暴露。',
      },
    },
    read: (t) =>
      t.includes('威慑还在') ? 'held' : t.includes('你按下了') ? 'pressed' : t.includes('你没有按') ? 'let-go' : null,
  },
  {
    id: 'mini',
    path: '/sector-u',
    room: '647 号小宇宙',
    era: '时间之外',
    canon: 'returned',
    options: {
      returned: { label: '归还', consequence: '' },
      stayed: {
        label: '留下',
        consequence: '你留在了小宇宙里。大宇宙少了你带走的那份质量。',
      },
    },
    read: (t) => (t.startsWith('归还了质量') ? 'returned' : t.startsWith('留在了') ? 'stayed' : null),
  },
  {
    id: 'return',
    path: '/sector-x',
    room: '归零者',
    era: '时间之外',
    canon: 'returned',
    options: {
      returned: { label: '归还', consequence: '' },
      kept: {
        label: '没有归还',
        consequence: '归零者的广播没有得到你的回应。宇宙能不能重新开始，少了你这一份。',
      },
    },
    read: (t) => (t.startsWith('没有归还') ? 'kept' : t.startsWith('归还') ? 'returned' : null),
  },
]

export interface ForkState {
  fork: Fork
  /** 读者的选择；还没去过或推断不出为 null */
  mine: string | null
  diverged: boolean
}

export function readWorldline(answers: Record<string, { text: string } | undefined>): ForkState[] {
  return FORKS.map((fork) => {
    const text = answers[fork.path]?.text
    const mine = text ? fork.read(text) : null
    return { fork, mine, diverged: mine !== null && mine !== fork.canon }
  })
}

/** 展厅所在的纪元，用来判断一处分岔会不会影响它 */
const LATER_THAN_COMMON = new Set(['crisis', 'deterrence', 'broadcast', 'bunker', 'galaxy'])

/** 某间展厅此刻要提醒读者的世界线（最多一句；最早的分岔优先） */
export function notesFor(path: string, era: string | undefined, states: ForkState[]): string | null {
  const s = Object.fromEntries(states.map((x) => [x.fork.id, x.mine])) as Record<ForkId, string | null>
  if (s.reply === 'silent' && era && LATER_THAN_COMMON.has(era)) {
    return '在你的世界线里，红岸保持了沉默，三体世界没有收到回答。这间展厅属于另一条世界线：原著的那一条。'
  }
  if (s.guzheng === 'spared' && ['/sector-a', '/sector-f', '/sector-blind', '/sector-pdc'].includes(path)) {
    return '在你的世界线里，古筝计划没有执行。人类直到很久以后才知道智子的存在，这里的一切准备都晚了一步。'
  }
  if (s.staircase === 'lost' && path === '/sector-tale') {
    return '在你的世界线里，阶梯飞船偏离了航线。这三个童话在你的世界线里没有人讲过。'
  }
  if (s.ns === 'stayed' && ['/sector-human', '/sector-g'].includes(path)) {
    return '在你的世界线里，自然选择号回到了编队。末日战役之后没有一艘战舰逃出去，这间展厅里的船并不存在。'
  }
  if (s.sword === 'held' && ['/sector-j', '/sector-d', '/sector-l', '/sector-tomb', '/sector-tale'].includes(path)) {
    return '在你的世界线里，威慑还在，广播纪元没有到来。这间展厅是原著里威慑失效之后的世界。'
  }
  if (s.sword === 'pressed' && ['/sector-j', '/sector-d', '/sector-tale'].includes(path)) {
    return '在你的世界线里，按下广播开关的是你自己。接下来的掩体与二向箔，是你那一按的后果。'
  }
  if (s.mini === 'stayed' && path === '/sector-x') {
    return '在你的世界线里，你还留在 647 号小宇宙里。归零者的广播里，也有一份是在等你。'
  }
  return null
}

export function summarize(states: ForkState[]): { visited: number; diverged: number; first: ForkState | null } {
  const visited = states.filter((x) => x.mine !== null).length
  const div = states.filter((x) => x.diverged)
  return { visited, diverged: div.length, first: div[0] ?? null }
}
