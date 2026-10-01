export default async function run(page, ui) {
  const result = {}

  // Seed a shoot: bright, distinguishable photos so a placed image can be
  // identified by colour alone.
  await page.evaluate(() => {
    const mk = (i) => {
      const c = document.createElement('canvas')
      c.width = 3000; c.height = 2000
      const g = c.getContext('2d')
      g.fillStyle = `hsl(${(i * 50) % 360} 70% 55%)`
      g.fillRect(0, 0, 3000, 2000)
      return {
        id: `p${i}`, name: `Frame ${i}`, shoot: i < 4 ? 'Shoot A' : 'Shoot B',
        src: c.toDataURL('image/jpeg', 0.75), bytes: 1e6, width: 3000, height: 2000,
        kind: 'image', addedAt: new Date(Date.now() - i * 60000).toISOString()
      }
    }
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = Array.from({ length: 8 }, (_, i) => mk(i))
    lib.audio = []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })
  await page.reload()
  await page.waitForTimeout(1200)

  const entry = (await ui.snapshot()).match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (!entry) return { error: 'no portfolio entry point' }
  await ui.click(entry)
  await page.waitForSelector('.pf-workspace')
  await page.waitForTimeout(800)

  result.libraryCount = await page.locator('.pf-library-count').textContent()
  result.densityButtons = await page.locator('.pf-density-btn').count()

  // ── Place a single photo by double-click ──
  const first = page.locator('.pf-thumb').first()
  await first.dblclick()
  await page.waitForTimeout(500)
  result.afterPlace = await page.evaluate(() => ({
    frames: document.querySelectorAll('.el-photo-frame').length,
    empty: document.querySelectorAll('.el-photo-frame.is-empty').length
  }))

  // ── Add an empty frame with the F key, then fill from library ──
  await page.locator('#canvasWrap').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('f')
  await page.waitForTimeout(400)
  result.afterF = await page.evaluate(() => ({
    frames: document.querySelectorAll('.el-photo-frame').length,
    empty: document.querySelectorAll('.el-photo-frame.is-empty').length
  }))

  // ── Replace an image in a filled frame via the real context menu ──
  // Geometry is read off the rendered element, so this asserts what the user
  // actually sees rather than trusting internal state.
  const readFrame = () => page.evaluate(() => {
    const el = document.querySelector('.el-photo-frame')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), src: el.querySelector('img')?.src?.slice(-24) }
  })
  const before = await readFrame()
  result.frameBeforeReplace = before

  await page.locator('.el-photo-frame').first().click({ button: 'right' })
  await page.waitForSelector('.portfolio-ctx', { timeout: 3000 })
  result.ctxItems = await page.locator('.portfolio-ctx .ctx-menu-item').allTextContents()

  // Open "Replace image" and pick a different photograph from the library.
  await page.locator('.portfolio-ctx .ctx-menu-item', { hasText: 'Replace image' }).click()
  await page.waitForTimeout(300)
  result.replaceOptions = await page.locator('.ctx-library-item').count()
  await page.locator('.ctx-library-item').nth(1).click()
  await page.waitForTimeout(500)

  const after = await readFrame()
  result.frameAfterReplace = after
  result.replaceKeptGeometry = Boolean(before && after &&
    after.x === before.x && after.y === before.y && after.w === before.w && after.h === before.h)
  result.replaceChangedImage = Boolean(before && after && after.src !== before.src)

  // ── Templates: apply a layout and confirm it lands as a new spread ──
  const spreadsBefore = await page.locator('.pf-spread-item').count()
  await page.locator('.pf-tab', { hasText: 'Layouts' }).click()
  await page.waitForTimeout(400)
  result.layoutCards = await page.locator('.pf-layout-card').count()
  await page.locator('.pf-layout-card').nth(4).click()
  await page.waitForTimeout(600)
  result.layoutApplied = await page.locator('.pf-spread-item').count() > spreadsBefore

  return result
}
