export default async function run(page, ui) {
  // Reuse the exact entry sequence that is known to reach the workspace.
  await page.evaluate(() => {
    const mk = (i) => {
      const c = document.createElement('canvas')
      c.width = 1200; c.height = 800
      const g = c.getContext('2d')
      g.fillStyle = `hsl(${i * 60} 60% 50%)`
      g.fillRect(0, 0, 1200, 800)
      return { id: `p${i}`, name: `F${i}`, src: c.toDataURL('image/jpeg', .7), bytes: 1e6, width: 1200, height: 800, kind: 'image', addedAt: new Date().toISOString() }
    }
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = Array.from({ length: 4 }, (_, i) => mk(i))
    lib.audio = []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })
  await page.reload()
  await page.waitForTimeout(900)
  const entry = (await ui.snapshot()).match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (!entry) return { error: 'no entry' }
  // Click the card directly rather than through a ref: refs are re-stamped on
  // every render and the dashboard re-renders as soon as the library hydrates.
  await page.locator('.zine-card.create-card', { hasText: 'Portfolio Book' }).click({ force: true })
  const opened = await page.waitForSelector('.pf-workspace', { timeout: 8000 }).then(() => true).catch(() => false)
  if (!opened) return { error: 'portfolio did not open', view: await page.evaluate(() => document.body.innerText.slice(0, 200)) }
  await page.waitForTimeout(900)

  // Find a canvas point that is both inside the canvas and on screen.
  const pt = await page.evaluate(() => {
    const el = document.querySelector('.ed-canvas')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = Math.round(r.left + 40), y = Math.round(r.top + 40)
    const top = document.elementFromPoint(x, y)
    return {
      x, y,
      canvas: { w: Math.round(r.width), h: Math.round(r.height) },
      topClass: top ? String(top.className) : null,
      hitsCanvas: el.contains(top)
    }
  })
  if (!pt) return { error: 'no canvas' }

  // Real right-click through the browser input pipeline, plus a direct
  // dispatch. If only the dispatch opens the menu, a listener higher up the
  // tree is swallowing the real event.
  await page.mouse.click(pt.x, pt.y, { button: 'right' })
  await page.waitForTimeout(400)
  const afterReal = { count: await page.locator('.ctx-menu').count(), fired: await page.evaluate(() => document.querySelector('.ed-canvas')?.getAttribute('data-ctx-fires')) }

  if (!afterReal.count) {
    await page.evaluate(() => {
      const el = document.querySelector('.ed-canvas')
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
    })
    await page.waitForTimeout(400)
  }

  return {
    pt,
    afterReal,
    ctxFired: await page.evaluate(() => document.querySelector('.ed-canvas')?.getAttribute('data-ctx-fires')),
    menuCount: await page.locator('.ctx-menu').count(),
    menuClass: await page.locator('.ctx-menu').first().getAttribute('class').catch(() => null),
    pageMenuItems: await page.locator('.portfolio-ctx .ctx-menu-item').allTextContents()
  }
}
