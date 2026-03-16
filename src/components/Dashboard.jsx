import React from 'react'
import { useVP } from '../context/VPContext.jsx'

// Dashboard styles reconstructed in index.css


function Dashboard() {
    const { vpState, updateVpState, showView, showModal, createProject, openProject, saveLocal } = useVP()

    const handleCreateZine = () => {
        showModal('themePicker')
    }

    const handleOpenProject = (index) => {
        openProject(index)
    }

    const handleRenameProject = (e, index) => {
        e.stopPropagation()
        const name = prompt('New name:', vpState.projects[index].title)
        if (name) {
            const updatedProjects = [...vpState.projects]
            updatedProjects[index] = { ...updatedProjects[index], title: name, _dirty: true }
            updateVpState({ projects: updatedProjects })
            setTimeout(() => saveLocal(), 100) // Ensure state is updated
        }
    }

    const handleDeleteProject = (e, index) => {
        e.stopPropagation()
        if (confirm('Delete this zine permanently?')) {
            const updatedProjects = vpState.projects.filter((_, i) => i !== index)
            updateVpState({ projects: updatedProjects })
        }
    }

    const projects = vpState.projects || []
    const publishedCount = vpState.published?.filter(p => p.author === vpState.user?.username).length || 0
    const totalReads = vpState.published?.filter(p => p.author === vpState.user?.username).reduce((s, p) => s + (p.reads || 0), 0) || 0
    const maxPub = vpState.user?.is_premium ? '∞' : '3'

    return (
        <div className="dashboard">
            <div className="dash-header">
                <h1>My Zines</h1>
                <p>Create, edit, and publish your zines to the world.</p>
            </div>
            <div className="dash-stats">
                <div className="stat-card">
                    <div className="stat-value">{projects.length}</div>
                    <div className="stat-label">Total Zines</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{publishedCount}</div>
                    <div className="stat-label">Published</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{totalReads}</div>
                    <div className="stat-label">Total Reads</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{publishedCount}/{maxPub}</div>
                    <div className="stat-label">Publish Slots ({vpState.user?.is_premium ? 'Premium' : 'Free'})</div>
                </div>
            </div>
            <div className="project-grid">
                <div className="project-card new-zine" onClick={handleCreateZine}>
                    <div className="card-top">
                        <div className="cover-icon">+</div>
                        <h3>Create New Zine</h3>
                        <p className="author-tag">Start a new project</p>
                    </div>
                </div>
                {projects.map((project, index) => {
                    const isPub = project._published || false
                    const isSyncing = project._dirty && vpState.isSyncing
                    const badge = isPub ? 'badge-published' : 'badge-draft'
                    return (
                        <div key={project.id} className="project-card" onClick={() => handleOpenProject(index)}>
                            <div className="card-top">
                                <span className={`zine-card-badge ${badge}`}>{isPub ? 'Published' : 'Draft'}</span>
                                <h3>{project.title || 'Untitled Zine'}</h3>
                                <div className="author-tag">
                                    {project.pages?.length || 0} pages · {project.theme || 'classic'}
                                    {isSyncing && ' (syncing...)'}
                                </div>
                            </div>
                            <div className="zine-card-actions">
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleOpenProject(index)}>Edit</button>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={(e) => handleRenameProject(e, index)}>Rename</button>
                                <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--vp-accent)' }} onClick={(e) => handleDeleteProject(e, index)}>Delete</button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Dashboard
