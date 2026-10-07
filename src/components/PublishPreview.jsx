/**
 * PublishPreview — preview a pixozine before publishing.
 *
 * Shows exactly what readers will see: cover, pages, theme.
 * Creator confirms before the zine goes live.
 */

import { useState } from 'react';

export default function PublishPreview({ project, onPublish, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);
  const pages = project.pages || [];

  const handlePublish = () => {
    if (confirm(`Publish "${project.title}"? It will be visible to everyone.`)) {
      onPublish();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-large">
        <div className="modal-header">
          <h2>Preview Before Publishing</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="preview-info">
            <h3>{project.title || 'Untitled'}</h3>
            <p>{pages.length} page{pages.length === 1 ? '' : 's'} · {project.theme || 'Default theme'}</p>
          </div>

          <div className="preview-pages">
            {pages.length === 0 ? (
              <div className="empty-state">No pages to preview.</div>
            ) : (
              <>
                <div className="preview-page">
                  <div className="preview-page-number">
                    Page {currentPage + 1} of {pages.length}
                  </div>
                  <div className="preview-page-content">
                    {/* Render page content as reader will see it */}
                    <div dangerouslySetInnerHTML={{ __html: pages[currentPage]?.html || '<p>Empty page</p>' }} />
                  </div>
                </div>
                <div className="preview-nav">
                  <button
                    className="btn btn-secondary"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={currentPage >= pages.length - 1}
                    onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="preview-checklist">
            <h4>Before you publish:</h4>
            <ul>
              <li>✓ Title is set: {project.title ? 'Yes' : '❌ Missing'}</li>
              <li>✓ Has pages: {pages.length > 0 ? `Yes (${pages.length})` : '❌ None'}</li>
              <li>✓ Cover image: {project.cover ? 'Yes' : '⚠️ None (will use default)'}</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Keep Editing
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={!project.title || pages.length === 0}
          >
            Publish Now
          </button>
        </div>
      </div>
    </div>
  );
}
