<script setup lang="ts">
/**
 * 深时轴：桌面端左侧的一条竖向时间刻度，从田园时代到时间之外。
 * 当前展厅所在的纪元亮起（切伦科夫蓝，全站唯一的常驻光点）；跨越全部纪元的展厅点亮整条轴。
 * 点击纪元前往该纪元的第一间展厅。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ERAS, firstSectorOfEra, sectorByPath, type EraId } from '@/data/sectors'

const route = useRoute()
const router = useRouter()
const sector = computed(() => sectorByPath(route.path))
const current = computed(() => sector.value?.era)

function go(id: EraId) {
  const target = firstSectorOfEra(id)
  if (target && target.path !== route.path) router.push(target.path)
}
</script>

<template>
  <nav class="deep-time" :class="{ all: current === 'all' }" aria-label="深时轴：纪元">
    <ol>
      <li
        v-for="era in ERAS"
        :key="era.id"
        :class="{ here: current === era.id, empty: !firstSectorOfEra(era.id) }"
      >
        <button
          type="button"
          :disabled="!firstSectorOfEra(era.id)"
          :aria-current="current === era.id ? 'location' : undefined"
          :title="era.note"
          @click="go(era.id)"
        >
          <span class="mark" aria-hidden="true"></span>
          <span class="name">{{ era.name }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.deep-time {
  position: relative;
  height: 100%;
  padding: 2.5rem 0 2rem;
}
.deep-time ol {
  position: relative;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
/* 轴线本身：一道刻痕 */
.deep-time ol::before {
  content: '';
  position: absolute;
  top: 0.55rem;
  bottom: 0.55rem;
  left: 1.25rem;
  width: 1px;
  background: var(--incision);
}
.deep-time.all ol::before {
  background: linear-gradient(180deg, rgba(var(--cherenkov-rgb), 0.15), rgba(var(--cherenkov-rgb), 0.6), rgba(var(--cherenkov-rgb), 0.15));
}

.deep-time button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.2rem 0.5rem 0.2rem 1rem;
  font: inherit;
  font-family: var(--font-serif);
  font-size: 0.8125rem;
  color: var(--weathered);
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
}
.deep-time button:hover:not(:disabled) { color: var(--bone); }
.deep-time button:disabled { cursor: default; opacity: 0.45; }

/* 刻度：未到达的纪元是一小段横线，当前纪元是一颗光点 */
.mark {
  flex: 0 0 auto;
  width: 9px;
  height: 1px;
  margin-left: -4px;
  background: var(--weathered);
  transition: all 0.4s;
}
.here .mark {
  width: 7px;
  height: 7px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--cherenkov);
  box-shadow: 0 0 0 4px rgba(var(--cherenkov-rgb), 0.12), 0 0 14px rgba(var(--cherenkov-rgb), 0.8);
}
.here .name { color: var(--bone); }
.all .mark { background: rgba(var(--cherenkov-rgb), 0.7); }
.name { white-space: nowrap; letter-spacing: 0.06em; }
</style>
