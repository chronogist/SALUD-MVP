import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  TestTube,
  Pill,
  Scan,
  Syringe,
  Scissors,
  Brain,
  Smile,
  Eye,
  FileText,
  Plus,
  Shield,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { NotificationModal } from '@/components/ui/notification-modal';
import { cn } from '@/lib/utils';
import { RECORD_TYPES, type RecordType } from '@/types/records';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useRecordsStore, useUserStore } from '@/store';
import { useSyncRecords } from '@/hooks/useSyncRecords';
import { prepareCreateRecordInputs, inputsToArray, PROGRAM_ID } from '@/lib/aleo-utils';
import { TransactionStatus } from '@provablehq/aleo-types';

const iconMap: Record<string, React.ReactNode> = {
  Heart: <Heart size={20} />,
  TestTube: <TestTube size={20} />,
  Pill: <Pill size={20} />,
  Scan: <Scan size={20} />,
  Syringe: <Syringe size={20} />,
  Scissors: <Scissors size={20} />,
  Brain: <Brain size={20} />,
  Smile: <Smile size={20} />,
  Eye: <Eye size={20} />,
  FileText: <FileText size={20} />,
};

const colorMap: Record<string, { bg: string; text: string; border: string; selected: string }> = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200', selected: 'ring-primary-500' },
  success: { bg: 'bg-success-50', text: 'text-success-600', border: 'border-success-200', selected: 'ring-success-500' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600', border: 'border-warning-200', selected: 'ring-warning-500' },
  aleo: { bg: 'bg-aleo-50', text: 'text-aleo-600', border: 'border-aleo-200', selected: 'ring-aleo-500' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600', border: 'border-danger-200', selected: 'ring-danger-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', selected: 'ring-cyan-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', selected: 'ring-violet-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', selected: 'ring-pink-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', selected: 'ring-teal-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', selected: 'ring-slate-500' },
};

interface CreateRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRecordModal({ open, onOpenChange }: CreateRecordModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<RecordType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onchainTransactionId, setOnchainTransactionId] = useState<string | null>(null);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTxHash, setNotificationTxHash] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { executeTransaction, transactionStatus: getTransactionStatus } = useWallet();
  const { user } = useUserStore();
  const { addRecord } = useRecordsStore();
  const { fetchOnchainCount } = useSyncRecords();

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleTypeSelect = (type: RecordType) => {
    setSelectedType(type);
  };

  const handleNext = () => {
    if (selectedType) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setErrors({});
  };

  const validate = () => {
    const newErrors: { title?: string; description?: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Poll transaction status until accepted or failed
  const pollTransactionStatus = async (tempTransactionId: string) => {
    function clear() {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    try {
      const statusResponse = await getTransactionStatus(tempTransactionId);
      setTransactionStatus(statusResponse.status);
      if (statusResponse.transactionId) {
        // Transaction is now onchain, we have the final transaction ID
        setOnchainTransactionId(statusResponse.transactionId);
      }

      if (statusResponse.status.toLowerCase() === TransactionStatus.ACCEPTED.toLowerCase()) {
        setIsPollingStatus(false);
        clear();
        
        // Add record to synced records
        if (user?.address && onchainTransactionId) {
          addRecord({
            recordId: onchainTransactionId,
            title: title,
            description: description,
            recordType: selectedType!,
            data: '', // Will be fetched/decrypted later
            dataHash: '',
            isEncrypted: true,
            ownerAddress: user.address,
          });
          
          // Refresh onchain count
          fetchOnchainCount(user.address);
        }
        
        setNotificationType('success');
        setNotificationTitle('Record Created!');
        setNotificationMessage('Your medical record has been successfully created on the Aleo blockchain.');
        setNotificationTxHash(statusResponse.transactionId || onchainTransactionId);
        setNotificationOpen(true);
      } else if (
        statusResponse.status.toLowerCase() === TransactionStatus.FAILED.toLowerCase() ||
        statusResponse.status.toLowerCase() === TransactionStatus.REJECTED.toLowerCase()
      ) {
        setIsPollingStatus(false);
        if (statusResponse.error) {
          setTransactionError(statusResponse.error);
        }
        clear();
        setNotificationType('error');
        setNotificationTitle('Transaction Failed');
        setNotificationMessage(statusResponse.error || 'Your transaction was rejected. Please try again.');
        setNotificationOpen(true);
      }
    } catch (error) {
      console.error('Error polling transaction status:', error);
      setTransactionError('Error polling transaction status');
      setIsPollingStatus(false);
      setTransactionStatus(TransactionStatus.FAILED);
      clear();
      setNotificationType('error');
      setNotificationTitle('Error');
      setNotificationMessage('Failed to verify transaction status. Please check your transaction in the blockchain explorer.');
      setNotificationOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (!validate() || !selectedType) {
      return;
    }

    if (!user?.isConnected || !user?.address) {
      setNotificationType('error');
      setNotificationTitle('Wallet Not Connected');
      setNotificationMessage('Please connect your wallet to create a record on the blockchain.');
      setNotificationOpen(true);
      return;
    }

    setIsSubmitting(true);
    setOnchainTransactionId(null);
    setTransactionStatus(null);
    setTransactionError(null);
    
    try {
      const inputs = prepareCreateRecordInputs(
        title,
        description,
        selectedType,
        true
      );

      const tx = await executeTransaction({
        program: PROGRAM_ID,
        function: 'create_record',
        inputs: inputsToArray(inputs),
        fee: 100000,
        privateFee: false,
      });

      if (tx?.transactionId) {
        setOnchainTransactionId(tx.transactionId);
        setIsPollingStatus(true);
        pollingIntervalRef.current = setInterval(() => {
          pollTransactionStatus(tx.transactionId);
        }, 1000);
        pollTransactionStatus(tx.transactionId);
      } else {
        setNotificationType('error');
        setNotificationTitle('Transaction Failed');
        setNotificationMessage('Failed to get transaction ID. Please try again.');
        setNotificationOpen(true);
      }
    } catch (error) {
      console.error('Execute error:', error);
      setNotificationType('error');
      setNotificationTitle('Transaction Failed');
      setNotificationMessage(error instanceof Error ? error.message : 'Failed to execute transaction. Please try again.');
      setNotificationOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Don't allow closing while submitting or polling
    if (isSubmitting || isPollingStatus) return;
    
    // Clear polling interval if any
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setStep(1);
    setSelectedType(null);
    setTitle('');
    setDescription('');
    setErrors({});
    setIsSubmitting(false);
    setIsPollingStatus(false);
    setOnchainTransactionId(null);
    setTransactionStatus(null);
    setTransactionError(null);
    setNotificationTxHash(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
              <Plus size={18} className="text-primary-600" />
            </div>
            Create Medical Record
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Select the type of medical record you want to create.'
              : 'Enter the details for your medical record.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              step >= 1
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-400'
            )}
          >
            1
          </div>
          <div
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              step >= 2 ? 'bg-primary-600' : 'bg-slate-200'
            )}
          />
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              step >= 2
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-400'
            )}
          >
            2
          </div>
        </div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 md:grid-cols-5">
              {(Object.entries(RECORD_TYPES) as [string, typeof RECORD_TYPES[RecordType]][]).map(
                ([key, type]) => {
                  const recordType = Number(key) as RecordType;
                  const colors = colorMap[type.color] || colorMap.slate;
                  const icon = iconMap[type.icon] || <FileText size={20} />;
                  const isSelected = selectedType === recordType;

                  return (
                    <button
                      key={key}
                      onClick={() => handleTypeSelect(recordType)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                        isSelected
                          ? `${colors.border} ${colors.bg} ring-2 ${colors.selected}`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          colors.bg,
                          colors.text
                        )}
                      >
                        {icon}
                      </div>
                      <span className="text-center text-xs font-medium text-slate-700">
                        {type.name}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && selectedType && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4 py-4"
          >
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  colorMap[RECORD_TYPES[selectedType].color]?.bg,
                  colorMap[RECORD_TYPES[selectedType].color]?.text
                )}
              >
                {iconMap[RECORD_TYPES[selectedType].icon]}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {RECORD_TYPES[selectedType].name}
                </p>
                <p className="text-xs text-slate-500">
                  {RECORD_TYPES[selectedType].description}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Record Title <span className="text-danger-500">*</span>
              </label>
              <Input
                placeholder="e.g., Annual Physical Examination"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                error={!!errors.title}
                disabled={isSubmitting}
              />
              {errors.title && (
                <p className="flex items-center gap-1 text-xs text-danger-600">
                  <AlertCircle size={12} />
                  {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Description <span className="text-danger-500">*</span>
              </label>
              <Textarea
                placeholder="Describe the contents of this medical record..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description)
                    setErrors({ ...errors, description: undefined });
                }}
                error={!!errors.description}
                rows={4}
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="flex items-center gap-1 text-xs text-danger-600">
                  <AlertCircle size={12} />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-success-50 p-4">
              <Shield className="mt-0.5 h-5 w-5 text-success-600" />
              <div>
                <p className="text-sm font-medium text-success-900">
                  End-to-End Encrypted
                </p>
                <p className="text-xs text-success-700">
                  Your medical data will be stored on the Aleo blockchain using
                  Shield Wallet. Only you can decrypt and view this record.
                </p>
              </div>
            </div>

            {(isSubmitting || isPollingStatus) && (
              <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-4">
                <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-primary-900">
                    {isPollingStatus ? 'Waiting for Confirmation' : 'Transaction Processing'}
                  </p>
                  {onchainTransactionId && (
                    <p className="text-xs text-primary-700 font-mono break-all mt-1">
                      TX ID: {onchainTransactionId}
                    </p>
                  )}
                  {transactionStatus && (
                    <p className="text-xs text-primary-700 mt-1 capitalize">
                      Status: {transactionStatus}
                    </p>
                  )}
                  {transactionError && (
                    <p className="text-xs text-danger-600 mt-1">
                      Error: {transactionError}
                    </p>
                  )}
                  <p className="text-xs text-primary-700 mt-1">
                    {isPollingStatus 
                      ? 'Waiting for blockchain confirmation...' 
                      : 'Please sign the transaction in Shield Wallet...'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isPollingStatus}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!selectedType || isSubmitting || isPollingStatus}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isSubmitting || isPollingStatus}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || isPollingStatus}>
                {isSubmitting || isPollingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isPollingStatus ? 'Waiting for Confirmation...' : 'Creating Record...'}
                  </>
                ) : (
                  'Create Record'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <NotificationModal
        open={notificationOpen}
        onOpenChange={(open) => {
          setNotificationOpen(open);
          if (!open) {
            handleClose();
          }
        }}
        type={notificationType}
        title={notificationTitle}
        message={notificationMessage}
        transactionHash={notificationTxHash || undefined}
        network="testnet"
      />
    </Dialog>
  );
}
