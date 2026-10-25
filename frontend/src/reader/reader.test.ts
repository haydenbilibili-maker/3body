import { describe, expect, it } from 'vitest'
import { EpubError, parseEpub, resolvePath } from './epub'
import { decodeEntities, htmlToText } from './html'
import { isHeading, parseTxt } from './txt'
import { readZipDirectory } from './zip'
import { searchBook } from './search'
import { EPUB2_GBK, EPUB3 } from './epubFixtures'

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

describe('txt chapters', () => {
  it('recognises common Chinese chapter headings', () => {
    for (const h of ['第一章 疯狂年代', '第12章', '第三十一节　古筝行动', '序章 褐蚁之墓', '尾声', '第一部 面壁者', '卷三', 'Chapter 4', '后记'])
      expect(isHeading(h)).toBe(true)
    for (const n of ['第一章就这样结束了，他想。', '这是第一章。', '序列号很长', '他说：“第一。”'])
      expect(isHeading(n)).toBe(false)
  })

  it('splits by headings and keeps text before the first one', () => {
    const book = parseTxt('三体\n作者\n\n第一章 疯狂年代\n　　中国，1967年。\n\n第二章 寂静的春天\n两年以后。\n', '三体.txt')
    expect(book.title).toBe('三体')
    expect(book.chapters.map((c) => c.title)).toEqual(['卷首', '第一章 疯狂年代', '第二章 寂静的春天'])
    expect(book.chapters[1].paragraphs).toEqual(['中国，1967年。'])
  })

  it('drops empty table-of-contents headings', () => {
    const book = parseTxt('第一章 甲\n第二章 乙\n第一章 甲\n正文一\n第二章 乙\n正文二\n', 'x.txt')
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[0].paragraphs).toEqual(['正文一'])
  })

  it('chunks long text without headings', () => {
    const book = parseTxt(Array.from({ length: 400 }, () => '一'.repeat(50)).join('\n'), 'x.txt')
    expect(book.chapters.length).toBeGreaterThan(1)
  })
})

describe('html to text', () => {
  it('decodes entities, drops ruby annotations and breaks blocks', () => {
    const t = htmlToText('<html><head><title>t</title></head><body><h1>标题</h1><p>甲&amp;乙<br/>丙</p><p><ruby>汪<rt>wang</rt></ruby>淼&#x3002;</p></body></html>')
    expect(t.heading).toBe('标题')
    expect(t.paragraphs).toEqual(['标题', '甲&乙', '丙', '汪淼。'])
    expect(decodeEntities('&hellip;&unknown;')).toBe('…&unknown;')
  })
})

describe('epub', () => {
  it('resolves relative and percent-encoded paths', () => {
    expect(resolvePath('OEBPS', 'Text/chapter%201.xhtml#x')).toBe('OEBPS/Text/chapter 1.xhtml')
    expect(resolvePath('OEBPS/Text', '../Images/a.jpg')).toBe('OEBPS/Images/a.jpg')
  })

  it('reads the zip directory', () => {
    const entries = readZipDirectory(bytes(EPUB3))
    expect(entries.has('META-INF/container.xml')).toBe(true)
  })

  it('parses an EPUB 3 with a nav table of contents', async () => {
    const book = await parseEpub(bytes(EPUB3), 'x.epub')
    expect(book.title).toBe('三体 I：地球往事')
    expect(book.author).toBe('刘慈欣')
    expect(book.chapters.map((c) => c.title)).toEqual(['第一章 疯狂年代', '第二章 寂静的春天'])
    expect(book.chapters[0].paragraphs).toEqual(['中国，1967年。', '“红色联合”&“四二八兵团”', '第二行', '汪淼 说…'])
  })

  it('parses an EPUB 2 whose chapters are encoded in GBK', async () => {
    const book = await parseEpub(bytes(EPUB2_GBK), 'y.epub')
    expect(book.chapters[0].title).toBe('序章 褐蚁之墓')
    expect(book.chapters[0].paragraphs[0]).toBe('褐蚁已经忘记了这里曾是它的家。')
  })

  it('rejects files that are not EPUB', async () => {
    let err: unknown
    try {
      await parseEpub(new TextEncoder().encode('not a zip'), 'z.epub')
    } catch (e) {
      err = e
    }
    expect(err instanceof EpubError).toBe(true)
  })
})

describe('search', () => {
  it('finds matches with context across chapters', () => {
    const book = { chapters: [{ title: 'a', paragraphs: ['不要回答！不要回答！'] }, { title: 'b', paragraphs: ['他没有回答'] }] }
    const hits = searchBook(book, '回答')
    expect(hits).toHaveLength(2)
    expect(hits[1]).toEqual({ chapter: 1, paragraph: 0, before: '他没有', match: '回答', after: '' })
    expect(searchBook(book, '  ')).toEqual([])
  })
})
