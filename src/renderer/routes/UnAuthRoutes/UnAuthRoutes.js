import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import PrintingModule from '../../Views/printing-module/printing-module';
import './UnAuthRoutes.scss';
import CameraDataCapture from '../../Views/camera-data-capture/camera-data-capture';

const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  Camera: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
  Print: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>,
  History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Reports: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  Sync: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>,
  Config: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </span>
                )}
            </div>
            {!isOpen && (
                <div className="collapsed-toggle-container">
                    <button className="collapsed-toggle-btn" onClick={toggleSidebar}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            )}
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
                                <Route path='/' element={<div><h1>Dashboard</h1></div>} />
                                <Route path='/printing-module' element={<PrintingModule />} />
                                <Route path='/camera-capture' element={<CameraDataCapture />} />
                                <Route path='*' element={<div><h1>Page Under Construction</h1></div>} />
                            </Routes>
                        </div>
                        <Footer />
                    </div>
                </div>
            </Router>
    )
}
