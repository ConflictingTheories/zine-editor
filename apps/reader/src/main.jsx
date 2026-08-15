import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { unpackSvrn } from '../../../packages/svrn-format/src/index.js'
import { SvrnNodeClient } from '../../../packages/svrn-node-client/src/index.js'
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

function App() {
  const [issues, setIssues] = useState([]), [project, setProject] = useState(null), [page, setPage] = useState(0), [nodeUrl, setNodeUrl] = useState(''), [nodeToken, setNodeToken] = useState(''), [message, setMessage] = useState('')
  const refresh = async () => setIssues(await all('issues'))
  useEffect(() => { refresh(); navigator.serviceWorker?.register('/sw.js') }, [])
  const openArchive = async (blob, source = 'local') => {
    const unpacked = await unpackSvrn(blob); const record = { id: unpacked.manifest.issue.id, manifest: unpacked.manifest, archive: blob, source, cachedAt: new Date().toISOString(), progress: 0 }
    await put('issues', record); await refresh(); setProject(unpacked.project); setPage(record.progress || 0); setMessage('Issue verified and cached for offline reading.')
  }
  const importFile = async event => { const file = event.target.files?.[0]; if (file) try { await openArchive(file) } catch (error) { setMessage(error.message) } }
  const subscribe = async () => { try { const client = new SvrnNodeClient(nodeUrl, nodeToken || null); const discovery = await client.discover(); await put('profiles', { url: nodeUrl.replace(/\/$/, ''), token: nodeToken || null, cursor: '', discovery, cachePolicy: 'offline' }); setNodeUrl(''); setNodeToken(''); setMessage(`Subscribed to ${discovery.name}`) } catch (error) { setMessage(error.message) } }
  const sync = async () => { try { const profiles = await all('profiles'); for (const profile of profiles) { const client = new SvrnNodeClient(profile.url, profile.token); const feed = await client.feed(profile.cursor); for (const item of feed.items) await openArchive(await client.package(item.id), profile.url); await put('profiles', { ...profile, cursor: feed.nextCursor || '' }) } setMessage('Subscriptions synchronized.') } catch (error) { setMessage(error.message) } }
  const select = async issue => { try { const unpacked = await unpackSvrn(issue.archive); setProject(unpacked.project); setPage(issue.progress || 0) } catch (error) { setMessage(error.message) } }
  const current = project?.pages?.[page]
  const advance = delta => { const next = Math.min(Math.max(0, page + delta), (project?.pages.length || 1) - 1); setPage(next); if (project) put('issues', { ...(issues.find(issue => issue.id === project.id) || {}), id: project.id, progress: next, archive: issues.find(issue => issue.id === project.id)?.archive, manifest: issues.find(issue => issue.id === project.id)?.manifest }) }
  return <main><header><h1>SVRN Reader</h1><label className="button">Import .svrn<input type="file" accept=".svrn" onChange={importFile} hidden /></label><input value={nodeUrl} onChange={e => setNodeUrl(e.target.value)} placeholder="https://publisher.example"/><input value={nodeToken} onChange={e => setNodeToken(e.target.value)} placeholder="Node bearer token (optional)"/><button onClick={subscribe}>Subscribe</button><button onClick={sync}>Sync</button></header>{message && <p className="notice">{message}</p>}<section className="layout"><aside><h2>Library</h2>{issues.map(issue => <button className="issue" key={issue.id} onClick={() => select(issue)}>{issue.manifest?.issue?.title || issue.id}<small>{issue.source}</small></button>)}</aside><article>{!current ? <p>Import a zine or subscribe to a publishing node.</p> : <><h2>{project.title}</h2><div className="page" style={{ background: current.background }}>{current.elements.filter(element => !element.hidden).sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0)).map(element => <div key={element.id} style={{ position: 'absolute', left: element.x, top: element.y, width: element.width, height: element.height, color: element.color, fontSize: element.fontSize, textAlign: element.align }}>{element.type === 'text' ? element.content : element.type === 'image' ? <span>[image]</span> : element.content || `[${element.type}]`}</div>)}</div><footer><button onClick={() => advance(-1)}>Previous</button><span>{page + 1} / {project.pages.length}</span><button onClick={() => advance(1)}>Next</button></footer></>}</article></section></main>
}
createRoot(document.getElementById('root')).render(<App />)
