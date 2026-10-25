import { describe, expect, it } from 'vitest'
import { ImportError, importFile } from './importer'
import { EPUB3 } from './epubFixtures'
import { GB } from './fixtures'

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

describe('importFile', () => {
  it('imports a GBK txt into chapters without garbling', async () => {
    const r = await importFile('三体.txt', bytes(GB))
    expect(r.detection?.encoding).toBe('gb18030')
    expect(r.garble).toBe(0)
    expect(r.book.chapters.map((c) => c.title)).toEqual(['第一章 疯狂年代', '第二章 寂静的春天'])
    expect(r.book.chars).toBeGreaterThan(40)
  })

  it('reports garbling when the wrong encoding is forced', async () => {
    const r = await importFile('三体.txt', bytes(GB), 'utf-8')
    expect(r.garble).toBeGreaterThan(0.1)
  })

  it('detects an EPUB by its content even with the wrong extension', async () => {
    const r = await importFile('三体.txt', bytes(EPUB3))
    expect(r.book.format).toBe('epub')
    expect(r.detection).toBe(null)
  })

  it('gives the same id to the same file', async () => {
    const a = await importFile('a.txt', bytes(GB))
    const b = await importFile('a.txt', bytes(GB))
    expect(a.book.id).toBe(b.book.id)
  })

  it('explains unsupported formats', async () => {
    let msg = ''
    try {
      await importFile('x.mobi', new Uint8Array([1, 2, 3]))
    } catch (e) {
      msg = e instanceof ImportError ? e.message : ''
    }
    expect(msg).toMatch(/EPUB/)
  })
})
