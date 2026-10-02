export default async function run(page) {
  const readLayouts = () => page.evaluate(() => {
    const previews = [...document.querySelectorAll('.pf-layout-preview')]
    return {
      count: previews.length,
      cards: document.querySelectorAll('.pf-layout-card').length,
      framesDrawn: [...document.querySelectorAll('.pf-layout-card')].filter(c => c.querySelector('.pf-layout-frame')).length,
      sample: previews.slice(0,3).map(p => {
        const r = p.getBoundingClientRect()
        const fr = p.querySelector('.pf-layout-frame')
        const frr = fr?.getBoundingClientRect()
        return {
          box: Math.round(r.width) + 'x' + Math.round(r.height),
          firstFrame: frr ? Math.round(frr.width) + 'x' + Math.round(frr.height) : null,
          overflow: frr ? (frr.right > r.right + 1 || frr.bottom > r.bottom + 1) : false
        }
      })
    }
  })
  const openLayouts = async () => {
    await page.evaluate(() => [...document.querySelectorAll('.pf-left .pf-tab')].find(t=>t.textContent.trim()==='Layouts')?.click())
    await page.waitForTimeout(900)
  }

  await openLayouts()
  const onDigest = await readLayouts()
  await page.screenshot({ path: 'qa-lay-digest.png' })

  await page.evaluate(() => {
    const s2 = document.querySelector('.pf-paper-picker select')
    s2.value='square'; s2.dispatchEvent(new Event('change',{bubbles:true}))
  })
  await page.waitForTimeout(1100)
  await openLayouts()
  const onSquare = await readLayouts()
  await page.screenshot({ path: 'qa-lay-square.png' })
  return { onDigest, onSquare }
}
