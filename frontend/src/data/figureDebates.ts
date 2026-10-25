/**
 * 对谈：两位人物在同一个问题上交锋，访客坐在中间。
 * 每场对谈两轮，每轮两人各说一次；访客可以在两轮之间插一句话，最后判断谁说服了自己。
 * 人物各自用自己的场景（data/figureScenes.ts）；没有后端时，用这里写好的台词兜底。台词为本项目创作。
 */

export interface Debate {
  id: string
  topic: string
  a: { figure: string; scene: string }
  b: { figure: string; scene: string }
  /** 主持人（档案馆）的开场 */
  opener: string
  /** 没有后端时：两轮、每轮 A、B 各一句 */
  offline: [string, string, string, string]
}

export const DEBATES: Debate[] = [
  {
    id: 'lightspeed',
    topic: '人类该不该造光速飞船？',
    a: { figure: '程心', scene: 'cheng-pluto' },
    b: { figure: '托马斯·维德', scene: 'wade-halo' },
    opener: '掩体纪元。一个人想让人类能够逃走，另一个人有权让他停下。',
    offline: [
      '（她看着窗外。）光速飞船的航迹会让太阳系暴露得更早，而且只能带走极少数人。我不能为少数人赌上所有人。',
      '（他没有抬头。）你说的「所有人」，二向箔来的那天一个也剩不下。能走的人走了，人类就还在。',
      '如果人类为了活下去，变成一群可以互相开火的人，那活下去的还是人类吗？',
      '失去人性，失去很多；失去兽性，失去一切。你会让我停下的，我知道。我只是想让你记住你选了什么。',
    ],
  },
  {
    id: 'goodwill',
    topic: '宇宙里能不能有善意？',
    a: { figure: '叶文洁', scene: 'ye-grave' },
    b: { figure: '罗辑', scene: 'luoji-sword' },
    opener: '一个把宇宙社会学交给别人的人，和一个靠它守了几十年和平的人。',
    offline: [
      '（她把花放好。）也许有。可你没法确认对方的善意，对方也没法确认你的。只要这一点不变，善意就没有用。',
      '（他看着开关。）我守在这里，就是因为没有善意。威慑不需要善意，它只需要对方相信我会按。',
      '那你守住的是和平，还是一种更长的恐惧？',
      '我不知道。也许这两样东西从来就是同一样东西。',
    ],
  },
  {
    id: 'victory',
    topic: '人类会赢吗？',
    a: { figure: '章北海', scene: 'zhang-navy' },
    b: { figure: '史强', scene: 'shi-guzheng' },
    opener: '一个从来不说出自己判断的军人，和一个从来不怕说出自己判断的警察。',
    offline: [
      '（他站得笔直。）技术的差距是四百年。四百年，足够让一切勇气都变成笑话。',
      '（他把烟按灭。）虫子跟人的差距多大？人用尽了办法，虫子到现在还活得好好的。',
      '虫子活下来，是因为人没有真正想消灭它们。三体人不一样。',
      '那就别跟它硬碰。能活下去的法子，从来不止一种。',
    ],
  },
]

export function debateById(id: string): Debate | undefined {
  return DEBATES.find((d) => d.id === id)
}
