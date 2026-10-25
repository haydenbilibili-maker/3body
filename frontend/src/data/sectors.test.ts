import { describe, expect, it } from 'vitest'
import { ERAS, SECTORS, eraById, firstSectorOfEra, sectorByPath } from './sectors'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 路由表需要浏览器环境才能实例化，这里直接从源码里读出路径
const routerSource = readFileSync(fileURLToPath(new URL('../router/index.ts', import.meta.url)), 'utf-8')

describe('sector registry', () => {
  it('registers every routed sector exactly once', () => {
    const routed = [...routerSource.matchAll(/path: '(\/sector-[a-z-]+)',\s*\n\s*name:/g)].map((m) => m[1])
    expect(routed.length).toBeGreaterThan(20)
    for (const p of routed) expect(sectorByPath(p)).toBeTruthy()
    expect(new Set(SECTORS.map((s) => s.path)).size).toBe(SECTORS.length)
  })

  it('points every sector at a known era', () => {
    for (const s of SECTORS) {
      if (s.era !== 'all') expect(eraById(s.era)).toBeTruthy()
    }
  })

  it('asks a question on every sector', () => {
    for (const s of SECTORS) expect(s.question.endsWith('？')).toBe(true)
  })

  it('orders eras from the pastoral age to beyond time', () => {
    expect(ERAS[0].id).toBe('pastoral')
    expect(ERAS[ERAS.length - 1].id).toBe('beyond')
    expect(firstSectorOfEra('crisis')?.path).toBe('/sector-a')
  })
})
