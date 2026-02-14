import React from 'react';
import './data-synchronization.css';

const DataSynchronization = () => {
  const syncHistory = [
    { timestamp: '12/02/2026, 14:25:00', status: 'SUCCESS', records: 342, message: 'Successfully synchronized all records' },
    { timestamp: '12/02/2026, 13:25:00', status: 'SUCCESS', records: 298, message: 'Successfully synchronized all records' },
    { timestamp: '12/02/2026, 12:25:00', status: 'WARNING', records: 156, message: 'Partial sync - Some records pending' },
    { timestamp: '12/02/2026, 11:25:00', status: 'ERROR', records: 0, message: 'Connection timeout - Sync failed' },
    { timestamp: '12/02/2026, 10:25:00', status: 'SUCCESS', records: 421, message: 'Successfully synchronized all records' },
  ];

  const StatusBadge = ({ status }) => {
    const config = {
      SUCCESS: { class: 'success', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> },
      WARNING: { class: 'warning', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> },
      ERROR: { class: 'error', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> }
    };

    const item = config[status];
    return (
      <span className={`badge ${item.class}`}>
        {item.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="sync-container">
      <header className="sync-header">
        <h1>Data Synchronization</h1>
        <p>Manage data sync with central server</p>
      </header>

      {/* Connection Stats */}
      <div className="sync-stats-row">
        <div className="sync-stat-card server">
          <div className="sync-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
          </div>
          <div className="sync-stat-info">
            <div className="label">Server Connection</div>
            <div className="value" style={{color: '#10b981'}}>Connected</div>
          </div>
        </div>
        <div className="sync-stat-card last-sync">
          <div className="sync-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </div>
          <div className="sync-stat-info">
            <div className="label">Last Sync</div>
            <div className="value">14:25:00</div>
          </div>
        </div>
        <div className="sync-stat-card pending">
          <div className="sync-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="sync-stat-info">
            <div className="label">Pending Records</div>
            <div className="value">0</div>
          </div>
        </div>
      </div>

      {/* Manual Sync */}
      <section className="sync-card">
        <div className="sync-card-header">
          <h2>Manual Synchronization</h2>
        </div>
        <div className="manual-sync-area">
          <div className="manual-sync-info">
            <strong>Last synchronized: 12/02/2026, 14:25:00</strong>
            Automatic sync occurs every hour. You can also trigger a manual sync anytime.
          </div>
          <button className="btn-sync">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Sync Now
          </button>
        </div>
      </section>

      {/* Synchronization History */}
      <section className="sync-card">
        <div className="sync-card-header">
          <h2>Synchronization History</h2>
        </div>
        <div className="table-responsive">
          <table className="sync-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Records Synced</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.timestamp}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.records}</td>
                  <td>{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sync Settings */}
      <section className="sync-card">
        <div className="sync-card-header">
          <h2>Sync Settings</h2>
        </div>
        <div className="settings-list">
          <div className="setting-item">
            <div className="setting-details">
              <h3>Auto-Sync</h3>
              <p>Automatically sync data every hour</p>
            </div>
            <div className="setting-status enabled">Enabled</div>
          </div>
          <div className="setting-item">
            <div className="setting-details">
              <h3>Sync on Network Change</h3>
              <p>Automatically sync when network connection is restored</p>
            </div>
            <div className="setting-status enabled">Enabled</div>
          </div>
          <div className="setting-item">
            <div className="setting-details">
              <h3>Low Bandwidth Mode</h3>
              <p>Reduce data transfer for slower connections</p>
            </div>
            <div className="setting-status disabled">Disabled</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DataSynchronization;