export function parseCube(text, name = 'Imported LUT') {
    let size = 0, dimension = 3, title = name, domainMin = [0, 0, 0], domainMax = [1, 1, 1]
    const values = []
    for (const raw of String(text || '').split(/\r?\n/)) {
        const line = raw.trim(); if (!line || line.startsWith('#')) continue
        const parts = line.split(/\s+/), head = parts[0].toUpperCase()
        if (head === 'TITLE') title = line.slice(5).trim().replace(/^"|"$/g, '') || title
        else if (head === 'LUT_3D_SIZE' || head === 'LUT_1D_SIZE') { size = Number(parts[1]); dimension = head === 'LUT_1D_SIZE' ? 1 : 3 }
        else if (head === 'DOMAIN_MIN') domainMin = parts.slice(1, 4).map(Number)
        else if (head === 'DOMAIN_MAX') domainMax = parts.slice(1, 4).map(Number)
        else if (parts.length >= 3 && parts.slice(0, 3).every(value => Number.isFinite(Number(value)))) values.push(...parts.slice(0, 3).map(Number))
    }
    if (!Number.isInteger(size) || size < 2) throw new Error('Not a valid .cube LUT: missing LUT size.')
    const expected = dimension === 1 ? size * 3 : size ** 3 * 3
    if (values.length < expected) throw new Error(`Truncated .cube LUT: expected ${expected / 3} color entries.`)
    let data = values.slice(0, expected)
    if (dimension === 1) {
        const oneD = data; data = []
        const sample = (x, channel) => { const f = Math.min(size - 1, Math.max(0, x)) * (size - 1), i = Math.min(size - 2, Math.floor(f)), t = f - i; return oneD[i * 3 + channel] + (oneD[(i + 1) * 3 + channel] - oneD[i * 3 + channel]) * t }
        for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) data.push(sample(r / (size - 1), 0), sample(g / (size - 1), 1), sample(b / (size - 1), 2))
    }
    return { name: title, size, dimension: 3, data, domainMin, domainMax }
}

export function cubeText(lut) {
    if (!lut?.size || !lut?.data?.length) throw new Error('No LUT data to export')
    const out = [`TITLE "${String(lut.name || 'Exported LUT').replaceAll('"', '')}"`, `LUT_3D_SIZE ${lut.size}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0']
    for (let i = 0; i < lut.data.length; i += 3) out.push(lut.data.slice(i, i + 3).map(value => Number(value).toFixed(6)).join(' '))
    return `${out.join('\n')}\n`
}

export function downloadText(filename, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}
