<script setup lang="ts">
/**
 * 原著阅读：在本机打开 TXT 与 EPUB。
 * - 文件只在浏览器里解析，存进本机的 IndexedDB 书架，不上传。
 * - TXT 自动识别 UTF-8 / GB18030（GBK）/ Big5 / UTF-16；识别有误时可手动换编码重新解码。
 * - EPUB 2 / 3：按阅读顺序取章节，目录标题取自 nav 或 NCX，章节按各自声明的编码解码。
 * 解析见 src/reader/。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import SectorHeader from '@/components/SectorHeader.vue'
import Vitrine from '@/components/Vitrine.vue'
import { ENCODING_LABELS, type TextEncodingName } from '@/reader/encoding'
import { importFile, ImportError, MAX_BYTES } from '@/reader/importer'
import { EpubError } from '@/reader/epub'
import {
  allProgress,
  deleteBook,
  listBooks,
  loadBook,
  loadProgress,
  saveBook,
  saveProgress,
  type ShelfItem,
} from '@/reader/library'
import { searchBook, type Hit } from '@/reader/search'
import type { Progress, StoredBook } from '@/reader/types'

/* ---------- 书架 ---------- */
const shelf = ref<ShelfItem[]>([])
const progressMap = ref<Map<string, Progress>>(new Map())
async function refreshShelf() {
  shelf.value = await listBooks()
  progressMap.value = await allProgress()
}
function progressOf(item: ShelfItem): number {
  const p = progressMap.value.get(item.id)
  if (!p || !item.chapterCount) return 0
  return Math.round(((p.chapter + p.ratio) / item.chapterCount) * 100)
}
const wan = (n: number) => (n >= 10000 ? `约 ${(n / 10000).toFixed(n >= 100000 ? 0 : 1)} 万字` : `${n} 字`)

/* ---------- 导入 ---------- */
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const dragging = ref(false)

async function importBytes(name: string, bytes: Uint8Array, forced?: TextEncodingName) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await importFile(name, bytes, forced)
    const saved = await saveBook(result.book)
    await refreshShelf()
    const enc = result.detection
      ? `编码 ${ENCODING_LABELS[result.detection.encoding]}${forced ? '（手动选择）' : '（自动识别）'}，`
      : ''
    notice.value = `已放入书架：《${result.book.title}》，${enc}${result.book.chapters.length} 章，${wan(result.book.chars)}。${saved ? '' : '本机存储不可用，关闭页面后不会保留。'}`
    await openBook(result.book.id, result.book, result.garble)
  } catch (e) {
    error.value = e instanceof ImportError || e instanceof EpubError ? e.message : '解析失败：文件可能已损坏，或不是 TXT / EPUB'
  } finally {
    busy.value = false
  }
}

async function handleFiles(files: FileList | null | undefined) {
  const file = files?.[0]
  if (!file) return
  if (file.size > MAX_BYTES) {
    error.value = '文件超过 60 MB，暂不支持'
    return
  }
  await importBytes(file.name, new Uint8Array(await file.arrayBuffer()))
  if (fileInput.value) fileInput.value.value = ''
}
function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files)
}

const pendingDelete = ref<string | null>(null)
async function removeBook(id: string) {
  if (pendingDelete.value !== id) {
    pendingDelete.value = id
    return
  }
  pendingDelete.value = null
  await deleteBook(id)
  await refreshShelf()
}

/* ---------- 阅读 ---------- */
const book = shallowRef<StoredBook | null>(null)
const chapterIndex = ref(0)
const chapter = computed(() => book.value?.chapters[chapterIndex.value])
const garble = ref(0)
const showToc = ref(false)
const showSettings = ref(false)
const tocFilter = ref('')
const searchQuery = ref('')
const hits = ref<Hit[]>([])
const flashPara = ref<number | null>(null)

const filteredToc = computed(() => {
  const chs = book.value?.chapters ?? []
  const q = tocFilter.value.trim()
  return chs.map((c, i) => ({ title: c.title, i })).filter((c) => !q || c.title.includes(q))
})
const bookPercent = computed(() => {
  if (!book.value) return 0
  return Math.min(100, Math.round(((chapterIndex.value + scrollRatio.value) / book.value.chapters.length) * 100))
})

function scroller(): HTMLElement | null {
  return document.querySelector('.app-main')
}
const scrollRatio = ref(0)
let saveTimer: ReturnType<typeof setTimeout> | undefined
function onScroll() {
  const el = scroller()
  if (!el || !book.value) return
  const max = el.scrollHeight - el.clientHeight
  scrollRatio.value = max > 0 ? Math.min(1, el.scrollTop / max) : 0
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persistProgress, 400)
}
function persistProgress() {
  if (!book.value) return
  saveProgress({ bookId: book.value.id, chapter: chapterIndex.value, ratio: scrollRatio.value, updatedAt: Date.now() })
}

async function openBook(id: string, preloaded?: StoredBook, garbleRatio = 0) {
  const b = preloaded ?? (await loadBook(id))
  if (!b) {
    error.value = '这本书已不在本机书架里，请重新导入'
    await refreshShelf()
    return
  }
  book.value = b
  garble.value = garbleRatio
  showToc.value = false
  searchQuery.value = ''
  hits.value = []
  const p = preloaded ? undefined : await loadProgress(id)
  await goChapter(p ? Math.min(p.chapter, b.chapters.length - 1) : 0, p?.ratio ?? 0)
}
function closeBook() {
  persistProgress()
  book.value = null
  refreshShelf()
  nextTick(() => scroller()?.scrollTo({ top: 0 }))
}

async function goChapter(i: number, ratio = 0) {
  if (!book.value) return
  chapterIndex.value = Math.max(0, Math.min(book.value.chapters.length - 1, i))
  showToc.value = false
  await nextTick()
  const el = scroller()
  if (el) el.scrollTop = ratio * Math.max(0, el.scrollHeight - el.clientHeight)
  scrollRatio.value = ratio
  persistProgress()
}

async function jumpToHit(h: Hit) {
  await goChapter(h.chapter)
  await nextTick()
  document.getElementById(`para-${h.paragraph}`)?.scrollIntoView({ block: 'center' })
  flashPara.value = h.paragraph
  setTimeout(() => (flashPara.value = null), 2000)
}
watch(searchQuery, (q) => {
  hits.value = book.value && q.trim().length >= 1 ? searchBook(book.value, q) : []
})

/** 换一种编码重新解码（仅 TXT，原始字节保存在书架里） */
const ENCODINGS: TextEncodingName[] = ['utf-8', 'gb18030', 'big5', 'utf-16le', 'utf-16be']
async function redecode(enc: TextEncodingName) {
  const b = book.value
  if (!b?.raw) return
  await importBytes(b.fileName, b.raw, enc)
}

/* ---------- 阅读设置（每位读者自己的偏好，存在本机浏览器） ---------- */
type Theme = 'basalt' | 'paper' | 'night'
interface Prefs {
  size: number
  leading: number
  width: 'narrow' | 'medium' | 'wide'
  theme: Theme
  face: 'serif' | 'sans'
}
const PREFS_KEY = '3body:reader-prefs'
function readPrefs(): Prefs {
  const d: Prefs = { size: 19, leading: 1.95, width: 'medium', theme: 'basalt', face: 'serif' }
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return d
  }
}
const prefs = ref<Prefs>(readPrefs())
watch(
  prefs,
  (v) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(v))
    } catch {
      /* 存储不可用时只在本次生效 */
    }
  },
  { deep: true },
)
const THEMES: { id: Theme; name: string }[] = [
  { id: 'basalt', name: '玄武' },
  { id: 'paper', name: '纸本' },
  { id: 'night', name: '墨夜' },
]
const WIDTHS = { narrow: '30em', medium: '36em', wide: '44em' }
const WIDTH_OPTS: { id: Prefs['width']; name: string }[] = [
  { id: 'narrow', name: '窄' },
  { id: 'medium', name: '中' },
  { id: 'wide', name: '宽' },
]

function onKey(e: KeyboardEvent) {
  if (!book.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'ArrowRight') goChapter(chapterIndex.value + 1)
  else if (e.key === 'ArrowLeft') goChapter(chapterIndex.value - 1)
  else if (e.key === 'Escape') {
    showToc.value = false
    showSettings.value = false
  }
}

/** 书架上已有书时，直接翻开最近读过的那本（没读过就翻开第一本），而不是停在导入页；合上书仍回到书架 */
async function openLatest() {
  await refreshShelf()
  if (book.value || !shelf.value.length) return
  let latest = shelf.value[0]
  let at = -1
  for (const item of shelf.value) {
    const t = progressMap.value.get(item.id)?.updatedAt ?? -1
    if (t > at) {
      at = t
      latest = item
    }
  }
  await openBook(latest.id)
}

onMounted(() => {
  void openLatest()
  window.addEventListener('keydown', onKey)
  scroller()?.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => {
  persistProgress()
  window.removeEventListener('keydown', onKey)
  scroller()?.removeEventListener('scroll', onScroll)
  clearTimeout(saveTimer)
})
</script>

<template>
  <div
    class="reading-room"
    :data-theme="book ? prefs.theme : 'basalt'"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <input ref="fileInput" type="file" accept=".txt,.epub,text/plain,application/epub+zip" class="hidden-input" @change="handleFiles(($event.target as HTMLInputElement).files)" />

    <!-- ========== 书架 ========== -->
    <template v-if="!book">
      <SectorHeader
        title="原著阅读"
        subtitle="把你手里的 TXT 或 EPUB 放进档案馆。文件只在这台设备上解析与保存，不会上传。"
        goal="拖入或选择一个文件。书会留在本机的书架上，下次从上次读到的地方继续。"
      />

      <Vitrine>
        <button type="button" class="drop" :class="{ over: dragging, busy }" :disabled="busy" @click="fileInput?.click()">
          <span class="drop-title">{{ busy ? '正在解析……' : dragging ? '松开，放进书架' : '把文件拖到这里，或点击选择' }}</span>
          <span class="drop-sub">TXT：自动识别 UTF-8、GBK / GB18030、Big5、UTF-16　·　EPUB：2.0 与 3.0</span>
        </button>
        <p v-if="error" class="msg err" role="alert">{{ error }}</p>
        <p v-else-if="notice" class="msg ok" role="status">{{ notice }}</p>
      </Vitrine>

      <section class="shelf" aria-label="书架">
        <h2 class="shelf-title">书架</h2>
        <p v-if="!shelf.length" class="shelf-empty">还没有书。导入之后，它会一直留在这台设备上。</p>
        <ul v-else class="shelf-list">
          <li v-for="item in shelf" :key="item.id" class="book-row">
            <button type="button" class="book-open" @click="openBook(item.id)">
              <span class="book-title">{{ item.title }}</span>
              <span class="book-meta">
                <span v-if="item.author">{{ item.author }}</span>
                <span>{{ item.format === 'epub' ? 'EPUB' : 'TXT' }}</span>
                <span>{{ item.chapterCount }} 章</span>
                <span>{{ wan(item.chars) }}</span>
              </span>
              <span class="book-progress" aria-hidden="true"><span :style="{ width: progressOf(item) + '%' }"></span></span>
              <span class="book-progress-text">{{ progressOf(item) ? `读到 ${progressOf(item)}%` : '未开始' }}</span>
            </button>
            <button type="button" class="book-delete" :class="{ armed: pendingDelete === item.id }" @click="removeBook(item.id)" @blur="pendingDelete = null">
              {{ pendingDelete === item.id ? '再点一次，从书架删除' : '删除' }}
            </button>
          </li>
        </ul>
      </section>
    </template>

    <!-- ========== 阅读 ========== -->
    <template v-else>
      <header class="bar">
        <button type="button" class="bar-btn" @click="closeBook">书架</button>
        <div class="bar-title">
          <span class="bar-book">{{ book.title }}</span>
          <span class="bar-chapter">{{ chapter?.title }}</span>
        </div>
        <span class="bar-pct num">{{ bookPercent }}%</span>
        <button type="button" class="bar-btn" :aria-expanded="showToc" @click="showToc = !showToc; showSettings = false">目录与搜索</button>
        <button type="button" class="bar-btn" :aria-expanded="showSettings" @click="showSettings = !showSettings; showToc = false">版式</button>
      </header>

      <div v-if="garble > 0.01 && book.raw" class="garble" role="alert">
        <span>文字看起来像乱码？换一种编码重新解码：</span>
        <button v-for="enc in ENCODINGS" :key="enc" type="button" :class="{ on: book.encoding === enc }" @click="redecode(enc)">
          {{ ENCODING_LABELS[enc] }}
        </button>
      </div>

      <transition name="panel">
        <aside v-if="showSettings" class="panel settings" aria-label="版式">
          <label class="set">
            <span>字号 <b class="num">{{ prefs.size }}</b></span>
            <input v-model.number="prefs.size" type="range" min="15" max="26" step="1" />
          </label>
          <label class="set">
            <span>行距 <b class="num">{{ prefs.leading.toFixed(2) }}</b></span>
            <input v-model.number="prefs.leading" type="range" min="1.5" max="2.4" step="0.05" />
          </label>
          <div class="set">
            <span>版心</span>
            <div class="seg">
              <button v-for="w in WIDTH_OPTS" :key="w.id" type="button" :class="{ on: prefs.width === w.id }" @click="prefs.width = w.id">{{ w.name }}</button>
            </div>
          </div>
          <div class="set">
            <span>字体</span>
            <div class="seg">
              <button type="button" :class="{ on: prefs.face === 'serif' }" @click="prefs.face = 'serif'">宋体</button>
              <button type="button" :class="{ on: prefs.face === 'sans' }" @click="prefs.face = 'sans'">黑体</button>
            </div>
          </div>
          <div class="set">
            <span>底色</span>
            <div class="seg">
              <button v-for="t in THEMES" :key="t.id" type="button" :class="{ on: prefs.theme === t.id }" @click="prefs.theme = t.id">{{ t.name }}</button>
            </div>
          </div>
          <div v-if="book.raw" class="set">
            <span>编码 <b>{{ ENCODING_LABELS[book.encoding as TextEncodingName] ?? book.encoding }}</b></span>
            <div class="seg wrap">
              <button v-for="enc in ENCODINGS" :key="enc" type="button" :class="{ on: book.encoding === enc }" @click="redecode(enc)">{{ ENCODING_LABELS[enc] }}</button>
            </div>
          </div>
        </aside>
      </transition>

      <transition name="panel">
        <aside v-if="showToc" class="panel toc" aria-label="目录与搜索">
          <input v-model="searchQuery" type="search" class="field" placeholder="在全书中搜索" aria-label="在全书中搜索" />
          <ul v-if="searchQuery.trim()" class="hits">
            <li v-if="!hits.length" class="muted">没有找到。</li>
            <li v-for="(h, k) in hits" :key="k">
              <button type="button" @click="jumpToHit(h)">
                <span class="hit-ch">{{ book.chapters[h.chapter].title }}</span>
                <span class="hit-text">…{{ h.before }}<mark>{{ h.match }}</mark>{{ h.after }}…</span>
              </button>
            </li>
          </ul>
          <template v-else>
            <input v-if="book.chapters.length > 12" v-model="tocFilter" type="search" class="field" placeholder="筛选章节" aria-label="筛选章节" />
            <ol class="toc-list">
              <li v-for="c in filteredToc" :key="c.i">
                <button type="button" :class="{ current: c.i === chapterIndex }" :aria-current="c.i === chapterIndex ? 'true' : undefined" @click="goChapter(c.i)">
                  {{ c.title }}
                </button>
              </li>
            </ol>
          </template>
        </aside>
      </transition>

      <article
        v-if="chapter"
        class="page"
        :class="prefs.face"
        :style="{ '--size': prefs.size + 'px', '--leading': prefs.leading, '--measure': WIDTHS[prefs.width] }"
      >
        <h1 class="ch-title">{{ chapter.title }}</h1>
        <p
          v-for="(p, k) in chapter.paragraphs"
          :id="`para-${k}`"
          :key="k"
          class="para"
          :class="{ flash: flashPara === k }"
        >{{ p }}</p>
        <p v-if="!chapter.paragraphs.length" class="para muted">（这一章没有文字。）</p>
        <nav class="ch-nav" aria-label="翻章">
          <button type="button" class="bar-btn" :disabled="chapterIndex === 0" @click="goChapter(chapterIndex - 1)">上一章</button>
          <span class="ch-count num">{{ chapterIndex + 1 }} / {{ book.chapters.length }}</span>
          <button type="button" class="bar-btn" :disabled="chapterIndex >= book.chapters.length - 1" @click="goChapter(chapterIndex + 1)">下一章</button>
        </nav>
        <p class="ch-hint">← → 键翻章</p>
      </article>
    </template>
  </div>
</template>

<style scoped>
.reading-room {
  --page-bg: transparent;
  --ink: var(--bone);
  --ink-soft: var(--weathered);
  --rule: var(--incision);
  --mark: rgba(var(--cherenkov-rgb), 0.35);
  position: relative;
  min-height: 100%;
  padding: 2rem clamp(1rem, 4vw, 3rem) 4rem;
  background: var(--page-bg);
  color: var(--ink);
  transition: background 0.4s, color 0.4s;
}
.reading-room[data-theme='paper'] {
  /* 纸本 = VI 拓片主题 */
  --page-bg: #ece7dc;
  --ink: #1d1e21;
  --ink-soft: #5f5a50;
  --rule: #cfc8b8;
  --mark: rgba(176, 67, 47, 0.25);
}
.reading-room[data-theme='night'] {
  --page-bg: #0d0e0f;
  --ink: #a9a396;
  --ink-soft: #6e6a62;
  --rule: #26282b;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--ink-soft); }
.hidden-input { display: none; }

/* 书架 */
.drop {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 3rem 1.5rem;
  font: inherit;
  color: var(--bone);
  background: rgba(var(--cherenkov-rgb), 0.03);
  border: 1px dashed var(--incision);
  border-radius: 2px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.drop:hover, .drop.over { border-color: var(--cherenkov); background: rgba(var(--cherenkov-rgb), 0.07); }
.drop.busy { cursor: progress; }
.drop-title { font-family: var(--font-serif); font-size: 1.25rem; letter-spacing: 0.06em; }
.drop-sub { font-size: 0.875rem; color: var(--weathered); text-align: center; }
.msg { margin: 1rem 0 0; font-size: 0.9375rem; line-height: 1.7; }
.msg.err { color: var(--rust-bright); }
.msg.ok { color: var(--gray-200); }

.shelf { margin-top: 2.5rem; max-width: 52rem; }
.shelf-title { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1.25rem; font-weight: 600; letter-spacing: 0.1em; color: var(--bone); }
.shelf-empty { margin: 0; font-size: 0.9375rem; color: var(--weathered); }
.shelf-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--incision-soft); }
.book-row { display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid var(--incision-soft); }
.book-open {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem 1rem;
  padding: 1rem 0.25rem;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}
.book-open:hover .book-title { color: var(--white); }
.book-title { grid-column: 1; font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-meta { grid-column: 1; display: flex; flex-wrap: wrap; gap: 0 1rem; font-size: 0.8125rem; color: var(--weathered); }
.book-progress { grid-column: 2; grid-row: 1; align-self: center; width: 7rem; height: 2px; background: var(--incision-soft); }
.book-progress span { display: block; height: 100%; background: var(--cherenkov); }
.book-progress-text { grid-column: 2; grid-row: 2; font-size: 0.8125rem; color: var(--weathered); text-align: right; }
.book-delete { flex-shrink: 0; padding: 0.35rem 0.6rem; font: inherit; font-size: 0.8125rem; color: var(--weathered); background: none; border: 1px solid transparent; border-radius: 2px; cursor: pointer; }
.book-delete:hover { border-color: var(--incision); }
.book-delete.armed { color: var(--rust-bright); border-color: rgba(210, 85, 63, 0.6); }

/* 阅读 */
.bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: -2rem calc(-1 * clamp(1rem, 4vw, 3rem)) 0;
  padding: 0.7rem clamp(1rem, 4vw, 3rem);
  background: color-mix(in srgb, var(--page-bg) 92%, transparent);
  border-bottom: 1px solid var(--rule);
  backdrop-filter: blur(6px);
}
.reading-room[data-theme='basalt'] .bar { background: rgba(19, 20, 22, 0.94); }
.bar-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bar-book { font-size: 0.8125rem; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-chapter { font-family: var(--font-serif); font-size: 0.9375rem; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-pct { font-size: 0.8125rem; color: var(--ink-soft); }
.bar-btn {
  flex-shrink: 0;
  padding: 0.4rem 0.8rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
}
.bar-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.bar-btn[aria-expanded='true'] { border-color: var(--cherenkov); }

.garble {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  max-width: var(--measure, 36em);
  margin: 1rem auto 0;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--ink);
  border: 1px solid rgba(210, 85, 63, 0.5);
}
.garble button, .seg button {
  padding: 0.3rem 0.65rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
}
.garble button.on, .seg button.on { border-color: var(--cherenkov); color: var(--cherenkov); }

.panel {
  position: fixed;
  top: 7.5rem;
  right: clamp(1rem, 4vw, 3rem);
  z-index: 30;
  width: min(24rem, calc(100vw - 2rem));
  max-height: calc(100vh - 11rem);
  overflow-y: auto;
  padding: 1.25rem;
  color: var(--bone);
  background: var(--slab);
  border: 1px solid var(--incision);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.panel-enter-active, .panel-leave-active { transition: opacity 0.2s; }
.panel-enter-from, .panel-leave-to { opacity: 0; }
.set { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.1rem; font-size: 0.875rem; color: var(--weathered); }
.set > span { display: flex; justify-content: space-between; }
.set b { font-weight: 400; color: var(--bone); }
.set input[type='range'] { width: 100%; accent-color: var(--cherenkov); }
.seg { display: flex; gap: 0.35rem; }
.seg.wrap { flex-wrap: wrap; }
.seg button { color: var(--bone); border-color: var(--incision); }
.field {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: var(--void);
  border: 1px solid var(--incision);
  border-radius: 2px;
}
.field:focus { outline: none; border-color: var(--cherenkov); }
.toc-list, .hits { list-style: none; margin: 0; padding: 0; }
.toc-list button, .hits button {
  width: 100%;
  padding: 0.5rem 0.6rem;
  font: inherit;
  text-align: left;
  color: var(--gray-200);
  background: none;
  border: 0;
  border-left: 2px solid transparent;
  cursor: pointer;
}
.toc-list button { font-family: var(--font-serif); font-size: 0.9375rem; }
.toc-list button:hover, .hits button:hover { background: var(--slab-raised); }
.toc-list button.current { color: var(--bone); border-left-color: var(--cherenkov); }
.hits button { display: flex; flex-direction: column; gap: 0.2rem; }
.hit-ch { font-size: 0.75rem; color: var(--weathered); }
.hit-text { font-family: var(--font-serif); font-size: 0.9375rem; line-height: 1.6; }
mark { background: var(--mark); color: inherit; padding: 0 1px; }

.page { max-width: var(--measure); margin: 2.5rem auto 0; }
.ch-title {
  margin: 0 0 2rem;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: calc(var(--size) * 1.6);
  line-height: 1.35;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.para {
  margin: 0 0 0.9em;
  font-family: var(--font-serif);
  font-size: var(--size);
  line-height: var(--leading);
  text-indent: 2em;
  text-align: justify;
  color: var(--ink);
  overflow-wrap: anywhere;
  transition: background 0.6s;
}
.sans .para { font-family: var(--font-sans); }
.para.flash { background: var(--mark); }
.ch-nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); }
.ch-count { font-size: 0.875rem; color: var(--ink-soft); }
.ch-hint { margin: 1rem 0 0; text-align: center; font-size: 0.75rem; color: var(--ink-soft); }

@media (max-width: 768px) {
  .bar { gap: 0.4rem; }
  .bar-pct { display: none; }
  .bar-btn { padding: 0.35rem 0.55rem; font-size: 0.8125rem; }
  .panel { top: auto; bottom: 0; right: 0; left: 0; width: auto; max-height: 70vh; border-left: 0; border-right: 0; }
  .book-progress { width: 4rem; }
  .ch-hint { display: none; }
  .para { text-align: left; }
}
</style>
