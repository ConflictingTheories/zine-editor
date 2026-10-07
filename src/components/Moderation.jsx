/**
 * ContentModeration — report and review flow for SVRN.
 *
 * - Readers can report zines (spam, abuse, copyright, other)
 * - Reports go to a review queue
 * - Moderators can dismiss, warn, or remove
 */

import { useState, useEffect } from 'react';

export function ReportButton({ zineId, onReport }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/moderation/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zineId, reason, details }),
    });
    setShowForm(false);
    onReport?.();
  };

  if (!showForm) {
    return (
      <button className="btn btn-small btn-secondary" onClick={() => setShowForm(true)}>
        🚩 Report
      </button>
    );
  }

  return (
    <div className="report-form">
      <h4>Report this zine</h4>
      <select value={reason} onChange={e => setReason(e.target.value)} className="input">
        <option value="spam">Spam</option>
        <option value="abuse">Harassment or abuse</option>
        <option value="copyright">Copyright violation</option>
        <option value="other">Other</option>
      </select>
      <textarea
        value={details}
        onChange={e => setDetails(e.target.value)}
        placeholder="Details (optional)"
        className="input"
        rows={3}
      />
      <div className="report-actions">
        <button className="btn btn-secondary btn-small" onClick={() => setShowForm(false)}>
          Cancel
        </button>
        <button className="btn btn-primary btn-small" onClick={handleSubmit}>
          Submit Report
        </button>
      </div>
    </div>
  );
}

export function ModerationQueue() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/moderation/queue', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.json())
      .then(d => setReports(d.reports || []))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (reportId, action) => {
    await fetch(`/api/moderation/report/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setReports(reports.filter(r => r.id !== reportId));
  };

  if (loading) return <div className="loading">Loading reports…</div>;

  return (
    <div className="moderation-queue">
      <h2>Moderation Queue</h2>
      {reports.length === 0 ? (
        <div className="empty-state">No pending reports.</div>
      ) : (
        reports.map(report => (
          <div key={report.id} className="report-card">
            <div className="report-header">
              <span className="report-reason">{report.reason}</span>
              <span className="report-date">{new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="report-zine">Zine: {report.zineTitle}</div>
            {report.details && <div className="report-details">{report.details}</div>}
            <div className="report-actions">
              <button
                className="btn btn-small btn-secondary"
                onClick={() => handleAction(report.id, 'dismiss')}
              >
                Dismiss
              </button>
              <button
                className="btn btn-small btn-secondary"
                onClick={() => handleAction(report.id, 'warn')}
              >
                Warn Author
              </button>
              <button
                className="btn btn-small btn-danger"
                onClick={() => handleAction(report.id, 'remove')}
              >
                Remove Zine
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
