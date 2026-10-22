import { afterEach, describe, expect, it, vi } from 'vitest'
import { postSse, StreamHttpError } from './sse'

function streamResponse(chunks: string[], init: ResponseInit = {}): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init })
}

function mockFetch(response: Response | Error) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    if (response instanceof Error) throw response
    return response
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('postSse', () => {
  it('解析 JSON 编码的片段，保留其中的换行，忽略 [DONE]', async () => {
    mockFetch(streamResponse(['data: "虫子，"\n\n', 'data: "第一行\\n第二行"\n\n', 'data: [DONE]\n\n']))
    const got: string[] = []
    await postSse('/api/chat/stream', { message: 'hi' }, (c) => got.push(c))
    expect(got).toEqual(['虫子，', '第一行\n第二行'])
  })

  it('事件跨网络分包时仍能正确拼接', async () => {
    mockFetch(streamResponse(['da', 'ta: "智', '子"\n', '\ndata: "在看"\n\n']))
    const got: string[] = []
    await postSse('/x', {}, (c) => got.push(c))
    expect(got).toEqual(['智子', '在看'])
  })

  it('兼容 CRLF 分隔与旧后端的纯文本片段', async () => {
    mockFetch(streamResponse(['data: 旧格式文本\r\n\r\n', 'data: "新格式"\r\n\r\n']))
    const got: string[] = []
    await postSse('/x', {}, (c) => got.push(c))
    expect(got).toEqual(['旧格式文本', '新格式'])
  })

  it('流结束时缓冲区里未以空行结尾的最后一个事件也会被处理', async () => {
    mockFetch(streamResponse(['data: "尾巴"']))
    const got: string[] = []
    await postSse('/x', {}, (c) => got.push(c))
    expect(got).toEqual(['尾巴'])
  })

  it('非 2xx 抛出带状态码的 StreamHttpError', async () => {
    mockFetch(new Response('down', { status: 503, statusText: 'Service Unavailable' }))
    await expect(postSse('/x', {}, () => {})).rejects.toMatchObject({ status: 503 })
    await expect(postSse('/x', {}, () => {})).rejects.toBeInstanceOf(StreamHttpError)
  })

  it('以 JSON 发送请求体', async () => {
    const spy = mockFetch(streamResponse([]))
    await postSse('/api/chat/figure', { figure_name: '罗辑' }, () => {})
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('/api/chat/figure')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ figure_name: '罗辑' })
  })
})
