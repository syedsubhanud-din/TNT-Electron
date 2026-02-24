import React, { useState, useEffect } from 'react';
import './camera-data-capture.css';

export default function CameraDataCapture() {
  const [captureState, setCaptureState] = useState('idle'); // 'idle', 'capturing', 'paused'
  const [detectionData, setDetectionData] = useState({
    qrCode: 'No detection',
    confidence: 0,
    status: 'idle',
  });

  const [pythonPid, setPythonPid] = useState(null);
  const [listenPid, setListenPid] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (type, message) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    setLogs((prev) => [{ type, time, message }, ...prev].slice(0, 100));
  };

  useEffect(() => {
    if (!pythonPid && !listenPid) return;

    const processPythonLog = (data, type = 'info') => {
      const lines = data.split('\n');
      lines.forEach((line) => {
        let cleanLine = line.trim();
        if (!cleanLine) return;

        // Strip Python-side timestamps like [10:45:35]
        cleanLine = cleanLine.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/g, '').trim();
        if (!cleanLine) return;

        // Handle "Scanned:" logs
        if (cleanLine.includes('Scanned:')) {
          const match = cleanLine.match(/Scanned:\s+(.*)/);
          if (match) {
            const qrCodeValue = match[1].trim();
            setDetectionData({
              qrCode: qrCodeValue,
              confidence: 99.8,
              status: 'good',
            });
            addLog('success', `Detected QR Code: ${qrCodeValue}`);
            return;
          }
        }

        // Handle "RECEIVED:" logs
        if (cleanLine.includes('RECEIVED:')) {
          const match = cleanLine.match(/RECEIVED:\s+(.*)/);
          if (match) {
            const receivedValue = match[1].trim();
            setDetectionData({
              qrCode: receivedValue,
              confidence: 99.8,
              status: 'good',
            });
            addLog('info', `Received: ${receivedValue}`);
            return;
          }
        }

        // Default: Add as Info log (as requested by user "ye sab INFO section ma show ho")
        addLog('info', cleanLine);
      });
    };

    const removeStdout = window.electron.ipcRenderer.on(
      'python-stdout',
      (payload) => {
        const { pid, data } = payload;
        if (pid === pythonPid || pid === listenPid) {
          processPythonLog(data, 'info');
        }
      },
    );

    const removeStderr = window.electron.ipcRenderer.on(
      'python-stderr',
      (payload) => {
        const { pid, data } = payload;
        if (pid === pythonPid || pid === listenPid) {
          // Many Python logs go to stderr; treat them as info as requested
          processPythonLog(data, 'info');
        }
      },
    );

    const removeExit = window.electron.ipcRenderer.on(
      'python-exit',
      (payload) => {
        const { pid, code } = payload;
        if (pid === pythonPid) {
          console.log(`Capture process (PID ${pid}) exited with code ${code}`);
          setPythonPid(null);
          // Only return to idle if no other process is active/starting
          setCaptureState((current) => {
            if (current === 'capturing' || current === 'paused') return current;
            return 'idle';
          });
        } else if (pid === listenPid) {
          console.log(`Listen process (PID ${pid}) exited with code ${code}`);
          setListenPid(null);
          addLog('warning', `Listen process stopped (code ${code})`);
        }
      },
    );

    return () => {
      removeStdout();
      removeStderr();
      removeExit();
    };
  }, [pythonPid, listenPid]);

  useEffect(() => {
    return () => {
      // Ensure both python scripts are stopped when leaving this page
      if (pythonPid) {
        window.electron.stopPython(pythonPid);
      }
      if (listenPid) {
        window.electron.stopPython(listenPid);
      }
    };
  }, [pythonPid, listenPid]);

  const handleStartCapture = async () => {
    setCaptureState('capturing');
    setCaptureError(null);
    setDetectionData({
      qrCode: 'Scanning...',
      confidence: 0,
      status: 'idle',
    });
    try {
      console.log('Starting Python capture script in background...');

      const result = await window.electron.runPython(
        'create_message/mv.py',
        ['--interval', '0.2', '--batch-size', '10', '--batch-flush-sec', '1'],
        { background: true },
      );
      console.log('result Data: ', result);

      if (result.success) {
        console.log('Python script started with PID:', result.pid);
        setPythonPid(result.pid);
        addLog('info', 'Capture mode started');
      } else {
        throw new Error(result.error || 'Failed to start Python script');
      }
    } catch (error) {
      console.error('Failed to trigger Python script:', error);
      setCaptureError(error.message);
      setCaptureState('idle');
      addLog('error', `Failed to start capture: ${error.message}`);
    }
  };

  const handleStartListen = async () => {
    if (listenPid) {
      addLog('warning', 'Listen mode is already running');
      return;
    }

    try {
      // If capture mode is running, we MUST stop it first to free the camera's TCP port
      if (pythonPid) {
        addLog('info', 'Switching to listen mode, stopping regular capture...');
        await window.electron.stopPython(pythonPid);
        setPythonPid(null);
        // Wait a small moment for port to release
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log('Starting Python listen script in background...');
      addLog('info', 'Starting listen mode (mv.py --listen)...');

      // Keep state as capturing so the stream iframe stays visible
      setCaptureState('capturing');

      const result = await window.electron.runPython(
        'create_message/mv.py',
        ['--listen'],
        { background: true },
      );

      if (result.success) {
        console.log('Python listen script started with PID:', result.pid);
        setListenPid(result.pid);
        addLog('success', 'Listen mode active');
      } else {
        throw new Error(result.error || 'Failed to start Python listen script');
      }
    } catch (error) {
      console.error('Failed to trigger Python listen script:', error);
      addLog('error', `Failed to start listen: ${error.message}`);
      // Only go idle if we don't have pythonPid either
      if (!pythonPid) setCaptureState('idle');
    }
  };

  const handlePause = async () => {
    setCaptureState('paused');
    try {
      // Pause command to printer
      await window.electron.executePython('pause', '');
      console.log('Printer paused');
    } catch (error) {
      console.error('Failed to pause printer:', error);
    }
  };

  const handleResume = async () => {
    setCaptureState('capturing');
    try {
      // For resume, we actually just send 'print' again or 'start'
      // Since 'mv.py' is already running in background, we might just need to tell the printer to start
      await window.electron.executePython('print', 'Msg');
      console.log('Printer resumed');
    } catch (error) {
      console.error('Failed to resume printer:', error);
    }
  };

  const handleStop = async () => {
    try {
      // Stop the camera script
      if (pythonPid) {
        await window.electron.stopPython(pythonPid);
        setPythonPid(null);
      }

      // Stop the listen script
      if (listenPid) {
        await window.electron.stopPython(listenPid);
        setListenPid(null);
      }

      // Stop the printer
      await window.electron.executePython('stop', '');
      console.log('Stopped all processes');
      addLog('warning', 'All processes stopped');
    } catch (error) {
      console.error('Error during stop:', error);
    }
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
        <p className="subtitle">
          Real-time product detection and QR code scanning
        </p>
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
                  <path
                    d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C66.57 80 80 66.57 80 50C80 33.43 66.57 20 50 20ZM50 75C36.19 75 25 63.81 25 50C25 36.19 36.19 25 50 25C63.81 25 75 36.19 75 50C75 63.81 63.81 75 50 75Z"
                    fill="#6c757d"
                  />
                  <circle cx="50" cy="50" r="8" fill="#6c757d" />
                  <path
                    d="M65 35L35 35C32.24 35 30 37.24 30 40L30 60C30 62.76 32.24 65 35 65L65 65C67.76 65 70 62.76 70 60L70 40C70 37.24 67.76 35 65 35Z"
                    stroke="#6c757d"
                    strokeWidth="3"
                    fill="none"
                  />
                </svg>
                <div className="paused-text">PAUSED</div>
              </div>
            )}

            {captureState === 'capturing' && (
              <div className="camera-placeholder active">
                <iframe
                  src="http://192.168.1.14/app/svg_demo/index.html"
                  title="Live Camera Feed"
                  className="live-stream-iframe"
                  frameBorder="0"
                  allowFullScreen
                ></iframe>
                <div className="detection-box"></div>
              </div>
            )}

            {captureState === 'idle' && (
              <div className="camera-placeholder idle">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  <path
                    d="M50 20C33.43 20 20 33.43 20 50C20 66.57 33.43 80 50 80C66.57 80 80 66.57 80 50C80 33.43 66.57 20 50 20ZM50 75C36.19 75 25 63.81 25 50C25 36.19 36.19 25 50 25C63.81 25 75 36.19 75 50C75 63.81 63.81 75 50 75Z"
                    fill="#6c757d"
                  />
                  <circle cx="50" cy="50" r="8" fill="#6c757d" />
                  <path
                    d="M65 35L35 35C32.24 35 30 37.24 30 40L30 60C30 62.76 32.24 65 35 65L65 65C67.76 65 70 62.76 70 60L70 40C70 37.24 67.76 35 65 35Z"
                    stroke="#6c757d"
                    strokeWidth="3"
                    fill="none"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="camera-controls">
            {captureState === 'idle' && (
              <button className="btn-start" onClick={handleStartCapture}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                Start Capture
              </button>
            )}

            {captureState === 'capturing' && (
              <>
                <button className="btn-pause" onClick={handlePause}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause
                </button>

                {!listenPid && (
                  <button
                    className="btn-start"
                    onClick={handleStartListen}
                    style={{
                      background: '#007bff',
                      borderColor: '#007bff',
                      marginLeft: '10px',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                    Start Listen
                  </button>
                )}
              </>
            )}

            {captureState === 'paused' && (
              <button className="btn-resume" onClick={handleResume}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                Resume
              </button>
            )}

            {(captureState === 'capturing' || captureState === 'paused') && (
              <button className="btn-stop" onClick={handleStop}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop
              </button>
            )}

            <button className="btn-outline" onClick={handleRecalibrate}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Recalibrate
            </button>

            <button className="btn-outline" onClick={handleManualOverride}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {detectionData.status === 'good' ? (
                    <polyline points="20 6 9 17 4 12"></polyline>
                  ) : (
                    <circle cx="12" cy="12" r="10"></circle>
                  )}
                </svg>
                {detectionData.status === 'good'
                  ? 'Good Detection'
                  : detectionData.status === 'idle'
                    ? 'Waiting for scan'
                    : 'Searching...'}
              </div>
            </div>

            <div className="info-section">
              <label>Detected QR Code</label>
              <div
                className={`qr-code-display ${detectionData.status === 'good' ? 'good' : ''}`}
              >
                {detectionData.qrCode}
              </div>
            </div>

            <div className="info-section">
              <label>Detection Confidence</label>
              <div className="confidence-display">
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${detectionData.confidence}%`,
                      background:
                        detectionData.status === 'good' ? '#28a745' : undefined,
                    }}
                  ></div>
                </div>
                <span className="confidence-value">
                  {detectionData.confidence}%
                </span>
              </div>
              <span className="confidence-label">
                {detectionData.status === 'good'
                  ? 'Excellent confidence'
                  : 'Awaiting signal'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Logs Section */}
      <div className="detection-logs-section">
        <h3>Detection Logs</h3>

        <div className="logs-container">
          {logs.map((log, index) => (
            <div key={index} className={`log-entry ${log.type}`}>
              <div className="log-header">
                <div className="log-badge-wrapper">
                  <span className="log-dot"></span>
                  <span className="log-badge">{log.type.toUpperCase()}</span>
                </div>
                <span className="log-time">[{log.time}]</span>
              </div>
              <div className="log-message">{log.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
