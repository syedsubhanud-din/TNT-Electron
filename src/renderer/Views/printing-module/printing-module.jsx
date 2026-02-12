import React, { useState } from 'react';
import './printing-module.css';
import { Toaster, toast } from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

export default function PrintingModule() {
    const [formData, setFormData] = useState({
        mfgDate: '',
        expDate: '',
        gtin: '',
        trademark: '',
        rvsp: '',
        serialNumber: '',
    });

    const [isGenerated, setIsGenerated] = useState(false);
    const [currentMessageName, setCurrentMessageName] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Validation for numeric fields
        if (['gtin', 'serialNumber'].includes(name)) {
            if (value && !/^\d*$/.test(value)) return;
        }

        if (name === 'rvsp') {
             // Allow numbers and decimals
             if (value && !/^\d*\.?\d*$/.test(value)) return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (isGenerated) setIsGenerated(false); 
    };

    const handleGenerate = async () => {
        // Basic validation
        if (!formData.mfgDate || !formData.gtin || !formData.rvsp) {
             toast.error("Please fill in all required fields");
             return;
        }

        try {
            // Prepare label data for Python script
            const labelData = {
                gtin: formData.gtin,
                mfg: formatDateForPreview(formData.mfgDate),
                exp: formatDateForPreview(formData.expDate),
                sn: formData.serialNumber,
                trademark: formData.trademark,
                rvsp: formData.rvsp
            };

            toast.loading("Creating label message...");

            // Call Python script via Electron IPC
            if (window.electron && window.electron.executePython) {
                const result = await window.electron.executePython('create', JSON.stringify(labelData));
                
                if (result.success) {
                    setCurrentMessageName(result.message_name);
                    setIsGenerated(true);
                    toast.dismiss();
                    toast.success("QR Code Generated Successfully!");
                } else {
                    toast.dismiss();
                    toast.error(`Failed to create label: ${result.error}`);
                }
            } else {
                // Fallback for development without Electron
                setIsGenerated(true);
                toast.dismiss();
                toast.success("QR Code Generated Successfully (Dev Mode)");
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
            trademark: '',
            rvsp: '',
            serialNumber: '',
        });
        setIsGenerated(false);
        setCurrentMessageName('');
    };  

    const handlePrint = async () => {
        if (!isGenerated) {
            toast.error("Please generate a QR code first");
            return;
        }

        try {
            toast.loading("Starting print job...");
            
            // Call Python script to start printing
            if (window.electron && window.electron.executePython && currentMessageName) {
                const result = await window.electron.executePython('print', currentMessageName);
                
                if (result.success) {
                    toast.dismiss();
                    toast.success("Print job started successfully!");
                } else {
                    toast.dismiss();
                    toast.error(`Print failed: ${result.error}`);
                }
            } else {
                // Fallback for development
                toast.dismiss();
                toast.success("Print initiated (Dev Mode)");
            }
        } catch (error) {
            toast.dismiss();
            toast.error(`Print error: ${error.message}`);
            console.error('Print error:', error);
        }
    };

    // Helper to format date for preview (MMDDYY)
    const formatDateForPreview = (dateString) => {
        if (!dateString) return '______';
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${month}${day}${year.slice(-2)}`;
    };

    // Generate QR Content String
    const qrValue = JSON.stringify({
        gtin: formData.gtin,
        mfg: formatDateForPreview(formData.mfgDate),
        exp: formatDateForPreview(formData.expDate),
        sn: formData.serialNumber,
        trademark: formData.trademark,
        rvsp: formData.rvsp
    });

    return (
        <div className="printing-module-wrapper">
             <div className="page-header">
                <h1>Printing Module</h1>
                <p className="subtitle">Generate QR codes and print product labels</p>
            </div>

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
                        <label>Trademark <span className="required">*</span></label>
                        <input 
                            type="text" 
                            name="trademark" 
                            value={formData.trademark} 
                            onChange={handleChange}
                            placeholder="Brand Name"
                        />
                        <span className="help-text">Company or product brand name</span>
                    </div>

                    <div className="form-group">
                        <label>RVSP (Retail Value Selling Price) <span className="required">*</span></label>
                        <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input 
                                type="text" 
                                name="rvsp" 
                                value={formData.rvsp} 
                                onChange={handleChange} 
                                placeholder="0.00"
                            />
                        </div>
                        <span className="help-text">Product retail price</span>
                    </div>

                    <div className="form-group">
                        <label>Serial Number <span className="required">*</span></label>
                        <input 
                            type="text" 
                            name="serialNumber" 
                            value={formData.serialNumber} 
                            onChange={handleChange}
                            placeholder="1234567890"
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
                                    <QRCodeCanvas value={qrValue} size={130} />
                                </div>
                                <div className="details-section">
                                    <div className="detail-row"><strong>GTIN:</strong> <span>{formData.gtin}</span></div>
                                    <div className="detail-row"><strong>MFG:</strong> <span>{formatDateForPreview(formData.mfgDate)}</span></div>
                                    <div className="detail-row"><strong>EXP:</strong> <span>{formatDateForPreview(formData.expDate)}</span></div>
                                    <div className="detail-row"><strong>SN:</strong> <span>{formData.serialNumber}</span></div>
                                    <div className="detail-row"><strong>TRADEMARK:</strong> <span>{formData.trademark}</span></div>
                                    <div className="detail-row"><strong>RVSP:</strong> <span>${formData.rvsp}</span></div>
                                </div>
                            </div>
                            <div className="success-message">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Ready for printing
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
