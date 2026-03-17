import React, { useState, useEffect } from 'react';
import './camera-data-capture.css';

export default function CameraDataCapture({ isActive = true }) {
  const [captureState, setCaptureState] = useState('idle'); // 'idle', 'capturing', 'paused'
  const [detectionData, setDetectionData] = useState({
    qrCode: 'No detection',
    confidence: 0,
    status: 'idle',
    parsed: {
      gtin: '',
      batch: '',
      mfgDate: '',
    },
  });

  const [pythonPid, setPythonPid] = useState(null);
  const [pythonStopFile, setPythonStopFile] = useState(null);
  const [listenPid, setListenPid] = useState(null);
  const [listenStopFile, setListenStopFile] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreScans, setHasMoreScans] = useState(true);
  const PAGE_SIZE = 15;

  const addLog = (type, message) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false });
    setLogs((prev) => [{ type, time, message }, ...prev].slice(0, 100));
  };

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
      barcode === 'Searching...'
    ) {
      return result;
    }

    // Pattern to match (XX) followed by text until the next (XX) or end of string
    // This handles codes like (01)08964001713210(10)T24029(17)251210
    const matches = barcode.matchAll(/\((\d{2,4})\)([^()]+)/g);

    for (const match of matches) {
      const ai = match[1];
      let value = match[2].trim();

      // Strip "!ERROR" if it exists in the value
      value = value.replace(/!ERROR/g, '').trim();

      // Updated mapping based on user request:
      // (01) -> GTIN Number
      // (10) -> Batch Number
      // (17) -> Manufacturing Date
      if (ai === '(01)') result.gtin = value;
      else if (ai === '(10)') result.batch = value;
      else if (ai === '(17)') result.mfgDate = value;
    }

    return result;
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
            const parsed = parseBarcode(qrCodeValue);
            setDetectionData({
              qrCode: qrCodeValue,
              confidence: 99.8,
              status: 'good',
              parsed,
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
            const parsed = parseBarcode(receivedValue);
            setDetectionData({
              qrCode: receivedValue,
              confidence: 99.8,
              status: 'good',
              parsed,
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
        window.electron.stopPython(pythonPid, pythonStopFile);
      }
      if (listenPid) {
        window.electron.stopPython(listenPid, listenStopFile);
      }
    };
  }, [pythonPid, pythonStopFile, listenPid, listenStopFile]);

  const handleStartCapture = async () => {
    setCaptureState('capturing');
    setCaptureError(null);
    setDetectionData({
      qrCode: 'Scanning...',
      confidence: 0,
      status: 'idle',
      parsed: { gtin: '', batch: '', mfgDate: '' },
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
        setPythonStopFile(result.stopFile || null);
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
        await window.electron.stopPython(pythonPid, pythonStopFile);
        setPythonPid(null);
        setPythonStopFile(null);
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
        setListenStopFile(result.stopFile || null);
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
      // Stop the camera script (pass stopFile for graceful OFFLINE)
      if (pythonPid) {
        await window.electron.stopPython(pythonPid, pythonStopFile);
        setPythonPid(null);
        setPythonStopFile(null);
      }

      // Stop the listen script
      if (listenPid) {
        await window.electron.stopPython(listenPid, listenStopFile);
        setListenPid(null);
        setListenStopFile(null);
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

  const [recalibrating, setRecalibrating] = useState(false);
  const handleRecalibrate = async () => {
    setRecalibrating(true);
    addLog('info', 'Running autofocus...');
    try {
      const result = await window.electron.runPython('create_message/mv.py', [
        '--autofocus',
      ]);
      const parsed = JSON.parse(result);
      if (parsed.success) {
        addLog('success', 'Autofocus completed');
        await handleStop();
      } else {
        addLog('error', `Autofocus failed: ${parsed.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog('error', `Recalibrate failed: ${error.message}`);
    } finally {
      setRecalibrating(false);
    }
  };

  const handleManualOverride = () => {
    console.log('Manual override triggered...');
  };

  const [testingConnection, setTestingConnection] = useState(false);
  const handleTestConnection = async () => {
    setTestingConnection(true);
    addLog('info', 'Testing camera connection...');
    try {
      const result = await window.electron.runPython('create_message/mv.py', [
        '--test-connection',
      ]);
      const parsed = JSON.parse(result);
      if (parsed.success) {
        addLog('success', 'Camera connected successfully');
      } else {
        addLog(
          'error',
          `Camera connection failed: ${parsed.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      addLog('error', `Test failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const fetchHistory = async (append = false) => {
    const offset = append ? historyData.length : 0;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingHistory(true);
      setHasMoreScans(true);
    }
    try {
      const result = await window.electron.runPython('create_message/mv.py', [
        '--list-scans',
        '--limit',
        String(PAGE_SIZE),
        '--offset',
        String(offset),
      ]);

      try {
        const parsed = JSON.parse(result);
        if (parsed.error) {
          addLog('error', `History error: ${parsed.error}`);
          return;
        }
        const rows = parsed.rows || [];
        setHasMoreScans(parsed.hasMore === true);

        const enhancedData = rows.map((item) => ({
          ...item,
          parsed: parseBarcode(item.barcode_value),
        }));

        if (append) {
          setHistoryData((prev) => [...prev, ...enhancedData]);
          addLog('info', `Loaded ${rows.length} more scans`);
        } else {
          setHistoryData(enhancedData);
          addLog('info', `Loaded ${enhancedData.length} historical scans`);
        }
      } catch (parseErr) {
        console.error(
          'Failed to parse history JSON:',
          parseErr,
          'Result was:',
          result,
        );
        addLog('error', 'Failed to parse historical data');
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      addLog('error', `Failed to load history: ${error.message}`);
    } finally {
      setLoadingHistory(false);
      setLoadingMore(false);
    }
  };

  const handleHistoryScroll = (e) => {
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom && hasMoreScans && !loadingMore && !loadingHistory) {
      fetchHistory(true);
    }
  };

  useEffect(() => {
    // Optionally load history on mount
    fetchHistory();
  }, []);

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
                {isActive && (
                  <iframe
                    src="http://192.168.2.155/app/svg_demo/index.html"
                    title="Live Camera Feed"
                    className="live-stream-iframe"
                    frameBorder="0"
                    allowFullScreen
                  ></iframe>
                )}
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

          <div className="camera-controls">
            {captureState === 'idle' && (
              <div
                className="main-action-group"
                style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
              >
                <button
                  className="btn-outline"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
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

                {!listenPid && (
                  <button
                    className="btn-start"
                    onClick={handleStartListen}
                    style={{
                      background: '#007bff',
                      borderColor: '#007bff',
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
              </div>
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

            <button
              className="btn-outline"
              onClick={handleRecalibrate}
              disabled={recalibrating}
            >
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
              {recalibrating ? 'Recalibrating...' : 'Recalibrate'}
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
              <label>Detected Barcode</label>
              <div
                className={`qr-code-display ${detectionData.status === 'good' ? 'good' : ''}`}
              >
                {detectionData.qrCode}
              </div>
            </div>

            {detectionData.status === 'good' && (
              <div className="parsed-data-grid">
                <div className="info-section">
                  <label>GTIN Number</label>
                  <div className="parsed-value">
                    {detectionData.parsed.gtin || '-'}
                  </div>
                </div>
                <div className="info-section">
                  <label>Batch Number</label>
                  <div className="parsed-value">
                    {detectionData.parsed.batch || '-'}
                  </div>
                </div>
                <div className="info-section">
                  <label>Manufacturing Date</label>
                  <div className="parsed-value">
                    {detectionData.parsed.mfgDate || '-'}
                  </div>
                </div>
              </div>
            )}

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

      {/* Scan History Section */}
      <div className="history-section">
        <div className="section-header">
          <h3>Scan History</h3>
          <button
            className="btn-refresh"
            onClick={fetchHistory}
            disabled={loadingHistory}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {loadingHistory ? 'Loading...' : 'Refresh History'}
          </button>
        </div>

        <div className="history-table-container" onScroll={handleHistoryScroll}>
          <table className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>GTIN</th>
                <th>Batch</th>
                <th>MFG Date</th>
                {/* <th>Full Barcode</th> */}
                <th>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {historyData.length > 0 ? (
                <>
                  {historyData.map((scan) => (
                    <tr key={scan.id}>
                      <td>{scan.id}</td>
                      <td className="parsed-cell">
                        {scan.parsed?.gtin || '-'}
                      </td>
                      <td className="parsed-cell">
                        {scan.parsed?.batch || '-'}
                      </td>
                      <td className="parsed-cell">
                        {scan.parsed?.mfgDate || '-'}
                      </td>
                      <td className="time-cell">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {loadingMore && (
                    <tr>
                      <td
                        colSpan="5"
                        className="no-data"
                        style={{ padding: '12px' }}
                      >
                        Loading more...
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">
                    {loadingHistory
                      ? 'Loading...'
                      : 'No scans found in database'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
