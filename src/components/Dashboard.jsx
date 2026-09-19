/*
 * Component: Dashboard
 * Main user dashboard with project overview, recent activity, and navigation shortcuts.
 */

import React from 'react'
import { useVP } from '../context/VPContext.jsx'

const styles = {
    statusIcon: { fontSize: '12px' }
}

/**
 * Component: Dashboard
 * Main user dashboard showing projects, stats, and quick actions to create
 * or manage zines.
 */
function Dashboard() {
    const { vpState, updateVpState, showView, showModal, createProject, openProject, saveLocal, deleteProject, toast } = useVP()

    const handleCreateZine = () => {
        showModal('themePicker', 'zine')
    }

    const handleCreatePortfolio = () => {
        // A portfolio begins with a calm editorial workspace, not a zine-theme
        // chooser. Visual treatment belongs to the book/spread, not its UI.
        createProject('editorial', 'photo-portfolio')
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

    const handleDeleteProject = async (e, index) => {
        e.stopPropagation()
        if (confirm('Delete this zine permanently?')) {
            try {
                await deleteProject(vpState.projects[index])
                saveLocal()
            } catch (error) {
                toast(`Could not delete zine: ${error.message}`, 'error')
            }
        }
    }

    const projects = vpState.projects || []

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
            </div>
            <div className="zine-grid">
                <div className="zine-card create-card" onClick={handleCreateZine}>
                    <div className="zine-card-cover">
                        <div className="cover-icon">+</div>
                    </div>
                    <div className="zine-card-body">
                        <h3>Create New Zine</h3>
                        <p>Start a new interactive project</p>
                    </div>
                </div>
                <div className="zine-card create-card" onClick={handleCreatePortfolio}>
                    <div className="zine-card-cover">
                        <div className="cover-icon">📷</div>
                    </div>
                    <div className="zine-card-body">
                        <h3>Create Portfolio Book</h3>
                        <p>Start a new photo-centric project</p>
                    </div>
                </div>
                <div className="zine-card create-card" onClick={() => updateVpState({ currentView: 'lighttable' })}>
                    <div className="zine-card-cover">
                        <div className="cover-icon" style={{ filter: 'invert(1)' }}>💡</div>
                    </div>
                    <div className="zine-card-body">
                        <h3>Light Table</h3>
                        <p>Process library images natively</p>
                    </div>
                </div>
                {projects.map((project, index) => {
                    const isPub = project._published || false
                    const badge = isPub ? 'badge-published' : 'badge-draft'
                    return (
                        <div key={project.id} className="zine-card" onClick={() => handleOpenProject(index)}>
                            <div className="zine-card-cover">
                                <span className={`zine-card-badge ${badge}`}>{isPub ? '✓ Published' : 'Draft'}</span>
                                <div className="cover-icon">📖</div>
                            </div>
                            <div className="zine-card-body">
                                <h3>{project.title || 'Untitled Zine'}</h3>
                                <div style={{ fontSize: '0.85em', color: 'var(--vp-text-dim)', marginBottom: '8px' }}>
                                    {project._remote ? 'Stored on server' : `${project.pages?.length || 0} pages · ${project.theme || 'classic'}`}
                                </div>
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
