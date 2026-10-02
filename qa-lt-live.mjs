export default async function run(page) {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.waitForSelector('.topnav-launch')

    await page.evaluate(() => {
        const image = document.createElement('canvas')
        image.width = 3000
        image.height = 2000
        const ctx = image.getContext('2d')
        const gradient = ctx.createLinearGradient(0, 0, image.width, image.height)
        gradient.addColorStop(0, '#315a77')
        gradient.addColorStop(1, '#dc9b60')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, image.width, image.height)
        const library = JSON.parse(localStorage.getItem('vp_asset_library') || '{}')
        library.imported = [{
            id: 'perf-check', name: 'perf-check.jpg', kind: 'image',
            src: image.toDataURL('image/jpeg', 0.9)
        }]
        localStorage.setItem('vp_asset_library', JSON.stringify(library))
    })
    await page.reload()
    await page.waitForSelector('.topnav-launch')
    await page.locator('.topnav-launch').click()
    await page.waitForSelector('.lt-stage canvas')
    await page.waitForFunction(() => document.querySelector('.lt-stage canvas')?.width > 300)

    const before = await page.evaluate(() => {
        const canvas = document.querySelector('.lt-stage canvas')
        const rect = canvas.getBoundingClientRect()
        return { width: canvas.width, height: canvas.height, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    })
    const slider = page.locator('.lt-slider').filter({ hasText: 'Exposure' }).locator('input[type=range]')
    await slider.dispatchEvent('pointerdown', { bubbles: true })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const during = await page.evaluate(() => {
        const canvas = document.querySelector('.lt-stage canvas')
        const rect = canvas.getBoundingClientRect()
        return { width: canvas.width, height: canvas.height, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    })
    const timings = await page.evaluate(async () => {
        const input = [...document.querySelectorAll('.lt-slider')]
            .find(element => element.textContent.includes('Exposure'))?.querySelector('input[type=range]')
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        const results = []
        for (let index = 0; index < 8; index++) {
            const start = performance.now()
            setValue.call(input, String((index % 6) / 4 - 0.5))
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await new Promise(resolve => requestAnimationFrame(resolve))
            results.push(performance.now() - start)
        }
        return results.map(value => Number(value.toFixed(1)))
    })
    await slider.dispatchEvent('pointerup', { bubbles: true })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const after = await page.evaluate(() => {
        const canvas = document.querySelector('.lt-stage canvas')
        const rect = canvas.getBoundingClientRect()
        return { width: canvas.width, height: canvas.height, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    })

    const sameRect = (a, b) => a.width === b.width && a.height === b.height
    await page.locator('.topnav-brand').click()
    await page.waitForSelector('.dashboard')
    await page.locator('.dash-shortcut-btn').filter({ hasText: 'New book' }).click()
    await page.waitForSelector('.pf-workspace', { timeout: 10000 })
    return {
        status: await page.locator('.lt-status').innerText(),
        before,
        during,
        after,
        timings,
        stableBacking: before.width === during.width && during.width === after.width
            && before.height === during.height && during.height === after.height,
        stableDisplay: sameRect(before.rect, during.rect) && sameRect(during.rect, after.rect)
        , portfolioMounted: await page.locator('.pf-workspace').count() === 1
    }
}
