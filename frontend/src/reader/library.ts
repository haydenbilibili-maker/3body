/**
 * 本地书架：解析后的书与阅读进度存在浏览器的 IndexedDB 里（只在本机，不上传）。
 * 隐私模式或存储被禁用时自动退回内存，页面照常可读，只是关闭后不保留。
 */
import type { Book, Progress, StoredBook } from './types'

const DB = '3body-library'
const VERSION = 1
const memory = { books: new Map<string, StoredBook>(), progress: new Map<string, Progress>() }

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'bookId' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

let dbPromise: Promise<IDBDatabase | null> | null = null
const db = () => (dbPromise ??= open())

function tx<T>(store: 'books' | 'progress', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined)
        try {
          const req = run(d.transaction(store, mode).objectStore(store))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
  )
}

/** 同一文件（名字 + 大小 + 开头字节）得到同一个 id，重复导入不会出现两本 */
export async function bookId(fileName: string, bytes: Uint8Array): Promise<string> {
  const head = bytes.subarray(0, 4096)
  const seed = new TextEncoder().encode(`${fileName}|${bytes.length}|`)
  const buf = new Uint8Array(seed.length + head.length)
  buf.set(seed)
  buf.set(head, seed.length)
  try {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
    return [...digest.slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 2166136261
    for (const b of buf) h = Math.imul(h ^ b, 16777619)
    return (h >>> 0).toString(16)
  }
}

export function countChars(book: Book): number {
  return book.chapters.reduce((n, c) => n + c.paragraphs.reduce((m, p) => m + p.replace(/\s/g, '').length, 0), 0)
}

export async function saveBook(book: StoredBook): Promise<boolean> {
  memory.books.set(book.id, book)
  const ok = await tx('books', 'readwrite', (s) => s.put(book))
  return ok !== undefined
}

export type ShelfItem = Omit<StoredBook, 'chapters' | 'raw'> & { chapterCount: number }

export async function listBooks(): Promise<ShelfItem[]> {
  const all = (await tx<StoredBook[]>('books', 'readonly', (s) => s.getAll())) ?? [...memory.books.values()]
  return all
    .map(({ chapters, raw: _raw, ...rest }) => ({ ...rest, chapterCount: chapters.length }))
    .sort((a, b) => b.addedAt - a.addedAt)
}

export async function loadBook(id: string): Promise<StoredBook | undefined> {
  return (await tx<StoredBook>('books', 'readonly', (s) => s.get(id))) ?? memory.books.get(id)
}

export async function deleteBook(id: string): Promise<void> {
  memory.books.delete(id)
  memory.progress.delete(id)
  await tx('books', 'readwrite', (s) => s.delete(id))
  await tx('progress', 'readwrite', (s) => s.delete(id))
}

export async function saveProgress(p: Progress): Promise<void> {
  memory.progress.set(p.bookId, p)
  await tx('progress', 'readwrite', (s) => s.put(p))
}

export async function loadProgress(bookId: string): Promise<Progress | undefined> {
  return (await tx<Progress>('progress', 'readonly', (s) => s.get(bookId))) ?? memory.progress.get(bookId)
}

export async function allProgress(): Promise<Map<string, Progress>> {
  const all = (await tx<Progress[]>('progress', 'readonly', (s) => s.getAll())) ?? [...memory.progress.values()]
  return new Map(all.map((p) => [p.bookId, p]))
}
