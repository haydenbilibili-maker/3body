/**
 * 把 EPUB 里的 XHTML 章节转成纯文本段落。
 * 不依赖 DOMParser（测试环境没有），浏览器与测试走同一套代码：
 * 去掉 head/script/style/注释与注音（rt/rp），块级标签处断段，<br> 处换行，其余标签剥除，再解码实体。
 */

const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  times: '×',
  ensp: ' ',
  emsp: '　',
  thinsp: ' ',
  zwj: '',
  zwnj: '',
  shy: '',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    const v = NAMED[body.toLowerCase()]
    return v === undefined ? m : v
  })
}

const BLOCK = 'p|div|h[1-6]|li|blockquote|section|article|header|footer|aside|tr|dd|dt|pre|figcaption|caption|td|th|table|ul|ol|dl|hr'
const BREAK = '\u0001'

export interface HtmlText {
  title: string
  /** 第一个 h1–h3 的文本 */
  heading: string
  paragraphs: string[]
}

export function htmlToText(html: string): HtmlText {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = titleMatch ? clean(decodeEntities(titleMatch[1].replace(/<[^>]+>/g, ''))) : ''
  let body = html
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (bodyMatch) body = bodyMatch[1]
  body = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|svg|math)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(rt|rp)\b[\s\S]*?<\/\1>/gi, '')
  const headMatch = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(body)
  const heading = headMatch ? clean(decodeEntities(headMatch[2].replace(/<[^>]+>/g, ''))) : ''
  body = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, 'gi'), BREAK)
    .replace(/<[^>]+>/g, '')
  const paragraphs = decodeEntities(body)
    .split(BREAK)
    .flatMap((block) => block.split('\n'))
    .map(clean)
    .filter((p) => p.length > 0)
  return { title, heading, paragraphs }
}

function clean(s: string): string {
  return s.replace(/[\s 　]+/g, (ws) => (ws.includes('　') ? '' : ' ')).trim()
}
