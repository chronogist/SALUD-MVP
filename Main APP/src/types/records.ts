/**
 * Record type definitions for the Salud application
 */

export type RecordType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface RecordTypeInfo {
  id: RecordType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const RECORD_TYPES: Record<RecordType, RecordTypeInfo> = {
  1: {
    id: 1,
    name: 'General Health',
    description: 'General health checkups and assessments',
    icon: 'Heart',
    color: 'primary',
  },
  2: {
    id: 2,
    name: 'Laboratory Results',
    description: 'Blood tests, urine analysis, and other lab work',
    icon: 'TestTube',
    color: 'success',
  },
  3: {
    id: 3,
    name: 'Prescription',
    description: 'Medication prescriptions and dosage information',
    icon: 'Pill',
    color: 'warning',
  },
  4: {
    id: 4,
    name: 'Imaging',
    description: 'X-rays, MRI, CT scans, and ultrasounds',
    icon: 'Scan',
    color: 'aleo',
  },
  5: {
    id: 5,
    name: 'Vaccination',
    description: 'Immunization records and vaccine history',
    icon: 'Syringe',
    color: 'danger',
  },
  6: {
    id: 6,
    name: 'Surgical',
    description: 'Surgery records and post-operative notes',
    icon: 'Scissors',
    color: 'cyan',
  },
  7: {
    id: 7,
    name: 'Mental Health',
    description: 'Psychological assessments and therapy notes',
    icon: 'Brain',
    color: 'violet',
  },
  8: {
    id: 8,
    name: 'Dental',
    description: 'Dental examinations and treatments',
    icon: 'Smile',
    color: 'pink',
  },
  9: {
    id: 9,
    name: 'Vision',
    description: 'Eye exams and vision prescriptions',
    icon: 'Eye',
    color: 'teal',
  },
  10: {
    id: 10,
    name: 'Other',
    description: 'Other medical records',
    icon: 'FileText',
    color: 'slate',
  },
};

/**
 * Medical record interface
 */
export interface MedicalRecord {
  id: string;
  recordId: string; // On-chain record ID (field)
  title: string;
  description: string;
  recordType: RecordType;
  data: string; // Encrypted data (base64)
  dataHash: string;
  createdAt: Date;
  updatedAt: Date;
  isEncrypted: boolean;
  ownerAddress: string; // Wallet address that created this record
  recordPlaintext?: string; // Raw Aleo record plaintext (needed for share_record input)
  recordCiphertext?: string; // Raw Aleo record ciphertext
}

/**
 * Access grant interface
 */
export interface AccessGrant {
  id: string;
  accessToken: string;
  recordId: string;
  patientAddress: string;
  doctorAddress: string;
  grantedAt: Date;
  expiresAt: Date;
  durationBlocks: number;
  isRevoked: boolean;
  isExpired: boolean;
}

/**
 * QR code data structure for sharing (v2 — no medical data, just references)
 *
 * The actual medical data is transferred on-chain via Aleo's native record
 * ownership model. The QR code only contains enough info for the doctor
 * to locate and verify their shared record.
 */
export interface QRCodeData {
  version: 2;
  transactionId: string; // The share_record transaction ID
  accessToken: string; // On-chain access token (field) for verification
  recordId: string; // Which record was shared
  patientAddress: string; // Who shared it
  expiresAt: number; // Client-calculated expiration (Unix ms)
  recordType: RecordType; // Record category for display
}

/**
 * User/Wallet interface
 */
export type UserRole = 'patient' | 'doctor';

export interface User {
  address: string;
  name?: string;
  viewKey?: string;
  isConnected: boolean;
  balance?: number;
  role: UserRole;
}

export function getRecordDisplayData(record: MedicalRecord): { title: string; description: string } {
  let title = record.title;
  let description = record.description;

  const extractFrom = (value?: string | null): { title?: string; description?: string } => {
    if (!value) return {};
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return {
          title: (parsed as any).title || (parsed as any).t,
          description: (parsed as any).description || (parsed as any).d,
        };
      }
    } catch {
    }

    const titleMatch = trimmed.match(/"title"\s*:\s*"([^"]*)/) || trimmed.match(/"t"\s*:\s*"([^"]*)/);
    const descriptionMatch = trimmed.match(/"description"\s*:\s*"([^"]*)/) || trimmed.match(/"d"\s*:\s*"([^"]*)/);

    return {
      title: titleMatch ? titleMatch[1] : undefined,
      description: descriptionMatch ? descriptionMatch[1] : undefined,
    };
  };

  const fromData = extractFrom(record.data);
  const fromTitle = extractFrom(title);

  const resolvedTitle = fromTitle.title || fromData.title;
  const resolvedDescription = fromData.description || fromTitle.description;

  if (resolvedTitle) {
    title = resolvedTitle;
  }

  if (resolvedDescription) {
    description = resolvedDescription;
  }

  return { title, description };
}

/**
 * Transaction status
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
  id: string;
  type: 'create_record' | 'grant_access' | 'revoke_access' | 'verify_access';
  status: TransactionStatus;
  hash?: string;
  createdAt: Date;
  confirmedAt?: Date;
  error?: string;
}

/**
 * App-wide notification
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

/**
 * Duration options for access grants
 */
export interface DurationOption {
  label: string;
  blocks: number;
  description: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '1 Hour', blocks: 240, description: 'Quick consultation' },
  { label: '4 Hours', blocks: 960, description: 'Extended appointment' },
  { label: '12 Hours', blocks: 2880, description: 'Half day access' },
  { label: '24 Hours', blocks: 5760, description: 'Full day access' },
  { label: '3 Days', blocks: 17280, description: 'Multi-day care' },
  { label: '7 Days', blocks: 40320, description: 'Extended care (max)' },
];
