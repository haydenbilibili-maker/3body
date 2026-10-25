/**
 * 极简 ZIP 读取器（EPUB 就是一个 ZIP）。
 * 只读：解析中央目录，按名字取出条目；支持「存储」与「Deflate」两种压缩方式，
 * Deflate 用浏览器自带的 DecompressionStream('deflate-raw') 解压，不引入第三方库。
 */

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

export class ZipError extends Error {}

const SIG_EOCD = 0x06054b50
const SIG_CEN = 0x02014b50
const SIG_LOC = 0x04034b50

function findEocd(view: DataView): number {
  // 结尾记录至少 22 字节，后面可能跟最长 65535 字节的注释
  const min = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === SIG_EOCD) return i
  }
  throw new ZipError('不是有效的 ZIP / EPUB 文件（找不到目录结尾）')
}

export function readZipDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocd(view)
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  if (p === 0xffffffff) throw new ZipError('暂不支持 ZIP64 格式')
  const entries = new Map<string, ZipEntry>()
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(p, true) !== SIG_CEN) throw new ZipError('ZIP 目录已损坏')
    const flags = view.getUint16(p + 8, true)
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const size = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const rawName = bytes.subarray(p + 46, p + 46 + nameLen)
    // 第 11 位为 1 表示文件名是 UTF-8；否则多为本地编码，中文压缩软件常用 GBK
    const name =
      flags & 0x800 ? new TextDecoder('utf-8').decode(rawName) : decodeLegacyName(rawName)
    entries.set(name, { name, method, compressedSize, size, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function decodeLegacyName(raw: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw)
  } catch {
    return new TextDecoder('gb18030').decode(raw)
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const p = entry.localOffset
  if (view.getUint32(p, true) !== SIG_LOC) throw new ZipError(`条目 ${entry.name} 已损坏`)
  const nameLen = view.getUint16(p + 26, true)
  const extraLen = view.getUint16(p + 28, true)
  const start = p + 30 + nameLen + extraLen
  const data = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return data
  if (entry.method === 8) return inflateRaw(data)
  throw new ZipError(`不支持的压缩方式（${entry.method}）：${entry.name}`)
}

/** 按路径取条目，大小写不敏感（有些 EPUB 的清单与实际文件名大小写不一致） */
export function findEntry(entries: Map<string, ZipEntry>, path: string): ZipEntry | undefined {
  const direct = entries.get(path)
  if (direct) return direct
  const lower = path.toLowerCase()
  for (const [k, v] of entries) if (k.toLowerCase() === lower) return v
  return undefined
}
