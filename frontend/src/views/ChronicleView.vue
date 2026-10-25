<script setup lang="ts">
/**
 * Sector B：编年史
 * 主视图「时间之流」：按公元纪年排列全部事件；拖动「从多远的未来回看」，没有刻进石碑的事件逐渐风化。
 * 冥王星的石碑只刻得下五件事——历史是发生过的事，还是被记住的事？
 * 另有档案馆、百科、外传三个分册；条目管理沿用后端接口。风化逻辑见 sim/erosion.ts。
 */
import { ref, onMounted, computed, reactive, watch } from 'vue'
import { recordAnswer } from '@/data/answers'
import SectorHeader from '@/components/SectorHeader.vue'
import { sectorByPath } from '@/data/sectors'
import { CARVE_SLOTS, VANTAGES, erode, toggleCarve } from '@/sim/erosion'
import GalleryModule from '@/components/GalleryModule.vue'
import WikiModule from '@/components/WikiModule.vue'
import ApocryphaModule from '@/components/ApocryphaModule.vue'
import type { ChronicleEvent, ChronicleEventCreate } from '@/types/chronicle'
import { API, apiUrl, ERA_PRESETS, eventYearCE, normalizeEraYearInText } from '@/constants'
import { NModal, NButton, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NList, NListItem, NPopconfirm, useMessage } from 'naive-ui'
import { chronicleImageUrl } from '@/utils/imageFallback'

// 视图维度状态
type DimensionView = 'TIMELINE' | 'ARCHIVE' | 'ENCYCLOPEDIA' | 'APOCRYPHA'
const currentView = ref<DimensionView>('TIMELINE')

const events = ref<ChronicleEvent[]>([])
const loading = ref(true)
const selectedEvent = ref<ChronicleEvent | null>(null)
const showManageModal = ref(false)
const message = useMessage()

// Management (仅限 Timeline)
const isEditing = ref(false)
const editId = ref<number | null>(null)
const formData = reactive<ChronicleEventCreate>({
  era: '危机纪元',
  year: 2000,
  title: '',
  content: '',
  summary: '',
  image_url: '',
  event_type: 'pgc'
})

const eraOptions = ERA_PRESETS.map(e => ({ label: e, value: e }))
const typeOptions = [
  { label: '正典（官方事件）', value: 'pgc' },
  { label: '变体（同人创作）', value: 'ugc' }
]

function resetForm() {
  editId.value = null
  isEditing.value = false
  Object.assign(formData, {
    era: '危机纪元',
    year: 2000,
    title: '',
    content: '',
    summary: '',
    image_url: '',
    event_type: 'pgc'
  })
}

function openEdit(ev: ChronicleEvent) {
  editId.value = ev.id
  isEditing.value = true
  Object.assign(formData, {
    era: ev.era,
    year: ev.year,
    title: ev.title,
    content: ev.content,
    summary: ev.summary || '',
    image_url: ev.image_url || '',
    event_type: ev.event_type || 'pgc'
  })
}

async function handleDelete(id: number) {
  try {
    const res = await fetch(apiUrl(`${API.CHRONICLE_EVENTS}/${id}`), { method: 'DELETE' })
    if (!res.ok) throw new Error()
    message.success('已删除事件')
    loadEvents()
  } catch {
    message.error('删除失败')
  }
}

async function handleSave() {
  const url = editId.value 
    ? apiUrl(`${API.CHRONICLE_EVENTS}/${editId.value}`)
    : apiUrl(API.CHRONICLE_EVENTS)
  
  const method = editId.value ? 'PUT' : 'POST'
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    if (!res.ok) throw new Error()
    message.success(editId.value ? '事件已更新' : '事件已创建')
    isEditing.value = false
    loadEvents()
  } catch {
    message.error('保存失败')
  }
}


async function loadEvents() {
  loading.value = true
  try {
    const res = await fetch(apiUrl(API.CHRONICLE_EVENTS))
    if (!res.ok) throw new Error()
    events.value = (await res.json()) as ChronicleEvent[]
  } catch {
    console.error('Failed to load events')
  } finally {
    loading.value = false
  }
}

// 时间之流：按公元纪年统一排序（纪元起点 + 纪元内年数）
const timelineData = computed(() => {
  return [...events.value].sort((a, b) => eventYearCE(a.era, a.year) - eventYearCE(b.era, b.year))
})

/** 纪元对应的刻痕色：低饱和，只用在节点上 */
const ERA_ACCENT: Record<string, string> = {
  '黄金时代': '#c9b48a',
  '危机纪元': '#b0432f',
  '威慑纪元': '#8fa7c4',
  '掩体纪元': '#a99cc4',
  '广播纪元': '#9fb39a',
  '乱纪元': '#c08a5a',
  '银河纪元': '#b7a2b8',
}

function isSuperposition(ev: ChronicleEvent) {
  return (ev.causality_status || 'collapsed') === 'superposition' || ev.event_type === 'ugc'
}

function eraAccent(era: string): string {
  return ERA_ACCENT[era] ?? 'var(--weathered)'
}

/** 编年史视觉记录图 URL：优先 API，否则本地 /images/chronicles/{slug}.webp */
function chronicleEventImageUrl(ev: ChronicleEvent | null): string {
  if (!ev) return ''
  return chronicleImageUrl(ev.image_url, ev.title)
}

/** 配图缺失（如后端返回了不存在的地址）时隐藏，不显示破图标 */
function hideBrokenImage(e: Event) {
  ;(e.target as HTMLImageElement).style.display = 'none'
}

onMounted(loadEvents)

/* ---------- 风化与石碑 ---------- */
const question = sectorByPath('/sector-b')?.question
const vantage = ref(0)
const carved = ref<number[]>([])
const level = computed(() => VANTAGES[vantage.value].level)
const isCarved = (ev: ChronicleEvent) => carved.value.includes(ev.id)
function carve(ev: ChronicleEvent) {
  carved.value = toggleCarve(carved.value, ev.id)
}
function worn(ev: ChronicleEvent, text: string, salt: number) {
  return isCarved(ev) ? text : erode(text, level.value, ev.id * 31 + salt)
}
/** 完全风化的事件：在最远的未来只留下一道刻痕 */
const gone = (ev: ChronicleEvent) => !isCarved(ev) && level.value >= 1
const carvedEvents = computed(() => timelineData.value.filter(isCarved))
const VIEWS: { id: DimensionView; name: string }[] = [
  { id: 'TIMELINE', name: '时间之流' },
  { id: 'ARCHIVE', name: '档案馆' },
  { id: 'ENCYCLOPEDIA', name: '百科' },
  { id: 'APOCRYPHA', name: '外传' },
]

/* ---------- 读者的档案 ---------- */
watch(vantage, (v) => {
  if (v !== VANTAGES.length - 1) return
  recordAnswer('/sector-b', carvedEvents.value.length ? `刻进石碑：${carvedEvents.value.map((e) => e.title).join('、')}` : '什么都没有刻进石碑')
})
</script>

<template>
  <div class="sector-chronicle">
    <SectorHeader
      title="编年史"
      subtitle="从红岸到 647 号小宇宙，人类文明的全部记录。可是记录也会老去。"
      goal="选出最多五件事刻进冥王星的石碑，然后拖动「从多远的未来回看」，看看还剩下什么。"
      accent="#c9b48a"
    />

    <nav class="volumes" aria-label="分册">
      <button
        v-for="v in VIEWS"
        :key="v.id"
        type="button"
        :class="{ on: currentView === v.id }"
        :aria-pressed="currentView === v.id"
        @click="currentView = v.id"
      >{{ v.name }}</button>
      <button v-if="currentView === 'TIMELINE'" type="button" class="manage" @click="showManageModal = true">管理条目</button>
    </nav>

    <div v-if="currentView === 'TIMELINE'" class="stream">
      <div class="main">
        <section class="vantage" aria-label="从多远的未来回看">
          <div class="v-head">
            <span>从多远的未来回看</span>
            <b>{{ VANTAGES[vantage].label }}</b>
          </div>
          <input
            v-model.number="vantage"
            type="range"
            min="0"
            :max="VANTAGES.length - 1"
            step="1"
            class="v-range"
            aria-label="从多远的未来回看"
            :aria-valuetext="VANTAGES[vantage].label"
          />
          <ol class="v-ticks" aria-hidden="true">
            <li v-for="v in VANTAGES" :key="v.id" :class="{ on: v.id <= vantage }">{{ v.label }}</li>
          </ol>
          <p class="v-note">{{ VANTAGES[vantage].note }}</p>
        </section>

        <p v-if="loading" class="muted">正在调阅……</p>
        <p v-else-if="!timelineData.length" class="muted">档案馆暂时没有收到任何记录。</p>
        <ol v-else class="events">
          <li
            v-for="ev in timelineData"
            :key="ev.id"
            class="event"
            :class="{ carved: isCarved(ev), gone: gone(ev), selected: selectedEvent?.id === ev.id, variant: isSuperposition(ev) }"
            :style="{ '--era': eraAccent(ev.era) }"
          >
            <div class="when">
              <span class="era">{{ ev.era }}</span>
              <span class="num">公元 {{ eventYearCE(ev.era, ev.year) }}</span>
            </div>
            <div class="what">
              <button type="button" class="ev-open" :disabled="gone(ev)" @click="selectedEvent = ev">
                <span class="ev-title">{{ gone(ev) ? '　' : worn(ev, normalizeEraYearInText(ev.era, ev.year, ev.title), 1) }}</span>
                <span v-if="!gone(ev)" class="ev-summary">{{ worn(ev, normalizeEraYearInText(ev.era, ev.year, ev.summary || ev.content), 2) }}</span>
              </button>
              <span v-if="ev.event_type === 'ugc'" class="tag">同人变体</span>
            </div>
            <button
              type="button"
              class="carve"
              :aria-pressed="isCarved(ev)"
              :disabled="!isCarved(ev) && carved.length >= CARVE_SLOTS"
              @click="carve(ev)"
            >{{ isCarved(ev) ? '已刻入' : '刻入石碑' }}</button>
          </li>
        </ol>
      </div>

      <aside class="side">
        <section class="stone" aria-label="冥王星石碑">
          <h2 class="stone-title">冥王星石碑</h2>
          <p class="stone-count"><span class="num">{{ carved.length }}</span> / {{ CARVE_SLOTS }}</p>
          <ol v-if="carvedEvents.length" class="stone-lines">
            <li v-for="ev in carvedEvents" :key="ev.id">{{ normalizeEraYearInText(ev.era, ev.year, ev.title) }}</li>
          </ol>
          <p v-else class="muted">还没有刻下任何一件事。</p>
          <div v-if="vantage === VANTAGES.length - 1" class="verdict">
            <p v-if="carvedEvents.length">一千八百九十万年后的读者，只知道这 {{ carvedEvents.length }} 件事。对他们来说，人类的历史就是你选的这几行字。</p>
            <p v-else>一千八百九十万年后，什么都没有留下。人类曾经存在过，这件事本身也被忘记了。</p>
            <p class="q">{{ question }}</p>
            <RouterLink to="/sector-tomb" class="plain-btn">去给后来者留言：文明墓碑</RouterLink>
          </div>
        </section>

        <section v-if="selectedEvent" class="detail" aria-label="事件详情">
          <p class="d-when">{{ selectedEvent.era }} {{ selectedEvent.year }} 年 · 公元 <span class="num">{{ eventYearCE(selectedEvent.era, selectedEvent.year) }}</span></p>
          <h2 class="d-title">{{ worn(selectedEvent, normalizeEraYearInText(selectedEvent.era, selectedEvent.year, selectedEvent.title), 1) }}</h2>
          <p class="d-text">{{ worn(selectedEvent, normalizeEraYearInText(selectedEvent.era, selectedEvent.year, selectedEvent.content), 3) }}</p>
          <img
            v-if="chronicleEventImageUrl(selectedEvent) && level === 0"
            class="d-img"
            :src="chronicleEventImageUrl(selectedEvent)"
            :alt="selectedEvent.title"
            loading="lazy"
            @error="hideBrokenImage"
          />
          <button type="button" class="plain-btn" @click="selectedEvent = null">合上</button>
        </section>
      </aside>
    </div>

    <div v-else-if="currentView === 'ARCHIVE'" class="volume"><GalleryModule /></div>
    <div v-else-if="currentView === 'ENCYCLOPEDIA'" class="volume"><WikiModule /></div>
    <div v-else class="volume"><ApocryphaModule /></div>

    <!-- 管理模态框 -->
    <NModal v-model:show="showManageModal" preset="card" title="编年史数据库 // 编辑器" style="width: 800px; max-width: 90vw;">
      <div class="manage-container">
        <!-- 复用之前的管理界面逻辑 -->
        <div v-if="!isEditing" class="list-view">
          <div class="mb-4 flex justify-between items-center">
            <span>事件总数: {{ events.length }}</span>
            <NButton type="primary" @click="resetForm(); isEditing = true">新建条目</NButton>
          </div>
          <NList hoverable clickable>
            <NListItem v-for="ev in events" :key="ev.id">
              <div class="flex justify-between items-center">
                <div class="flex-1">
                  <div class="font-bold">[{{ ev.era }}] {{ ev.year }} - {{ normalizeEraYearInText(ev.era, ev.year, ev.title) }}</div>
                  <div class="text-xs text-gray-500 truncate">{{ ev.summary }}</div>
                </div>
                <NSpace>
                  <NButton size="tiny" @click="openEdit(ev)">编辑</NButton>
                  <NPopconfirm @positive-click="handleDelete(ev.id)">
                    <template #trigger>
                      <NButton size="tiny" type="error" ghost>删</NButton>
                    </template>
                    确认删除?
                  </NPopconfirm>
                </NSpace>
              </div>
            </NListItem>
          </NList>
        </div>

        <div v-else class="edit-view">
          <div class="mb-4 flex justify-between items-center">
            <h3 class="text-lg font-bold">{{ editId ? '编辑节点' : '注入节点' }}</h3>
            <NButton size="small" @click="isEditing = false">返回列表</NButton>
          </div>
          <NForm :model="formData" label-placement="left" label-width="80">
            <NFormItem label="纪元">
              <NSelect v-model:value="formData.era" :options="eraOptions" />
            </NFormItem>
            <NFormItem label="年份">
              <NInputNumber v-model:value="formData.year" />
            </NFormItem>
            <NFormItem label="标题">
              <NInput v-model:value="formData.title" />
            </NFormItem>
            <NFormItem label="摘要">
              <NInput v-model:value="formData.summary" type="textarea" :rows="2" />
            </NFormItem>
            <NFormItem label="正文">
              <NInput v-model:value="formData.content" type="textarea" :rows="5" />
            </NFormItem>
            <NFormItem label="图片URL">
              <NInput v-model:value="formData.image_url" />
            </NFormItem>
            <NFormItem label="类型">
              <NSelect v-model:value="formData.event_type" :options="typeOptions" />
            </NFormItem>
            <div class="flex justify-end gap-2">
              <NButton @click="isEditing = false">取消</NButton>
              <NButton type="primary" @click="handleSave">提交更改</NButton>
            </div>
          </NForm>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.sector-chronicle { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 80rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }

.volumes { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 1.75rem; border-bottom: 1px solid var(--incision-soft); }
.volumes button {
  padding: 0.6rem 1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--weathered);
  background: transparent;
  border: 0;
  border-bottom: 1px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}
.volumes button.on { color: var(--bone); border-bottom-color: var(--bone); }
.volumes .manage { margin-left: auto; font-size: 0.875rem; }

.stream { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem); gap: 2rem; align-items: start; }

.vantage { margin-bottom: 1.75rem; padding: 1.25rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.v-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.9375rem; color: var(--weathered); }
.v-head b { font-family: var(--font-serif); font-weight: 600; font-size: 1.125rem; color: var(--bone); }
.v-range { width: 100%; margin: 0.9rem 0 0.4rem; accent-color: var(--cherenkov); }
.v-ticks { display: flex; justify-content: space-between; list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; color: var(--incision); }
.v-ticks li.on { color: var(--weathered); }
.v-note { margin: 0.75rem 0 0; font-family: var(--font-serif); color: var(--gray-150); }

.events { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--incision); }
.event { position: relative; display: grid; grid-template-columns: 9rem minmax(0, 1fr) auto; gap: 1rem; align-items: start; padding: 0.9rem 0 0.9rem 1.25rem; border-bottom: 1px solid var(--incision-soft); transition: opacity 0.6s; }
.event::before { content: ''; position: absolute; left: -4px; top: 1.3rem; width: 7px; height: 7px; background: var(--era); }
.event.carved::before { left: -5px; width: 9px; height: 9px; background: var(--bone); }
.event.gone { opacity: 0.25; }
.when { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.8125rem; color: var(--weathered); }
.era { color: var(--era); }
.what { min-width: 0; }
.ev-open { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; padding: 0; text-align: left; font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.ev-open:disabled { cursor: default; }
.ev-title { font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; color: var(--bone); }
.ev-summary { font-size: 0.9375rem; line-height: 1.75; color: var(--gray-200); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.event.selected .ev-title { color: var(--cherenkov); }
.event.carved .ev-title { letter-spacing: 0.04em; }
.tag { display: inline-block; margin-top: 0.35rem; font-size: 0.75rem; color: var(--weathered); border: 1px solid var(--incision); padding: 0 0.35rem; }
.carve {
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.carve[aria-pressed='true'] { color: var(--bone); border-color: var(--bone); }
.carve:disabled { opacity: 0.35; cursor: not-allowed; }

.side { position: sticky; top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.stone {
  padding: 1.25rem;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.03), transparent 60%),
    #26272a;
  border: 1px solid var(--incision);
}
.stone-title { margin: 0; font-family: var(--font-serif); font-weight: 900; font-size: 1.25rem; letter-spacing: 0.12em; color: var(--bone); }
.stone-count { margin: 0.25rem 0 1rem; font-size: 0.8125rem; color: var(--weathered); }
.stone-lines { margin: 0 0 0.5rem; padding-left: 1.25rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--bone); }
.verdict { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--incision); }
.verdict p { margin: 0 0 0.75rem; font-family: var(--font-serif); line-height: 1.85; color: var(--gray-150); }
.verdict .q { padding-left: 0.9rem; border-left: 1px solid #c9b48a; color: var(--bone); }

.detail { padding: 1.25rem; background: var(--slab); border: 1px solid var(--incision-soft); }
.d-when { margin: 0 0 0.5rem; font-size: 0.8125rem; color: var(--weathered); }
.d-title { margin: 0 0 0.75rem; font-family: var(--font-serif); font-size: 1.25rem; color: var(--bone); }
.d-text { margin: 0 0 1rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.9; color: var(--gray-150); max-height: 22rem; overflow-y: auto; white-space: pre-line; }
.d-img { display: block; width: 100%; margin-bottom: 1rem; filter: grayscale(0.4); }

.plain-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.1rem;
  font: inherit;
  font-size: 0.9375rem;
  color: var(--bone);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
  text-decoration: none;
}
.plain-btn:hover { border-color: var(--weathered); }
.manage-container { max-height: 70vh; overflow-y: auto; }

@media (max-width: 960px) {
  .stream { grid-template-columns: 1fr; }
  .side { position: static; order: -1; }
  .event { grid-template-columns: minmax(0, 1fr) auto; }
  .when { grid-column: 1 / -1; flex-direction: row; gap: 0.75rem; }
}
</style>
