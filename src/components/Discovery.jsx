/**
 * Discovery — browse published pixozines.
 *
 * Simple list for now. Shows cover, title, author, page count.
 * Click to read.
 */

import { useState, useEffect } from 'react';

export default function Discovery({ onOpenZine }) {
  const [zines, setZines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // TODO: Replace with actual API endpoint
        const res = await fetch('/api/zines/published');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setZines(data.zines || []);
      } catch (e) {
        setError(e.message);
        // Fallback: empty list
        setZines([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = zines.filter(z =>
    !search ||
    z.title?.toLowerCase().includes(search.toLowerCase()) ||
    z.author?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="discovery">
        <h2>Discover</h2>
        <div className="loading">Loading published zines…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="discovery">
        <h2>Discover</h2>
        <div className="error">Couldn't load zines: {error}</div>
      </div>
    );
  }

  return (
    <div className="discovery">
      <h2>Discover</h2>

      <div className="discovery-search">
        <input
          type="text"
          placeholder="Search by title or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {search ? 'No zines match your search.' : 'No published zines yet. Be the first!'}
        </div>
      ) : (
        <div className="discovery-grid">
          {filtered.map(zine => (
            <div
              key={zine.id}
              className="discovery-card"
              onClick={() => onOpenZine(zine.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onOpenZine(zine.id)}
            >
              <div className="discovery-cover">
                {zine.cover ? (
                  <img src={zine.cover} alt={zine.title} />
                ) : (
                  <div className="discovery-cover-placeholder">📖</div>
                )}
              </div>
              <div className="discovery-body">
                <h3>{zine.title || 'Untitled'}</h3>
                <p className="discovery-meta">
                  by {zine.author || 'Anonymous'} · {zine.pageCount || 0} pages
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
