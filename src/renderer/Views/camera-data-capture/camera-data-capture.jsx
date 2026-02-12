import React, { useState } from 'react';
import './camera-data-capture.css';

export default function CameraDataCapture() {
  const [captureState, setCaptureState] = useState('idle'); // 'idle', 'capturing', 'paused'
  const [detectionData, setDetectionData] = useState({
    qrCode: '00012345678905',
    confidence: 98.5,
    status: 'good'
  });

  const handleStartCapture = () => {
    setCaptureState('capturing');
  };

  const handlePause = () => {
    setCaptureState('paused');
  };

  const handleResume = () => {
    setCaptureState('capturing');
  };

  const handleStop = () => {
    setCaptureState('idle'); // Return to idle state to show Start button
  };

  const handleRecalibrate = () => {
    console.log('Recalibrating camera...');
  };

  const handleManualOverride = () => {
    console.log('Manual override triggered...');
  };

  return (
    <div className="camera-capture-wrapper">
      <div className="page-header">
        <h1>Camera Data Capture</h1>
        <p className="subtitle">Real-time product detection and QR code scanning</p>
      </div>

      <div className="camera-capture-container">
        {/* Left Panel: Live Camera Feed */}
        <div className="camera-panel">
          <div className="panel-header">
            <h3>Live Camera Feed</h3>
            {captureState === 'capturing' && (
              <span className="recording-indicator">
                <span className="recording-dot"></span>
                RECORDING
              </span>
            )}
          </div>

          <div className={`camera-feed ${captureState}`}>
            {captureState === 'paused' && (
              <div className="camera-placeholder paused">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  <path d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C66.57 80 80 66.57 80 50C80 33.43 66.57 20 50 20ZM50 75C36.19 75 25 63.81 25 50C25 36.19 36.19 25 50 25C63.81 25 75 36.19 75 50C75 63.81 63.81 75 50 75Z" fill="#6c757d"/>
                  <circle cx="50" cy="50" r="8" fill="#6c757d"/>
                  <path d="M65 35L35 35C32.24 35 30 37.24 30 40L30 60C30 62.76 32.24 65 35 65L65 65C67.76 65 70 62.76 70 60L70 40C70 37.24 67.76 35 65 35Z" stroke="#6c757d" strokeWidth="3" fill="none"/>
                </svg>
                <div className="paused-text">PAUSED</div>
              </div>
            )}

            {captureState === 'capturing' && (
              <div className="camera-placeholder active">
                <div className="detection-box"></div>
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  <path d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C66.57 80 80 66.57 80 50C80 33.43 66.57 20 50 20ZM50 75C36.19 75 25 63.81 25 50C25 36.19 36.19 25 50 25C63.81 25 75 36.19 75 50C75 63.81 63.81 75 50 75Z" fill="#6c757d"/>
                  <circle cx="50" cy="50" r="8" fill="#6c757d"/>
                  <path d="M65 35L35 35C32.24 35 30 37.24 30 40L30 60C30 62.76 32.24 65 35 65L65 65C67.76 65 70 62.76 70 60L70 40C70 37.24 67.76 35 65 35Z" stroke="#6c757d" strokeWidth="3" fill="none"/>
                </svg>
              </div>
            )}

            {captureState === 'idle' && (
              <div className="camera-placeholder idle">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  <path d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C66.57 80 80 66.57 80 50C80 33.43 66.57 20 50 20ZM50 75C36.19 75 25 63.81 25 50C25 36.19 36.19 25 50 25C63.81 25 75 36.19 75 50C75 63.81 63.81 75 50 75Z" fill="#6c757d"/>
                  <circle cx="50" cy="50" r="8" fill="#6c757d"/>
                  <path d="M65 35L35 35C32.24 35 30 37.24 30 40L30 60C30 62.76 32.24 65 35 65L65 65C67.76 65 70 62.76 70 60L70 40C70 37.24 67.76 35 65 35Z" stroke="#6c757d" strokeWidth="3" fill="none"/>
                </svg>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="camera-controls">
            {captureState === 'idle' && (
              <button className="btn-start" onClick={handleStartCapture}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                Start Capture
              </button>
            )}

            {captureState === 'capturing' && (
              <button className="btn-pause" onClick={handlePause}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause
              </button>
            )}

            {captureState === 'paused' && (
              <button className="btn-resume" onClick={handleResume}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                Resume
              </button>
            )}

            {(captureState === 'capturing' || captureState === 'paused') && (
              <button className="btn-stop" onClick={handleStop}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop
              </button>
            )}

            <button className="btn-outline" onClick={handleRecalibrate}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Recalibrate
            </button>

            <button className="btn-outline" onClick={handleManualOverride}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Manual Override
            </button>
          </div>
        </div>

        {/* Right Panel: Detection Data */}
        <div className="detection-panel">
          <h3>Detection Data</h3>

          <div className="detection-info">
            <div className="info-section">
              <label>Detection Status</label>
              <div className={`status-badge ${detectionData.status}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Good Detection
              </div>
            </div>

            <div className="info-section">
              <label>Detected QR Code</label>
              <div className="qr-code-display">
                {detectionData.qrCode}
              </div>
            </div>

            <div className="info-section">
              <label>Detection Confidence</label>
              <div className="confidence-display">
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${detectionData.confidence}%` }}
                  ></div>
                </div>
                <span className="confidence-value">{detectionData.confidence}%</span>
              </div>
              <span className="confidence-label">Excellent confidence</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Logs Section */}
      <div className="detection-logs-section">
        <h3>Detection Logs</h3>
        
        <div className="logs-container">
          <div className="log-entry warning">
            <div className="log-header">
              <div className="log-badge-wrapper">
                <span className="log-dot"></span>
                <span className="log-badge">WARNING</span>
              </div>
              <span className="log-time">14:30:15</span>
            </div>
            <div className="log-message">Low confidence detection - Manual review required</div>
          </div>

          <div className="log-entry error">
            <div className="log-header">
              <div className="log-badge-wrapper">
                <span className="log-dot"></span>
                <span className="log-badge">ERROR</span>
              </div>
              <span className="log-time">14:25:42</span>
            </div>
            <div className="log-message">QR code format validation failed</div>
          </div>

          <div className="log-entry info">
            <div className="log-header">
              <div className="log-badge-wrapper">
                <span className="log-dot"></span>
                <span className="log-badge">INFO</span>
              </div>
              <span className="log-time">14:20:18</span>
            </div>
            <div className="log-message">Camera focus adjustment recommended</div>
          </div>
        </div>
      </div>
    </div>
  );
}
