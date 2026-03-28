import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MedicalRecord, AccessGrant, User, RecordType, UserRole } from '@/types/records';

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

interface RecordsState {
  records: MedicalRecord[];
  accessGrants: AccessGrant[];
  isLoading: boolean;
  isFetchingFromChain: boolean;
  lastSyncAt: Date | null;
  onchainCount: number | null;
  error: string | null;
  
  addRecord: (record: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>) => MedicalRecord;
  updateRecord: (id: string, updates: Partial<MedicalRecord>) => void;
  deleteRecord: (id: string) => void;
  getRecordById: (id: string) => MedicalRecord | undefined;
  getRecordsByType: (type: RecordType) => MedicalRecord[];
  getRecordsByOwner: (ownerAddress: string) => MedicalRecord[];
  syncRecords: (onchainRecords: MedicalRecord[]) => void;
  setOnchainCount: (count: number) => void;
  
  createAccessGrant: (grant: Omit<AccessGrant, 'id' | 'isExpired'>) => AccessGrant;
  revokeAccessGrant: (accessToken: string) => void;
  getActiveGrants: () => AccessGrant[];
  getGrantsByRecordId: (recordId: string) => AccessGrant[];
  
  setLoading: (loading: boolean) => void;
  setFetchingFromChain: (fetching: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearRecords: () => void;
}

export const useRecordsStore = create<RecordsState>()(
  persist(
    (set, get) => ({
      records: [],
      accessGrants: [],
      isLoading: false,
      isFetchingFromChain: false,
      lastSyncAt: null,
      onchainCount: null,
      error: null,

      addRecord: (record) => {
        try {
          const newRecord: MedicalRecord = {
            ...record,
            id: generateId(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            records: [newRecord, ...state.records],
          }));
          
          return newRecord;
        } catch (error) {
          console.error('Error adding record:', error);
          get().setError('Failed to add record');
          throw error;
        }
      },

      getRecordsByOwner: (ownerAddress: string) => {
        return get().records.filter((record) => record.ownerAddress === ownerAddress);
      },

      updateRecord: (id, updates) => {
        set((state) => ({
          records: state.records.map((record) =>
            record.id === id ? { ...record, ...updates, updatedAt: new Date() } : record
          ),
        }));
      },

      deleteRecord: (id) => {
        set((state) => ({
          records: state.records.filter((record) => record.id !== id),
        }));
      },

      getRecordById: (id) => {
        return get().records.find((record) => record.id === id);
      },

      getRecordsByType: (type) => {
        return get().records.filter((record) => record.recordType === type);
      },

      syncRecords: (onchainRecords: MedicalRecord[]) => {
        set((state) => {
          const onchainMap = new Map(onchainRecords.map(r => [r.recordId, r]));

          // Update existing records with plaintext/ciphertext if missing
          const updatedRecords = state.records.map((existing) => {
            const onchain = onchainMap.get(existing.recordId);
            if (onchain) {
              onchainMap.delete(existing.recordId);
              return {
                ...existing,
                recordPlaintext: existing.recordPlaintext || onchain.recordPlaintext,
                recordCiphertext: existing.recordCiphertext || onchain.recordCiphertext,
                data: existing.data === '' || !existing.data ? onchain.data : existing.data,
              };
            }
            return existing;
          });

          // Add any truly new records
          const newRecords = Array.from(onchainMap.values());

          return {
            records: [...newRecords, ...updatedRecords],
            lastSyncAt: new Date(),
          };
        });
      },

      setOnchainCount: (count: number) => {
        set({ onchainCount: count });
      },
      
      createAccessGrant: (grant) => {
        const newGrant: AccessGrant = {
          ...grant,
          id: generateId(),
          isExpired: false,
        };
        
        set((state) => ({
          accessGrants: [newGrant, ...state.accessGrants],
        }));
        
        return newGrant;
      },
      
      revokeAccessGrant: (accessToken) => {
        set((state) => ({
          accessGrants: state.accessGrants.map((grant) =>
            grant.accessToken === accessToken ? { ...grant, isRevoked: true } : grant
          ),
        }));
      },
      
      getActiveGrants: () => {
        return get().accessGrants.filter(
          (grant) => !grant.isRevoked && !grant.isExpired
        );
      },
      
      getGrantsByRecordId: (recordId) => {
        return get().accessGrants.filter((grant) => grant.recordId === recordId);
      },

      setLoading: (isLoading) => set({ isLoading }),
      setFetchingFromChain: (isFetchingFromChain) => set({ isFetchingFromChain }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      clearRecords: () => {
        set({ records: [], accessGrants: [] });
        localStorage.removeItem('salud-records-storage');
      },
      hardReset: () => {
        localStorage.removeItem('salud-records-storage');
        localStorage.removeItem('salud-user-storage');
        set({ records: [], accessGrants: [], error: null });
      },
    }),
    {
      name: 'salud-records-storage',
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate storage:', error);
          localStorage.removeItem('salud-records-storage');
        }
      },
      partialize: (state) => {
        try {
          return {
            records: state.records,
            accessGrants: state.accessGrants,
            lastSyncAt: state.lastSyncAt,
          };
        } catch {
          return { records: [], accessGrants: [], lastSyncAt: null };
        }
      },
    }
  )
);

// User store
interface UserState {
  user: User | null;
  isConnecting: boolean;

  // Actions
  connect: (address: string, viewKey?: string, name?: string) => void;
  disconnect: () => void;
  setBalance: (balance: number) => void;
  setName: (name: string) => void;
  setRole: (role: UserRole) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isConnecting: false,

      connect: (address, viewKey, name) => {
        set((state) => ({
          user: {
            address,
            name,
            viewKey,
            isConnected: true,
            role: state.user?.role || 'patient',
          },
          isConnecting: false,
        }));
      },

      disconnect: () => {
        set({ user: null });
      },

      setBalance: (balance) => {
        set((state) => ({
          user: state.user ? { ...state.user, balance } : null,
        }));
      },

      setName: (name) => {
        set((state) => ({
          user: state.user ? { ...state.user, name } : null,
        }));
      },

      setRole: (role) => {
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
        }));
      },
      hardReset: () => {
        localStorage.removeItem('salud-user-storage');
        localStorage.removeItem('salud-records-storage');
        set({ user: null });
      },
    }),
    {
      name: 'salud-user-storage',
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to rehydrate user storage:', error);
          localStorage.removeItem('salud-user-storage');
        }
      },
    }
  )
);

// UI state store (non-persistent)
interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  selectedRecordId: string | null;
  
  // Actions
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  selectRecord: (recordId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  selectedRecordId: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  selectRecord: (recordId) => set({ selectedRecordId: recordId }),
}));
