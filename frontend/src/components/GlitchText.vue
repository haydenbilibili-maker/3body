<script setup lang="ts">
/**
 * GlitchText.vue - 赛博朋克解密文字
 * 效果：随机字符滚动 -> 最终文字
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'

// active 必须给默认值 true：Vue 会把未传的布尔 prop 转成 false（而不是 undefined），
// 此前 active 恒为 false，解密动画从不执行，文字一直是空的（首页「恒星纪元」无值）。
const props = withDefaults(
  defineProps<{
    text: string
    active?: boolean
    speed?: number // ms per frame
    scramble?: number // duration of scramble
  }>(),
  { active: true, speed: 30, scramble: 20 },
)

let timer: ReturnType<typeof setInterval> | null = null

const displayText = ref('')
const chars = '!@#$%^&*()_+-=[]{}|;:,.<>/?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function decrypt() {
  const target = props.text
  const length = target.length
  let frame = 0
  const duration = props.scramble || 20 // frames
  
  if (timer) clearInterval(timer)
  const interval = setInterval(() => {
    let result = ''
    for (let i = 0; i < length; i++) {
      if (i < frame / 2) {
        result += target[i]
      } else {
        result += chars[Math.floor(Math.random() * chars.length)]
      }
    }
    displayText.value = result
    
    frame++
    if (frame > length * 2 + duration) {
      clearInterval(interval)
      displayText.value = target
    }
  }, props.speed || 30)
  timer = interval
}

watch(() => props.text, () => {
  if (props.active) decrypt()
  else displayText.value = props.text
})

onMounted(() => {
  if (props.active) decrypt()
  else displayText.value = props.text
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <span class="glitch-text" :data-text="text">{{ displayText }}</span>
</template>

<style scoped>
.glitch-text {
  font-family: var(--font-tech);
  display: inline-block;
  position: relative;
}
</style>
