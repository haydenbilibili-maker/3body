/**
 * 「田园时代」——宇宙降维史的数据与换算（宇宙膜扇区）。
 *
 * 依据回归运动广播的设定：宇宙诞生时是十维的、光速远高于今天，
 * 维度与光速在漫长的战争中被当作武器一次次消耗。
 * 中间各阶段的具体描写是本项目的想象，页面上以「想象」标注。
 */

export interface DimStage {
  dim: number
  name: string
  /** 光速相对今天的倍数；Infinity 表示近乎瞬时 */
  lightFactor: number
  text: string
  /** 页面附带的延伸入口 */
  link?: { to: string; label: string }
  /** 是否为原著设定之外的想象 */
  imagined?: boolean
}

export const STAGES: DimStage[] = [
  {
    dim: 10,
    name: '田园时代',
    lightFactor: Infinity,
    text: '宇宙刚诞生时有十个维度，光几乎在一瞬间抵达任何地方。没有距离，也就没有隔绝；没有隔绝，也就无从猜疑。',
  },
  {
    dim: 9,
    name: '第一次折叠',
    lightFactor: 1e7,
    text: '某个文明发现：把敌人所在的空间降低一维，就能杀死它。代价是，自己也永远失去了那一维。',
    imagined: true,
  },
  {
    dim: 8,
    name: '武器的尺度',
    lightFactor: 1e5,
    text: '折叠开始在宇宙尺度上使用。每一次都不可撤销——被用掉的维度，不会再长回来。',
    imagined: true,
  },
  {
    dim: 7,
    name: '光的减速',
    lightFactor: 1e4,
    text: '为了防御，有人学会了降低光速，把自己藏进慢光的壳里。光一旦慢下来，就再也快不回去了。',
    imagined: true,
  },
  {
    dim: 6,
    name: '时滞',
    lightFactor: 1e3,
    text: '慢下来的光让文明之间第一次有了「远方」。一句问候要走很久，回答要走同样久。',
    imagined: true,
  },
  {
    dim: 5,
    name: '猜疑',
    lightFactor: 100,
    text: '你无法确定远方的文明在想什么，它也无法确定你。你知道它这样想，它也知道你知道……猜疑链开始延伸。',
    imagined: true,
  },
  {
    dim: 4,
    name: '水洼',
    lightFactor: 10,
    text: '四维没有完全消失，只是缩成了散落的碎片——像退潮之后，留在礁石间的水洼。鱼要到水洼里去，只有那里还有水。',
    link: { to: '/sector-g', label: '进入一块四维碎片' },
  },
  {
    dim: 3,
    name: '黑暗森林',
    lightFactor: 1,
    text: '我们在这里。光速每秒三十万公里，最近的恒星也要四年才能收到一句话。宇宙是一座黑暗森林，每个文明都是带枪的猎人。',
    link: { to: '/sector-e', label: '走进黑暗森林' },
  },
  {
    dim: 2,
    name: '画',
    lightFactor: 1,
    text: '一张小纸条大小的二向箔，就能让整个太阳系跌落成一幅没有厚度的画。下一次折叠已经开始了。',
    link: { to: '/sector-d', label: '看那幅画' },
  },
  {
    dim: 1,
    name: '线',
    lightFactor: 0.01,
    text: '没有宽度的线上，任何两个东西都无法相遇——它们只能永远排着队。',
    imagined: true,
  },
  {
    dim: 0,
    name: '点',
    lightFactor: 0,
    text: '所有的维度都被用完了。没有距离，也没有光。宇宙回到了一种比诞生之前更彻底的寂静。',
    imagined: true,
  },
]

/** 消息在两个文明之间往返的时间（年）；距离以今天的光年计 */
export function roundTripYears(stage: DimStage, lightYears = 100): number {
  if (stage.lightFactor === Infinity) return 0
  if (stage.lightFactor <= 0) return Infinity
  return (2 * lightYears) / stage.lightFactor
}

export function formatDuration(years: number): string {
  if (years === 0) return '瞬时'
  if (!Number.isFinite(years)) return '永不抵达'
  if (years < 1 / 365 / 24) return `${Math.max(1, Math.round(years * 365 * 24 * 3600))} 秒`
  if (years < 1 / 365) return `${Math.round(years * 365 * 24)} 小时`
  if (years < 1) return `${Math.round(years * 365)} 天`
  if (years < 1e4) return `${Math.round(years).toLocaleString('zh-CN')} 年`
  return `10^${Math.floor(Math.log10(years))} 年`
}

export function formatLight(stage: DimStage): string {
  if (stage.lightFactor === Infinity) return '近乎无限'
  if (stage.lightFactor === 0) return '0'
  if (stage.lightFactor >= 1000) return `今天的 10^${Math.round(Math.log10(stage.lightFactor))} 倍`
  if (stage.lightFactor === 1) return '30 万公里/秒'
  return `今天的 ${stage.lightFactor} 倍`
}

/** 当前宇宙（我们所在）的阶段下标 */
export const PRESENT_INDEX = STAGES.findIndex((s) => s.dim === 3)
