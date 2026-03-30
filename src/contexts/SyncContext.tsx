import React, { createContext, useContext, useState, useEffect } from 'react';
import { Check, RotateCw, X, Radio } from 'lucide-react';
import { cn } from '../lib/utils';

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'FAILED' | 'OFFLINE';

interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  data?: any;
  docId?: string;
  timestamp: number;
}

interface SyncContextType {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
  lastSync: Date | null;
  setLastSync: (date: Date | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  queueOperation: (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => void;
  pendingOperations: QueuedOperation[];
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
  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>([]);

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
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingOperations]);

  const queueOperation = (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => {
    const newOp: QueuedOperation = {
      ...op,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    setPendingOperations(prev => [...prev, newOp]);
    if (status === 'OFFLINE') {
      // Logic to save to localStorage could go here
    }
  };

  const processQueue = async () => {
    if (pendingOperations.length === 0) return;
    
    setStatus('SYNCING');
    // In a real app, we would iterate through pendingOperations and call the API
    // For this demo, we'll just clear the queue after a short delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setPendingOperations([]);
    setStatus('SYNCED');
    setLastSync(new Date());
  };

  return (
    <SyncContext.Provider value={{ 
      status, setStatus, lastSync, setLastSync, error, setError, 
      queueOperation, pendingOperations 
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const SyncStatusIndicator: React.FC = () => {
  const { status, error } = useSync();

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
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
      config.bgColor,
      config.borderColor,
      config.color
    )}>
      {config.icon}
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
};
