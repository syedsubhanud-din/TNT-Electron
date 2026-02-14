import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import PrintingModule from '../../Views/printing-module/printing-module';
import Dashboard from '../../Views/dashboard/dashboard';
import './UnAuthRoutes.css';
import CameraDataCapture from '../../Views/camera-data-capture/camera-data-capture';
import PrintHistory from '../../Views/print-history/print-history';
import Reports from '../../Views/reports/reports';
import DataSynchronization from '../../Views/data-synchronization/data-synchronization';
import CameraConfiguration from '../../Views/camera-configuration/camera-configuration';

const Icons = {
  Dashboard: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  Camera: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
  Print: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  History: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Reports: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Sync: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  Config: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>,
  BackArrow: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Wifi: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
};

const Header = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const handleLogout = () => {
        // Clear localStorage
        localStorage.removeItem('authenticatedUser');
        // Reload to trigger route change
        window.location.reload();
    };

    return (
        <div className="header">
            <div className="header-title">Industrial Traceability System</div>
            <div className="header-actions">
                <div className="status" style={{color: '#555', fontSize: '0.85rem'}}>{formatDate(currentTime)}</div>
                <div className="status connected">
                    <Icons.Wifi /> Connected
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                    <Icons.Logout /> Logout
                </button>
            </div>
        </div>
    );
};

const Sidenav = ({ isOpen, toggleSidebar }) => {
    return (
        <div className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
            <div className="brand">
                {isOpen ? 'TRACEABILITY' : 'T'}
                {isOpen && (
                    <span className="toggle-btn" onClick={toggleSidebar}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </span>
                )}
            </div>
            
            <div className="collapsed-toggle-container">
                <button className="collapsed-toggle-btn" onClick={toggleSidebar}>
                    {isOpen ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    )}
                </button>
            </div>

            <div className="menu">
                <NavLink to="/" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Dashboard">
                    <Icons.Dashboard />
                    <span className="menu-text">Dashboard</span>
                </NavLink>
                <NavLink to="/camera-capture" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Camera Data Capture">
                    <Icons.Camera />
                    <span className="menu-text">Camera Data Capture</span>
                </NavLink>
                <NavLink to="/printing-module" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Printing Module">
                    <Icons.Print />
                    <span className="menu-text">Printing Module</span>
                </NavLink>
                <NavLink to="/print-history" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Print History">
                    <Icons.History />
                    <span className="menu-text">Print History</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Reports">
                    <Icons.Reports />
                    <span className="menu-text">Reports</span>
                </NavLink>
                <NavLink to="/sync" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Data Synchronization">
                    <Icons.Sync />
                    <span className="menu-text">Data Synchronization</span>
                </NavLink>
                <NavLink to="/config" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Camera Configuration">
                    <Icons.Config />
                    <span className="menu-text">Camera Configuration</span>
                </NavLink>
            </div>
        </div>
    );
};

const Footer = () => {
    return (
        <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '35px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e0e0e0',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            fontSize: '0.75rem',
            zIndex: 1000,
            fontFamily: 'Segoe UI, sans-serif'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span>System Status: <span style={{ color: '#10b981', fontWeight: '600' }}>Operational</span></span>
                <span style={{ color: '#ddd' }}>|</span>
                <span>Last Sync: {new Date().toLocaleTimeString([], { hour12: false })}</span>
            </div>
            <div>
                v1.0.0 <span style={{ margin: '0 8px', color: '#ccc' }}>|</span> © 2026 Traceability System
            </div>
        </div>
    );
}

export default function UnAuthRoutes() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
            <Router>
                <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
                    <Sidenav isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
                    <div className="main-content">
                        <Header />
                        <div className="page-container" style={{ paddingBottom: '60px' }}>
                            <Routes>
                                <Route path='/' element={<Dashboard />} />
                                <Route path='/printing-module' element={<PrintingModule />} />
                                <Route path='/camera-capture' element={<CameraDataCapture />} />
                                <Route path='/print-history' element={<PrintHistory />} />
                                <Route path='/reports' element={<Reports />} />
                                <Route path='/sync' element={<DataSynchronization />} />
                                <Route path='/config' element={<CameraConfiguration />} />
                                <Route path='*' element={<div><h1>Page Under Construction</h1></div>} />
                            </Routes>
                        </div>
                        <Footer />
                    </div>
                </div>
            </Router>
    )
}
