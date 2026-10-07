/**
 * AccountSettings — user account management.
 *
 * - View/edit profile (name, bio, avatar)
 * - Change password
 * - Manage Stripe Connect (payouts)
 * - API tokens
 * - Delete account
 */

import { useState, useEffect } from 'react';

export default function AccountSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => setProfile(d))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(profile),
      });
      setMessage('Profile saved.');
    } catch (e) {
      setMessage('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading…</div>;
  if (!profile) return <div className="empty-state">Not signed in.</div>;

  return (
    <div className="account-settings">
      <h2>Account Settings</h2>

      {message && <div className="toast">{message}</div>}

      <section>
        <h3>Profile</h3>
        <label>
          Display name
          <input
            type="text"
            value={profile.name || ''}
            onChange={e => setProfile({ ...profile, name: e.target.value })}
            className="input"
          />
        </label>
        <label>
          Bio
          <textarea
            value={profile.bio || ''}
            onChange={e => setProfile({ ...profile, bio: e.target.value })}
            className="input"
            rows={3}
          />
        </label>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </section>

      <section>
        <h3>Payouts</h3>
        <p>Connect Stripe to receive payments (95% of sales, 100% of tips).</p>
        {profile.stripeConnected ? (
          <span className="badge badge-success">Connected</span>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => window.location.href = '/api/stripe/connect'}
          >
            Connect Stripe
          </button>
        )}
      </section>

      <section>
        <h3>Security</h3>
        <button
          className="btn btn-secondary"
          onClick={() => window.location.href = '/api/auth/change-password'}
        >
          Change Password
        </button>
      </section>

      <section className="danger-zone">
        <h3>Danger Zone</h3>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm('Delete your account? This cannot be undone.')) {
              fetch('/api/auth/account', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
              }).then(() => {
                localStorage.removeItem('token');
                window.location.href = '/';
              });
            }
          }}
        >
          Delete Account
        </button>
      </section>
    </div>
  );
}
