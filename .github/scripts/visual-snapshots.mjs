/**
 * 全站视觉快照：逐页截图（桌面 / 手机），并记录每页的控制台报错、失败请求、
 * 横向溢出与加载耗时，输出到 OUT_DIR（截图 + report.json + README.md）。
 *
 * 由 .github/workflows/visual-snapshots.yml 调用；前提是 vite preview（:4173）与后端（:8000）已启动。
 * 本地运行：cd 到装有 playwright 的目录，BASE_URL=http://127.0.0.1:4173/ node visual-snapshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const OUT_DIR = process.env.OUT_DIR ?? 'snapshots'
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 3000)
// 页面在 .app-main 内部滚动（外层固定 100vh），整页截图拍不到下方内容，改为分段滚动截图
const SCROLL_CONTAINER = '.app-main'
const MAX_SEGMENTS = Number(process.env.MAX_SEGMENTS ?? 4)
// 单页总时限：某页卡死（如主线程死循环）时跳过它，并以 Actions 注释报告，而不是拖垮整个任务
const PAGE_TIMEOUT_MS = Number(process.env.PAGE_TIMEOUT_MS ?? 45_000)

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// 与 frontend/src/router/index.ts 保持一致
const ROUTES = [
  ['sector-c', '宇宙广播站（首页）'],
  ['sector-a', '智子终端'],
  ['sector-b', '文明编年史'],
  ['sector-d', '二向箔画廊'],
  ['sector-p', '人物志'],
  ['sector-e', '黑暗森林广场'],
  ['sector-t', '三体摆'],
  ['sector-u', '647号小宇宙'],
  ['sector-f', '面壁计划'],
  ['sector-s', '阶梯计划'],
  ['sector-g', '四维碎片'],
  ['sector-r', '红岸控制台'],
  ['sector-l', '曲率驱动'],
  ['sector-j', '掩体世界'],
  ['sector-w', '水滴'],
  ['sector-x', '未知区域'],
  ['sector-pdc', '行星防御理事会'],
  ['sector-ravine', '大低谷'],
  ['sector-blind', '盲区'],
  ['sector-tomb', '文明墓碑'],
  ['sector-human', '银河人类'],
  ['sector-m', '宇宙膜'],
  ['sector-boundary', '科学边界'],
  ['sector-v', '人列计算机'],
  ['sector-library', '原著阅读'],
  ['sector-guestbook', '宇宙留言簿'],
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
]

function short(text, n = 240) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

async function snapshotRoute(browser, viewport, [slug, title]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(short(msg.text()))
  })
  page.on('pageerror', (err) => pageErrors.push(short(err.message)))
  page.on('requestfailed', (req) => failedRequests.push(`${req.failure()?.errorText ?? 'failed'} ${short(req.url(), 120)}`))
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${short(res.url(), 120)}`)
  })

  const started = Date.now()
  let navError = null
  try {
    await page.goto(new URL(slug, BASE_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 })
  } catch (e) {
    navError = short(e.message)
  }
  await page.waitForTimeout(SETTLE_MS)
  const loadMs = Date.now() - started

  const metrics = await page
    .evaluate(() => {
      const doc = document.documentElement
      const main = document.querySelector('.app-main')
      const overflowX = Math.max(
        Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
        main ? main.scrollWidth - main.clientWidth : 0,
      )
      // 可见文字中字号小于 12px 的元素数量（可读性）
      let tinyText = 0
      for (const el of document.querySelectorAll('body *')) {
        if (!el.childNodes.length || el.children.length) continue
        const text = el.textContent?.trim()
        if (!text) continue
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0) continue
        if (parseFloat(style.fontSize) < 12) tinyText += 1
      }
      // 正文偏小：40 字以上的段落 / 列表项字号小于 14px（审计目标：正文 ≥ 14px）
      let smallBody = 0
      const smallBodySamples = []
      for (const el of document.querySelectorAll('p, li, dd, blockquote')) {
        const text = el.textContent?.trim() ?? ''
        if (text.length < 40) continue
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0) continue
        if (parseFloat(style.fontSize) < 14) {
          smallBody += 1
          if (smallBodySamples.length < 3) smallBodySamples.push(`${style.fontSize} ${text.slice(0, 24)}`)
        }
      }
      // 溢出元凶：右边缘超出视口、而父元素没有超出的元素（即「第一个撑出屏幕」的元素）
      const vw = window.innerWidth
      const describe = (el) =>
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : '') +
        [...el.classList].slice(0, 3).map((c) => `.${c}`).join('')
      const offenders = []
      if (overflowX > 0) {
        for (const el of document.querySelectorAll('.app-main *')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.right <= vw + 1) continue
          const pr = el.parentElement?.getBoundingClientRect()
          if (pr && pr.right > vw + 1) continue
          offenders.push({ right: r.right, text: `${describe(el)} w=${Math.round(r.width)} right=${Math.round(r.right)} (in ${describe(el.parentElement)})` })
        }
        // 按右边缘从远到近排序：真正把页面撑宽的元素排在最前（被 overflow:hidden 裁掉的小元素排在后面）
        offenders.sort((a, b) => b.right - a.right)
        offenders.splice(5)
      }
      return {
        offenders: offenders.map((o) => o.text),
        overflowX: Math.round(overflowX),
        scrollHeight: main ? main.scrollHeight : doc.scrollHeight,
        viewportHeight: main ? main.clientHeight : window.innerHeight,
        tinyText,
        smallBody,
        smallBodySamples,
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        interactive: document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]').length,
      }
    })
    .catch((e) => ({ evaluateError: short(e.message) }))

  const dir = path.join(OUT_DIR, viewport.name)
  await page.screenshot({ path: path.join(dir, `${slug}.jpg`), type: 'jpeg', quality: 70 })
  // 分段：把滚动容器依次滚到第 2、3… 屏并截图
  const segments = Math.min(
    MAX_SEGMENTS,
    Math.ceil((metrics.scrollHeight ?? 0) / Math.max(1, metrics.viewportHeight ?? 1)),
  )
  for (let i = 1; i < segments; i += 1) {
    await page
      .evaluate(
        ([sel, idx]) => {
          const el = document.querySelector(sel)
          if (el) el.scrollTop = idx * el.clientHeight
          else window.scrollTo(0, idx * window.innerHeight)
        },
        [SCROLL_CONTAINER, i],
      )
      .catch(() => {})
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(dir, `${slug}.p${i + 1}.jpg`), type: 'jpeg', quality: 65 }).catch(() => {})
  }
  await context.close()

  return {
    slug,
    title,
    viewport: viewport.name,
    loadMs,
    navError,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 10),
    pageErrors: [...new Set(pageErrors)].slice(0, 10),
    failedRequests: [...new Set(failedRequests)].slice(0, 10),
    ...metrics,
  }
}

// 交互态快照：只靠逐页截图看不到的界面（下拉菜单、手机抽屉）。每项：视口、页面、操作、截图名
const STATES = [
  {
    name: 'desktop-nav-dropdown',
    viewport: 'desktop',
    slug: 'sector-c',
    act: async (page) => {
      const group = page.locator('.nav-group').nth(1)
      try {
        await group.hover({ timeout: 5000 })
      } catch (e) {
        // 悬停失败通常是有元素盖在导航上（用户同样点不到）：记下盖住它的元素，再用事件兜底截图
        const cover = await group.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          const d = (n) => (n ? n.tagName.toLowerCase() + [...n.classList].slice(0, 3).map((c) => '.' + c).join('') : 'null')
          return { rect: [r.left, r.top, r.width, r.height].map(Math.round), top: d(top), contained: el.contains(top) }
        })
        console.log(`::warning title=nav-hover::${JSON.stringify(cover)} ${String(e.message).split('\n').slice(0, 6).join(' | ')}`.slice(0, 900))
        await group.dispatchEvent('mouseenter')
      }
      await page.waitForTimeout(600)
    },
  },
  {
    // 平板横屏：导航应切换为汉堡菜单，且不出现横向滚动条
    name: 'tablet-1024-nav-drawer',
    viewport: 'desktop',
    size: { width: 1024, height: 768 },
    slug: 'sector-b',
    act: async (page) => {
      await page.click('.nav-hamburger')
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'mobile-nav-drawer',
    viewport: 'mobile',
    slug: 'sector-c',
    act: async (page) => {
      await page.click('.nav-hamburger')
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'mobile-nav-drawer-scrolled',
    viewport: 'mobile',
    slug: 'sector-c',
    act: async (page) => {
      await page.click('.nav-hamburger')
      await page.waitForTimeout(400)
      await page.evaluate(() => {
        const el = document.querySelector('.drawer-body') ?? document.querySelector('.nav-drawer')
        if (el) el.scrollTop = el.scrollHeight
      })
      await page.waitForTimeout(300)
    },
  },
]

async function snapshotState(browser, state) {
  const viewport = VIEWPORTS.find((v) => v.name === state.viewport)
  const size = state.size ?? { width: viewport.width, height: viewport.height }
  const context = await browser.newContext({
    viewport: size,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(short(err.message)))
  let error = null
  try {
    await page.goto(new URL(state.slug, BASE_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(1500)
    await state.act(page)
    await page.screenshot({ path: path.join(OUT_DIR, 'states', `${state.name}.jpg`), type: 'jpeg', quality: 70 })
  } catch (e) {
    error = short(e.message)
  }
  await context.close()
  return { name: state.name, viewport: state.viewport, slug: state.slug, error, pageErrors }
}

async function main() {
  for (const v of VIEWPORTS) await mkdir(path.join(OUT_DIR, v.name), { recursive: true })
  let browser = await chromium.launch()
  const results = []
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const started = Date.now()
      let r
      try {
        r = await withTimeout(snapshotRoute(browser, viewport, route), PAGE_TIMEOUT_MS, `${viewport.name}/${route[0]}`)
      } catch (e) {
        console.log(`::warning title=snapshot-timeout::${viewport.name}/${route[0]} 超过 ${PAGE_TIMEOUT_MS}ms 未完成（页面可能卡死）`)
        r = {
          slug: route[0],
          title: route[1],
          viewport: viewport.name,
          loadMs: Date.now() - started,
          navError: short(e.message),
          consoleErrors: [],
          pageErrors: ['snapshot timeout'],
          failedRequests: [],
        }
        // 卡死页面的上下文可能仍占着浏览器，重启浏览器后继续
        await withTimeout(browser.close(), 10_000, 'browser.close').catch(() => {})
        browser = await chromium.launch()
      }
      results.push(r)
      console.log(
        `[${viewport.name}] ${route[0]} ${r.loadMs}ms overflowX=${r.overflowX} errors=${r.consoleErrors.length + r.pageErrors.length} failed=${r.failedRequests.length}`,
      )
    }
  }
  await mkdir(path.join(OUT_DIR, 'states'), { recursive: true })
  const states = []
  for (const state of STATES) {
    // 首页的 Three.js 偶尔让首屏挂载变慢，交互态失败时重试一次再判定
    let r
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      r = await withTimeout(snapshotState(browser, state), PAGE_TIMEOUT_MS, state.name).catch((e) => ({
        name: state.name,
        viewport: state.viewport,
        slug: state.slug,
        error: short(e.message),
        pageErrors: [],
      }))
      if (!r.error) break
      console.log(`[state] ${state.name} attempt ${attempt} failed: ${r.error}`)
    }
    states.push(r)
    console.log(`[state] ${r.name} ${r.error ? `ERROR ${r.error}` : 'ok'}`)
    if (r.error) console.log(`::warning title=state-snapshot::${r.name} ${r.error}`.slice(0, 900))
  }
  await browser.close()

  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2))
  await writeFile(path.join(OUT_DIR, 'states.json'), JSON.stringify(states, null, 2))

  const rows = results.map(
    (r) =>
      `| ${r.viewport} | [${r.slug}](${r.viewport}/${r.slug}.jpg) ${r.title} | ${r.scrollHeight ?? '?'} / ${
        r.viewportHeight ? (r.scrollHeight / r.viewportHeight).toFixed(1) : '?'
      } | ${r.overflowX ?? '?'} | ${r.tinyText ?? '?'} | ${r.smallBody ?? '?'} | ${
        r.consoleErrors.length + r.pageErrors.length
      } | ${r.failedRequests.length} | ${r.loadMs} |`,
  )
  const md = [
    '# 视觉快照',
    '',
    `生成时间：${new Date().toISOString()}　来源：${process.env.GITHUB_SHA ?? 'local'}`,
    '',
    '| 视口 | 页面 | 内容高度/屏数 | 横向溢出(px) | <12px 文字 | <14px 正文段落 | 报错 | 失败请求 | 耗时(ms) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## 交互态',
    '',
    ...states.map((r) => `- [${r.name}](states/${r.name}.jpg)${r.error ? ` — 失败：${r.error}` : ''}`),
    '',
  ].join('\n')
  await writeFile(path.join(OUT_DIR, 'README.md'), md)

  for (const r of results) {
    if ((r.overflowX ?? 0) > 0 && r.offenders?.length) {
      console.log(`::warning title=overflow::${r.viewport}/${r.slug} +${r.overflowX}px ← ${r.offenders.join(' ; ')}`.slice(0, 900))
    }
  }
  const broken = results.filter((r) => r.navError || r.pageErrors.length)
  console.log(`\n共 ${results.length} 张，${broken.length} 页存在未捕获异常或导航失败`)
  for (const r of broken) {
    console.log(`::warning title=page-error::${r.viewport}/${r.slug} ${r.navError ?? ''} ${r.pageErrors.join(' | ')}`.slice(0, 900))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
