/**
 * TXT 分章：按行识别章节标题，正文按行切成段落。
 *
 * 识别的标题形式（整行、且不超过 40 个字）：
 * - 第一章 / 第12章 / 第三十一节 / 第一部 / 第二卷 / 第五回 / 第一篇 …，后面可跟标题
 * - 序章、序言、序幕、楔子、引子、前言、尾声、后记、终章、番外（可跟标题）
 * - 卷一、上部、中部、下部（可跟标题）
 * - Chapter 1 / CHAPTER XII / Part 2
 * 标题少于两个时，按约 8000 字在段落边界切分，避免整本书只有一章、滚动卡顿。
 */
import type { Book, Chapter } from './types'

const CN_NUM = '0-9０-９零〇一二两三四五六七八九十百千万'
const HEADING = new RegExp(
  [
    `^第[${CN_NUM}]+[章节回卷部篇集幕](?:[\\s　:：、.·\\-—]+.{0,30}|[^\\s　]{1,20})?$`,
    `^(?:序章|序言|序幕|序|楔子|引子|前言|尾声|后记|後記|终章|終章|番外)(?:[\\s　:：、.·\\-—]+.{0,30})?$`,
    `^(?:卷[${CN_NUM}]+|[上中下]部)(?:[\\s　:：、.·\\-—]+.{0,30})?$`,
    `^(?:chapter|part)\\s+[0-9ivxlc]+(?:[\\s:.\\-—]+.{0,40})?$`,
  ].join('|'),
  'i',
)

export function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 40) return false
  // 以句号、问号等收尾的多半是正文里的句子，而不是标题；紧贴「第X章」的标题里也不该出现逗号句号
  if (/[。！？!?，,；;]$/.test(t)) return false
  if (/^第[^\s　]+[章节回卷部篇集幕][^\s　:：、.·\-—]/.test(t) && /[，。,]/.test(t)) return false
  return HEADING.test(t)
}

/** 整理一行正文：去掉首尾空白（含全角空格），合并内部的连续空白 */
function cleanLine(line: string): string {
  return line.replace(/^[\s　]+|[\s　]+$/g, '').replace(/[ \t]{2,}/g, ' ')
}

function paragraphsOf(lines: string[]): string[] {
  return lines.map(cleanLine).filter((l) => l.length > 0)
}

const CHUNK = 8000

function chunkParagraphs(paras: string[], baseTitle: string): Chapter[] {
  const out: Chapter[] = []
  let cur: string[] = []
  let size = 0
  for (const p of paras) {
    cur.push(p)
    size += p.length
    if (size >= CHUNK) {
      out.push({ title: `${baseTitle}（${out.length + 1}）`, paragraphs: cur })
      cur = []
      size = 0
    }
  }
  if (cur.length) out.push({ title: out.length ? `${baseTitle}（${out.length + 1}）` : baseTitle, paragraphs: cur })
  return out
}

export function parseTxt(text: string, fileName: string): Book {
  const title = fileName.replace(/\.[^.]+$/, '').trim() || '未命名'
  const lines = text.split('\n')
  const headingIdx: number[] = []
  lines.forEach((l, i) => {
    if (isHeading(l)) headingIdx.push(i)
  })

  let chapters: Chapter[] = []
  if (headingIdx.length >= 2) {
    const before = paragraphsOf(lines.slice(0, headingIdx[0]))
    // 卷首只有书名、作者这类寥寥几行时不单独成章，打开书直接从第一章开始
    const trivial = before.length <= 3 && before.join('').length <= 60
    if (before.length && !trivial) chapters.push({ title: '卷首', paragraphs: before })
    headingIdx.forEach((start, k) => {
      const end = k + 1 < headingIdx.length ? headingIdx[k + 1] : lines.length
      chapters.push({ title: cleanLine(lines[start]), paragraphs: paragraphsOf(lines.slice(start + 1, end)) })
    })
    // 空章节（目录页里连续出现的标题）并入下一章，不单独显示
    chapters = chapters.filter((c, i) => c.paragraphs.length > 0 || i === chapters.length - 1)
  } else {
    chapters = chunkParagraphs(paragraphsOf(lines), '全文')
  }
  if (!chapters.length) chapters = [{ title: '全文', paragraphs: [] }]
  return { title, author: '', format: 'txt', chapters }
}
