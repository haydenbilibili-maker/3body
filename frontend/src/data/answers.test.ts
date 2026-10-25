import { describe, expect, it } from 'vitest'
import { answers, forgetAll, recordAnswer, recordVisit, visits } from './answers'

describe('reader archive', () => {
  it('keeps the latest answer per room', () => {
    forgetAll()
    recordAnswer('/sector-r', '保持沉默', 1)
    recordAnswer('/sector-r', '回答了', 2)
    expect(answers.value['/sector-r'].text).toBe('回答了')
    expect(Object.keys(answers.value)).toHaveLength(1)
  })
  it('records each visit once', () => {
    forgetAll()
    recordVisit('/sector-j')
    recordVisit('/sector-j')
    expect(visits.value).toEqual(['/sector-j'])
  })
})
