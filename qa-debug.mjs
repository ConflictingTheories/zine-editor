import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 820 } })
const logs = []
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })

// navigate to light table
for (const label of ['Light Table', 'LIGHT TABLE', 'Light table']) {
  const el = page.getByText(label, { exact: false }).first()
  if (await el.count()) { await el.click(); break }
}
await page.waitForTimeout(2500)

const probe = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const gl = c?.getContext('webgl2')
  return {
    status: document.querySelector('.lt-statusbar')?.innerText || null,
    canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
    hasGL: !!gl
  }
})
console.log('PROBE', JSON.stringify(probe, null, 2))
console.log('LOGS', logs.join('\n'))

await page.screenshot({ path: '/tmp/lt-debug.png' })
await browser.close()
