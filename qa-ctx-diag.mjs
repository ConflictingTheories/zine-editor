export default async function run(page, ui) {
  const errs = []
  page.on('pageerror', e => errs.push(String(e && e.message || e)))

  await page.evaluate(() => {
    const mk = (i) => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 600
      const g = c.getContext('2d'); g.fillStyle = `hsl(${i * 60} 60% 50%)`; g.fillRect(0, 0, 900, 600)
      return { id: `p${i}`, name: `F${i}`, src: c.toDataURL('image/jpeg', .7), width: 900, height: 600, bytes: 1e6, kind: 'image', addedAt: new Date().toISOString() }
    }
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = Array.from({ length: 4 }, (_, i) => mk(i)); lib.audio = []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })
  await page.reload(); await page.waitForTimeout(1200)
  const snap = await ui.snapshot()
  const entry = snap.match(/@(e\d+) [^\n]*Create Portfolio Book/)?.[1]
  if (!entry) return { error: 'no portfolio entry', snapshot: snap.slice(0, 800) }
  await page.locator('.zine-card.create-card', { hasText: 'Create Portfolio Book' }).click()
  await page.waitForSelector('.pf-workspace', { timeout: 8000 })
  await page.waitForTimeout(600)

  // Fire a real contextmenu event on the page background and report state.
  const out = await page.evaluate(() => {
    const el = document.querySelector('.ed-canvas')
    if (!el) return { error: 'no canvas' }
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 250 }))
    return { dispatched: true }
  })
  await page.waitForTimeout(500)

  return {
    out,
    ctxMenus: await page.locator('.ctx-menu').count(),
    hitTest: await page.evaluate(() => {
      const el = document.querySelector('.ed-canvas')
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + 60, r.y + 60)
      return {
        topClass: top ? top.className : null,
        topTag: top ? top.tagName : null,
        isCanvas: top === el || (top && el.contains(top)),
        listeners: typeof getEventListeners !== 'undefined'
      }
    }),
    errs
  }
}
