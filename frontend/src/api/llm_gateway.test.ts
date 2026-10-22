import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// 熔断状态是模块级变量：每个用例重新加载模块，互不影响
async function loadGateway() {
  vi.resetModules()
  return import('./llm_gateway')
}

function respond(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  vi.restoreAllMocks()
})

const opts = (mock = 'MOCK') => ({ task: 'wallbreaker.analyze', payload: { directive: 'x' }, mock: () => mock })

describe('invokeLlmGateway', () => {
  it('成功时解开 {data} 外壳', async () => {
    fetchSpy.mockResolvedValue(respond(200, { data: '来自后端' }))
    const { invokeLlmGateway } = await loadGateway()
    await expect(invokeLlmGateway(opts())).resolves.toBe('来自后端')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('400 / 422：不重试，直接回退 mock，不计入熔断', async () => {
    fetchSpy.mockResolvedValue(respond(400))
    const { invokeLlmGateway, getGatewayRuntimeStatus } = await loadGateway()
    for (let i = 0; i < 4; i += 1) await expect(invokeLlmGateway(opts())).resolves.toBe('MOCK')
    expect(fetchSpy).toHaveBeenCalledTimes(4)
    expect(getGatewayRuntimeStatus().consecutiveFailures).toBe(0)
    expect(getGatewayRuntimeStatus().circuitOpen).toBe(false)
  })

  it('503（LLM 未配置）：不重试，回退 mock；连续 3 次后熔断，之后不再请求', async () => {
    fetchSpy.mockResolvedValue(respond(503))
    const { invokeLlmGateway, getGatewayRuntimeStatus } = await loadGateway()
    for (let i = 0; i < 3; i += 1) await invokeLlmGateway(opts())
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(getGatewayRuntimeStatus().circuitOpen).toBe(true)

    await expect(invokeLlmGateway(opts('熔断中'))).resolves.toBe('熔断中')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('502 与网络错误会重试（共 3 次）后回退 mock', async () => {
    fetchSpy.mockResolvedValueOnce(respond(502)).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(respond(502))
    const { invokeLlmGateway } = await loadGateway()
    await expect(invokeLlmGateway(opts())).resolves.toBe('MOCK')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('重试中途成功则返回后端结果', async () => {
    fetchSpy.mockResolvedValueOnce(respond(502)).mockResolvedValueOnce(respond(200, { data: 42 }))
    const { invokeLlmGateway } = await loadGateway()
    await expect(invokeLlmGateway({ ...opts(), mock: () => 0 })).resolves.toBe(42)
  })
})
