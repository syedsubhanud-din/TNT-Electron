import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import './dashboard.css';

const Dashboard = ({ isActive = true }) => {
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    date: '',
  });
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [records, setRecords] = useState([]);

  const parseBarcode = (barcode) => {
    const result = {
      gtin: '',
      batch: '',
      mfgDate: '',
    };

    if (
      !barcode ||
      barcode === 'No detection' ||
      barcode === 'Scanning...' ||
      barcode === 'Searching...' ||
      barcode === 'NO CODE FOUND'
    ) {
      return result;
    }

    // 1. Handle format with parentheses: (01)...(10)...
    if (barcode.includes('(') && barcode.includes(')')) {
      const matches = Array.from(barcode.matchAll(/\((\d{2,4})\)([^()]+)/g));
      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const ai = match[1];
          let value = match[2].trim();
          value = value.replace(/!ERROR/g, '').trim();
          if (ai === '01') result.gtin = '01' + value;
          else if (ai === '10') {
            const hasNext = i < matches.length - 1;
            result.batch = '10' + value + (hasNext ? '\u001d' : '');
          } else if (ai === '17') result.mfgDate = '17' + value;
        }
        return result;
      }
    }

    // 2. Handle raw GS1 format (no parentheses): 01...10...17...
    const cleanBarcode = barcode.replace(/!ERROR/g, '').trim();
    const parts = cleanBarcode.split(/\u001d/);

    parts.forEach((part, index) => {
      let segment = part;
      const hasSeparator = index < parts.length - 1;

      while (segment.length >= 2) {
        if (segment.startsWith('01') && segment.length >= 16) {
          result.gtin = segment.substring(0, 16);
          segment = segment.substring(16);
        } else if (segment.startsWith('17') && segment.length >= 8) {
          result.mfgDate = segment.substring(0, 8);
          segment = segment.substring(8);
        } else if (segment.startsWith('10')) {
          const next17 = segment.indexOf('17', 2);
          if (next17 !== -1 && segment.length - next17 === 8) {
            result.batch = segment.substring(0, next17) + '\u001d';
            result.mfgDate = segment.substring(next17);
          } else {
            result.batch = segment + (hasSeparator ? '\u001d' : '');
          }
          segment = '';
        } else {
          segment = segment.substring(1);
        }
      }
    });

    return result;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const result = await window.electron.runPython('create_message/mv.py', [
          '--daily-stats',
        ]);
        const parsed = JSON.parse(result);
        if (parsed.success && isMounted) {
          setStats({
            total: parsed.data.total || 0,
            successful: parsed.data.successful || 0,
            failed: parsed.data.failed || 0,
            date: parsed.data.date || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }
    };

    const fetchRecords = async () => {
      try {
        const result = await window.electron.runPython('create_message/mv.py', [
          '--list-scans',
          '--limit',
          '10',
        ]);
        const parsed = JSON.parse(result);
        if (parsed.rows && isMounted) {
          const enhanced = parsed.rows.map((row) => {
            const isGood =
              row.barcode_value &&
              row.barcode_value !== 'NO CODE FOUND' &&
              !row.barcode_value.includes('!ERROR');
            return {
              ...row,
              status: isGood ? 'Good' : 'Bad',
              parsed: parseBarcode(row.barcode_value),
            };
          });
          setRecords(enhanced);
        }
      } catch (error) {
        console.error('Failed to fetch product records:', error);
      }
    };

    const fetchWeeklyStats = async () => {
      try {
        const days = [6, 5, 4, 3, 2, 1, 0];
        const requests = days.map((d) =>
          window.electron.runPython('create_message/mv.py', [
            '--daily-stats',
            '--days-back',
            String(d),
          ]),
        );
        const results = await Promise.all(requests);
        const parsed = results
          .map((r) => JSON.parse(r))
          .filter((p) => p.success)
          .map((p) => ({
            ...p.data,
            name: new Date(p.data.date).toLocaleDateString([], {
              weekday: 'short',
            }),
          }));

        if (isMounted) {
          setWeeklyStats(parsed);
        }
      } catch (error) {
        console.error('Failed to fetch weekly stats:', error);
      }
    };

    fetchStats();
    fetchRecords();
    fetchWeeklyStats();

    // Refresh data every 3 seconds for real-time
    const interval = setInterval(() => {
      fetchStats();
      fetchRecords();
    }, 3000);

    // Refresh weekly history every 60 seconds
    const historyInterval = setInterval(fetchWeeklyStats, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(historyInterval);
    };
  }, []);

  const topStats = [
    {
      label: 'QR Code Count',
      value: stats.total.toLocaleString(),
      type: 'qr',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <path d="M15 15h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM19 15h2v2h-2z" />
        </svg>
      ),
    },
    {
      label: 'Good Scans',
      value: stats.successful.toLocaleString(),
      type: 'carton',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'Rejected',
      value: stats.failed.toLocaleString(),
      type: 'pallet',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      label: 'Total Counter',
      value: stats.total.toLocaleString(),
      type: 'total',
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
          <path d="M17 6h6v6" />
        </svg>
      ),
    },
  ];

  const qualityData = [
    { name: 'Good Products', value: stats.successful },
    { name: 'Rejected', value: stats.failed },
  ];

  const currentProduct = records.length > 0 ? records[0] : null;

  const productRecords = []; // No longer used, handled by records state

  const StatusIcon = ({ status }) => {
    if (status === 'Good') {
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    }
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
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
            <div className="stat-icon-wrapper">{stat.icon}</div>
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
                <span>
                  {currentProduct
                    ? `Scan ID: ${currentProduct.id}`
                    : 'Waiting for scan...'}
                </span>
              </div>
              <div className="detail-item">
                <label>GTIN</label>
                <span>{currentProduct?.parsed?.gtin || '-'}</span>
              </div>
              <div className="detail-item">
                <label>Timestamp</label>
                <span>
                  {currentProduct
                    ? new Date(currentProduct.scanned_at).toLocaleString()
                    : '-'}
                </span>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <div
                  className={`status-badge ${currentProduct?.status.toLowerCase() || 'idle'}`}
                >
                  <StatusIcon status={currentProduct?.status || 'Bad'} />
                  {currentProduct
                    ? `${currentProduct.status} Product`
                    : 'No Active Scan'}
                </div>
              </div>
              <div className="detail-item">
                <label>Raw Content</label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {currentProduct?.barcode_value || '-'}
                </span>
              </div>
            </div>

            <div className="camera-snapshot-wrapper">
              <label>Live Camera Feed</label>
              <div className="snapshot-box">
                <div className="live-indicator">
                  <div className="live-dot"></div>
                  LIVE
                </div>
                {isActive && (
                  <iframe
                    src="http://192.168.2.156/app/svg_demo/index.html"
                    title="Live Camera Feed"
                    className="live-stream-iframe"
                    frameBorder="0"
                    allowFullScreen
                  ></iframe>
                )}
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
              <div className="metric-value good">
                {stats.successful.toLocaleString()}
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">
                <StatusIcon status="Bad" />
                Rejected
              </div>
              <div className="metric-value bad">
                {stats.failed.toLocaleString()}
              </div>
            </div>
            <div className="success-rate-section">
              <label className="rate-label">Success Rate</label>
              <div className="success-rate-value">
                {stats.total > 0
                  ? ((stats.successful / stats.total) * 100).toFixed(1)
                  : '0.0'}
                %
              </div>
              <div className="mini-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyStats}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />
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
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="successful"
                      name="Good"
                      fill="#15803d"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="failed"
                      name="Rejected"
                      fill="#b91c1c"
                      radius={[4, 4, 0, 0]}
                    />
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
              {records.map((row, idx) => (
                <tr key={idx}>
                  <td className="timestamp">
                    {new Date(row.scanned_at).toLocaleString()}
                  </td>
                  <td className="id">{row.id}</td>
                  <td className="gtin">{row.parsed.gtin || '-'}</td>
                  <td>
                    <span className={`table-badge ${row.status.toLowerCase()}`}>
                      <StatusIcon status={row.status} />
                      {row.status}
                    </span>
                  </td>
                  <td>{row.parsed.batch || '-'}</td>
                  <td>{row.parsed.mfgDate || '-'}</td>
                  <td>
                    <svg
                      className="action-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                      <polyline points="16 7 22 7 22 13"></polyline>
                    </svg>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: '#64748b',
                    }}
                  >
                    No product records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <div className="pagination-info">
            Showing {records.length} records
          </div>
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
