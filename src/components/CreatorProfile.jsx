/**
 * CreatorProfile — public creator page.
 *
 * Shows creator info, their published zines, and follow button.
 * Route: /creator/:username
 */

import { useState, useEffect } from 'react';

export default function CreatorProfile({ username }) {
  const [creator, setCreator] = useState(null);
  const [zines, setZines] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/creators/${username}`).then(r => r.json()),
      fetch(`/api/creators/${username}/zines`).then(r => r.json()),
    ])
      .then(([c, z]) => {
        setCreator(c);
        setZines(z.zines || []);
        setFollowing(c.isFollowing || false);
      })
      .finally(() => setLoading(false));
  }, [username]);

  const handleFollow = async () => {
    const method = following ? 'DELETE' : 'POST';
    await fetch(`/api/creators/${username}/follow`, {
      method,
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setFollowing(!following);
  };

  if (loading) return <div className="loading">Loading…</div>;
  if (!creator) return <div className="empty-state">Creator not found.</div>;

  return (
    <div className="creator-profile">
      <div className="profile-header">
        <div className="profile-avatar">
          {creator.avatar ? (
            <img src={creator.avatar} alt={creator.name} />
          ) : (
            <div className="avatar-placeholder">{creator.name?.[0]}</div>
          )}
        </div>
        <div className="profile-info">
          <h1>{creator.name}</h1>
          <div className="profile-username">@{username}</div>
          {creator.bio && <p className="profile-bio">{creator.bio}</p>}
          <div className="profile-stats">
            <span>{zines.length} zines</span>
            <span>{creator.followerCount || 0} followers</span>
          </div>
        </div>
        <button
          className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleFollow}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      <div className="profile-zines">
        <h2>Published</h2>
        {zines.length === 0 ? (
          <div className="empty-state">No published zines yet.</div>
        ) : (
          <div className="zine-grid">
            {zines.map(zine => (
              <a key={zine.id} href={`/read/${zine.id}`} className="zine-card">
                {zine.cover && <img src={zine.cover} alt={zine.title} />}
                <div className="zine-card-title">{zine.title}</div>
                <div className="zine-card-meta">
                  {zine.price > 0 ? `$${(zine.price / 100).toFixed(2)}` : 'Free'}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
