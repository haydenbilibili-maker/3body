import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_ROUTE, markStarterVisited, nextStarterIndex, readStarterVisited } from './starterRoute'

// 测试在 Node 环境运行，没有 localStorage：用内存实现替身
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

describe('starterRoute', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('starts with nothing visited and the first stop next', () => {
    const v = readStarterVisited()
    expect(v.size).toBe(0)
    expect(nextStarterIndex(v)).toBe(0)
  })

  it('records only route stops, once', () => {
    expect(markStarterVisited('/sector-x')).toBe(false)
    expect(markStarterVisited(STARTER_ROUTE[0].path)).toBe(true)
    expect(markStarterVisited(STARTER_ROUTE[0].path)).toBe(false)
    expect(nextStarterIndex(readStarterVisited())).toBe(1)
  })

  it('returns -1 when every stop is visited', () => {
    STARTER_ROUTE.forEach((s) => markStarterVisited(s.path))
    expect(nextStarterIndex(readStarterVisited())).toBe(-1)
  })

  it('keeps working when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(readStarterVisited().size).toBe(0)
    expect(markStarterVisited(STARTER_ROUTE[0].path)).toBe(true)
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('3body:starter-visited', '{oops')
    expect(readStarterVisited().size).toBe(0)
  })
})
