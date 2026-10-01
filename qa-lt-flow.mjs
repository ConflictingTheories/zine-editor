export default async function run(page, ui) {
  const result = {}

  await page.evaluate(() => {
    const mk = (i) => {
      const c = document.createElement('canvas')
      c.width = 2400; c.height = 1600
      const g = c.getContext('2d')
      g.fillStyle = `hsl(${(i * 60) % 360} 65% 50%)`
      g.fillRect(0, 0, 2400, 1600)
      return {
        id: `p${i}`, name: `Frame ${i}`, shoot: i < 3 ? 'Shoot A' : 'Shoot B',
        src: c.toDataURL('image/jpeg', .75), bytes: 1e6, width: 2400, height: 1600,
        kind: 'image', addedAt: new Date(Date.now() - i * 60000).toISOString()
      }
    }
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = Array.from({ length: 6 }, (_, i) => mk(i))
    lib.audio = []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })
  await page.reload()
  await page.waitForTimeout(1200)

  const entry = (await ui.snapshot()).match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (!entry) return { error: 'no portfolio entry point', snapshot: (await ui.snapshot()).slice(0, 1500) }
  await ui.click(entry)
  await page.waitForSelector('.pf-workspace', { timeout: 8000 })
  await page.waitForTimeout(600)

  // ── Page-level right-click uses the photography menu ──
  const box = await page.locator('.ed-canvas').boundingBox()
  result.canvasBox = box
  // The canvas can be scrolled partly above the viewport, so pick a point that
  // is inside the canvas *and* inside the visible window.
  const vp = page.viewportSize()
  const cx = Math.max(box.x, 20) + 60
  const cy = Math.max(box.y, 20) + 60
  if (cx > vp.width || cy > vp.height) return { error: 'no on-screen canvas point', box, vp }
  await page.mouse.click(cx, cy, { button: 'right' })
  await page.waitForTimeout(600)
  result.anyMenu = await page.locator('.ctx-menu').count()
  result.whichMenu = await page.locator('.ctx-menu').first().getAttribute('class').catch(() => null)
  if (!result.anyMenu) {
    result.dialogs = await page.evaluate(() => ({
      modals: document.querySelectorAll('.modal, .dialog, [role=dialog]').length,
      overlays: document.querySelectorAll('[class*=overlay]').length
    }))
    return result
  }
  result.pageMenu = await page.locator('.portfolio-ctx .ctx-menu-item').allTextContents()
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 700, y: 860 } })
  await page.waitForTimeout(300)

  // ── Place, then develop that frame and come back ──
  await page.locator('.pf-thumb').first().dblclick()
  await page.waitForTimeout(500)
  const before = await page.evaluate(() => {
    const el = document.querySelector('.el-photo-frame')
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })

  await page.locator('.el-photo-frame').first().click({ button: 'right' })
  await page.waitForSelector('.portfolio-ctx')
  await page.locator('.portfolio-ctx .ctx-menu-item', { hasText: 'Develop in Light Table' }).click()
  await page.waitForSelector('.light-table', { timeout: 5000 })
  result.openedLightTable = true
  result.ltTitle = await page.locator('.light-table').innerText().then(t => t.split('\n').slice(0, 2).join(' / '))

  // Nudge exposure so the recipe is genuinely dirty, then apply.
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.lt-slider')].find(x => x.textContent.includes('Exposure'))
    const input = s?.querySelector('input')
    if (!input) return
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1.2')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(500)
  const applyBtn = page.locator('.lt-btn, button', { hasText: /^Apply/i }).first()
  result.hasApply = await applyBtn.count()
  await applyBtn.click()
  await page.waitForTimeout(900)

  result.backInWorkspace = await page.locator('.pf-workspace').count()
  const after = await page.evaluate(() => {
    const el = document.querySelector('.el-photo-frame')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const img = el.querySelector('img')
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), filter: img ? getComputedStyle(img).filter : null }
  })
  result.frameKeptAfterDevelop = Boolean(before && after &&
    after.x === before.x && after.y === before.y && after.w === before.w && after.h === before.h)
  result.recipeApplied = after?.filter && after.filter !== 'none'

  return result
}
