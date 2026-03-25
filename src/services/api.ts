import { Transaction, Entity, AuditLog } from '../lib/data';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, writeBatch } from 'firebase/firestore';

// Helper to simulate network delay for auth
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanPayload<T extends Record<string, any>>(payload: T): T {
  const cleaned = { ...payload };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined || cleaned[key] === null) {
      delete cleaned[key];
    }
  });
  return cleaned;
}

export const api = {
  async verifyPassword(password: string, target: 'saisie' | 'parametres'): Promise<{ success: boolean; message?: string }> {
    await delay(300);
    if (password === 'password2026') {
      return { success: true };
    }
    return { success: false, message: "Mot de passe incorrect" };
  },

  async getTransactions(): Promise<Transaction[]> {
    try {
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, date: new Date(data.date) } as Transaction;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      return [];
    }
  },

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    try {
      const payload = cleanPayload({ ...transaction });
      if (payload.date instanceof Date) {
        (payload as any).date = payload.date.toISOString();
      }
      const docRef = await addDoc(collection(db, 'transactions'), payload);
      return { ...payload, id: docRef.id, date: new Date((payload as any).date) } as Transaction;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
      throw error;
    }
  },

  async createTransactions(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
    try {
      const batch = writeBatch(db);
      const savedTxs: Transaction[] = [];
      
      transactions.forEach(t => {
        const payload = cleanPayload({ ...t });
        if (payload.date instanceof Date) {
          (payload as any).date = payload.date.toISOString();
        }
        const docRef = doc(collection(db, 'transactions'));
        batch.set(docRef, payload);
        savedTxs.push({ ...payload, id: docRef.id, date: new Date((payload as any).date) } as Transaction);
      });
      
      await batch.commit();
      return savedTxs;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
      throw error;
    }
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    try {
      const payload = cleanPayload({ ...updates });
      if (payload.date instanceof Date) {
        (payload as any).date = payload.date.toISOString();
      }
      const docRef = doc(db, 'transactions', id);
      await updateDoc(docRef, payload);
      return { ...payload, id, date: payload.date ? new Date((payload as any).date) : new Date() } as Transaction;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      throw error;
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
      throw error;
    }
  },

  async getEntities(): Promise<Entity[]> {
    try {
      const q = query(collection(db, 'entities'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Entity));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'entities');
      return [];
    }
  },

  async saveEntity(entity: Partial<Entity>): Promise<Entity> {
    try {
      const payload = cleanPayload({ ...entity });
      if (payload.id) {
        const docRef = doc(db, 'entities', payload.id);
        await updateDoc(docRef, payload);
        return { ...payload } as Entity;
      } else {
        const docRef = await addDoc(collection(db, 'entities'), payload);
        return { ...payload, id: docRef.id } as Entity;
      }
    } catch (error) {
      handleFirestoreError(error, entity.id ? OperationType.UPDATE : OperationType.CREATE, 'entities');
      throw error;
    }
  },

  async deleteEntity(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'entities', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `entities/${id}`);
      throw error;
    }
  },

  async getLogs(): Promise<AuditLog[]> {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, timestamp: new Date(data.timestamp) } as AuditLog;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      return [];
    }
  },

  async addLog(log: Partial<AuditLog>): Promise<AuditLog> {
    try {
      const payload = cleanPayload({ 
        timestamp: new Date(),
        ...log 
      });
      if (payload.timestamp instanceof Date) {
        (payload as any).timestamp = payload.timestamp.toISOString();
      }
      const docRef = await addDoc(collection(db, 'audit_logs'), payload);
      return { ...payload, id: docRef.id, timestamp: new Date((payload as any).timestamp) } as AuditLog;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
      throw error;
    }
  },
};
