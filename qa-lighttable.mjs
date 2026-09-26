export default async function run(page, ui) {
  const result = {}
  await page.waitForSelector('.dashboard', { timeout: 15000 })

  // Seed a couple of test images into the shared library so the Light Table
  // has something to develop.
  await page.evaluate(() => {
    const mk = (r, g, b) => {
      const c = document.createElement('canvas')
      c.width = 640; c.height = 480
      const x = c.getContext('2d')
      const grd = x.createLinearGradient(0, 0, 640, 480)
      grd.addColorStop(0, `rgb(${r},${g},${b})`)
      grd.addColorStop(1, '#222')
      x.fillStyle = grd
      x.fillRect(0, 0, 640, 480)
      for (let i = 0; i < 400; i++) {
        x.fillStyle = `rgba(255,255,255,${Math.random() * .5})`
        x.beginPath()
        x.arc(Math.random() * 640, Math.random() * 480, Math.random() * 30, 0, 7)
        x.fill()
      }
      return c.toDataURL('image/jpeg', .9)
    }
    localStorage.setItem('vp_asset_library', JSON.stringify({
      colors: [], fonts: [],
      imported: [
        { id: 'a1', name: 'gradient-one.jpg', src: mk(180, 60, 90), kind: 'image' },
        { id: 'a2', name: 'gradient-two.jpg', src: mk(40, 120, 160), kind: 'image' }
      ],
      audio: [], video: []
    }))
  })
  await page.reload()
  await page.waitForSelector('.zine-card', { timeout: 15000 })

  // Open the Light Table from the dashboard.
  await page.locator('.zine-card', { hasText: 'Light Table' }).first().click()
  await page.waitForSelector('.light-table', { timeout: 10000 })
  await page.waitForTimeout(1200)

  result.hasCanvas = await page.locator('.lt-stage canvas').count()
  result.thumbs = await page.locator('.lt-thumb').count()
  result.presetThumbs = await page.locator('.lt-preset canvas').count()
  result.status = (await page.locator('.lt-status').innerText()).replace(/\s+/g, ' ').slice(0, 160)
  result.sliders = await page.locator('.lt-slider').count()
  result.canvasSize = await page.evaluate(() => {
    const c = document.querySelector('.lt-stage canvas')
    return c ? `${c.width}x${c.height}` : null
  })
  // Is the canvas actually painted (not a blank black rect)?
  result.nonBlank = await page.evaluate(() => {
    const c = document.querySelector('.lt-stage canvas')
    if (!c) return null
    const gl = c.getContext('webgl2')
    if (gl) {
      const px = new Uint8Array(4)
      gl.readPixels(c.width >> 1, c.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return [...px].join(',')
    }
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4000) sum += d[i] + d[i + 1] + d[i + 2]
    return `2d sum=${sum}`
  })

  // Exercise a slider and confirm the canvas output changes.
  const before = result.nonBlank
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.lt-slider')]
      .find(s => s.textContent.includes('Exposure'))?.querySelector('input')
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '1.5')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => {
    const c = document.querySelector('.lt-stage canvas')
    const gl = c.getContext('webgl2')
    if (gl) {
      const px = new Uint8Array(4)
      gl.readPixels(c.width >> 1, c.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      return [...px].join(',')
    }
    return 'n/a'
  })
  result.sliderChangedPixels = before !== after
  result.afterPixel = after

  await page.screenshot({ path: '/tmp/lt-develop.png' })

  // Check each inspector tab renders.
  const tabs = {}
  for (const t of ['Effects', 'Curves', 'Crop', 'LUT']) {
    await page.locator('.lt-tab', { hasText: t }).click()
    await page.waitForTimeout(350)
    tabs[t] = await page.locator('.lt-inspector-body').innerText().then(s => s.trim().length)
  }
  result.tabs = tabs
  await page.locator('.lt-tab', { hasText: 'Develop' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/lt-full.png' })

  return result
}
