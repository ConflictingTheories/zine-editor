export default async function run(page, ui) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.waitForTimeout(700)
  let s = await ui.snapshot()
  await ui.click(s.match(/@(e\d+) button "Book Arrange[^"]*New book"/)?.[1])
  await page.waitForTimeout(1500)
  s = await ui.snapshot()
  const card = s.match(/@(e\d+) button "DRAFT[^"]*spreads?[^"]*"/)?.[1]
  if (card) { await ui.click(card); await page.waitForTimeout(1600) }

  const read = () => page.evaluate(() => {
    const page_ = document.querySelector('.pf-page')
    const canvas = document.querySelector('.ed-canvas')
    const z = document.querySelector('.pf-canvas-zoom')
    const r = e => e ? { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null
    return {
      zoom: document.querySelector('.pf-zoombar span')?.textContent,
      zoomBox: r(z), page: r(page_), canvas: r(canvas),
      canvasInline: canvas ? canvas.style.width + ' x ' + canvas.style.height : null,
      paper: document.querySelector('.pf-paper-picker select')?.value
    }
  })
  const at70 = await read()
  // Zoom to 120% and confirm the page actually scales.
  await page.evaluate(() => { const b=[...document.querySelectorAll('.pf-zoombar button')].find(x=>x.textContent==='+'); for(let i=0;i<5;i++) b.click(); })
  await page.waitForTimeout(700)
  const at120 = await read()
  await page.screenshot({ path: 'qa-fx-zoom.png' })
  return { at70, at120 }
}
