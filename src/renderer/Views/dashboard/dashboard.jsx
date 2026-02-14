import React from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import './dashboard.css';

const Dashboard = () => {
  const topStats = [
    { 
      label: 'QR Code Count', 
      value: '15,902', 
      type: 'qr', 
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM19 15h2v2h-2z"/></svg> 
    },
    { 
      label: 'Carton Count', 
      value: '2,341', 
      type: 'carton', 
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7.5L12 3L3 7.5V16.5L12 21L21 16.5V7.5Z"/><path d="M12 21V12"/><path d="M12 12L21 7.5"/><path d="M12 12L3 7.5"/><path d="M7.5 5.25l9 4.5"/></svg> 
    },
    { 
      label: 'Pallet Count', 
      value: '156', 
      type: 'pallet', 
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg> 
    },
    { 
      label: 'Total Counter', 
      value: '18,398', 
      type: 'total', 
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg> 
    },
  ];

  const qualityData = [
    { name: 'Good Products', value: 17892 },
    { name: 'Rejected', value: 452 },
  ];

  const productRecords = [
    { timestamp: '12/02/2026, 14:32:15', id: 'A-4521', gtin: '00012345678905', status: 'Good', carton: 'CTN-2341', pallet: 'PLT-156' },
    { timestamp: '12/02/2026, 14:30:42', id: 'B-8832', gtin: '00012345678912', status: 'Good', carton: 'CTN-2340', pallet: 'PLT-156' },
    { timestamp: '12/02/2026, 14:28:18', id: 'C-1156', gtin: '00012345678929', status: 'Bad', carton: 'CTN-2339', pallet: 'PLT-155' },
    { timestamp: '12/02/2026, 14:25:55', id: 'A-4522', gtin: '00012345678936', status: 'Good', carton: 'CTN-2338', pallet: 'PLT-155' },
    { timestamp: '12/02/2026, 14:23:11', id: 'D-9943', gtin: '00012345678943', status: 'Good', carton: 'CTN-2337', pallet: 'PLT-155' },
  ];

  const StatusIcon = ({ status }) => {
    if (status === 'Good') {
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      );
    }
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m15 9-6 6M9 9l6 6"/>
      </svg>
    );
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Real-time production monitoring and analytics</p>
      </header>

      {/* Top Stats Row */}
      <section className="stats-row">
        {topStats.map((stat, idx) => (
          <div key={idx} className={`stat-card ${stat.type}`}>
            <div className="stat-info">
              <div className="label">{stat.label}</div>
              <div className="value">{stat.value}</div>
            </div>
            <div className="stat-icon-wrapper">
              {stat.icon}
            </div>
            <div className="stat-dot"></div>
          </div>
        ))}
      </section>

      {/* Middle Grid */}
      <div className="dashboard-grid">
        {/* Current Product card */}
        <section className="card">
          <h2>Current Product</h2>
          <div className="current-product-content">
            <div className="product-details">
              <div className="detail-item">
                <label>Product Name</label>
                <span>Industrial Component A-4521</span>
              </div>
              <div className="detail-item">
                <label>GTIN</label>
                <span>00012345678905</span>
              </div>
              <div className="detail-item">
                <label>Timestamp</label>
                <span>14/02/2026, 17:34:12</span>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <div className="status-badge good">
                  <StatusIcon status="Good" />
                  Good Product
                </div>
              </div>
              <div className="detail-item">
                <label>Generated QR Code</label>
                <span>A4521-2026-001</span>
              </div>
            </div>

            <div className="camera-snapshot-wrapper">
              <label>Camera Snapshot</label>
              <div className="snapshot-box">
                <div className="live-indicator">
                  <div className="live-dot"></div>
                  LIVE
                </div>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
            </div>
          </div>
        </section>

        {/* Quality Status Card */}
        <section className="card">
          <h2>Quality Status</h2>
          <div className="quality-metrics">
            <div className="metric-item">
              <div className="metric-label">
                <StatusIcon status="Good" />
                Good
              </div>
              <div className="metric-value good">17,892</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">
                <StatusIcon status="Bad" />
                Rejected
              </div>
              <div className="metric-value bad">452</div>
            </div>
            <div className="success-rate-section">
              <label className="rate-label">Success Rate</label>
              <div className="success-rate-value">97.5%</div>
              <div className="mini-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={qualityData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={{ stroke: '#94a3b8' }}
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={{ stroke: '#94a3b8' }}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      ticks={[0, 4500, 9000, 13500, 18000]}
                      domain={[0, 18000]}
                    />
                    <Bar dataKey="value" barSize={90} radius={[8, 8, 0, 0]}>
                      {qualityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#15803d' : '#b91c1c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Product Records Card */}
      <section className="card">
        <div className="records-card-header">
          <h2>Product Records</h2>
          <div className="search-wrapper">
            <input type="text" placeholder="Search by ID, GTIN, or Carton..." />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Product ID</th>
                <th>GTIN</th>
                <th>Status</th>
                <th>Carton</th>
                <th>Pallet</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {productRecords.map((row, idx) => (
                <tr key={idx}>
                  <td className="timestamp">{row.timestamp}</td>
                  <td className="id">{row.id}</td>
                  <td className="gtin">{row.gtin}</td>
                  <td>
                    <span className={`table-badge ${row.status.toLowerCase()}`}>
                      <StatusIcon status={row.status} />
                      {row.status}
                    </span>
                  </td>
                  <td>{row.carton}</td>
                  <td>{row.pallet}</td>
                  <td>
                    <svg className="action-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <div className="pagination-info">Showing 5 of 5 records</div>
          <div className="pagination-btns">
            <button className="btn-pagi">Previous</button>
            <button className="btn-pagi">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;