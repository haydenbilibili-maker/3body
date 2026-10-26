/**
 * 太空城图鉴：掩体纪元，人类住进了巨行星阴影里的太空城。
 *
 * 六座城对应六种构型（轮辐式、滚筒式、组合式、环形、球形、纺锤形）。重力来自自转：
 * 在半径 r 处要得到重力 g，角速度 ω = √(g / r)，转速 = ω × 60 / 2π（转 / 分钟）。
 * 城的名字与所在巨行星和掩体沙盘（sim/bunker.ts）一致；尺寸与人口是档案馆的复原，不是原著数字。
 */

export const G = 9.8

export type CityShape = 'wheel' | 'cylinder' | 'composite' | 'ring' | 'sphere' | 'spindle'

export interface SpaceCity {
  name: string
  giant: string
  shape: CityShape
  /** 构型名称 */
  type: string
  /** 产生重力的那一圈的半径，米 */
  radius: number
  /** 设计人口，万人 */
  population: number
  exterior: string
  interior: string
  /** 住在这种城里的人，最常说的一句话 */
  voice: string
}

export const CITIES: SpaceCity[] = [
  {
    name: '亚洲一号',
    giant: '木星',
    shape: 'wheel',
    type: '轮辐式',
    radius: 900,
    population: 120,
    exterior: '一只缓慢转动的车轮：外圈是住人的环，四根轮辐把它连到中心的码头。',
    interior: '街道沿着外圈铺开，抬头能看见街道向上弯去，在头顶接上自己。越往轮辐走，身体越轻。',
    voice: '在轮辐里爬到一半，人就像在月球上一样轻。',
  },
  {
    name: '北美一号',
    giant: '木星',
    shape: 'cylinder',
    type: '滚筒式',
    radius: 3200,
    population: 800,
    exterior: '一根几十公里长的圆筒，绕着自己的长轴转动，两端是巨大的端盖与对接口。',
    interior: '内壁就是大地：河流、农田、城镇铺满整个圆筒，一条人造太阳沿着中轴贯穿首尾。抬头，对面的城市倒挂在天上。',
    voice: '下雨的时候，雨是从对面那座城的方向落下来的。',
  },
  {
    name: '欧洲三号',
    giant: '土星',
    shape: 'composite',
    type: '组合式',
    radius: 1200,
    population: 300,
    exterior: '几座不同形状的舱段用桁架拼在一起，像一个不断加建的街区。',
    interior: '每个舱段的重力都不一样：工厂在低重力段，学校和医院在一倍重力段。人们换乘时要先适应。',
    voice: '从工厂下班回家，要先在过渡舱里站五分钟，等腿记起自己的重量。',
  },
  {
    name: '太平洋一号',
    giant: '土星',
    shape: 'ring',
    type: '环形',
    radius: 4000,
    population: 260,
    exterior: '一道极细的环，没有轮辐，靠几根缆索与中心相连，远看像土星的又一圈环。',
    interior: '环很窄，城市只有几条街宽，却绕成一个周长二十多公里的圆。走上一天，会回到出发的地方。',
    voice: '这里没有尽头，只有回到原处。',
  },
  {
    name: '天王星城',
    giant: '天王星',
    shape: 'sphere',
    type: '球形',
    radius: 800,
    population: 90,
    exterior: '一颗缓缓自转的球，赤道一圈的舷窗最亮。',
    interior: '赤道上是一倍重力的街道；朝两极走，重力越来越小，到了极点，人可以飘在空中。',
    voice: '孩子们都去极点玩，那里谁都会飞。',
  },
  {
    name: '海王星城',
    giant: '海王星',
    shape: 'spindle',
    type: '纺锤形',
    radius: 1500,
    population: 150,
    exterior: '两头尖、中间鼓的纺锤，像一粒被拉长的种子。',
    interior: '最宽的那一圈是城市的中心，向两头去，地面一路收窄、变轻，直到尖端的码头。',
    voice: '离太阳最远的一座城。我们是最后看到阳光的人。',
  },
]

/** 在半径 r（米）处得到重力 g 所需的转速，转 / 分钟 */
export function rpmFor(radius: number, g = G): number {
  return (Math.sqrt(g / radius) * 60) / (2 * Math.PI)
}

/** 某个转速下，距离轴心 r 处的重力（以地球重力为 1） */
export function gravityAt(radius: number, atRadius: number): number {
  return atRadius / radius
}

export function cityByName(name: string): SpaceCity | undefined {
  return CITIES.find((c) => c.name === name)
}
