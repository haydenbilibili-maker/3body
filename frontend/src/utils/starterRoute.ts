/**
 * 首页「新手路线」：按原著时间线挑四个上手最快的扇区。
 * 访问记录存在 localStorage（仅本机本浏览器），由 router.afterEach 写入，首页读取。
 */
export interface StarterStop {
  path: string
  label: string
  kind: string
  minutes: number
  desc: string
}

export const STARTER_ROUTE: StarterStop[] = [
  { path: '/sector-r', label: '红岸基地', kind: '体验', minutes: 5, desc: '校准天线、借太阳放大信号——人类向宇宙发出的第一声。' },
  { path: '/sector-t', label: '三体摆', kind: '小游戏', minutes: 5, desc: '在乱纪元与恒纪元之间脱水、浸泡，体会三体人的处境。' },
  { path: '/sector-f', label: '面壁计划', kind: '策略游戏', minutes: 10, desc: '扮演面壁者，在破壁人看穿你之前拿到尽量多的资源。' },
  { path: '/sector-e', label: '黑暗森林', kind: '模拟', minutes: 10, desc: '看猜疑链如何让文明互相清除，再决定是暴露还是沉默。' },
]

const KEY = '3body:starter-visited'

export function readStarterVisited(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** 记录一次访问；只记新手路线里的页面。返回是否有变化 */
export function markStarterVisited(path: string): boolean {
  if (!STARTER_ROUTE.some((s) => s.path === path)) return false
  const visited = readStarterVisited()
  if (visited.has(path)) return false
  visited.add(path)
  try {
    localStorage.setItem(KEY, JSON.stringify([...visited]))
  } catch {
    /* 隐私模式等场景下存储不可用，忽略 */
  }
  return true
}

/** 第一个还没去过的站点下标；全部走完返回 -1 */
export function nextStarterIndex(visited: Set<string>): number {
  return STARTER_ROUTE.findIndex((s) => !visited.has(s.path))
}
