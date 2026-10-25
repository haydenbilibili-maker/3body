import { describe, expect, it } from 'vitest'
import { TERMS, createPdc, doomsday, hardship, runTerm } from './pdc'

const play = (d: number) => {
  let s = createPdc()
  for (let i = 0; i < TERMS; i += 1) s = runTerm(s, d)
  return s
}

describe('pdc four-century budget', () => {
  it('builds a bigger fleet with more defense spending', () => {
    expect(play(70).fleet).toBeGreaterThan(play(30).fleet)
  })

  it('heavy austerity triggers the Great Ravine once', () => {
    const s = play(90)
    expect(s.history.filter((t) => t.ravine)).toHaveLength(1)
    expect(s.history.find((t) => t.ravine)!.population).toBeLessThan(100)
  })

  it('a gentle budget never triggers the Ravine and the people grow', () => {
    const s = play(30)
    expect(s.history.some((t) => t.ravine)).toBe(false)
    expect(s.population).toBeGreaterThan(100)
  })

  it('stops after the last term', () => {
    const s = play(50)
    expect(s.term).toBe(TERMS)
    expect(runTerm(s, 50)).toBe(s)
  })

  it('the droplet leaves only two ships whatever the fleet size', () => {
    expect(doomsday(2000)).toEqual({ destroyed: 1998, escaped: 2 })
    expect(doomsday(1)).toEqual({ destroyed: 0, escaped: 1 })
  })

  it('counts the generations who paid for the fleet', () => {
    expect(hardship(play(30).history)).toBe(0)
    expect(hardship(play(80).history)).toBeGreaterThan(0)
  })
})
