/*
 * Component: Dashboard
 * Publisher Hub — entry point for all creative projects. Shows zines, portfolio
 * books, and direct shortcuts into each platform mode.
 */

import React, { useMemo } from 'react'
import { useVP } from '../context/VPContext.jsx'

/* ── Inline SVG icons ──────────────────────────────────────────────────────── */
const IconZine = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="10" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="15.5" y="3" width="12.5" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="6.5" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6.5" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6.5" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="17.5" y="6" width="8.5" height="7" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
)

const IconPortfolio = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="17.5" y="3" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="17.5" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="17.5" y="17.5" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
)

const IconLightTable = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="16" y1="2" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="26.5" x2="16" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="16" x2="5.5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="26.5" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
)

const IconPlus = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <line x1="10" y1="3" x2="10" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
)

const IconBook = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="5" y="4" width="13" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="19.5" y="4" width="15.5" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <line x1="7.5" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7.5" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7.5" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="21.5" y="7" width="11.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
)

const IconPhoto = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 27 L13 19 L19 25 L27 16 L36 27" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
)

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function CreateCard({ icon, title, sub, onClick, accent }) {
    return (
        <button
            type="button"
            className={`dash-create-card${accent ? ' accent' : ''}`}
            onClick={onClick}
        >
            <span className="dash-create-icon">{icon}</span>
            <span className="dash-create-body">
                <span className="dash-create-title">{title}</span>
                <span className="dash-create-sub">{sub}</span>
            </span>
            <span className="dash-create-plus"><IconPlus /></span>
        </button>
    )
}

/**
 * A short, honest "last touched" label. Relative time reads faster than a date
 * for the thing people actually ask about — which project did I leave alone
 * for three weeks.
 *
 * Months are named in English explicitly rather than through `toLocaleDateString`,
 * which follows the browser's UI locale: a French-locale browser rendered
 * "edited Au 5", which is both untranslated and ambiguous next to a number.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function relativeTime(timestamp) {
    if (!timestamp) return null
    const then = new Date(timestamp).getTime()
    if (Number.isNaN(then)) return null
    const seconds = Math.round((Date.now() - then) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`
    const weeks = Math.round(days / 7)
    if (weeks < 5) return `${weeks}w ago`
    const months = Math.round(days / 30)
    if (months < 12) return `${months}mo ago`
    const date = new Date(then)
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function ProjectCard({ project, index, onOpen, onRename, onDelete }) {
    const isPub = project._published || false
    const isPortfolio = project.editorMode === 'photo-portfolio'
    const pageCount = project.pages?.length || 0
    const lastSaved = relativeTime(project.updatedAt)

    return (
        <div className="dash-project-card" onClick={() => onOpen(index)} role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onOpen(index)}>
            <div className="dash-project-cover">
                <span className={`dash-project-badge ${isPub ? 'published' : 'draft'}`}>
                    {isPub ? 'Published' : 'Draft'}
                </span>
                <div className="dash-project-cover-icon" aria-hidden="true">
                    {isPortfolio ? <IconPhoto /> : <IconBook />}
                </div>
            </div>
            <div className="dash-project-body">
                <h3 className="dash-project-title">{project.title || 'Untitled Project'}</h3>
                <p className="dash-project-meta">
                    {pageCount} {isPortfolio ? 'spread' : 'page'}{pageCount === 1 ? '' : 's'}
                    {project.theme && !isPortfolio ? ` · ${project.theme}` : ''}
                    {project._dirty ? ' · unsaved' : ''}
                </p>
                {lastSaved && (
                    <p className="dash-project-meta" title={new Date(project.updatedAt).toLocaleString()}>
                        Edited {lastSaved}
                    </p>
                )}
                <div className="dash-project-actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onOpen(index)}>Open</button>
                    <button onClick={(e) => { e.stopPropagation(); onRename(e, index) }}>Rename</button>
                    <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete(e, index) }}>Delete</button>
                </div>
            </div>
        </div>
    )
}

/* ── Main Dashboard ─────────────────────────────────────────────────────────── */
function Dashboard() {
    const {
        vpState, updateVpState, showModal, createProject,
        openProject, saveLocal, deleteProject, toast
    } = useVP()

    const projects = vpState.projects || []

    const zines = useMemo(() => projects.filter(p => p.editorMode !== 'photo-portfolio'), [projects])
    const portfolios = useMemo(() => projects.filter(p => p.editorMode === 'photo-portfolio'), [projects])
    const libraryCount = vpState.library?.imported?.length || 0
    const unsavedCount = projects.filter(p => p._dirty).length

    // "Recent edits" is the answer to the question people actually open the hub
    // with: where did I leave off. Sorted by the project's own updatedAt, not
    // list order, because list order is insertion order.
    const recent = useMemo(() => {
        const dated = projects
            .map((p, i) => ({ project: p, index: i, at: new Date(p.updatedAt || 0).getTime() }))
            .filter(entry => entry.at > 0)
            .sort((a, b) => b.at - a.at)
        return dated.slice(0, 3)
    }, [projects])

    const handleCreateZine = () => showModal('themePicker', 'zine')

    const handleCreatePortfolio = () => {
        createProject('editorial', 'photo-portfolio')
    }

    const handleOpenLightTable = () => updateVpState({ currentView: 'lighttable' })

    const handleOpenProject = (index) => openProject(index)

    const handleRenameProject = (e, index) => {
        e.stopPropagation()
        const name = prompt('New name:', vpState.projects[index].title)
        if (name) {
            const updatedProjects = [...vpState.projects]
            updatedProjects[index] = { ...updatedProjects[index], title: name, _dirty: true }
            updateVpState({ projects: updatedProjects })
            setTimeout(() => saveLocal(), 100)
        }
    }

    const handleDeleteProject = async (e, index) => {
        e.stopPropagation()
        if (confirm('Delete this project permanently?')) {
            try {
                await deleteProject(vpState.projects[index])
                saveLocal()
            } catch (error) {
                toast(`Could not delete project: ${error.message}`, 'error')
            }
        }
    }

    return (
        <div className="dashboard">
            {/* ── Hero / Mode shortcuts ───────────────────────────────── */}
            <section className="dash-hero" aria-label="Publisher hub">
                <div className="dash-hero-text">
                    <h1 className="dash-hero-title">Publisher Hub</h1>
                    <p className="dash-hero-sub">Create, develop, and publish your work across three modes.</p>
                </div>
                <div className="dash-shortcuts">
                    <div className="dash-shortcut-card">
                        <div className="dash-shortcut-icon"><IconZine /></div>
                        <h3>Publisher</h3>
                        <p>Zines, magazines, interactive fiction, and print materials.</p>
                        <button className="dash-shortcut-btn" onClick={handleCreateZine}>New Zine</button>
                    </div>
                    <div className="dash-shortcut-card accent">
                        <div className="dash-shortcut-icon"><IconLightTable /></div>
                        <h3>Light Table</h3>
                        <p>Develop, grade, crop, and catalogue your photographs.</p>
                        <button className="dash-shortcut-btn" onClick={handleOpenLightTable}>Open Light Table</button>
                    </div>
                    <div className="dash-shortcut-card">
                        <div className="dash-shortcut-icon"><IconPortfolio /></div>
                        <h3>Portfolio</h3>
                        <p>Arrange and finish photography books and web portfolios.</p>
                        <button className="dash-shortcut-btn" onClick={handleCreatePortfolio}>New Portfolio Book</button>
                    </div>
                </div>
            </section>

            {/* ── Stats strip ────────────────────────────────────────── */}
            <div className="dash-stats">
                <div className="dash-stat">
                    <span className="dash-stat-value">{zines.length}</span>
                    <span className="dash-stat-label">Zines</span>
                </div>
                <div className="dash-stat">
                    <span className="dash-stat-value">{portfolios.length}</span>
                    <span className="dash-stat-label">Books</span>
                </div>
                <div className="dash-stat">
                    <span className="dash-stat-value">{libraryCount}</span>
                    <span className="dash-stat-label">Assets</span>
                </div>
                <div className="dash-stat">
                    <span className="dash-stat-value">
                        {unsavedCount === 0 ? 'Saved' : unsavedCount}
                    </span>
                    <span className="dash-stat-label">{unsavedCount === 0 ? 'All work saved' : 'Unsaved'}</span>
                </div>
            </div>

            {/* ── Recent edits — where I left off ─────────────────── */}
            {recent.length > 0 && (
                <section className="dash-section">
                    <div className="dash-section-head">
                        <h2>Recent Edits</h2>
                    </div>
                    <div className="dash-recent">
                        {recent.map(({ project, index, at }) => (
                            <button
                                key={project.id}
                                type="button"
                                className="dash-recent-item"
                                onClick={() => handleOpenProject(index)}
                            >
                                <span className="dash-recent-icon" aria-hidden="true">
                                    {project.editorMode === 'photo-portfolio' ? <IconPhoto /> : <IconBook />}
                                </span>
                                <span className="dash-recent-body">
                                    <span className="dash-recent-title">{project.title || 'Untitled Project'}</span>
                                    <span className="dash-recent-meta">
                                        {project.editorMode === 'photo-portfolio' ? 'Book' : 'Zine'} · edited {relativeTime(at)}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Zines / Publisher projects ─────────────────────────── */}
            {(zines.length > 0) && (
                <section className="dash-section">
                    <div className="dash-section-head">
                        <h2>Zines &amp; Publications</h2>
                        <button className="dash-section-action" onClick={handleCreateZine}>
                            <IconPlus /> New
                        </button>
                    </div>
                    <div className="dash-project-grid">
                        {zines.length === 0 && (
                            <div className="dash-empty-state">
                                <IconBook />
                                <p>No zines yet. Create your first publication.</p>
                                <button className="dash-shortcut-btn" onClick={handleCreateZine}>Create Zine</button>
                            </div>
                        )}
                        {zines.map((p, i) => {
                            const globalIdx = projects.indexOf(p)
                            return (
                                <ProjectCard
                                    key={p.id}
                                    project={p}
                                    index={globalIdx}
                                    onOpen={handleOpenProject}
                                    onRename={handleRenameProject}
                                    onDelete={handleDeleteProject}
                                />
                            )
                        })}
                    </div>
                </section>
            )}

            {/* ── Portfolio books ────────────────────────────────────── */}
            <section className="dash-section">
                <div className="dash-section-head">
                    <h2>Portfolio Books</h2>
                    <button className="dash-section-action" onClick={handleCreatePortfolio}>
                        <IconPlus /> New
                    </button>
                </div>
                <div className="dash-project-grid">
                    {portfolios.length === 0 && (
                        <div className="dash-empty-state">
                            <IconPhoto />
                            <p>No portfolio books yet. Start by developing photos in the Light Table.</p>
                            <button className="dash-shortcut-btn" onClick={handleCreatePortfolio}>Create Portfolio Book</button>
                        </div>
                    )}
                    {portfolios.map((p) => {
                        const globalIdx = projects.indexOf(p)
                        return (
                            <ProjectCard
                                key={p.id}
                                project={p}
                                index={globalIdx}
                                onOpen={handleOpenProject}
                                onRename={handleRenameProject}
                                onDelete={handleDeleteProject}
                            />
                        )
                    })}
                </div>
            </section>
        </div>
    )
}

export default Dashboard
