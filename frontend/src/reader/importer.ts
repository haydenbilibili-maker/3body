/**
 * 导入入口：根据文件内容（而不只是扩展名）判断 TXT 还是 EPUB，解析并生成可存入书架的书。
 */
import { decodeText, garbleRatio, type Detection, type TextEncodingName } from './encoding'
import { parseEpub } from './epub'
import { bookId, countChars } from './library'
import { parseTxt } from './txt'
import type { StoredBook } from './types'

export const MAX_BYTES = 60 * 1024 * 1024

export class ImportError extends Error {}

export interface ImportResult {
  book: StoredBook
  /** TXT 的编码识别结果；EPUB 为 null */
  detection: Detection | null
  /** 解出文本中错码字符的比例：超过约 1% 时提示用户手动选择编码 */
  garble: number
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04

export async function importFile(
  fileName: string,
  bytes: Uint8Array,
  forcedEncoding?: TextEncodingName,
): Promise<ImportResult> {
  if (bytes.length === 0) throw new ImportError('文件是空的')
  if (bytes.length > MAX_BYTES) throw new ImportError('文件超过 60 MB，暂不支持')
  const lower = fileName.toLowerCase()
  const id = await bookId(fileName, bytes)
  const base = { id, fileName, size: bytes.length, addedAt: Date.now() }

  // 按内容判断：扩展名写错的 EPUB（ZIP 开头）也照样按 EPUB 解析
  if (isZip(bytes)) {
    const book = await parseEpub(bytes, fileName)
    const stored: StoredBook = { ...base, ...book, chars: countChars(book) }
    const sample = book.chapters.slice(0, 5).flatMap((c) => c.paragraphs).join('\n')
    return { book: stored, detection: null, garble: garbleRatio(sample) }
  }
  if (lower.endsWith('.epub')) throw new ImportError('这个 .epub 文件不是有效的 EPUB（不是 ZIP 格式），可能已损坏')
  if (lower.endsWith('.mobi') || lower.endsWith('.azw3') || lower.endsWith('.pdf')) {
    throw new ImportError('暂只支持 TXT 与 EPUB。MOBI / AZW3 / PDF 可先用 Calibre 等工具转成 EPUB')
  }
  const { text, detection } = decodeText(bytes, forcedEncoding)
  const book = parseTxt(text, fileName)
  const stored: StoredBook = { ...base, ...book, encoding: detection.encoding, chars: countChars(book), raw: bytes }
  return { book: stored, detection, garble: garbleRatio(text) }
}
