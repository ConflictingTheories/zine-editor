import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

const VPContext = createContext()

export const useVP = () => useContext(VPContext)

const VPProvider = ({ children }) => {
    const [vpState, setVpState] = useState({
        projects: JSON.parse(localStorage.getItem('vp_projects') || '[]'),
        published: [],
        currentProject: null,
        isPremium: false,
        selectedTheme: 'classic',
        user: JSON.parse(localStorage.getItem('vp_user')),
        token: localStorage.getItem('vp_token'),
        isOnline: navigator.onLine,
        isSyncing: false,
        toasts: [],
        modals: {},
        currentView: 'dashboard',
        selection: { type: null, id: null, pageIdx: 0 },
        history: [],
        historyIdx: -1
    })

    const updateVpState = (updates) => {
        setVpState(prev => ({ ...prev, ...updates }))
    }

    const pushHistory = (project) => {
        setVpState(prev => {
            const nextHistory = prev.history.slice(0, prev.historyIdx + 1)
            nextHistory.push(JSON.parse(JSON.stringify(project)))
            if (nextHistory.length > 50) nextHistory.shift()
            return {
                ...prev,
                history: nextHistory,
                historyIdx: nextHistory.length - 1
            }
        })
    }

    const themes = {
        classic: { '--ed-black': '#1a1a1a', '--ed-crimson': '#5c0a0a', '--ed-white': '#fdfaf1', '--ed-purple': '#4b2c5e', '--ed-green': '#2ecc71', '--ed-gold': '#d4af37', '--ed-silver': '#bdc3c7', '--ed-gray': '#34495e', '--ed-font': "'EB Garamond',serif", '--ed-display': "'Playfair Display',serif", '--ed-accent': "'Crimson Text',serif", status: 'STABLE' },
        fantasy: { '--ed-black': '#0a0a0a', '--ed-crimson': '#8b0000', '--ed-white': '#f5f5dc', '--ed-purple': '#4b0082', '--ed-green': '#00ff41', '--ed-gold': '#ffd700', '--ed-silver': '#c0c0c0', '--ed-gray': '#2c2c2c', '--ed-font': "'Crimson Text',serif", '--ed-display': "'Cinzel',serif", '--ed-accent': "'MedievalSharp',cursive", status: 'LEGENDARY' },
        cyberpunk: { '--ed-black': '#050505', '--ed-crimson': '#ff003c', '--ed-white': '#f0f0f0', '--ed-purple': '#bc00ff', '--ed-green': '#00f3ff', '--ed-gold': '#fcee0a', '--ed-silver': '#333', '--ed-gray': '#121212', '--ed-font': "'Roboto Mono',monospace", '--ed-display': "'Orbitron',sans-serif", '--ed-accent': "'Bebas Neue',sans-serif", status: 'CONNECTED' },
        conspiracy: { '--ed-black': '#000', '--ed-crimson': '#4a0000', '--ed-white': '#e8e4d9', '--ed-purple': '#2a003a', '--ed-green': '#00ff00', '--ed-gold': '#c5b358', '--ed-silver': '#7f8c8d', '--ed-gray': '#1c1c1c', '--ed-font': "'Courier Prime',monospace", '--ed-display': "'Special Elite',cursive", '--ed-accent': "'Roboto Mono',monospace", status: 'CLASSIFIED' },
        worldbuilding: { '--ed-black': '#2c3e50', '--ed-crimson': '#e74c3c', '--ed-white': '#ecf0f1', '--ed-purple': '#8e44ad', '--ed-green': '#27ae60', '--ed-gold': '#f1c40f', '--ed-silver': '#95a5a6', '--ed-gray': '#34495e', '--ed-font': "'Assistant',sans-serif", '--ed-display': "'Montserrat',sans-serif", '--ed-accent': "'Crimson Text',serif", status: 'CHARTED' },
        comics: { '--ed-black': '#000', '--ed-crimson': '#ff0000', '--ed-white': '#fff', '--ed-purple': '#663399', '--ed-green': '#32cd32', '--ed-gold': '#ffd700', '--ed-silver': '#ccc', '--ed-gray': '#222', '--ed-font': "'Comic Neue',cursive", '--ed-display': "'Bangers',cursive", '--ed-accent': "'Bebas Neue',sans-serif", status: 'DYNAMIC' },
        arcane: { '--ed-black': '#0f041b', '--ed-crimson': '#6a040f', '--ed-white': '#f8f1ff', '--ed-purple': '#3c096c', '--ed-green': '#70e000', '--ed-gold': '#ff9e00', '--ed-silver': '#5a189a', '--ed-gray': '#240046', '--ed-font': "'Crimson Text',serif", '--ed-display': "'Cinzel Decorative',cursive", '--ed-accent': "'Cinzel',serif", status: 'MANIFESTED' }
    }

    const [clipboard, setClipboard] = useState(null)

    const undo = () => {
        if (vpState.historyIdx > 0) {
            const nextIdx = vpState.historyIdx - 1
            const project = JSON.parse(JSON.stringify(vpState.history[nextIdx]))
            setVpState(prev => ({ ...prev, currentProject: project, historyIdx: nextIdx }))
        }
    }

    const redo = () => {
        if (vpState.historyIdx < vpState.history.length - 1) {
            const nextIdx = vpState.historyIdx + 1
            const project = JSON.parse(JSON.stringify(vpState.history[nextIdx]))
            setVpState(prev => ({ ...prev, currentProject: project, historyIdx: nextIdx }))
        }
    }

    const deletePage = () => {
        if (!vpState.currentProject) return
        if (vpState.currentProject.pages.length <= 1) {
            toast('Cannot delete last page', 'error')
            return
        }
        if (!confirm('Delete current page?')) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx } = vpState.selection
        project.pages.splice(pageIdx, 1)
        const nextIdx = Math.min(pageIdx, project.pages.length - 1)
        updateVpState({
            currentProject: project,
            selection: { type: 'page', id: project.pages[nextIdx].id, pageIdx: nextIdx }
        })
        pushHistory(project)
    }

    const duplicatePage = () => {
        if (!vpState.currentProject) return
        if (vpState.currentProject.pages.length >= 32) {
            toast('Max 32 pages', 'error')
            return
        }
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx } = vpState.selection
        const currentPage = project.pages[pageIdx]
        const newPage = JSON.parse(JSON.stringify(currentPage))
        newPage.id = Date.now()
        // New IDs for elements
        if (newPage.elements) newPage.elements.forEach(e => e.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9))
        project.pages.splice(pageIdx + 1, 0, newPage)
        updateVpState({
            currentProject: project,
            selection: { type: 'page', id: newPage.id, pageIdx: pageIdx + 1 }
        })
        pushHistory(project)
    }

    const duplicateElement = () => {
        if (!vpState.currentProject || vpState.selection.type !== 'element') return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx, id } = vpState.selection
        const el = project.pages[pageIdx].elements.find(e => e.id === id)
        if (el) {
            const newEl = JSON.parse(JSON.stringify(el))
            newEl.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            newEl.x += 20
            newEl.y += 20
            project.pages[pageIdx].elements.push(newEl)
            updateVpState({
                currentProject: project,
                selection: { type: 'element', id: newEl.id, pageIdx }
            })
            pushHistory(project)
        }
    }

    const copyElement = () => {
        if (!vpState.currentProject || vpState.selection.type !== 'element') return
        const { pageIdx, id } = vpState.selection
        const el = vpState.currentProject.pages[pageIdx].elements.find(e => e.id === id)
        if (el) {
            setClipboard(JSON.parse(JSON.stringify(el)))
            toast('Element copied', 'info')
        }
    }

    const pasteElement = () => {
        if (!vpState.currentProject || !clipboard) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx } = vpState.selection
        const newEl = JSON.parse(JSON.stringify(clipboard))
        newEl.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        newEl.x += 40
        newEl.y += 40
        project.pages[pageIdx].elements.push(newEl)
        updateVpState({
            currentProject: project,
            selection: { type: 'element', id: newEl.id, pageIdx }
        })
        pushHistory(project)
    }

    const moveLayer = (direction) => {
        if (!vpState.currentProject || vpState.selection.type !== 'element') return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx, id } = vpState.selection
        const elements = project.pages[pageIdx].elements
        const idx = elements.findIndex(e => e.id === id)
        if (idx === -1) return

        if (direction === 'up' && idx < elements.length - 1) {
            [elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]]
        } else if (direction === 'down' && idx > 0) {
            [elements[idx], elements[idx - 1]] = [elements[idx - 1], elements[idx]]
        } else if (direction === 'top') {
            const el = elements.splice(idx, 1)[0]
            elements.push(el)
        } else if (direction === 'bottom') {
            const el = elements.splice(idx, 1)[0]
            elements.unshift(el)
        }

        // Update all zIndex
        elements.forEach((e, i) => e.zIndex = i)
        updateCurrentProject(project)
    }

    const applyTheme = (key) => {
        const t = themes[key]
        if (!t || !vpState.currentProject) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const oldKey = project.theme || 'classic'
        const oldT = themes[oldKey]

        project.theme = key

        if (oldKey !== key && confirm('Do you want to update existing items to match the new theme?')) {
            project.pages.forEach(p => {
                // Background mapping
                Object.keys(oldT).forEach(k => {
                    if (k.startsWith('--ed-') && !k.includes('font') && p.background === oldT[k]) {
                        p.background = t[k]
                    }
                })

                if (p.elements) {
                    p.elements.forEach(el => {
                        // Font mapping
                        if (el.fontFamily) {
                            const norm = f => f.replace(/'/g, '').split(',')[0].trim()
                            if (norm(el.fontFamily) === norm(oldT['--ed-display'])) el.fontFamily = t['--ed-display'].replace(/'/g, '')
                            if (norm(el.fontFamily) === norm(oldT['--ed-font'])) el.fontFamily = t['--ed-font'].replace(/'/g, '')
                            if (norm(el.fontFamily) === norm(oldT['--ed-accent'])) el.fontFamily = t['--ed-accent'].replace(/'/g, '')
                        }
                        // Color mapping
                        Object.keys(oldT).forEach(k => {
                            if (k.startsWith('--ed-') && !k.includes('font')) {
                                const oldVal = oldT[k].toLowerCase()
                                const newVal = t[k]
                                if (el.color && el.color.toLowerCase() === oldVal) el.color = newVal
                                if (el.fill && el.fill.toLowerCase() === oldVal) el.fill = newVal
                                if (el.strokeColor && el.strokeColor.toLowerCase() === oldVal) el.strokeColor = newVal
                            }
                        })
                    })
                }
            })
        }

        updateCurrentProject(project)
        toast('Theme: ' + key, 'success')
    }

    const insertTemplate = (type) => {
        if (!vpState.currentProject) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx } = vpState.selection
        const page = project.pages[pageIdx]

        const theme = themes[project.theme || 'classic']
        const bg = theme['--ed-black']
        const fg = theme['--ed-white']
        const accent = theme['--ed-gold']
        const displayFont = theme['--ed-display'].replace(/'/g, '')
        const bodyFont = theme['--ed-font'].replace(/'/g, '')

        if (type === 'cover') {
            page.background = bg
            page.elements = [
                { id: 'el_t1_' + Date.now(), type: 'text', content: 'ZINE TITLE', x: 50, y: 150, width: 428, height: 100, fontSize: 64, fontFamily: displayFont, color: accent, align: 'center', bold: true, zIndex: 0 },
                { id: 'el_t2_' + Date.now(), type: 'text', content: 'Issue No. 01', x: 50, y: 260, width: 428, height: 40, fontSize: 24, fontFamily: bodyFont, color: fg, align: 'center', zIndex: 1 },
                { id: 'el_p1_' + Date.now(), type: 'panel', x: 40, y: 40, width: 448, height: 736, panelBorderWidth: 8, panelBorderColor: accent, panelBorderStyle: 'solid', zIndex: -1 }
            ]
        } else if (type === 'content') {
            page.background = theme['--ed-white']
            page.elements = [
                { id: 'el_t3_' + Date.now(), type: 'text', content: 'CHAPTER NAME', x: 50, y: 50, width: 428, height: 60, fontSize: 32, fontFamily: displayFont, color: bg, align: 'left', bold: true, zIndex: 0 },
                { id: 'el_t4_' + Date.now(), type: 'text', content: 'Start your story here...', x: 50, y: 120, width: 428, height: 600, fontSize: 16, fontFamily: bodyFont, color: bg, align: 'left', zIndex: 1 }
            ]
        } else if (type === 'back') {
            page.background = bg
            page.elements = [
                { id: 'el_t5_' + Date.now(), type: 'text', content: 'THE END', x: 50, y: 380, width: 428, height: 60, fontSize: 48, fontFamily: displayFont, color: fg, align: 'center', bold: true, zIndex: 0 }
            ]
        }

        updateCurrentProject(project)
        toast('Template applied', 'success')
    }

    const value = {
        vpState,
        updateVpState,
        showView,
        api,
        login,
        register,
        logout,
        toast,
        showModal,
        closeModal,
        saveLocal,
        createProject,
        openProject,
        saveProject,
        sync,
        undo,
        redo,
        addElement,
        updateElement,
        deleteElement,
        addPage,
        deletePage,
        duplicatePage,
        duplicateElement,
        copyElement,
        pasteElement,
        moveLayer,
        applyTheme,
        insertTemplate,
        playBGM,
        stopBGM,
        playSFX,
        activeVfx,
        triggerVfx,
        getAssets,
        addAsset,
        themes
    }

    return (
        <VPContext.Provider value={value}>
            {children}
        </VPContext.Provider>
    )
}

export { VPContext, VPProvider }
