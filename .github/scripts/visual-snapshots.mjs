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
  ['sector-x', '归零者'],
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
  ['sector-guzheng', '古筝计划'],
  ['sector-sleep', '冬眠者'],
  ['sector-ledger', '读者的档案'],
  ['sector-sword', '执剑人'],
  ['sector-ns', '自然选择号'],
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
      // 根节点裁切：页面根元素 overflow:hidden 且内容高于自身——下方内容被藏起来、无法滚动到
      const root = main?.firstElementChild
      let clippedY = 0
      if (root) {
        const st = getComputedStyle(root)
        if (['hidden', 'clip'].includes(st.overflowY) && root.scrollHeight > root.clientHeight + 4) {
          clippedY = root.scrollHeight - root.clientHeight
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
        clippedY,
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
// 导航相关的交互态放在编年史页：首页的 Three.js 背景在 CI 的软件渲染下偶尔让主线程卡住数十秒
const STATES = [
  {
    name: 'desktop-nav-dropdown',
    viewport: 'desktop',
    slug: 'sector-b',
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
    slug: 'sector-b',
    act: async (page) => {
      await page.click('.nav-hamburger')
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'mobile-nav-drawer-scrolled',
    viewport: 'mobile',
    slug: 'sector-b',
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
  {
    // 四维碎片「方寸之间」：开始第一关、走两步后升维（墙应退化为细线、密室内部可见）
    name: 'desktop-flatland-lifted',
    viewport: 'desktop',
    slug: 'sector-g',
    act: async (page) => {
      await page.getByRole('button', { name: '开始' }).click({ timeout: 8000 })
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Space')
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(500)
    },
  },
  {
    // 647 小宇宙：等广播信号（第 12 天）→ 接收 → 跳过 → 归还质量（抉择界面）
    name: 'mobile-647-choose',
    viewport: 'mobile',
    slug: 'sector-u',
    act: async (page) => {
      await page.getByRole('button', { name: '接收广播' }).click({ timeout: 20000 })
      await page.getByRole('button', { name: '跳过' }).click({ timeout: 5000 })
      await page.getByRole('button', { name: '归还质量' }).click({ timeout: 5000 })
      await page.waitForTimeout(600)
    },
  },
  {
    // 宇宙膜「田园时代」：按住折叠 7 次，从十维走到三维（我们在这里）
    name: 'desktop-membrane-3d',
    viewport: 'desktop',
    slug: 'sector-m',
    act: async (page) => {
      const btn = page.locator('.m-fold')
      for (let i = 0; i < 7; i += 1) {
        await btn.hover({ timeout: 5000 })
        await page.mouse.down()
        await page.waitForTimeout(1300)
        await page.mouse.up()
        await page.waitForTimeout(600)
      }
    },
  },
  {
    // 红岸：自动追踪对准太阳 → 打开太阳增益 → 按住发射 → 跳过等待 → 回信与抉择
    name: 'desktop-redcoast-reply',
    viewport: 'desktop',
    slug: 'sector-r',
    act: async (page) => {
      await page.getByRole('button', { name: '自动追踪太阳' }).click({ timeout: 8000 })
      await page.waitForTimeout(3500)
      await page.getByRole('switch').first().click()
      const fire = page.getByRole('button', { name: '按住，向太阳发射' })
      await fire.hover()
      await page.mouse.down()
      await page.waitForTimeout(1900)
      await page.mouse.up()
      await page.getByRole('button', { name: '跳过等待' }).click({ timeout: 5000 })
      await page.getByRole('button', { name: '让监听员调谐' }).click({ timeout: 5000 })
      await page.waitForTimeout(11000)
    },
  },
  {
    // 原著阅读：导入一个 GBK 编码的 TXT，确认自动识别编码、分章、无乱码
    name: 'desktop-reader-gbk-txt',
    viewport: 'desktop',
    slug: 'sector-library',
    act: async (page) => {
      await page.setInputFiles('input[type=file]', { name: '三体试读.txt', mimeType: 'text/plain', buffer: Buffer.from('yP3M5aOoytS2wdH5sb6jqQoKtdrSu9XCIL/G0aex373nCqGhoaHN9O21vvW1w6OswLTV0sv7tcTV4ry4uPbIy9PQ0Km5xbnWoaMKoaGhocv7w8fOysbwwcvSu7j2vdChsL/G0aex373nobG1xNGnyvXX6davo6zT1s7KxvDBy9fuvfzP4LzM19TJsbXEvLjOu87vwO3Rp7zSoaMKoaGhobSwzeK1xLPHytDU2s7t9rDW0Mj00v7I9M/WoaMKCrXatv7VwiDMqMfyCqGhoaG2odLHsNHEuMfysNrU2syow+bW0NHro6zT1rDRwe3Su9a7x/Kw2tTatrS/2rHfoaMKoaGhoaGwxOO/tKOszt7C29TayrLDtMqxvOShosqyw7S12LXj1/bV4rj2yrXR6aOsveG5+7a80rvR+aGjobEKoaGhoaGw1eLLtcP3zu/A7bnmwsnU2sqxvOS6zb/VvOTJz8rHvvnUyLXEoaOhsQo=', 'base64') })
      await page.waitForSelector('.page .para', { timeout: 10000 })
      await page.waitForTimeout(500)
    },
  },
  {
    // 原著阅读：导入一本最小 EPUB 3（nav 目录、实体、注音），手机视口，打开目录
    name: 'mobile-reader-epub',
    viewport: 'mobile',
    slug: 'sector-library',
    act: async (page) => {
      await page.setInputFiles('input[type=file]', { name: '三体.epub', mimeType: 'application/epub+zip', buffer: Buffer.from('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', 'base64') })
      await page.waitForSelector('.page .para', { timeout: 10000 })
      await page.getByRole('button', { name: '目录与搜索' }).click()
      await page.waitForTimeout(400)
    },
  },
  {
    // 掩体：选掩体计划 → 键盘确认（HoldButton 键盘即触发）→ 守影 6 秒，校正第一座城
    name: 'desktop-bunker-hold',
    viewport: 'desktop',
    slug: 'sector-j',
    act: async (page) => {
      await page.getByRole('button', { name: /^掩体计划/ }).click({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，把人类搬进阴影' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(6000)
      await page.getByRole('button', { name: '校正' }).first().click()
      await page.waitForTimeout(400)
    },
  },
  {
    // 曲率驱动：点火，按住画面右侧拖着飞船绕太阳飞 5 秒
    name: 'desktop-curvature-flight',
    viewport: 'desktop',
    slug: 'sector-l',
    act: async (page) => {
      await page.getByRole('button', { name: '点火' }).click({ timeout: 8000 })
      const box = await page.locator('canvas.cv').boundingBox()
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5)
      await page.mouse.down()
      for (let i = 0; i < 25; i += 1) {
        const a = Math.PI / 2 - (i / 25) * Math.PI * 1.5
        await page.mouse.move(box.x + box.width * (0.5 + Math.cos(a) * 0.2), box.y + box.height * (0.5 + Math.sin(a) * 0.28))
        await page.waitForTimeout(200)
      }
      await page.mouse.up()
    },
  },
  {
    // 盲区：三个预置念头（只在心里想 / 说出口 / 写下来），出现结语
    name: 'mobile-blind-thoughts',
    viewport: 'mobile',
    slug: 'sector-blind',
    act: async (page) => {
      await page.getByRole('button', { name: '真正的计划，是让他们以为我在骗他们' }).click({ timeout: 8000 })
      await page.getByRole('radio', { name: '说出口' }).click()
      await page.fill('input[aria-label=念头]', '把舰队开往木星')
      await page.keyboard.press('Enter')
      await page.getByRole('radio', { name: '写下来' }).click()
      await page.fill('input[aria-label=念头]', '我不相信我们能赢')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(900)
    },
  },
  {
    // 编年史：刻两件事进石碑，拖到一千八百九十万年后
    name: 'desktop-chronicle-erosion',
    viewport: 'desktop',
    slug: 'sector-b',
    act: async (page) => {
      const carve = page.getByRole('button', { name: '刻入石碑' })
      await carve.first().click({ timeout: 10000 })
      await carve.nth(3).click()
      await page.locator('.v-range').fill('2')
      await page.waitForTimeout(300)
      await page.locator('.v-range').fill('3')
      await page.waitForTimeout(800)
    },
  },
  {
    // 二向箔画廊：键盘触发「按住，让它跌入二维」，等待摊开
    name: 'desktop-gallery-flat',
    viewport: 'desktop',
    slug: 'sector-d',
    act: async (page) => {
      await page.getByRole('radio', { name: '土星' }).click({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，让它跌入二维' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(4200)
    },
  },
  {
    // 文明墓碑：选「斗大的字」，刻下默认留言，拖到十亿年后
    name: 'mobile-tomb-billion',
    viewport: 'mobile',
    slug: 'sector-tomb',
    act: async (page) => {
      await page.getByText('斗大的字').click({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，刻进石碑' }).focus()
      await page.keyboard.press('Enter')
      await page.locator('.scrub input').fill('7')
      await page.waitForTimeout(600)
    },
  },
  {
    // 银河人类：先开火（按住）、不回头，走完四个决定
    name: 'desktop-galaxy-voyage',
    viewport: 'desktop',
    slug: 'sector-human',
    act: async (page) => {
      await page.getByRole('button', { name: '继续向深空前进' }).click({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，先开火，夺取别的船上的物资' }).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: '保留选举和法律，哪怕效率更低' }).click()
      await page.getByRole('button', { name: '不回去，这里就是我们的家' }).click()
      await page.waitForTimeout(500)
    },
  },
  {
    // 人物志：一个人的选择，翻开第一条后果
    name: 'mobile-figures-choices',
    viewport: 'mobile',
    slug: 'sector-p',
    act: async (page) => {
      await page.getByRole('button', { name: '一个人的选择' }).click({ timeout: 10000 })
      await page.getByRole('button', { name: '后来发生了什么' }).first().click({ timeout: 5000 })
      await page.waitForTimeout(400)
    },
  },
  {
    // 归零者：第一轮就归还全部质量（键盘确认），然后听完剩下的广播
    name: 'desktop-returners-end',
    viewport: 'desktop',
    slug: 'sector-x',
    act: async (page) => {
      await page.getByRole('button', { name: '按住，归还全部质量' }).focus({ timeout: 8000 })
      await page.keyboard.press('Enter')
      for (let i = 0; i < 5; i += 1) {
        await page.getByRole('button', { name: '听下一轮广播' }).click({ timeout: 5000 })
        await page.waitForTimeout(200)
      }
      await page.waitForTimeout(1400)
    },
  },
  {
    // 宇宙留言簿：写一句话并发射，再写一句只留在留言簿里
    name: 'mobile-guestbook-signal',
    viewport: 'mobile',
    slug: 'sector-guestbook',
    act: async (page) => {
      await page.fill('textarea', '这里有人。')
      await page.getByRole('button', { name: '按住，向宇宙发射' }).focus()
      await page.keyboard.press('Enter')
      await page.fill('textarea', '我们不知道你是谁。')
      await page.getByRole('button', { name: '只写在留言簿里' }).click()
      await page.waitForTimeout(2200)
    },
  },
  {
    // 编年史：档案馆分册
    name: 'desktop-chronicle-archive',
    viewport: 'desktop',
    slug: 'sector-b',
    act: async (page) => {
      await page.getByRole('button', { name: '档案馆', exact: true }).click({ timeout: 8000 })
      await page.waitForTimeout(1200)
    },
  },
  {
    // 编年史：百科分册（手机）
    name: 'mobile-chronicle-wiki',
    viewport: 'mobile',
    slug: 'sector-b',
    act: async (page) => {
      await page.getByRole('button', { name: '百科', exact: true }).click({ timeout: 8000 })
      await page.waitForTimeout(1200)
    },
  },
  {
    // 古筝计划：布置飞刃，丝距 0.5 米，按住让审判日号驶过
    name: 'desktop-guzheng-after',
    viewport: 'desktop',
    slug: 'sector-guzheng',
    act: async (page) => {
      await page.getByRole('button', { name: '布置飞刃' }).click({ timeout: 8000 })
      await page.locator('input[type=range]').fill('0.5')
      await page.getByRole('button', { name: '按住，让审判日号驶过' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(5000)
    },
  },
  {
    // 冬眠者：带上爱人，睡两次，在威慑纪元留下
    name: 'mobile-sleep-stay',
    viewport: 'mobile',
    slug: 'sector-sleep',
    act: async (page) => {
      await page.getByLabel('爱人').check({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，躺进冬眠舱' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(4000)
      await page.getByRole('button', { name: '按住，再睡一次' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(4000)
      await page.getByRole('button', { name: '留下来，在这个时代生活' }).click()
      await page.waitForTimeout(500)
    },
  },
  {
    // 读者的档案：先在古筝计划里选择「不执行」，再打开档案
    name: 'desktop-ledger-filled',
    viewport: 'desktop',
    slug: 'sector-guzheng',
    act: async (page) => {
      await page.getByRole('button', { name: '不执行' }).click({ timeout: 8000 })
      await page.goto(new URL('sector-ledger', BASE_URL).toString(), { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
    },
  },
  {
    // 执剑人：四个处境都选最温和的回答 → 接过开关 → 水滴来袭，倒计时中
    name: 'desktop-sword-alarm',
    viewport: 'desktop',
    slug: 'sector-sword',
    act: async (page) => {
      for (const t of ['在发抖，迟迟没有伸出去', '不愿意。没有什么值得两个世界陪葬', '两个世界里所有的孩子', '不会的，别怕']) {
        await page.getByRole('button', { name: t }).click({ timeout: 8000 })
      }
      await page.getByRole('button', { name: '按住，从罗辑手里接过开关' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2500)
    },
  },
  {
    // 自然选择号：拨到前进三，然后按住「前进四」，跳过追击
    name: 'mobile-ns-fled',
    viewport: 'mobile',
    slug: 'sector-ns',
    act: async (page) => {
      await page.getByRole('radio', { name: '前进三' }).click({ timeout: 8000 })
      await page.getByRole('button', { name: '按住，前进四' }).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: '跳过' }).click({ timeout: 5000 })
      await page.waitForTimeout(800)
    },
  },
  {
    // 首页：抓住一颗太阳甩出去，等轨迹画出来
    name: 'desktop-home-gravity',
    viewport: 'desktop',
    slug: 'sector-c',
    act: async (page) => {
      await page.waitForTimeout(3000)
      await page.mouse.move(900, 400)
      await page.waitForTimeout(3000)
    },
  },
  {
    // 水滴：镜面着色器
    name: 'desktop-droplet-mirror',
    viewport: 'desktop',
    slug: 'sector-w',
    act: async (page) => {
      await page.waitForTimeout(2500)
    },
  },
  {
    // 黑暗森林：灯在画布里移动几秒
    name: 'desktop-forest-lamp',
    viewport: 'desktop',
    slug: 'sector-e',
    act: async (page) => {
      const box = await page.locator('section.lamp canvas').boundingBox({ timeout: 8000 })
      for (let i = 0; i < 30; i += 1) {
        await page.mouse.move(box.x + box.width * (0.2 + 0.6 * (i / 30)), box.y + box.height * (0.5 + 0.3 * Math.sin(i / 4)))
        await page.waitForTimeout(120)
      }
    },
  },
  {
    // 二向箔画廊：展品跌入二维，然后整页跌进去
    name: 'desktop-gallery-page-fall',
    viewport: 'desktop',
    slug: 'sector-d',
    act: async (page) => {
      await page.getByRole('button', { name: '按住，让它跌入二维' }).focus({ timeout: 8000 })
      await page.keyboard.press('Enter')
      await page.waitForTimeout(4200)
      await page.getByRole('button', { name: '按住，让这一页也跌进去' }).focus({ timeout: 5000 })
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1800)
    },
  },
  {
    // 深时跃迁：从首页的展厅索引去「田园时代」，转场进行中
    name: 'desktop-warp',
    viewport: 'desktop',
    slug: 'sector-r',
    act: async (page) => {
      await page.waitForTimeout(600)
      await page.getByRole('link', { name: '田园时代' }).first().click({ timeout: 4000 }).catch(async () => {
        await page.getByRole('button', { name: '田园时代' }).first().click({ timeout: 4000 })
      })
      await page.waitForTimeout(450)
    },
  },
  {
    // 智子：键盘把质子展开到二维，松手刻电路（网格扫过整页）
    name: 'desktop-sophon-unfold',
    viewport: 'desktop',
    slug: 'sector-a',
    act: async (page) => {
      const cv = page.locator('.unfold-box canvas')
      await cv.scrollIntoViewIfNeeded({ timeout: 8000 })
      await cv.focus()
      for (let i = 0; i < 9; i += 1) {
        await page.keyboard.press('ArrowUp')
        await page.waitForTimeout(120)
      }
      await page.waitForTimeout(600)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1400)
    },
  },
  {
    // 红岸：回信到来前的瀑布图（监听员正在调谐）
    name: 'desktop-redcoast-waterfall',
    viewport: 'desktop',
    slug: 'sector-r',
    act: async (page) => {
      await page.getByRole('button', { name: '自动追踪太阳' }).click({ timeout: 8000 })
      await page.waitForTimeout(3500)
      await page.getByRole('switch').first().click()
      await page.getByRole('button', { name: '按住，向太阳发射' }).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: '跳过等待' }).click({ timeout: 5000 })
      await page.waitForTimeout(3500)
    },
  },
  {
    // 冬眠者：睡眠中，屏幕结霜
    name: 'desktop-sleep-frost',
    viewport: 'desktop',
    slug: 'sector-sleep',
    act: async (page) => {
      await page.getByRole('button', { name: '按住，躺进冬眠舱' }).focus({ timeout: 8000 })
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2600)
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
  for (const r of results) {
    if ((r.clippedY ?? 0) > 0) {
      console.log(`::warning title=clipped-root::${r.viewport}/${r.slug} 根节点 overflow:hidden 裁掉了 ${r.clippedY}px 内容`)
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
