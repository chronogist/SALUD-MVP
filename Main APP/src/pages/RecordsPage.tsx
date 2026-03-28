import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { CreateRecordModal, ShareRecordModal, RecordDetailModal } from '@/components/records';
import { useRecordsStore, useUserStore } from '@/store';
import { useSyncRecords } from '@/hooks/useSyncRecords';
import { RECORD_TYPES, type MedicalRecord, type RecordType, getRecordDisplayData } from '@/types/records';
import './RecordsPage.css';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.8, ease: 'easeOut' as const },
  }),
};

// --- Icon components for record types ---

function LabIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ImagingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function VaccineIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="rp-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// Map record types to visual theme classes
function getTypeTheme(recordType: RecordType): string {
  switch (recordType) {
    case 2: return 'type-lab';      // Laboratory
    case 4: return 'type-imaging';  // Imaging
    case 1: return 'type-report';   // General Health
    case 5: return 'type-vaccine';  // Vaccination
    case 3: return 'type-lab';      // Prescription -> lab style
    case 6: return 'type-imaging';  // Surgical -> imaging style
    case 7: return 'type-imaging';  // Mental Health -> purple
    case 8: return 'type-vaccine';  // Dental -> pink
    case 9: return 'type-report';   // Vision -> green
    case 10: return 'type-lab';     // Other -> blue
    default: return 'type-lab';
  }
}

function getTypeIcon(recordType: RecordType) {
  switch (recordType) {
    case 2: case 3: case 10: return <LabIcon />;
    case 4: case 6: case 7: case 9: return <ImagingIcon />;
    case 1: return <ReportIcon />;
    case 5: case 8: return <VaccineIcon />;
    default: return <LabIcon />;
  }
}

// Filter chip labels that map to record types
const FILTER_CHIPS: { label: string; types: RecordType[] | 'all' }[] = [
  { label: 'All Records', types: 'all' },
  { label: 'Lab Results', types: [2] },
  { label: 'Imaging', types: [4] },
  { label: 'Prescriptions', types: [3] },
];

// --- Empty State Component ---

function RecordsEmptyState({ onAddRecord }: { onAddRecord: () => void }) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    onAddRecord();
    setInputValue('');
  };

  return (
    <motion.div
      className="rp-empty-state"
      custom={0}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      <div className="rp-illustration-container">
        <div className="rp-blob" />
        <div className="rp-doc-icon">
          <div className="rp-doc-line" />
          <div className="rp-doc-line" />
          <div className="rp-doc-line short" />
        </div>
        <div className="rp-plus-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>

      <div className="rp-empty-content">
        <h1>Your health journey starts here</h1>
        <p>
          Upload your lab results, imaging reports, or vaccination records to get a
          comprehensive view of your health and share them securely with your doctors.
        </p>

        <div className="rp-input-wrapper">
          <input
            type="text"
            className="rp-record-input"
            placeholder="Enter your medical record details..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="rp-btn-primary" onClick={handleSubmit}>
            <PlusIcon size={20} />
            Add Record
          </button>
        </div>

        <a href="#" className="rp-secondary-link">Learn about our secure encryption</a>
      </div>
    </motion.div>
  );
}

// --- Record Card Component ---

function RecordCardItem({
  record,
  index,
  onClick,
}: {
  record: MedicalRecord;
  index: number;
  onClick: () => void;
}) {
  const { title, description } = getRecordDisplayData(record);
  const hasGrants = useRecordsStore((state) =>
    state.accessGrants.some(
      (g) => g.recordId === record.id && !g.isRevoked && g.expiresAt > new Date()
    )
  );

  const statusLabel = hasGrants ? 'Shared' : 'Private';
  const statusClass = hasGrants ? 'rp-status-shared' : '';

  const dateStr = new Date(record.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return (
    <motion.a
      href="#"
      className="rp-record-card"
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <div className={`rp-record-type-icon ${getTypeTheme(record.recordType)}`}>
        {getTypeIcon(record.recordType)}
      </div>
      <div className="rp-record-info">
        <h3>{title}</h3>
        <p>{description || RECORD_TYPES[record.recordType]?.name}</p>
      </div>
      <div className="rp-record-meta">
        <div className={`rp-status-badge ${statusClass}`}>
          <div className="rp-status-dot" />
          {statusLabel}
        </div>
        <div className="rp-record-date">{dateStr}</div>
      </div>
    </motion.a>
  );
}

// --- Main Records Page ---

export function RecordsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(0); // index into FILTER_CHIPS

  const { user } = useUserStore();
  const allRecords = useRecordsStore((state) => state.records);
  const [isSyncing, setIsSyncing] = useState(false);
  const { sync, canSync } = useSyncRecords();

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await sync();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const records = useMemo(() => {
    if (!user?.address) return [];
    return allRecords.filter((record) => record.ownerAddress === user.address);
  }, [allRecords, user?.address]);

  useEffect(() => {
    if (user?.address && canSync) {
      sync().catch(() => {});
    }
  }, [user?.address, canSync, sync]);

  const hasRecords = records.length > 0;

  // Filter records
  const filteredRecords = useMemo(() => {
    const chip = FILTER_CHIPS[activeFilter];
    return records.filter((record) => {
      const matchesSearch =
        searchQuery === '' ||
        record.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        chip.types === 'all' || chip.types.includes(record.recordType);
      return matchesSearch && matchesType;
    });
  }, [records, searchQuery, activeFilter]);

  const handleView = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
  };

  return (
    <SiteLayout mainClassName={hasRecords ? 'rp-main' : 'rp-main-centered'}>
      {!hasRecords ? (
        <RecordsEmptyState onAddRecord={() => setCreateModalOpen(true)} />
      ) : (
        <>
          {/* Page Header */}
          <div className="rp-page-header">
            <h1>Medical Records</h1>
            <div className="rp-header-actions">
              <button
                className={`rp-btn-sync ${isSyncing ? 'rp-syncing' : ''}`}
                onClick={handleSync}
                disabled={!canSync || isSyncing}
                title="Sync records from blockchain"
              >
                <SyncIcon />
              </button>
              <button className="rp-btn-add" onClick={() => setCreateModalOpen(true)}>
                <PlusIcon />
                Upload Record
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="rp-filter-bar">
            <div className="rp-search-container">
              <SearchIcon />
              <input
                type="text"
                className="rp-search-input"
                placeholder="Search records, doctors, or clinics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {FILTER_CHIPS.map((chip, i) => (
              <button
                key={chip.label}
                className={`rp-filter-chip${activeFilter === i ? ' active' : ''}`}
                onClick={() => setActiveFilter(i)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Records Grid */}
          <div className="rp-records-grid">
            {filteredRecords.map((record, index) => (
              <RecordCardItem
                key={record.id}
                record={record}
                index={index}
                onClick={() => handleView(record)}
              />
            ))}
          </div>

          {filteredRecords.length === 0 && (
            <div className="rp-empty-state" style={{ padding: '60px 40px' }}>
              <div className="rp-empty-content">
                <h1 style={{ fontSize: '24px' }}>
                  {searchQuery ? 'No matching records' : 'No records in this category'}
                </h1>
                <p>
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Try selecting a different filter'}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CreateRecordModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <ShareRecordModal open={shareModalOpen} onOpenChange={setShareModalOpen} record={selectedRecord} />
      <RecordDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} record={selectedRecord} />
    </SiteLayout>
  );
}
