import React, { useState, useEffect } from 'react'
import { useVP } from '../context/VPContext.jsx'

function Discover() {
    const { vpState, api, showView, updateVpState } = useVP()
    const [searchQuery, setSearchQuery] = useState('')
    const [currentFilter, setCurrentFilter] = useState('all')
    const [zines, setZines] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let isMounted = true
        const fetchZines = async () => {
            setLoading(true)
            try {
                let url = '/published?'
                if (currentFilter !== 'all') url += `genre=${currentFilter}&`
                if (searchQuery) url += `q=${searchQuery}`
                const data = await api(url)
                if (isMounted) setZines(data)
            } catch (e) {
                console.error('Failed to fetch zines', e)
            } finally {
                if (isMounted) setLoading(false)
            }
        }
        fetchZines()
        return () => { isMounted = false }
    }, [currentFilter, searchQuery, api])

    const handleRead = async (id) => {
        try {
            const zineData = await api(`/zines/${id}`)
            const project = { ...zineData, pages: zineData.data || zineData.pages || [] }
            updateVpState({ currentProject: project, currentView: 'reader', readerMode: 'read' })
        } catch (e) {
            alert('Failed to load zine')
        }
    }

    const handleFilter = (filter, button) => {
        setCurrentFilter(filter)
        // Update active class
    }

    const handleSearch = (query) => {
        setSearchQuery(query)
    }

    const themeIcons = {
        classic: '📜',
        fantasy: '⚔️',
        cyberpunk: '🌐',
        conspiracy: '🔍',
        worldbuilding: '🗺️',
        comics: '💥',
        arcane: '🔮'
    }

    return (
        <div className="discover">
            <div className="discover-header">
                <h1>Discover Zines</h1>
                <div className="discover-search">
                    <input
                        type="text"
                        id="discoverSearch"
                        placeholder="Search zines..."
                        onInput={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="discover-filters" id="discoverFilters">
                <button className={`filter-tag ${currentFilter === 'all' ? 'active' : ''}`} onClick={(e) => handleFilter('all', e.target)}>
                    All
                </button>
                <button className={`filter-tag ${currentFilter === 'classic' ? 'active' : ''}`} onClick={(e) => handleFilter('classic', e.target)}>
                    Classic Literature
                </button>
                <button className={`filter-tag ${currentFilter === 'fantasy' ? 'active' : ''}`} onClick={(e) => handleFilter('fantasy', e.target)}>
                    Medieval Fantasy
                </button>
                <button className={`filter-tag ${currentFilter === 'cyberpunk' ? 'active' : ''}`} onClick={(e) => handleFilter('cyberpunk', e.target)}>
                    Cyberpunk
                </button>
                <button className={`filter-tag ${currentFilter === 'conspiracy' ? 'active' : ''}`} onClick={(e) => handleFilter('conspiracy', e.target)}>
                    Dark Conspiracies
                </button>
                <button className={`filter-tag ${currentFilter === 'worldbuilding' ? 'active' : ''}`} onClick={(e) => handleFilter('worldbuilding', e.target)}>
                    World Building
                </button>
                <button className={`filter-tag ${currentFilter === 'comics' ? 'active' : ''}`} onClick={(e) => handleFilter('comics', e.target)}>
                    Comics
                </button>
                <button className={`filter-tag ${currentFilter === 'arcane' ? 'active' : ''}`} onClick={(e) => handleFilter('arcane', e.target)}>
                    Arcane Lore
                </button>
            </div>
            <div className="discover-grid" id="discoverGrid">
                {loading ? <p style={{ gridColumn: '1/-1', textAlign: 'center' }}>Loading...</p> :
                    zines.length === 0 ? (
                        <p style={{ color: 'var(--vp-text-dim)', gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', fontSize: '1.1em' }}>
                            No zines found. Be the first to publish!
                        </p>
                    ) : (
                        zines.map((zine) => (
                            <div key={zine.id} className="discover-card" onClick={() => handleRead(zine.id)}>
                                <div className="discover-card-cover">
                                    <div className="cover-bg">{themeIcons[zine.genre] || '📖'}</div>
                                </div>
                                <div className="discover-card-body">
                                    <h3>{zine.title}</h3>
                                    <div className="author">by {zine.author_name}</div>
                                    <div className="meta">
                                        <span>Published {new Date(zine.published_at).toLocaleDateString()}</span>
                                        <span>👁 {zine.read_count ?? zine.reads ?? 0} reads</span>
                                    </div>
                                    <div className="discover-card-tags">
                                        {(zine.tags || '').split(',').map((tag, i) => (
                                            <span key={i}>{tag.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
            </div>
        </div>
    )
}

export default Discover
