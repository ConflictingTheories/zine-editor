import { useVP } from '../context/VPContext.jsx'

class MCPClient {
    constructor() {
        this.baseURL = '/mcp'
    }

    async request(endpoint, method = 'GET', body = null) {
        const { vpState } = useVP()
        const headers = { 'Content-Type': 'application/json' }
        if (vpState.token) headers['Authorization'] = `Bearer ${vpState.token}`

        const res = await fetch(`${this.baseURL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        })

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                // Handle auth errors
                throw new Error('Authentication required')
            }
            throw new Error(await res.text())
        }

        return res.json()
    }

    // Zine operations
    async getZine(zineId) {
        return this.request(`/zines/${zineId}`)
    }

    async updateZine(zineId, title, data) {
        return this.request(`/zines/${zineId}`, 'PUT', { title, data })
    }

    // Page operations
    async addPage(zineId) {
        return this.request(`/zines/${zineId}/pages`, 'POST')
    }

    async updatePage(zineId, pageIdx, background, texture) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}`, 'PUT', { background, texture })
    }

    async deletePage(zineId, pageIdx) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}`, 'DELETE')
    }

    async duplicatePage(zineId, pageIdx) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}/duplicate`, 'POST')
    }

    // Element operations
    async addElement(zineId, pageIdx, element) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}/elements`, 'POST', { element })
    }

    async updateElement(zineId, pageIdx, elementId, updates) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}/elements/${elementId}`, 'PUT', updates)
    }

    async deleteElement(zineId, pageIdx, elementId) {
        return this.request(`/zines/${zineId}/pages/${pageIdx}/elements/${elementId}`, 'DELETE')
    }

    // Export operations
    async exportHTML(project) {
        return this.request('/export/html', 'POST', { project })
    }

    async exportPDF(project) {
        return this.request('/export/pdf', 'POST', { project })
    }

    // Utility methods for AI automation
    async createTextElement(zineId, pageIdx, content, x = 80, y = 80, options = {}) {
        const element = {
            type: 'text',
            content,
            x,
            y,
            width: options.width || 220,
            height: options.height || 50,
            fontSize: options.fontSize || 18,
            fontFamily: options.fontFamily || 'Crimson Text',
            color: options.color || '#0a0a0a',
            align: options.align || 'left',
            bold: options.bold || false,
            italic: options.italic || false,
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createImageElement(zineId, pageIdx, src, x = 80, y = 80, options = {}) {
        const element = {
            type: 'image',
            src,
            x,
            y,
            width: options.width || 200,
            height: options.height || 200,
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createPanelElement(zineId, pageIdx, x = 40, y = 40, options = {}) {
        const element = {
            type: 'panel',
            x,
            y,
            width: options.width || 220,
            height: options.height || 160,
            panelBorderWidth: options.borderWidth || 4,
            panelBorderColor: options.borderColor || '#0a0a0a',
            panelBorderStyle: options.borderStyle || 'solid',
            panelRadius: options.radius || 0,
            fill: options.fill || 'transparent',
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createBalloonElement(zineId, pageIdx, content, balloonType = 'dialog', x = 80, y = 80, options = {}) {
        const element = {
            type: 'balloon',
            content,
            balloonType,
            x,
            y,
            width: options.width || 200,
            height: options.height || 80,
            fontSize: options.fontSize || 14,
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createShapeElement(zineId, pageIdx, shape, x = 80, y = 80, options = {}) {
        const shapes = { circle: { width: 100, height: 100 }, square: { width: 100, height: 100 }, triangle: { width: 100, height: 100 }, diamond: { width: 80, height: 100 }, line_h: { width: 200, height: 4 }, arrow: { type: 'text', content: '➤', fontSize: 48, color: '#0a0a0a', width: 60, height: 60, fontFamily: 'sans-serif' } }
        const shapeConfig = shapes[shape] || shapes.circle
        const element = {
            type: shapeConfig.type || 'shape',
            shape,
            x,
            y,
            width: options.width || shapeConfig.width,
            height: options.height || shapeConfig.height,
            fill: options.fill || '#0a0a0a',
            ...options
        }
        if (shapeConfig.content) element.content = shapeConfig.content
        if (shapeConfig.fontSize) element.fontSize = shapeConfig.fontSize
        if (shapeConfig.color) element.color = shapeConfig.color
        if (shapeConfig.fontFamily) element.fontFamily = shapeConfig.fontFamily
        return this.addElement(zineId, pageIdx, element)
    }

    async createSFXElement(zineId, pageIdx, sfxType, x = 80, y = 80, options = {}) {
        const sfx = { crash: 'CRASH!', boom: 'BOOM!', zap: 'ZAP!', pow: 'POW!', whoosh: 'WHOOSH!', splat: 'SPLAT!' }
        const element = {
            type: 'text',
            content: sfx[sfxType] || 'BAM!',
            x,
            y,
            fontSize: 52,
            fontFamily: 'Bangers',
            color: '#0a0a0a',
            width: 180,
            height: 70,
            strokeWidth: 2,
            strokeColor: '#ffffff',
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createSymbolElement(zineId, pageIdx, symbol, x = 80, y = 80, options = {}) {
        const symbols = { pentagram: '⛤', skull: '☠', star_symbol: '✦', eye: '👁', biohazard: '☣', radiation: '☢', compass: '🧭', rune: 'ᚱ', ankh: '☥', omega: 'Ω', infinity: '∞', trident: '🔱' }
        const element = {
            type: 'text',
            content: symbols[symbol] || '✦',
            x,
            y,
            fontSize: 56,
            color: '#d4af37',
            width: 80,
            height: 80,
            fontFamily: 'sans-serif',
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async createShaderElement(zineId, pageIdx, shaderPreset, x = 80, y = 80, options = {}) {
        const element = {
            type: 'shader',
            shaderPreset,
            x,
            y,
            width: options.width || 220,
            height: options.height || 220,
            opacity: 1,
            ...options
        }
        return this.addElement(zineId, pageIdx, element)
    }

    async applyThemeToZine(zineId, themeKey) {
        const zine = await this.getZine(zineId)
        // Apply theme colors to existing elements
        const themeColors = this.getThemeColors(themeKey)

        for (let pageIdx = 0; pageIdx < zine.data.pages.length; pageIdx++) {
            const page = zine.data.pages[pageIdx]

            // Update page background if it's a default color
            if (page.background === '#ffffff' || page.background === '#000000') {
                await this.updatePage(zineId, pageIdx, themeColors.background, page.texture)
            }

            // Update element colors
            for (const element of page.elements) {
                const updates = {}

                if (element.color && this.isDefaultColor(element.color)) {
                    updates.color = themeColors.text
                }
                if (element.fill && this.isDefaultColor(element.fill)) {
                    updates.fill = themeColors.accent
                }

                if (Object.keys(updates).length > 0) {
                    await this.updateElement(zineId, pageIdx, element.id, updates)
                }
            }
        }

        return { status: 'theme applied' }
    }

    getThemeColors(themeKey) {
        const themes = {
            classic: { background: '#fdfaf1', text: '#1a1a1a', accent: '#d4af37' },
            fantasy: { background: '#f5f5dc', text: '#0a0a0a', accent: '#ffd700' },
            cyberpunk: { background: '#f0f0f0', text: '#050505', accent: '#ff003c' },
            conspiracy: { background: '#e8e4d9', text: '#000000', accent: '#c5b358' },
            worldbuilding: { background: '#ecf0f1', text: '#2c3e50', accent: '#f1c40f' },
            comics: { background: '#ffffff', text: '#000000', accent: '#ffd700' },
            arcane: { background: '#f8f1ff', text: '#0f041b', accent: '#ff9e00' }
        }
        return themes[themeKey] || themes.classic
    }

    isDefaultColor(color) {
        const defaults = ['#000000', '#ffffff', '#0a0a0a', '#333333', '#666666']
        return defaults.includes(color.toLowerCase())
    }

    // Batch operations for efficiency
    async batchUpdateElements(zineId, updates) {
        const results = []
        for (const update of updates) {
            try {
                const result = await this.updateElement(zineId, update.pageIdx, update.elementId, update.updates)
                results.push({ success: true, ...result })
            } catch (error) {
                results.push({ success: false, error: error.message })
            }
        }
        return results
    }

    // Template application
    async applyTemplate(zineId, pageIdx, templateType) {
        const templates = {
            cover: {
                background: '#1a1a1a',
                elements: [
                    { type: 'text', content: 'ZINE TITLE', x: 50, y: 150, width: 428, height: 100, fontSize: 64, color: '#d4af37', align: 'center', bold: true },
                    { type: 'text', content: 'Issue No. 01', x: 50, y: 260, width: 428, height: 40, fontSize: 24, color: '#fdfaf1', align: 'center' },
                    { type: 'panel', x: 40, y: 40, width: 448, height: 736, panelBorderWidth: 8, panelBorderColor: '#d4af37' }
                ]
            },
            content: {
                background: '#fdfaf1',
                elements: [
                    { type: 'text', content: 'CHAPTER NAME', x: 50, y: 50, width: 428, height: 60, fontSize: 32, color: '#1a1a1a', bold: true },
                    { type: 'text', content: 'Start your story here...', x: 50, y: 120, width: 428, height: 600, fontSize: 16, color: '#1a1a1a' }
                ]
            },
            back: {
                background: '#1a1a1a',
                elements: [
                    { type: 'text', content: 'THE END', x: 50, y: 380, width: 428, height: 60, fontSize: 48, color: '#fdfaf1', align: 'center', bold: true }
                ]
            }
        }

        const template = templates[templateType]
        if (!template) throw new Error('Template not found')

        await this.updatePage(zineId, pageIdx, template.background)

        // Clear existing elements
        const zine = await this.getZine(zineId)
        const existingElements = zine.data.pages[pageIdx].elements
        for (const element of existingElements) {
            await this.deleteElement(zineId, pageIdx, element.id)
        }

        // Add template elements
        for (const element of template.elements) {
            await this.addElement(zineId, pageIdx, element)
        }

        return { status: 'template applied' }
    }

    // MCP Resources
    async listResources() {
        return this.request('/resources/list', 'POST')
    }

    async readResource(uri) {
        return this.request('/resources/read', 'POST', { uri })
    }

    // MCP Prompts
    async listPrompts() {
        return this.request('/prompts/list', 'POST')
    }

    async getPrompt(name, args = {}) {
        return this.request('/prompts/get', 'POST', { name, arguments: args })
    }

    // Batch operations for efficiency
    async batchUpdateElements(zineId, updates) {
        const results = []
        for (const update of updates) {
            try {
                const result = await this.updateElement(zineId, update.pageIdx, update.elementId, update.updates)
                results.push({ success: true, ...result })
            } catch (error) {
                results.push({ success: false, error: error.message })
            }
        }
        return results
    }
}

export default MCPClient
