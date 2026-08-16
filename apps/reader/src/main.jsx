import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { unpackSvrn } from '../../../packages/svrn-format/src/index.js'
import { SvrnNodeClient } from '../../../packages/svrn-node-client/src/index.js'
import ShaderElement from '../../../src/components/ShaderElement.jsx'
import Object3D from '../../../src/components/Object3D.jsx'
import '../../../src/lib/shaderBridge.js'
import AudioViz from '../../../src/components/AudioViz.jsx'
import { resolvePublicationAsset } from '../../../src/utils/assets.js'
import './styles.css'

const DB = 'svrn-reader-v1'
const store = (mode, value) => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 1)
  request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('issues', { keyPath: 'id' }); db.createObjectStore('profiles', { keyPath: 'url' }) }
  request.onerror = () => reject(request.error)
  request.onsuccess = () => { const tx = request.result.transaction(mode, value === undefined ? 'readonly' : 'readwrite'); const target = tx.objectStore(mode); const operation = value === undefined ? target.getAll() : target.put(value); operation.onsuccess = () => resolve(operation.result); operation.onerror = () => reject(operation.error) }
})
const all = mode => store(mode)
const put = (mode, value) => store(mode, value)

const isFetchableUrl = value => typeof value === 'string' && (/^https?:\/\//.test(value) || value.startsWith('/'))
const isDataUrl = value => typeof value === 'string' && value.startsWith('data:')

const ANIMATION_MAP = {
  'flash-in': 'reader-flash-in',
  'lightning': 'reader-el-lightning',
  'shake': 'reader-el-shake',
  'pulse': 'reader-el-pulse',
  'spin': 'reader-el-spin',
  'glitch': 'reader-el-glitch',
  'flicker': 'reader-el-flicker',
  'breathe': 'reader-el-breathe',
  'bounce': 'reader-el-bounce',
  'wobble': 'reader-el-wobble',
  'blink': 'reader-el-blink',
  'drift': 'reader-el-drift',
  'fly-in': 'reader-el-fly-in'
}

const BALLOON_PROPS = {
  dialog: { background: '#fff', border: '2px solid #000', borderRadius: '20px' },
  thought: { background: '#fff', border: '2px solid #000', borderRadius: '50%' },
  shout: { background: '#fff', border: '4px solid #000', fontWeight: 'bold' },
  caption: { background: '#000', color: '#fff' },
  whisper: { background: '#f8f8f8', border: '1px dashed #999', borderRadius: '16px', fontStyle: 'italic' },
  narration: { background: '#ffe', border: '1px solid #cc9', fontStyle: 'italic' }
}

const getPanelBackground = (el) => {
  if (el.panelFillType === 'transparent') return 'transparent'
  if (el.panelFillType === 'gradient') {
    const angle = Number.isFinite(Number(el.panelGradientAngle)) ? el.panelGradientAngle : 135
    return `linear-gradient(${angle}deg, ${el.panelFillColor || el.fill || '#ffffff'}, ${el.panelFillColorEnd || '#000000'})`
  }
  if (el.panelFillType === 'solid') return el.panelFillColor || el.fill || '#ffffff'
  return el.fill || 'transparent'
}

const styles = {
  element: (el, hidden) => {
    const animName = ANIMATION_MAP[el.animation] || null
    const animDuration = el.animDuration ?? 1
    const animIter = el.animLoop ? 'infinite' : '1'
    return {
      position: 'absolute',
      left: el.x, top: el.y, width: el.width, height: el.height,
      transform: `rotate(${el.rotation || 0}deg)`,
      zIndex: el.zIndex,
      opacity: el.opacity ?? 1,
      mixBlendMode: el.blendMode || 'normal',
      cursor: el.action ? 'pointer' : 'default',
      display: hidden ? 'none' : undefined,
      boxShadow: el.shadow || 'none',
      filter: el.blur ? `blur(${el.blur}px)` : el.filter || 'none',
      border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none',
      borderRadius: el.borderRadius ? `${el.borderRadius}px` : '0',
      animation: animName ? `${animName} ${animDuration}s ease ${animIter}` : 'none'
    }
  },
  text: (el) => ({
    fontSize: el.fontSize, color: el.color, fontFamily: el.fontFamily || 'var(--font-body, serif)',
    textAlign: el.align, fontWeight: el.bold ? 'bold' : 'normal',
    fontStyle: el.italic ? 'italic' : 'normal',
    lineHeight: el.lineHeight || 'normal',
    letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : 'normal',
    textShadow: el.textShadow || 'none',
    WebkitTextStroke: el.strokeWidth ? `${el.strokeWidth}px ${el.strokeColor || '#fff'}` : 'none'
  }),
  image: (el) => ({
    width: '100%', height: '100%',
    objectFit: el.objectFit || 'contain',
    borderRadius: el.imgRadius ? `${el.imgRadius}px` : '0',
    pointerEvents: 'none',
    display: 'block'
  }),
  panel: (el) => ({
    width: '100%', height: '100%',
    border: el.panelBorderWidth !== undefined ? `${el.panelBorderWidth}px ${el.panelBorderStyle || 'solid'} ${el.panelBorderColor || '#000'}` : 'var(--panel-border)',
    borderRadius: el.panelRadius !== undefined ? `${el.panelRadius}px` : 'var(--radius)',
    background: getPanelBackground(el),
    boxShadow: el.panelShadow || 'none',
    boxSizing: 'border-box'
  }),
  shape: (el) => {
    const base = {
      width: '100%', height: '100%',
      background: el.shape === 'triangle' ? 'transparent' : (el.fill || '#000'),
      borderRadius: el.shape === 'circle' ? '50%' : 0
    }
    if (el.shape === 'diamond') base.transform = 'rotate(45deg)'
    if (el.shape === 'triangle') {
      base.width = '0'
      base.height = '0'
      base.borderLeft = `${el.width / 2}px solid transparent`
      base.borderRight = `${el.width / 2}px solid transparent`
      base.borderBottom = `${el.height}px solid ${el.fill || '#000'}`
    }
    return base
  },
  balloon: (el) => {
    const bStyle = BALLOON_PROPS[el.balloonType || 'dialog'] || BALLOON_PROPS.dialog
    return {
      fontSize: el.fontSize || 14,
      fontFamily: el.fontFamily || 'var(--font-body, serif)',
      fontWeight: el.bold ? 'bold' : bStyle.fontWeight || 'normal',
      fontStyle: el.italic ? 'italic' : bStyle.fontStyle || 'normal',
      lineHeight: el.lineHeight || 'normal',
      letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : 'normal',
      padding: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', width: '100%', height: '100%',
      ...bStyle
    }
  },
  video: { width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }
}

function App() {
  const [issues, setIssues] = useState([])
  const [project, setProject] = useState(null)
  const [page, setPage] = useState(0)
  const [blobUrls, setBlobUrls] = useState({})
  const [nodeUrl, setNodeUrl] = useState('')
  const [nodeToken, setNodeToken] = useState('')
  const [message, setMessage] = useState('')
  const [toggledLabels, setToggledLabels] = useState(new Set())
  const [activeVfx, setActiveVfx] = useState(null)
  const [unlockedPages, setUnlockedPages] = useState(new Set())
  const [passwordModal, setPasswordModal] = useState({ active: false, targetIdx: -1, value: '' })
  const [scale, setScale] = useState(1)
  const audioRef = useRef(null)
  const audioSourceRef = useRef(null)

  const refresh = async () => setIssues(await all('issues'))

  useEffect(() => {
    const onResize = () => {
      const isLandscape = project?.pages[page]?.orientation === 'landscape'
      const w = isLandscape ? 816 : 528
      const h = isLandscape ? 528 : 816
      const wrap = document.getElementById('canvasWrap')
      if (wrap) setScale(Math.min((wrap.clientWidth - 40) / w, (wrap.clientHeight - 80) / h, 1))
    }
    window.addEventListener('resize', onResize)
    // Run once on next tick after render
    setTimeout(onResize, 50)
    return () => window.removeEventListener('resize', onResize)
  }, [project, page])

  useEffect(() => {
    refresh()
    navigator.serviceWorker?.register('/sw.js')
  }, [])

  // Create Object URLs for any enclosed assets when opening
  const resolveAsset = (path) => {
    if (!path) return path
    if (blobUrls[path]) return blobUrls[path]
    if (isFetchableUrl(path) || isDataUrl(path)) return resolvePublicationAsset(path) || path
    return path
  }

  const openArchive = async (blob, source = 'local') => {
    const unpacked = await unpackSvrn(blob)
    const record = { id: unpacked.manifest.issue.id, manifest: unpacked.manifest, archive: blob, source, cachedAt: new Date().toISOString(), progress: 0 }
    await put('issues', record)
    await refresh()
    select(record)
    setMessage('Issue verified and cached for offline reading.')
  }

  const importFile = async event => {
    const file = event.target.files?.[0]
    if (file) try { await openArchive(file) } catch (error) { setMessage(error.message) }
  }

  const subscribe = async () => {
    try {
      const client = new SvrnNodeClient(nodeUrl, nodeToken || null)
      const discovery = await client.discover()
      await put('profiles', { url: nodeUrl.replace(/\/$/, ''), token: nodeToken || null, cursor: '', discovery, cachePolicy: 'offline' })
      setNodeUrl('')
      setNodeToken('')
      setMessage(`Subscribed to ${discovery.name}`)
    } catch (error) { setMessage(error.message) }
  }

  const sync = async () => {
    try {
      const profiles = await all('profiles')
      for (const profile of profiles) {
        const client = new SvrnNodeClient(profile.url, profile.token)
        const feed = await client.feed(profile.cursor)
        for (const item of feed.items) await openArchive(await client.package(item.id), profile.url)
        await put('profiles', { ...profile, cursor: feed.nextCursor || '' })
      }
      setMessage('Subscriptions synchronized.')
    } catch (error) { setMessage(error.message) }
  }

  const select = async issue => {
    try {
      // Re-unpack to get the entries, creating ObjectURLs for embedded assets
      const unpacked = await unpackSvrn(issue.archive)
      const urlCache = {}
      for (const [path, bytes] of Object.entries(unpacked.entries)) {
        if (path !== 'content/zine.json' && path !== 'manifest.json') {
          // Identify mime implicitly by extension? Blob lets browser guess usually
          urlCache[path] = URL.createObjectURL(new Blob([bytes]))
        }
      }
      setBlobUrls(urlCache)
      setProject(unpacked.project)
      setPage(issue.progress || 0)
    } catch (error) { setMessage(error.message) }
  }

  const handleInteraction = (el) => {
    const { action, actionVal } = el
    if (!action) return
    switch (action) {
      case 'goto': {
        const target = parseInt(actionVal, 10) - 1
        if (!isNaN(target)) advance(target - page)
        break
      }
      case 'link':
        window.open(actionVal, '_blank')
        break
      case 'toggle':
        if (actionVal) setToggledLabels(prev => {
          const next = new Set(prev)
          if (next.has(actionVal)) next.delete(actionVal)
          else next.add(actionVal)
          return next
        })
        break
    }
  }

  const current = project?.pages?.[page]
  const currentAudio = current?.backgroundAudio?.src || project?.backgroundAudio?.src
  const resolvedAudio = currentAudio ? resolveAsset(currentAudio) : ''
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !resolvedAudio) return
    if (audioSourceRef.current !== resolvedAudio) {
      audio.src = resolvedAudio
      audioSourceRef.current = resolvedAudio
      audio.load()
    }
    audio.play().catch(() => {})
    const resume = () => { audio.muted = false; audio.play().catch(() => {}) }
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [resolvedAudio])
  const advance = (delta, absolute = false) => {
    let next = absolute ? delta : page + Math.sign(delta)
    const length = project?.pages.length || 1
    const dir = Math.sign(delta)

    if (!absolute) {
      // Skip over locked pages unless unlocked
      while (next >= 0 && next < length) {
        const p = project.pages[next]
        if (!p.isLocked || unlockedPages.has(next)) break
        next += dir
      }
    }

    if (next >= 0 && next < length) {
      setPage(next)
      if (project) {
        put('issues', {
          ...(issues.find(issue => issue.id === project.id) || {}),
          id: project.id, progress: next,
          archive: issues.find(issue => issue.id === project.id)?.archive,
          manifest: issues.find(issue => issue.id === project.id)?.manifest
        })
      }
    }
  }

  const handlePasswordSubmit = () => {
    const targetPage = project.pages[passwordModal.targetIdx]
    if (targetPage && targetPage.password === passwordModal.value) {
      setUnlockedPages(prev => new Set(prev).add(passwordModal.targetIdx))
      advance(passwordModal.targetIdx, true)
      setPasswordModal({ active: false, targetIdx: -1, value: '' })
    } else {
      alert('Incorrect Password')
    }
  }

  return (
    <div className={`app-container ${activeVfx === 'shake' ? 'shake-anim' : ''} ${activeVfx === 'pulse' ? 'pulse-anim' : ''} ${activeVfx === 'glitch' ? 'glitch-anim' : ''}`}>
      {activeVfx && (
        <div className={`vfx-overlay ${activeVfx === 'flash' || activeVfx === 'lightning' ? 'active' : ''}`} style={{
          background: activeVfx === 'flash' ? '#fff' : (activeVfx === 'blood' ? 'radial-gradient(circle at 50% 50%, rgba(139,0,0,0.5), rgba(60,0,0,0.8) 60%, rgba(20,0,0,0.9))' : 'transparent'),
          opacity: activeVfx === 'flash' ? 0.8 : 1,
          pointerEvents: 'none',
          position: 'fixed', inset: 0, zIndex: 9999,
          mixBlendMode: 'screen',
          animation: activeVfx === 'lightning' ? 'vfx-lightning 0.4s' : (activeVfx === 'glitch' ? 'vfx-glitch 0.5s steps(2, end)' : 'none')
        }} />
      )}

      {passwordModal.active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222', padding: '30px', borderRadius: '12px', border: '1px solid #444', textAlign: 'center', color: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>Password Required</h3>
            <input type="password" value={passwordModal.value}
              autoFocus
              onChange={(e) => setPasswordModal(p => ({ ...p, value: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Enter password..."
              style={{ padding: '8px', width: '200px', marginBottom: '20px', background: '#111', color: '#fff', border: '1px solid #555' }} />
            <div>
              <button onClick={handlePasswordSubmit}>Unlock</button>
              <button onClick={() => setPasswordModal({ active: false, targetIdx: -1, value: '' })} style={{ background: 'transparent', marginLeft: '10px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <main>
        <header>
          <h1>SVRN Reader</h1>
          <label className="button">Import .svrn<input type="file" accept=".svrn" onChange={importFile} hidden /></label>
          <input value={nodeUrl} onChange={e => setNodeUrl(e.target.value)} placeholder="https://publisher.example" />
          <input value={nodeToken} onChange={e => setNodeToken(e.target.value)} placeholder="Node bearer token (optional)" />
          <button onClick={subscribe}>Subscribe</button>
          <button onClick={sync}>Sync</button>
        </header>
        {message && <p className="notice">{message}</p>}
        <section className="layout">
          <aside>
            <h2>Library</h2>
            {[...issues].sort((a, b) => `${a.manifest?.issue?.series || ''}${a.manifest?.issue?.volume || ''}${a.manifest?.issue?.issue || ''}`.localeCompare(`${b.manifest?.issue?.series || ''}${b.manifest?.issue?.volume || ''}${b.manifest?.issue?.issue || ''}`)).map(issue => <button className="issue" key={issue.id} onClick={() => select(issue)}>{issue.manifest?.issue?.title || issue.id}<small>{[issue.manifest?.issue?.series, issue.manifest?.issue?.volume && `Vol. ${issue.manifest.issue.volume}`, issue.manifest?.issue?.issue && `Issue ${issue.manifest.issue}`, issue.source].filter(Boolean).join(' · ')}</small></button>)}
          </aside>
          <article>
            {!current ? <p>Import a zine or subscribe to a publishing node.</p> : <>
              <h2>{project.title}</h2>
              {(project.series || project.volume || project.issue) && <p className="issue-meta">{[project.series, project.volume && `Volume ${project.volume}`, project.issue && `Issue ${project.issue}`].filter(Boolean).join(' · ')}</p>}
              {resolvedAudio && <audio ref={audioRef} autoPlay loop playsInline muted aria-hidden="true" style={{ display: 'none' }} />}
              <div id="canvasWrap" className="reader-canvas-wrap">
                <div className="page" style={{ position: 'relative', background: current.background, width: current.orientation === 'landscape' ? 816 : 528, height: current.orientation === 'landscape' ? 528 : 816, overflow: 'hidden', transform: `scale(${scale})` }}>
                  {current.texture && (
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${resolveAsset(current.texture)})`, backgroundSize: 'cover', opacity: 0.2, pointerEvents: 'none' }} />
                  )}
                  {current.elements.filter(element => !element.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(el => {
                    const hiddenByToggle = el.isHidden && !toggledLabels.has(el.label)
                    return (
                      <div
                        key={el.id}
                        className="reader-el reader-el-item"
                        data-label={el.label || ''}
                        style={styles.element(el, hiddenByToggle)}
                        onClick={() => handleInteraction(el)}
                      >
                        {el.type === 'text' && (
                          <div style={{ ...styles.text(el), padding: 4 }}>{contentRender(el)}</div>
                        )}
                        {el.type === 'image' && (
                          <img src={resolveAsset(el.src)} style={styles.image(el)} alt="" />
                        )}
                        {el.type === 'panel' && (
                          <div style={styles.panel(el)} />
                        )}
                        {el.type === 'shape' && (
                          <div style={styles.shape(el)} />
                        )}
                        {el.type === 'balloon' && (
                          <div style={styles.balloon(el)}>{contentRender(el)}</div>
                        )}
                        {el.type === 'shader' && (
                          <ShaderElement preset={el.shaderPreset} customCode={el.customCode} width={el.width} height={el.height} />
                        )}
                        {el.type === 'object' && (
                          <Object3D
                            model={el.objModel || 'crystal'}
                            color={el.objColor || '#4488ff'}
                            autoRotate={el.objSpin !== false}
                            width={el.width}
                            height={el.height}
                          />
                        )}
                        {el.type === 'video' && (
                          el.src
                            ? <video src={resolveAsset(el.src)} style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain' }} controls autoPlay muted />
                            : <div style={styles.video}>VIDEO: No Source</div>
                        )}
                        {(el.type === 'audio-log' || el.type === 'audio-viz') && (
                          <AudioViz
                            src={resolveAsset(el.src)}
                            color={el.color || 'var(--vp-accent)'}
                            width={el.width}
                            height={el.height}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <footer>
                <button onClick={() => advance(-1)}>Previous</button>
                <span>{page + 1} / {project.pages.length}</span>
                <button onClick={() => advance(1)}>Next</button>
              </footer>
            </>}
          </article>
        </section>
      </main>
    </div>
  )
}
function contentRender(el) {
  if (el.sfx || el.symbol) return <div className="el-symbol">{el.content}</div>
  return el.content
}

createRoot(document.getElementById('root')).render(<App />)
