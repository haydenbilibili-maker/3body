/**
 * 人物志 AI 对话：调用 POST /api/chat/figure，流式返回
 */
import { API, apiUrl } from '@/constants'
import { postSse, StreamHttpError } from '@/utils/sse'

export interface FigureChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FigureChatPayload {
  figure_name: string
  figure_role?: string
  figure_description?: string
  message: string
  history?: FigureChatMessage[]
  /** 以下三项仅在后端开启 3BODY_LLM_ALLOW_CLIENT_OVERRIDE 时生效 */
  api_key?: string
  base_url?: string
  model?: string
}

/**
 * 请求人物对话流式接口，通过 onChunk 逐段接收文本。
 * 返回的 Promise 在流结束或出错时 resolve；出错时 onError 会被调用。
 */
export async function streamFigureChat(
  payload: FigureChatPayload,
  onChunk: (chunk: string) => void,
  onError?: (err: string) => void
): Promise<void> {
  try {
    await postSse(apiUrl(API.CHAT_FIGURE), payload, onChunk)
  } catch (e) {
    if (e instanceof StreamHttpError) {
      onError?.(
        e.status === 502 || e.status === 503
          ? '无法连接 LLM，请确认 Ollama 已启动或后端已配置正确的 API 地址与 Key。'
          : e.status === 422
            ? '请求内容不合法（消息为空或过长）。'
            : `请求失败：${e.message}`
      )
    } else {
      onError?.('无法连接后端（智子信道中断），请确认后端已启动。')
    }
  }
}
