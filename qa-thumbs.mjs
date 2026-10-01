export default async function run(page, ui) {
  await page.evaluate(() => {
    const mk = (i, w, h, name) => {
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d')
      const hue = (i * 47) % 360
      g.fillStyle = `hsl(${hue} 60% 55%)`
      g.fillRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,255,255,.75)'
      g.font = `${Math.round(h / 6)}px sans-serif`
      g.fillText(name, w * 0.08, h * 0.55)
      return {
        id: `photo-seed-${i}`, name, originalName: `${name}.jpg`,
        src: c.toDataURL('image/jpeg', 0.8), bytes: 2_000_000, width: w, height: h,
        kind: 'image', addedAt: new Date(Date.now() - i * 60000).toISOString()
      }
    }
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    lib.imported = Array.from({ length: 24 }, (_, i) => mk(i, 4000, 2600, `Shoot ${i + 1}`))
    lib.audio = []
    localStorage.setItem('vp_asset_library', JSON.stringify(lib))
  })
  await page.reload()
  await page.waitForTimeout(1500)

  const before = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.pf-thumb img')]
    return imgs.map(i => ({
      src: (i.getAttribute('src') || '').slice(0, 40),
      natural: `${i.naturalWidth}x${i.naturalHeight}`,
      complete: i.complete
    }))
  })
  // Now open a portfolio so hydration + rendering both run.
  const snap = await ui.snapshot()
  const entry = snap.match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (entry) { await ui.click(entry); await page.waitForSelector('.pf-workspace'); await page.waitForTimeout(1500) }

  const after = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.pf-thumb img')]
    return imgs.map(i => ({
      src: (i.getAttribute('src') || '').slice(0, 40),
      natural: `${i.naturalWidth}x${i.naturalHeight}`,
      complete: i.complete
    }))
  })
  const storage = await page.evaluate(async () => {
    const m = await import('/src/lib/photoStore.js')
    const raw = localStorage.getItem('vp_asset_library') || '{}'
    const parsed = JSON.parse(raw || '{}')
    return {
      bytes: raw.length,
      withSrc: (parsed.imported || []).filter(a => a.src).length,
      hasThumb: (parsed.imported || []).filter(a => a.thumb).length,
      idbIds: (await m.storedPhotoIds()).length,
      firstKeys: Object.keys((parsed.imported || [])[0] || {})
    }
  })
  // Reload a second time: the library must now come back out of IndexedDB,
  // with localStorage holding metadata only.
  await page.reload()
  await page.waitForTimeout(1200)
  const snap2 = await ui.snapshot()
  const entry2 = snap2.match(/@(e\d+) [^\n]*Portfolio Book/)?.[1]
  if (entry2) { await ui.click(entry2); await page.waitForSelector('.pf-workspace'); await page.waitForTimeout(1500) }
  const roundTrip = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.pf-thumb img')]
    // The grid deliberately draws thumbnails, so check the model too: the
    // full-resolution src is what gets placed onto a canvas.
    const lib = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
    const m = await import('/src/lib/photoStore.js')
    const first = (lib.imported || [])[0]
    const blob = first ? await m.getPhotoBlob(first.id) : null
    return {
      total: imgs.length,
      broken: imgs.filter(i => i.naturalWidth === 0).length,
      gridUsesThumb: imgs.filter(i => (i.getAttribute('src') || '').startsWith('data:')).length,
      storageBytes: (localStorage.getItem('vp_asset_library') || '').length,
      fullBytesRecovered: blob ? blob.size : null
    }
  })
  return { before: before.slice(0, 3), after: after.slice(0, 6), black: after.filter(a => a.natural === '0x0').length, total: after.length, storage, roundTrip }
}
