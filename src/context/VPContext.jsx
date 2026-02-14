import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { getTutorialData } from '../data/tutorialData.js'

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
        readerMode: null,
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
        cyberpunk: { '--ed-black': '#050505', '--ed-crimson': '#ff003c', '--ed-white': '#f0f0f0', '--ed-purple': '#bc00ff', '--ed-green': '#00f3ff', '--ed-gold': '#fcee0a', '--ed-silver': '#333333', '--ed-gray': '#121212', '--ed-font': "'Roboto Mono',monospace", '--ed-display': "'Orbitron',sans-serif", '--ed-accent': "'Bebas Neue',sans-serif", status: 'CONNECTED' },
        conspiracy: { '--ed-black': '#000000', '--ed-crimson': '#4a0000', '--ed-white': '#e8e4d9', '--ed-purple': '#2a003a', '--ed-green': '#00ff00', '--ed-gold': '#c5b358', '--ed-silver': '#7f8c8d', '--ed-gray': '#1c1c1c', '--ed-font': "'Courier Prime',monospace", '--ed-display': "'Special Elite',cursive", '--ed-accent': "'Roboto Mono',monospace", status: 'CLASSIFIED' },
        worldbuilding: { '--ed-black': '#2c3e50', '--ed-crimson': '#e74c3c', '--ed-white': '#ecf0f1', '--ed-purple': '#8e44ad', '--ed-green': '#27ae60', '--ed-gold': '#f1c40f', '--ed-silver': '#95a5a6', '--ed-gray': '#34495e', '--ed-font': "'Assistant',sans-serif", '--ed-display': "'Montserrat',sans-serif", '--ed-accent': "'Crimson Text',serif", status: 'CHARTED' },
        comics: { '--ed-black': '#000000', '--ed-crimson': '#ff0000', '--ed-white': '#ffffff', '--ed-purple': '#663399', '--ed-green': '#32cd32', '--ed-gold': '#ffd700', '--ed-silver': '#cccccc', '--ed-gray': '#222222', '--ed-font': "'Comic Neue',cursive", '--ed-display': "'Bangers',cursive", '--ed-accent': "'Bebas Neue',sans-serif", status: 'DYNAMIC' },
        arcane: { '--ed-black': '#0f041b', '--ed-crimson': '#6a040f', '--ed-white': '#f8f1ff', '--ed-purple': '#3c096c', '--ed-green': '#70e000', '--ed-gold': '#ff9e00', '--ed-silver': '#5a189a', '--ed-gray': '#240046', '--ed-font': "'Crimson Text',serif", '--ed-display': "'Cinzel Decorative',cursive", '--ed-accent': "'Cinzel',serif", status: 'MANIFESTED' }
    }

    const [clipboard, setClipboard] = useState(null)
    const [activeVfx, setActiveVfx] = useState(null)
    const bgmRef = useRef(null)

    const showView = (name) => {
        setVpState(prev => ({ ...prev, currentView: name, ...(name !== 'reader' ? { readerMode: null } : {}) }))
    }

    const previewProject = () => {
        setVpState(prev => ({ ...prev, currentView: 'reader', readerMode: 'preview' }))
    }

    const toast = (msg, type = 'info') => {
        const id = Date.now()
        setVpState(prev => ({
            ...prev,
            toasts: [...prev.toasts, { id, msg, type }]
        }))
        setTimeout(() => {
            setVpState(prev => ({
                ...prev,
                toasts: prev.toasts.filter(t => t.id !== id)
            }))
        }, 3000)
    }

    const showModal = (id, subtype) => {
        setVpState(prev => ({
            ...prev,
            modals: { ...prev.modals, [id]: { active: true, subtype: subtype || null } }
        }))
    }

    const closeModal = (id) => {
        setVpState(prev => ({
            ...prev,
            modals: { ...prev.modals, [id]: { active: false } }
        }))
    }

    const saveLocal = () => {
        setVpState(prev => {
            try {
                localStorage.setItem('vp_projects', JSON.stringify(prev.projects))
            } catch (e) { }
            return prev
        })
    }

    useEffect(() => {
        const stored = localStorage.getItem('vp_projects')
        if (stored) return
        const initial = [getTutorialData()]
        setVpState(prev => ({ ...prev, projects: initial }))
        localStorage.setItem('vp_projects', JSON.stringify(initial))
    }, [])

    useEffect(() => {
        if (vpState.projects?.length > 0) {
            try {
                localStorage.setItem('vp_projects', JSON.stringify(vpState.projects))
            } catch (e) { }
        }
    }, [vpState.projects])

    // Auto-sync every 30 seconds when online
    useEffect(() => {
        if (!vpState.isOnline || !vpState.token) return
        const syncInterval = setInterval(() => sync(), 30000)
        // Also sync once on mount if online
        sync()
        return () => clearInterval(syncInterval)
    }, [vpState.isOnline, vpState.token])

    const updateCurrentProject = (project) => {
        setVpState(prev => {
            const idx = prev.projects.findIndex(p => p.id === project.id)
            const nextProjects = idx >= 0 ? prev.projects.map((p, i) => i === idx ? { ...project, _dirty: true } : p) : prev.projects
            return { ...prev, currentProject: project, projects: nextProjects }
        })
        pushHistory(project)
    }

    const api = async (endpoint, method = 'GET', body = null) => {
        if (!vpState.isOnline) throw new Error('Offline')
        const headers = { 'Content-Type': 'application/json' }
        if (vpState.token) headers['Authorization'] = `Bearer ${vpState.token}`
        const res = await fetch('/api' + endpoint, { method, headers, body: body ? JSON.stringify(body) : null })
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                setVpState(prev => ({ ...prev, user: null, token: null }))
                localStorage.removeItem('vp_token')
                localStorage.removeItem('vp_user')
            }
            throw new Error(await res.text())
        }
        return res.json()
    }

    const login = async (email, password) => {
        const res = await api('/auth/login', 'POST', { email, password })
        setVpState(prev => ({ ...prev, token: res.token, user: res.user }))
        localStorage.setItem('vp_token', res.token)
        localStorage.setItem('vp_user', JSON.stringify(res.user))
        closeModal('authModal')
        toast(`Welcome, ${res.user.username}!`, 'success')
    }

    const register = async (email, password, username) => {
        const res = await api('/auth/register', 'POST', { email, password, username })
        setVpState(prev => ({ ...prev, token: res.token, user: res.user }))
        localStorage.setItem('vp_token', res.token)
        localStorage.setItem('vp_user', JSON.stringify(res.user))
        closeModal('authModal')
        toast(`Welcome, ${res.user.username}!`, 'success')
    }

    const logout = () => {
        setVpState(prev => ({ ...prev, token: null, user: null }))
        localStorage.removeItem('vp_token')
        localStorage.removeItem('vp_user')
        toast('Logged out', 'info')
    }

    const createProject = (themeKey) => {
        const project = {
            id: Date.now(),
            title: 'Untitled Zine',
            theme: themeKey || vpState.selectedTheme,
            pages: [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }],
            created: new Date().toISOString(),
            _dirty: true
        }
        setVpState(prev => ({
            ...prev,
            projects: [project, ...prev.projects],
            currentProject: project,
            currentView: 'editor',
            selection: { type: 'page', id: project.pages[0].id, pageIdx: 0 },
            history: [JSON.parse(JSON.stringify(project))],
            historyIdx: 0
        }))
        saveLocal()
        closeModal('themePickerModal')
        closeModal('themePicker')
        toast('New zine created!', 'success')
    }

    const openProject = (idx) => {
        const projects = vpState.projects
        const p = projects[idx]
        if (p._remote) {
            toast('Downloading zine...', 'info')
            api(`/zines/${p.serverId}`).then(res => {
                // Backend returns { ...zine, data: parsedPages }
                // data is the array of pages
                const pages = Array.isArray(res.data) ? res.data : (res.pages || [])
                const project = { ...p, pages, _remote: false }
                const nextProjects = [...projects]
                nextProjects[idx] = project
                setVpState(prev => ({
                    ...prev,
                    projects: nextProjects,
                    currentProject: project,
                    currentView: 'editor',
                    selection: { type: 'page', id: project.pages[0]?.id, pageIdx: 0 },
                    history: [JSON.parse(JSON.stringify(project))],
                    historyIdx: 0
                }))
            }).catch(e => {
                toast('Failed to download zine: ' + e.message, 'error')
            })
            return
        }
        setVpState(prev => ({
            ...prev,
            currentProject: p,
            currentView: 'editor',
            selection: { type: 'page', id: p.pages[0]?.id, pageIdx: 0 },
            history: [JSON.parse(JSON.stringify(p))],
            historyIdx: 0
        }))
    }

    const saveProject = () => {
        if (!vpState.currentProject) {
            toast('No project open', 'error')
            return
        }
        const project = vpState.currentProject
        const idx = vpState.projects.findIndex(p => p.id === project.id)
        if (idx >= 0) {
            const next = [...vpState.projects]
            next[idx] = { ...project, _dirty: true, _lastSaved: new Date().toISOString() }
            setVpState(prev => ({ ...prev, projects: next }))
            // Trigger sync after saving
            setTimeout(() => sync(), 300)
        }
        toast('Project saved!', 'success')
    }

    const sync = async () => {
        if (!vpState.isOnline || !vpState.token) return
        setVpState(prev => ({ ...prev, isSyncing: true }))
        try {
            const projects = vpState.projects || []
            for (const p of projects) {
                if (p._dirty && p.pages) {
                    try {
                        const res = await api('/zines', 'POST', {
                            serverId: p.serverId,
                            title: p.title,
                            data: p.pages,
                            theme: p.theme
                        })
                        p.serverId = res.id
                        p._dirty = false
                        p._synced = new Date().toISOString()
                    } catch (e) {
                        console.warn(`Failed to sync project ${p.title}:`, e)
                    }
                }
            }
            setVpState(prev => ({ ...prev, projects: [...prev.projects] }))
        } catch (e) {
            console.error('Sync failed', e)
        }
        setVpState(prev => ({ ...prev, isSyncing: false }))
    }

    const genId = () => 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    const addElement = (pageIdx, element) => {
        if (!vpState.currentProject) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const page = project.pages[pageIdx]
        if (!page) return
        const el = { ...element, id: element.id || genId(), zIndex: page.elements.length }
        if (!page.elements) page.elements = []
        page.elements.push(el)
        setVpState(prev => ({
            ...prev,
            currentProject: project,
            selection: { type: 'element', id: el.id, pageIdx }
        }))
        pushHistory(project)
        const projIdx = vpState.projects.findIndex(p => p.id === project.id)
        if (projIdx >= 0) {
            const next = [...vpState.projects]
            next[projIdx] = { ...project, _dirty: true }
            setVpState(prev2 => ({ ...prev2, projects: next }))
        }
    }

    const updateElement = (pageIdx, elementId, updates) => {
        if (!vpState.currentProject) return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const page = project.pages[pageIdx]
        const el = page?.elements?.find(e => e.id === elementId)
        if (!el) return
        Object.assign(el, updates)
        setVpState(prev => ({ ...prev, currentProject: project }))
        pushHistory(project)
        const projIdx = vpState.projects.findIndex(p => p.id === project.id)
        if (projIdx >= 0) {
            const next = [...vpState.projects]
            next[projIdx] = { ...project, _dirty: true }
            setVpState(prev2 => ({ ...prev2, projects: next }))
        }
    }

    const deleteElement = () => {
        if (!vpState.currentProject || vpState.selection.type !== 'element') return
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const { pageIdx, id } = vpState.selection
        const elements = project.pages[pageIdx].elements
        const i = elements.findIndex(e => e.id === id)
        if (i === -1) return
        elements.splice(i, 1)
        setVpState(prev => ({
            ...prev,
            currentProject: project,
            selection: { type: 'page', id: project.pages[pageIdx].id, pageIdx }
        }))
        pushHistory(project)
    }

    const addPage = () => {
        if (!vpState.currentProject) return
        if (vpState.currentProject.pages.length >= 32) {
            toast('Max 32 pages', 'error')
            return
        }
        const project = JSON.parse(JSON.stringify(vpState.currentProject))
        const newPage = { id: Date.now(), elements: [], background: '#ffffff', texture: null }
        project.pages.push(newPage)
        const pageIdx = project.pages.length - 1
        setVpState(prev => ({
            ...prev,
            currentProject: project,
            selection: { type: 'page', id: newPage.id, pageIdx }
        }))
        pushHistory(project)
    }

    const playBGM = (url) => {
        if (bgmRef.current && bgmRef.current._src === url) return
        stopBGM()
        if (!url) return

        // Handle synthesized ambient moods (gen:drone, gen:horror, etc.)
        if (url.startsWith('gen:')) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)()
                const gainNode = ctx.createGain()
                gainNode.gain.value = 0.15
                gainNode.connect(ctx.destination)

                const mood = url.replace('gen:', '')
                const oscs = []

                if (mood === 'drone') {
                    const freqs = [55, 82.5, 110]
                    freqs.forEach(f => {
                        const osc = ctx.createOscillator()
                        osc.type = 'sine'
                        osc.frequency.value = f
                        osc.connect(gainNode)
                        osc.start()
                        oscs.push(osc)
                    })
                } else if (mood === 'horror') {
                    const freqs = [40, 43, 80]
                    freqs.forEach((f, i) => {
                        const osc = ctx.createOscillator()
                        osc.type = i === 2 ? 'sawtooth' : 'sine'
                        osc.frequency.value = f
                        osc.detune.value = Math.random() * 20 - 10
                        osc.connect(gainNode)
                        osc.start()
                        oscs.push(osc)
                    })
                } else if (mood === 'cyber') {
                    const freqs = [220, 330, 440]
                    freqs.forEach(f => {
                        const osc = ctx.createOscillator()
                        osc.type = 'square'
                        osc.frequency.value = f
                        const subGain = ctx.createGain()
                        subGain.gain.value = 0.05
                        osc.connect(subGain)
                        subGain.connect(ctx.destination)
                        osc.start()
                        oscs.push(osc)
                    })
                } else if (mood === 'nature') {
                    // White noise via buffer
                    const bufferSize = ctx.sampleRate * 2
                    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
                    const data = buffer.getChannelData(0)
                    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
                    const noise = ctx.createBufferSource()
                    noise.buffer = buffer
                    noise.loop = true
                    const filter = ctx.createBiquadFilter()
                    filter.type = 'lowpass'
                    filter.frequency.value = 800
                    noise.connect(filter)
                    filter.connect(gainNode)
                    noise.start()
                    oscs.push(noise)
                }

                bgmRef.current = {
                    _src: url,
                    _ctx: ctx,
                    _oscs: oscs,
                    pause() {
                        oscs.forEach(o => { try { o.stop() } catch (e) { } })
                        ctx.close().catch(() => { })
                    }
                }
            } catch (e) {
                console.warn('Gen BGM failed:', e)
            }
            return
        }

        // Normal audio URL
        const a = new Audio(url)
        a.loop = true
        a.volume = 0.5
        a._src = url
        a.play().catch(() => { })
        bgmRef.current = a
    }

    const stopBGM = () => {
        if (bgmRef.current) {
            bgmRef.current.pause()
            bgmRef.current = null
        }
    }

    const playSFX = (url) => {
        if (!url) return
        const a = new Audio(url)
        a.volume = 0.7
        a.play().catch(() => { })
    }

    const triggerVfx = (type) => {
        if (!type) return
        // Force a state change so the same effect can be retriggered quickly
        setActiveVfx(null)
        // schedule on next tick to guarantee a different state value
        setTimeout(() => {
            setActiveVfx(type)
            // automatically clear after the effect duration
            setTimeout(() => setActiveVfx(null), 600)
        }, 0)
    }

    const getAssets = (type) => {
        const panels = [
            { id: 'rect', preview: '<div style="width:80%;height:80%;border:3px solid #ccc"></div>', name: 'Rect' },
            { id: 'rect-rounded', preview: '<div style="width:80%;height:80%;border:3px solid #ccc;border-radius:10px"></div>', name: 'Rounded' },
            { id: 'torn', preview: '<div style="width:80%;height:80%;border:3px dashed #ccc"></div>', name: 'Torn' },
            { id: 'neon', preview: '<div style="width:80%;height:80%;border:2px solid #00f3ff;box-shadow:0 0 8px #bc00ff"></div>', name: 'Neon' }
        ]
        const shapes = [
            { id: 'circle', preview: '<div style="width:50px;height:50px;border-radius:50%;background:#888"></div>', name: 'Circle' },
            { id: 'square', preview: '<div style="width:50px;height:50px;background:#888"></div>', name: 'Square' },
            { id: 'triangle', preview: '<div style="width:0;height:0;border-left:25px solid transparent;border-right:25px solid transparent;border-bottom:50px solid #888"></div>', name: 'Triangle' },
            { id: 'diamond', preview: '<div style="width:40px;height:40px;background:#888;transform:rotate(45deg)"></div>', name: 'Diamond' },
            { id: 'line_h', preview: '<div style="width:60px;height:3px;background:#888"></div>', name: 'Line' },
            { id: 'arrow', preview: '<span style="font-size:24px">➤</span>', name: 'Arrow' }
        ]
        const balloons = [
            { id: 'dialog', preview: '<div style="background:#fff;border:2px solid #333;border-radius:16px;padding:6px;font-size:9px">Hello!</div>', name: 'Dialog' },
            { id: 'thought', preview: '<div style="background:#fff;border:2px solid #333;border-radius:50%;padding:8px;font-size:9px">💭</div>', name: 'Thought' },
            { id: 'shout', preview: '<div style="background:#fff;border:3px solid #333;padding:6px;font-size:9px;font-weight:bold">BANG!</div>', name: 'Shout' },
            { id: 'caption', preview: '<div style="background:#000;color:#fff;padding:6px;font-size:9px">CAPTION</div>', name: 'Caption' },
            { id: 'whisper', preview: '<div style="background:#f8f8f8;border:1px dashed #999;border-radius:16px;padding:6px;font-size:8px;color:#666">psst...</div>', name: 'Whisper' },
            { id: 'narration', preview: '<div style="background:#ffe;border:1px solid #cc9;padding:6px;font-size:8px">Meanwhile...</div>', name: 'Narration' }
        ]
        const sfx = [
            { id: 'crash', preview: '<span style="font-family:Bangers;font-size:20px;color:#e44">CRASH!</span>', name: 'Crash' },
            { id: 'boom', preview: '<span style="font-family:Bangers;font-size:20px;color:#f80">BOOM!</span>', name: 'Boom' },
            { id: 'zap', preview: '<span style="font-family:Bangers;font-size:20px;color:#ff0">ZAP!</span>', name: 'Zap' },
            { id: 'pow', preview: '<span style="font-family:Bangers;font-size:20px;color:#f44">POW!</span>', name: 'POW' },
            { id: 'whoosh', preview: '<span style="font-family:Bangers;font-size:20px;color:#4af">WHOOSH</span>', name: 'Whoosh' },
            { id: 'splash', preview: '<span style="font-family:Bangers;font-size:20px;color:#4a4">SPLASH!</span>', name: 'Splat' },
            { id: 'splat', preview: '<span style="font-family:Bangers;font-size:20px;color:#4a4">SPLAT!</span>', name: 'Splat' }
        ]
        const symbols = [
            { id: 'pentagram', preview: '<span style="font-size:32px">⛤</span>', name: 'Pentagram' },
            { id: 'skull', preview: '<span style="font-size:32px">☠</span>', name: 'Skull' },
            { id: 'star_symbol', preview: '<span style="font-size:32px">✦</span>', name: 'Star' },
            { id: 'eye', preview: '<span style="font-size:32px">👁</span>', name: 'Eye' },
            { id: 'biohazard', preview: '<span style="font-size:32px">☣</span>', name: 'Biohazard' },
            { id: 'radiation', preview: '<span style="font-size:32px">☢</span>', name: 'Radiation' },
            { id: 'compass', preview: '<span style="font-size:32px">🧭</span>', name: 'Compass' },
            { id: 'rune', preview: '<span style="font-size:32px">ᚱ</span>', name: 'Rune' },
            { id: 'ankh', preview: '<span style="font-size:32px">☥</span>', name: 'Ankh' },
            { id: 'omega', preview: '<span style="font-size:32px">Ω</span>', name: 'Omega' },
            { id: 'infinity', preview: '<span style="font-size:32px">∞</span>', name: 'Infinity' },
            { id: 'trident', preview: '<span style="font-size:32px">🔱</span>', name: 'Trident' }
        ]
        const shaderList = typeof window !== 'undefined' && window.VPShader?.getPresetList
            ? window.VPShader.getPresetList()
            : [
                { key: 'plasma', name: 'Plasma' },
                { key: 'fire', name: 'Fire' },
                { key: 'water', name: 'Water' },
                { key: 'lightning', name: 'Lightning' },
                { key: 'voidNoise', name: 'Void' },
                { key: 'galaxy', name: 'Galaxy' }
            ]
        const shaders = shaderList.map(p => ({
            id: p.key,
            name: p.name,
            preview: `<div style="width:50px;height:50px;background:linear-gradient(135deg,#222,#444);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#8a889a;font-size:10px;text-align:center;padding:4px;border:1px solid #444">${p.name}</div>`
        }))
        const map = { panels, shapes, balloons, sfx, symbols, shaders }
        return map[type] || []
    }

    const publishZine = async (formData) => {
        if (!vpState.currentProject) {
            toast('No project open', 'error')
            return
        }
        const project = vpState.currentProject
        if (!formData.title?.trim()) {
            toast('Title required', 'error')
            return
        }
        try {
            if (!project.serverId) {
                const res = await api('/zines', 'POST', { title: formData.title || project.title, data: project.pages, theme: project.theme })
                project.serverId = res.id
                setVpState(prev => ({
                    ...prev,
                    currentProject: project,
                    projects: prev.projects.map(p => p.id === project.id ? { ...project, serverId: res.id } : p)
                }))
            }
            await api(`/publish/${project.serverId}`, 'POST', {
                author_name: formData.author || vpState.user?.username || 'Anonymous',
                genre: formData.genre || 'classic',
                tags: (formData.tags || '').split(',').map(t => t.trim()).filter(Boolean).join(',')
            })
            // Mark project as published
            project._published = true
            const idx = vpState.projects.findIndex(p => p.id === project.id)
            if (idx >= 0) {
                const next = [...vpState.projects]
                next[idx] = { ...project, _published: true, _dirty: false }
                setVpState(prev => ({ ...prev, projects: next, currentProject: project }))
            }
            closeModal('publishModal')
            toast('🚀 Zine published! Go to Discover to see it live.', 'success')
        } catch (e) {
            toast('Publish failed: ' + (e.message || 'Error'), 'error')
        }
    }

    const addAsset = (type, assetId) => {
        const pageIdx = vpState.selection?.pageIdx ?? 0
        const base = { id: genId(), x: 120, y: 120, rotation: 0, opacity: 1, zIndex: 0, borderWidth: 0, borderColor: '#000', borderRadius: 0 }
        let el = { ...base }
        if (type === 'panels') {
            el = { ...base, type: 'panel', width: 220, height: 160, panelBorderWidth: 4, panelBorderColor: assetId === 'neon' ? '#00f3ff' : '#0a0a0a', panelBorderStyle: assetId === 'torn' ? 'dashed' : 'solid', panelRadius: assetId === 'rect-rounded' ? 12 : 0, fill: 'transparent', panelShadow: assetId === 'neon' ? '0 0 15px #bc00ff' : 'none' }
        } else if (type === 'shapes') {
            const shapes = { circle: { type: 'shape', shape: 'circle', width: 100, height: 100, fill: '#0a0a0a' }, square: { type: 'shape', shape: 'rect', width: 100, height: 100, fill: '#0a0a0a' }, triangle: { type: 'shape', shape: 'triangle', width: 100, height: 100, fill: '#0a0a0a' }, diamond: { type: 'shape', shape: 'diamond', width: 80, height: 100, fill: '#0a0a0a' }, line_h: { type: 'shape', shape: 'line_h', width: 200, height: 4, fill: '#0a0a0a' }, arrow: { type: 'text', content: '➤', fontSize: 48, color: '#0a0a0a', width: 60, height: 60, fontFamily: 'sans-serif' } }
            el = { ...base, ...(shapes[assetId] || shapes.circle) }
        } else if (type === 'balloons') {
            const b = { dialog: { balloonType: 'dialog', width: 200, height: 80, content: 'Dialog text...', fontSize: 14 }, thought: { balloonType: 'thought', width: 160, height: 120, content: 'Thinking...', fontSize: 13 }, shout: { balloonType: 'shout', width: 170, height: 80, content: 'SHOUT!', fontSize: 18 }, caption: { balloonType: 'caption', width: 220, height: 50, content: 'Caption text', fontSize: 13 }, whisper: { balloonType: 'whisper', width: 180, height: 70, content: 'whisper...', fontSize: 12 }, narration: { balloonType: 'narration', width: 240, height: 60, content: 'Meanwhile...', fontSize: 14 } }
            el = { ...base, type: 'balloon', ...(b[assetId] || b.dialog) }
        } else if (type === 'sfx') {
            const t = { crash: 'CRASH!', boom: 'BOOM!', zap: 'ZAP!', whoosh: 'WHOOSH!', pow: 'POW!', splat: 'SPLAT!' }
            el = { ...base, type: 'text', content: t[assetId] || 'BAM!', fontSize: 52, fontFamily: 'Bangers', color: '#0a0a0a', width: 180, height: 70, strokeWidth: 2, strokeColor: '#ffffff' }
        } else if (type === 'symbols') {
            const s = { pentagram: '⛤', skull: '☠', star_symbol: '✦', eye: '👁', omega: 'Ω', trident: '🔱' }
            el = { ...base, type: 'text', content: s[assetId] || '✦', fontSize: 56, color: '#d4af37', width: 80, height: 80, fontFamily: 'sans-serif' }
        } else if (type === 'shaders') {
            el = { ...base, type: 'shader', shaderPreset: assetId || 'plasma', width: 220, height: 220, opacity: 1 }
        }
        addElement(pageIdx, el)
    }

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
        if (newPage.elements) newPage.elements.forEach(e => { e.id = genId() })
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
        previewProject,
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
        publishZine,
        themes
    }

    return (
        <VPContext.Provider value={value}>
            {children}
        </VPContext.Provider>
    )
}

export { VPContext, VPProvider }
