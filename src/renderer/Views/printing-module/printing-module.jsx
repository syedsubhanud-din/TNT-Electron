import React, { useState } from 'react';
import './printing-module.css';
import { Toaster, toast } from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

export default function PrintingModule() {
    const [formData, setFormData] = useState({
        mfgDate: '',
        expDate: '',
        gtin: '',
        batch: '',
        tmdaReg: '',
        serialNumber: '',
    });

    const [printerSettings, setPrinterSettings] = useState({
        printer_ip: '172.16.0.55',
        printer_port: 9944
    });

    const [showSettings, setShowSettings] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [currentMessageName, setCurrentMessageName] = useState('');

    React.useEffect(() => {
        const loadConfig = async () => {
            if (window.electron && window.electron.getPrinterConfig) {
                const config = await window.electron.getPrinterConfig();
                setPrinterSettings(config);
            }
        };
        loadConfig();
    }, []);

    const handleSaveSettings = async () => {
        try {
            const result = await window.electron.savePrinterConfig(printerSettings);
            if (result.success) {
                toast.success("Printer settings saved!");
                setShowSettings(false);
            } else {
                toast.error(`Failed to save: ${result.error}`);
            }
        } catch (error) {
            toast.error(`Error saving settings: ${error.message}`);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Validation for numeric fields
        if (['gtin', 'serialNumber'].includes(name)) {
            if (value && !/^\d*$/.test(value)) return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (isGenerated) setIsGenerated(false); 
    };

    const formatDateToMMYYYY = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${month}${year}`;
    };

    const handleGenerate = async () => {
        // Basic validation
        if (!formData.mfgDate || !formData.expDate || !formData.gtin || !formData.batch || !formData.serialNumber) {
             toast.error("Please fill in all required fields");
             return;
        }

        // Date Validation
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const mfgDate = new Date(formData.mfgDate);
        const expDate = new Date(formData.expDate);

        if (mfgDate > today) {
            toast.error("Manufacturing Date cannot be in the future");
            return;
        }

        if (expDate < today) {
            toast.error("Expiry Date cannot be in the past");
            return;
        }

        if (expDate <= mfgDate) {
            toast.error("Expiry Date must be after Manufacturing Date");
            return;
        }

        try {
            toast.loading("Creating label message...");

            const mfg = formatDateToMMYYYY(formData.mfgDate);
            const exp = formatDateToMMYYYY(formData.expDate);
            
            const uniqueName = `PharmaLabel_${Date.now().toString().slice(-4)}`;
            
            const args = [
                uniqueName,
                '--gtin', formData.gtin,
                '--mfg', mfg,
                '--exp', exp,
                '--batch', formData.batch,
                '--sn', formData.serialNumber
            ];

            if (formData.tmdaReg) {
                args.push('--tmda_reg', formData.tmdaReg);
            }

            // Call Python script via Electron IPC
            const output = await window.electron.runPython('create_message/create_product_label.py', args);
                
            console.log('Python Output:', output);

            // Parse message name from output: [OK] Message 'PharmaLabel_727' created (id=133)
            const match = output.match(/Message '([^']+)' created/);
                
            if (match && match[1]) {
                setCurrentMessageName(match[1]);
                setIsGenerated(true);
                toast.dismiss();
                toast.success(`QR Code Generated: ${match[1]}`);
            } else if (output.includes('[OK]')) {
                // Fallback if regex fails but OK is present
                setIsGenerated(true);
                toast.dismiss();
                toast.success("Message created (check logs for name)");
            } else {
                toast.dismiss();
                toast.error(`Failed to create label: ${output}`);
                }
        } catch (error) {
            toast.dismiss();
            toast.error(`Error: ${error.message}`);
            console.error('Generate error:', error);
        }
    };

    const handleReset = () => {
        setFormData({
            mfgDate: '',
            expDate: '',
            gtin: '',
            batch: '',
            tmdaReg: '',
            serialNumber: '',
        });
        setIsGenerated(false);
        setCurrentMessageName('');
    };  

    const handlePrint = async () => {
        if (!isGenerated || !currentMessageName) {
            toast.error("Please generate a QR code first");
            return;
        }

        const loadingToast = toast.loading("Starting print job...");
        
        try {
            // Command: run_command.py print start PharmaLabel_727
            const args = ['print', 'start', currentMessageName];

            if (window.electron && window.electron.runPython) {
                const output = await window.electron.runPython('create_message/run_command.py', args);
                console.log('Print Output:', output);
                
                try {
                    const response = JSON.parse(output);
                    if (response.status === 'ok') {
                        toast.success("Print job started successfully!", { id: loadingToast });
                    } else if (response.descript === "print engine is running") {
                        toast.error("Print engine is already running", { id: loadingToast });
                    } else {
                        toast.error(`Print failed: ${response.descript || 'Unknown error'}`, { id: loadingToast });
                    }
                } catch (e) {
                    // If not JSON, check for keywords
                    if (output.toLowerCase().includes('ok') || output.toLowerCase().includes('success')) {
                        toast.success("Print initiated", { id: loadingToast });
                    } else {
                        toast.error(`Print failed: ${output.slice(0, 100)}`, { id: loadingToast });
                    }
                }
            } else {
                toast.success("Print initiated (Dev Mode)", { id: loadingToast });
            }
        } catch (error) {
            toast.error(`Print error: ${error.message}`, { id: loadingToast });
            console.error('Print error:', error);
        }
    };

    const handleStopPrint = async () => {
        const loadingToast = toast.loading("Stopping print job...");
        
        try {
            const args = ['print', 'stop'];

            if (window.electron && window.electron.runPython) {
                const output = await window.electron.runPython('create_message/run_command.py', args);
                console.log('Stop Output:', output);
                
                try {
                    const response = JSON.parse(output);
                    if (response.status === 'ok') {
                        toast.success("Print job stopped", { id: loadingToast });
                    } else {
                        toast.error(`Stop failed: ${response.descript || 'Unknown error'}`, { id: loadingToast });
                    }
                } catch (e) {
                    toast.success("Stop command sent", { id: loadingToast });
                }
            } else {
                toast.success("Print stopped (Dev Mode)", { id: loadingToast });
            }
        } catch (error) {
            toast.error(`Stop error: ${error.message}`, { id: loadingToast });
            console.error('Stop error:', error);
        }
    };

    // Helper to format date for preview (MMDDYY) - keeping for QR canvas preview
    const formatDateForPreview = (dateString) => {
        if (!dateString) return '______';
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${month}${day}${year.slice(-2)}`;
    };

    // Generate QR Content String for preview
    // Note: The Python script builds its own GS1 string, this is just for UI display
    const qrValue = `01${formData.gtin}21${formData.serialNumber}17${formatDateToMMYYYY(formData.expDate)}0010${formData.batch}`;

    return (
        <div className="printing-module-wrapper">
             <div className="page-header">
                <div className="title-group">
                    <h1>Printing Module</h1>
                    <p className="subtitle">Generate QR codes and print product labels</p>
                </div>
                <button className={`btn-settings ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    {showSettings ? 'Hide Settings' : 'Printer Settings'}
                </button>
            </div>

            {showSettings && (
                <div className="printer-settings-panel">
                    <h3>Printer Configuration</h3>
                    <div className="settings-row">
                        <div className="form-group">
                            <label>Printer IP Address</label>
                            <input 
                                type="text" 
                                value={printerSettings.printer_ip} 
                                onChange={(e) => setPrinterSettings({...printerSettings, printer_ip: e.target.value})}
                                placeholder="172.16.0.55"
                            />
                        </div>
                        <div className="form-group">
                            <label>Printer Port</label>
                            <input 
                                type="number" 
                                value={printerSettings.printer_port} 
                                onChange={(e) => setPrinterSettings({...printerSettings, printer_port: parseInt(e.target.value)})}
                                placeholder="9944"
                            />
                        </div>
                        <button className="btn-save" onClick={handleSaveSettings}>Save Config</button>
                    </div>
                </div>
            )}

            <div className="printing-module-container">
                {/* Left Panel: Label Information Form */}
                <div className="left-panel">
                    <h3>Label Information</h3>
                    
                    <div className="form-group">
                        <label>Manufacturing Date <span className="required">*</span></label>
                        <input 
                            type="date" 
                            name="mfgDate" 
                            value={formData.mfgDate} 
                            onChange={handleChange}
                            max={new Date().toISOString().split('T')[0]}
                        />
                        <span className="help-text">Select the date of manufacture</span>
                    </div>

                    <div className="form-group">
                        <label>Expiry Date <span className="required">*</span></label>
                        <input 
                            type="date" 
                            name="expDate" 
                            value={formData.expDate} 
                            onChange={handleChange}
                            min={new Date().toISOString().split('T')[0]}
                        />
                        <span className="help-text">Must be after manufacturing date</span>
                    </div>

                    <div className="form-group">
                        <label>GTIN (Global Trade Item Number) <span className="required">*</span></label>
                        <input 
                            type="text" 
                            name="gtin" 
                            value={formData.gtin} 
                            maxLength={14}
                            onChange={handleChange}
                            placeholder="00012345678905"
                        />
                        <span className="help-text">14-digit numeric code</span>
                    </div>

                    <div className="form-group">
                        <label>Batch Number <span className="required">*</span></label>
                        <input 
                            type="text" 
                            name="batch" 
                            value={formData.batch} 
                            onChange={handleChange}
                            placeholder="153A26"
                        />
                        <span className="help-text">Product batch identifier</span>
                    </div>

                    <div className="form-group">
                        <label>TMDA REG. NO.</label>
                        <input 
                            type="text" 
                            name="tmdaReg" 
                            value={formData.tmdaReg} 
                            onChange={handleChange} 
                            placeholder="TZ 11H178"
                        />
                        <span className="help-text">Optional registration number</span>
                    </div>

                    <div className="form-group">
                        <label>Serial Number <span className="required">*</span></label>
                        <input 
                            type="text" 
                            name="serialNumber" 
                            value={formData.serialNumber} 
                            onChange={handleChange}
                            placeholder="02750082..."
                        />
                        <span className="help-text">Unique product identifier</span>
                    </div>
                </div>

                {/* Right Panel: Label Preview */}
                <div className="right-panel">
                    <h3>Label Preview</h3>
                    
                    {isGenerated ? (
                        <div className="label-preview-content">
                            <div className="label-card">
                                <div className="qr-section">
                                    <QRCodeCanvas value={qrValue} size={150} />
                                </div>
                                <div className="details-section">
                                    <div className="detail-row"><strong>GTIN:</strong> <span>{formData.gtin}</span></div>
                                    <div className="detail-row"><strong>MFG:</strong> <span>{formatDateToMMYYYY(formData.mfgDate)}</span></div>
                                    <div className="detail-row"><strong>EXP:</strong> <span>{formatDateToMMYYYY(formData.expDate)}</span></div>
                                    <div className="detail-row"><strong>BATCH:</strong> <span>{formData.batch}</span></div>
                                    <div className="detail-row"><strong>SN:</strong> <span>{formData.serialNumber}</span></div>
                                    {formData.tmdaReg && <div className="detail-row"><strong>TMDA:</strong> <span>{formData.tmdaReg}</span></div>}
                                </div>
                            </div>
                            <div className="success-message">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Message '{currentMessageName}' ready
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state-placeholder">
                            <div className="placeholder-icon">
                                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 10H30V30H10V10Z" stroke="#9ca3af" strokeWidth="4" strokeLinejoin="round"/>
                                    <path d="M50 10H70V30H50V10Z" stroke="#9ca3af" strokeWidth="4" strokeLinejoin="round"/>
                                    <path d="M10 50H30V70H10V50Z" stroke="#9ca3af" strokeWidth="4" strokeLinejoin="round"/>
                                    <path d="M50 50H70V70H50V50Z" stroke="#9ca3af" strokeWidth="4" strokeLinejoin="round"/>
                                    <rect x="18" y="18" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="58" y="18" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="18" y="58" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="50" y="38" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="38" y="50" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="38" y="38" width="4" height="4" fill="#9ca3af"/>
                                    <rect x="62" y="62" width="4" height="4" fill="#9ca3af"/>
                                </svg>
                            </div>
                            <p>Fill in the label information and generate a QR code to preview the label</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="action-bar">
                <button className="btn-primary" onClick={handleGenerate}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect></svg>
                    Generate QR Code
                </button>
                <button className={`btn-secondary ${!isGenerated ? 'disabled' : ''}`} onClick={handlePrint} disabled={!isGenerated}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Start Printing
                </button>
                <button className="btn-outline danger" onClick={handleStopPrint}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                    Stop Printing
                </button>
                <button className="btn-outline">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Save Template
                </button>
                <button className="btn-outline" onClick={handleReset}>
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Reset
                </button>
            </div>
        </div>
    );
}
