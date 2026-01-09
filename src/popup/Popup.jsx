import React, { useState, useEffect } from 'react';
import './popup.css';

function Popup() {
  const [tab, setTab] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('1'); // Default: Bookmarks Bar
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get current tab info
    chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
      if (response) {
        setTab(response);
        setTitle(response.title || '');
      }
    });

    // Get folders
    chrome.runtime.sendMessage({ action: 'getFolders' }, (response) => {
      if (response) {
        setFolders(response);
      }
      setLoading(false);
    });

    // Load last used folder
    chrome.storage.local.get(['last_folder_id'], (result) => {
      if (result.last_folder_id) {
        setSelectedFolder(result.last_folder_id);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!tab?.url) return;

    setSaving(true);
    setError('');

    chrome.runtime.sendMessage({
      action: 'addBookmark',
      parentId: selectedFolder,
      title: title || tab.title,
      url: tab.url
    }, (response) => {
      setSaving(false);
      if (response?.success) {
        // Remember folder choice
        chrome.storage.local.set({ last_folder_id: selectedFolder });
        setSuccess(true);
        setTimeout(() => window.close(), 800);
      } else {
        setError(response?.error || 'Failed to add bookmark');
      }
    });
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="popup-container">
        <div className="success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>Added!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <img src="icon48.png" alt="MarkPilot" className="popup-logo" />
        <span>Add to MarkPilot</span>
      </div>

      {tab ? (
        <div className="popup-content">
          <div className="preview">
            {tab.favIconUrl && (
              <img src={tab.favIconUrl} alt="" className="favicon" />
            )}
            <span className="url">{new URL(tab.url).hostname}</span>
          </div>

          <div className="field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bookmark title"
            />
          </div>

          <div className="field">
            <label>Folder</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {'  '.repeat(folder.depth)}{folder.title}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="error">{error}</div>}

          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Add Bookmark'}
          </button>
        </div>
      ) : (
        <div className="popup-content">
          <div className="error">Cannot bookmark this page</div>
        </div>
      )}
    </div>
  );
}

export default Popup;
