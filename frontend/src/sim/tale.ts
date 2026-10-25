/**
 * 童话：广播纪元，情报解读委员会破译云天明的三个童话。
 *
 * 每个童话里有三个意象；读者为每个童话挑一个意象，再从委员会成员给出的三种读法里选一种写进报告。
 * 多年以后，历史证实了其中一部分读法。原著里被证实的是：画师与画（降维打击）、
 * 肥皂与船（曲率驱动）、伞与雪浪纸（把太阳系变成低光速黑域，向宇宙发出安全声明）。
 * 童话的文字是本项目的转述，不是原著原文。
 */

export interface Reading {
  id: string
  /** 哪位委员会成员提出 */
  by: '物理学家' | '情报分析员' | '文学研究者'
  text: string
  /** 后来是否被证实 */
  true?: boolean
}

export interface Image {
  id: string
  word: string
  readings: Reading[]
}

export interface Tale {
  id: string
  title: string
  /** 转述的段落；{image-id} 处是可以点选的意象 */
  body: string
  images: Image[]
  /** 揭晓时：这个童话真正藏着什么、什么时候被证实 */
  reveal: string
}

export const TALES: Tale[] = [
  {
    id: 'painter',
    title: '王宫的新画师',
    body:
      '无故事王国来了一位新画师。他画谁，谁就从世上消失，只留在{painter}笔下的画里；画里的人一模一样，只是再也没有厚度。王子把画收进{gallery}，宫里的人一个接一个变成了画。公主带着一把{knife}逃出王宫。',
    images: [
      {
        id: 'painter',
        word: '画师',
        readings: [
          { id: 'flatten', by: '物理学家', text: '有一种攻击能把三维的东西压成二维：被「画」进去，就是被降维。', true: true },
          { id: 'censor', by: '情报分析员', text: '画师是三体世界的宣传机器：被画进去的人，就是被抹去了声音的人。' },
          { id: 'eternal', by: '文学研究者', text: '画是永恒的另一种说法：云天明在告诉程心，被记住就是活着。' },
        ],
      },
      {
        id: 'gallery',
        word: '画廊',
        readings: [
          { id: 'archive', by: '文学研究者', text: '画廊是档案馆：文明最后能留下的只有画像。' },
          { id: 'prison', by: '情报分析员', text: '画廊是三体人关押人类的地方。' },
          { id: 'museum', by: '物理学家', text: '画廊是一种储存信息的介质，没有更多含义。' },
        ],
      },
      {
        id: 'knife',
        word: '小刀',
        readings: [
          { id: 'weapon', by: '情报分析员', text: '小刀是一种武器，人类应该造出它。' },
          { id: 'escape', by: '文学研究者', text: '小刀是逃走的决心。' },
          { id: 'cut', by: '物理学家', text: '小刀能切开画布：二维的东西可以被三维的东西切开。' },
        ],
      },
    ],
    reveal: '掩体纪元，一片二向箔抵达太阳系，整个太阳系跌进了二维，像被画进了一幅画。',
  },
  {
    id: 'soap',
    title: '饕餮海',
    body:
      '公主的船被困在饕餮海上，海里的{fish}会吞掉一切。船夫在船尾放下一块{soap}，船就自己向前滑去，越滑越快，甩开了追来的鱼。岸上的{lighthouse}一直亮着。',
    images: [
      {
        id: 'soap',
        word: '肥皂',
        readings: [
          { id: 'curvature', by: '物理学家', text: '肥皂改变了船尾的水面，船被前后不同的水「推」着走：改变船尾的空间，就能让船前进。', true: true },
          { id: 'chemistry', by: '情报分析员', text: '肥皂是一种新的化学燃料。' },
          { id: 'flee', by: '文学研究者', text: '肥皂船是逃亡主义：不要战斗，要逃。' },
        ],
      },
      {
        id: 'fish',
        word: '饕餮鱼',
        readings: [
          { id: 'fleet', by: '情报分析员', text: '饕餮鱼是三体舰队。' },
          { id: 'time', by: '文学研究者', text: '饕餮鱼是时间，它吞掉一切。' },
          { id: 'hunter', by: '物理学家', text: '饕餮鱼是宇宙里的猎人，我们看不见它们。' },
        ],
      },
      {
        id: 'lighthouse',
        word: '灯塔',
        readings: [
          { id: 'beacon', by: '情报分析员', text: '灯塔是一个坐标广播。' },
          { id: 'hope', by: '文学研究者', text: '灯塔是云天明对程心的思念。' },
          { id: 'star', by: '物理学家', text: '灯塔是太阳。' },
        ],
      },
    ],
    reveal: '后来，人类与三体世界都造出了曲率驱动的飞船：改变船尾的空间曲率，船就被「推」向前方，速度可以接近光速。',
  },
  {
    id: 'umbrella',
    title: '深水王子',
    body:
      '深水王子身形巨大，人们在{prince}的身边时觉得他很高，走远了看他还是一样高。公主撑起一把{umbrella}，雨落不到伞下；她把一张{paper}铺在地上，伞下的地方从此和外面不一样了。',
    images: [
      {
        id: 'umbrella',
        word: '伞',
        readings: [
          { id: 'blackdomain', by: '物理学家', text: '把自己罩进一个光速极低的区域，外面的东西进不来，自己也出不去：这是向宇宙表明「我们无害」的安全声明。', true: true },
          { id: 'shield', by: '情报分析员', text: '伞是一种能挡住打击的防护罩。' },
          { id: 'love', by: '文学研究者', text: '伞是保护：云天明想让程心躲起来。' },
        ],
      },
      {
        id: 'prince',
        word: '深水王子',
        readings: [
          { id: 'distance', by: '物理学家', text: '远近看起来一样大，说明他在另一个维度里。' },
          { id: 'tianming', by: '文学研究者', text: '深水王子就是云天明自己：无论多远，他都还在那里。' },
          { id: 'trisolaran', by: '情报分析员', text: '深水王子是三体人的统治者。' },
        ],
      },
      {
        id: 'paper',
        word: '雪浪纸',
        readings: [
          { id: 'bunker', by: '情报分析员', text: '纸是一张地图，指向可以躲藏的地方。' },
          { id: 'boundary', by: '物理学家', text: '铺开的纸划出了一个边界：边界里面的规律和外面不一样。' },
          { id: 'letter', by: '文学研究者', text: '纸是一封信。' },
        ],
      },
    ],
    reveal: '原著里，这是「黑域计划」与「安全声明」的来源：把一个星系的光速降到极低，它就再也不会成为威胁，也就不会被清理。',
  },
]

export interface Pick {
  image: string
  reading: string
}

export type Report = Partial<Record<string, Pick>>

export interface Verdict {
  tale: Tale
  pick: Pick | null
  image: Image | null
  reading: Reading | null
  confirmed: boolean
}

export function judge(report: Report): Verdict[] {
  return TALES.map((tale) => {
    const pick = report[tale.id] ?? null
    const image = pick ? tale.images.find((i) => i.id === pick.image) ?? null : null
    const reading = image && pick ? image.readings.find((r) => r.id === pick.reading) ?? null : null
    return { tale, pick, image, reading, confirmed: !!reading?.true }
  })
}

export function confirmedCount(report: Report): number {
  return judge(report).filter((v) => v.confirmed).length
}

/** 把转述切成文字段与意象段，供页面渲染 */
export function segments(tale: Tale): ({ text: string } | { image: Image })[] {
  const out: ({ text: string } | { image: Image })[] = []
  const re = /\{([a-z]+)\}/g
  let last = 0
  for (let m = re.exec(tale.body); m; m = re.exec(tale.body)) {
    if (m.index > last) out.push({ text: tale.body.slice(last, m.index) })
    const img = tale.images.find((i) => i.id === m![1])
    if (img) out.push({ image: img })
    last = m.index + m[0].length
  }
  if (last < tale.body.length) out.push({ text: tale.body.slice(last) })
  return out
}
