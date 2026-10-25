import { describe, expect, it } from 'vitest'
import { ANCIENT, formatDistance, lightSeconds, whereIs } from './signal'

describe('signal', () => {
  it('travels exactly as long as it has been sent', () => {
    expect(lightSeconds(0, 498000)).toBe(498)
    expect(lightSeconds(1000, 0)).toBe(0)
  })
  it('formats across scales', () => {
    expect(formatDistance(5)).toBe('5.0 光秒')
    expect(formatDistance(3 * 3600)).toBe('3.0 光时')
    expect(formatDistance(10 * 365.25 * 86400)).toBe('10.0 光年')
  })
  it('names the landmarks it has crossed', () => {
    expect(whereIs(0)).toEqual({ passed: null, next: '月球' })
    expect(whereIs(9 * 60).passed).toBe('太阳')
    expect(whereIs(5 * 365.25 * 86400).passed).toBe('半人马座 α（三体世界）')
  })
  it('the Red Coast signal has long passed Trisolaris', () => {
    const s = lightSeconds(ANCIENT[1].sentAt!, Date.UTC(2026, 9, 25))
    expect(s / (365.25 * 86400)).toBeGreaterThan(40)
  })
})
