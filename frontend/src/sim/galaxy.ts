/**
 * 银河人类——纯逻辑。
 * 你在一艘离开太阳系、再也回不去的战舰上。四个决定，每一个都在「活下去」和「还像地球人」之间取舍。
 */
export interface Option {
  text: string
  /** 活下去的可能 */
  survive: number
  /** 与地球上那种人性的联系 */
  bond: number
  after: string
  /** 不可逆、需要按住确认的选择 */
  grave?: boolean
}
export interface Step {
  scene: string
  options: Option[]
}

export const STEPS: Step[] = [
  {
    scene: '末日战役之后，你所在的战舰和另外几艘一起逃出了太阳系。消息传来：地球的舰队已经全军覆没，不会有人来接你们了。',
    options: [
      { text: '继续向深空前进', survive: 1, bond: -1, after: '你们关掉了来自地球的频道，船头对准一颗几十光年外的恒星。' },
      { text: '掉头，返回太阳系', survive: -2, bond: 1, after: '你们决定回去，和地球上的人一起面对结局，哪怕那意味着审判。' },
    ],
  },
  {
    scene: '清点之后才发现：所有战舰的燃料和配件加在一起，只够一艘船抵达最近的恒星。每艘船上的人都在算同一笔账，也都知道别人在算。',
    options: [
      { text: '先开火，夺取别的船上的物资', survive: 2, bond: -2, grave: true, after: '你们比别人早了几秒。那几秒决定了谁会活下去。' },
      { text: '等，提议所有船平分物资一起慢慢走', survive: -2, bond: 2, after: '你们发出了提议。在回复到来之前，别的船已经开火了。' },
      { text: '把自己的物资让出去', survive: -3, bond: 2, after: '你们把燃料输给了另一艘船，然后看着它的尾焰远去。' },
    ],
  },
  {
    scene: '活下来的人要在这艘船上度过一生，他们的孩子也是。船上需要新的规则。',
    options: [
      { text: '军事化管理，一切服从生存', survive: 1, bond: -1, after: '船上没有了选举，也没有了争吵。每个人都知道自己该做什么。' },
      { text: '保留选举和法律，哪怕效率更低', survive: 0, bond: 1, after: '船上的议会吵个不停，可每个决定都有人投过票。' },
    ],
  },
  {
    scene: '很多年后，地球发来请求：返航，为当年的事接受人类的审判。',
    options: [
      { text: '回去，接受审判', survive: -1, bond: 2, after: '你们调转船头。回去的路比来时更长。' },
      { text: '不回去，这里就是我们的家', survive: 1, bond: -1, after: '你们回复：我们已经不是你们的一部分了。' },
    ],
  },
]

export interface Outcome {
  alive: boolean
  title: string
  text: string
}

export function score(choices: number[]) {
  return choices.reduce(
    (a, c, i) => ({ survive: a.survive + STEPS[i].options[c].survive, bond: a.bond + STEPS[i].options[c].bond }),
    { survive: 0, bond: 0 },
  )
}

export function outcome(choices: number[]): Outcome {
  const { survive, bond } = score(choices)
  if (survive < 0) {
    return {
      alive: false,
      title: '没有抵达',
      text: '你们没能活到下一颗恒星。在地球人的记忆里，你们一直是人类——只是再也没有人记得你们。',
    }
  }
  if (bond <= -2) {
    return {
      alive: true,
      title: '新的人类',
      text: '你们活了下来，在一颗陌生的行星上建起了世界。地球上的人说，你们已经不是人类了。可二向箔落下之后，宇宙里的人类，只剩下你们这样的人。',
    }
  }
  return {
    alive: true,
    title: '带着地球走',
    text: '你们活了下来，也把一些地球上的东西带了出来：投票、法律、对死者的愧疚。你们的孩子会问，这些东西在星际间有什么用。',
  }
}
