import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore, useRecordsStore } from '@/store';
import { getRecordDisplayData } from '@/types/records';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { formatDateTime, truncateAddress, copyToClipboard } from '@/lib/utils';
import { RECORD_TYPES, type QRCodeData, type RecordType, type MedicalRecord } from '@/types/records';
import { PROGRAM_ID, parseSharedRecordPlaintext, extractTitleAndDescription } from '@/lib/aleo-utils';
import { getDoctorByAddress, registerDoctor } from '@/lib/supabase';
import { WalletConnectModal } from '@/components/layout/WalletConnectModal';
import './DoctorPage.css';

type ScanStatus = 'idle' | 'scanning' | 'verifying' | 'success' | 'pending' | 'error';

interface ScannedRecord {
  title: string;
  description: string;
  recordType: RecordType;
  patientAddress: string;
  expiresAt: Date;
  accessToken: string;
}



// --- Inline SVG Icons ---

function CameraIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </svg>
  );
}

function ShieldIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckCircleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

// --- Animation variants ---
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } },
};

export function DoctorPage() {
  const navigate = useNavigate();
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scannedData, setScannedData] = useState<QRCodeData | null>(null);
  const [recordData, setRecordData] = useState<ScannedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  // Profile dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Doctor registration prompt
  const [showRegPrompt, setShowRegPrompt] = useState(false);
  const [regName, setRegName] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [doctorName, setDoctorName] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = useUserStore((state) => state.user);
  const { disconnect: disconnectUser, setRole } = useUserStore();
  const { requestRecords, decrypt, connected, disconnect: disconnectWallet } = useWallet();
  const records = useRecordsStore((state) => state.records);

  const doctorRecords = records.filter((r) => r.ownerAddress === user?.address);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  // Check if connected doctor is registered
  useEffect(() => {
    if (!user?.isConnected || !user.address) return;
    let cancelled = false;
    getDoctorByAddress(user.address).then((doc) => {
      if (cancelled) return;
      if (doc) {
        setDoctorName(doc.name);
      } else {
        setShowRegPrompt(true);
      }
    });
    return () => { cancelled = true; };
  }, [user?.isConnected, user?.address]);

  const handleRegister = async () => {
    if (!regName.trim() || !user?.address) return;
    setRegLoading(true);
    await registerDoctor(user.address, regName.trim(), regSpecialty.trim() || undefined);
    setDoctorName(regName.trim());
    setRegLoading(false);
    setShowRegPrompt(false);
  };

  // Show connect bubble when not connected
  useEffect(() => {
    if (!user?.isConnected) {
      bubbleTimerRef.current = setTimeout(() => setShowBubble(true), 2000);
    } else {
      setShowBubble(false);
    }
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [user?.isConnected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleCopyAddress = async () => {
    if (!user?.address) return;
    const success = await copyToClipboard(user.address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    try { await disconnectWallet(); } catch (err) {
      console.warn('[DoctorPage] Wallet disconnect error:', err);
    }
    disconnectUser();
    setShowDropdown(false);
  };

  const handleSwitchRole = () => {
    setRole('patient');
    setShowDropdown(false);
    navigate('/overview');
  };

  // --- Scanner logic ---
  const startScanner = async () => {
    setError(null);
    setScanStatus('scanning');

    try {
      const scanner = new Html5Qrcode('dp-qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        onScanSuccess,
        () => {}
      );
      setCameraPermission(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setCameraPermission(false);
      setError('Unable to access camera. Please grant camera permissions.');
      setScanStatus('idle');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current = null; } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanStatus('idle');
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner();
    setScanStatus('verifying');

    try {
      const raw = JSON.parse(decodedText);

      // Normalize v2 (old) and v3 (compact) formats into QRCodeData
      let data: QRCodeData;
      if (raw.v === 3) {
        data = raw as QRCodeData;
      } else if (raw.version === 2) {
        // Backward compat with old format
        data = {
          v: 3,
          tx: raw.transactionId,
          rid: raw.recordId,
          p: raw.patientAddress,
          exp: raw.expiresAt,
          rt: raw.recordType,
        };
      } else {
        throw new Error('Unsupported QR code version. Please ask the patient to generate a new code.');
      }

      if (!data.tx || !data.rid || !data.p) {
        throw new Error('Invalid QR code format. Missing required fields.');
      }
      if (data.exp < Date.now()) {
        throw new Error('This access has expired. Please ask the patient for a new share.');
      }

      setScannedData(data);

      if (!user || !connected) {
        throw new Error('Please connect your wallet to access shared records.');
      }

      let foundRecord = false;

      if (requestRecords) {
        try {
          const records = await requestRecords(PROGRAM_ID, true) as Array<{
            recordPlaintext?: string;
            recordCiphertext?: string;
            spent?: boolean;
          }>;

          if (Array.isArray(records)) {
            for (const record of records) {
              if (record.spent) continue;

              let plaintext: string | undefined;
              if (record.recordPlaintext) {
                plaintext = record.recordPlaintext;
              } else if (record.recordCiphertext && decrypt) {
                try { plaintext = await decrypt(record.recordCiphertext); } catch { continue; }
              }
              if (!plaintext) continue;

              const isSharedRecord = plaintext.includes('original_owner') && plaintext.includes('access_token');
              if (!isSharedRecord) continue;

              const parsed = parseSharedRecordPlaintext(plaintext);
              if (!parsed) continue;

              if (parsed.recordId === data.rid || parsed.recordId === data.rid.replace(/field$/, '')) {
                const { title: extractedTitle, description: extractedDescription } =
                  extractTitleAndDescription(parsed.data);

                const recordType = (parsed.recordType >= 1 && parsed.recordType <= 10
                  ? parsed.recordType
                  : data.rt || 1) as RecordType;

                const title = extractedTitle.trim() || `${RECORD_TYPES[recordType].name} Record`;
                const description = extractedDescription.trim();

                setRecordData({
                  title,
                  description,
                  recordType,
                  patientAddress: parsed.originalOwner || data.p,
                  expiresAt: new Date(data.exp),
                  accessToken: parsed.accessToken || data.tx,
                });

                foundRecord = true;
                break;
              }
            }
          }
        } catch (err) {
          console.error('Error fetching records from wallet:', err);
        }
      }

      if (!foundRecord) {
        const recordType = (data.rt >= 1 && data.rt <= 10
          ? data.rt : 1) as RecordType;

        setRecordData({
          title: `${RECORD_TYPES[recordType].name} Record`,
          description: '',
          recordType,
          patientAddress: data.p,
          expiresAt: new Date(data.exp),
          accessToken: data.tx,
        });
        setScanStatus('pending');
      } else {
        setScanStatus('success');
      }
    } catch (err) {
      console.error('Scan processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process QR code');
      setScanStatus('error');
    }
  };

  const handleReset = () => {
    setScannedData(null);
    setRecordData(null);
    setError(null);
    setScanStatus('idle');
  };

  const [descCopied, setDescCopied] = useState(false);
  const handleCopyDescription = async () => {
    if (!recordData?.description) return;
    const ok = await copyToClipboard(recordData.description);
    if (ok) {
      setDescCopied(true);
      setTimeout(() => setDescCopied(false), 2000);
    }
  };

  return (
    <div className="dp-wrapper">
      {/* Minimal Header */}
      <header className="dp-header">
        <Link to="/doctor" className="dp-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L12 22M2 12L22 12M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="#111112" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Salud Healths
          <span className="dp-role-badge">Doctor</span>
        </Link>

        {/* Profile / Wallet Area */}
        <div className="hp-profile-area" ref={dropdownRef}>
          {/* Connect wallet bubble */}
          <AnimatePresence>
            {showBubble && !user?.isConnected && !showDropdown && (
              <motion.div
                className="sl-bubble"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                onClick={() => {
                  setShowBubble(false);
                  setShowDropdown(true);
                }}
              >
                <span className="sl-bubble-emoji">👋</span>
                <span className="sl-bubble-text">Hey! Connect your wallet to get started</span>
                <span className="sl-bubble-tail" />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className="hp-user-profile"
            onClick={() => {
              setShowBubble(false);
              setShowDropdown(!showDropdown);
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150"
              alt="User profile"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className={`hp-status-dot ${user?.isConnected ? 'connected' : ''}`} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                className="sl-dropdown"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              >
                {user?.isConnected ? (
                  <>
                    <div className="sl-dropdown-header">
                      <div className="sl-wallet-icon">
                        <WalletIcon />
                      </div>
                      <div>
                        <p className="sl-connected-label">Connected</p>
                        <span className="sl-network-badge">Aleo Testnet</span>
                      </div>
                    </div>

                    <div className="sl-address-block">
                      <p className="sl-address-label">Wallet Address</p>
                      <div className="sl-address-row">
                        <code className="sl-address-value">
                          {truncateAddress(user.address, 20, 6)}
                        </code>
                        <button className="sl-copy-btn" onClick={handleCopyAddress}>
                          {copied ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>

                    <div className="sl-dropdown-actions">
                      <a
                        href={`https://explorer.aleo.org/address/${user.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sl-action-link"
                      >
                        <ExternalLinkIcon />
                        View on Explorer
                      </a>

                      <button className="sl-switch-btn" onClick={handleSwitchRole}>
                        <SwitchIcon />
                        Switch to Patient
                      </button>

                      <button className="sl-disconnect-btn" onClick={handleDisconnect}>
                        <LogOutIcon />
                        Disconnect Wallet
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sl-dropdown-header">
                      <div className="sl-wallet-icon sl-wallet-icon-gray">
                        <WalletIcon />
                      </div>
                      <div>
                        <p className="sl-connected-label">No Wallet Connected</p>
                        <p className="sl-subtitle-text">Connect to scan records</p>
                      </div>
                    </div>

                    <button
                      className="sl-connect-btn"
                      onClick={() => {
                        setShowDropdown(false);
                        setShowConnectModal(true);
                      }}
                    >
                      <WalletIcon />
                      Connect Wallet
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content */}
      <main className="dp-main">
        <div className="dp-page-title">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {doctorName ? `Welcome, ${doctorName}` : 'Doctor Portal'}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
            Scan patient QR codes to access shared medical records securely
          </motion.p>
        </div>

        {/* Scanner Card */}
        {/* Persistent QR reader element — always in DOM, hidden when not scanning */}
        <div
          id="dp-qr-reader"
          ref={containerRef}
          style={{ display: scanStatus === 'scanning' ? 'block' : 'none' }}
        />

        <div className="dp-two-column">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
          <AnimatePresence mode="wait">
            {/* IDLE */}
            {scanStatus === 'idle' && (
              <motion.div key="idle" className="dp-card dp-card-centered" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
                <div className="dp-scanner-icon">
                  <CameraIcon size={48} />
                </div>

                <p className="dp-scanner-title">Ready to Scan</p>
                <p className="dp-scanner-subtitle">
                  Position the patient's QR code within the scanner frame to access their shared medical record
                </p>

                {cameraPermission === false && (
                  <div className="dp-camera-denied">
                    <CameraOffIcon />
                    Camera access denied
                  </div>
                )}

                {!user?.isConnected && (
                  <div className="dp-warning-badge">
                    <AlertIcon />
                    Connect your wallet to verify and decrypt records
                  </div>
                )}

                <button className="dp-btn dp-btn-primary" onClick={startScanner} disabled={!user?.isConnected}>
                  <CameraIcon size={20} />
                  Start Scanning
                </button>
              </motion.div>
            )}

            {/* SCANNING */}
            {scanStatus === 'scanning' && (
              <motion.div key="scanning" className="dp-card dp-card-centered" variants={fadeInScale} initial="hidden" animate="visible" exit="exit">
                <div className="dp-scanning-indicator">
                  <span className="dp-scanning-dot" />
                  Scanning for QR code...
                </div>

                <button className="dp-btn dp-btn-secondary" onClick={stopScanner}>
                  <CameraOffIcon />
                  Stop Scanning
                </button>
              </motion.div>
            )}

            {/* VERIFYING */}
            {scanStatus === 'verifying' && (
              <motion.div key="verifying" className="dp-card dp-card-centered" variants={fadeInScale} initial="hidden" animate="visible" exit="exit">
                <div className="dp-verify-icon">
                  <div className="dp-verify-circle">
                    <ShieldIcon size={40} />
                  </div>
                  <div className="dp-verify-spinner">
                    <SpinnerIcon />
                  </div>
                </div>

                <p className="dp-scanner-title">Verifying & Decrypting</p>
                <p className="dp-scanner-subtitle">
                  Looking for shared record in your wallet...
                </p>
              </motion.div>
            )}

            {/* SUCCESS */}
            {scanStatus === 'success' && recordData && (
              <motion.div key="success" className="dp-card dp-success-card" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
                <div className="dp-success-banner-thin">
                  <CheckCircleIcon />
                  Record Accessed Successfully
                </div>

                {/* Header strip — title + type + patient */}
                <div className="dp-record-head">
                  <div className="dp-record-head-icon">
                    <FileTextIcon />
                  </div>
                  <div className="dp-record-head-info">
                    <div className="dp-record-head-title-row">
                      <h2 className="dp-record-title-lg">{recordData.title || 'Medical Record'}</h2>
                      <span className="dp-record-type-pill">
                        {RECORD_TYPES[recordData.recordType].name}
                      </span>
                    </div>
                    <p className="dp-record-shared-by">
                      Shared by <span>{truncateAddress(recordData.patientAddress, 8, 6)}</span>
                    </p>
                  </div>
                </div>

                {/* THE BIG ONE — medical content */}
                <div className="dp-record-content-wrap">
                  <div className="dp-record-content-label">
                    <FileTextIcon />
                    Medical Record Details
                    <button
                      type="button"
                      className="dp-record-copy-btn"
                      onClick={handleCopyDescription}
                      aria-label="Copy record content"
                    >
                      {descCopied ? <CheckIcon /> : <CopyIcon />}
                      {descCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="dp-record-content-box">
                    {recordData.description && recordData.description.trim() ? (
                      <p className="dp-record-content-text">{recordData.description}</p>
                    ) : (
                      <p className="dp-record-content-empty">No additional details were provided with this record.</p>
                    )}
                  </div>
                </div>

                {/* Footer strip — verification metadata */}
                <div className="dp-record-footer">
                  <div className="dp-record-footer-left">
                    <ShieldIcon size={14} />
                    <span>Decrypted by Aleo</span>
                    <span className="dp-record-footer-sep">•</span>
                    <ClockIcon />
                    <span>Expires {formatDateTime(recordData.expiresAt)}</span>
                  </div>
                  {scannedData && (
                    <div className="dp-record-footer-tx">
                      Tx: <code>{truncateAddress(scannedData.tx, 8, 6)}</code>
                    </div>
                  )}
                </div>

                <button className="dp-btn dp-btn-secondary dp-btn-full" onClick={handleReset} style={{ marginTop: 20 }}>
                  <RefreshIcon />
                  Scan Another Code
                </button>
              </motion.div>
            )}

            {/* PENDING — QR is valid but no matching record in this wallet */}
            {scanStatus === 'pending' && recordData && (
              <motion.div key="pending" className="dp-card dp-pending-card" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
                <div className="dp-pending-icon-wrap">
                  <ClockIcon />
                </div>

                <p className="dp-pending-title">Record Not Yet Available</p>
                <p className="dp-pending-subtitle">
                  We verified the QR code, but no matching record was found in your connected wallet.
                </p>

                <div className="dp-pending-reasons">
                  <div className="dp-pending-reason">
                    <span className="dp-pending-reason-dot" />
                    <div>
                      <p className="dp-pending-reason-title">Transaction still confirming</p>
                      <p className="dp-pending-reason-text">
                        Aleo finalization can take a few minutes. Wait briefly and re-scan.
                      </p>
                    </div>
                  </div>
                  <div className="dp-pending-reason">
                    <span className="dp-pending-reason-dot dp-pending-reason-dot-warn" />
                    <div>
                      <p className="dp-pending-reason-title">This wallet wasn't authorized</p>
                      <p className="dp-pending-reason-text">
                        The patient may have shared with a different doctor address. Confirm with them, then scan again with the correct wallet.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="dp-pending-meta">
                  <div className="dp-pending-meta-row">
                    <span className="dp-pending-meta-label">Shared by</span>
                    <code className="dp-pending-meta-value">{truncateAddress(recordData.patientAddress, 8, 6)}</code>
                  </div>
                  {scannedData && (
                    <div className="dp-pending-meta-row">
                      <span className="dp-pending-meta-label">Tx</span>
                      <code className="dp-pending-meta-value">{truncateAddress(scannedData.tx, 8, 6)}</code>
                    </div>
                  )}
                  <div className="dp-pending-meta-row">
                    <span className="dp-pending-meta-label">Expires</span>
                    <span className="dp-pending-meta-value">{formatDateTime(recordData.expiresAt)}</span>
                  </div>
                </div>

                <button className="dp-btn dp-btn-primary dp-btn-full" onClick={handleReset}>
                  <RefreshIcon />
                  Scan Again
                </button>
              </motion.div>
            )}

            {/* ERROR */}
            {scanStatus === 'error' && (
              <motion.div key="error" className="dp-card dp-card-centered" variants={fadeInUp} initial="hidden" animate="visible" exit="exit">
                <div className="dp-error-icon">
                  <XCircleIcon size={40} />
                </div>

                <p className="dp-error-title">Verification Failed</p>
                <p className="dp-error-text">{error}</p>

                <button className="dp-btn dp-btn-secondary" onClick={handleReset}>
                  <RefreshIcon />
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* My Medical Records — doctor's own records */}
        {user?.isConnected && (
          <motion.div
            className="dp-shared-list-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h3 className="dp-shared-list-title">
              <FileTextIcon />
              My Medical Records
              {doctorRecords.length > 0 && (
                <span className="dp-shared-list-count">{doctorRecords.length}</span>
              )}
            </h3>
            {doctorRecords.length === 0 ? (
              <p className="dp-shared-empty">No records found for this wallet. Records will appear here once synced from the blockchain.</p>
            ) : (
              <div className="dp-shared-list">
                {doctorRecords.map((rec) => {
                  const { title, description } = getRecordDisplayData(rec);
                  const typeName = RECORD_TYPES[rec.recordType as RecordType]?.name || 'Record';
                  return (
                    <button
                      key={rec.id}
                      className="dp-shared-item dp-shared-item-clickable"
                      onClick={() => setSelectedRecord(rec)}
                    >
                      <div className="dp-shared-item-icon">
                        <FileTextIcon />
                      </div>
                      <div className="dp-shared-item-info">
                        <span className="dp-shared-item-title">{title}</span>
                        <span className="dp-shared-item-meta">{description ? description.slice(0, 60) + (description.length > 60 ? '…' : '') : typeName}</span>
                      </div>
                      <span className="dp-shared-item-badge">{typeName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
        </div>{/* end dp-two-column */}

        {/* Record Detail Modal */}
        <AnimatePresence>
          {selectedRecord && (() => {
            const { title, description } = getRecordDisplayData(selectedRecord);
            const typeName = RECORD_TYPES[selectedRecord.recordType as RecordType]?.name || 'Record';
            return (
              <motion.div
                className="dp-record-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedRecord(null)}
              >
                <motion.div
                  className="dp-record-modal"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dp-record-modal-header">
                    <div className="dp-record-head-icon">
                      <FileTextIcon />
                    </div>
                    <div className="dp-record-head-info">
                      <h2 className="dp-record-modal-title">{title}</h2>
                      <span className="dp-record-type-pill">{typeName}</span>
                    </div>
                    <button className="dp-record-modal-close" onClick={() => setSelectedRecord(null)}>
                      <XCircleIcon size={24} />
                    </button>
                  </div>

                  <div className="dp-record-modal-body">
                    {description && description.trim() ? (
                      <p className="dp-record-modal-text">{description}</p>
                    ) : (
                      <p className="dp-record-modal-empty">No additional details were provided with this record.</p>
                    )}
                  </div>

                  <div className="dp-record-modal-footer">
                    <div className="dp-record-modal-meta">
                      <span>Created: {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : '—'}</span>
                      <span>Type: {typeName}</span>
                    </div>
                    <button className="dp-btn dp-btn-secondary" onClick={() => setSelectedRecord(null)}>
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* How It Works */}
        <motion.div
          className="dp-how-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h3 className="dp-how-title">How it works</h3>
          <div className="dp-steps">
            {[
              { step: 1, title: 'Patient shares on blockchain', text: 'The patient creates an on-chain transaction that produces an encrypted copy of their record for you' },
              { step: 2, title: 'Scan the QR code', text: 'The QR code contains the transaction reference — no medical data is in the QR code itself' },
              { step: 3, title: 'Your wallet decrypts the record', text: 'The Aleo network encrypted the record to your address. Only your wallet can decrypt it.' },
              { step: 4, title: 'View the medical record', text: 'The decrypted record is displayed securely. Access expires automatically.' },
            ].map((item) => (
              <div key={item.step} className="dp-step">
                <div className="dp-step-number">{item.step}</div>
                <div>
                  <p className="dp-step-title">{item.title}</p>
                  <p className="dp-step-text">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Doctor Registration Prompt */}
      <AnimatePresence>
        {showRegPrompt && (
          <motion.div
            className="dp-reg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="dp-reg-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
            >
              <div className="dp-reg-icon">
                <ShieldIcon size={28} />
              </div>
              <h3 className="dp-reg-title">Complete Your Profile</h3>
              <p className="dp-reg-subtitle">
                Register your name so patients can easily find and share records with you.
              </p>

              <div className="dp-reg-fields">
                <label className="dp-reg-label">
                  Full Name
                  <input
                    type="text"
                    className="dp-reg-input"
                    placeholder="Dr. Jane Smith"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    autoFocus
                  />
                </label>
                <label className="dp-reg-label">
                  Specialty <span className="dp-reg-optional">(optional)</span>
                  <input
                    type="text"
                    className="dp-reg-input"
                    placeholder="e.g. Cardiologist"
                    value={regSpecialty}
                    onChange={(e) => setRegSpecialty(e.target.value)}
                  />
                </label>
              </div>

              <button
                className="dp-btn dp-btn-primary dp-btn-full"
                onClick={handleRegister}
                disabled={!regName.trim() || regLoading}
              >
                {regLoading ? 'Saving...' : 'Register'}
              </button>
              <button
                className="dp-reg-skip"
                onClick={() => setShowRegPrompt(false)}
              >
                Skip for now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WalletConnectModal open={showConnectModal} onOpenChange={setShowConnectModal} />
    </div>
  );
}
