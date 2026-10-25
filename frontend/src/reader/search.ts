/** 全书搜索：返回命中的章节、段落位置与前后文片段 */
import type { Book } from './types'

export interface Hit {
  chapter: number
  paragraph: number
  before: string
  match: string
  after: string
}

export function searchBook(book: Pick<Book, 'chapters'>, query: string, limit = 60): Hit[] {
  const q = query.trim()
  if (!q) return []
  const lower = q.toLowerCase()
  const hits: Hit[] = []
  book.chapters.forEach((c, ci) => {
    c.paragraphs.forEach((p, pi) => {
      if (hits.length >= limit) return
      const i = p.toLowerCase().indexOf(lower)
      if (i < 0) return
      hits.push({
        chapter: ci,
        paragraph: pi,
        before: p.slice(Math.max(0, i - 18), i),
        match: p.slice(i, i + q.length),
        after: p.slice(i + q.length, i + q.length + 24),
      })
    })
  })
  return hits
}
