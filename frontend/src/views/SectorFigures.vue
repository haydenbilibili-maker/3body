<script setup lang="ts">
/**
 * 扇区 E：人物志 (Sector Figures)
 * 档案风格展示三体关键人物：关键决策、关键语录、人物关系图谱
 * 子模块：档案列表 | 关系星图（Constellation Network）
 */
import { ref, onMounted, computed, nextTick } from 'vue'
import { NModal, NProgress, NTimeline, NTimelineItem, NInput, NButton, NCheckbox, NCollapse, NCollapseItem, NFormItem } from 'naive-ui'
import { API, apiUrl } from '@/constants'
import type { Figure, KeyDecision, FigureRelationship, KeyQuote } from '@/types/figures'
import FiguresNetworkGraph from '@/components/FiguresNetworkGraph.vue'
import SectorHeader from '@/components/SectorHeader.vue'
import { sectorByPath } from '@/data/sectors'
import { figureImageUrl } from '@/utils/imageFallback'
import { hasDialogue, getDialogueSet } from '@/data/figureDialogues'
import { useLlmConfigStore } from '@/stores/llmConfig'
import FigureTalk from '@/components/FigureTalk.vue'

const figures = ref<Figure[]>([])
const loading = ref(true)
const selectedFigure = ref<Figure | null>(null)
const searchQuery = ref('')
/** 选择式对话：是否显示对话模态 */
const showDialogueModal = ref(false)
/** 对话消息列表：user / figure，统一为实时对话（预埋问题仅作引导，回复均由 AI 生成） */
const conversation = ref<{ role: 'user' | 'figure'; content: string }[]>([])
const dialogueLoading = ref(false)
const dialogueError = ref('')
const dialogueInput = ref('')
/** 滚动到底部的 ref，用于对话列表 */
const dialogueListRef = ref<HTMLElement | null>(null)
const llmConfig = useLlmConfigStore()
/** 子模块：'list' 档案列表 | 'graph' 关系星图 */
const subModule = ref<'list' | 'graph' | 'choices'>('list')
const question = sectorByPath('/sector-p')?.question

/** 一个人的选择：所有人物的关键决策，按出场顺序排成一列；后果要自己翻开 */
const allChoices = computed(() =>
  figures.value.flatMap((f) => keyDecisions(f).map((d, i) => ({ key: `${f.id}-${i}`, who: f, d }))),
)
const revealed = ref<Set<string>>(new Set())
function reveal(k: string) {
  revealed.value = new Set(revealed.value).add(k)
}
const METRIC_NAMES: Record<string, string> = {
  rationality: '理性',
  empathy: '共情',
  deterrence: '威慑力',
  alienation: '疏离',
  logic_score: '逻辑',
}
const metricName = (k: string) => METRIC_NAMES[k] ?? k

function parseJson<T = unknown>(str: string | null | undefined): T | null {
  if (!str) return null
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

// Helper to handle mixed JSON string or Object
function getParsed<T>(data: string | object | null | undefined): T[] {
  if (!data) return []
  if (typeof data === 'string') {
    const parsed = parseJson<T[]>(data)
    return Array.isArray(parsed) ? parsed : []
  }
  return Array.isArray(data) ? data as T[] : []
}

function keyDecisions(f: Figure): KeyDecision[] {
  return getParsed<KeyDecision>(f.key_decisions)
}

function relationships(f: Figure): FigureRelationship[] {
  return getParsed<FigureRelationship>(f.relationships)
}

function keyQuotes(f: Figure): KeyQuote[] {
  return getParsed<KeyQuote>(f.key_quotes)
}

interface KeyEventItem {
  role?: string
  impact_description?: string
}
function keyEvents(f: Figure): KeyEventItem[] {
  return getParsed<KeyEventItem>(f.key_events)
}

function metricsEntries(f: Figure): [string, number][] {
  let o: Record<string, number> | null = null
  if (typeof f.metrics === 'string') {
    o = parseJson<Record<string, number>>(f.metrics)
  } else if (f.metrics && typeof f.metrics === 'object') {
    o = f.metrics as Record<string, number>
  }
  if (!o) return []
  return Object.entries(o)
}

async function loadFigures() {
  loading.value = true
  try {
    const res = await fetch(apiUrl(API.FIGURES_LIST))
    if (!res.ok) throw new Error()
    figures.value = await res.json()
  } catch (e) {
    console.error(e)
    // Fallback Data
    figures.value = [
      {
        id: 1,
        name: '罗辑',
        en_name: 'Luo Ji',
        role: '面壁者 / 执剑人',
        era: '危机纪元 - 威慑纪元',
        image_url: '',
        status: 'Active',
        logic_score: 98,
        description: '第四位面壁者，宇宙社会学公理的发现者。通过向宇宙发射咒语验证了黑暗森林理论。建立了对三体世界的黑暗森林威慑，执剑54年。',
        key_decisions: JSON.stringify([
          { decision: '向宇宙发射恒星咒语', context: '危机纪元', outcome: '验证了黑暗森林法则' },
          { decision: '建立引力波威慑', context: '末日之战后', outcome: '迫使三体舰队转向' }
        ]),
        relationships: JSON.stringify([
          { target: '庄颜', relation_type: '爱人', description: '虽然是虚构的具象化，但成为了罗辑最深的羁绊' },
          { target: '大史', relation_type: '守护者', description: '多次拯救罗辑于危难之中' }
        ]),
        key_quotes: JSON.stringify([
          { quote: '这是计划的一部分。', context: '面对质疑时' },
          { quote: '我对三体世界说话。', context: '威慑建立时刻' }
        ]),
        metrics: JSON.stringify({ empathy: 40, logic: 95, determination: 90 }),
      },
      {
        id: 2,
        name: '叶文洁',
        en_name: 'Ye Wenjie',
        role: 'ETO 统帅 / 天体物理学家',
        era: '黄金时代之前',
        image_url: '',
        status: 'Deceased',
        logic_score: 92,
        description: '红岸基地核心技术人员。因对人类人性的绝望，向三体世界发送了太阳系坐标，不仅是ETO的精神领袖，也是人类苦难的开启者。',
        key_decisions: JSON.stringify([
          { decision: '回答三体信号', context: '红岸基地', outcome: '暴露地球坐标' },
          { decision: '向罗辑传授宇宙社会学', context: '杨冬墓前', outcome: '启蒙了面壁者' }
        ]),
        key_quotes: JSON.stringify([
          { quote: '到这里来吧，我将帮助你们获得这个世界。', context: '第一次回复' },
          { quote: '这是人类的落日。', context: '晚年' }
        ]),
        metrics: JSON.stringify({ empathy: 20, logic: 90, determination: 95 }),
      },
      {
        id: 3,
        name: '章北海',
        en_name: 'Zhang Beihai',
        role: '太空军政治部主任 / 自然选择号舰长',
        era: '危机纪元',
        image_url: '',
        status: 'Deceased',
        logic_score: 99,
        description: '最坚定的逃亡主义者，却伪装成最坚定的胜利主义者。为了人类文明的存续，他不惜暗杀异见者，并在最后时刻劫持战舰逃离太阳系，为人类保留了火种。',
        key_decisions: JSON.stringify([
          { decision: '暗杀老航天', context: '陨石雨行动', outcome: '确立了无工质辐射推进的研究方向' },
          { decision: '劫持自然选择号', context: '水滴到达前夕', outcome: '人类文明分支幸存' }
        ]),
        key_quotes: JSON.stringify([
          { quote: '没关系的，都一样。', context: '临死前' },
          { quote: '自然选择，前进四！', context: '逃亡时刻' }
        ]),
        metrics: JSON.stringify({ empathy: 10, logic: 100, determination: 100 }),
      },
      {
        id: 4,
        name: '托马斯·维德',
        en_name: 'Thomas Wade',
        role: 'PIA 局长 / 阶梯计划负责人',
        era: '危机纪元 - 掩体纪元',
        image_url: '',
        status: 'Deceased',
        logic_score: 100,
        description: '极端理性的化身。为了前进，他不择手段。他只差一点就成为了执剑人，也只差一点就让光速飞船提前几十年诞生。他的名言“失去兽性，失去一切”是对那个时代最深刻的警示。',
        key_decisions: JSON.stringify([
          { decision: '提出阶梯计划', context: '只送一个大脑', outcome: '云天明打入三体内部' },
          { decision: '向程心交出光速飞船控制权', context: '星环城', outcome: '遵守诺言，但也导致了人类灭亡' }
        ]),
        key_quotes: JSON.stringify([
          { quote: '前进！前进！！不择手段地前进！！！', context: '座右铭' },
          { quote: '你会把他卖给妓院吗？', context: '对程心说' }
        ]),
        metrics: JSON.stringify({ empathy: 0, logic: 100, determination: 100 }),
      },
      {
        id: 5,
        name: '史强',
        en_name: 'Da Shi',
        role: '前市局反恐大队队长 / 地球防务安全部',
        era: '危机纪元',
        image_url: '',
        status: 'Deceased',
        logic_score: 85,
        description: '看似粗鲁、大大咧咧，实则粗中有细，拥有敏锐的直觉和极高的情商。他是汪淼和罗辑最可靠的守护者，在最黑暗的时刻，是他点醒了绝望的科学家们。',
        key_decisions: JSON.stringify([
          { decision: '提出古筝行动', context: '针对审判日号', outcome: '获取三体信息' },
          { decision: '带罗辑去看虫子', context: '大低谷时期', outcome: '重塑了罗辑的信心' }
        ]),
        key_quotes: JSON.stringify([
          { quote: '虫子从来没有被真正战胜过。', context: '麦田宣言' },
          { quote: '邪乎到家必有鬼。', context: '办案经验' }
        ]),
        metrics: JSON.stringify({ empathy: 90, logic: 80, determination: 90 }),
      }
    ]
  } finally {
    loading.value = false
  }
}

// 筛选
const filterRole = ref<string>('all')
const filteredFigures = computed(() => {
  let list = figures.value

  // Search filter
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(f => 
      f.name.toLowerCase().includes(q) || 
      (f.en_name && f.en_name.toLowerCase().includes(q))
    )
  }

  if (filterRole.value === 'all') return list
  
  if (filterRole.value === '科学家') {
    return list.filter(f => 
      f.role.includes('科学家') || 
      f.role.includes('物理') || 
      f.role.includes('数学') || 
      f.role.includes('学者') ||
      f.role.includes('教授')
    )
  }
  
  if (filterRole.value === '军方/ETO') {
    return list.filter(f => 
      f.role.includes('太空军') || 
      f.role.includes('ETO') || 
      f.role.includes('警官') || 
      f.role.includes('舰长') ||
      f.role.includes('降临派') ||
      f.role.includes('地球防务')
    )
  }

  // 精确或部分匹配
  return list.filter(f => f.role.includes(filterRole.value))
})

// 样式映射
const statusColor = (status: string) => {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'alive') return 'success'
  if (s === 'hibernating') return 'info'
  if (s === 'deceased') return 'error'
  return 'default'
}

/** 威胁度展示：后端可能为 0–1 或 0–100 */
function displayLogicScore(f: Figure): number {
  const v = Number(f.logic_score)
  if (v <= 1 && v > 0) return Math.round(v * 100)
  return Math.min(100, Math.round(v))
}

/** 详情弹窗头像 URL：优先 API/本地 /images/figures，空时用占位 */
function figurePortraitUrl(f: Figure | null): string {
  if (!f) return ''
  const url = figureImageUrl(f.image_url, f.en_name, `https://placehold.co/300x400/111/444?text=${encodeURIComponent(f.name)}`)
  return url || `https://placehold.co/300x400/111/444?text=${encodeURIComponent(f.name)}`
}

/** 打开与当前人物的选择式对话 */
function openDialogue() {
  if (!selectedFigure.value || !hasDialogue(selectedFigure.value.name)) return
  conversation.value = []
  dialogueError.value = ''
  dialogueInput.value = ''
  showDialogueModal.value = true
}

function closeDialogue() {
  showDialogueModal.value = false
}

/** 对话按钮文案：与她/与他 */
const dialogueEntryLabel = computed(() => {
  const name = selectedFigure.value?.name
  if (!name) return '与他对话'
  const femaleNames = ['叶文洁', '程心', '智子 (仿生人)']
  return femaleNames.includes(name) ? '与她对话' : '与他对话'
})

onMounted(() => {
  loadFigures()
  llmConfig.init()
})
</script>

<template>
  <div class="sector-figures">
    <SectorHeader
      title="人物志"
      subtitle="罗辑、叶文洁、章北海、程心……在宇宙的尺度上，他们每个人都只是一粒尘埃，却都做过一个改变了文明走向的决定。"
      goal="翻阅档案，看人物之间的关系；或者走进「一个人的选择」，在知道后果之前，先读一读他们当时面对的处境。"
    />

    <div class="fig-controls">
      <nav class="volumes" aria-label="分册">
        <button type="button" :class="{ on: subModule === 'list' }" :aria-pressed="subModule === 'list'" @click="subModule = 'list'">档案</button>
        <button type="button" :class="{ on: subModule === 'graph' }" :aria-pressed="subModule === 'graph'" @click="subModule = 'graph'">关系星图</button>
        <button type="button" :class="{ on: subModule === 'choices' }" :aria-pressed="subModule === 'choices'" @click="subModule = 'choices'">一个人的选择</button>
      </nav>
      <div v-if="subModule === 'list'" class="fig-filter">
        <NInput v-model:value="searchQuery" placeholder="按姓名查找" clearable class="fig-search" />
        <div class="filters">
          <button
            v-for="role in ['all', '面壁者', '执剑人', '科学家', '军方/ETO']"
            :key="role"
            type="button"
            class="filter-tag"
            :class="{ active: filterRole === role }"
            @click="filterRole = role"
          >{{ role === 'all' ? '全部' : role }}</button>
        </div>
      </div>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-text">智子正在同步档案…</span>
    </div>
    <!-- 空状态 -->
    <div v-else-if="subModule === 'list' && filteredFigures.length === 0" class="empty-state">
            <h2>暂无档案记录</h2>
      <p>智子档案库未同步或当前筛选无匹配人物。请检查后端服务或切换筛选条件。</p>
    </div>

    <!-- 一个人的选择 -->
    <section v-else-if="subModule === 'choices'" class="choices">
      <p v-if="!allChoices.length" class="muted">档案里还没有记录任何决策。</p>
      <ol v-else class="choice-list">
        <li v-for="c in allChoices" :key="c.key" class="choice">
          <p class="c-who">{{ c.who.name }}<span>{{ c.who.era }}</span></p>
          <p class="c-ctx">{{ c.d.context }}</p>
          <p class="c-dec">{{ c.d.decision }}</p>
          <p v-if="revealed.has(c.key)" class="c-out">{{ c.d.outcome }}</p>
          <button v-else type="button" class="c-reveal" @click="reveal(c.key)">后来发生了什么</button>
        </li>
      </ol>
      <p v-if="allChoices.length" class="c-q">{{ question }}</p>
    </section>

    <!-- 关系星图子模块 -->
    <div v-else-if="subModule === 'graph'" class="graph-module">
      <FiguresNetworkGraph
        :figures="figures"
        @select="selectedFigure = $event"
      />
    </div>

    <div v-else class="grid-container">
      <transition-group name="list">
        <div 
          v-for="f in filteredFigures" 
          :key="f.id" 
          class="figure-card"
          @click="selectedFigure = f"
        >
          <div class="card-img">
            <img :src="figureImageUrl(f.image_url, f.en_name, `https://placehold.co/300x400/111/444?text=${encodeURIComponent(f.name)}`)" alt="Portrait" />
            <div class="status-indicator" :class="f.status.toLowerCase()"></div>
          </div>
          <div class="card-info">
            <div class="name-row">
              <span class="cn-name">{{ f.name }}</span>
              <span class="en-name">{{ f.en_name }}</span>
            </div>
            <div class="meta-row">
              <span class="role-tag">{{ f.role }}</span>
              <span class="era-tag">{{ f.era }}</span>
            </div>
          </div>
          <div class="card-decor">
            <span class="corner tl"></span>
            <span class="corner tr"></span>
            <span class="corner bl"></span>
            <span class="corner br"></span>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- 详情档案 -->
    <NModal
      :show="!!selectedFigure"
      @update:show="(v) => { if (!v) selectedFigure = null }"
      preset="card"
      class="dossier-modal"
      style="width: 800px; max-width: 95vw;"
      :title="`档案 ${selectedFigure?.id.toString().padStart(4, '0')}`"
    >
      <div v-if="selectedFigure" class="dossier-content">
        <!-- Watermark -->

        <div class="dossier-layout">
          <!-- Left Column: Portrait & Stats -->
          <div class="col-left">
            <div class="portrait-wrapper">
              <img :src="figurePortraitUrl(selectedFigure)" alt="" class="portrait-img" />
              <div class="portrait-overlay">
                <div class="status-badge" :class="selectedFigure.status.toLowerCase()">
                  {{ selectedFigure.status }}
                </div>
              </div>
            </div>

            <div class="basic-info">
              <h2 class="cn-name-lg">{{ selectedFigure.name }}</h2>
              <p class="en-name-lg">{{ selectedFigure.en_name }}</p>
              
              <div class="info-grid">
                <div class="info-item">
                  <label>身份</label>
                  <span>{{ selectedFigure.role }}</span>
                </div>
                <div class="info-item">
                  <label>纪元</label>
                  <span>{{ selectedFigure.era }}</span>
                </div>
                <div class="info-item">
                  <label>逻辑值</label>
                  <span class="num">{{ displayLogicScore(selectedFigure) }} / 100</span>
                </div>
              </div>
            </div>

            <!-- 与他/与她对话：核心人物主入口，置于左侧显著位置 -->
            <div v-if="hasDialogue(selectedFigure.name)" class="dossier-dialogue-cta">
              <button type="button" class="dialogue-cta-btn" @click="openDialogue">
                                <span class="dialogue-cta-text">{{ dialogueEntryLabel }}</span>
                <span class="dialogue-cta-sub">在某一个时刻与 TA 相遇：TA 先开口，心里藏着一件事</span>
              </button>
            </div>

            <div class="dossier-section">
              <h3 class="section-title">人格光谱</h3>
              <div v-if="metricsEntries(selectedFigure).length" class="metrics-list">
                <div class="metric-row" v-for="([key, val]) in metricsEntries(selectedFigure)" :key="key">
                  <span class="metric-name">{{ metricName(key) }}</span>
                  <div class="metric-bar-container">
                    <div 
                      class="metric-bar" 
                      :style="{ width: `${val}%`, backgroundColor: key === 'empathy' ? 'var(--rust-bright)' : 'var(--weathered)' }"
                    ></div>
                  </div>
                  <span class="metric-val">{{ val }}</span>
                </div>
              </div>
              <p v-else class="text-xs text-gray-500">没有记录</p>
            </div>
          </div>

          <!-- Right Column: Details -->
          <div class="col-right">
            
            <div class="dossier-section">
              <h3 class="section-title">履历</h3>
              <p class="desc-text">{{ selectedFigure.description }}</p>
            </div>

            <div v-if="keyQuotes(selectedFigure).length || selectedFigure.quotes" class="dossier-section">
              <h3 class="section-title">语录</h3>
              <template v-if="keyQuotes(selectedFigure).length">
                <div v-for="(q, i) in keyQuotes(selectedFigure)" :key="i" class="quote-block">
                  <p class="quote-text">"{{ q.quote }}"</p>
                  <p class="quote-meta">— {{ q.context }}</p>
                </div>
              </template>
              <div v-else class="quote-block">
                <p class="quote-text">"{{ selectedFigure.quotes }}"</p>
              </div>
            </div>

            <div v-if="keyDecisions(selectedFigure).length" class="dossier-section">
              <h3 class="section-title">关键决策</h3>
              <div class="timeline-simple">
                <div v-for="(d, i) in keyDecisions(selectedFigure)" :key="i" class="timeline-event">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="decision-name">{{ d.decision }}</div>
                    <div class="decision-ctx">{{ d.context }}</div>
                    <div class="decision-res">后来：{{ d.outcome }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="relationships(selectedFigure).length" class="dossier-section">
              <h3 class="section-title">关系</h3>
              <div class="network-grid">
                <div v-for="(r, i) in relationships(selectedFigure)" :key="i" class="network-card">
                  <div class="rel-header">
                    <span class="rel-target">{{ r.target }}</span>
                    <span class="rel-type">{{ r.relation_type }}</span>
                  </div>
                  <div class="rel-desc">{{ r.description }}</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </NModal>

    <!-- 对话室：在某个时刻与人物相遇（components/FigureTalk.vue） -->
    <FigureTalk
      v-if="showDialogueModal && selectedFigure"
      :figure="selectedFigure"
      :portrait="figurePortraitUrl(selectedFigure)"
      @close="closeDialogue"
    />
  </div>
</template>

<style scoped>
.sector-figures {
  min-height: 0;
  padding: 2rem;
  background: var(--gray-950);
  color: #c0c0c0;
  position: relative;
  font-family: var(--font-serif);
}
.bg-grid {
  position: fixed;
  inset: 0;
  background: 
    linear-gradient(rgba(var(--cherenkov-rgb),0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--cherenkov-rgb),0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2px solid rgba(var(--cherenkov-rgb),0.2);
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
  position: relative;
  z-index: 1;
}
.header-left {
  flex-shrink: 0;
}
.title {
  font-family: var(--font-title); /* Tech font */
  color: var(--c-cyan);
  font-size: 2rem;
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 10px rgba(var(--cherenkov-rgb),0.3);
}
.subtitle {
  color: var(--gray-400);
  font-family: var(--font-mono);
  margin-top: 0.5rem;
  letter-spacing: 1px;
}

.sub-module-tabs {
  display: flex;
  gap: 0;
  border: 1px solid rgba(var(--cherenkov-rgb), 0.2);
  border-radius: var(--radius-cut);
  overflow: hidden;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -2px;
}
.sub-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--gray-400);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  border-right: 1px solid rgba(var(--cherenkov-rgb), 0.15);
}
.sub-tab:last-child {
  border-right: none;
}
.sub-tab:hover {
  color: var(--c-cyan);
  background: rgba(var(--cherenkov-rgb), 0.08);
}
.sub-tab.active {
  color: var(--c-cyan);
  background: rgba(var(--cherenkov-rgb), 0.15);
  box-shadow: inset 0 0 12px rgba(var(--cherenkov-rgb), 0.1);
}
.sub-tab-icon {
  opacity: 0.9;
}

.graph-module {
  position: relative;
  z-index: 1;
  width: 100%;
  height: calc(100vh - 220px);
  min-height: 520px;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
}
.search-box {
  width: 250px;
}
.tech-input :deep(.n-input__input-el) {
  font-family: var(--font-mono);
}

.filters {
  display: flex;
  gap: 0.5rem;
}
.filter-tag {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--gray-400);
  transition: all 0.2s;
  background: rgba(0,0,0,0.5);
}
.filter-tag:hover, .filter-tag.active {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
  background: rgba(var(--cherenkov-rgb),0.1);
  box-shadow: 0 0 10px rgba(var(--cherenkov-rgb),0.1);
}

/* Grid */
/* Loading state */
.loading-state {
  padding: 4rem 2rem;
  text-align: center;
  position: relative;
  z-index: 1;
}
.loading-text {
  font-family: var(--font-mono);
  color: var(--c-cyan);
  font-size: 0.95rem;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  50% { opacity: 0.5; }
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  position: relative;
  z-index: 1;
  border: 1px dashed rgba(var(--cherenkov-rgb),0.2);
  background: rgba(var(--cherenkov-rgb),0.02);
  border-radius: var(--radius-cut);
}
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}
.empty-state h2 {
  color: var(--c-cyan);
  font-family: var(--font-mono);
  font-size: 1.2rem;
  margin: 0 0 0.5rem;
}
.empty-state p {
  color: var(--gray-400);
  font-size: 0.9rem;
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.6;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 2rem;
  position: relative;
  z-index: 1;
}

.figure-card {
  background: rgba(10, 15, 20, 0.8);
  border: 1px solid rgba(var(--cherenkov-rgb), 0.1);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(5px);
}
.figure-card:hover {
  transform: translateY(-5px);
  border-color: var(--c-cyan);
  box-shadow: 0 5px 20px rgba(var(--cherenkov-rgb), 0.15);
}

.card-decor .corner {
  position: absolute;
  width: 6px;
  height: 6px;
  border: 2px solid transparent;
  transition: border-color 0.3s;
}
.figure-card:hover .corner { border-color: var(--c-cyan); }
.tl { top: -1px; left: -1px; border-top: 2px solid rgba(var(--cherenkov-rgb),0.3); border-left: 2px solid rgba(var(--cherenkov-rgb),0.3); }
.tr { top: -1px; right: -1px; border-top: 2px solid rgba(var(--cherenkov-rgb),0.3); border-right: 2px solid rgba(var(--cherenkov-rgb),0.3); }
.bl { bottom: -1px; left: -1px; border-bottom: 2px solid rgba(var(--cherenkov-rgb),0.3); border-left: 2px solid rgba(var(--cherenkov-rgb),0.3); }
.br { bottom: -1px; right: -1px; border-bottom: 2px solid rgba(var(--cherenkov-rgb),0.3); border-right: 2px solid rgba(var(--cherenkov-rgb),0.3); }

.card-img {
  height: 280px;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid rgba(var(--cherenkov-rgb),0.1);
}
.card-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.2);
  transition: filter 0.4s;
}
.figure-card:hover .card-img img {
  filter: grayscale(0) contrast(1.1);
}

.status-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: none;
  z-index: 2;
}
.status-indicator.active, .status-indicator.alive { background: var(--holo-green); color: var(--holo-green); }
.status-indicator.hibernating { background: var(--c-cyan); color: var(--c-cyan); }
.status-indicator.deceased { background: var(--c-red); color: var(--c-red); }

.logic-score-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.8);
  color: var(--c-cyan);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 4px 8px;
  text-align: right;
  border-top: 1px solid rgba(var(--cherenkov-rgb),0.2);
}

.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: rgba(var(--cherenkov-rgb),0.5);
  box-shadow: 0 0 10px rgba(var(--cherenkov-rgb),0.8);
  opacity: 0;
  pointer-events: none;
}
.figure-card:hover .scan-line {
  animation: scan 1.5s linear infinite;
  opacity: 1;
}
@keyframes scan {
  0% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

.card-info {
  padding: 1rem;
}
.name-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}
.cn-name { font-weight: bold; color: var(--white); font-size: 1.1rem; }
.en-name { font-size: 0.75rem; font-family: var(--font-mono); opacity: 0.6; }

.meta-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.role-tag, .era-tag {
  font-size: 0.75rem;
  padding: 2px 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--gray-200);
}
.role-tag { color: var(--c-cyan); border-color: rgba(var(--cherenkov-rgb),0.2); }

/* List Transition */
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: scale(0.9); }

/* Dossier Modal */
.dossier-modal :deep(.n-card) {
  background: #0f1215;
  border: 1px solid var(--gray-700);
}
.dossier-modal :deep(.n-card-header) {
  border-bottom: 1px solid var(--gray-700);
  padding-bottom: 1rem;
}
.dossier-modal :deep(.n-card-header__main) {
  color: var(--c-cyan);
  font-family: var(--font-mono);
}

.dossier-content {
  position: relative;
}
.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 6rem;
  font-weight: bold;
  color: rgba(255, 50, 50, 0.05);
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
}

.dossier-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 2rem;
  position: relative;
  z-index: 1;
}

.col-left {
  border-right: 1px solid var(--gray-800);
  padding-right: 2rem;
}

.portrait-wrapper {
  position: relative;
  margin-bottom: 1.5rem;
  border: 1px solid var(--gray-600);
  overflow: hidden;
}
.portrait-img {
  width: 100%;
  display: block;
  min-height: 280px;
  object-fit: cover;
  background: var(--gray-900);
}
.status-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: bold;
  font-size: 0.9rem;
  padding: 4px;
  background: rgba(0,0,0,0.8);
}
.status-badge.alive, .status-badge.active { color: var(--holo-green); border-top: 2px solid var(--holo-green); }
.status-badge.hibernating { color: var(--c-cyan); border-top: 2px solid var(--c-cyan); }
.status-badge.deceased { color: var(--c-red); border-top: 2px solid var(--c-red); }

.basic-info { margin-bottom: 2rem; }
.cn-name-lg { font-size: 2rem; color: var(--white); margin: 0; line-height: 1.2; }
.en-name-lg { font-family: var(--font-mono); color: var(--gray-400); font-size: 0.9rem; margin: 0 0 1rem; }

.info-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.info-item { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.8rem; border-bottom: 1px dashed var(--gray-700); padding-bottom: 4px; }
.info-item label { color: var(--gray-400); }
.info-item span { color: var(--gray-200); text-align: right; }

.section-title {
  font-family: var(--font-mono);
  color: var(--c-cyan);
  font-size: 0.9rem;
  border-bottom: 1px solid var(--gray-700);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
}

.metrics-list { display: flex; flex-direction: column; gap: 0.5rem; }
.metric-row { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-mono); font-size: 0.75rem; }
.metric-name { width: 60px; color: var(--gray-400); }
.metric-bar-container { flex: 1; height: 4px; background: var(--gray-800); }
.metric-bar { height: 100%; }
.metric-val { width: 30px; text-align: right; color: var(--white); }

/* Right Column */
.desc-text {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--gray-150);
  margin-bottom: 2rem;
  text-align: justify;
}

.quote-block {
  border-left: 3px solid var(--c-cyan);
  padding-left: 1rem;
  margin-bottom: 1rem;
  background: rgba(var(--cherenkov-rgb),0.02);
  padding: 1rem;
}
.quote-text {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-style: italic;
  color: var(--white);
  margin: 0 0 0.5rem;
}
.quote-meta {
  font-size: 0.8rem;
  color: var(--gray-400);
  text-align: right;
  font-family: var(--font-mono);
}

.timeline-simple {
  position: relative;
  border-left: 1px solid var(--gray-700);
  margin-left: 10px;
  padding-left: 20px;
}
.timeline-event { margin-bottom: 1.5rem; position: relative; }
.timeline-dot {
  position: absolute;
  left: -25px;
  top: 5px;
  width: 9px;
  height: 9px;
  background: var(--black);
  border: 2px solid var(--c-cyan);
  border-radius: 50%;
}
.decision-name { font-weight: bold; color: var(--c-cyan); font-size: 0.9rem; }
.decision-ctx { font-size: 0.8rem; color: var(--gray-400); margin-bottom: 0.25rem; }
.decision-res { font-size: 0.8rem; color: var(--gray-200); }

.network-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.network-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--gray-700);
  padding: 0.75rem;
}
.rel-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}
.rel-target { color: var(--white); font-weight: bold; }
.rel-type { color: var(--c-cyan); font-family: var(--font-mono); }
.rel-desc { font-size: 0.75rem; color: var(--gray-400); }

/* 与他/与她对话：左侧显著入口 */
.dossier-dialogue-cta {
  margin: 1.25rem 0;
}
.dialogue-cta-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1rem 1.25rem;
  color: var(--c-cyan);
  background: linear-gradient(135deg, rgba(var(--cherenkov-rgb),0.12) 0%, rgba(var(--cherenkov-rgb),0.06) 100%);
  border: 2px solid rgba(var(--cherenkov-rgb),0.5);
  border-radius: var(--radius-cut);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 20px rgba(var(--cherenkov-rgb),0.15);
}
.dialogue-cta-btn:hover {
  background: linear-gradient(135deg, rgba(var(--cherenkov-rgb),0.2) 0%, rgba(var(--cherenkov-rgb),0.1) 100%);
  border-color: var(--c-cyan);
  box-shadow: 0 0 28px rgba(var(--cherenkov-rgb),0.25);
}
.dialogue-cta-icon {
  font-size: 1.5rem;
  margin-bottom: 0.35rem;
}
.dialogue-cta-text {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.dialogue-cta-sub {
  font-size: 0.75rem;
  color: rgba(var(--cherenkov-rgb),0.75);
  margin-top: 0.25rem;
}

/* 选择式对话模态 */
.dialogue-modal :deep(.n-card-header) { padding-bottom: 0; }
.dialogue-modal :deep(.n-card__content) {
  padding-top: 0.75rem;
  padding-bottom: 1rem;
  background: var(--gray-950);
  border-radius: 0 0 8px 8px;
}
.dialogue-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.dialogue-header {
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(var(--cherenkov-rgb),0.15);
}
.dialogue-header-name {
  display: block;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--c-cyan);
  letter-spacing: 0.5px;
  margin-bottom: 0.2rem;
}
.dialogue-header-role {
  font-size: 0.8rem;
  color: var(--gray-400);
  font-family: var(--font-mono);
}
.dialogue-intro {
  font-size: 0.9rem;
  color: var(--gray-350);
  font-style: italic;
  margin: 0.75rem 0 0;
  line-height: 1.5;
}
/* 对话消息区：气泡形式 */
.dialogue-messages {
  min-height: 200px;
  max-height: 320px;
  overflow-y: auto;
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.dialogue-row {
  display: flex;
  width: 100%;
}
.dialogue-row-user {
  justify-content: flex-end;
}
.dialogue-row-figure {
  justify-content: flex-start;
}
.dialogue-bubble {
  max-width: 85%;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-cut);
  font-size: 0.9rem;
  line-height: 1.55;
  word-break: break-word;
}
.dialogue-bubble-user {
  background: rgba(var(--cherenkov-rgb),0.15);
  border: 1px solid rgba(var(--cherenkov-rgb),0.35);
  color: var(--gray-100);
  border-bottom-right-radius: 4px;
}
.dialogue-bubble-figure {
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--gray-700);
  color: var(--gray-200);
  border-bottom-left-radius: 4px;
}
.dialogue-figure-name {
  display: block;
  font-size: 0.75rem;
  color: var(--c-cyan);
  margin-bottom: 0.35rem;
  font-family: var(--font-mono);
}
.dialogue-bubble-text {
  white-space: pre-wrap;
}
.dialogue-cursor {
  display: inline-block;
  color: var(--c-cyan);
  animation: dialogue-blink 0.8s step-end infinite;
}
@keyframes dialogue-blink {
  50% { opacity: 0; }
}
.dialogue-err-inline {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  color: var(--rust-bright);
}
.dialogue-suggested {
  margin-top: 0.25rem;
}
.dialogue-suggested-label {
  font-size: 0.75rem;
  color: var(--gray-400);
  margin-right: 0.5rem;
}
.dialogue-suggested-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.4rem;
}
.dialogue-chip {
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  color: var(--gray-350);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--gray-700);
  border-radius: var(--radius-cut);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.dialogue-chip:hover:not(:disabled) {
  color: var(--c-cyan);
  border-color: rgba(var(--cherenkov-rgb),0.4);
  background: rgba(var(--cherenkov-rgb),0.06);
}
.dialogue-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dialogue-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}
.dialogue-input {
  flex: 1;
}
.dialogue-llm-config {
  margin-top: 0.5rem;
  border: 1px solid rgba(var(--cherenkov-rgb),0.15);
  border-radius: var(--radius-cut);
}
.dialogue-llm-config :deep(.n-collapse-item__header) {
  font-size: 0.85rem;
  color: var(--gray-350);
}
.dialogue-llm-hint {
  font-size: 0.78rem;
  color: var(--weathered);
  margin: 0 0 0.5rem;
  line-height: 1.45;
}
.dialogue-llm-item {
  margin-bottom: 0.5rem;
}
.dialogue-llm-item :deep(.n-form-item-label) { font-size: 0.8rem; }

@media (max-width: 800px) {
  /* 页头纵向排列：标题 → 档案/星图切换 → 搜索与筛选（切换按钮不再绝对定位压在标题上） */
  .header { flex-direction: column; align-items: stretch; gap: 1rem; }
  .header-left { flex-shrink: 1; min-width: 0; }
  .title { font-size: clamp(1.25rem, 6vw, 2rem); letter-spacing: 1px; overflow-wrap: anywhere; }
  .sub-module-tabs { position: static; transform: none; align-self: flex-start; }
  .sub-tab { white-space: nowrap; }
  .header-right { align-items: stretch; }
  .search-box { width: 100%; }
  .filters { flex-wrap: wrap; justify-content: flex-start; }
  .dossier-layout { grid-template-columns: 1fr; }
  .col-left { border-right: none; border-bottom: 1px solid var(--gray-700); padding-right: 0; padding-bottom: 2rem; margin-bottom: 2rem; }
  .portrait-wrapper { max-width: 300px; margin: 0 auto 1.5rem; }
}

/* ---------- 档案馆外观（覆盖上面的旧样式） ---------- */
.sector-figures { padding: 2rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 80rem; background: none; color: var(--bone); font-family: var(--font-sans); }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--weathered); }
.fig-controls { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.75rem; border-bottom: 1px solid var(--incision-soft); }
.volumes { display: flex; flex-wrap: wrap; gap: 0.25rem; }
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
.fig-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding-bottom: 0.6rem; }
.fig-search { width: 12rem; }
.filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.filter-tag {
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--weathered);
  background: transparent;
  border: 1px solid var(--incision);
  border-radius: 2px;
  box-shadow: none;
  text-shadow: none;
  cursor: pointer;
}
.filter-tag.active { color: var(--bone); border-color: var(--bone); background: transparent; }

.loading-state, .empty-state { padding: 3rem 0; text-align: left; color: var(--weathered); }
.empty-state h2 { font-family: var(--font-serif); color: var(--bone); }
.loading-text { animation: none; color: var(--weathered); font-family: var(--font-sans); }

.grid-container { padding: 0; gap: 1.25rem; }
.figure-card { background: var(--slab); border: 1px solid var(--incision-soft); border-radius: 0; box-shadow: none; transform: none; }
.figure-card:hover { border-color: var(--weathered); box-shadow: none; transform: none; }
.card-img img { filter: grayscale(1) contrast(1.05); transition: filter 0.6s; }
.figure-card:hover .card-img img { filter: grayscale(0.3); }
.status-indicator { display: none; }
.card-info { padding: 0.8rem 0.9rem 1rem; background: none; border: 0; }
.cn-name { font-family: var(--font-serif); font-weight: 600; font-size: 1.125rem; color: var(--bone); text-shadow: none; }
.en-name { font-family: var(--font-sans); font-size: 0.75rem; color: var(--weathered); letter-spacing: 0; text-transform: none; }
.role-tag, .era-tag { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--weathered); background: none; border: 0; padding: 0; }
.role-tag::after { content: ' · '; }
.card-decor { display: none; }

.choices { max-width: 46rem; }
.choice-list { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--incision); }
.choice { position: relative; padding: 0 0 1.75rem 1.25rem; }
.choice::before { content: ''; position: absolute; left: -4px; top: 0.5rem; width: 7px; height: 7px; background: #c9b48a; }
.c-who { margin: 0 0 0.4rem; font-family: var(--font-serif); font-weight: 600; color: var(--bone); }
.c-who span { margin-left: 0.75rem; font-family: var(--font-sans); font-weight: 400; font-size: 0.8125rem; color: var(--weathered); }
.c-ctx { margin: 0 0 0.4rem; font-size: 0.9375rem; line-height: 1.8; color: var(--weathered); }
.c-dec { margin: 0 0 0.6rem; font-family: var(--font-serif); font-size: 1.0625rem; line-height: 1.85; color: var(--bone); }
.c-out { margin: 0; padding-left: 0.9rem; border-left: 1px solid var(--incision); font-family: var(--font-serif); line-height: 1.85; color: var(--gray-150); }
.c-reveal {
  padding: 0.3rem 0.8rem;
  font: inherit;
  font-size: 0.875rem;
  color: var(--cherenkov);
  background: transparent;
  border: 1px solid rgba(var(--cherenkov-rgb), 0.5);
  border-radius: 2px;
  cursor: pointer;
}
.c-q { margin: 1rem 0 0; padding-left: 1rem; border-left: 1px solid var(--era-archive); font-family: var(--font-serif); font-size: 1.125rem; color: var(--bone); }

.dossier-modal :deep(.n-card) { background: var(--slab) !important; border: 1px solid var(--incision) !important; border-radius: 2px !important; box-shadow: none !important; }
.dossier-modal :deep(.n-card-header__main) { font-family: var(--font-sans) !important; font-size: 0.875rem !important; color: var(--weathered) !important; letter-spacing: 0.08em; text-shadow: none !important; }
.portrait-img { filter: grayscale(0.85); }
.status-badge { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--bone); background: rgba(19, 20, 22, 0.8); border: 1px solid var(--incision); box-shadow: none; text-shadow: none; }
.cn-name-lg { font-family: var(--font-serif); font-weight: 900; color: var(--bone); text-shadow: none; }
.en-name-lg { font-family: var(--font-sans); color: var(--weathered); letter-spacing: 0; }
.info-item label { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--weathered); letter-spacing: 0; }
.info-item span { color: var(--bone); }
.section-title { font-family: var(--font-serif); font-weight: 600; font-size: 1rem; color: var(--bone); letter-spacing: 0.08em; border: 0; text-shadow: none; }
.section-title::before, .section-title::after { display: none; }
.desc-text, .decision-ctx, .rel-desc { color: var(--gray-150); line-height: 1.85; }
.quote-block { border-left: 1px solid var(--incision); background: none; }
.quote-text { font-family: var(--font-serif); color: var(--bone); font-style: normal; }
.quote-meta { color: var(--weathered); }
.metric-name { font-family: var(--font-sans); font-size: 0.8125rem; color: var(--weathered); }
.metric-bar-container { background: var(--incision-soft); }
.metric-bar { box-shadow: none; }
.timeline-dot { background: #c9b48a; box-shadow: none; }
.decision-name { color: var(--bone); font-family: var(--font-serif); }
.decision-res { color: var(--weathered); }
.network-card { background: var(--void); border: 1px solid var(--incision-soft); box-shadow: none; }
.rel-target { color: var(--bone); font-family: var(--font-serif); }
.rel-type { color: var(--weathered); background: none; border: 1px solid var(--incision); }
.dialogue-cta-btn { background: transparent; border: 1px solid rgba(var(--cherenkov-rgb), 0.5); color: var(--cherenkov); box-shadow: none; }
.dialogue-cta-sub { color: var(--weathered); }

@media (max-width: 720px) {
  .fig-search { width: 100%; }
}
</style>
