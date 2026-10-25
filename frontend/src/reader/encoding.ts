/**
 * 文本编码识别与解码：避免中文 TXT 乱码。
 *
 * 顺序：
 * 1. 字节序标记（BOM）：UTF-8 / UTF-16LE / UTF-16BE，直接确定；
 * 2. 无 BOM 的 UTF-16：以英文为主时零字节集中在奇数或偶数位，直接判定；
 *    以中文为主时零字节很少，但只要出现零字节，就把 UTF-16 加入第 4 步的候选；
 * 3. 严格 UTF-8 解码成功 → UTF-8（绝大多数 UTF-8 文件走这里）；
 * 4. 否则在 UTF-8（宽松）、GB18030（兼容 GBK / GB2312）、Big5 之间打分：
 *    统计常用汉字、标点与 ASCII 所占比例，替换符（U+FFFD）与私用区字符重罚。
 *    GB18030 几乎能「成功」解码任何字节，所以不能只看是否报错，必须看解出来的字像不像中文。
 */

export type TextEncodingName = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030' | 'big5'

export const ENCODING_LABELS: Record<TextEncodingName, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16（小端）',
  'utf-16be': 'UTF-16（大端）',
  gb18030: 'GB18030 / GBK',
  big5: 'Big5（繁体）',
}

/** 现代汉语最常用的约 500 个字（简体） */
const COMMON_SC =
  '的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼等体却加电主界门利海受听表德少克代员许稜先口由死安写性马光白或住难望教命花结乐色更拉东神记处让母父应直字场平报友关放至张认接告入笑内英军候民岁往何度山觉路带万男边风解叫任金快原吃妈变通师立象数四失满战远格士音轻目条呢病始达深完今提求清王化空业思切怎非找片罗钱紧吗言故语兴微类该影线管收双指石越程星群似层流系待阳兵切观林黑热船转科区球决易怕持飞且离亮云往近反朝改今团照华站段注量布团视丽传号城设联倒确且息消低火首争送江河速持脸周团史帝宇宙文明森林三体罗辑叶洁汪淼程心章'

/** 常用繁体字（与简体不同形的那部分） */
const COMMON_TC =
  '們這個國為來說時會對過後學開與還見問現點東動長於經當麼沒種樣裡從無麼話實應進頭聲車機將電書們聽寫個區員條門關問題業體們歲歷隨際顯變親設讓認識論識義記愛數萬總準備藝術導運氣師遠邊離難觀華語紀雙處於傳號應級紅黃藍綠島島陽陰廣衛貓鳥龍風飛馬魚'

const COMMON = new Set([...COMMON_SC, ...COMMON_TC])
const PUNCT = new Set([...'，。！？、；：“”‘’（）《》〈〉【】…—·「」『』　'])

function stats(text: string): { score: number; bad: number; total: number } {
  let total = 0
  let good = 0
  let bad = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t') continue
    total += 1
    if (c === 0xfffd) bad += 1
    else if (c >= 0xe000 && c <= 0xf8ff) bad += 1 // 私用区：几乎总是错码
    else if (c < 0x20) bad += 1
    else if (c < 0x7f) good += 0.5 // ASCII：中性偏正
    else if (COMMON.has(ch) || PUNCT.has(ch)) good += 1
  }
  if (!total) return { score: 0, bad: 0, total: 0 }
  return { score: good / total - (bad / total) * 5, bad, total }
}

function bom(bytes: Uint8Array): TextEncodingName | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  return null
}

/** 无 BOM 的 UTF-16：中文文本中 ASCII（换行、空格、数字）的高字节为零 */
function sniffUtf16(bytes: Uint8Array): TextEncodingName | null {
  const n = Math.min(bytes.length, 8192) & ~1
  if (n < 16) return null
  let evenZero = 0
  let oddZero = 0
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) evenZero += 1
    if (bytes[i + 1] === 0) oddZero += 1
  }
  const half = n / 2
  if (oddZero / half > 0.2 && evenZero / half < 0.02) return 'utf-16le'
  if (evenZero / half > 0.2 && oddZero / half < 0.02) return 'utf-16be'
  return null
}

function decodeWith(bytes: Uint8Array, enc: TextEncodingName, fatal = false): string {
  return new TextDecoder(enc, { fatal }).decode(bytes)
}

export interface Detection {
  encoding: TextEncodingName
  /** 识别依据，便于在界面上解释 */
  reason: 'bom' | 'utf16' | 'utf8-strict' | 'scored'
  /** 0–1，越高越可信 */
  confidence: number
}

export function detectEncoding(bytes: Uint8Array): Detection {
  const b = bom(bytes)
  if (b) return { encoding: b, reason: 'bom', confidence: 1 }
  const u16 = sniffUtf16(bytes)
  if (u16) return { encoding: u16, reason: 'utf16', confidence: 0.9 }
  try {
    decodeWith(bytes, 'utf-8', true)
    return { encoding: 'utf-8', reason: 'utf8-strict', confidence: 0.99 }
  } catch {
    /* 不是合法 UTF-8，继续打分 */
  }
  // 打分只看开头一段，足以区分，又不至于对几兆的文件做三次全量解码
  const sample = bytes.subarray(0, Math.min(bytes.length, 96 * 1024))
  const candidates: TextEncodingName[] = ['gb18030', 'big5', 'utf-8']
  // GBK、Big5、UTF-8 的中文文本里从不出现零字节；出现了，就把 UTF-16 也列为候选
  if (sample.includes(0) && sample.length % 2 === 0) candidates.push('utf-16le', 'utf-16be')
  const scored = candidates.map((enc) => ({ enc, ...stats(decodeWith(sample, enc)) }))
  scored.sort((a, b2) => b2.score - a.score)
  const best = scored[0]
  const second = scored[1]
  const confidence = Math.max(0, Math.min(1, 0.5 + (best.score - second.score)))
  return { encoding: best.enc, reason: 'scored', confidence }
}

/** 解码为文本，并去掉 BOM、统一换行 */
export function decodeText(bytes: Uint8Array, forced?: TextEncodingName): { text: string; detection: Detection } {
  const detection = forced ? { encoding: forced, reason: 'scored' as const, confidence: 1 } : detectEncoding(bytes)
  let text = decodeWith(bytes, detection.encoding)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n?/g, '\n')
  return { text, detection }
}

/** 解出的文本里错码（替换符、私用区）所占比例，用来提醒用户手动换编码 */
export function garbleRatio(text: string): number {
  const s = stats(text.slice(0, 200_000))
  return s.total ? s.bad / s.total : 0
}
