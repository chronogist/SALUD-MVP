import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Clock,
  Copy,
  Check,
  Share2,
  Timer,
  Shield,
  Download,
  RefreshCw,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { copyToClipboard, blocksToTime, truncateAddress } from '@/lib/utils';
import { DURATION_OPTIONS, RECORD_TYPES, type MedicalRecord, type QRCodeData, type RecordType, getRecordDisplayData } from '@/types/records';
import { useUserStore, useRecordsStore } from '@/store';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { TransactionStatus } from '@provablehq/aleo-types';
import { PROGRAM_ID, prepareShareRecordInputs } from '@/lib/aleo-utils';
import { searchDoctors, type DoctorEntry } from '@/lib/supabase';
import { useSyncRecords } from '@/hooks/useSyncRecords';

type Step = 'configure' | 'submitting' | 'share' | 'error';

interface ShareRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MedicalRecord | null;
  prefillDoctorAddress?: string;
  prefillDoctorName?: string;
}

export function ShareRecordModal({ open, onOpenChange, record, prefillDoctorAddress, prefillDoctorName }: ShareRecordModalProps) {
  const [step, setStep] = useState<Step>('configure');
  const [doctorAddress, setDoctorAddress] = useState('');
  const [durationBlocks, setDurationBlocks] = useState(5760);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Doctor search
  const [doctorQuery, setDoctorQuery] = useState('');
  const [doctorResults, setDoctorResults] = useState<DoctorEntry[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorEntry | null>(null);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doctorSearchRef = useRef<HTMLDivElement>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const user = useUserStore((state) => state.user);
  const createAccessGrant = useRecordsStore((state) => state.createAccessGrant);
  const { executeTransaction, transactionStatus: getTransactionStatus } = useWallet();
  const { sync } = useSyncRecords();

  useEffect(() => {
    if (!open) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setStep('configure');
      setDoctorAddress('');
      setDurationBlocks(5760);
      setAddressError(null);
      setTransactionError(null);
      setTransactionId(null);
      setAccessToken(null);
      setExpiresAt(null);
      setCopied(false);
      setDoctorQuery('');
      setDoctorResults([]);
      setSelectedDoctor(null);
      setShowDoctorDropdown(false);
    } else if (prefillDoctorAddress) {
      setDoctorAddress(prefillDoctorAddress);
      setDoctorQuery(prefillDoctorName || '');
      if (prefillDoctorName) {
        setSelectedDoctor({
          address: prefillDoctorAddress,
          name: prefillDoctorName,
          specialty: null,
          created_at: '',
        });
      }
    }
  }, [open, prefillDoctorAddress, prefillDoctorName]);

  // Search doctors as user types
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (doctorQuery.length < 2) {
      setDoctorResults([]);
      setShowDoctorDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchDoctors(doctorQuery);
      setDoctorResults(results);
      setShowDoctorDropdown(results.length > 0);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [doctorQuery]);

  // Close doctor dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (doctorSearchRef.current && !doctorSearchRef.current.contains(e.target as Node)) {
        setShowDoctorDropdown(false);
      }
    };
    if (showDoctorDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDoctorDropdown]);

  const handleSelectDoctor = (doc: DoctorEntry) => {
    setSelectedDoctor(doc);
    setDoctorAddress(doc.address);
    setDoctorQuery(doc.name);
    setShowDoctorDropdown(false);
    setAddressError(null);
  };

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const pollTransactionStatus = async (tempTxId: string) => {
    try {
      const statusResponse = await getTransactionStatus(tempTxId);

      if (statusResponse.status.toLowerCase() === TransactionStatus.ACCEPTED.toLowerCase()) {
        // Transaction confirmed on-chain
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        const finalTxId = statusResponse.transactionId || tempTxId;
        setTransactionId(finalTxId);

        // Calculate expiration from now
        const now = new Date();
        const expiration = new Date(now.getTime() + durationBlocks * 15 * 1000);
        setExpiresAt(expiration);

        // Store grant locally for the SharedAccessPage
        createAccessGrant({
          accessToken: accessToken || finalTxId,
          recordId: record?.recordId || record?.id || '',
          patientAddress: user?.address || '',
          doctorAddress: doctorAddress,
          grantedAt: now,
          expiresAt: expiration,
          durationBlocks,
          isRevoked: false,
        });

        setStep('share');
      } else if (
        statusResponse.status.toLowerCase() === TransactionStatus.FAILED.toLowerCase() ||
        statusResponse.status.toLowerCase() === TransactionStatus.REJECTED.toLowerCase()
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setTransactionError(statusResponse.error || 'Transaction was rejected by the network.');
        setStep('error');
      }
    } catch (error) {
      console.error('Error polling transaction status:', error);
    }
  };

  const handleShare = async () => {
    if (!record || !user) return;

    // Validate doctor address
    if (!doctorAddress) {
      setAddressError("Doctor's Aleo address is required for secure sharing.");
      return;
    }
    if (!doctorAddress.startsWith('aleo1')) {
      setAddressError('Invalid Aleo address format. Must start with aleo1.');
      return;
    }
    if (doctorAddress === user.address) {
      setAddressError('Cannot share a record with yourself.');
      return;
    }

    setAddressError(null);
    setTransactionError(null);
    setStep('submitting');

    try {
      // If recordPlaintext is missing, auto-sync to fetch it from the wallet
      let plaintext = record.recordPlaintext;
      if (!plaintext) {
        try {
          await sync();
          // After sync, find the updated record in the store by matching title + owner
          const updatedRecords = useRecordsStore.getState().records;
          const matched = updatedRecords.find(
            (r) =>
              r.recordPlaintext &&
              r.ownerAddress === record.ownerAddress &&
              (r.recordId === record.recordId || r.title === record.title)
          );
          plaintext = matched?.recordPlaintext;
        } catch {
          // sync failed, continue without
        }
      }

      if (!plaintext) {
        setAddressError('Could not find the record on the blockchain. Please ensure it has been confirmed on-chain and try again.');
        setStep('configure');
        return;
      }

      const inputs = prepareShareRecordInputs(
        plaintext,
        doctorAddress,
        durationBlocks
      );

      const tx = await executeTransaction({
        program: PROGRAM_ID,
        function: 'share_record',
        inputs,
        fee: 150000,
        privateFee: false,
      });

      if (tx?.transactionId) {
        setTransactionId(tx.transactionId);
        // The access token is an output of the transition — we'll get it from the tx
        // For now, use the transaction ID as a reference
        setAccessToken(tx.transactionId);

        // Poll for confirmation
        pollingIntervalRef.current = setInterval(() => {
          pollTransactionStatus(tx.transactionId);
        }, 2000);
        pollTransactionStatus(tx.transactionId);
      } else {
        setTransactionError('Failed to get transaction ID from wallet.');
        setStep('error');
      }
    } catch (error) {
      console.error('Share transaction error:', error);
      setTransactionError(
        error instanceof Error ? error.message : 'Failed to execute share transaction.'
      );
      setStep('error');
    }
  };

  const handleCopyToken = async () => {
    if (!transactionId) return;
    const success = await copyToClipboard(transactionId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `salud-share-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Build QR data — compact keys to keep QR code scannable
  const qrData: QRCodeData | null =
    transactionId && record && user
      ? {
          v: 3,
          tx: transactionId,
          rid: record.recordId,
          p: user.address,
          exp: expiresAt?.getTime() || 0,
          rt: record.recordType,
        }
      : null;

  if (!record) return null;

  const recordType = RECORD_TYPES[record.recordType as RecordType];
  const { title } = getRecordDisplayData(record);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      // Don't allow closing while transaction is in progress
      if (step === 'submitting') return;
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
              <Share2 size={18} className="text-primary-600" />
            </div>
            Share Medical Record
          </DialogTitle>
          <DialogDescription>
            {step === 'configure'
              ? 'Share this record securely via the Aleo blockchain.'
              : step === 'submitting'
                ? 'Executing transaction on the Aleo blockchain...'
                : step === 'share'
                  ? 'Share this QR code with your healthcare provider.'
                  : 'Something went wrong with the transaction.'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* STEP 1: Configure */}
          {step === 'configure' && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 py-4"
            >
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{recordType.name}</p>
              </div>

              <div className="space-y-2" ref={doctorSearchRef}>
                <label className="text-sm font-medium text-slate-700">
                  Doctor's Name
                  <span className="ml-1 text-xs font-normal text-danger-500">*Required</span>
                </label>
                <div className="relative">
                  <Input
                    placeholder="Search by doctor name..."
                    value={doctorQuery}
                    onChange={(e) => {
                      setDoctorQuery(e.target.value);
                      if (selectedDoctor && e.target.value !== selectedDoctor.name) {
                        setSelectedDoctor(null);
                        setDoctorAddress('');
                      }
                      setAddressError(null);
                    }}
                  />
                  {showDoctorDropdown && doctorResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                      {doctorResults.map((doc) => (
                        <button
                          key={doc.address}
                          type="button"
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => handleSelectDoctor(doc)}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                            {doc.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {doc.specialty ? `${doc.specialty} · ` : ''}
                              {truncateAddress(doc.address, 8, 6)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedDoctor ? (
                  <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-xs font-bold text-primary-700">
                      {selectedDoctor.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{selectedDoctor.name}</p>
                    </div>
                    <span className="text-xs font-mono text-primary-600">{truncateAddress(selectedDoctor.address, 6, 4)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Type at least 2 characters to search registered doctors.
                  </p>
                )}
              </div>

              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                  Or enter Aleo address manually
                </summary>
                <div className="mt-2">
                  <Input
                    placeholder="aleo1..."
                    value={selectedDoctor ? '' : doctorAddress}
                    onChange={(e) => {
                      setDoctorAddress(e.target.value);
                      setSelectedDoctor(null);
                      setDoctorQuery('');
                      setAddressError(null);
                    }}
                    disabled={!!selectedDoctor}
                  />
                </div>
              </details>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Access Duration
                </label>
                <Select
                  value={durationBlocks.toString()}
                  onValueChange={(value) => setDurationBlocks(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.blocks} value={option.blocks.toString()}>
                        <div className="flex items-center gap-2">
                          <Timer size={14} className="text-slate-400" />
                          <span>{option.label}</span>
                          <span className="text-xs text-slate-400">
                            - {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-4">
                <Shield className="mt-0.5 h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-primary-900">
                    Secured by Aleo
                  </p>
                  <p className="text-xs text-primary-700">
                    This creates an on-chain transaction. The doctor's copy is encrypted
                    to their address by the Aleo network — no one else can read it.
                  </p>
                </div>
              </div>

              {addressError && (
                <div className="flex items-start gap-3 rounded-lg bg-danger-50 p-4">
                  <XCircle className="mt-0.5 h-5 w-5 text-danger-600" />
                  <p className="text-sm text-danger-700">{addressError}</p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleShare}
                disabled={!doctorAddress}
              >
                <Shield size={16} />
                Share on Blockchain
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Submitting transaction */}
          {step === 'submitting' && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100">
                  <Shield size={40} className="text-primary-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                  <Loader2 size={20} className="animate-spin text-primary-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="font-medium text-slate-900">Sharing Record on Blockchain</p>
                <p className="mt-1 text-sm text-slate-500">
                  Creating an encrypted copy for the doctor...
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  This may take a moment. Please don't close this window.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Share QR code */}
          {step === 'share' && qrData && (
            <motion.div
              key="share"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 py-4"
            >
              <div className="flex flex-col items-center">
                <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
                  <QRCodeSVG
                    id="qr-code-svg"
                    value={JSON.stringify(qrData)}
                    size={200}
                    level="M"
                    includeMargin
                    imageSettings={{
                      src: '/logo-icon.svg',
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">Expires in:</span>
                  <Badge
                    variant={countdown === 'Expired' ? 'danger' : 'success'}
                    className="font-mono"
                  >
                    {countdown}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Transaction ID
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={transactionId || ''}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                  >
                    {copied ? (
                      <Check size={16} className="text-success-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Record</span>
                  <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={record.title}>
                    {record.title}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Duration</span>
                  <span className="text-sm font-medium text-slate-900">
                    {blocksToTime(durationBlocks)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Shared with</span>
                  <span className="text-sm text-slate-900 truncate max-w-[200px]" title={doctorAddress}>
                    {selectedDoctor ? selectedDoctor.name : truncateAddress(doctorAddress)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownloadQR}
                >
                  <Download size={16} />
                  Download QR
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Shield size={14} className="text-success-500" />
                Verified on Aleo blockchain
              </div>
            </motion.div>
          )}

          {/* ERROR state */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-danger-100">
                <XCircle size={40} className="text-danger-600" />
              </div>

              <div className="text-center">
                <p className="font-medium text-slate-900">Transaction Failed</p>
                <p className="mt-1 text-sm text-slate-500">{transactionError}</p>
              </div>

              <Button variant="outline" onClick={() => setStep('configure')}>
                <RefreshCw size={16} />
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
