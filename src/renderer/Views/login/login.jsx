import React, { useState } from 'react';
import './login.css';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        const userData = { username, loginTime: new Date().toISOString() };
        localStorage.setItem('authenticatedUser', JSON.stringify(userData));
        setIsLoading(false);
        if (onLoginSuccess) onLoginSuccess(userData);
        window.location.reload();
      } else {
        setIsLoading(false);
        setError('Invalid username or password. Please try again.');
      }
    }, 1000);
  };

  const handleDemoLogin = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Section - Hero & Branding */}
        <div className="login-left">
          <div className="industrial-bg"></div>
          <div className="brand-content">
            <div className="brand-logo">
              <div className="shield-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L4 5V11C4 16.19 7.41 21.05 12 22C16.59 21.05 20 16.19 20 11V5L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
              <div className="brand-text">
                <h1>TRACEABILITY</h1>
                <p>Industrial Manufacturing System</p>
              </div>
            </div>

            <div className="hero-text">
              <h2>Complete Production<br />Traceability Solution</h2>
              <p className="hero-subtext">
                Real-time monitoring, automated labeling, and seamless<br />
                integration for modern manufacturing environments.
              </p>
            </div>

            <div className="feature-cards">
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <div className="feat-info">
                  <h3>Advanced Analytics</h3>
                  <p>Comprehensive reports and performance insights</p>
                </div>
              </div>

              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"></path>
                  </svg>
                </div>
                <div className="feat-info">
                  <h3>Automated Workflow</h3>
                  <p>Streamlined processes from capture to printing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Login Form */}
        <div className="login-right">
          <div className="grid-overlay"></div>
          <div className="login-card">
            <div className="card-top-accent"></div>
            <div className="card-body">
              <div className="card-header">
                <h2>Welcome Back</h2>
                <p>Sign in to access your traceability dashboard</p>
              </div>

              <form className="login-form-actual" onSubmit={handleSubmit}>
                {error && <div className="form-error-msg">{error}</div>}

                <div className="form-field">
                  <label>Username <span className="red-dot">*</span></label>
                  <div className="input-group">
                    <span className="icon-pre">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Password <span className="red-dot">*</span></label>
                  <div className="input-group">
                    <span className="icon-pre">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"></path>
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="form-meta">
                  <label className="checkbox-wrap">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <span className="check-box"></span>
                    Remember me
                  </label>
                  <a href="#" className="cyan-link">Forgot password?</a>
                </div>

                <button type="submit" className="login-btn-submit" disabled={isLoading}>
                  {isLoading ? "Validating..." : (
                    <>Sign In <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></>
                  )}
                </button>
              </form>

              <div className="trust-footer">
                <div className="trust-row">
                  <div className="trust-badge-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Secure Connection</span>
                  </div>
                  <div className="trust-badge-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>24/7 Monitoring</span>
                  </div>
                </div>
                <p className="monitor-text">All access is monitored and recorded for security purposes</p>
                
                <div className="demo-credentials-card" onClick={handleDemoLogin}>
                  <div className="demo-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#002D62" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    <span>Demo Credentials</span>
                  </div>
                  <div className="demo-rows">
                    <div className="demo-line">Username: <span className="code-box">admin</span></div>
                    <div className="demo-line">Password: <span className="code-box">admin123</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer-branding">
               © 2026 Traceability System | All Rights Reserved
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
