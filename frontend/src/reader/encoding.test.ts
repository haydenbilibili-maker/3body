import { describe, expect, it } from 'vitest'
import { decodeText, detectEncoding, garbleRatio } from './encoding'
import { BIG5, GB, SC, TC, U16BE_BOM, U16LE, U8BOM } from './fixtures'

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const norm = (s: string) => s.replace(/\\n/g, '\n')

describe('encoding detection', () => {
  it('decodes GB18030 / GBK text without garbling', () => {
    const { text, detection } = decodeText(bytes(GB))
    expect(detection.encoding).toBe('gb18030')
    expect(text).toBe(norm(SC))
    expect(garbleRatio(text)).toBe(0)
  })

  it('decodes Big5 traditional text', () => {
    const { text, detection } = decodeText(bytes(BIG5))
    expect(detection.encoding).toBe('big5')
    expect(text).toBe(norm(TC))
  })

  it('recognises UTF-16 with and without a byte order mark', () => {
    expect(detectEncoding(bytes(U16LE)).encoding).toBe('utf-16le')
    expect(decodeText(bytes(U16BE_BOM)).text).toBe(norm(SC))
  })

  it('strips the UTF-8 BOM and normalises line breaks', () => {
    const raw = new TextEncoder().encode('第一章\r\n正文\r\n')
    expect(decodeText(raw).text).toBe('第一章\n正文\n')
    const { text, detection } = decodeText(bytes(U8BOM))
    expect(detection.reason).toBe('bom')
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
  })

  it('honours a forced encoding', () => {
    const { text } = decodeText(bytes(GB), 'utf-8')
    expect(garbleRatio(text)).toBeGreaterThan(0.1)
  })
})
