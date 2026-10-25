/**
 * 冥王星档案馆：纪元与展厅登记表。
 * 深时轴（DeepTimeRail）与页头（SectorHeader）都从这里读取每间展厅所在的纪元和它提出的问题。
 * 纪元只标到「纪元」一级，不写具体年份；跨越全部纪元的展厅用 'all'。
 */

export type EraId = 'pastoral' | 'common' | 'crisis' | 'deterrence' | 'broadcast' | 'bunker' | 'galaxy' | 'beyond'

export interface Era {
  id: EraId
  name: string
  /** 一句话：这个纪元意味着什么 */
  note: string
}

export const ERAS: Era[] = [
  { id: 'pastoral', name: '田园时代', note: '宇宙诞生，十个维度，光几乎没有速度的限制' },
  { id: 'common', name: '公元', note: '人类第一次向宇宙发出声音' },
  { id: 'crisis', name: '危机纪元', note: '三体舰队启程，四百年后抵达' },
  { id: 'deterrence', name: '威慑纪元', note: '黑暗森林威慑下的和平' },
  { id: 'broadcast', name: '广播纪元', note: '坐标被公之于众' },
  { id: 'bunker', name: '掩体纪元', note: '人类躲进巨行星的阴影' },
  { id: 'galaxy', name: '银河纪元', note: '离开太阳系的人类' },
  { id: 'beyond', name: '时间之外', note: '小宇宙与宇宙的终结' },
]

export interface Sector {
  path: string
  name: string
  era: EraId | 'all'
  /** 这间展厅提出的问题 */
  question: string
}

export const SECTORS: Sector[] = [
  { path: '/sector-c', name: '首页', era: 'beyond', question: '当文明只剩下档案，档案该记住什么？' },
  { path: '/sector-r', name: '红岸', era: 'common', question: '一个对人类失望的人，有权替人类回答宇宙吗？' },
  { path: '/sector-t', name: '三体摆', era: 'common', question: '在无法预测的世界里，文明该怎样活下去？' },
  { path: '/sector-v', name: '人列计算机', era: 'common', question: '三千万人组成的计算机，算出来的是答案，还是另一种秩序？' },
  { path: '/sector-a', name: '智子', era: 'crisis', question: '当科学本身被锁死，人类还剩下什么？' },
  { path: '/sector-boundary', name: '科学边界', era: 'common', question: '如果物理规律可以被操纵，「真理」还意味着什么？' },
  { path: '/sector-pdc', name: '行星防御', era: 'crisis', question: '面对四百年后才到的敌人，今天的人应该付出多少？' },
  { path: '/sector-ravine', name: '大低谷', era: 'crisis', question: '为了文明延续，一代人可以被牺牲吗？' },
  { path: '/sector-f', name: '面壁计划', era: 'crisis', question: '一个不能说出口的计划，还算计划吗？' },
  { path: '/sector-s', name: '阶梯计划', era: 'crisis', question: '只送一个大脑去见敌人，送去的是希望，还是爱？' },
  { path: '/sector-w', name: '水滴', era: 'crisis', question: '傲慢是在什么时候变成毁灭的？' },
  { path: '/sector-e', name: '黑暗森林', era: 'deterrence', question: '在无法确认善意的宇宙里，沉默是怯弱，还是唯一的道德？' },
  { path: '/sector-j', name: '掩体', era: 'bunker', question: '躲起来，是生存还是放弃？' },
  { path: '/sector-l', name: '曲率驱动', era: 'bunker', question: '人类为什么曾经禁止自己飞向光速？' },
  { path: '/sector-g', name: '四维碎片', era: 'deterrence', question: '如果墙只在它的维度里成立，什么才是「内部」？' },
  { path: '/sector-blind', name: '盲区', era: 'crisis', question: '唯一无法被看见的是思想，它是武器还是牢笼？' },
  { path: '/sector-b', name: '编年史', era: 'all', question: '历史是发生过的事，还是被记住的事？' },
  { path: '/sector-library', name: '原著阅读', era: 'all', question: '文字能比文明活得更久吗？' },
  { path: '/sector-p', name: '人物志', era: 'all', question: '在宇宙尺度上，一个人的选择还重要吗？' },
  { path: '/sector-d', name: '二向箔画廊', era: 'bunker', question: '一幅没有厚度的画，算不算一种永恒？' },
  { path: '/sector-tomb', name: '文明墓碑', era: 'bunker', question: '给后来者留言时，我们该说什么？' },
  { path: '/sector-human', name: '银河人类', era: 'galaxy', question: '离开地球的人，还是人类吗？' },
  { path: '/sector-u', name: '647 号小宇宙', era: 'beyond', question: '你的永恒和整个宇宙的重生，哪个更重？' },
  { path: '/sector-x', name: '归零者', era: 'beyond', question: '为了让宇宙重新开始，所有文明都该放下武器吗？' },
  { path: '/sector-m', name: '田园时代', era: 'pastoral', question: '如果宇宙曾是田园，我们是怎么走到黑暗森林的？' },
  { path: '/sector-guestbook', name: '宇宙留言簿', era: 'common', question: '在一座黑暗森林里，你会对宇宙说什么？' },
]

export function sectorByPath(path: string): Sector | undefined {
  return SECTORS.find((s) => s.path === path)
}

export function eraById(id: EraId): Era | undefined {
  return ERAS.find((e) => e.id === id)
}

/** 某纪元的第一间展厅（深时轴上点击纪元时前往） */
export function firstSectorOfEra(id: EraId): Sector | undefined {
  return SECTORS.find((s) => s.era === id && s.path !== '/sector-c')
}
