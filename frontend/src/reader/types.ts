/** 阅读器的书籍数据结构（解析结果，也是存进本地书架的内容） */

export interface Chapter {
  title: string
  paragraphs: string[]
}

export interface Book {
  title: string
  author: string
  format: 'txt' | 'epub'
  chapters: Chapter[]
}

export interface StoredBook extends Book {
  id: string
  fileName: string
  size: number
  /** TXT 识别出的编码；EPUB 为文件内声明的编码 */
  encoding: string
  addedAt: number
  /** 总字数（不含空白） */
  chars: number
  /** TXT 的原始字节：用于换一种编码重新解码（EPUB 不保存） */
  raw?: Uint8Array
}

export interface Progress {
  bookId: string
  chapter: number
  /** 章节内滚动位置 0–1 */
  ratio: number
  updatedAt: number
}
