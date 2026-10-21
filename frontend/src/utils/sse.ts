/**
 * 后端流式接口（/api/chat、/api/chat/stream、/api/chat/figure）的 SSE 解析。
 *
 * 后端格式：每个事件一行 `data: <JSON 字符串>`，事件之间空一行，结束时发送 `data: [DONE]`。
 * 片段做了 JSON 编码，模型输出中的换行不会破坏分帧；为兼容旧后端，无法 JSON 解析时按原文处理。
 */

export class StreamHttpError extends Error {
  constructor(public readonly status: number, statusText: string) {
    super(`HTTP ${status} ${statusText}`)
  }
}

function decodeEvent(event: string): string | null {
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
  if (!dataLines.length) return null
  const data = dataLines.join('\n')
  if (data.trim() === '[DONE]') return null
  try {
    const parsed: unknown = JSON.parse(data)
    return typeof parsed === 'string' ? parsed : data
  } catch {
    return data
  }
}

/**
 * POST JSON 并逐段回调文本，流结束时 resolve。
 * 网络错误或非 2xx 状态时 reject（StreamHttpError 带状态码），由调用方决定回退方式。
 */
export async function postSse(
  url: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new StreamHttpError(res.status, res.statusText)
  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''
  const flush = (final: boolean) => {
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = final ? '' : events.pop() ?? ''
    for (const event of events) {
      const chunk = decodeEvent(event)
      if (chunk) onChunk(chunk)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    flush(false)
  }
  buffer += decoder.decode()
  flush(true)
}
