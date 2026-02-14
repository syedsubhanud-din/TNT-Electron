import React, { useState } from 'react';
import './print-history.css';

const PrintHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [dateFilter, setDateFilter] = useState('');

  const stats = [
    { label: 'Total Prints', value: 10, type: 'total', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
    )},
    { label: 'Successful', value: 7, type: 'success', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    )},
    { label: 'Failed', value: 2, type: 'failed', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    )},
    { label: 'Pending', value: 1, type: 'pending', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    )}
  ];

  const mockRecords = [
    { id: 'PRT-001547', timestamp: '12/02/2026, 14:32:15', productName: 'Industrial Component A-4521', gtin: '00012345678905', qrCodeId: 'BC-678905-LK3M5N', trademark: 'TechPro Industries', copies: 1, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001546', timestamp: '12/02/2026, 14:28:42', productName: 'Industrial Component B-8832', gtin: '00012345678912', qrCodeId: 'BC-678912-MN4P6Q', trademark: 'TechPro Industries', copies: 2, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001545', timestamp: '12/02/2026, 14:25:18', productName: 'Industrial Component C-1156', gtin: '00012345678929', qrCodeId: 'BC-678929-0P5R7S', trademark: 'ManuFact Corp', copies: 1, status: 'Failed', printedBy: 'Admin' },
    { id: 'PRT-001544', timestamp: '12/02/2026, 14:20:55', productName: 'Industrial Component A-4522', gtin: '00012345678936', qrCodeId: 'BC-678936-PQ6S8T', trademark: 'TechPro Industries', copies: 1, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001543', timestamp: '12/02/2026, 14:15:11', productName: 'Industrial Component D-9943', gtin: '00012345678943', qrCodeId: 'BC-678943-QR7T9U', trademark: 'GlobalTech Ltd', copies: 3, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001542', timestamp: '12/02/2026, 14:10:33', productName: 'Industrial Component E-2247', gtin: '00012345678950', qrCodeId: 'BC-678950-RS8U0V', trademark: 'TechPro Industries', copies: 1, status: 'Pending', printedBy: 'Admin' },
    { id: 'PRT-001541', timestamp: '12/02/2026, 14:05:22', productName: 'Industrial Component F-3358', gtin: '00012345678967', qrCodeId: 'BC-678967-ST9V1W', trademark: 'ManuFact Corp', copies: 1, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001540', timestamp: '12/02/2026, 14:00:45', productName: 'Industrial Component G-4469', gtin: '00012345678974', qrCodeId: 'BC-678974-TU0W2X', trademark: 'GlobalTech Ltd', copies: 2, status: 'Printed', printedBy: 'Admin' },
    { id: 'PRT-001539', timestamp: '12/02/2026, 13:55:18', productName: 'Industrial Component H-5570', gtin: '00012345678981', qrCodeId: 'BC-678981-UV1X3Y', trademark: 'TechPro Industries', copies: 1, status: 'Failed', printedBy: 'Admin' },
    { id: 'PRT-001538', timestamp: '12/02/2026, 13:50:07', productName: 'Industrial Component I-6681', gtin: '00012345678998', qrCodeId: 'BC-678998-VW2Y4Z', trademark: 'ManuFact Corp', copies: 1, status: 'Printed', printedBy: 'Admin' },
  ];

  return (
    <div className="print-history-container">
      <header className="print-history-header">
        <h1>Print History</h1>
        <p>View and manage all printed labels</p>
      </header>

      <section className="stat-cards-container">
        {stats.map((stat, index) => (
          <div key={index} className={`stat-card ${stat.type}`}>
            <div className="stat-info">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
            </div>
            <div className="stat-icon">
              {stat.icon}
            </div>
          </div>
        ))}
      </section>

      <section className="filter-section">
        <div className="filter-inputs">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Search by ID, GTIN, QR Code, or Product..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>All Status</option>
            <option>Printed</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>

          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <input 
              type="text" 
              placeholder="Filter by date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export History
          </button>
          <button className="btn btn-secondary" onClick={() => {setSearchTerm(''); setStatusFilter('All Status'); setDateFilter('');}}>
            Reset Filters
          </button>
        </div>
      </section>

      <section className="records-section">
        <h2>Print Records</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Print ID</th>
                <th>Timestamp</th>
                <th>Product Name</th>
                <th>GTIN</th>
                <th>QR Code ID</th>
                <th>Trademark</th>
                <th>Copies</th>
                <th>Status</th>
                <th>Printed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockRecords.map((record, index) => (
                <tr key={index}>
                  <td>{record.id}</td>
                  <td>{record.timestamp}</td>
                  <td className="product-name">{record.productName}</td>
                  <td>{record.gtin}</td>
                  <td>{record.qrCodeId}</td>
                  <td>{record.trademark}</td>
                  <td>{record.copies}</td>
                  <td>
                    <span className={`status-badge ${record.status.toLowerCase()}`}>
                      <span className="status-dot"></span>
                      {record.status}
                    </span>
                  </td>
                  <td>{record.printedBy}</td>
                  <td>
                    <div className="action-btns">
                      <button className="icon-btn" title="View">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button className="icon-btn" title="Print">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-container">
          <div className="pagination-info">
            Showing 1 to 10 of 10 records
          </div>
          <div className="pagination-controls">
            <button className="page-btn" disabled>Previous</button>
            <button className="page-btn active">1</button>
            <button className="page-btn" disabled>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrintHistory;