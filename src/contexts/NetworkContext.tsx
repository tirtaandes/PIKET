import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { NetworkSyncState, PendingOfflineTransaction } from '../types';
import { getAllPendingTransactions } from '../lib/offlineDb';
import { syncPendingOfflineQueue } from '../lib/offlineSync';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface NetworkContextValue {
  isOnline: boolean;
  syncState: NetworkSyncState;
  pendingCount: number;
  failedCount: number;
  transactions: PendingOfflineTransaction[];
  refreshQueue: () => Promise<void>;
  triggerSyncNow: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<PendingOfflineTransaction[]>([]);

  const refreshQueue = useCallback(async () => {
    try {
      const all = await getAllPendingTransactions();
      setTransactions(all);
    } catch {
      setTransactions([]);
    }
  }, []);

  const triggerSyncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing || !profile) return;
    const all = await getAllPendingTransactions();
    const unsynced = all.filter((t) => t.syncStatus === 'PENDING_SYNC' || t.syncStatus === 'FAILED');
    if (unsynced.length === 0) return;

    setIsSyncing(true);
    try {
      const res = await syncPendingOfflineQueue();
      await refreshQueue();
      if (res.totalProcessed > 0) {
        showToast(
          res.rejectedCount > 0 ? 'warning' : 'success',
          'Sinkronisasi Offline Selesai',
          `${res.syncedCount} berhasil, ${res.duplicateCount} duplikat, ${res.rejectedCount} ditolak.`
        );
      }
    } catch (err) {
      await refreshQueue();
      showToast(
        'error',
        'Gagal Sinkronisasi Offline',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat sinkronisasi.'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, profile, refreshQueue, showToast]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      triggerSyncNow();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [triggerSyncNow]);

  const pendingCount = transactions.filter((t) => t.syncStatus === 'PENDING_SYNC').length;
  const failedCount = transactions.filter(
    (t) => t.syncStatus === 'FAILED' || t.syncStatus === 'REJECTED'
  ).length;

  let syncState: NetworkSyncState = 'ONLINE';
  if (!isOnline) syncState = 'OFFLINE';
  else if (isSyncing) syncState = 'SYNCING';
  else if (failedCount > 0) syncState = 'FAILED';
  else if (pendingCount > 0) syncState = 'PENDING';

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        syncState,
        pendingCount,
        failedCount,
        transactions,
        refreshQueue,
        triggerSyncNow
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}
