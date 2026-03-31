import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Check, RotateCw, X, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/api';

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'FAILED' | 'OFFLINE';

interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  data?: any;
  docId?: string;
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'offline_sync_queue';

interface SyncContextType {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
  lastSync: Date | null;
  setLastSync: (date: Date | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  queueOperation: (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => void;
  pendingOperations: QueuedOperation[];
  processQueue: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>('SYNCED');
  const [lastSync, setLastSync] = useState<Date | null>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>(() => {
    const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const pendingOpsRef = React.useRef(pendingOperations);
  const isProcessingRef = React.useRef(false);

  useEffect(() => {
    pendingOpsRef.current = pendingOperations;
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(pendingOperations));
  }, [pendingOperations]);

  const processQueue = useCallback(async () => {
    const opsToProcess = pendingOpsRef.current;
    if (opsToProcess.length === 0 || !navigator.onLine || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setStatus('SYNCING');
    
    let successCount = 0;
    const failedOps: QueuedOperation[] = [];

    for (const op of opsToProcess) {
      try {
        if (op.collection === 'transactions') {
          if (op.type === 'CREATE') {
            if (Array.isArray(op.data)) {
              await api.createTransactions(op.data);
            } else {
              await api.createTransaction(op.data);
            }
          }
          else if (op.type === 'UPDATE' && op.docId) await api.updateTransaction(op.docId, op.data);
          else if (op.type === 'DELETE' && op.docId) await api.deleteTransaction(op.docId);
        } else if (op.collection === 'entities') {
          if (op.type === 'CREATE') await api.saveEntity(op.data);
          else if (op.type === 'UPDATE' && op.docId) await api.saveEntity({ ...op.data, id: op.docId });
          else if (op.type === 'DELETE' && op.docId) await api.deleteEntity(op.docId);
        } else if (op.collection === 'audit_logs') {
          if (op.type === 'CREATE') await api.addLog(op.data);
        } else if (op.collection === 'backups') {
          if (op.type === 'CREATE') await api.createBackup(op.data.name, op.data.type);
        }
        successCount++;
      } catch (err) {
        console.error('Failed to process queued operation:', op, err);
        failedOps.push(op);
      }
    }

    setPendingOperations(failedOps);
    
    if (failedOps.length > 0) {
      setStatus('FAILED');
      setError(`${failedOps.length} opérations ont échoué lors de la synchronisation.`);
    } else {
      setStatus('SYNCED');
      setLastSync(new Date());
      setError(null);
    }
    
    isProcessingRef.current = false;
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('SYNCED');
      processQueue();
    };
    const handleOffline = () => setStatus('OFFLINE');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setStatus('OFFLINE');
    } else {
      // Use a timeout to avoid immediate execution on every render
      const timer = setTimeout(() => {
        if (pendingOpsRef.current.length > 0) {
          processQueue();
        }
      }, 1000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  const queueOperation = (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => {
    const newOp: QueuedOperation = {
      ...op,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    setPendingOperations(prev => [...prev, newOp]);
  };

  return (
    <SyncContext.Provider value={{ 
      status, setStatus, lastSync, setLastSync, error, setError, 
      queueOperation, pendingOperations, processQueue 
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const SyncStatusIndicator: React.FC = () => {
  const { status, error, processQueue } = useSync();

  const getStatusConfig = () => {
    switch (status) {
      case 'SYNCED':
        return {
          icon: <Check size={14} className="text-emerald-500" />,
          text: 'Données synchronisées',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20'
        };
      case 'SYNCING':
        return {
          icon: <RotateCw size={14} className="text-amber-500 animate-spin" />,
          text: 'Synchronisation en cours...',
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20'
        };
      case 'FAILED':
        return {
          icon: <X size={14} className="text-red-500" />,
          text: error || 'Erreur de synchronisation',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20'
        };
      case 'OFFLINE':
        return {
          icon: <Radio size={14} className="text-slate-500" />,
          text: 'Connexion perdue',
          color: 'text-slate-500',
          bgColor: 'bg-slate-500/10',
          borderColor: 'border-slate-500/20'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
        config.bgColor,
        config.borderColor,
        config.color
      )}>
        {config.icon}
        <span className="hidden sm:inline">{config.text}</span>
      </div>
      {status === 'FAILED' && (
        <button 
          onClick={() => processQueue()}
          className="p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          title="Réessayer la synchronisation"
        >
          <RotateCw size={14} />
        </button>
      )}
    </div>
  );
};
