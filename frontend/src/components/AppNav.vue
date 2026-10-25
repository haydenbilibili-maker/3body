<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
/**
 * AppNav —— 档案馆导航（冥王星档案馆视觉方案）。
 * 五个展区：起源 / 危机 / 宇宙 / 岁月 / 尽头；下拉里每间展厅标出所在纪元。
 * 全部用 button，可键盘操作；Esc 关闭下拉与抽屉。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ERAS, sectorByPath } from '@/data/sectors'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 一级入口：首页
const topLevelItems = [
  { path: '/sector-c', label: '首页', code: 'HOME' },
]
// 时间和尽头右侧的一级入口
const rightLevelItems = [
  { path: '/sector-guestbook', label: '留言簿', code: 'GUESTBOOK' },
]

// 定义导航结构 (5字分类)
const navGroups = [
  {
    label: '起源',
    code: 'ORIGINS',
    items: [
      { path: '/sector-r', label: '红岸', code: 'RED-COAST' },
      { path: '/sector-guzheng', label: '古筝计划', code: 'GUZHENG' },
      { path: '/sector-t', label: '三体摆', code: 'PENDULUM' },
      { path: '/sector-v', label: '人列计算机', code: 'VON-NEUMANN' },
      { path: '/sector-a', label: '智子', code: 'SOPHON' },
      { path: '/sector-boundary', label: '科学边界', code: 'BOUNDARY' },
    ]
  },
  {
    label: '危机',
    code: 'CRISIS',
    items: [
      { path: '/sector-pdc', label: '行星防御', code: 'PDC' },
      { path: '/sector-ravine', label: '大低谷', code: 'RAVINE' },
      { path: '/sector-f', label: '面壁计划', code: 'WALLFACER' },
      { path: '/sector-stamp', label: '钢印', code: 'STAMP' },
      { path: '/sector-s', label: '阶梯', code: 'STAIRCASE' },
      { path: '/sector-w', label: '水滴', code: 'DROPLET' },
      { path: '/sector-ns', label: '自然选择号', code: 'NATURAL-SELECTION' },
      { path: '/sector-e', label: '黑暗森林', code: 'FOREST' },
      { path: '/sector-sword', label: '执剑人', code: 'SWORDHOLDER' },
    ]
  },
  {
    label: '宇宙',
    code: 'UNIVERSE',
    items: [
      { path: '/sector-tale', label: '童话', code: 'TALE' },
      { path: '/sector-j', label: '掩体', code: 'BUNKER' },
      { path: '/sector-l', label: '曲率', code: 'LIGHTSPEED' },
      { path: '/sector-g', label: '四维', code: '4D-FRAG' },
      { path: '/sector-blind', label: '盲区', code: 'BLIND-ZONE' },
    ]
  },
  {
    label: '岁月',
    code: 'HISTORY',
    items: [
      { path: '/sector-b', label: '编年史', code: 'CHRONICLE' },
      { path: '/sector-library', label: '原著阅读', code: 'LIBRARY' },
      { path: '/sector-p', label: '人物志', code: 'PRISMS' },
      { path: '/sector-d', label: '二向箔画廊', code: '2D-GALLERY' },
      { path: '/sector-tomb', label: '文明墓碑', code: 'TOMB' },
      { path: '/sector-sleep', label: '冬眠者', code: 'SLEEP' },
      { path: '/sector-human', label: '银河人类', code: 'GALAXY-HUMAN' },
    ]
  },
  {
    label: '尽头',
    code: 'ETERNITY',
    items: [
      { path: '/sector-u', label: '647 号小宇宙', code: 'UNI-647' },
      { path: '/sector-x', label: '归零者', code: 'UNKNOWN' },
      { path: '/sector-m', label: '田园时代', code: 'MEMBRANE' },
      { path: '/sector-ledger', label: '读者的档案', code: 'LEDGER' },
    ]
  }
]

const activeGroupIndex = ref<number | null>(null)
const mobileMenuOpen = ref(false)

/**
 * 精确匹配路径（允许子路径 /sector-x/...）。
 * 不能用 startsWith：/sector-tomb 会命中 /sector-t（三体摆），导致两个分组同时高亮。
 */
function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function isGroupActive(groupItems: { path: string }[]) {
  return groupItems.some(item => isActive(item.path))
}

function handleGroupClick(index: number) {
  if (activeGroupIndex.value === index) {
    activeGroupIndex.value = null
  } else {
    activeGroupIndex.value = index
  }
}

function navigate(path: string) {
  router.push(path)
  activeGroupIndex.value = null
  mobileMenuOpen.value = false
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

/** 展厅所在纪元的名称（下拉与抽屉里显示，代替旧的英文代号） */
function eraOf(path: string) {
  const era = sectorByPath(path)?.era
  if (!era) return ''
  if (era === 'all') return '全部纪元'
  return ERAS.find((e) => e.id === era)?.name ?? ''
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    activeGroupIndex.value = null
    mobileMenuOpen.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <nav class="archive-nav" aria-label="主导航">
    <button type="button" class="brand" aria-label="返回首页" @click="navigate('/sector-c')">
      <BrandMark :size="22" class="mark" />
      <span class="brand-name">三体·深时</span>
      <span class="brand-sub">体验沙盒</span>
    </button>

    <button
      type="button"
      class="nav-hamburger"
      :aria-expanded="mobileMenuOpen"
      aria-label="打开导航"
      @click="toggleMobileMenu"
    >
      <span class="hamburger-line" :class="{ open: mobileMenuOpen }"></span>
      <span class="hamburger-line" :class="{ open: mobileMenuOpen }"></span>
      <span class="hamburger-line" :class="{ open: mobileMenuOpen }"></span>
    </button>

    <div class="nav-center">
      <button
        v-for="item in topLevelItems"
        :key="item.path"
        type="button"
        class="nav-link"
        :class="{ active: isActive(item.path) }"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        @click="navigate(item.path)"
      >
        {{ item.label }}
      </button>

      <div
        v-for="(group, idx) in navGroups"
        :key="group.code"
        class="nav-group"
        @mouseenter="activeGroupIndex = idx"
        @mouseleave="activeGroupIndex = null"
      >
        <button
          type="button"
          class="nav-link"
          :class="{ active: isGroupActive(group.items) }"
          :aria-expanded="activeGroupIndex === idx"
          aria-haspopup="true"
          @click="handleGroupClick(idx)"
        >
          {{ group.label }}
        </button>
        <transition name="dropdown">
          <div v-show="activeGroupIndex === idx" class="group-dropdown">
            <button
              v-for="item in group.items"
              :key="item.path"
              type="button"
              class="dropdown-item"
              :class="{ active: isActive(item.path) }"
              :aria-current="isActive(item.path) ? 'page' : undefined"
              @click.stop="navigate(item.path)"
            >
              <span class="item-label">{{ item.label }}</span>
              <span class="item-era">{{ eraOf(item.path) }}</span>
            </button>
          </div>
        </transition>
      </div>

      <button
        v-for="item in rightLevelItems"
        :key="item.path"
        type="button"
        class="nav-link"
        :class="{ active: isActive(item.path) }"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        @click="navigate(item.path)"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- 抽屉挂到 body：导航条有 backdrop-filter，会成为 fixed 子元素的包含块，抽屉被压成导航条那么高 -->
    <Teleport to="body">
      <transition name="drawer">
        <div v-show="mobileMenuOpen" class="nav-drawer-backdrop" @click="mobileMenuOpen = false">
          <aside class="nav-drawer" aria-label="导航" @click.stop>
            <div class="drawer-header">
              <span class="drawer-title">展厅</span>
              <button type="button" class="drawer-close" aria-label="关闭" @click="mobileMenuOpen = false">×</button>
            </div>
            <div class="drawer-body">
              <button
                type="button"
                class="drawer-item"
                :class="{ active: isActive(topLevelItems[0].path) }"
                @click="navigate(topLevelItems[0].path)"
              >
                <span class="drawer-item-label">{{ topLevelItems[0].label }}</span>
              </button>
              <template v-for="group in navGroups" :key="group.code">
                <div class="drawer-group-label">{{ group.label }}</div>
                <button
                  v-for="item in group.items"
                  :key="item.path"
                  type="button"
                  class="drawer-item"
                  :class="{ active: isActive(item.path) }"
                  @click="navigate(item.path)"
                >
                  <span class="drawer-item-label">{{ item.label }}</span>
                  <span class="drawer-item-era">{{ eraOf(item.path) }}</span>
                </button>
              </template>
              <button
                type="button"
                class="drawer-item"
                :class="{ active: isActive(rightLevelItems[0].path) }"
                @click="navigate(rightLevelItems[0].path)"
              >
                <span class="drawer-item-label">{{ rightLevelItems[0].label }}</span>
              </button>
            </div>
          </aside>
        </div>
      </transition>
    </Teleport>

    <div class="nav-right">
      <button type="button" class="identity" :title="userStore.username" @click="userStore.login('bug')">
        <span class="identity-role">{{ userStore.roleName }}</span>
        <span class="identity-name">{{ userStore.username }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.archive-nav {
  position: relative;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 2rem;
  height: 60px;
  padding: 0 2rem;
  background: rgba(19, 20, 22, 0.94);
  border-bottom: 1px solid var(--incision-soft);
}

/* 品牌：VI 组合标志（标志 + 碑刻「三体·深时」+ 副标） */
.brand {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0;
  background: none;
  border: 0;
  color: var(--bone);
  cursor: pointer;
}
.mark { align-self: center; color: var(--bone); }
.brand-name {
  font-family: var(--font-title);
  font-weight: 900;
  font-size: 1.375rem;
  letter-spacing: 0.12em;
}
.brand-sub { font-size: 0.8125rem; letter-spacing: 0.1em; color: var(--weathered); }

.nav-center {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 0.25rem;
  height: 100%;
}
.nav-group { position: relative; display: flex; }
.nav-link {
  position: relative;
  padding: 0 1rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 1rem;
  letter-spacing: 0.14em;
  white-space: nowrap;
  color: var(--weathered);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color 0.2s;
}
.nav-link:hover,
.nav-link[aria-expanded='true'] { color: var(--bone); }
.nav-link.active { color: var(--bone); }
/* 当前展区：底边一道切伦科夫蓝的细光 */
.nav-link.active::after {
  content: '';
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: -1px;
  height: 1px;
  background: var(--cherenkov);
  box-shadow: 0 0 8px rgba(var(--cherenkov-rgb), 0.8);
}
.nav-link:focus-visible { outline-offset: -4px; }

.group-dropdown {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  min-width: 13rem;
  padding: 0.4rem 0;
  background: var(--slab);
  border: 1px solid var(--incision);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  z-index: 110;
}
.dropdown-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1.5rem;
  padding: 0.6rem 1.1rem;
  font: inherit;
  text-align: left;
  color: var(--gray-200);
  background: none;
  border: 0;
  border-left: 2px solid transparent;
  cursor: pointer;
}
.dropdown-item:hover { background: var(--slab-raised); color: var(--bone); }
.dropdown-item.active { border-left-color: var(--cherenkov); color: var(--bone); }
.item-label { font-family: var(--font-serif); font-size: 0.9375rem; white-space: nowrap; }
.item-era { font-size: 0.8125rem; color: var(--weathered); white-space: nowrap; }
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.18s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; }

.nav-right { flex: 0 0 auto; }
.identity {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0.25rem 0;
  background: none;
  border: 0;
  cursor: pointer;
  line-height: 1.3;
}
.identity-role { font-family: var(--font-serif); font-size: 0.875rem; color: var(--bone); }
.identity-name { font-size: 0.75rem; color: var(--weathered); }

.nav-hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  margin-left: auto;
  padding: 0 9px;
  background: none;
  border: 1px solid var(--incision);
  border-radius: 2px;
  cursor: pointer;
}
.hamburger-line { display: block; width: 20px; height: 1.5px; background: var(--bone); transition: transform 0.25s, opacity 0.25s; }
.hamburger-line:nth-child(1).open { transform: translateY(6px) rotate(45deg); }
.hamburger-line:nth-child(2).open { opacity: 0; }
.hamburger-line:nth-child(3).open { transform: translateY(-6px) rotate(-45deg); }

.nav-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
}
.nav-drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: min(320px, 86vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--slab);
  border-left: 1px solid var(--incision);
}
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--incision-soft);
}
.drawer-title { font-family: var(--font-title); font-weight: 900; font-size: 1.125rem; letter-spacing: 0.12em; color: var(--bone); }
.drawer-close { width: 36px; height: 36px; font-size: 1.5rem; line-height: 1; color: var(--weathered); background: none; border: 0; cursor: pointer; }
.drawer-body { flex: 1; overflow-y: auto; padding: 0.5rem 0 1.5rem; }
.drawer-group-label {
  padding: 1.1rem 1.25rem 0.35rem;
  font-family: var(--font-serif);
  font-size: 0.8125rem;
  letter-spacing: 0.2em;
  color: var(--weathered);
}
.drawer-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.65rem 1.25rem;
  font: inherit;
  text-align: left;
  color: var(--gray-200);
  background: none;
  border: 0;
  border-left: 2px solid transparent;
  cursor: pointer;
}
.drawer-item.active { border-left-color: var(--cherenkov); color: var(--bone); background: rgba(var(--cherenkov-rgb), 0.06); }
.drawer-item-label { font-family: var(--font-serif); font-size: 1rem; }
.drawer-item-era { font-size: 0.8125rem; color: var(--weathered); }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-active .nav-drawer, .drawer-leave-active .nav-drawer { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .nav-drawer, .drawer-leave-to .nav-drawer { transform: translateX(100%); }

@media (max-width: 1280px) {
  .archive-nav { gap: 1rem; padding: 0 1.25rem; }
  .nav-link { padding: 0 0.7rem; letter-spacing: 0.1em; }
  .brand-sub { display: none; }
}
@media (max-width: 1100px) {
  .archive-nav { height: 56px; }
  .nav-center { display: none; }
  .nav-hamburger { display: flex; }
  .brand-sub { display: inline; }
  .identity-name { display: none; }
}
@media (max-width: 420px) {
  .brand-sub { display: none; }
}
</style>
