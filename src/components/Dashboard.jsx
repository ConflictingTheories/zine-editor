import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const styles = {
    statusIcon: { fontSize: '12px' }
}

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
            localStorage.setItem('vp_projects', JSON.stringify(updatedProjects))
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
            <div className="zine-grid">
                <div className="zine-card create-card" onClick={handleCreateZine}>
                    <div className="zine-card-cover">
                        <div className="cover-icon">+</div>
                    </div>
                    <div className="zine-card-body">
                        <h3>Create New Zine</h3>
                        <p>Start a new project</p>
                    </div>
                </div>
                {projects.map((project, index) => {
                    const isPub = project.serverId && vpState.published?.find(x => x.id === project.serverId)
                    const badge = isPub ? 'badge-published' : 'badge-draft'
                    const statusIcon = project._dirty ? '☁️⃠' : '☁️'
                    return (
                        <div key={project.id} className="zine-card" onClick={() => handleOpenProject(index)}>
                            <div className="zine-card-cover">
                                <span className={`zine-card-badge ${badge}`}>{isPub ? 'Published' : 'Draft'}</span>
                                <div className="cover-icon">📖</div>
                            </div>
                            <div className="zine-card-body">
                                <h3>{project.title || 'Untitled Zine'} <span style={styles.statusIcon}>{statusIcon}</span></h3>
                                <p>{project.pages?.length || 0} pages · {project.theme || 'classic'}</p>
                                <div className="zine-card-actions">
                                    <button onClick={() => handleOpenProject(index)}>Edit</button>
                                    <button onClick={(e) => handleRenameProject(e, index)}>Rename</button>
                                    <button className="del" onClick={(e) => handleDeleteProject(e, index)}>Delete</button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Dashboard
