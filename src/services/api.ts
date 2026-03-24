import { Transaction, Entity, AuditLog } from '../lib/data';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get data from localStorage
const getLocalData = <T>(key: string, defaultValue: T[]): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

// Helper to save data to localStorage
const setLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const api = {
  async verifyPassword(password: string, target: 'saisie' | 'parametres'): Promise<{ success: boolean; message?: string }> {
    await delay(300);
    if (password === 'password2026') {
      return { success: true };
    }
    return { success: false, message: "Mot de passe incorrect" };
  },

  async login(user: string, pass: string): Promise<{ success: boolean; message?: string }> {
    await delay(500);
    const normalizedUser = user.toLowerCase().trim();
    
    if (normalizedUser === 'directrice' && pass === 'Pharma2026') {
      return { success: true };
    }
    if (normalizedUser === 'assistant' && pass === 'Docteur2026') {
      return { success: true };
    }
    
    return { success: false, message: "Identifiants ou mot de passe incorrects" };
  },

  async getTransactions(): Promise<Transaction[]> {
    await delay(200);
    const data = getLocalData<any>('pharmacy_transactions', []);
    return data.map(t => ({ ...t, date: new Date(t.date) }));
  },

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    await delay(300);
    const transactions = await this.getTransactions();
    const newTx = { 
      ...transaction, 
      id: crypto.randomUUID(),
      date: transaction.date || new Date()
    } as Transaction;
    
    transactions.unshift(newTx);
    setLocalData('pharmacy_transactions', transactions);
    return newTx;
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    await delay(300);
    const transactions = await this.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Transaction not found");
    
    transactions[index] = { ...transactions[index], ...updates };
    setLocalData('pharmacy_transactions', transactions);
    return transactions[index];
  },

  async deleteTransaction(id: string): Promise<void> {
    await delay(300);
    const transactions = await this.getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    setLocalData('pharmacy_transactions', filtered);
  },

  async getEntities(): Promise<Entity[]> {
    await delay(200);
    return getLocalData<Entity>('pharmacy_entities', []);
  },

  async saveEntity(entity: Partial<Entity>): Promise<Entity> {
    await delay(300);
    const entities = await this.getEntities();
    
    if (entity.id) {
      const index = entities.findIndex(e => e.id === entity.id);
      if (index >= 0) {
        entities[index] = { ...entities[index], ...entity } as Entity;
        setLocalData('pharmacy_entities', entities);
        return entities[index];
      }
    }
    
    const newEntity = { ...entity, id: crypto.randomUUID() } as Entity;
    entities.push(newEntity);
    setLocalData('pharmacy_entities', entities);
    return newEntity;
  },

  async getLogs(): Promise<AuditLog[]> {
    await delay(200);
    const data = getLocalData<any>('pharmacy_logs', []);
    return data.map(l => ({ ...l, timestamp: new Date(l.timestamp) }));
  },

  async addLog(log: Partial<AuditLog>): Promise<AuditLog> {
    const logs = await this.getLogs();
    const newLog = { 
      ...log, 
      id: crypto.randomUUID(),
      timestamp: new Date()
    } as AuditLog;
    
    logs.unshift(newLog);
    // Keep only last 100 logs to prevent localStorage overflow
    setLocalData('pharmacy_logs', logs.slice(0, 100));
    return newLog;
  },
};
