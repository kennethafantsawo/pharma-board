import { Transaction, Entity, AuditLog, Backup } from '../lib/data';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, writeBatch, where, setDoc, getDoc, getDocFromServer } from 'firebase/firestore';

// Helper to simulate network delay for auth
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.code === 'unavailable' || error.code === 'deadline-exceeded')) {
      await delay(1000 * (4 - retries));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

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
      const docRef = await withRetry(() => addDoc(collection(db, 'transactions'), payload));
      
      // Verification
      const verifySnap = await withRetry(() => getDocFromServer(docRef));
      if (!verifySnap.exists()) {
        throw new Error("La transaction n'a pas pu être vérifiée dans Firestore");
      }

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
      
      await withRetry(() => batch.commit());
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
      await withRetry(() => updateDoc(docRef, payload));
      
      // Verification
      const verifySnap = await withRetry(() => getDocFromServer(docRef));
      const data = verifySnap.data();
      // Check if at least one updated field matches
      const firstKey = Object.keys(payload)[0];
      if (firstKey && data && data[firstKey] !== payload[firstKey]) {
        throw new Error("La mise à jour n'a pas pu être vérifiée dans Firestore");
      }

      return { ...payload, id, date: payload.date ? new Date((payload as any).date) : new Date() } as Transaction;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      throw error;
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'transactions', id);
      await withRetry(() => deleteDoc(docRef));
      
      // Verification
      const verifySnap = await withRetry(() => getDocFromServer(docRef));
      if (verifySnap.exists()) {
        throw new Error("La suppression n'a pas pu être vérifiée dans Firestore");
      }
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
        await withRetry(() => updateDoc(docRef, payload));
        
        // Verification
        const verifySnap = await withRetry(() => getDocFromServer(docRef));
        const data = verifySnap.data();
        if (data && data.name !== payload.name) {
          throw new Error("La mise à jour du fournisseur n'a pas pu être vérifiée");
        }

        return { ...payload } as Entity;
      } else {
        const docRef = await withRetry(() => addDoc(collection(db, 'entities'), payload));
        
        // Verification
        const verifySnap = await withRetry(() => getDocFromServer(docRef));
        if (!verifySnap.exists()) {
          throw new Error("La création du fournisseur n'a pas pu être vérifiée");
        }

        return { ...payload, id: docRef.id } as Entity;
      }
    } catch (error) {
      handleFirestoreError(error, entity.id ? OperationType.UPDATE : OperationType.CREATE, 'entities');
      throw error;
    }
  },

  async deleteEntity(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'entities', id);
      await withRetry(() => deleteDoc(docRef));
      
      // Verification
      const verifySnap = await withRetry(() => getDocFromServer(docRef));
      if (verifySnap.exists()) {
        throw new Error("La suppression du fournisseur n'a pas pu être vérifiée");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `entities/${id}`);
      throw error;
    }
  },

  async getUser(uid: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  },

  async createUser(user: any): Promise<any> {
    try {
      const payload = cleanPayload({ ...user });
      await withRetry(() => setDoc(doc(db, 'users', user.uid), payload));
      return payload;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
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
      const docRef = await withRetry(() => addDoc(collection(db, 'audit_logs'), payload));
      return { ...payload, id: docRef.id, timestamp: new Date((payload as any).timestamp) } as AuditLog;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
      throw error;
    }
  },

  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection successful.");
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. The client is offline.");
      }
      // Skip logging for other errors, as this is simply a connection test.
    }
  },

  async getBackups(): Promise<Backup[]> {
    try {
      const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data, 
          id: doc.id, 
          timestamp: new Date(data.timestamp),
          transactions: data.transactions.map((t: any) => ({ ...t, date: new Date(t.date) }))
        } as Backup;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'backups');
      return [];
    }
  },

  async createBackup(name: string, type: 'AUTO' | 'MANUAL' = 'MANUAL'): Promise<Backup> {
    try {
      const [transactions, entities] = await Promise.all([
        this.getTransactions(),
        this.getEntities()
      ]);
      
      const payload = {
        name,
        type,
        timestamp: new Date().toISOString(),
        createdBy: auth.currentUser?.email || 'System',
        transactions: transactions.map(t => ({ ...t, date: t.date.toISOString() })),
        entities: entities
      };
      
      const docRef = await withRetry(() => addDoc(collection(db, 'backups'), payload));
      
      await this.addLog({
        action: 'BACKUP',
        targetType: 'SYSTEM',
        targetId: docRef.id,
        details: `Sauvegarde ${type} créée: ${name}`
      });
      
      return { ...payload, id: docRef.id, timestamp: new Date(payload.timestamp), transactions, entities } as Backup;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'backups');
      throw error;
    }
  },

  async restoreBackup(backup: Backup): Promise<void> {
    try {
      // Note: writeBatch has a 500 operations limit.
      // For a more robust solution, we should use multiple batches.
      
      // 1. Delete all current transactions
      const currentTxs = await this.getTransactions();
      const txChunks = [];
      for (let i = 0; i < currentTxs.length; i += 450) {
        txChunks.push(currentTxs.slice(i, i + 450));
      }
      
      for (const chunk of txChunks) {
        const batch = writeBatch(db);
        chunk.forEach(t => batch.delete(doc(db, 'transactions', t.id)));
        await withRetry(() => batch.commit());
      }
      
      // 2. Delete all current entities
      const currentEntities = await this.getEntities();
      const entBatch = writeBatch(db);
      currentEntities.forEach(e => entBatch.delete(doc(db, 'entities', e.id)));
      await withRetry(() => entBatch.commit());
      
      // 3. Add transactions from backup
      const backupTxChunks = [];
      for (let i = 0; i < backup.transactions.length; i += 450) {
        backupTxChunks.push(backup.transactions.slice(i, i + 450));
      }
      
      for (const chunk of backupTxChunks) {
        const batch = writeBatch(db);
        chunk.forEach(t => {
          const { id, ...data } = t;
          const payload = { ...data, date: data.date.toISOString() };
          batch.set(doc(collection(db, 'transactions')), payload);
        });
        await withRetry(() => batch.commit());
      }
      
      // 4. Add entities from backup
      const entAddBatch = writeBatch(db);
      backup.entities.forEach(e => {
        const { id, ...data } = e;
        entAddBatch.set(doc(collection(db, 'entities')), data);
      });
      await withRetry(() => entAddBatch.commit());
      
      await this.addLog({
        action: 'RESTORATION',
        targetType: 'SYSTEM',
        targetId: backup.id,
        details: `Restauration effectuée à partir de la sauvegarde: ${backup.name}`
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'restoration');
      throw error;
    }
  },

  async checkAndCreateDailyBackup(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // We check for any AUTO backup created today
      const q = query(
        collection(db, 'backups'), 
        where('type', '==', 'AUTO'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      let shouldBackup = true;
      
      if (!querySnapshot.empty) {
        const lastBackup = querySnapshot.docs[0].data();
        const lastBackupDate = new Date(lastBackup.timestamp);
        lastBackupDate.setHours(0, 0, 0, 0);
        
        if (lastBackupDate.getTime() === today.getTime()) {
          shouldBackup = false;
        }
      }
      
      if (shouldBackup) {
        const name = `Sauvegarde Automatique - ${today.toLocaleDateString('fr-FR')}`;
        await this.createBackup(name, 'AUTO');
      }
    } catch (error) {
      console.error('Failed to check/create daily backup:', error);
    }
  }
};
