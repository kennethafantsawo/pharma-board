import { Transaction, Entity, AuditLog } from '../lib/data';
import { supabase } from '../lib/supabase';

// Helper to simulate network delay for auth
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
    
    return data.map((t: any) => ({ ...t, date: new Date(t.date) }));
  },

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    const payload = { ...transaction };
    if (payload.date instanceof Date) {
      payload.date = payload.date.toISOString() as any;
    }
    const { data, error } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return { ...data, date: new Date(data.date) };
  },

  async createTransactions(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
    const payload = transactions.map(t => {
      const copy = { ...t };
      if (copy.date instanceof Date) {
        copy.date = copy.date.toISOString() as any;
      }
      return copy;
    });
    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select();
      
    if (error) throw new Error(error.message);
    return data.map((t: any) => ({ ...t, date: new Date(t.date) }));
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const payload = { ...updates };
    if (payload.date instanceof Date) {
      payload.date = payload.date.toISOString() as any;
    }
    const { data, error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return { ...data, date: new Date(data.date) };
  },

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
      
    if (error) throw new Error(error.message);
  },

  async getEntities(): Promise<Entity[]> {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) {
      console.error("Error fetching entities:", error);
      return [];
    }
    
    return data as Entity[];
  },

  async saveEntity(entity: Partial<Entity>): Promise<Entity> {
    if (entity.id) {
      const { data, error } = await supabase
        .from('entities')
        .update(entity)
        .eq('id', entity.id)
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      return data as Entity;
    } else {
      const { data, error } = await supabase
        .from('entities')
        .insert([entity])
        .select()
        .single();
        
      if (error) throw new Error(error.message);
      return data as Entity;
    }
  },

  async getLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
      
    if (error) {
      console.error("Error fetching logs:", error);
      return [];
    }
    
    return data.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
  },

  async addLog(log: Partial<AuditLog>): Promise<AuditLog> {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([log])
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return { ...data, timestamp: new Date(data.timestamp) };
  },
};
