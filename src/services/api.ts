import { Transaction, Entity, AuditLog } from '../lib/data';

const API_BASE = '/api';

export const api = {
  async verifyPassword(password: string, target: 'saisie' | 'parametres'): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, target }),
      });
      return res.json();
    } catch (error) {
      return { success: false, message: "Erreur de connexion au serveur" };
    }
  },

  async getTransactions(): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE}/transactions`);
    const data = await res.json();
    return data.map((t: any) => ({ ...t, date: new Date(t.date) }));
  },

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    const t = await res.json();
    return { ...t, date: new Date(t.date) };
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const t = await res.json();
    return { ...t, date: new Date(t.date) };
  },

  async deleteTransaction(id: string) {
    await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  },

  async getEntities(): Promise<Entity[]> {
    const res = await fetch(`${API_BASE}/entities`);
    return res.json();
  },

  async saveEntity(entity: Partial<Entity>): Promise<Entity> {
    const res = await fetch(`${API_BASE}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity),
    });
    return res.json();
  },

  async getLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/logs`);
    const data = await res.json();
    return data.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
  },

  async addLog(log: Partial<AuditLog>): Promise<AuditLog> {
    const res = await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    const l = await res.json();
    return { ...l, timestamp: new Date(l.timestamp) };
  },
};
