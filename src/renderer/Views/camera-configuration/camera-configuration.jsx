import React, { useState } from 'react';
import './camera-configuration.css';

const CameraConfiguration = () => {
  const [device, setDevice] = useState('Camera 1 - Front Station (HD)');
  const [resolution, setResolution] = useState('Full HD (1920 × 1080)');
  const [frameRate, setFrameRate] = useState('30 FPS');
  const [sensitivity, setSensitivity] = useState(75);
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);

  return (
    <div className="config-container">
      <header className="config-header">
        <h1>Camera Configuration</h1>
        <p>Configure camera settings and calibration</p>
      </header>

      <div className="config-grid">
        {/* Left Column: Settings */}
        <section className="config-card">
          <h2>Camera Settings</h2>
          
          <div className="form-group">
            <label>Camera Device</label>
            <select value={device} onChange={(e) => setDevice(e.target.value)}>
              <option>Camera 1 - Front Station (HD)</option>
              <option>Camera 2 - Rear Station (HD)</option>
            </select>
            <span className="form-help">Select the camera device to configure</span>
          </div>

          <div className="form-group">
            <label>Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option>Full HD (1920 × 1080)</option>
              <option>HD (1280 × 720)</option>
              <option>VGA (640 × 480)</option>
            </select>
            <span className="form-help">Higher resolution provides better detection accuracy</span>
          </div>

          <div className="form-group">
            <label>Frame Rate</label>
            <select value={frameRate} onChange={(e) => setFrameRate(e.target.value)}>
              <option>30 FPS</option>
              <option>60 FPS</option>
              <option>15 FPS</option>
            </select>
            <span className="form-help">Higher frame rates capture faster movements</span>
          </div>

          <div className="form-group">
            <div className="slider-header">
              <label>Detection Sensitivity</label>
              <span className="slider-value">{sensitivity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(e.target.value)}
              style={{ background: `linear-gradient(to right, #0d1b42 ${sensitivity}%, #e2e8f0 ${sensitivity}%)` }}
            />
            <div className="slider-labels">
              <span>Low (Strict)</span>
              <span>High (Lenient)</span>
            </div>
            <span className="form-help">Adjust how strictly the system validates detections</span>
          </div>

          <div className="form-group">
            <div className="slider-header">
              <label>Brightness</label>
              <span className="slider-value">{brightness}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={brightness} 
              onChange={(e) => setBrightness(e.target.value)} 
              style={{ background: `linear-gradient(to right, #0d1b42 ${brightness}%, #e2e8f0 ${brightness}%)` }}
            />
            <span className="form-help">Adjust camera brightness level</span>
          </div>

          <div className="form-group">
            <div className="slider-header">
              <label>Contrast</label>
              <span className="slider-value">{contrast}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={contrast} 
              onChange={(e) => setContrast(e.target.value)} 
              style={{ background: `linear-gradient(to right, #0d1b42 ${contrast}%, #e2e8f0 ${contrast}%)` }}
            />
            <span className="form-help">Adjust camera contrast level</span>
          </div>
        </section>

        {/* Right Column: Preview */}
        <div className="preview-column">
          <section className="config-card">
            <h2>Calibration Preview</h2>
            <div className="preview-box">
              <div className="preview-grid"></div>
              <div className="preview-target">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
            </div>

            <div className="active-config-grid">
              <div className="config-item">
                <div className="label">Device</div>
                <div className="value">Camera 1 - Front</div>
              </div>
              <div className="config-item">
                <div className="label">Resolution</div>
                <div className="value">1920x1080</div>
              </div>
              <div className="config-item">
                <div className="label">Frame Rate</div>
                <div className="value">30 FPS</div>
              </div>
              <div className="config-item">
                <div className="label">Sensitivity</div>
                <div className="value">{sensitivity}%</div>
              </div>
            </div>

            <div className="status-banner">
              <div className="status-dot"></div>
              <div className="status-content">
                <h3>Camera Status: Active</h3>
                <p>All systems operational</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Actions */}
      <section className="action-card">
        <button className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          Save Settings
        </button>
        <button className="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          Test Camera
        </button>
        <button className="btn btn-outline" onClick={() => {setSensitivity(75); setBrightness(50); setContrast(50);}}>
          Reset to Defaults
        </button>
      </section>

      {/* Tips */}
      <section className="tips-box">
        <div className="tips-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          Camera Calibration Tips
        </div>
        <ul className="tips-list">
          <li>Ensure adequate lighting in the capture area for optimal detection</li>
          <li>Position the camera at a 45-degree angle to the product for best results</li>
          <li>Higher sensitivity may result in more false positives but fewer missed detections</li>
          <li>Test camera settings after any configuration changes to ensure proper functionality</li>
        </ul>
      </section>
    </div>
  );
};

export default CameraConfiguration;