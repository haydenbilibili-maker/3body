/**
 * EPUB 解析：container.xml → OPF（元数据、清单、阅读顺序）→ 目录（EPUB3 nav 或 EPUB2 NCX）→ 逐章转文本。
 * 每个文件按 XML 声明的编码解码；没有声明时自动识别（见 encoding.ts），避免乱码。
 */
import { decodeText, type TextEncodingName } from './encoding'
import { decodeEntities, htmlToText } from './html'
import type { Book, Chapter } from './types'
import { findEntry, readZipDirectory, readZipEntry, ZipError, type ZipEntry } from './zip'

export class EpubError extends Error {}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? ''
  return out
}

/** 按 XML 声明里的 encoding 解码，没有声明则自动识别 */
export function decodeXml(bytes: Uint8Array): { text: string; encoding: string } {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200))
  const declared = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase()
  const known: Record<string, TextEncodingName> = {
    'utf-8': 'utf-8',
    utf8: 'utf-8',
    gbk: 'gb18030',
    gb2312: 'gb18030',
    gb18030: 'gb18030',
    big5: 'big5',
    'utf-16': 'utf-16le',
    'utf-16le': 'utf-16le',
    'utf-16be': 'utf-16be',
  }
  const forced = declared ? known[declared] : undefined
  const { text, detection } = decodeText(bytes, forced)
  return { text, encoding: detection.encoding }
}

/** 把 OPF 内的相对路径解析为 ZIP 内的路径（处理 ../、./、百分号编码与锚点） */
export function resolvePath(base: string, href: string): string {
  const clean = href.split('#')[0]
  let decoded = clean
  try {
    decoded = decodeURIComponent(clean)
  } catch {
    /* 非法的百分号编码，按原样使用 */
  }
  const parts = (base ? base.split('/') : []).concat(decoded.split('/'))
  const out: string[] = []
  for (const p of parts) {
    if (!p || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return out.join('/')
}

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

async function readText(bytes: Uint8Array, entries: Map<string, ZipEntry>, path: string) {
  const e = findEntry(entries, path)
  if (!e) return null
  return decodeXml(await readZipEntry(bytes, e))
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/** 目录：文件路径 → 第一个指向它的标题 */
function parseNav(html: string, dir: string): Map<string, string> {
  const map = new Map<string, string>()
  const nav = /<nav\b[^>]*(?:epub:type|type)\s*=\s*["'][^"']*toc[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i.exec(html)?.[1] ?? html
  for (const m of nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrs(m[1]).href
    const label = stripTags(m[2])
    if (!href || !label) continue
    const path = resolvePath(dir, href)
    if (!map.has(path)) map.set(path, label)
  }
  return map
}

function parseNcx(xml: string, dir: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of xml.matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\b([^>]*)\/?>/gi)) {
    const label = stripTags(m[1])
    const src = attrs(m[2]).src
    if (!src || !label) continue
    const path = resolvePath(dir, src)
    if (!map.has(path)) map.set(path, label)
  }
  return map
}

export async function parseEpub(bytes: Uint8Array, fileName: string): Promise<Book & { encoding: string }> {
  let entries: Map<string, ZipEntry>
  try {
    entries = readZipDirectory(bytes)
  } catch (e) {
    throw new EpubError(e instanceof ZipError ? e.message : '无法读取 EPUB 文件')
  }

  const container = await readText(bytes, entries, 'META-INF/container.xml')
  const opfPath = container ? /full-path\s*=\s*["']([^"']+)["']/i.exec(container.text)?.[1] : undefined
  const opfEntry = opfPath ? opfPath : [...entries.keys()].find((k) => k.toLowerCase().endsWith('.opf'))
  if (!opfEntry) throw new EpubError('找不到 EPUB 的内容清单（.opf）')
  const opf = await readText(bytes, entries, opfEntry)
  if (!opf) throw new EpubError('内容清单（.opf）缺失')

  // 正文被加密（DRM）时无法解析：常见于商店购买的电子书
  const encryption = await readText(bytes, entries, 'META-INF/encryption.xml')
  if (encryption && /<EncryptedData[\s\S]*?\.(x?html?)["']/i.test(encryption.text) && !/obfuscation/i.test(encryption.text)) {
    throw new EpubError('这本 EPUB 受 DRM 加密保护，无法读取正文')
  }

  const opfDir = dirOf(opfEntry)
  const meta = opf.text
  const title = stripTags(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i.exec(meta)?.[1] ?? '') || fileName.replace(/\.[^.]+$/, '')
  const author = stripTags(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator>/i.exec(meta)?.[1] ?? '')

  const manifest = new Map<string, { href: string; type: string; props: string }>()
  for (const m of meta.matchAll(/<item\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1])
    if (a.id && a.href) manifest.set(a.id, { href: a.href, type: a['media-type'] ?? '', props: a.properties ?? '' })
  }
  const spineTag = /<spine\b([^>]*)>/i.exec(meta)?.[1] ?? ''
  const spine = [...meta.matchAll(/<itemref\b([^>]*)\/?>/gi)]
    .map((m) => attrs(m[1]))
    .filter((a) => a.linear !== 'no')
    .map((a) => manifest.get(a.idref))
    .filter((x): x is { href: string; type: string; props: string } => !!x)
  if (!spine.length) throw new EpubError('EPUB 没有可阅读的章节（阅读顺序为空）')

  // 目录标题：优先 EPUB3 nav，其次 EPUB2 NCX
  let toc = new Map<string, string>()
  const navItem = [...manifest.values()].find((x) => x.props.split(/\s+/).includes('nav'))
  if (navItem) {
    const navPath = resolvePath(opfDir, navItem.href)
    const nav = await readText(bytes, entries, navPath)
    if (nav) toc = parseNav(nav.text, dirOf(navPath))
  }
  if (!toc.size) {
    const ncxId = attrs(`<x ${spineTag}>`).toc
    const ncxItem = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((x) => x.type === 'application/x-dtbncx+xml')
    if (ncxItem) {
      const ncxPath = resolvePath(opfDir, ncxItem.href)
      const ncx = await readText(bytes, entries, ncxPath)
      if (ncx) toc = parseNcx(ncx.text, dirOf(ncxPath))
    }
  }

  const chapters: Chapter[] = []
  let encoding = opf.encoding
  for (const item of spine) {
    if (!/html|xml/i.test(item.type) && !/\.x?html?$/i.test(item.href)) continue
    const path = resolvePath(opfDir, item.href)
    const doc = await readText(bytes, entries, path)
    if (!doc) continue
    encoding = doc.encoding
    const { title: docTitle, heading, paragraphs } = htmlToText(doc.text)
    const tocTitle = toc.get(path)
    const chapterTitle = tocTitle || heading || docTitle || `第 ${chapters.length + 1} 节`
    // 正文第一段若就是标题本身，不再重复显示
    const paras = paragraphs[0] && (paragraphs[0] === chapterTitle || paragraphs[0] === heading) ? paragraphs.slice(1) : paragraphs
    if (!paras.length && !tocTitle) continue // 封面、空白页
    chapters.push({ title: chapterTitle, paragraphs: paras })
  }
  if (!chapters.length) throw new EpubError('没有在 EPUB 里找到文字内容（可能是纯图片的漫画或扫描版）')
  return { title, author, format: 'epub', chapters, encoding }
}
