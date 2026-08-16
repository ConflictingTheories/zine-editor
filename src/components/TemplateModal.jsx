import React, { useMemo, useState } from 'react'
import { BUILT_IN_TEMPLATES, createTemplatePage } from '../data/pageTemplates.js'
import { useVP } from '../context/VPContext.jsx'

const titleCase = value => value.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function TemplateModal() {
    const { vpState, closeModal, addPageFromTemplate, savePageAsTemplate, deleteTemplate, toast } = useVP()
    const [category, setCategory] = useState('All')
    const [query, setQuery] = useState('')
    const [tab, setTab] = useState('browse')
    const [name, setName] = useState('')
    const custom = vpState.templates || []
    const all = [...BUILT_IN_TEMPLATES, ...custom]
    const theme = vpState.currentProject?.theme || 'classic'
    const categories = ['All', ...new Set(all.map(t => t.category))]
    const visible = useMemo(() => all.filter(t => (category === 'All' || t.category === category) && `${t.name} ${t.description} ${t.themes?.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [all, category, query])
    const active = vpState.modals?.templateModal?.active
    if (!active) return null
    const add = template => { if (addPageFromTemplate(template)) closeModal('templateModal') }
    const save = () => { if (!name.trim()) return toast('Give the template a name', 'error'); if (savePageAsTemplate(name.trim())) { setName(''); toast('Template saved', 'success') } }
    const previewPage = template => { const page = createTemplatePage(template, theme); return { background: page.background, count: page.elements?.length || 0 } }
    return <div className="modal-overlay active" onMouseDown={e => e.target === e.currentTarget && closeModal('templateModal')}>
        <div className="modal-box template-modal">
            <div className="modal-header"><h2>Page Templates</h2><button onClick={() => closeModal('templateModal')}>×</button></div>
            <div className="template-tabs"><button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Browse templates</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>Manage templates</button></div>
            {tab === 'browse' ? <>
                <div className="template-toolbar"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates..." /> <select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
                <div className="template-grid">{visible.map(t => <article className="template-card" key={t.id}><div className="template-preview" style={{ background: previewPage(t).background }}><strong>{t.name || titleCase(t.id)}</strong><small>{t.category} · {previewPage(t).count} elements</small></div><h3>{t.name}</h3><p>{t.description}</p><button onClick={() => add(t)}>＋ Add page</button></article>)}</div>
            </> : <div className="template-manager"><div className="template-save"><h3>Save the current page</h3><input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" /><button onClick={save}>Save as template</button></div>{custom.length ? custom.map(t => <div className="template-managed" key={t.id}><span>{t.name}</span><button onClick={() => deleteTemplate(t.id)}>Delete</button></div>) : <p>No custom templates yet. Save a page to build your personal library.</p>}</div>}
        </div>
    </div>
}