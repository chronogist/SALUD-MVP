import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { useRecordsStore, useUserStore } from '@/store';
import { getRecordDisplayData } from '@/types/records';
import type { AccessGrant } from '@/types/records';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { PROGRAM_ID, prepareRevokeAccessInputs } from '@/lib/aleo-utils';
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

// Demo providers for the design
const DEMO_PROVIDERS = [
  {
    id: 'aris',
    name: 'Dr. Aris Thorne',
    specialty: 'Primary Care',
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 'chen',
    name: 'Dr. Elena Chen',
    specialty: 'Cardiology',
    avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 'miller',
    name: 'Dr. Marcus Miller',
    specialty: 'Radiology',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=150&h=150',
  },
];

const FILTER_CHIPS = ['All Providers', 'Active Share', 'Revoked', 'Expired Access'];

// --- Helper ---

function safeDate(date: Date | string | number | undefined): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  try { return new Date(date); } catch { return new Date(); }
}

// --- Main Page ---

export function SharedAccessPage() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [activeProvider, setActiveProvider] = useState(0);
  const [_revokingToken, setRevokingToken] = useState<string | null>(null);
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});

  const user = useUserStore((state) => state.user);
  const accessGrants = useRecordsStore((state) => state.accessGrants);
  const records = useRecordsStore((state) => state.records);
  const revokeAccessGrant = useRecordsStore((state) => state.revokeAccessGrant);
  const { executeTransaction } = useWallet();

  // Get user's records for the permissions table
  const userRecords = useMemo(() => {
    if (!user?.address) return [];
    return records.filter((r) => r.ownerAddress === user.address);
  }, [records, user?.address]);

  // Get grants grouped info
  const userGrants = useMemo(() => {
    return accessGrants
      .filter((g) => g.patientAddress === user?.address)
      .map((g) => ({
        ...g,
        isExpired: safeDate(g.expiresAt) < new Date(),
      }));
  }, [accessGrants, user?.address]);

  const _handleRevoke = async (accessToken: string) => {
    setRevokingToken(accessToken);
    try {
      const inputs = prepareRevokeAccessInputs(accessToken);
      await executeTransaction({
        program: PROGRAM_ID,
        function: 'revoke_access',
        inputs,
        fee: 50000,
        privateFee: false,
      });
      revokeAccessGrant(accessToken);
    } catch (error) {
      console.error('Revoke error:', error);
      revokeAccessGrant(accessToken);
    } finally {
      setRevokingToken(null);
    }
  };

  const handleRevokeAll = () => {
    const activeTokens = userGrants
      .filter((g) => !g.isRevoked && !g.isExpired)
      .map((g) => g.accessToken);
    activeTokens.forEach((token) => revokeAccessGrant(token));
  };

  const handleToggle = (recordId: string) => {
    setToggleStates((prev) => ({
      ...prev,
      [recordId]: prev[recordId] === undefined ? false : !prev[recordId],
    }));
  };

  const isToggleOn = (recordId: string, grant?: AccessGrant & { isExpired: boolean }) => {
    if (toggleStates[recordId] !== undefined) return toggleStates[recordId];
    if (grant) return !grant.isRevoked && !grant.isExpired;
    return true;
  };

  const provider = DEMO_PROVIDERS[activeProvider];

  const _getRecordTitle = (recordId: string) => {
    const record = records.find((r) => r.recordId === recordId || r.id === recordId);
    return record?.title || 'Unknown Record';
  };

  const _getRecordType = (recordId: string) => {
    const record = records.find((r) => r.recordId === recordId || r.id === recordId);
    return record?.recordType || 1;
  };

  return (
    <SiteLayout mainClassName="sp-main">
      {/* Page Header */}
      <div className="sp-page-header">
        <h1>Data Sharing & Privacy</h1>
        <p className="sp-subtitle">Manage which health professionals can access your medical records.</p>
      </div>

      {/* Filter Bar */}
      <div className="sp-filter-bar">
        {FILTER_CHIPS.map((chip, i) => (
          <button
            key={chip}
            className={`sp-filter-chip${activeFilter === i ? ' active' : ''}`}
            onClick={() => setActiveFilter(i)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="sp-sharing-layout">
        {/* Providers List */}
        <aside className="sp-providers-list">
          {DEMO_PROVIDERS.map((p, i) => (
            <motion.div
              key={p.id}
              className={`sp-provider-item${activeProvider === i ? ' active' : ''}`}
              onClick={() => setActiveProvider(i)}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
            >
              <img src={p.avatar} className="sp-provider-avatar" alt={p.name} />
              <div className="sp-provider-info">
                <span className="sp-provider-name">{p.name}</span>
                <span className="sp-provider-specialty">{p.specialty}</span>
              </div>
            </motion.div>
          ))}
        </aside>

        {/* Permissions Card */}
        <motion.section
          className="sp-permissions-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          key={activeProvider}
        >
          <div className="sp-card-title-row">
            <div>
              <h2>Permissions for {provider.name.split(' ').pop()}</h2>
              <p className="sp-subtitle" style={{ fontSize: 13 }}>Last accessed: Today at 09:42 AM</p>
            </div>
            <button className="sp-btn-revoke" onClick={handleRevokeAll}>
              Revoke All Access
            </button>
          </div>

          <table className="sp-records-table">
            <thead>
              <tr>
                <th>RECORD NAME</th>
                <th>PERMISSION LEVEL</th>
                <th>STATUS</th>
                <th>ACCESS</th>
              </tr>
            </thead>
            <tbody>
              {userRecords.length > 0 ? (
                userRecords.map((record) => {
                  const grant = userGrants.find((g) => g.recordId === record.id || g.recordId === record.recordId);
                  const isActive = isToggleOn(record.id, grant as any);

                  return (
                    <tr key={record.id}>
                      <td>
                        <div className="sp-record-entry">
                          <div className="sp-record-icon-small">
                            {getRecordIcon(record.recordType)}
                          </div>
                          <span className="sp-record-name">{getRecordDisplayData(record).title}</span>
                        </div>
                      </td>
                      <td>
                        <div className="sp-permission-type">
                          <select defaultValue={grant ? 'view' : 'full'}>
                            <option value="full">Full Access</option>
                            <option value="view">View Only</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <span className={`sp-status-badge${!isActive ? ' hidden' : ''}`}>
                          {isActive ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td>
                        <label className="sp-access-toggle">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleToggle(record.id)}
                          />
                          <span className="sp-slider" />
                        </label>
                      </td>
                    </tr>
                  );
                })
              ) : (
                /* Show demo data when no records */
                <>
                  {[
                    { name: 'Q3 Blood Panel', icon: <FileIcon />, perm: 'Full Access', active: true },
                    { name: 'MRI Scan Images', icon: <ImageIcon />, perm: 'View Only', active: true },
                    { name: 'ECG Results', icon: <HeartbeatIcon />, perm: 'View Only', active: false },
                    { name: 'Vaccination History', icon: <ShieldIcon />, perm: 'Full Access', active: true },
                  ].map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div className="sp-record-entry">
                          <div className="sp-record-icon-small">{item.icon}</div>
                          <span className="sp-record-name">{item.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="sp-permission-type">
                          <select defaultValue={item.perm}>
                            <option>Full Access</option>
                            <option>View Only</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <span className={`sp-status-badge${!item.active ? ' hidden' : ''}`}>
                          {item.active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td>
                        <label className="sp-access-toggle">
                          <input type="checkbox" defaultChecked={item.active} />
                          <span className="sp-slider" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </motion.section>
      </div>
    </SiteLayout>
  );
}
