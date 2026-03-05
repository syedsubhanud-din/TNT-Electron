import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import './canva-print-module.css';

// ─────────────────────────────────────────────────────────────────────────────
const CM_TO_PX = 37.7953;
let _id = 0;
const genId = () => `el_${++_id}`;

// SVG Icon Wrapper
const S = ({ children, ...p }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
);

// Icons
const IcoNew = () => (
  <S>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </S>
);
const IcoOpen = () => (
  <S>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </S>
);
const IcoSave = () => (
  <S>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </S>
);
const IcoSaveAs = () => (
  <S>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <line x1="20" y1="10" x2="24" y2="10" />
    <line x1="22" y1="8" x2="22" y2="12" />
  </S>
);
const IcoDelete = ({ size = 17 }) => (
  <S width={size} height={size}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M9 6V4h6v2" />
  </S>
);
const IcoCut = () => (
  <S>
    <circle cx="6" cy="20" r="2" />
    <circle cx="6" cy="4" r="2" />
    <line x1="6" y1="6" x2="6" y2="18" />
    <path d="M20 4L8.12 15.88" />
    <path d="M14.47 14.48L20 20" />
    <path d="M8.12 8.12L12 12" />
  </S>
);
const IcoCopy = ({ size = 17 }) => (
  <S width={size} height={size}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </S>
);
const IcoPaste = () => (
  <S>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
  </S>
);
const IcoRect = () => (
  <S>
    <rect x="3" y="5" width="18" height="14" rx="1" />
  </S>
);
const IcoEllipse = () => (
  <S>
    <ellipse cx="12" cy="12" rx="10" ry="6" />
  </S>
);
const IcoShape = () => (
  <S>
    <polygon points="12 2 22 19 2 19" />
  </S>
);
const IcoText = () => (
  <S>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </S>
);
const IcoLine = () => (
  <S strokeWidth="2.5">
    <line x1="3" y1="21" x2="21" y2="3" />
  </S>
);
const IcoBarcode = () => (
  <S>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <path d="M15 15h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM19 15h2v2h-2z" />
  </S>
);
const IcoClock = () => (
  <S>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </S>
);
const IcoImage = () => (
  <S>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </S>
);
const IcoTable = () => (
  <S>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </S>
);
const IcoX = () => (
  <S>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);
const IcoPlus = () => (
  <S>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </S>
);
const IcoMinus = () => (
  <S>
    <line x1="5" y1="12" x2="19" y2="12" />
  </S>
);
const IcoPrint = () => (
  <S>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </S>
);
const IcoStop = () => (
  <S>
    <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
  </S>
);
const IcoPlay = () => (
  <S>
    <polygon points="6 3 20 12 6 21" fill="currentColor" />
  </S>
);
const IcoEye = () => (
  <S>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);
const IcoSettings = () => (
  <S>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </S>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────────────────────────
const TOOLBAR_GROUPS = [
  {
    label: 'File',
    tools: [
      { id: 'new', Icon: IcoNew, tip: 'New Canvas' },
      { id: 'open', Icon: IcoOpen, tip: 'Open (.json)' },
      { id: 'save', Icon: IcoSave, tip: 'Save' },
      { id: 'saveas', Icon: IcoSaveAs, tip: 'Save As…' },
      { id: 'settings', Icon: IcoSettings, tip: 'Printer Settings' },
      { id: 'delete', Icon: IcoDelete, tip: 'Delete Selected (Del)' },
    ],
  },
  {
    label: 'Printer Control',
    tools: [
      {
        id: 'senddata',
        Icon: IcoPrint,
        tip: 'Send data to Printer (Create Message)',
      },
      { id: 'runprinter', Icon: IcoPlay, tip: 'Run Printer' },
      { id: 'stopprinter', Icon: IcoStop, tip: 'Stop Printer' },
      { id: 'viewdata', Icon: IcoEye, tip: 'View Raw JSON Data' },
    ],
  },
  {
    label: 'Clipboard',
    tools: [
      { id: 'cut', Icon: IcoCut, tip: 'Cut (Ctrl+X)' },
      { id: 'copy', Icon: IcoCopy, tip: 'Copy (Ctrl+C)' },
      { id: 'paste', Icon: IcoPaste, tip: 'Paste (Ctrl+V)' },
    ],
  },
  {
    label: 'Drawing tools',
    tools: [
      { id: 'rect', Icon: IcoRect, tip: 'Rectangle' },
      { id: 'ellipse', Icon: IcoEllipse, tip: 'Ellipse' },
      { id: 'shape', Icon: IcoShape, tip: 'Polygon' },
      { id: 'text', Icon: IcoText, tip: 'Text Box' },
      { id: 'line', Icon: IcoLine, tip: 'Line' },
      { id: 'barcode', Icon: IcoBarcode, tip: 'QR / Barcode' },
      { id: 'clock', Icon: IcoClock, tip: 'Live Clock' },
      { id: 'image', Icon: IcoImage, tip: 'Image' },
      { id: 'table', Icon: IcoTable, tip: 'Table' },
    ],
  },
];

const DRAW_TOOLS = [
  'rect',
  'ellipse',
  'shape',
  'text',
  'line',
  'barcode',
  'clock',
  'table',
  'image',
];

// ─────────────────────────────────────────────────────────────────────────────
// Element factory
// ─────────────────────────────────────────────────────────────────────────────
function createElement(type, xCm, yCm) {
  const base = { id: genId(), type, x: xCm, y: yCm, isNew: true };
  switch (type) {
    case 'rect':
      return {
        ...base,
        w: 3,
        h: 1.5,
        fill: 'transparent',
        stroke: '#0d1b42',
        strokeW: 1.5,
      };
    case 'ellipse':
      return {
        ...base,
        w: 3,
        h: 1.5,
        fill: 'transparent',
        stroke: '#0d1b42',
        strokeW: 1.5,
      };
    case 'shape':
      return {
        ...base,
        w: 2.5,
        h: 2.5,
        fill: 'transparent',
        stroke: '#0d1b42',
        strokeW: 1.5,
      };
    case 'text':
      return {
        ...base,
        w: 4,
        h: 0.4,
        content: 'New Text',
        fontSize: 11,
        bold: false,
        color: '#111111',
      };
    case 'line':
      return { ...base, w: 4, h: 0.1, stroke: '#0d1b42', strokeW: 1.5 };
    case 'barcode':
      return { ...base, w: 1.1, h: 1.1, qrText: '', sourceElementIds: [] };
    case 'clock':
      return { ...base, w: 4.5, h: 0.4, fontSize: 10, color: '#111111' };
    case 'table':
      return { ...base, w: 5, h: 2.5, rows: 3, cols: 3, cellData: {} };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function CanvaPrintModule() {
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [clipboard, setClipboard] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(4);
  const [canvasSize, setCanvasSize] = useState({ w: 10, h: 300 / 190 });
  const [printerConfig, setPrinterConfig] = useState({
    printer_ip: '192.168.1.22',
    printer_port: 9944,
  });

  // modal states
  const [modal, setModal] = useState(null); // 'new' | 'saveas' | 'editqr' | 'settings' | 'viewdata'
  const [saveAsName, setSaveAsName] = useState('MyLabel');
  const [editQrText, setEditQrText] = useState('');
  const [qrSelectedSources, setQrSelectedSources] = useState([]);
  const [lastMessageName, setLastMessageName] = useState(null);
  const [printerDataPreview, setPrinterDataPreview] = useState(null);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);

  const selEl = elements.find((e) => e.id === selectedId) || null;
  const toCm = useCallback((pxv) => pxv / (CM_TO_PX * zoom), [zoom]);
  const px = useCallback((cm) => cm * CM_TO_PX * zoom, [zoom]);

  // Derived helper: get QR value for an element
  const getQrFinalValue = useCallback(
    (el) => {
      if (el.type !== 'barcode') return '';
      if (el.sourceElementIds && el.sourceElementIds.length > 0) {
        const prefixes = ['01', '10', '17'];
        return el.sourceElementIds
          .map((id, index) => {
            const src = elements.find((e) => e.id === id);
            if (!src) return '';
            let value = '';
            if (src.type === 'clock') {
              value = new Date().toLocaleTimeString();
            } else {
              value = src.content || '';
            }
            // Remove label prefix before colon (e.g. "GTIN:08964001713210" -> "08964001713210")
            if (value.includes(':')) {
              value = value.split(':').slice(1).join(':');
            }
            // Remove dashes
            value = value.replace(/-/g, '');
            // Add prefix based on selection order
            const prefix = prefixes[index] || '';
            return prefix + value;
          })
          .filter((t) => t.length > 0)
          .join('');
      }
      return el.qrText || '';
    },
    [elements],
  );

  useEffect(() => {
    const hasNew = elements.some((e) => e.isNew);
    if (!hasNew) return;
    const t = setTimeout(() => {
      setElements((prev) =>
        prev.map((e) => (e.isNew ? { ...e, isNew: false } : e)),
      );
    }, 350);
    return () => clearTimeout(t);
  }, [elements]);

  useEffect(() => {
    const loadConfig = async () => {
      if (window.electron && window.electron.getPrinterConfig) {
        const config = await window.electron.getPrinterConfig();
        setPrinterConfig(config);
      }
    };
    loadConfig();
  }, []);

  // Listener for re-opening QR content modal from PropsPanel
  useEffect(() => {
    const onTrigger = (e) => {
      const el = e.detail;
      if (el && el.type === 'barcode') {
        setEditQrText(el.qrText || '');
        setQrSelectedSources(el.sourceElementIds || []);
        setModal('editqr');
      }
    };
    window.addEventListener('cpm-edit-qr', onTrigger);
    return () => window.removeEventListener('cpm-edit-qr', onTrigger);
  }, []);

  // File Operations
  const doNew = () => setModal('new');
  const confirmNew = () => {
    setElements([]);
    setSelectedId(null);
    setClipboard(null);
    setEditingId(null);
    setActiveTool('select');
    setModal(null);
  };
  const doSave = useCallback(
    (name = 'Label') => {
      const blob = new Blob(
        [JSON.stringify({ elements, canvasSize }, null, 2)],
        { type: 'application/json' },
      );
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `${name}.cpm.json`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [elements, canvasSize],
  );
  const doSaveAs = () => {
    setSaveAsName('MyLabel');
    setModal('saveas');
  };
  const confirmSaveAs = () => {
    doSave(saveAsName || 'Label');
    setModal(null);
  };
  const doOpen = () => fileInputRef.current?.click();
  const onFileLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.elements) {
          setElements(data.elements);
          if (data.canvasSize) setCanvasSize(data.canvasSize);
          setSelectedId(null);
        }
      } catch {
        alert('Invalid label file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Element Operations
  const doDelete = useCallback(() => {
    if (!selectedId) return;
    setElements((p) => p.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);
  const doCopy = useCallback(() => {
    const el = elements.find((e) => e.id === selectedId);
    if (el) setClipboard({ ...el });
  }, [elements, selectedId]);
  const doCut = useCallback(() => {
    doCopy();
    doDelete();
  }, [doCopy, doDelete]);
  const doPaste = useCallback(() => {
    if (!clipboard) return;
    const el = {
      ...clipboard,
      id: genId(),
      x: (clipboard.x || 0) + 0.4,
      y: (clipboard.y || 0) + 0.4,
      isNew: true,
    };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
  }, [clipboard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (editingId) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        doDelete();
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        doCopy();
      }
      if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        doCut();
      }
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        doPaste();
      }
      if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    editingId,
    selectedId,
    clipboard,
    elements,
    doDelete,
    doCopy,
    doCut,
    doPaste,
  ]);

  // Build the payload that will be sent to the printer (reusable)
  const buildPrinterPayload = useCallback(() => {
    return JSON.stringify({
      elements,
      canvasSize: { w: canvasSize.w, h: canvasSize.h },
    });
  }, [elements, canvasSize]);

  const handleSendData = async () => {
    if (elements.length === 0) {
      toast.error('Canvas is empty');
      return;
    }

    const loadingToast = toast.loading('Sending message to printer...');
    try {
      const payload = buildPrinterPayload();
      const args = [
        '--payload',
        payload,
        '--ip',
        printerConfig.printer_ip,
        '--port',
        printerConfig.printer_port.toString(),
        // '--print', <-- Removed so it only creates the message
      ];

      if (window.electron && window.electron.runPython) {
        const output = await window.electron.runPython(
          'create_message/create_dynamic_label.py',
          args,
        );
        console.log('Printer Output:', output);

        // Check for specific error messages
        // Extract message name from output for Run Printer later
        const msgNameMatch = output.match(/Message '([^']+)' created/);
        if (msgNameMatch) {
          setLastMessageName(msgNameMatch[1]);
        }

        if (output.includes('[ERROR]')) {
          // Extract error message (first line after [ERROR])
          const errorMatch = output.match(/\[ERROR\]([^\n]+)/);
          const errorMsg = errorMatch
            ? errorMatch[1].trim()
            : 'Connection failed. Check printer settings.';

          toast.success(`Printer Error: ${errorMsg}`, {
            id: loadingToast,
            duration: 5000,
          });
        } else if (output.includes('[OK]')) {
          toast.success('Message created on printer!', { id: loadingToast });
        } else {
          // Show full output for debugging
          const errorPreview =
            output.length > 150 ? output.slice(0, 150) + '...' : output;
          toast.error(`Printer response: ${errorPreview}`, {
            id: loadingToast,
            duration: 5000,
          });
        }
      } else {
        toast.success('Sent to printer (Dev Mode)', { id: loadingToast });
      }
    } catch (error) {
      const errorMsg = error.message || 'Unknown error occurred';
      toast.error(`Error: ${errorMsg}`, {
        id: loadingToast,
        duration: 5000,
      });
      console.error('Send error:', error);
    }
  };

  // ── Printer Control Handlers ──────────────────────────────────
  const handleRunPrinter = async () => {
    if (!lastMessageName) {
      toast.error('No message sent yet. Send to printer first.');
      return;
    }
    const loadingToast = toast.loading('Starting printer...');
    try {
      const args = ['print', 'start', lastMessageName];
      if (window.electron && window.electron.runPython) {
        const output = await window.electron.runPython(
          'create_message/run_command.py',
          args,
        );
        console.log('Run Printer Output:', output);
        try {
          const response = JSON.parse(output);
          if (response.status === 'ok') {
            toast.success('Printer started!', { id: loadingToast });
          } else if (response.descript === 'print engine is running') {
            toast.error('Printer is already running', { id: loadingToast });
          } else {
            toast.error(`Run failed: ${response.descript || 'Unknown error'}`, {
              id: loadingToast,
            });
          }
        } catch {
          if (output.toLowerCase().includes('ok')) {
            toast.success('Printer started!', { id: loadingToast });
          } else {
            toast.error(`Run failed: ${output.slice(0, 100)}`, {
              id: loadingToast,
            });
          }
        }
      } else {
        toast.success('Printer started (Dev Mode)', { id: loadingToast });
      }
    } catch (error) {
      toast.error(`Run error: ${error.message}`, { id: loadingToast });
      console.error('Run printer error:', error);
    }
  };

  const handleStopPrinter = async () => {
    const loadingToast = toast.loading('Stopping printer...');
    try {
      const args = ['print', 'stop'];
      if (window.electron && window.electron.runPython) {
        const output = await window.electron.runPython(
          'create_message/run_command.py',
          args,
        );
        console.log('Stop Printer Output:', output);
        try {
          const response = JSON.parse(output);
          if (response.status === 'ok') {
            toast.success('Printer stopped!', { id: loadingToast });
          } else {
            toast.error(
              `Stop failed: ${response.descript || 'Unknown error'}`,
              { id: loadingToast },
            );
          }
        } catch {
          toast.success('Stop command sent', { id: loadingToast });
        }
      } else {
        toast.success('Printer stopped (Dev Mode)', { id: loadingToast });
      }
    } catch (error) {
      toast.error(`Stop error: ${error.message}`, { id: loadingToast });
      console.error('Stop printer error:', error);
    }
  };

  const handleViewData = () => {
    if (elements.length === 0) {
      toast.error('Canvas is empty — nothing to preview');
      return;
    }
    const payload = buildPrinterPayload();
    setPrinterDataPreview(JSON.stringify(JSON.parse(payload), null, 2));
    setModal('viewdata');
  };

  const updateEl = useCallback((id, patch) => {
    setElements((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  // Mouse Handlers
  const getCanvasCm = useCallback(
    (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: toCm(e.clientX - rect.left), y: toCm(e.clientY - rect.top) };
    },
    [toCm],
  );
  const handleCanvasMouseMove = useCallback(
    (e) => {
      const pos = getCanvasCm(e);
      setMousePos({
        x: parseFloat(pos.x.toFixed(2)),
        y: parseFloat(pos.y.toFixed(2)),
      });
      if (isDragging && selectedId) {
        const dx = toCm(e.clientX - dragStart.x);
        const dy = toCm(e.clientY - dragStart.y);
        setElements((p) =>
          p.map((el) => {
            if (el.id !== selectedId) return el;

            // Constrain new position within [0, canvasSize - elementSize]
            let newX = el.x + dx;
            let newY = el.y + dy;

            newX = Math.max(0, Math.min(newX, canvasSize.w - el.w));
            newY = Math.max(0, Math.min(newY, canvasSize.h - el.h));

            return {
              ...el,
              x: parseFloat(newX.toFixed(3)),
              y: parseFloat(newY.toFixed(3)),
            };
          }),
        );
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing && selectedId) {
        const dx = toCm(e.clientX - dragStart.x);
        const dy = toCm(e.clientY - dragStart.y);

        setElements((p) =>
          p.map((el) => {
            if (el.id !== selectedId) return el;
            let { x, y, w, h } = el;
            const minSize = 0.1;

            switch (resizeHandle) {
              case 'se':
                w = Math.max(minSize, Math.min(w + dx, canvasSize.w - x));
                h = Math.max(minSize, Math.min(h + dy, canvasSize.h - y));
                break;
              case 'sw':
                const maxW_sw = x + w;
                w = Math.max(minSize, Math.min(w - dx, maxW_sw));
                if (w !== minSize && w !== maxW_sw) x += dx;
                else if (w === maxW_sw) x = 0;
                h = Math.max(minSize, Math.min(h + dy, canvasSize.h - y));
                break;
              case 'ne':
                w = Math.max(minSize, Math.min(w + dx, canvasSize.w - x));
                const maxH_ne = y + h;
                h = Math.max(minSize, Math.min(h - dy, maxH_ne));
                if (h !== minSize && h !== maxH_ne) y += dy;
                else if (h === maxH_ne) y = 0;
                break;
              case 'nw':
                const maxW_nw = x + w;
                const maxH_nw = y + h;
                w = Math.max(minSize, Math.min(w - dx, maxW_nw));
                h = Math.max(minSize, Math.min(h - dy, maxH_nw));
                if (w !== minSize && w !== maxW_nw) x += dx;
                else if (w === maxW_nw) x = 0;
                if (h !== minSize && h !== maxH_nw) y += dy;
                else if (h === maxH_nw) y = 0;
                break;
              default:
                break;
            }

            return {
              ...el,
              x: parseFloat(x.toFixed(3)),
              y: parseFloat(y.toFixed(3)),
              w: parseFloat(w.toFixed(3)),
              h: parseFloat(h.toFixed(3)),
            };
          }),
        );
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [
      isDragging,
      isResizing,
      resizeHandle,
      selectedId,
      dragStart,
      toCm,
      getCanvasCm,
    ],
  );
  const handleCanvasClick = useCallback(
    (e) => {
      if (e.target !== canvasRef.current) return;
      if (activeTool === 'image') {
        imgInputRef.current?.click();
        return;
      }
      if (DRAW_TOOLS.includes(activeTool)) {
        const { x, y } = getCanvasCm(e);
        const el = createElement(
          activeTool,
          Math.max(0, parseFloat(x.toFixed(3))),
          Math.max(0, parseFloat(y.toFixed(3))),
        );
        if (el) {
          setElements((p) => [...p, el]);
          setSelectedId(el.id);
          if (activeTool === 'barcode') {
            setEditQrText('');
            setQrSelectedSources([]);
            setModal('editqr');
          }
          setActiveTool('select');
        }
      } else {
        setSelectedId(null);
      }
    },
    [activeTool, getCanvasCm],
  );
  const handleElMouseDown = useCallback(
    (e, id) => {
      if (DRAW_TOOLS.includes(activeTool) && activeTool !== 'image') return;
      e.stopPropagation();
      setSelectedId(id);
      setIsDragging(true);
      setIsResizing(false);
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [activeTool],
  );
  const handleResizeDown = useCallback((e, id, handle) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setIsResizing(true);
    setIsDragging(false);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };
  const handleElDblClick = useCallback((e, el) => {
    e.stopPropagation();
    if (el.type === 'text') {
      setEditingId(el.id);
      return;
    }
    if (el.type === 'barcode') {
      setEditQrText(el.qrText || '');
      setQrSelectedSources(el.sourceElementIds || []);
      setModal('editqr');
    }
  }, []);
  const handleTextBlur = useCallback(
    (e, id) => {
      updateEl(id, { content: e.currentTarget.innerText.trim() || 'Text' });
      setEditingId(null);
    },
    [updateEl],
  );

  const onImgPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const el = {
      id: genId(),
      type: 'image',
      x: 0.5,
      y: 0.5,
      w: 4,
      h: 3,
      src: URL.createObjectURL(file),
      isNew: true,
    };
    setElements((p) => [...p, el]);
    setSelectedId(el.id);
    setActiveTool('select');
    e.target.value = '';
  };

  const handleTool = (id) => {
    switch (id) {
      case 'new':
        doNew();
        break;
      case 'open':
        doOpen();
        break;
      case 'save':
        doSave();
        break;
      case 'saveas':
        doSaveAs();
        break;
      case 'delete':
        doDelete();
        break;
      case 'cut':
        doCut();
        break;
      case 'copy':
        doCopy();
        break;
      case 'paste':
        doPaste();
        break;
      case 'print':
        handlePrint();
        break;
      case 'senddata':
        handleSendData();
        break;
      case 'runprinter':
        handleRunPrinter();
        break;
      case 'stopprinter':
        handleStopPrinter();
        break;
      case 'viewdata':
        handleViewData();
        break;
      case 'settings':
        setModal('settings');
        break;
      default:
        setActiveTool((p) => (p === id ? 'select' : id));
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 12));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  const isDrawMode = DRAW_TOOLS.includes(activeTool);
  const canvasCursor = isDrawMode
    ? 'crosshair'
    : isDragging
      ? 'grabbing'
      : 'default';

  return (
    <div className="cpm-root">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        hidden
        onChange={onFileLoad}
      />
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onImgPick}
      />

      <div className="cpm-toolbar">
        {TOOLBAR_GROUPS.map((grp, gi) => (
          <React.Fragment key={gi}>
            <div className="cpm-tool-group">
              {grp.tools.map(({ id, Icon, tip }) => {
                const disabled =
                  (['delete', 'cut', 'copy'].includes(id) && !selectedId) ||
                  (id === 'paste' && !clipboard);
                const drawActive = activeTool === id && DRAW_TOOLS.includes(id);
                return (
                  <button
                    key={id}
                    title={tip}
                    disabled={disabled}
                    className={`cpm-tool-btn${drawActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                    onClick={() => handleTool(id)}
                  >
                    <Icon />
                  </button>
                );
              })}
            </div>
            {gi < TOOLBAR_GROUPS.length - 1 && (
              <div className="cpm-toolbar-sep" />
            )}
          </React.Fragment>
        ))}
        {isDrawMode && (
          <div className="cpm-draw-badge">
            <span className="cpm-draw-dot" />
            {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} — click
            on canvas
            <button
              className="cpm-badge-dismiss"
              onClick={() => setActiveTool('select')}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="cpm-toolbar-labels">
        <span style={{ width: 224 }}>File</span>
        <span className="cpm-tl-sep" />
        <span style={{ width: 104 }}>Printer Control</span>
        <span className="cpm-tl-sep" />
        <span style={{ width: 104 }}>Clipboard</span>
        <span className="cpm-tl-sep" />
        <span>Drawing tools</span>
      </div>

      <div
        className="cpm-body"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="cpm-canvas-area">
          <div style={{ display: 'flex' }}>
            <div className="cpm-corner" />
            <HRuler zoom={zoom} w={canvasSize.w} />
          </div>
          <div className="cpm-canvas-row">
            <VRuler zoom={zoom} h={canvasSize.h} />
            <div
              ref={canvasRef}
              className="cpm-canvas"
              style={{
                width: px(canvasSize.w),
                height: px(canvasSize.h),
                cursor: canvasCursor,
              }}
              onClick={handleCanvasClick}
            >
              <Grid zoom={zoom} w={canvasSize.w} h={canvasSize.h} />
              {elements.length === 0 && (
                <div className="cpm-empty-hint">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c0c8d8"
                    strokeWidth="1.2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <p>
                    Select a drawing tool from the toolbar
                    <br />
                    and click here to add elements
                  </p>
                </div>
              )}
              {elements.map((el) => (
                <CanvasEl
                  key={el.id}
                  el={el}
                  zoom={zoom}
                  isSelected={selectedId === el.id}
                  isEditing={editingId === el.id}
                  onMouseDown={(e) => handleElMouseDown(e, el.id)}
                  onResizeDown={(e, handle) =>
                    handleResizeDown(e, el.id, handle)
                  }
                  onDblClick={(e) => handleElDblClick(e, el)}
                  onTextBlur={(e) => handleTextBlur(e, el.id)}
                  qrValue={getQrFinalValue(el)}
                />
              ))}
            </div>
          </div>
        </div>
        {selEl && (
          <PropsPanel
            el={selEl}
            onChange={(patch) => updateEl(selEl.id, patch)}
            onDelete={doDelete}
            onDuplicate={() => {
              const dup = {
                ...selEl,
                id: genId(),
                x: selEl.x + 0.4,
                y: selEl.y + 0.4,
                isNew: true,
              };
              setElements((p) => [...p, dup]);
              setSelectedId(dup.id);
            }}
            allElements={elements}
          />
        )}
      </div>

      <div className="cpm-statusbar">
        <div className="cpm-status-fields">
          <SField label="X (cm)" value={mousePos.x.toFixed(2)} />
          <SField
            label="Y (cm)"
            value={selEl ? selEl.y.toFixed(2) : mousePos.y.toFixed(2)}
            hi={!!selEl}
          />
          <SField label="W (cm)" value={selEl ? selEl.w.toFixed(2) : '—'} />
          <SField label="H (cm)" value={selEl ? selEl.h.toFixed(2) : '—'} />
          <SField label="Angle" value="0°" />
          {elements.length > 0 && (
            <span className="cpm-el-count">
              {elements.length} element{elements.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="cpm-zoom-row">
          <button
            className="cpm-zoom-btn"
            onClick={zoomOut}
            title="Zoom Out (−)"
          >
            <IcoMinus />
          </button>
          <span className="cpm-zoom-val">{Math.round(zoom * 100)}%</span>
          <button className="cpm-zoom-btn" onClick={zoomIn} title="Zoom In (+)">
            <IcoPlus />
          </button>
        </div>
      </div>

      {modal === 'new' && (
        <Modal title="New Canvas" onClose={() => setModal(null)}>
          <p className="cpm-modal-text">
            Clear the canvas? All unsaved elements will be lost.
          </p>
          <div className="cpm-modal-actions">
            <button
              className="cpm-btn cpm-btn-ghost"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button className="cpm-btn cpm-btn-danger" onClick={confirmNew}>
              Clear & Start New
            </button>
          </div>
        </Modal>
      )}

      {modal === 'saveas' && (
        <Modal title="Save As…" onClose={() => setModal(null)}>
          <div className="cpm-field-row">
            <label>File name</label>
            <input
              className="cpm-input"
              value={saveAsName}
              autoFocus
              onChange={(e) => setSaveAsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSaveAs()}
            />
          </div>
          <div className="cpm-modal-actions">
            <button
              className="cpm-btn cpm-btn-ghost"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button className="cpm-btn cpm-btn-primary" onClick={confirmSaveAs}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {modal === 'editqr' && selEl?.type === 'barcode' && (
        <Modal title="Configure QR Code" onClose={() => setModal(null)}>
          <div className="cpm-modal-description">
            Select text elements to include in this QR code or enter manual
            text.
          </div>
          <div className="cpm-qr-setup">
            <div className="cpm-qr-list">
              <div className="cpm-list-header">Existing Text Elements</div>
              {elements.filter((e) => e.type === 'text').length === 0 ? (
                <div className="cpm-empty-list">
                  No text elements found on canvas.
                </div>
              ) : (
                elements
                  .filter((e) => e.type === 'text')
                  .map((te) => (
                    <label key={te.id} className="cpm-qr-item">
                      <input
                        type="checkbox"
                        checked={qrSelectedSources.includes(te.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setQrSelectedSources((p) => [...p, te.id]);
                          else
                            setQrSelectedSources((p) =>
                              p.filter((id) => id !== te.id),
                            );
                        }}
                      />
                      <span className="cpm-item-id">{te.id}</span>
                      <span className="cpm-item-text">{te.content}</span>
                    </label>
                  ))
              )}
            </div>
            <div className="cpm-field-row" style={{ marginTop: '12px' }}>
              <label>Manual Override / Default Text</label>
              <input
                className="cpm-input"
                value={editQrText}
                placeholder="Enter static text if no sources selected..."
                onChange={(e) => setEditQrText(e.target.value)}
              />
            </div>
            <div className="cpm-qr-preview">
              <label>Resulting QR Content:</label>
              <div className="cpm-preview-box">
                {qrSelectedSources.length > 0
                  ? (() => {
                      const prefixes = ['01', '10', '17'];
                      return qrSelectedSources
                        .map((id, index) => {
                          let value =
                            elements.find((e) => e.id === id)?.content || '';
                          if (value.includes(':')) {
                            value = value.split(':').slice(1).join(':');
                          }
                          value = value.replace(/-/g, '');
                          const prefix = prefixes[index] || '';
                          return prefix + value;
                        })
                        .join('');
                    })()
                  : editQrText || '(empty)'}
              </div>
            </div>
          </div>
          <div className="cpm-modal-actions">
            <button
              className="cpm-btn cpm-btn-ghost"
              onClick={() => setModal(null)}
            >
              Cancel
            </button>
            <button
              className="cpm-btn cpm-btn-primary"
              onClick={() => {
                updateEl(selEl.id, {
                  qrText: editQrText,
                  sourceElementIds: qrSelectedSources,
                });
                setModal(null);
              }}
            >
              Generate QR Code
            </button>
          </div>
        </Modal>
      )}

      {modal === 'viewdata' && printerDataPreview && (
        <Modal title="Printer Data Preview" onClose={() => setModal(null)}>
          <div className="cpm-modal-description">
            This is the exact JSON data that will be sent to the printer when
            you click &quot;Send to Printer&quot;.
          </div>
          <div className="cpm-data-preview-wrap">
            <pre className="cpm-data-preview-code">{printerDataPreview}</pre>
          </div>
          <div className="cpm-modal-actions">
            <button
              className="cpm-btn cpm-btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(printerDataPreview);
                toast.success('Copied to clipboard!');
              }}
            >
              Copy JSON
            </button>
            <button
              className="cpm-btn cpm-btn-primary"
              onClick={() => setModal(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="Printer Settings" onClose={() => setModal(null)}>
          <div className="cpm-field-row">
            <label>Printer IP</label>
            <input
              className="cpm-input"
              value={printerConfig.printer_ip}
              onChange={(e) =>
                setPrinterConfig({
                  ...printerConfig,
                  printer_ip: e.target.value,
                })
              }
            />
          </div>
          <div className="cpm-field-row">
            <label>Printer Port</label>
            <input
              type="number"
              className="cpm-input"
              value={printerConfig.printer_port}
              onChange={(e) =>
                setPrinterConfig({
                  ...printerConfig,
                  printer_port: parseInt(e.target.value) || 0,
                })
              }
            />
          </div>
          <div style={{ marginTop: '15px' }}>
            <button
              className="cpm-btn cpm-btn-ghost"
              style={{ width: '100%', marginBottom: '10px' }}
              onClick={async () => {
                const t = toast.loading('Testing connection...');
                try {
                  const res = await window.electron.invoke(
                    'test-printer-connection',
                    printerConfig,
                  );
                  if (res.success) {
                    toast.success('Connection successful!', { id: t });
                  } else {
                    toast.error(`Connection failed: ${res.error}`, { id: t });
                  }
                } catch (err) {
                  toast.error(`Error: ${err.message}`, { id: t });
                }
              }}
            >
              Test Connection
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
            Ensure your computer is on the same network as the printer.
          </p>
          <div className="cpm-modal-actions">
            <button
              className="cpm-btn cpm-btn-primary"
              onClick={async () => {
                if (window.electron && window.electron.savePrinterConfig) {
                  await window.electron.savePrinterConfig(printerConfig);
                  toast.success('Settings saved');
                }
                setModal(null);
              }}
            >
              Save & Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────
function PropsPanel({ el, onChange, onDelete, onDuplicate, allElements }) {
  return (
    <div className="cpm-props" key={el.id}>
      <div className="cpm-props-header">
        <span className="cpm-props-type">{el.type.toUpperCase()}</span>
        <div className="cpm-props-actions">
          <button
            className="cpm-props-btn"
            title="Duplicate"
            onClick={onDuplicate}
          >
            <IcoCopy size={14} />
          </button>
          <button
            className="cpm-props-btn danger"
            title="Delete"
            onClick={onDelete}
          >
            <IcoDelete size={14} />
          </button>
        </div>
      </div>
      <section className="cpm-props-section">
        <div className="cpm-props-row2">
          <PropNum
            label="X (cm)"
            value={el.x}
            onChange={(v) => onChange({ x: +v })}
            step={0.05}
          />
          <PropNum
            label="Y (cm)"
            value={el.y}
            onChange={(v) => onChange({ y: +v })}
            step={0.05}
          />
        </div>
        <div className="cpm-props-row2">
          <PropNum
            label="W (cm)"
            value={el.w}
            onChange={(v) => onChange({ w: Math.max(0.1, +v) })}
            step={0.1}
          />
          <PropNum
            label="H (cm)"
            value={el.h}
            onChange={(v) => onChange({ h: Math.max(0.1, +v) })}
            step={0.1}
          />
        </div>
      </section>

      {el.type === 'text' && (
        <section className="cpm-props-section">
          <div className="cpm-field-row">
            <label>Content</label>
            <textarea
              className="cpm-textarea"
              value={el.content}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={2}
            />
          </div>
          <div className="cpm-props-row2">
            <PropNum
              label="Font size"
              value={el.fontSize}
              onChange={(v) => onChange({ fontSize: Math.max(6, +v) })}
              step={1}
            />
            <div className="cpm-field-row">
              <label>Color</label>
              <input
                type="color"
                value={el.color || '#111111'}
                className="cpm-color"
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </div>
          </div>
          <label className="cpm-checkbox-row">
            <input
              type="checkbox"
              checked={!!el.bold}
              onChange={(e) => onChange({ bold: e.target.checked })}
            />
            Bold
          </label>
        </section>
      )}

      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'shape') && (
        <section className="cpm-props-section">
          <div className="cpm-props-row2">
            <div className="cpm-field-row">
              <label>Fill</label>
              <input
                type="color"
                value={
                  el.fill === 'transparent' ? '#ffffff' : el.fill || '#ffffff'
                }
                className="cpm-color"
                onChange={(e) => onChange({ fill: e.target.value })}
              />
            </div>
            <div className="cpm-field-row">
              <label>Stroke</label>
              <input
                type="color"
                value={el.stroke || '#0d1b42'}
                className="cpm-color"
                onChange={(e) => onChange({ stroke: e.target.value })}
              />
            </div>
          </div>
          <PropNum
            label="Stroke width"
            value={el.strokeW || 1.5}
            onChange={(v) => onChange({ strokeW: Math.max(0.5, +v) })}
            step={0.5}
          />
          <label className="cpm-checkbox-row">
            <input
              type="checkbox"
              checked={el.fill === 'transparent'}
              onChange={(e) =>
                onChange({ fill: e.target.checked ? 'transparent' : '#ffffff' })
              }
            />
            Transparent fill
          </label>
        </section>
      )}

      {el.type === 'line' && (
        <section className="cpm-props-section">
          <div className="cpm-props-row2">
            <div className="cpm-field-row">
              <label>Color</label>
              <input
                type="color"
                value={el.stroke || '#0d1b42'}
                className="cpm-color"
                onChange={(e) => onChange({ stroke: e.target.value })}
              />
            </div>
            <PropNum
              label="Thickness"
              value={el.strokeW || 1.5}
              onChange={(v) => onChange({ strokeW: +v })}
              step={0.5}
            />
          </div>
        </section>
      )}

      {el.type === 'barcode' && (
        <section className="cpm-props-section">
          <div className="cpm-field-row">
            <label>Bound Sources</label>
            <div className="cpm-tag-list">
              {el.sourceElementIds?.length > 0 ? (
                el.sourceElementIds.map((id) => (
                  <span key={id} className="cpm-tag">
                    {id}
                  </span>
                ))
              ) : (
                <span className="cpm-tag-empty">None</span>
              )}
            </div>
          </div>
          <button
            className="cpm-btn cpm-btn-ghost sm"
            onClick={() => {
              // Re-open configuring modal for this QR
              window.dispatchEvent(
                new CustomEvent('cpm-edit-qr', { detail: el }),
              );
            }}
          >
            Re-configure QR Logic
          </button>
        </section>
      )}

      {el.type === 'clock' && (
        <section className="cpm-props-section">
          <PropNum
            label="Font size"
            value={el.fontSize || 10}
            onChange={(v) => onChange({ fontSize: +v })}
            step={1}
          />
          <div className="cpm-field-row">
            <label>Color</label>
            <input
              type="color"
              value={el.color || '#111111'}
              className="cpm-color"
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function PropNum({ label, value, onChange, step = 1 }) {
  return (
    <div className="cpm-field-row">
      <label>{label}</label>
      <input
        type="number"
        className="cpm-input sm"
        value={Number(value).toFixed(step < 1 ? 2 : 0)}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="cpm-overlay" onClick={onClose}>
      <div className="cpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cpm-modal-top">
          <span>{title}</span>
          <button className="cpm-modal-x" onClick={onClose}>
            <IcoX />
          </button>
        </div>
        <div className="cpm-modal-body">{children}</div>
      </div>
    </div>
  );
}

function SField({ label, value, hi }) {
  return (
    <div className="cpm-sf">
      <span className="cpm-sf-label">{label}</span>
      <span className={`cpm-sf-val${hi ? ' hi' : ''}`}>{value}</span>
    </div>
  );
}

function CanvasEl({
  el,
  zoom,
  isSelected,
  isEditing,
  isResizing,
  onMouseDown,
  onResizeDown,
  onDblClick,
  onTextBlur,
  qrValue,
}) {
  const CP = CM_TO_PX * zoom;
  const outer = {
    position: 'absolute',
    left: el.x * CP,
    top: el.y * CP,
    width: el.w * CP,
    height: el.h * CP,
    cursor: isResizing ? 'grabbing' : isSelected ? 'grab' : 'default',
    boxSizing: 'border-box',
    userSelect: 'none',
  };

  return (
    <div
      className={`cpm-el${isSelected ? ' selected' : ''}${el.isNew ? ' entering' : ''}`}
      style={outer}
      onMouseDown={onMouseDown}
      onDoubleClick={onDblClick}
    >
      {el.type === 'barcode' && (
        <QRCodeCanvas
          value={qrValue || ' '}
          size={Math.round(el.w * CP)}
          style={{ width: '100%', height: '100%' }}
        />
      )}
      {el.type === 'text' &&
        (isEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            autoFocus
            onBlur={onTextBlur}
            style={{
              fontSize: `${el.fontSize * zoom}px`,
              fontWeight: el.bold ? 700 : 400,
              color: el.color,
              fontFamily: 'monospace',
              width: '100%',
              height: '100%',
              outline: '2px solid #00bcd4',
              background: '#fff',
            }}
          >
            {el.content}
          </div>
        ) : (
          <div
            style={{
              fontSize: `${el.fontSize * zoom}px`,
              fontWeight: el.bold ? 700 : 400,
              color: el.color,
              fontFamily: 'monospace',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {el.content}
          </div>
        ))}
      {el.type === 'rect' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: `${(el.strokeW * zoom) / 4}px solid ${el.stroke}`,
            background: el.fill,
          }}
        />
      )}
      {el.type === 'ellipse' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: `${(el.strokeW * zoom) / 4}px solid ${el.stroke}`,
            background: el.fill,
            borderRadius: '50%',
          }}
        />
      )}
      {el.type === 'image' && (
        <img
          src={el.src}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          alt=""
        />
      )}
      {el.type === 'clock' && (
        <ClockEl fontSize={el.fontSize} zoom={zoom} color={el.color} />
      )}
      {isSelected && (
        <>
          <span
            className="cpm-handle nw"
            onMouseDown={(e) => onResizeDown(e, 'nw')}
            style={{ top: -4, left: -4, cursor: 'nw-resize' }}
          />
          <span
            className="cpm-handle ne"
            onMouseDown={(e) => onResizeDown(e, 'ne')}
            style={{ top: -4, right: -4, cursor: 'ne-resize' }}
          />
          <span
            className="cpm-handle sw"
            onMouseDown={(e) => onResizeDown(e, 'sw')}
            style={{ bottom: -4, left: -4, cursor: 'sw-resize' }}
          />
          <span
            className="cpm-handle se"
            onMouseDown={(e) => onResizeDown(e, 'se')}
            style={{ bottom: -4, right: -4, cursor: 'se-resize' }}
          />
        </>
      )}
    </div>
  );
}

function ClockEl({ fontSize, zoom, color }) {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div
      style={{
        fontSize: `${fontSize * zoom}px`,
        color,
        fontFamily: 'monospace',
      }}
    >
      {t.toLocaleTimeString()}
    </div>
  );
}

function HRuler({ zoom, w }) {
  const tick = CM_TO_PX * zoom;
  return (
    <svg className="cpm-ruler-h" width={w * tick} height={20}>
      {Array.from({ length: w + 1 }, (_, i) => (
        <React.Fragment key={i}>
          <line x1={i * tick} y1={0} x2={i * tick} y2={14} stroke="#aaa" />
          <text x={i * tick + 2} y={11} fontSize="8" fill="#999">
            {i}
          </text>
        </React.Fragment>
      ))}
    </svg>
  );
}
function VRuler({ zoom, h }) {
  const tick = CM_TO_PX * zoom;
  return (
    <svg className="cpm-ruler-v" width={20} height={h * tick}>
      {Array.from({ length: h + 1 }, (_, i) => (
        <React.Fragment key={i}>
          <line x1={0} y1={i * tick} x2={14} y2={i * tick} stroke="#aaa" />
          <text
            x={9}
            y={i * tick + 10}
            fontSize="8"
            fill="#999"
            transform={`rotate(-90,9,${i * tick + 10})`}
            textAnchor="middle"
          >
            {i}
          </text>
        </React.Fragment>
      ))}
    </svg>
  );
}
function Grid({ zoom, w, h }) {
  const cell = CM_TO_PX * zoom;
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      width={w * cell}
      height={h * cell}
    >
      {Array.from({ length: w - 1 }, (_, i) => (
        <line
          key={i}
          x1={(i + 1) * cell}
          y1={0}
          x2={(i + 1) * cell}
          y2={h * cell}
          stroke="#eee"
        />
      ))}
      {Array.from({ length: h - 1 }, (_, i) => (
        <line
          key={i}
          x1={0}
          y1={(i + 1) * cell}
          x2={w * cell}
          y2={(i + 1) * cell}
          stroke="#eee"
        />
      ))}
    </svg>
  );
}
