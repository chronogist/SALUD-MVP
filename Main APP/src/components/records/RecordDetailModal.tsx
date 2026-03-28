import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RECORD_TYPES, type MedicalRecord, getRecordDisplayData } from '@/types/records';
import { ShareRecordModal } from './ShareRecordModal';
import { useRecordsStore } from '@/store';
import './RecordDetailModal.css';

interface RecordDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MedicalRecord | null;
}

// --- Icons ---

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ShareUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function LabIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ImagingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function VaccineIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function getTypeThemeClass(recordType: number): string {
  switch (recordType) {
    case 2: case 3: case 10: return 'rdm-type-lab';
    case 4: case 6: case 7: case 9: return 'rdm-type-imaging';
    case 1: return 'rdm-type-report';
    case 5: case 8: return 'rdm-type-vaccine';
    default: return 'rdm-type-lab';
  }
}

function getTypeIcon(recordType: number) {
  switch (recordType) {
    case 2: case 3: case 10: return <LabIcon />;
    case 4: case 6: case 7: case 9: return <ImagingIcon />;
    case 1: return <ReportIcon />;
    case 5: case 8: return <VaccineIcon />;
    default: return <LabIcon />;
  }
}

export function RecordDetailModal({ open, onOpenChange, record }: RecordDetailModalProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordName, setRecordName] = useState('');
  const [recordDetails, setRecordDetails] = useState('');
  const deleteRecord = useRecordsStore((state) => state.deleteRecord);

  // Populate form fields when record changes
  useEffect(() => {
    if (record) {
      const { title, description } = getRecordDisplayData(record);
      setRecordName(title);
      setRecordDetails(description || record.description || '');
    }
  }, [record]);

  // Reset delete confirm when modal closes
  useEffect(() => {
    if (!open) setShowDeleteConfirm(false);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!record) return null;

  const recordType = RECORD_TYPES[record.recordType];
  const { title } = getRecordDisplayData(record);

  const handleDelete = () => {
    deleteRecord(record.id);
    onOpenChange(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="rdm-overlay-wrapper">
            {/* Backdrop */}
            <motion.div
              className="rdm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onOpenChange(false)}
            />

            {/* Modal */}
            <motion.div
              className="rdm-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* Header */}
              <div className="rdm-header">
                <div className="rdm-title-section">
                  <div className={`rdm-modal-icon ${getTypeThemeClass(record.recordType)}`}>
                    {getTypeIcon(record.recordType)}
                  </div>
                  <div className="rdm-title-group">
                    <h2>{title}</h2>
                    <div className="rdm-subtitle">{recordType.name}</div>
                  </div>
                </div>
                <button className="rdm-close" onClick={() => onOpenChange(false)}>
                  <CloseIcon />
                </button>
              </div>

              {/* Body */}
              <div className="rdm-body">
                <div className="rdm-form-group">
                  <label className="rdm-form-label">Record Name</label>
                  <input
                    type="text"
                    className="rdm-form-input"
                    value={recordName}
                    onChange={(e) => setRecordName(e.target.value)}
                  />
                </div>
                <div className="rdm-form-group">
                  <label className="rdm-form-label">Medical Record Details</label>
                  <textarea
                    className="rdm-form-input rdm-form-textarea"
                    placeholder="Enter detailed information about this medical record..."
                    value={recordDetails}
                    onChange={(e) => setRecordDetails(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="rdm-footer">
                <button className="rdm-btn rdm-btn-primary" onClick={() => setShareModalOpen(true)}>
                  <ShareUpIcon />
                  Share with Doctor
                </button>
                <button className="rdm-btn rdm-btn-secondary" onClick={() => {}}>
                  <EditIcon />
                  Edit
                </button>
                {!showDeleteConfirm ? (
                  <button className="rdm-btn rdm-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                    <TrashIcon />
                    Delete
                  </button>
                ) : (
                  <button className="rdm-btn rdm-btn-danger rdm-btn-confirm" onClick={handleDelete}>
                    Confirm Delete
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ShareRecordModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        record={record}
      />
    </>
  );
}
