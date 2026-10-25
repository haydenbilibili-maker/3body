/**
 * 读者的深时档案：访客在各展厅做出的选择。
 * 只保存在本机浏览器里；读写失败时只保留在本次访问。
 */
import { ref } from 'vue'

export interface Answer {
  path: string
  text: string
  at: number
}

const KEY = 'deep-time-answers-v1'
const VISIT_KEY = 'deep-time-visits-v1'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 存储不可用 */
  }
}

export const answers = ref<Record<string, Answer>>(load(KEY, {}))
export const visits = ref<string[]>(load(VISIT_KEY, []))

/** 记下这间展厅的回答（同一展厅只保留最近一次） */
export function recordAnswer(path: string, text: string, now = Date.now()) {
  answers.value = { ...answers.value, [path]: { path, text, at: now } }
  save(KEY, answers.value)
}

export function recordVisit(path: string) {
  if (visits.value.includes(path)) return
  visits.value = [...visits.value, path]
  save(VISIT_KEY, visits.value)
}

export function forgetAll() {
  answers.value = {}
  visits.value = []
  save(KEY, {})
  save(VISIT_KEY, [])
}
