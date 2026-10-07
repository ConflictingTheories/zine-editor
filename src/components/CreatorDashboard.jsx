/**
 * CreatorDashboard — analytics and revenue for SVRN creators.
 *
 * Shows:
 * - Views, reads, completion rate per zine
 * - Revenue: sales, tips, subscriptions
 * - Subscriber count and growth
 * - Top performing content
 */

import { useState, useEffect } from 'react';

export default function CreatorDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/creator/stats?period=${period}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to load stats');
        setStats(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  if (loading) return <div className="dashboard"><div className="loading">Loading stats…</div></div>;
  if (error) return <div className="dashboard"><div className="error">Error: {error}</div></div>;
  if (!stats) return <div className="dashboard"><div className="empty-state">No data yet.</div></div>;

  const { overview, zines, revenue } = stats;

  return (
    <div className="dashboard creator-dashboard">
      <h2>Creator Dashboard</h2>

      <div className="period-selector">
        {['7d', '30d', '90d', 'all'].map(p => (
          <button
            key={p}
            className={`btn btn-small ${period === p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'all' ? 'All time' : `Last ${p}`}
          </button>
        ))}
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{overview?.totalViews?.toLocaleString() || 0}</div>
          <div className="stat-label">Total Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview?.totalReads?.toLocaleString() || 0}</div>
          <div className="stat-label">Reads</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview?.subscribers?.toLocaleString() || 0}</div>
          <div className="stat-label">Subscribers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${((revenue?.total || 0) / 100).toFixed(2)}</div>
          <div className="stat-label">Revenue</div>
        </div>
      </div>

      <h3>Revenue Breakdown</h3>
      <div className="revenue-breakdown">
        <div className="revenue-row">
          <span>Sales (95% to you)</span>
          <span>${((revenue?.sales || 0) / 100).toFixed(2)}</span>
        </div>
        <div className="revenue-row">
          <span>Tips (100% to you)</span>
          <span>${((revenue?.tips || 0) / 100).toFixed(2)}</span>
        </div>
        <div className="revenue-row">
          <span>Subscriptions (95% to you)</span>
          <span>${((revenue?.subscriptions || 0) / 100).toFixed(2)}</span>
        </div>
        <div className="revenue-row total">
          <span>Total</span>
          <span>${((revenue?.total || 0) / 100).toFixed(2)}</span>
        </div>
      </div>

      <h3>Top Zines</h3>
      <div className="zine-stats">
        {(zines || []).map(zine => (
          <div key={zine.id} className="zine-stat-row">
            <span className="zine-stat-title">{zine.title}</span>
            <span className="zine-stat-views">{zine.views?.toLocaleString()} views</span>
            <span className="zine-stat-completion">{zine.completionRate}% completed</span>
            <span className="zine-stat-revenue">${((zine.revenue || 0) / 100).toFixed(2)}</span>
          </div>
        ))}
        {(!zines || zines.length === 0) && (
          <div className="empty-state">No published zines yet.</div>
        )}
      </div>
    </div>
  );
}
