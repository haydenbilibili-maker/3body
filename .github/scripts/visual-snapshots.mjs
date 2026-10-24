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
      const overflowX = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth
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
      return {
        overflowX: Math.round(overflowX),
        scrollHeight: doc.scrollHeight,
        tinyText,
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        interactive: document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]').length,
      }
    })
    .catch((e) => ({ evaluateError: short(e.message) }))

  const dir = path.join(OUT_DIR, viewport.name)
  await page.screenshot({ path: path.join(dir, `${slug}.jpg`), type: 'jpeg', quality: 70 })
  await page
    .screenshot({ path: path.join(dir, `${slug}.full.jpg`), type: 'jpeg', quality: 60, fullPage: true })
    .catch(() => {})
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

async function main() {
  for (const v of VIEWPORTS) await mkdir(path.join(OUT_DIR, v.name), { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const r = await snapshotRoute(browser, viewport, route)
      results.push(r)
      console.log(
        `[${viewport.name}] ${route[0]} ${r.loadMs}ms overflowX=${r.overflowX} errors=${r.consoleErrors.length + r.pageErrors.length} failed=${r.failedRequests.length}`,
      )
    }
  }
  await browser.close()

  await writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2))

  const rows = results.map(
    (r) =>
      `| ${r.viewport} | [${r.slug}](${r.viewport}/${r.slug}.jpg) ${r.title} | ${r.overflowX ?? '?'} | ${r.tinyText ?? '?'} | ${
        r.consoleErrors.length + r.pageErrors.length
      } | ${r.failedRequests.length} | ${r.loadMs} |`,
  )
  const md = [
    '# 视觉快照',
    '',
    `生成时间：${new Date().toISOString()}　来源：${process.env.GITHUB_SHA ?? 'local'}`,
    '',
    '| 视口 | 页面 | 横向溢出(px) | <12px 文字 | 报错 | 失败请求 | 耗时(ms) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
  await writeFile(path.join(OUT_DIR, 'README.md'), md)

  const broken = results.filter((r) => r.navError || r.pageErrors.length)
  console.log(`\n共 ${results.length} 张，${broken.length} 页存在未捕获异常或导航失败`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
