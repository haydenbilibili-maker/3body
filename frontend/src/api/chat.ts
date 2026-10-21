/**
 * 智子终端对话：POST /api/chat/stream（后端先检索三体原著再以智子人格流式回答）。
 *
 * 没有后端时（如 GitHub Pages 纯静态部署）自动回退到本地离线回复，保证页面可玩；
 * 已经开始输出后才中断的，抛出异常交给页面显示「连接中断」。
 */
import { API, apiUrl } from '@/constants'
import type { Message } from '@/types/sophon'
import { postSse } from '@/utils/sse'

function offlineReply(question: string): string {
  if (question.includes('虫子')) return '你们是虫子。我们正在看着你们。'
  if (question.includes('你好')) return '我是智子。我在倾听。'
  return `[智子·离线] 我收到了你的信息：「${question}」。但在十一维视角下，这就如同在纸上爬行的蚂蚁留下的痕迹。`
}

async function streamOffline(text: string, onChunk: (chunk: string) => void): Promise<void> {
  for (const ch of text) {
    await new Promise((resolve) => setTimeout(resolve, 40))
    onChunk(ch)
  }
}

export async function streamChat(messages: Message[], onChunk: (chunk: string) => void): Promise<void> {
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content.trim() ?? ''
  if (!question) return

  let received = false
  try {
    await postSse(apiUrl(API.CHAT_STREAM), { message: question }, (chunk) => {
      received = true
      onChunk(chunk)
    })
  } catch (err) {
    if (received) throw err
    console.warn('[智子] 后端不可用，使用离线回复：', err)
    await streamOffline(offlineReply(question), onChunk)
  }
}
