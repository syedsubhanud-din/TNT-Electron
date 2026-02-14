import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import './reports.css';

const Reports = () => {
  const [dateFrom, setDateFrom] = useState('February 5th, 2026');
  const [dateTo, setDateTo] = useState('February 12th, 2026');

  const productionData = [
    { name: 'Feb 5', good: 2400, rejected: 80, total: 2480 },
    { name: 'Feb 6', good: 2600, rejected: 100, total: 2700 },
    { name: 'Feb 7', good: 2500, rejected: 90, total: 2590 },
    { name: 'Feb 8', good: 2800, rejected: 120, total: 2920 },
    { name: 'Feb 9', good: 2400, rejected: 70, total: 2470 },
    { name: 'Feb 10', good: 2600, rejected: 110, total: 2710 },
    { name: 'Feb 11', good: 2700, rejected: 95, total: 2795 },
    { name: 'Feb 12', good: 2550, rejected: 105, total: 2655 },
  ];

  const trendData = [
    { name: 'Feb 5', cartons: 340, pallets: 25 },
    { name: 'Feb 6', cartons: 370, pallets: 28 },
    { name: 'Feb 7', cartons: 355, pallets: 27 },
    { name: 'Feb 8', cartons: 395, pallets: 32 },
    { name: 'Feb 9', cartons: 345, pallets: 24 },
    { name: 'Feb 10', cartons: 375, pallets: 29 },
    { name: 'Feb 11', cartons: 385, pallets: 31 },
    { name: 'Feb 12', cartons: 365, pallets: 28 },
  ];

  return (
    <div className="reports-container">
      <header className="reports-header">
        <h1>Reports</h1>
        <p>Production analytics and data visualization</p>
      </header>

      {/* Filter Section */}
      <section className="report-card">
        <h2>Report Filters</h2>
        <div className="filter-row">
          <div className="filter-group">
            <label>Date From</label>
            <div className="filter-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <input type="text" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
          </div>
          <div className="filter-group">
            <label>Date To</label>
            <div className="filter-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <input type="text" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="filter-group">
            <label>Product Type</label>
            <div className="filter-input-wrapper">
              <select>
                <option>All Products</option>
                <option>Industrial Component A</option>
                <option>Industrial Component B</option>
              </select>
            </div>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <div className="filter-input-wrapper">
              <select>
                <option>All Status</option>
                <option>Success</option>
                <option>Failed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Apply Filters
          </button>
          <button className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export CSV
          </button>
          <button className="btn btn-outline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export PDF
          </button>
        </div>
      </section>

      <div className="charts-grid">
        {/* Production Over Time */}
        <section className="report-card full-width">
          <h2>Production Over Time</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip />
                <Line type="monotone" dataKey="good" stroke="#22c55e" strokeWidth={3} dot={{r: 4, fill: '#22c55e'}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444'}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="total" stroke="#0d1b42" strokeWidth={3} dot={{r: 4, fill: '#0d1b42'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="custom-legend">
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#22c55e'}}></span> Good Products</div>
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#ef4444'}}></span> Rejected</div>
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#0d1b42'}}></span> Total</div>
          </div>
        </section>

        {/* Quality Metrics */}
        <section className="report-card">
          <h2>Quality Metrics</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="good" fill="#166534" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#991b1b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="custom-legend">
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#166534'}}></span> Good Products</div>
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#991b1b'}}></span> Rejected</div>
          </div>
        </section>

        {/* Carton & Pallet Count Trend */}
        <section className="report-card">
          <h2>Carton & Pallet Count Trend</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip />
                <Line type="monotone" dataKey="cartons" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, fill: '#0ea5e9'}} />
                <Line type="monotone" dataKey="pallets" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="custom-legend">
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#0ea5e9'}}></span> Cartons</div>
            <div className="legend-item"><span className="legend-dot" style={{backgroundColor: '#f59e0b'}}></span> Pallets</div>
          </div>
        </section>

        {/* Period Summary */}
        <section className="report-card full-width">
          <h2>Period Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-label">Total Products</div>
              <div className="summary-value">21,195</div>
              <div className="summary-subtext">All products scanned</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Success Rate</div>
              <div className="summary-value" style={{color: '#10b981'}}>98.2%</div>
              <div className="summary-subtext">Good product ratio</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Cartons</div>
              <div className="summary-value" style={{color: '#0ea5e9'}}>2,917</div>
              <div className="summary-subtext">Cartons processed</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Pallets</div>
              <div className="summary-value" style={{color: '#f59e0b'}}>190</div>
              <div className="summary-subtext">Pallets completed</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reports;