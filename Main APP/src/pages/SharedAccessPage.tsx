import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { useRecordsStore, useUserStore } from '@/store';
import { getRecordDisplayData } from '@/types/records';
import type { AccessGrant, MedicalRecord } from '@/types/records';
import { ShareRecordModal } from '@/components/records/ShareRecordModal';
import { getAllDoctors, type DoctorEntry } from '@/lib/supabase';
import { truncateAddress } from '@/lib/utils';
import './SharedAccessPage.css';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.8, ease: 'easeOut' as const },
  }),
};

// --- Icons ---

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function HeartbeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function getRecordIcon(recordType: number) {
  switch (recordType) {
    case 2: case 3: case 10: return <FileIcon />;
    case 4: case 6: case 7: case 9: return <ImageIcon />;
    case 1: return <HeartbeatIcon />;
    case 5: case 8: return <ShieldIcon />;
    default: return <FileIcon />;
  }
}

type FilterKey = 'all' | 'active' | 'revoked' | 'expired';
const FILTER_CHIPS: { label: string; key: FilterKey }[] = [
  { label: 'All Doctors', key: 'all' },
  { label: 'Active Share', key: 'active' },
  { label: 'Revoked', key: 'revoked' },
  { label: 'Expired Access', key: 'expired' },
];

// --- Helper ---

function safeDate(date: Date | string | number | undefined): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  try { return new Date(date); } catch { return new Date(); }
}

interface EnrichedGrant extends AccessGrant {
  isExpired: boolean;
}

interface DoctorGroup {
  address: string;
  name: string;
  specialty: string;
  grants: EnrichedGrant[];
  activeCount: number;
  revokedCount: number;
  expiredCount: number;
}

// --- Main Page ---

export function SharedAccessPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedDoctorAddr, setSelectedDoctorAddr] = useState<string | null>(null);
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
  const [allDoctors, setAllDoctors] = useState<DoctorEntry[]>([]);
  const [showRecordPicker, setShowRecordPicker] = useState(false);
  const [shareRecord, setShareRecord] = useState<MedicalRecord | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const user = useUserStore((state) => state.user);
  const accessGrants = useRecordsStore((state) => state.accessGrants);
  const records = useRecordsStore((state) => state.records);
  const revokeAccessGrant = useRecordsStore((state) => state.revokeAccessGrant);

  // Enrich grants with isExpired
  const userGrants = useMemo<EnrichedGrant[]>(() => {
    return accessGrants
      .filter((g) => g.patientAddress === user?.address)
      .map((g) => ({
        ...g,
        isExpired: safeDate(g.expiresAt) < new Date(),
      }));
  }, [accessGrants, user?.address]);

  // Fetch all registered doctors from Supabase
  useEffect(() => {
    let cancelled = false;
    getAllDoctors().then((docs) => {
      if (!cancelled) setAllDoctors(docs);
    });
    return () => { cancelled = true; };
  }, []);

  // Build a lookup from address -> doctor entry
  const doctorDirectory = useMemo(() => {
    const map: Record<string, DoctorEntry> = {};
    for (const doc of allDoctors) map[doc.address] = doc;
    return map;
  }, [allDoctors]);

  // Group grants by doctor, then merge in all registered doctors
  const doctorGroups = useMemo<DoctorGroup[]>(() => {
    const grouped = new Map<string, EnrichedGrant[]>();
    for (const grant of userGrants) {
      const list = grouped.get(grant.doctorAddress) || [];
      list.push(grant);
      grouped.set(grant.doctorAddress, list);
    }

    // Start with doctors who have grants
    const groups: DoctorGroup[] = Array.from(grouped.entries()).map(([address, grants]) => {
      const doc = doctorDirectory[address];
      return {
        address,
        name: doc?.name || truncateAddress(address, 8, 6),
        specialty: doc?.specialty || '',
        grants,
        activeCount: grants.filter((g) => !g.isRevoked && !g.isExpired).length,
        revokedCount: grants.filter((g) => g.isRevoked).length,
        expiredCount: grants.filter((g) => g.isExpired && !g.isRevoked).length,
      };
    });

    // Add registered doctors who have NO grants (for "All Doctors" view)
    for (const doc of allDoctors) {
      if (!grouped.has(doc.address) && doc.address !== user?.address) {
        groups.push({
          address: doc.address,
          name: doc.name,
          specialty: doc.specialty || '',
          grants: [],
          activeCount: 0,
          revokedCount: 0,
          expiredCount: 0,
        });
      }
    }

    return groups;
  }, [userGrants, doctorDirectory, allDoctors, user?.address]);

  // Filter doctors based on active filter chip
  const filteredGroups = useMemo(() => {
    switch (activeFilter) {
      case 'active':
        return doctorGroups.filter((g) => g.activeCount > 0);
      case 'revoked':
        return doctorGroups.filter((g) => g.revokedCount > 0);
      case 'expired':
        return doctorGroups.filter((g) => g.expiredCount > 0);
      default:
        return doctorGroups;
    }
  }, [doctorGroups, activeFilter]);

  // Auto-select first doctor when groups change
  useEffect(() => {
    if (filteredGroups.length > 0 && !filteredGroups.find((g) => g.address === selectedDoctorAddr)) {
      setSelectedDoctorAddr(filteredGroups[0].address);
    }
  }, [filteredGroups, selectedDoctorAddr]);

  const selectedGroup = filteredGroups.find((g) => g.address === selectedDoctorAddr) || null;

  // Filter the grants within the selected group based on filter
  const visibleGrants = useMemo(() => {
    if (!selectedGroup) return [];
    switch (activeFilter) {
      case 'active':
        return selectedGroup.grants.filter((g) => !g.isRevoked && !g.isExpired);
      case 'revoked':
        return selectedGroup.grants.filter((g) => g.isRevoked);
      case 'expired':
        return selectedGroup.grants.filter((g) => g.isExpired && !g.isRevoked);
      default:
        return selectedGroup.grants;
    }
  }, [selectedGroup, activeFilter]);

  const handleRevokeAll = () => {
    if (!selectedGroup) return;
    selectedGroup.grants
      .filter((g) => !g.isRevoked && !g.isExpired)
      .forEach((g) => revokeAccessGrant(g.accessToken));
  };

  const handleToggle = (grant: EnrichedGrant) => {
    const key = grant.accessToken;
    const currentlyOn = toggleStates[key] !== undefined
      ? toggleStates[key]
      : !grant.isRevoked && !grant.isExpired;

    if (currentlyOn) {
      revokeAccessGrant(grant.accessToken);
    }

    setToggleStates((prev) => ({ ...prev, [key]: !currentlyOn }));
  };

  const isToggleOn = (grant: EnrichedGrant) => {
    if (grant.isRevoked) return false;
    if (grant.isExpired) return false;
    if (toggleStates[grant.accessToken] !== undefined) return toggleStates[grant.accessToken];
    return true;
  };

  const getGrantStatus = (grant: EnrichedGrant): { label: string; className: string } => {
    if (grant.isRevoked) return { label: 'Revoked', className: 'revoked' };
    if (grant.isExpired) return { label: 'Expired', className: 'expired' };
    return { label: 'Active', className: '' };
  };

  // Patient's own records for the picker
  const userRecords = useMemo(() => {
    if (!user?.address) return [];
    return records.filter((r) => r.ownerAddress === user.address);
  }, [records, user?.address]);

  const findRecord = (recordId: string) => {
    return records.find((r) => r.id === recordId || r.recordId === recordId);
  };

  const hasAnyDoctors = filteredGroups.length > 0;

  return (
    <SiteLayout mainClassName="sp-main">
      {/* Page Header */}
      <div className="sp-page-header">
        <h1>Data Sharing & Privacy</h1>
        <p className="sp-subtitle">Manage which doctors can access your medical records.</p>
      </div>

      {/* Filter Bar */}
      <div className="sp-filter-bar">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            className={`sp-filter-chip${activeFilter === chip.key ? ' active' : ''}`}
            onClick={() => setActiveFilter(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {!hasAnyDoctors ? (
        <motion.div
          className="sp-empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="sp-empty-icon">
            <ShieldIcon />
          </div>
          <h3>{activeFilter === 'all' ? 'No Registered Doctors Yet' : `No ${activeFilter === 'active' ? 'Active Shares' : activeFilter === 'revoked' ? 'Revoked Access' : 'Expired Access'}`}</h3>
          <p>
            {activeFilter === 'all'
              ? 'No doctors have registered yet. Once a doctor connects their wallet on the Doctor Portal, they will appear here.'
              : 'No doctors match this filter. Try selecting "All Doctors" to see everyone.'}
          </p>
        </motion.div>
      ) : (
        <div className="sp-sharing-layout">
          {/* Providers List */}
          <aside className="sp-providers-list">
            {filteredGroups.length === 0 ? (
              <div className="sp-no-providers">No doctors match this filter.</div>
            ) : (
              filteredGroups.map((group, i) => (
                <motion.div
                  key={group.address}
                  className={`sp-provider-item${selectedDoctorAddr === group.address ? ' active' : ''}`}
                  onClick={() => setSelectedDoctorAddr(group.address)}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeInUp}
                >
                  <div className="sp-provider-avatar-initial">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="sp-provider-info">
                    <span className="sp-provider-name">{group.name}</span>
                    <span className="sp-provider-specialty">
                      {group.specialty || (group.grants.length > 0
                        ? `${group.activeCount} active share${group.activeCount !== 1 ? 's' : ''}`
                        : 'No access')}
                    </span>
                  </div>
                  <span className={`sp-provider-status-dot${group.activeCount > 0 ? ' active' : ''}`} />
                </motion.div>
              ))
            )}
          </aside>

          {/* Permissions Card */}
          {selectedGroup && (
            <motion.section
              className="sp-permissions-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              key={selectedGroup.address}
            >
              <div className="sp-card-title-row">
                <div>
                  <h2>Permissions for {selectedGroup.name}</h2>
                  <p className="sp-subtitle" style={{ fontSize: 13 }}>
                    {selectedGroup.activeCount} active · {selectedGroup.revokedCount} revoked · {selectedGroup.expiredCount} expired
                  </p>
                </div>
                <div className="sp-card-actions">
                  <button className="sp-btn-share" onClick={() => setShowRecordPicker(true)}>
                    + Share Record
                  </button>
                  {selectedGroup.activeCount > 0 && (
                    <button className="sp-btn-revoke" onClick={handleRevokeAll}>
                      Revoke All Access
                    </button>
                  )}
                </div>
              </div>

              {/* Record Picker */}
              <AnimatePresence>
                {showRecordPicker && (
                  <motion.div
                    className="sp-record-picker"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="sp-picker-label">Select a record to share with {selectedGroup.name}:</p>
                    <div className="sp-picker-list">
                      {userRecords.length === 0 ? (
                        <p className="sp-picker-empty">No records available. Create a record first.</p>
                      ) : (
                        userRecords.map((r) => (
                          <button
                            key={r.id}
                            className="sp-picker-item"
                            onClick={() => {
                              setShareRecord(r);
                              setShowRecordPicker(false);
                              setShareModalOpen(true);
                            }}
                          >
                            <div className="sp-record-icon-small">{getRecordIcon(r.recordType)}</div>
                            <span className="sp-record-name">{getRecordDisplayData(r).title}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <button className="sp-picker-cancel" onClick={() => setShowRecordPicker(false)}>
                      Cancel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <table className="sp-records-table">
                <thead>
                  <tr>
                    <th>RECORD NAME</th>
                    <th>SHARED</th>
                    <th>STATUS</th>
                    <th>ACCESS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGrants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="sp-no-grants-cell">
                        {selectedGroup.grants.length === 0
                          ? 'No records have been shared with this doctor yet.'
                          : `No ${activeFilter !== 'all' ? activeFilter : ''} shares with this doctor.`}
                      </td>
                    </tr>
                  ) : (
                    visibleGrants.map((grant) => {
                      const record = findRecord(grant.recordId);
                      const title = record ? getRecordDisplayData(record).title : grant.recordId;
                      const recordType = record?.recordType ?? 1;
                      const status = getGrantStatus(grant);
                      const on = isToggleOn(grant);
                      const sharedDate = safeDate(grant.grantedAt);

                      return (
                        <tr key={grant.id}>
                          <td>
                            <div className="sp-record-entry">
                              <div className="sp-record-icon-small">
                                {getRecordIcon(recordType)}
                              </div>
                              <span className="sp-record-name">{title}</span>
                            </div>
                          </td>
                          <td>
                            <span className="sp-shared-date">
                              {sharedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                          <td>
                            <span className={`sp-status-badge ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td>
                            <label className="sp-access-toggle">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => handleToggle(grant)}
                                disabled={grant.isExpired}
                              />
                              <span className="sp-slider" />
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </motion.section>
          )}
        </div>
      )}
      {/* Share Record Modal — pre-filled with selected doctor */}
      <ShareRecordModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        record={shareRecord}
        prefillDoctorAddress={selectedGroup?.address}
        prefillDoctorName={selectedGroup?.name}
      />
    </SiteLayout>
  );
}
