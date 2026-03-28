import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Shield,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, truncateAddress } from '@/lib/utils';
import { RECORD_TYPES, type QRCodeData, type RecordType } from '@/types/records';
import { useUserStore } from '@/store';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { PROGRAM_ID, parseSharedRecordPlaintext } from '@/lib/aleo-utils';

type ScanStatus = 'idle' | 'scanning' | 'verifying' | 'success' | 'error';

interface ScannedRecord {
  title: string;
  description: string;
  recordType: RecordType;
  patientAddress: string;
  expiresAt: Date;
  accessToken: string;
}

export function DoctorQRScanner() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scannedData, setScannedData] = useState<QRCodeData | null>(null);
  const [recordData, setRecordData] = useState<ScannedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = useUserStore((state) => state.user);
  const { requestRecords, decrypt, connected } = useWallet();

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setError(null);
    setScanStatus('scanning');

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        onScanSuccess,
        onScanFailure
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
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanStatus('idle');
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner();
    setScanStatus('verifying');

    try {
      const data: QRCodeData = JSON.parse(decodedText);

      // Validate QR code format
      if (!data.transactionId || !data.recordId || !data.patientAddress) {
        throw new Error('Invalid QR code format. This may be an older QR code version.');
      }

      if (data.version !== 2) {
        throw new Error('Unsupported QR code version. Please ask the patient to generate a new code.');
      }

      if (data.expiresAt < Date.now()) {
        throw new Error('This access has expired. Please ask the patient for a new share.');
      }

      setScannedData(data);

      if (!user || !connected) {
        throw new Error('Please connect your wallet to access shared records.');
      }

      // Fetch SharedMedicalRecord from the blockchain via the wallet
      // The share_record transition created a SharedMedicalRecord owned by this doctor
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
                try {
                  plaintext = await decrypt(record.recordCiphertext);
                } catch {
                  continue;
                }
              }

              if (!plaintext) continue;

              // Check if this is a SharedMedicalRecord matching the QR code
              const isSharedRecord = plaintext.includes('original_owner') && plaintext.includes('access_token');
              if (!isSharedRecord) continue;

              const parsed = parseSharedRecordPlaintext(plaintext);
              if (!parsed) continue;

              // Match by record_id from the QR code
              if (parsed.recordId === data.recordId || parsed.recordId === data.recordId.replace(/field$/, '')) {
                // Parse the medical data from field elements
                let title = 'Shared Medical Record';
                let description = '';

                try {
                  const jsonData = JSON.parse(parsed.data);
                  title = jsonData.title || jsonData.t || title;
                  description = jsonData.description || jsonData.d || description;
                } catch {
                  if (parsed.data && parsed.data !== '0') {
                    title = parsed.data.slice(0, 60);
                  }
                }

                const recordType = (parsed.recordType >= 1 && parsed.recordType <= 10
                  ? parsed.recordType
                  : data.recordType || 1) as RecordType;

                setRecordData({
                  title,
                  description: description || 'Record data decrypted successfully.',
                  recordType,
                  patientAddress: parsed.originalOwner || data.patientAddress,
                  expiresAt: new Date(data.expiresAt),
                  accessToken: parsed.accessToken || data.accessToken,
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
        // The record may not have been synced yet, or the transaction is still pending.
        // Show basic info from the QR code with a note.
        const recordType = (data.recordType >= 1 && data.recordType <= 10
          ? data.recordType
          : 1) as RecordType;

        setRecordData({
          title: `${RECORD_TYPES[recordType].name} Record`,
          description:
            'The shared record was not found in your wallet yet. ' +
            'This may happen if the transaction is still being confirmed. ' +
            'Please try again in a few minutes.',
          recordType,
          patientAddress: data.patientAddress,
          expiresAt: new Date(data.expiresAt),
          accessToken: data.accessToken,
        });
      }

      setScanStatus('success');
    } catch (err) {
      console.error('Scan processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process QR code');
      setScanStatus('error');
    }
  };

  const onScanFailure = (_error: string) => {
  };

  const handleReset = () => {
    setScannedData(null);
    setRecordData(null);
    setError(null);
    setScanStatus('idle');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card variant="elevated" padding="lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Camera className="text-primary-600" />
            Scan Patient QR Code
          </CardTitle>
          <p className="text-sm text-slate-500">
            Scan the QR code shared by the patient to access their medical record
          </p>
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">
            {scanStatus === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center gap-6 py-8"
              >
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">
                  <Camera size={48} className="text-slate-400" />
                </div>

                {cameraPermission === false && (
                  <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
                    <CameraOff size={16} />
                    Camera access denied
                  </div>
                )}

                {!user && (
                  <div className="flex items-center gap-2 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
                    <AlertTriangle size={16} />
                    Connect your wallet to verify and decrypt records
                  </div>
                )}

                <Button size="lg" onClick={startScanner} disabled={!user}>
                  <Camera size={20} />
                  Start Scanning
                </Button>

                <p className="text-center text-xs text-slate-400">
                  Position the QR code within the scanner frame
                </p>
              </motion.div>
            )}

            {scanStatus === 'scanning' && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4"
              >
                <div
                  id="qr-reader"
                  ref={containerRef}
                  className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl"
                />

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
                  Scanning for QR code...
                </div>

                <Button variant="outline" onClick={stopScanner}>
                  <CameraOff size={16} />
                  Stop Scanning
                </Button>
              </motion.div>
            )}

            {scanStatus === 'verifying' && (
              <motion.div
                key="verifying"
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
                  <p className="font-medium text-slate-900">Verifying & Decrypting</p>
                  <p className="text-sm text-slate-500">
                    Looking for shared record in your wallet...
                  </p>
                </div>
              </motion.div>
            )}

            {scanStatus === 'success' && recordData && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 rounded-lg bg-success-50 p-4">
                  <CheckCircle2 className="text-success-600" />
                  <span className="font-medium text-success-900">
                    Record Accessed Successfully
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                      <FileText className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {recordData.title}
                      </h3>
                      <Badge variant="primary" size="sm" className="mt-1">
                        {RECORD_TYPES[recordData.recordType].name}
                      </Badge>
                    </div>
                  </div>

                  <p className="mb-4 text-sm text-slate-600">
                    {recordData.description}
                  </p>

                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-500">
                        <User size={14} />
                        Patient
                      </span>
                      <span className="font-mono text-xs text-slate-700">
                        {truncateAddress(recordData.patientAddress, 8, 6)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-500">
                        <Clock size={14} />
                        Access Expires
                      </span>
                      <span className="text-slate-700">
                        {formatDateTime(recordData.expiresAt)}
                      </span>
                    </div>
                    {scannedData && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-500">
                          <Shield size={14} />
                          Transaction
                        </span>
                        <span className="font-mono text-xs text-slate-700">
                          {truncateAddress(scannedData.transactionId, 8, 6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
                  <Shield className="mt-0.5 h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Decrypted by Aleo
                    </p>
                    <p className="text-xs text-slate-500">
                      This record was encrypted to your wallet address by the Aleo network.
                      Only you can decrypt it with your view key.
                    </p>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={handleReset}>
                  <RefreshCw size={16} />
                  Scan Another Code
                </Button>
              </motion.div>
            )}

            {scanStatus === 'error' && (
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
                  <p className="font-medium text-slate-900">Verification Failed</p>
                  <p className="mt-1 text-sm text-slate-500">{error}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw size={16} />
                    Try Again
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">How it works</h3>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Patient shares on blockchain',
              description: 'The patient creates an on-chain transaction that produces an encrypted copy of their record for you',
            },
            {
              step: 2,
              title: 'Scan the QR code',
              description: 'The QR code contains the transaction reference — no medical data is in the QR code itself',
            },
            {
              step: 3,
              title: 'Your wallet decrypts the record',
              description: 'The Aleo network encrypted the record to your address. Only your wallet can decrypt it.',
            },
            {
              step: 4,
              title: 'View the medical record',
              description: 'The decrypted record is displayed securely. Access expires automatically.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-600">
                {item.step}
              </div>
              <div>
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
