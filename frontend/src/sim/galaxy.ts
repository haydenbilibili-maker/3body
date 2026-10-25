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

/**
 * 人类演化树：六个纪元的人类，从地球摇篮到散落银河（恢复自旧版「演化树」，文字重写）。
 * 读者这一支从「星舰人类」分出去：末日战役之后逃出太阳系的那几艘船。
 */
export interface HumanNode {
  era: string
  title: string
  text: string
  tech: string
  culture: string
  quote: string
}

export const HUMAN_TREE: HumanNode[] = [
  {
    era: '公元',
    title: '地球人类',
    text: '生活在地球摇篮里的人类，有完整的爱与道德，也有完整的愚蠢。还没有经历技术爆炸，社会稳定，也脆弱。',
    tech: '化学火箭 · 信息技术',
    culture: '民族国家 · 普世价值',
    quote: '给岁月以文明，而不是给文明以岁月。',
  },
  {
    era: '危机纪元',
    title: '黄金时代的人类',
    text: '熬过大低谷之后，技术复兴，人类造出了两千艘恒星级战舰。他们自信到傲慢，认为三体不足为惧。',
    tech: '可控核聚变 · 恒星级战舰',
    culture: '技术乐观主义',
    quote: '他们只是虫子。',
  },
  {
    era: '威慑纪元',
    title: '威慑下的人类',
    text: '六十多年的和平让人变得温和、精致。人们失去了侵略性，也不再愿意把开关交给一个会按下去的人。',
    tech: '引力波威慑 · 强相互作用力材料',
    culture: '极致的人道主义',
    quote: '把枪口对准自己，才是真正的威慑。',
  },
  {
    era: '广播纪元',
    title: '星舰人类',
    text: '「蓝色空间」号与「万有引力」号的后来者。在黑暗森林里，他们长出了新的道德：生存是第一位的。',
    tech: '曲率驱动 · 四维空间',
    culture: '集权 · 极度理性',
    quote: '不要返航，这里不是家。',
  },
  {
    era: '掩体纪元',
    title: '掩体人类',
    text: '躲在巨行星背后、住进太空城的人类。技术发达，心态却像穴居人一样恐惧。',
    tech: '太空城集群',
    culture: '封闭 · 避难所心态',
    quote: '躲起来，是生存还是放弃？',
  },
  {
    era: '银河纪元',
    title: '散落的人类',
    text: '太阳系跌入二维之后，人类只剩下散落在银河里的几支。他们说的还是地球上的语言，记得的还是地球上的事。',
    tech: '光速飞船 · 小宇宙',
    culture: '各自为政',
    quote: '我们还是人类吗？',
  },
]

/** 树上读者这一支长在哪个节点之后 */
export const BRANCH_FROM = 1

export interface BranchProfile {
  culture: string
  /** 0–1：活下去的倾向 */
  survive: number
  /** 0–1：还像地球人的程度 */
  bond: number
}

export function branchProfile(choices: number[]): BranchProfile {
  const { survive, bond } = score(choices)
  const range = STEPS.reduce(
    (a, s) => ({
      sMin: a.sMin + Math.min(...s.options.map((o) => o.survive)),
      sMax: a.sMax + Math.max(...s.options.map((o) => o.survive)),
      bMin: a.bMin + Math.min(...s.options.map((o) => o.bond)),
      bMax: a.bMax + Math.max(...s.options.map((o) => o.bond)),
    }),
    { sMin: 0, sMax: 0, bMin: 0, bMax: 0 },
  )
  const norm = (v: number, lo: number, hi: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo))
  const culture = bond <= -2 ? '集权 · 生存至上' : bond >= 3 ? '议会 · 法律 · 对死者的愧疚' : '在两者之间摇摆'
  return { culture, survive: norm(survive, range.sMin, range.sMax), bond: norm(bond, range.bMin, range.bMax) }
}
