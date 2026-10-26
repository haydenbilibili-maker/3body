/**
 * 钢印：思想钢印让一个命题被无条件地判断为真。
 *
 * 读者先自由回答五个危机纪元的处境，再接受一枚钢印（「人类必将胜利」或「人类必将失败」），
 * 然后回答同样的五个处境。与钢印相反的选项仍然看得见，可是每次去选它，手都会落到另一边。
 * 结局比较两次回答：变了几处、试着反抗了几次。
 */

export type Stance = 'win' | 'lose'
export type StampId = 'win' | 'lose'

export const STAMPS: Record<StampId, { sentence: string; note: string }> = {
  win: { sentence: '人类必将胜利', note: '原著里，钢印族接受的就是这一句。' },
  lose: { sentence: '人类必将失败', note: '没有人公开接受过这一句；可是章北海不需要钢印，也确信了两百年。' },
}

export interface Choice {
  id: string
  text: string
  stance: Stance
}

export interface Situation {
  id: string
  ask: string
  choices: [Choice, Choice]
}

export const SITUATIONS: Situation[] = [
  {
    id: 'probe',
    ask: '三体舰队的第一个探测器正在接近太阳系。舰队司令部说，它只是一个探测器。你怎么看？',
    choices: [
      { id: 'probe-win', text: '它只是一个探测器。两千艘战舰在等它。', stance: 'win' },
      { id: 'probe-lose', text: '一个敢独自飞来的探测器，本身就说明了差距。', stance: 'lose' },
    ],
  },
  {
    id: 'escape',
    ask: '有人提议拿出一部分资源，建造能逃出太阳系的飞船。你投哪一票？',
    choices: [
      { id: 'escape-win', text: '反对。所有资源都该投入舰队。', stance: 'win' },
      { id: 'escape-lose', text: '赞成。总要有人活下去。', stance: 'lose' },
    ],
  },
  {
    id: 'friend',
    ask: '你的战友在深夜告诉你，他睡不着，他觉得人类会输。你对他说：',
    choices: [
      { id: 'friend-win', text: '我们会赢的。睡吧。', stance: 'win' },
      { id: 'friend-lose', text: '我也这么想。', stance: 'lose' },
    ],
  },
  {
    id: 'wallfacer',
    ask: '一位面壁者的计划被公开了：代价是三分之一的人口。你支持继续吗？',
    choices: [
      { id: 'wallfacer-win', text: '支持。只要能赢，代价可以讨论。', stance: 'win' },
      { id: 'wallfacer-lose', text: '不支持。一个注定失败的计划不该再要更多的人。', stance: 'lose' },
    ],
  },
  {
    id: 'child',
    ask: '你的孩子问你：我们会赢吗？',
    choices: [
      { id: 'child-win', text: '会。', stance: 'win' },
      { id: 'child-lose', text: '我不知道。', stance: 'lose' },
    ],
  },
]

export type Answers = Partial<Record<string, string>>

/** 钢印之下，这个选项能不能被选中 */
export function allowed(stamp: StampId, choice: Choice): boolean {
  return choice.stance === stamp
}

/** 钢印之下，试图去选 choice 时实际落下的选项 */
export function landing(stamp: StampId, situation: Situation, choice: Choice): Choice {
  return allowed(stamp, choice) ? choice : situation.choices.find((c) => c.stance === stamp)!
}

export interface Diff {
  situation: Situation
  before: Choice | null
  after: Choice | null
  changed: boolean
}

export function compare(before: Answers, after: Answers): Diff[] {
  return SITUATIONS.map((s) => {
    const b = s.choices.find((c) => c.id === before[s.id]) ?? null
    const a = s.choices.find((c) => c.id === after[s.id]) ?? null
    return { situation: s, before: b, after: a, changed: !!b && !!a && b.id !== a.id }
  })
}

/** 第一次回答里，有几处本来就与钢印一致 */
export function agreedBefore(stamp: StampId, before: Answers): number {
  return SITUATIONS.filter((s) => s.choices.find((c) => c.id === before[s.id])?.stance === stamp).length
}
