export default async function run(page, ui) {
  // Open a *zine* (not a portfolio) and right-click the canvas there. If the
  // plain editor also fails to show a menu, the behaviour predates this work.
  const snap = await ui.snapshot()
  const zine = snap.match(/@(e\d+) [^\n]*Create New Zine/)?.[1]
  if (!zine) return { error: 'no zine entry', snapshot: snap.slice(0, 1200) }
  await ui.click(zine)
  await page.waitForTimeout(1500)
  const hasCanvas = await page.locator('.ed-canvas').count()
  if (!hasCanvas) return { error: 'zine did not open an editor', view: await page.locator('body').innerText().then(t => t.slice(0, 300)) }
  const box = await page.locator('.ed-canvas').boundingBox()
  await page.mouse.click(box.x + 60, box.y + 60, { button: 'right' })
  await page.waitForTimeout(600)
  return {
    zineCtxMenus: await page.locator('.ctx-menu').count(),
    zineMenuClass: await page.locator('.ctx-menu').first().getAttribute('class').catch(() => null)
  }
}
