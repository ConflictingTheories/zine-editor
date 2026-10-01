export default async function run(page, ui) {
  // Seed the library with synthetic photos and create a portfolio, so the
  // photography workspace can be exercised without touching real files.
  await page.evaluate(() => {
    const mk = (i, w, h, name) => {
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d')
      const hue = (i * 47) % 360
      g.fillStyle = `hsl(${hue} 45% ${25 + (i * 7) % 45}%)`
      g.fillRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,255,255,.55)'
      g.font = `${Math.round(h / 6)}px sans-serif`
      g.fillText(name, w * 0.08, h * 0.55)
      return {
        id: `photo-seed-${i}`,
        name,
        originalName: `${name}.jpg`,
        src: c.toDataURL('image/jpeg', 0.8),
        bytes: 2_000_000 + i * 1000,
        width: w, height: h,
        kind: 'image',
        addedAt: new Date(Date.now() - i * 60000).toISOString(),
        favorite: i % 7 === 0,
        flagged: i % 11 === 0
      }
    }
    const assets = Array.from({ length: 24 }, (_, i) => mk(i, i % 3 === 0 ? 2000 : 4000, i % 3 === 0 ? 4000 : 2600, `Shoot ${i + 1}`))
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = assets
    lib.audio = lib.audio || []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })

  await page.reload()
  await page.waitForTimeout(900)

  const snap1 = await ui.snapshot()
  const createPortfolio = snap1.match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (!createPortfolio) return { error: 'no portfolio entry point', snapshot: snap1 }

  await ui.click(createPortfolio)
  await page.waitForSelector('.pf-workspace', { timeout: 8000 })

  const state = await page.evaluate(() => ({
    workspace: !!document.querySelector('.pf-workspace'),
    thumbs: document.querySelectorAll('.pf-thumb').length,
    spreads: document.querySelectorAll('.pf-spread-item').length,
    emptyFrames: document.querySelectorAll('.el-photo-frame.is-empty').length,
    topbar: [...document.querySelectorAll('.pf-topbar button')].map(b => b.textContent.trim()).filter(Boolean),
    status: document.querySelector('.pf-statusbar')?.innerText.replace(/\n/g, ' | '),
    libraryCount: document.querySelector('.pf-library-count')?.textContent
  }))

  return { state, snapshot: (await ui.snapshot()).slice(0, 3000) }
}
