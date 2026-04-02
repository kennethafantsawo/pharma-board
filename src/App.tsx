/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Package, 
  ShieldCheck, 
  Activity,
  History, 
  PlusCircle, 
  Settings, 
  LogOut, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  FileSpreadsheet,
  Edit,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ChevronRight,
  LineChart as LineChartIcon,
  Search,
  Filter,
  Download,
  AlertTriangle,
  FileText,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Clock,
  XCircle,
  ChevronDown,
  Printer,
  Database,
  Upload,
  Sun,
  Moon,
  Menu,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend,
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  format, 
  startOfHour,
  addHours,
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfQuarter, 
  startOfYear, 
  endOfDay,
  endOfWeek,
  endOfQuarter,
  isSameDay, 
  isWithinInterval, 
  subDays,
  subMonths,
  subYears,
  eachDayOfInterval,
  addDays,
  addMonths,
  addYears,
  isSameWeek,
  isSameMonth,
  isSameQuarter,
  isSameYear,
  parseISO,
  endOfMonth,
  endOfYear,
  differenceInDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import XLSX from 'xlsx-js-style';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '@/src/lib/utils';
import { Transaction, Entity, AuditLog, TransactionType, EntityType, Backup } from '@/src/lib/data';
import { api, OperationType } from '@/src/services/api';
import { Toaster, toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { auth, db } from './lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { useSync, SyncStatusIndicator } from './contexts/SyncContext';

type Period = 'JOUR' | 'SEMAINE' | 'QUINZAINE' | 'MOIS' | 'TRIMESTRE' | 'SEMESTRE' | 'ANNEE' | 'TOUT' | 'CUSTOM';

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'TOTAL_ESPECE', label: 'Total Espèce' },
  { value: 'TOTAL_VENTE_COMPTANT', label: 'Total Vente au Comptant' },
  { value: 'PART_ASSUREE_TIERS_PAYANT', label: 'Part Assurée Tiers Payant' },
  { value: 'TOTAL_VENTE_TIERS_PAYANT', label: 'Total Vente Tiers Payant' },
  { value: 'PART_ASSURANCE_A_REGLEE', label: 'Part Assurance à Réglée' },
  { value: 'TOTAL_VENTE_A_CREDIT', label: 'Total Vente à Crédit' },
  { value: 'TOTAL_TPE', label: 'Total TPE' },
  { value: 'TOTALE_REMISE', label: 'Totale Remise' },
  { value: 'TOTALE_TOUTES_VENTES_CONFONDU', label: 'Totale Toutes Ventes Confondu' },
  { value: 'PEREMPTION_AVARIE', label: 'Péremption & Avariés' },
  { value: 'COMMANDE', label: 'Commande Fournisseur' },
  { value: 'FACTURE', label: 'Facture Fournisseur' },
  { value: 'RETOUR', label: 'Retour Fournisseur' },
  { value: 'CONSOMMATION_DCSSA', label: 'Consommation DCSSA' },
  { value: 'CONSOMMATION_KOUNDJOURE', label: 'Consommation Koundjouré' },
  { value: 'CONSOMMATION_IMPLANT', label: 'Consommation Implant' },
  { value: 'CONSOMMATION_ASSURANCE', label: 'Consommation Assurance' },
  { value: 'REJET_ASSURANCE', label: 'Rejet Assurance' },
];

const generatePeriodOptions = (type: 'quinzaine' | 'mois') => {
  const options = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  if (type === 'mois') {
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const monthName = d.toLocaleString('fr-FR', { month: 'long' });
      const year = d.getFullYear();
      const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
      options.push({ value: label, label });
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const monthName = d.toLocaleString('fr-FR', { month: 'long' });
      const year = d.getFullYear();
      const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      options.push({ value: `Q2 ${monthCapitalized} ${year}`, label: `2ème Quinzaine ${monthCapitalized} ${year}` });
      options.push({ value: `Q1 ${monthCapitalized} ${year}`, label: `1ère Quinzaine ${monthCapitalized} ${year}` });
    }
  }
  return options;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [subTab, setSubTab] = useState<string>('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('');
  const [supplierOrderFilter, setSupplierOrderFilter] = useState<'TOUTES' | 'PAYEES' | 'NON_PAYEES'>('TOUTES');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleBulkPaymentStatus = async (paid: boolean) => {
    if (selectedInvoices.length === 0) return;
    
    setConfirmDialog({
      open: true,
      title: paid ? 'Confirmer le paiement' : 'Confirmer l\'annulation',
      message: `Voulez-vous marquer ${selectedInvoices.length} facture(s) comme ${paid ? 'payée(s)' : 'non payée(s)'} ?`,
      onConfirm: async () => {
        try {
          const batch = selectedInvoices.map(id => api.updateTransaction(id, { paid }));
          await Promise.all(batch);
          
          await api.addLog({
            action: 'UPDATE',
            targetType: 'TRANSACTION',
            targetId: 'BULK_PAYMENT',
            details: `Mise à jour groupée de ${selectedInvoices.length} factures (paid: ${paid})`
          });
          
          setSelectedInvoices([]);
          toast.success(`${selectedInvoices.length} facture(s) mise(s) à jour`);
          setConfirmDialog(null);
        } catch (error) {
          console.error("Erreur lors de la mise à jour groupée:", error);
          toast.error("Erreur lors de la mise à jour des factures");
        }
      }
    });
  };

  const getFortnightLabel = (date: Date) => {
    const day = date.getDate();
    const month = format(date, 'MMMM yyyy', { locale: fr });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
    return day <= 15 ? `1ère Quinzaine ${monthCapitalized}` : `2ème Quinzaine ${monthCapitalized}`;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown size={12} className="inline ml-1 opacity-20" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={12} className="inline ml-1 text-emerald-500" /> : 
      <ArrowDown size={12} className="inline ml-1 text-emerald-500" />;
  };

  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Special handling for entityId (Fournisseur/Assurance) to sort by name
      if (sortConfig.key === 'entityId') {
        aValue = entities.find(e => e.id === a.entityId)?.name || '';
        bValue = entities.find(e => e.id === b.entityId)?.name || '';
      }

      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const { setStatus, setLastSync, setError, queueOperation, status } = useSync();

  const performWrite = async <T,>(
    operation: () => Promise<T>,
    type: 'CREATE' | 'UPDATE' | 'DELETE',
    collectionName: string,
    data?: any,
    docId?: string
  ): Promise<T | null> => {
    if (status === 'OFFLINE') {
      queueOperation({ type, collection: collectionName, data, docId });
      toast.info("Opération mise en file d'attente (Hors ligne)");
      return null;
    }

    setStatus('SYNCING');
    try {
      const result = await operation();
      setStatus('SYNCED');
      setLastSync(new Date());
      return result;
    } catch (err: any) {
      console.error(`Write error (${type} on ${collectionName}):`, err);
      setStatus('FAILED');
      setError(`Erreur lors de l'opération ${type}`);
      toast.error(`Erreur de synchronisation: ${err.message || 'Échec de l\'opération'}`);
      throw err;
    }
  };

  // Reset sort when changing tabs
  useEffect(() => {
    setSortConfig(null);
  }, [activeTab, subTab]);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const [saisieSection, setSaisieSection] = useState<'VENTES' | 'FOURNISSEURS' | 'CONSOMMATIONS' | 'REJETS' | 'PEREMPTIONS'>('VENTES');
  const [saisieConsommationType, setSaisieConsommationType] = useState('CONSOMMATION_DCSSA');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaisieUnlocked, setIsSaisieUnlocked] = useState(false);
  const [isParametresUnlocked, setIsParametresUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; target: 'saisie' | 'parametres'; onUnlock: () => void } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('TOUT');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<'directrice' | 'assistant' | null>(null);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<TransactionType | ''>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editEntityId, setEditEntityId] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editDossiers, setEditDossiers] = useState<string>('');
  const [editBeneficiaires, setEditBeneficiaires] = useState<string>('');
  const [logStartDate, setLogStartDate] = useState<string>('');
  const [logEndDate, setLogEndDate] = useState<string>('');
  const [saisieTypeFilter, setSaisieTypeFilter] = useState<string>('TOUS');
  const [saisieStartDate, setSaisieStartDate] = useState<string>('');
  const [saisieEndDate, setSaisieEndDate] = useState<string>('');
  const [saisieDate, setSaisieDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        const email = user.email || '';
        if (email === 'directrice@pharmapro.com') {
          setUserRole('directrice');
        } else if (email === 'assistant@pharmapro.com' || email === 'kennethafantsawo@gmail.com') {
          setUserRole('assistant');
        } else {
          // Default role for other authenticated users
          setUserRole('assistant');
        }
        
        // Initialize user document if not exists
        try {
          const userDoc = await api.getUser(user.uid);
          if (!userDoc) {
            await api.createUser({
              uid: user.uid,
              email: user.email || '',
              role: (email === 'directrice@pharmapro.com') ? 'user' : 'admin'
            });
          }
        } catch (error) {
          console.error("Erreur lors de l'initialisation de l'utilisateur:", error);
        }
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      setStatus('SYNCING');
      
      // Real-time listeners
      const unsubTransactions = onSnapshot(
        query(collection(db, 'transactions'), orderBy('date', 'desc')),
        (snapshot) => {
          const txs = snapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, date: new Date(data.date) } as Transaction;
          });
          setTransactions(txs);
          setLastSync(new Date());
          setStatus('SYNCED');
        },
        (error) => {
          console.error("Error syncing transactions:", error);
          setStatus('FAILED');
          setError("Erreur de synchronisation des transactions");
        }
      );

      const unsubEntities = onSnapshot(
        query(collection(db, 'entities'), orderBy('name', 'asc')),
        (snapshot) => {
          const ents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Entity));
          setEntities(ents);
          setLastSync(new Date());
          setStatus('SYNCED');
        },
        (error) => {
          console.error("Error syncing entities:", error);
          setStatus('FAILED');
          setError("Erreur de synchronisation des fournisseurs");
        }
      );

      const unsubLogs = onSnapshot(
        query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)),
        (snapshot) => {
          const auditLogs = snapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, timestamp: new Date(data.timestamp) } as AuditLog;
          });
          setLogs(auditLogs);
          setLastSync(new Date());
          setStatus('SYNCED');
        },
        (error) => {
          console.error("Error syncing logs:", error);
          setStatus('FAILED');
          setError("Erreur de synchronisation des logs");
        }
      );

      const unsubBackups = onSnapshot(
        query(collection(db, 'backups'), orderBy('timestamp', 'desc')),
        (snapshot) => {
          const bks = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
              ...data, 
              id: doc.id, 
              timestamp: new Date(data.timestamp),
              transactions: data.transactions.map((t: any) => ({ ...t, date: new Date(t.date) }))
            } as Backup;
          });
          setBackups(bks);
          setLastSync(new Date());
          setStatus('SYNCED');
        },
        (error) => {
          console.error("Error syncing backups:", error);
          setStatus('FAILED');
          setError("Erreur de synchronisation des sauvegardes");
        }
      );

      // Check for daily backup
      api.checkAndCreateDailyBackup();

      return () => {
        unsubTransactions();
        unsubEntities();
        unsubLogs();
        unsubBackups();
      };
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (editingTransaction) {
      setEditAmount(editingTransaction.amount.toString());
      setEditDate(format(editingTransaction.date, 'yyyy-MM-dd'));
      setEditType(editingTransaction.type);
      setEditDescription(editingTransaction.description);
      setEditEntityId(editingTransaction.entityId || '');
      setEditStatus(editingTransaction.status || '');
      setEditReason(editingTransaction.reason || '');
      setEditDossiers(editingTransaction.dossiers?.toString() || '');
      setEditBeneficiaires(editingTransaction.beneficiaires?.toString() || '');
    }
  }, [editingTransaction]);

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount)) {
      toast.error('Montant invalide');
      return;
    }

    const requiredString = `delete/${editingTransaction.type}/${editingTransaction.amount}`;
    setConfirmDialog({
      open: true,
      title: 'Confirmer la modification',
      message: 'Voulez-vous vraiment modifier cette transaction ? Cette action nécessite une confirmation.',
      requiredString,
      onConfirm: async () => {
        try {
          const updates: Partial<Transaction> = {
            amount: newAmount,
            date: new Date(editDate),
            type: editType as TransactionType,
            description: editDescription,
            entityId: editEntityId || undefined,
            status: (editStatus as any) || undefined,
            reason: editReason || undefined,
            dossiers: editDossiers ? parseInt(editDossiers) : undefined,
            beneficiaires: editBeneficiaires ? parseInt(editBeneficiaires) : undefined,
          };

          const updatedTx = await performWrite(
            () => api.updateTransaction(editingTransaction.id, updates),
            'UPDATE',
            'transactions',
            updates,
            editingTransaction.id
          );
          
          if (updatedTx) {

          addLog(
            'UPDATE', 
            'TRANSACTION', 
            editingTransaction.id, 
            `Modification transaction: ${editingTransaction.type} -> ${editType}`,
            editingTransaction,
            { ...editingTransaction, ...updates }
          );

          toast.success('Transaction mise à jour');
          setEditingTransaction(null);
          setEditAmount('');
          setEditDate('');
          setEditType('');
          setEditDescription('');
          setEditEntityId('');
          setEditStatus('');
          setEditReason('');
          setEditDossiers('');
          setEditBeneficiaires('');
          setConfirmDialog(null);
          }
        } catch (error) {
          // Error handled by performWrite
        }
      }
    });
  };

  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; requiredString?: string } | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth Logic
  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const loadingToast = toast.loading('Connexion avec Google...');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.dismiss(loadingToast);
      toast.success('Connexion réussie avec Google');
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error("Google Login error:", error);
      toast.error('Échec de la connexion avec Google');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [isSignUp, setIsSignUp] = useState(false);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const formData = new FormData(e.currentTarget);
    const user = formData.get('user') as string;
    const pass = formData.get('pass') as string;

    setIsLoggingIn(true);
    const loadingToast = toast.loading('Création du compte...');
    try {
      const email = `${user.toLowerCase().trim()}@pharmapro.com`;
      await createUserWithEmailAndPassword(auth, email, pass);
      
      toast.dismiss(loadingToast);
      setIsLoggedIn(true);
      setUserRole(user.toLowerCase().trim() as 'directrice' | 'assistant');
      setLoginError('');
      addLog('CREATE', 'AUTH', user, `Création compte utilisateur: ${user}`);
      toast.success(`Compte créé ! Bienvenue, ${user}`);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error("SignUp error:", error);
      
      let message = 'Erreur lors de la création du compte';
      if (error.code === 'auth/email-already-in-use') {
        message = 'Cet identifiant est déjà utilisé.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Le mot de passe est trop court (min 6 caractères).';
      }
      
      setLoginError(message);
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const formData = new FormData(e.currentTarget);
    const user = formData.get('user') as string;
    const pass = formData.get('pass') as string;

    setIsLoggingIn(true);
    const loadingToast = toast.loading('Connexion en cours...');
    try {
      // Pour Firebase, on utilise un email fictif basé sur l'identifiant
      const email = `${user.toLowerCase().trim()}@pharmapro.com`;
      await signInWithEmailAndPassword(auth, email, pass);
      
      toast.dismiss(loadingToast);
      setIsLoggedIn(true);
      setUserRole(user.toLowerCase().trim() as 'directrice' | 'assistant');
      setLoginError('');
      addLog('CREATE', 'AUTH', user, `Connexion utilisateur: ${user}`);
      toast.success(`Bienvenue, ${user}`);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error("Login crash:", error);
      
      let message = 'Identifiants ou mot de passe incorrects';
      if (error.code === 'auth/invalid-credential') {
        message = 'Identifiants ou mot de passe incorrects. Veuillez vérifier vos informations ou utiliser la connexion Google.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Trop de tentatives de connexion. Votre compte est temporairement bloqué pour des raisons de sécurité. Veuillez réessayer plus tard.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Erreur de connexion réseau. Veuillez vérifier votre connexion internet.';
      }
      
      setLoginError(message);
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      addLog('CREATE', 'AUTH', 'logout', 'Déconnexion utilisateur');
      await signOut(auth);
      setIsLoggedIn(false);
      setUserRole(null);
      setActiveTab('accueil');
      toast.success('Déconnexion réussie');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Audit Logging
  const addLog = async (action: AuditLog['action'], targetType: string, targetId: string, details: string, previousData?: any, newData?: any) => {
    try {
      const newLog = await api.addLog({
        action,
        targetType,
        targetId,
        details,
        previousData,
        newData
      });
      setLogs(prev => [newLog, ...prev]);
    } catch (error) {
      console.error("Failed to add log", error);
    }
  };

  const previousFilteredTransactions = useMemo(() => {
    if (selectedPeriod === 'TOUT') {
      return []; // No previous period for 'TOUT'
    }

    if (selectedPeriod === 'CUSTOM' && dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      const diff = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - diff - 86400000); // subtract 1 day more
      const prevEnd = new Date(start.getTime() - 86400000);
      return transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startOfDay(prevStart) && txDate <= endOfDay(prevEnd);
      });
    }

    const baseDate = new Date(selectedDate);
    let prevBaseDate = new Date(baseDate);

    switch (selectedPeriod) {
      case 'JOUR': prevBaseDate = subDays(baseDate, 1); break;
      case 'SEMAINE': prevBaseDate = subDays(baseDate, 7); break;
      case 'QUINZAINE': prevBaseDate = subDays(baseDate, 15); break;
      case 'MOIS': prevBaseDate = subMonths(baseDate, 1); break;
      case 'TRIMESTRE': prevBaseDate = subMonths(baseDate, 3); break;
      case 'SEMESTRE': prevBaseDate = subMonths(baseDate, 6); break;
      case 'ANNEE': prevBaseDate = subYears(baseDate, 1); break;
      default: prevBaseDate = subMonths(baseDate, 1);
    }

    let intervalStart: Date;
    let intervalEnd: Date = endOfDay(prevBaseDate);

    switch (selectedPeriod) {
      case 'JOUR': 
        intervalStart = startOfDay(prevBaseDate); 
        intervalEnd = endOfDay(prevBaseDate);
        break;
      case 'SEMAINE': 
        intervalStart = startOfWeek(prevBaseDate, { weekStartsOn: 1 }); 
        intervalEnd = endOfWeek(prevBaseDate, { weekStartsOn: 1 });
        break;
      case 'QUINZAINE': 
        intervalStart = prevBaseDate.getDate() <= 15 ? startOfMonth(prevBaseDate) : addDays(startOfMonth(prevBaseDate), 15);
        intervalEnd = prevBaseDate.getDate() <= 15 ? endOfDay(addDays(startOfMonth(prevBaseDate), 14)) : endOfMonth(prevBaseDate);
        break;
      case 'MOIS': 
        intervalStart = startOfMonth(prevBaseDate); 
        intervalEnd = endOfMonth(prevBaseDate);
        break;
      case 'TRIMESTRE': 
        intervalStart = startOfQuarter(prevBaseDate); 
        intervalEnd = endOfQuarter(prevBaseDate);
        break;
      case 'SEMESTRE': 
        intervalStart = prevBaseDate.getMonth() < 6 ? startOfYear(prevBaseDate) : addMonths(startOfYear(prevBaseDate), 6); 
        intervalEnd = prevBaseDate.getMonth() < 6 ? endOfDay(addDays(addMonths(startOfYear(prevBaseDate), 6), -1)) : endOfYear(prevBaseDate);
        break;
      case 'ANNEE': 
        intervalStart = startOfYear(prevBaseDate); 
        intervalEnd = endOfYear(prevBaseDate);
        break;
      default: 
        intervalStart = startOfMonth(prevBaseDate);
        intervalEnd = endOfMonth(prevBaseDate);
    }
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= intervalStart && txDate <= intervalEnd;
    });
  }, [transactions, selectedPeriod, selectedDate, dateRange]);

  // Global Filtering Logic
  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'TOUT') {
      return transactions;
    }

    if (selectedPeriod === 'CUSTOM' && dateRange) {
      const start = startOfDay(new Date(dateRange.start));
      const end = endOfDay(new Date(dateRange.end));
      return transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= start && txDate <= end;
      });
    }

    const baseDate = new Date(selectedDate);
    let intervalStart: Date;
    let intervalEnd: Date = endOfDay(baseDate);

    switch (selectedPeriod) {
      case 'JOUR': 
        intervalStart = startOfDay(baseDate); 
        intervalEnd = endOfDay(baseDate);
        break;
      case 'SEMAINE': 
        intervalStart = startOfWeek(baseDate, { weekStartsOn: 1 }); 
        intervalEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
        break;
      case 'QUINZAINE': 
        intervalStart = baseDate.getDate() <= 15 ? startOfMonth(baseDate) : addDays(startOfMonth(baseDate), 15);
        intervalEnd = baseDate.getDate() <= 15 ? endOfDay(addDays(startOfMonth(baseDate), 14)) : endOfMonth(baseDate);
        break;
      case 'MOIS': 
        intervalStart = startOfMonth(baseDate); 
        intervalEnd = endOfMonth(baseDate);
        break;
      case 'TRIMESTRE': 
        intervalStart = startOfQuarter(baseDate); 
        intervalEnd = endOfQuarter(baseDate);
        break;
      case 'SEMESTRE': 
        intervalStart = baseDate.getMonth() < 6 ? startOfYear(baseDate) : addMonths(startOfYear(baseDate), 6); 
        intervalEnd = baseDate.getMonth() < 6 ? endOfDay(addDays(addMonths(startOfYear(baseDate), 6), -1)) : endOfYear(baseDate);
        break;
      case 'ANNEE': 
        intervalStart = startOfYear(baseDate); 
        intervalEnd = endOfYear(baseDate);
        break;
      default: 
        intervalStart = startOfMonth(baseDate);
        intervalEnd = endOfMonth(baseDate);
    }
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= intervalStart && txDate <= intervalEnd;
    });
  }, [transactions, selectedPeriod, selectedDate, dateRange]);

  const calculateDashboardMetrics = (txs: Transaction[]) => {
    const categories = {
      TOTAL_ESPECE: 0,
      TOTAL_VENTE_COMPTANT: 0,
      PART_ASSUREE_TIERS_PAYANT: 0,
      TOTAL_VENTE_TIERS_PAYANT: 0,
      PART_ASSURANCE_A_REGLEE: 0,
      TOTAL_VENTE_A_CREDIT: 0,
      TOTAL_TPE: 0,
      TOTALE_REMISE: 0,
      TOTALE_TOUTES_VENTES_CONFONDU: 0,
      PEREMPTION_AVARIE: 0,
      COMPTANTS: 0,
      PART_ASSUREE: 0,
      TIERS_PAYANT: 0,
      CREDIT: 0,
      REMISE: 0,
      COMMANDE: 0,
      CONSOMMATION_DCSSA: 0,
      CONSOMMATION_IMPLANT: 0,
      REJET_ASSURANCE: 0
    };
    
    txs.forEach(t => {
      if (t.type in categories) {
        categories[t.type as keyof typeof categories] += t.amount;
      }
    });

    const totalEspece = categories.TOTAL_ESPECE;
    const partAssureeTiersPayant = categories.PART_ASSUREE_TIERS_PAYANT + categories.PART_ASSUREE;
    const totalVenteComptant = totalEspece - partAssureeTiersPayant;
    const partAssuranceAReglee = categories.PART_ASSURANCE_A_REGLEE + categories.TIERS_PAYANT;
    const totalVenteTiersPayant = partAssureeTiersPayant + partAssuranceAReglee;
    const totalVenteACredit = categories.TOTAL_VENTE_A_CREDIT + categories.CREDIT;
    const totalTPE = categories.TOTAL_TPE;
    const totaleRemise = categories.TOTALE_REMISE + categories.REMISE;
    const peremptionAvarie = categories.PEREMPTION_AVARIE;
    const totalCommandes = categories.COMMANDE;
    const consommationDCSSA = categories.CONSOMMATION_DCSSA;
    const consommationImplant = categories.CONSOMMATION_IMPLANT;
    const rejetsAssurance = categories.REJET_ASSURANCE;
    const montantFacturesReglees = txs.filter(t => t.type === 'FACTURE' && t.paid).reduce((acc, t) => acc + t.amount, 0);

    // Logic for totalGlobal (Chiffre d'affaires / Totale Toutes Ventes Confondu)
    // Total Vente = Total Vente Tier Payant + Credit + Total Vente Comptant
    const chiffreAffaires = totalVenteTiersPayant + totalVenteACredit + totalVenteComptant;

    const recettesEncaisses = totalEspece + totalTPE;

    return { 
      ...categories, 
      totalEspece,
      totalVenteComptant,
      partAssureeTiersPayant,
      totalVenteTiersPayant,
      partAssuranceAReglee,
      totalVenteACredit,
      totalTPE,
      totaleRemise,
      chiffreAffaires,
      recettesEncaisses,
      totalCommandes,
      peremptionAvarie,
      consommationDCSSA,
      consommationImplant,
      rejetsAssurance,
      montantFacturesReglees
    };
  };

  const metrics = useMemo(() => calculateDashboardMetrics(filteredTransactions), [filteredTransactions]);
  const prevMetrics = useMemo(() => calculateDashboardMetrics(previousFilteredTransactions), [previousFilteredTransactions]);

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      if (current === 0) return 0;
      return current > 0 ? 100 : -100;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // Recettes Data (alias for metrics to avoid changing too many variables)
  const recettesData = { ...metrics, totalGlobal: metrics.chiffreAffaires };

  // Chart Data for Recettes (follows selectedPeriod)
  const recettesChartData = useMemo(() => {
    const baseDate = new Date(selectedDate);
    let filtered: Transaction[] = filteredTransactions;
    let groupingFn: (date: Date) => Date;
    let labelFormat: string = 'dd/MM';
    let intervalStart: Date;
    let intervalEnd: Date;
    let customLabelFn: ((date: Date) => string) | null = null;
    
    if (selectedPeriod !== 'CUSTOM' && selectedPeriod !== 'TOUT') {
      switch (selectedPeriod) {
        case 'JOUR':
          intervalStart = subDays(baseDate, 14);
          intervalEnd = endOfDay(baseDate);
          groupingFn = startOfDay;
          labelFormat = 'dd/MM';
          break;
        case 'SEMAINE':
          intervalStart = startOfWeek(subDays(baseDate, 7 * 7), { weekStartsOn: 1 });
          intervalEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
          groupingFn = (d) => startOfWeek(d, { weekStartsOn: 1 });
          customLabelFn = (d) => `S${format(d, 'ww')}`;
          break;
        case 'QUINZAINE':
          intervalStart = startOfMonth(subMonths(baseDate, 3));
          intervalEnd = endOfMonth(baseDate);
          groupingFn = (d) => d.getDate() <= 15 ? startOfMonth(d) : addDays(startOfMonth(d), 15);
          customLabelFn = (d) => d.getDate() <= 15 ? `01-15 ${format(d, 'MMM', { locale: fr })}` : `16-${format(endOfMonth(d), 'dd')} ${format(d, 'MMM', { locale: fr })}`;
          break;
        case 'MOIS':
          intervalStart = startOfMonth(subMonths(baseDate, 11));
          intervalEnd = endOfMonth(baseDate);
          groupingFn = startOfMonth;
          labelFormat = 'MMM yy';
          break;
        case 'TRIMESTRE':
          intervalStart = startOfQuarter(subMonths(baseDate, 9));
          intervalEnd = endOfQuarter(baseDate);
          groupingFn = startOfQuarter;
          customLabelFn = (d) => `T${Math.floor(d.getMonth() / 3) + 1} ${format(d, 'yy')}`;
          break;
        case 'SEMESTRE':
          intervalStart = subMonths(baseDate.getMonth() < 6 ? startOfYear(baseDate) : addMonths(startOfYear(baseDate), 6), 18);
          intervalEnd = baseDate.getMonth() < 6 ? endOfDay(addDays(addMonths(startOfYear(baseDate), 6), -1)) : endOfYear(baseDate);
          groupingFn = (d) => d.getMonth() < 6 ? startOfYear(d) : addMonths(startOfYear(d), 6);
          customLabelFn = (d) => d.getMonth() < 6 ? `Sem 1 ${format(d, 'yy')}` : `Sem 2 ${format(d, 'yy')}`;
          break;
        case 'ANNEE':
          intervalStart = startOfYear(subYears(baseDate, 4));
          intervalEnd = endOfYear(baseDate);
          groupingFn = startOfYear;
          labelFormat = 'yyyy';
          break;
        default:
          intervalStart = startOfMonth(baseDate);
          intervalEnd = endOfMonth(baseDate);
          groupingFn = startOfMonth;
          labelFormat = 'MMM yy';
      }
    } else if (selectedPeriod === 'TOUT') {
      // For 'TOUT', we show the last 12 months by default on the chart to keep it readable
      intervalStart = startOfMonth(subMonths(new Date(), 11));
      intervalEnd = endOfMonth(new Date());
      groupingFn = startOfMonth;
      labelFormat = 'MMM yy';
    } else {
      intervalStart = startOfDay(new Date(dateRange?.start || selectedDate));
      intervalEnd = endOfDay(new Date(dateRange?.end || selectedDate));
      groupingFn = startOfDay;
      labelFormat = 'dd/MM';
    }
    
    const groups: Record<string, any> = {};

    // Pre-populate groups to ensure all points are shown in the chart
    let current = new Date(intervalStart);
    while (current <= intervalEnd) {
      const key = groupingFn(current).toISOString();
      if (!groups[key]) {
        groups[key] = {
          date: groupingFn(current),
          name: customLabelFn ? customLabelFn(current) : format(groupingFn(current), labelFormat, { locale: fr }),
          comptants: 0,
          tiers: 0,
          credit: 0,
          tpe: 0,
          remises: 0,
          commandes: 0,
          dcssa: 0,
          koundjoure: 0,
          total: 0,
          entrees: 0,
          sorties: 0,
          rejets: 0
        };
      }
      if (groupingFn === startOfHour) current = addHours(current, 1);
      else if (selectedPeriod === 'QUINZAINE') {
        if (current.getDate() <= 15) current = addDays(startOfMonth(current), 15);
        else current = addMonths(startOfMonth(current), 1);
      }
      else if (selectedPeriod === 'SEMAINE') current = addDays(current, 7);
      else if (selectedPeriod === 'TRIMESTRE') current = addMonths(current, 3);
      else if (selectedPeriod === 'SEMESTRE') current = addMonths(current, 6);
      else if (groupingFn === startOfDay) current = addDays(current, 1);
      else if (groupingFn === startOfMonth) current = addMonths(current, 1);
      else current = addYears(current, 1);
    }

    const chartTransactions = selectedPeriod === 'CUSTOM' ? filteredTransactions : transactions;

    chartTransactions.forEach(t => {
      const key = groupingFn(t.date).toISOString();
      if (!groups[key]) return;
      
      if (['TOTAL_VENTE_COMPTANT', 'COMPTANTS'].includes(t.type)) {
        if (t.type === 'TOTAL_VENTE_COMPTANT') {
          groups[key].comptants += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        } else if (!chartTransactions.some(f => f.type === 'TOTAL_VENTE_COMPTANT' && isSameDay(f.date, t.date))) {
          groups[key].comptants += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        }
      }
      if (['TOTAL_VENTE_TIERS_PAYANT', 'TIERS_PAYANT'].includes(t.type)) {
        if (t.type === 'TOTAL_VENTE_TIERS_PAYANT') {
          groups[key].tiers += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        } else if (!chartTransactions.some(f => f.type === 'TOTAL_VENTE_TIERS_PAYANT' && isSameDay(f.date, t.date))) {
          groups[key].tiers += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        }
      }
      if (['TOTAL_VENTE_A_CREDIT', 'CREDIT'].includes(t.type)) {
        if (t.type === 'TOTAL_VENTE_A_CREDIT') {
          groups[key].credit += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        } else if (!chartTransactions.some(f => f.type === 'TOTAL_VENTE_A_CREDIT' && isSameDay(f.date, t.date))) {
          groups[key].credit += t.amount;
          groups[key].total += t.amount;
          groups[key].entrees += t.amount;
        }
      }
      if (t.type === 'TOTAL_TPE') {
        groups[key].tpe += t.amount;
        groups[key].total += t.amount;
      }
      if (t.type === 'REMISE' || t.type === 'TOTALE_REMISE') groups[key].remises += t.amount;
      if (t.type === 'COMMANDE') {
        groups[key].commandes += t.amount;
        groups[key].sorties += t.amount;
      }
      if (t.type === 'CONSOMMATION_DCSSA') {
        groups[key].dcssa += t.amount;
      }
      if (t.type === 'CONSOMMATION_KOUNDJOURE') {
        groups[key].koundjoure += t.amount;
      }
      if (t.type === 'REJET_ASSURANCE') {
        groups[key].rejets += t.amount;
        groups[key].sorties += t.amount;
      }
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredTransactions, selectedPeriod, selectedDate, dateRange]);

  const previsionsChartData = useMemo(() => {
    // Basic linear projection for the next 4 periods based on the current selected period's data
    const data = [...recettesChartData];
    if (data.length < 2) return data;

    // Calculate average growth over the period
    let totalGrowth = 0;
    let validPeriods = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i-1].total > 0) {
        totalGrowth += (data[i].total - data[i-1].total) / data[i-1].total;
        validPeriods++;
      }
    }
    
    const avgGrowthRate = validPeriods > 0 ? totalGrowth / validPeriods : 0;
    const lastValue = data[data.length - 1].total;
    const lastDate = data[data.length - 1].date;

    // Generate next 4 periods
    for (let i = 1; i <= 4; i++) {
      let nextDate = new Date(lastDate);
      let nextName = '';
      
      if (selectedPeriod === 'JOUR') {
        nextDate = addHours(nextDate, i);
        nextName = format(nextDate, 'HH:mm');
      } else if (['SEMAINE', 'QUINZAINE', 'MOIS'].includes(selectedPeriod)) {
        nextDate = addDays(nextDate, i);
        nextName = format(nextDate, 'dd/MM');
      } else {
        nextDate = addMonths(nextDate, i);
        nextName = format(nextDate, 'MMM', { locale: fr });
      }

      const projectedValue = lastValue * Math.pow(1 + avgGrowthRate, i);
      
      data.push({
        date: nextDate,
        name: `${nextName} (Prév)`,
        comptants: 0,
        tiers: 0,
        credit: 0,
        tpe: 0,
        remises: 0,
        commandes: 0,
        total: Math.max(0, projectedValue) // Prevent negative projections
      });
    }

    return data;
  }, [recettesChartData, selectedPeriod]);

  // Fournisseurs Chart Data
  const fournisseursChartData = useMemo(() => {
    return recettesChartData.map(d => ({
      name: d.name,
      commandes: d.commandes
    }));
  }, [recettesChartData]);

  const dcssaChartData = useMemo(() => {
    return recettesChartData.map(d => ({
      name: d.name,
      DCSSA: d.dcssa,
      KOUNDJOURE: d.koundjoure
    }));
  }, [recettesChartData]);

  // Sorted Suppliers by Balance
  const sortedSuppliers = useMemo(() => {
    return entities
      .filter(e => e.type === 'FOURNISSEUR')
      .map(supplier => {
        const supplierTxs = transactions.filter(t => t.entityId === supplier.id);
        const totalCommandes = supplierTxs.filter(t => t.type === 'COMMANDE').reduce((sum, t) => sum + t.amount, 0);
        const totalFactures = supplierTxs.filter(t => t.type === 'FACTURE').reduce((sum, t) => sum + t.amount, 0);
        const totalPaidFactures = supplierTxs.filter(t => t.type === 'FACTURE' && t.paid).reduce((sum, t) => sum + t.amount, 0);
        const solde = totalCommandes - totalPaidFactures;
        return { ...supplier, solde, totalCommandes, totalFactures, totalPaidFactures };
      })
      .sort((a, b) => b.solde - a.solde);
  }, [entities, transactions]);

  const togglePaymentStatus = async (transaction: Transaction) => {
    if (userRole === 'directrice') return;
    
    try {
      await performWrite(
        () => api.updateTransaction(transaction.id, { paid: !transaction.paid }),
        'UPDATE',
        'transactions',
        { paid: !transaction.paid },
        transaction.id
      );
      toast.success(`Statut de la facture ${transaction.invoiceNumber || ''} mis à jour`);
    } catch (error) {
      // Error handled by performWrite
    }
  };

  // Fournisseurs Pivot Table Data
  const fournisseursPivotData = useMemo(() => {
    const suppliers = sortedSuppliers;
    
    // Use the same periods as the chart
    const periods = recettesChartData.map((d, index) => {
      const start = d.date;
      const end = index < recettesChartData.length - 1 
        ? new Date(recettesChartData[index + 1].date.getTime() - 1) 
        : new Date(start.getTime() + (recettesChartData.length > 1 ? start.getTime() - recettesChartData[index - 1].date.getTime() : 86400000));
      
      return {
        key: d.name,
        start,
        end
      };
    });

    return suppliers
      .filter(s => selectedSupplierFilter === '' || s.id === selectedSupplierFilter)
      .map(s => {
        const row: any = { name: s.name, id: s.id };
        let total = 0;
        periods.forEach(p => {
          const amount = filteredTransactions
            .filter(t => t.entityId === s.id && (t.type === 'COMMANDE' || t.type === 'FACTURE') && t.date >= p.start && t.date < p.end)
            .reduce((sum, t) => sum + t.amount, 0);
          row[p.key] = amount;
          total += amount;
        });
        row.total = total;
        return row;
      });
  }, [sortedSuppliers, filteredTransactions, recettesChartData, selectedSupplierFilter]);

  const supplierSpecificChartData = useMemo(() => {
    const supplier = entities.find(e => e.name === subTab);
    if (!supplier) return [];

    const periods = recettesChartData.map((d, index) => {
      const start = d.date;
      const end = index < recettesChartData.length - 1 
        ? new Date(recettesChartData[index + 1].date.getTime() - 1) 
        : new Date(start.getTime() + (recettesChartData.length > 1 ? start.getTime() - recettesChartData[index - 1].date.getTime() : 86400000));
      
      return {
        key: d.name,
        start,
        end
      };
    });

    return periods.map(p => {
      const amount = filteredTransactions
        .filter(t => t.entityId === supplier.id && t.type === 'COMMANDE' && t.date >= p.start && t.date < p.end)
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        date: p.start,
        name: p.key,
        commandes: amount
      };
    });
  }, [filteredTransactions, subTab, entities, recettesChartData]);

  // Export PDF Logic
  const handleExportPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(18);
    doc.text("PHARMACIE DE L'AÉROPORT - Rapport de Gestion", 14, 22);
    doc.setFontSize(10);
    doc.text(`Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Période: ${selectedPeriod}`, 14, 35);

    // Recettes Table
    doc.setFontSize(14);
    doc.text("Synthèse des Recettes", 14, 45);
    const recettesTable = [
      ["Catégorie", "Montant", "Pourcentage"],
      ["Total Espèce", formatCurrency(recettesData.totalEspece), `${((recettesData.totalEspece / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Total Vente au Comptant", formatCurrency(recettesData.totalVenteComptant), `${((recettesData.totalVenteComptant / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Part Assurée Tiers Payant", formatCurrency(recettesData.partAssureeTiersPayant), `${((recettesData.partAssureeTiersPayant / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Total Vente Tiers Payant", formatCurrency(recettesData.totalVenteTiersPayant), `${((recettesData.totalVenteTiersPayant / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Part Assurance à Réglée", formatCurrency(recettesData.partAssuranceAReglee), `${((recettesData.partAssuranceAReglee / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Total Vente à Crédit", formatCurrency(recettesData.totalVenteACredit), `${((recettesData.totalVenteACredit / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Totale Remise", formatCurrency(recettesData.totaleRemise), `${((recettesData.totaleRemise / recettesData.totalGlobal) * 100).toFixed(1)}%`],
      ["Péremption & Avariés", formatCurrency(recettesData.peremptionAvarie), "-"],
      ["TOTAL TOUTES VENTES CONFONDU", formatCurrency(recettesData.totalGlobal), "100%"]
    ];
    doc.autoTable({
      startY: 50,
      head: [recettesTable[0]],
      body: recettesTable.slice(1),
      theme: 'grid',
      headStyles: { fillStyle: [0, 71, 171] }
    });

    // Recapitulative Suppliers
    doc.setFontSize(14);
    doc.text("Récapitulatif par Fournisseur", 14, (doc as any).lastAutoTable.finalY + 15);
    
    const supplierRows = sortedSuppliers.map(s => [
      s.name,
      formatCurrency(s.totalCommandes),
      formatCurrency(s.totalFactures),
      formatCurrency(s.totalPaidFactures),
      formatCurrency(s.solde)
    ]);

    doc.autoTable({
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Fournisseur', 'Total Commandes', 'Total Factures', 'Factures Payées', 'Solde']],
      body: supplierRows,
      theme: 'grid',
      headStyles: { fillStyle: [16, 185, 129] }
    });

    doc.save(`Rapport_Pharma_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Rapport PDF généré avec succès');
  };

  const handleExportAssurancesCSV = () => {
    const assuranceTransactions = transactions.filter(t => 
      t.type === 'CONSOMMATION_ASSURANCE' || t.type === 'REJET_ASSURANCE'
    );

    if (assuranceTransactions.length === 0) {
      toast.error('Aucune donnée d\'assurance à exporter');
      return;
    }

    const headers = ['Date', 'Assurance', 'Type', 'Montant', 'Motif'];
    const rows = assuranceTransactions.map(t => [
      format(t.date, 'dd/MM/yyyy'),
      entities.find(e => e.id === t.entityId)?.name || 'Inconnu',
      t.type === 'CONSOMMATION_ASSURANCE' ? 'Consommation' : 'Rejet',
      t.amount,
      t.reason || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Assurances_Pharma_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Données assurances exportées en CSV');
    addLog('CREATE', 'EXPORT', 'assurances', 'Export CSV des données assurances');
  };

  // Excel Import Logic
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const newTransactions: Partial<Transaction>[] = data.map((row, idx) => ({
        date: row.Date instanceof Date ? row.Date : new Date(row.Date),
        type: row.Type as TransactionType,
        amount: Number(row.Montant) || 0,
        category: row.Categorie || 'Import',
        description: row.Description || 'Import Excel',
        entityId: row.EntityId || undefined,
        status: row.Statut || undefined,
        reason: row.Raison || undefined
      }));

      try {
        const savedTxs = await performWrite(
          () => api.createTransactions(newTransactions),
          'CREATE',
          'transactions',
          newTransactions
        );
        
        if (savedTxs) {
          addLog('IMPORT', 'TRANSACTION', 'multiple', `${savedTxs.length} transactions importées via Excel`);
          toast.success(`${savedTxs.length} transactions importées avec succès`);
        }
      } catch (err) {
        // Error handled by performWrite
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "10b981" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    const instructionStyle = {
      font: { italic: true, color: { rgb: "64748b" } },
      fill: { fgColor: { rgb: "f1f5f9" } }
    };

    // Sheet 1: Recettes
    const wsRecettes = XLSX.utils.json_to_sheet([
      { Instructions: "Remplissez les recettes quotidiennes ici. Types autorisés: TOTAL_ESPECE, TOTAL_VENTE_COMPTANT, PART_ASSUREE_TIERS_PAYANT, TOTAL_VENTE_TIERS_PAYANT, PART_ASSURANCE_A_REGLEE, TOTAL_VENTE_A_CREDIT, TOTALE_REMISE, TOTALE_TOUTES_VENTES_CONFONDU, PEREMPTION_AVARIE" },
      { Date: '2026-03-24', Type: 'TOTAL_ESPECE', Montant: 500000, Categorie: 'Ventes', Description: 'Ventes du jour' },
      { Date: '2026-03-24', Type: 'PART_ASSUREE_TIERS_PAYANT', Montant: 200000, Categorie: 'Ventes', Description: 'Part mutuelle' }
    ]);
    
    // Apply styles to Recettes
    wsRecettes['A1'].s = instructionStyle;
    wsRecettes['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    ['A2', 'B2', 'C2', 'D2', 'E2'].forEach(addr => { if(wsRecettes[addr]) wsRecettes[addr].s = headerStyle; });
    wsRecettes['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(wb, wsRecettes, "Recettes");

    // Sheet 2: Fournisseurs
    const wsFournisseurs = XLSX.utils.json_to_sheet([
      { Instructions: "Commandes et Factures fournisseurs. Types: COMMANDE, FACTURE, RETOUR. EntityId: f1 (Laborex), f2 (Ubipharm), f3 (Labopharma)" },
      { Date: '2026-03-24', Type: 'COMMANDE', Montant: 1200000, Categorie: 'Approvisionnement', Description: 'Commande hebdomadaire', EntityId: 'f1' }
    ]);
    wsFournisseurs['A1'].s = instructionStyle;
    wsFournisseurs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    ['A2', 'B2', 'C2', 'D2', 'E2', 'F2'].forEach(addr => { if(wsFournisseurs[addr]) wsFournisseurs[addr].s = headerStyle; });
    wsFournisseurs['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsFournisseurs, "Fournisseurs");

    // Sheet 3: DCSSA
    const wsDCSSA = XLSX.utils.json_to_sheet([
      { Instructions: "Consommation DCSSA et Koundjouré. Types: CONSOMMATION_DCSSA, CONSOMMATION_KOUNDJOURE" },
      { Date: '2026-03-24', Type: 'CONSOMMATION_DCSSA', Montant: 1500000, Description: 'Consommation mensuelle' }
    ]);
    wsDCSSA['A1'].s = instructionStyle;
    wsDCSSA['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    ['A2', 'B2', 'C2'].forEach(addr => { if(wsDCSSA[addr]) wsDCSSA[addr].s = headerStyle; });
    wsDCSSA['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDCSSA, "DCSSA");

    // Sheet 4: Assurances
    const wsAssurances = XLSX.utils.json_to_sheet([
      { Instructions: "Consommation et Rejets assurances. Types: CONSOMMATION_ASSURANCE, REJET_ASSURANCE. EntityId: a1 (CNSS), a2 (NSIA), a3 (SUNU), a4 (GTA)" },
      { Date: '2026-03-24', Type: 'CONSOMMATION_ASSURANCE', Montant: 300000, EntityId: 'a1' }
    ]);
    wsAssurances['A1'].s = instructionStyle;
    wsAssurances['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ['A2', 'B2', 'C2', 'D2'].forEach(addr => { if(wsAssurances[addr]) wsAssurances[addr].s = headerStyle; });
    wsAssurances['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsAssurances, "Assurances");

    XLSX.writeFile(wb, "template_gestion_pharmacie_pro.xlsx");
    toast.info('Modèle professionnel généré');
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "10b981" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: "1e293b" } },
      alignment: { horizontal: "center" }
    };

    const sectionHeaderStyle = {
      font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "334155" } },
      alignment: { horizontal: "left" }
    };

    const kpiLabelStyle = {
      font: { bold: true, color: { rgb: "64748b" } },
      fill: { fgColor: { rgb: "f8fafc" } }
    };

    const kpiValueStyle = {
      font: { bold: true, color: { rgb: "10b981" } },
      alignment: { horizontal: "right" }
    };

    // 1. Consolidated Data Preparation
    const consolidatedData: any[][] = [
      ["RAPPORT DE GESTION CONSOLIDÉ - PHARMA PRO (AÉROPORT DE LOMÉ)"],
      [],
      ["PARAMÈTRES DU RAPPORT"],
      ["Période sélectionnée", selectedPeriod],
      ["Date d'extraction", format(new Date(), 'dd/MM/yyyy HH:mm')],
      ["Utilisateur", "Admin Pharma Pro"],
      [],
      ["RÉSUMÉ DES INDICATEURS CLÉS (KPI)"],
      ["Recettes Totales", metrics.recettesEncaisses],
      ["Commandes Fournisseurs", metrics.totalCommandes],
      ["Crédits Patients", metrics.totalVenteACredit],
      ["Rejets Assurances", metrics.rejetsAssurance],
      ["Consommation Implants", metrics.consommationImplant],
      [],
      ["RÉPARTITION DES RECETTES"],
      ["Total Espèce", recettesData.totalEspece],
      ["Total Vente au Comptant", recettesData.totalVenteComptant],
      ["Part Assurée Tiers Payant", recettesData.partAssureeTiersPayant],
      ["Total Vente Tiers Payant", recettesData.totalVenteTiersPayant],
      ["Part Assurance à Réglée", recettesData.partAssuranceAReglee],
      ["Total Vente à Crédit", recettesData.totalVenteACredit],
      ["Totale Remise", recettesData.totaleRemise],
      ["Péremption & Avariés", recettesData.peremptionAvarie],
      ["TOTAL TOUTES VENTES CONFONDU", recettesData.totalGlobal],
      [],
      ["RÉCAPITULATIF PAR FOURNISSEUR"],
      ["Fournisseur", "Total Commandes", "Total Factures", "Factures Payées", "Solde"],
    ];

    // Add Supplier Data
    sortedSuppliers.forEach(s => {
      consolidatedData.push([s.name, s.totalCommandes, s.totalFactures, s.totalPaidFactures, s.solde]);
    });

    consolidatedData.push([], ["CONSOMMATIONS SPÉCIALES"]);
    consolidatedData.push(["DCSSA", metrics.consommationDCSSA]);
    consolidatedData.push(["Implants", metrics.consommationImplant]);
    consolidatedData.push([], ["JOURNAL GLOBAL DES TRANSACTIONS"]);
    consolidatedData.push(["Date", "Type", "Montant (FCFA)", "Catégorie", "Description", "Entité", "Statut"]);

    // Add all filtered transactions
    filteredTransactions.forEach(t => {
      consolidatedData.push([
        format(t.date, 'dd/MM/yyyy'),
        t.type,
        t.amount,
        t.category,
        t.description,
        entities.find(e => e.id === t.entityId)?.name || '-',
        t.status || '-'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(consolidatedData);
    
    // Styling
    ws['A1'].s = titleStyle;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    
    // Section Headers Styling
    const sectionRows = [3, 8, 15, 26, 31, 35]; // Adjust based on data structure
    // We need to find the rows dynamically or use fixed ones if structure is stable
    // Let's find them by searching the array
    consolidatedData.forEach((row, idx) => {
      const firstCell = row[0];
      if (["PARAMÈTRES DU RAPPORT", "RÉSUMÉ DES INDICATEURS CLÉS (KPI)", "RÉPARTITION DES RECETTES", "RÉCAPITULATIF PAR FOURNISSEUR", "CONSOMMATIONS SPÉCIALES", "JOURNAL GLOBAL DES TRANSACTIONS"].includes(firstCell)) {
        const addr = XLSX.utils.encode_cell({ r: idx, c: 0 });
        ws[addr].s = sectionHeaderStyle;
        ws['!merges']?.push({ s: { r: idx, c: 0 }, e: { r: idx, c: 6 } });
      }
    });

    // KPI and Recettes Styling (Fixed ranges for simplicity in this consolidated view)
    for(let i = 9; i <= 13; i++) {
      const addrA = XLSX.utils.encode_cell({ r: i-1, c: 0 });
      const addrB = XLSX.utils.encode_cell({ r: i-1, c: 1 });
      if(ws[addrA]) ws[addrA].s = kpiLabelStyle;
      if(ws[addrB]) {
        ws[addrB].s = kpiValueStyle;
        ws[addrB].z = "#,##0 \"FCFA\"";
      }
    }

    for(let i = 16; i <= 24; i++) {
      const addrA = XLSX.utils.encode_cell({ r: i-1, c: 0 });
      const addrB = XLSX.utils.encode_cell({ r: i-1, c: 1 });
      if(ws[addrA]) ws[addrA].s = kpiLabelStyle;
      if(ws[addrB]) {
        ws[addrB].s = kpiValueStyle;
        ws[addrB].z = "#,##0 \"FCFA\"";
      }
    }

    // Style Table Headers (Supplier and Transactions)
    consolidatedData.forEach((row, idx) => {
      if (row[0] === "Fournisseur" || row[0] === "Date") {
        for (let c = 0; c < row.length; c++) {
          const addr = XLSX.utils.encode_cell({ r: idx, c });
          if (ws[addr]) ws[addr].s = headerStyle;
        }
      }
    });

    ws['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rapport Consolidé");

    XLSX.writeFile(wb, `PharmaPro_SuperExport_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Super Export Excel consolidé généré');
    addLog('CREATE', 'EXPORT', 'super_excel', 'Export Excel consolidé (feuille unique)');
  };

  // CRUD Handlers
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const requiredString = `delete/${tx.type}/${tx.amount}`;
    setConfirmDialog({
      open: true,
      title: 'Supprimer Transaction',
      message: 'Voulez-vous vraiment supprimer cette donnée ? Cette action est irréversible.',
      requiredString,
      onConfirm: async () => {
        try {
          await performWrite(
            () => api.deleteTransaction(id),
            'DELETE',
            'transactions',
            null,
            id
          );
          addLog('DELETE', 'TRANSACTION', id, `Suppression transaction ${id}`, tx);
          toast.success('Transaction supprimée');
          setConfirmDialog(null);
        } catch (error) {
          // Error handled by performWrite
        }
      }
    });
  };

  const handleDeleteEntity = (id: string) => {
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    const requiredString = `delete/${entity.name}`;
    setConfirmDialog({
      open: true,
      title: 'Supprimer Partenaire',
      message: `Voulez-vous vraiment supprimer ${entity?.name} ? Cette action est irréversible.`,
      requiredString,
      onConfirm: async () => {
        try {
          await performWrite(
            () => api.deleteEntity(id),
            'DELETE',
            'entities',
            null,
            id
          );
          addLog('DELETE', 'ENTITY', id, `Suppression partenaire ${entity?.name}`, entity);
          toast.success('Partenaire supprimé');
          setConfirmDialog(null);
        } catch (error) {
          // Error handled by performWrite
        }
      }
    });
  };

  const handleCreateManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const name = `Sauvegarde Manuelle - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
      const newBackup = await performWrite(
        () => api.createBackup(name, 'MANUAL'),
        'CREATE',
        'backups'
      );
      
      if (newBackup) {
        toast.success("Sauvegarde créée avec succès");
      }
    } catch (error) {
      // Error handled by performWrite
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadBackup = (backup: Backup) => {
    const dataStr = JSON.stringify(backup, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `backup_${format(backup.timestamp, 'yyyy-MM-dd_HHmm')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success("Téléchargement lancé");
  };

  const handleRestoreBackup = async (backup: Backup) => {
    const requiredString = `delete/restore/${backup.name.replace(/\s+/g, '_')}`;
    setConfirmDialog({
      open: true,
      title: 'Restaurer Sauvegarde',
      message: `Êtes-vous sûr de vouloir restaurer les données à partir de "${backup.name}" ? Cette action écrasera toutes les données actuelles.`,
      requiredString,
      onConfirm: async () => {
        setIsRestoring(true);
        try {
          await api.restoreBackup(backup);
          // Reload everything
          const [txs, ents, auditLogs] = await Promise.all([
            api.getTransactions(),
            api.getEntities(),
            api.getLogs()
          ]);
          setTransactions(txs);
          setEntities(ents);
          setLogs(auditLogs);
          toast.success("Restauration effectuée avec succès");
          setConfirmDialog(null);
        } catch (error) {
          toast.error("Erreur lors de la restauration");
        } finally {
          setIsRestoring(false);
        }
      }
    });
  };

  const handleUploadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content) as Backup;
        
        // Basic validation
        if (!backup.transactions || !backup.entities) {
          throw new Error("Format de sauvegarde invalide");
        }
        
        await handleRestoreBackup(backup);
      } catch (error) {
        toast.error("Fichier de sauvegarde invalide");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };
  
  const handleSaveEntity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const type = formData.get('type') as EntityType;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const address = formData.get('address') as string;

    try {
      if (editingEntity) {
        const requiredString = `delete/${editingEntity.name}`;
        setConfirmDialog({
          open: true,
          title: 'Confirmer la modification',
          message: `Voulez-vous vraiment modifier ${editingEntity.name} ? Cette action nécessite une confirmation.`,
          requiredString,
          onConfirm: async () => {
            try {
              const updated = { ...editingEntity, name, type, phone, email, address };
              const saved = await performWrite(
                () => api.saveEntity(updated),
                'UPDATE',
                'entities',
                updated,
                editingEntity.id
              );
              
              if (saved) {
                addLog('UPDATE', 'ENTITY', updated.id, `Modification ${type.toLowerCase()} ${name}`, editingEntity, updated);
                toast.success('Partenaire mis à jour');
                setEditingEntity(null);
                form.reset();
                setConfirmDialog(null);
              }
            } catch (error) {
              // Error handled by performWrite
            }
          }
        });
      } else {
        const newEntity: Partial<Entity> = {
          name,
          type,
          phone,
          email,
          address,
          status: 'ACTIF'
        };
        const saved = await performWrite(
          () => api.saveEntity(newEntity),
          'CREATE',
          'entities',
          newEntity
        );
        
        if (saved) {
          addLog('CREATE', 'ENTITY', saved.id, `Ajout ${type.toLowerCase()} ${name}`, undefined, saved);
          toast.success('Partenaire ajouté');
          setEditingEntity(null);
          form.reset();
        }
      }
    } catch (error) {
      console.error("Erreur détaillée lors de l'enregistrement du partenaire:", error);
      let message = "Erreur lors de l'enregistrement";
      if (error instanceof Error) {
        try {
          const info = JSON.parse(error.message);
          if (info.error.includes('insufficient permissions')) {
            message = "Permissions insuffisantes pour cette action.";
          } else {
            message = `Erreur: ${info.error}`;
          }
        } catch {
          message = error.message;
        }
      }
      toast.error(message);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080d1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080d1a] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl relative z-10 transition-colors duration-300"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 dark:border-emerald-500/30">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pharmacie de l'Aéroport</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Dashboard de Gestion Interne</p>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Utilisateur</label>
              <input 
                name="user"
                type="text" 
                required
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors duration-300"
                placeholder="Identifiant"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mot de passe</label>
              <input 
                name="pass"
                type="password" 
                required
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors duration-300"
                placeholder="••••••••"
              />
            </div>
            {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
            <button 
              type="submit"
              disabled={isLoggingIn}
              className={cn(
                "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20",
                isLoggingIn && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoggingIn ? (isSignUp ? 'Création...' : 'Connexion...') : (isSignUp ? 'Créer un compte' : 'Se connecter')}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setLoginError(''); }}
                className="text-xs text-emerald-600 hover:text-emerald-500 font-medium transition-colors"
              >
                {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-[#0e1629] px-2 text-slate-500">Ou continuer avec</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white font-bold py-4 rounded-xl transition-all shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080d1a] text-slate-600 dark:text-slate-200 flex transition-colors duration-300">
      <Toaster position="top-right" richColors />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#0e1629] flex flex-col fixed lg:sticky top-0 h-screen z-50 transition-transform duration-300",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">✚</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white tracking-tight">PHARMA PRO</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Aéroport de Lomé</p>
          </div>
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <XCircle size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem active={activeTab === 'accueil'} onClick={() => { setActiveTab('accueil'); setSubTab(''); setIsSidebarOpen(false); }} icon={<LayoutDashboard size={18}/>} label="Vue d'ensemble" />
          <NavItem active={activeTab === 'recettes'} onClick={() => { setActiveTab('recettes'); setSubTab(''); setIsSidebarOpen(false); }} icon={<TrendingUp size={18}/>} label="Caisse" />
          <NavItem active={activeTab === 'fournisseurs'} onClick={() => { setActiveTab('fournisseurs'); setSubTab('GLOBAL'); setIsSidebarOpen(false); }} icon={<Package size={18}/>} label="Fournisseurs" />
          <NavItem active={activeTab === 'dcssa'} onClick={() => { setActiveTab('dcssa'); setSubTab('DCSSA'); setIsSidebarOpen(false); }} icon={<FileText size={18}/>} label="DCSSA" />
          <NavItem active={activeTab === 'implants'} onClick={() => { setActiveTab('implants'); setSubTab(''); setIsSidebarOpen(false); }} icon={<Database size={18}/>} label="Implants" />
          <NavItem active={activeTab === 'assurances'} onClick={() => { setActiveTab('assurances'); setSubTab('LISTE'); setIsSidebarOpen(false); }} icon={<ShieldCheck size={18}/>} label="Assurances" />
          <NavItem active={activeTab === 'previsions'} onClick={() => { setActiveTab('previsions'); setSubTab(''); setIsSidebarOpen(false); }} icon={<LineChartIcon size={18}/>} label="Prévisions" />
          {userRole !== 'directrice' && (
            <>
              <div className="h-px bg-white/5 my-4 mx-2" />
              <NavItem 
                active={activeTab === 'saisie'} 
                onClick={() => { 
                  if (!isSaisieUnlocked) {
                    setPasswordModal({ open: true, target: 'saisie', onUnlock: () => { setIsSaisieUnlocked(true); setActiveTab('saisie'); setIsSidebarOpen(false); } });
                  } else {
                    setActiveTab('saisie'); 
                    setIsSidebarOpen(false);
                  }
                  setSubTab(''); 
                }} 
                icon={<PlusCircle size={18}/>} 
                label="Mise à jour" 
              />
              <NavItem 
                active={activeTab === 'parametres'} 
                onClick={() => { 
                  if (!isParametresUnlocked) {
                    setPasswordModal({ open: true, target: 'parametres', onUnlock: () => { setIsParametresUnlocked(true); setActiveTab('parametres'); setIsSidebarOpen(false); } });
                  } else {
                    setActiveTab('parametres'); 
                    setIsSidebarOpen(false);
                  }
                  setSubTab(''); 
                }} 
                icon={<Settings size={18}/>} 
                label="Paramètres" 
              />
            </>
          )}
          <div className="h-px bg-white/5 my-4 mx-2" />
          <NavItem active={activeTab === 'logs'} onClick={() => { setActiveTab('logs'); setSubTab(''); setIsSidebarOpen(false); }} icon={<History size={18}/>} label="Journal d'audit" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#0e1629]/50 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 lg:px-8 py-4 sticky top-0 z-40 transition-colors duration-300 gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                {activeTab === 'accueil' ? "Tableau de Bord" : 
                 activeTab === 'recettes' ? "Caisse" :
                 activeTab === 'dcssa' ? "DCSSA" :
                 activeTab === 'previsions' ? "Prévisions" :
                 activeTab === 'saisie' ? "Mise à jour" :
                 activeTab === 'parametres' ? "Paramètres" :
                 activeTab}
                {subTab && <span className="text-slate-400 dark:text-slate-500 font-normal ml-2">/ {subTab}</span>}
              </h2>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="sm:hidden p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all border border-slate-200 dark:border-white/5"
              title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <SyncStatusIndicator />
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="hidden sm:block p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all border border-slate-200 dark:border-white/5 shrink-0"
              title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex bg-slate-100 dark:bg-white/5 rounded-xl p-1 overflow-x-auto border border-slate-200 dark:border-white/5 shrink-0">
              <div className="flex items-center px-2">
                <input
                  type="date"
                  value={dateRange?.start || selectedDate}
                  onChange={(e) => {
                    setDateRange({ start: e.target.value, end: dateRange?.end || selectedDate });
                    setSelectedPeriod('CUSTOM' as any);
                  }}
                  className="px-1 py-1.5 rounded-lg text-[10px] font-bold bg-transparent text-slate-600 dark:text-slate-200 border-none focus:outline-none"
                />
                <span className="text-slate-400 text-[10px] px-1">à</span>
                <input
                  type="date"
                  value={dateRange?.end || selectedDate}
                  onChange={(e) => {
                    setDateRange({ start: dateRange?.start || selectedDate, end: e.target.value });
                    setSelectedPeriod('CUSTOM' as any);
                    setSelectedDate(e.target.value);
                  }}
                  className="px-1 py-1.5 rounded-lg text-[10px] font-bold bg-transparent text-slate-600 dark:text-slate-200 border-none focus:outline-none"
                />
              </div>
              {(['TOUT', 'JOUR', 'SEMAINE', 'QUINZAINE', 'MOIS', 'TRIMESTRE', 'SEMESTRE', 'ANNEE'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    if (selectedPeriod === p) {
                      setSelectedPeriod('CUSTOM');
                    } else {
                      setSelectedPeriod(p);
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                    selectedPeriod === p ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button 
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-900/20 shrink-0"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden lg:inline">Exporter Excel</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="hidden sm:flex items-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all border border-slate-200 dark:border-white/5 shrink-0"
            >
              <Download size={16} />
              <span className="hidden lg:inline">Exporter PDF</span>
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Password Modal */}
          <AnimatePresence>
            {passwordModal && passwordModal.open && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl transition-colors duration-300"
                >
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                      <Lock className="w-6 h-6 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Zone Protégée</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Entrez le mot de passe pour accéder à cette section</p>
                  </div>
                  
                  <div className="space-y-4">
                    <input 
                      type="password" 
                      autoFocus
                      className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="Mot de passe"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const result = await api.verifyPassword(passwordInput.trim(), passwordModal.target);
                          if (result.success) {
                            passwordModal.onUnlock();
                            setPasswordModal(null);
                            setPasswordInput('');
                            setPasswordError('');
                            toast.success('Accès autorisé');
                          } else {
                            setPasswordError(result.message || 'Mot de passe incorrect');
                          }
                        }
                      }}
                    />
                    {passwordError && <p className="text-red-500 text-[10px] text-center">{passwordError}</p>}
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setPasswordModal(null); setPasswordInput(''); setPasswordError(''); }}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-slate-200 dark:border-white/10"
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={async () => {
                          const result = await api.verifyPassword(passwordInput.trim(), passwordModal.target);
                          if (result.success) {
                            passwordModal.onUnlock();
                            setPasswordModal(null);
                            setPasswordInput('');
                            setPasswordError('');
                            toast.success('Accès autorisé');
                          } else {
                            setPasswordError(result.message || 'Mot de passe incorrect');
                          }
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm font-medium"
                      >
                        Déverrouiller
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Confirmation Modal */}
          <AnimatePresence>
            {confirmDialog && confirmDialog.open && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl transition-colors duration-300"
                >
                  <div className="flex items-center gap-3 mb-4 text-amber-500">
                    <AlertTriangle size={24} />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmDialog.title}</h3>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">{confirmDialog.message}</p>
                  
                  {confirmDialog.requiredString && (
                    <div className="mb-6">
                      <p className="text-xs text-slate-400 mb-2">Veuillez saisir <span className="font-mono font-bold text-slate-900 dark:text-white select-all">{confirmDialog.requiredString}</span> pour confirmer :</p>
                      <input 
                        type="text"
                        autoFocus
                        className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        placeholder={confirmDialog.requiredString}
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && confirmInput === confirmDialog.requiredString) {
                            confirmDialog.onConfirm();
                            setConfirmInput('');
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setConfirmDialog(null); setConfirmInput(''); }}
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-slate-200 dark:border-white/10"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={() => { confirmDialog.onConfirm(); setConfirmInput(''); }}
                      disabled={confirmDialog.requiredString ? confirmInput !== confirmDialog.requiredString : false}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-medium",
                        confirmDialog.requiredString && confirmInput !== confirmDialog.requiredString && "opacity-50 cursor-not-allowed grayscale"
                      )}
                    >
                      Confirmer
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {editingTransaction && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-2xl p-8 w-full max-w-2xl shadow-2xl transition-colors duration-300 my-8"
                >
                  <div className="flex items-center gap-3 mb-6 text-emerald-500">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                      <Edit2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Modifier la Transaction</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">ID: {editingTransaction.id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                        <input 
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type de Transaction</label>
                        <select 
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as TransactionType)}
                          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        >
                          {TRANSACTION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Montant (GNF)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Libellé</label>
                        <input 
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Partenaire (Optionnel)</label>
                        <select 
                          value={editEntityId}
                          onChange={(e) => setEditEntityId(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        >
                          <option value="">Aucun</option>
                          {entities.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                          ))}
                        </select>
                      </div>

                      {['FACTURE', 'COMMANDE', 'RETOUR'].includes(editType) && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Statut</label>
                          <select 
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          >
                            <option value="EN_ATTENTE">EN ATTENTE</option>
                            <option value="PAYÉE">PAYÉE</option>
                            <option value="REMBOURSÉ">REMBOURSÉ</option>
                            <option value="LIVRÉ">LIVRÉ</option>
                          </select>
                        </div>
                      )}

                      {['REJET_ASSURANCE', 'RETOUR'].includes(editType) && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Motif / Raison</label>
                          <input 
                            type="text"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      )}

                      {editType === 'CONSOMMATION_DCSSA' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de Dossiers</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={editDossiers}
                            onChange={(e) => setEditDossiers(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      )}

                      {editType === 'CONSOMMATION_ASSURANCE' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de Bénéficiaires</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={editBeneficiaires}
                            onChange={(e) => setEditBeneficiaires(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-8">
                    <button 
                      onClick={() => setEditingTransaction(null)}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-slate-200 dark:border-white/10"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleUpdateTransaction}
                      className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm font-medium shadow-lg shadow-emerald-600/20"
                    >
                      Mettre à jour
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* TAB: ACCUEIL */}
          {activeTab === 'accueil' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                  label="Chiffre d'affaire" 
                  value={formatCurrency(metrics.chiffreAffaires)} 
                  trend={calculateGrowth(metrics.chiffreAffaires, prevMetrics.chiffreAffaires)} 
                  icon={<TrendingUp className="text-emerald-500" />} 
                  color="emerald" 
                  subMetrics={[
                    { label: 'Ventes Comptant', value: formatCurrency(metrics.totalVenteComptant) },
                    { label: 'Ventes Tiers Payant', value: formatCurrency(metrics.totalVenteTiersPayant) }
                  ]}
                />
                <KPICard 
                  label="Recettes Totales" 
                  value={formatCurrency(metrics.recettesEncaisses)} 
                  trend={calculateGrowth(metrics.recettesEncaisses, prevMetrics.recettesEncaisses)} 
                  icon={<DollarSign className="text-emerald-500" />} 
                  color="emerald" 
                />
                <KPICard 
                  label="Commandes Fournisseurs" 
                  value={formatCurrency(metrics.totalCommandes)} 
                  trend={calculateGrowth(metrics.totalCommandes, prevMetrics.totalCommandes)} 
                  icon={<Package className="text-blue-500" />} 
                  color="blue" 
                />
                <KPICard 
                  label="Part Assurance à Réglée" 
                  value={formatCurrency(metrics.partAssuranceAReglee)} 
                  trend={calculateGrowth(metrics.partAssuranceAReglee, prevMetrics.partAssuranceAReglee)} 
                  icon={<ShieldCheck className="text-amber-500" />} 
                  color="amber" 
                />
                <KPICard 
                  label="Consommation DCSSA" 
                  value={formatCurrency(metrics.consommationDCSSA)} 
                  trend={calculateGrowth(metrics.consommationDCSSA, prevMetrics.consommationDCSSA)} 
                  icon={<FileText className="text-purple-500" />} 
                  color="purple" 
                />
                <KPICard 
                  label="Consommation Implant" 
                  value={formatCurrency(metrics.consommationImplant)} 
                  trend={calculateGrowth(metrics.consommationImplant, prevMetrics.consommationImplant)} 
                  icon={<Database className="text-purple-500" />} 
                  color="purple" 
                />
                <KPICard 
                  label="Ventes à Crédit" 
                  value={formatCurrency(metrics.totalVenteACredit)} 
                  trend={calculateGrowth(metrics.totalVenteACredit, prevMetrics.totalVenteACredit)} 
                  icon={<Users className="text-amber-500" />} 
                  color="amber" 
                />
                <KPICard 
                  label="Rejets Assurances" 
                  value={formatCurrency(metrics.rejetsAssurance)} 
                  trend={calculateGrowth(metrics.rejetsAssurance, prevMetrics.rejetsAssurance)} 
                  icon={<ShieldAlert className="text-red-500" />} 
                  color="red" 
                />
                <KPICard 
                  label="Montant Factures Réglées" 
                  value={formatCurrency(metrics.montantFacturesReglees)} 
                  trend={calculateGrowth(metrics.montantFacturesReglees, prevMetrics.montantFacturesReglees)} 
                  icon={<CheckCircle2 className="text-emerald-500" />} 
                  color="emerald" 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Évolution Entrées vs Sorties</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={recettesChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                        <XAxis dataKey="name" stroke={darkMode ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke={darkMode ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000000}M`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, 
                            borderRadius: '12px',
                            color: darkMode ? '#f1f5f9' : '#0f172a'
                          }}
                          itemStyle={{ fontSize: '12px', color: darkMode ? '#f1f5f9' : '#0f172a' }}
                        />
                        <Line type="monotone" dataKey="entrees" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Entrées" />
                        <Line type="monotone" dataKey="sorties" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Sorties" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Répartition des Recettes</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Total Vente au Comptant', value: recettesData.totalVenteComptant },
                            { name: 'Part Assurée Tiers Payant', value: recettesData.partAssureeTiersPayant },
                            { name: 'Part Assurance à Réglée', value: recettesData.partAssuranceAReglee },
                            { name: 'Total Vente à Crédit', value: recettesData.totalVenteACredit },
                            { name: 'Total TPE', value: recettesData.totalTPE },
                            { name: 'Totale Remise', value: recettesData.totaleRemise },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                            const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                            return percent > 0.05 ? (
                              <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                                {`${(percent * 100).toFixed(0)}%`}
                              </text>
                            ) : null;
                          }}
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#3b82f6" />
                          <Cell fill="#8b5cf6" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#06b6d4" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, 
                            borderRadius: '12px',
                            color: darkMode ? '#f1f5f9' : '#0f172a'
                          }}
                          formatter={(value: number, name: string, props: any) => {
                            const total = recettesData.totalGlobal;
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return [`${formatCurrency(value)} (${percent}%)`, name];
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Section Récapitulatif par Fournisseur sur Accueil */}
              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Récapitulatif par Fournisseur</h3>
                  <button 
                    onClick={() => setActiveTab('fournisseurs')}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider transition-colors"
                  >
                    Voir tout
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/2">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fournisseur</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total Commandes</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total Factures</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Factures Payées</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Solde à payer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {sortedSuppliers
                        .slice(0, 5)
                        .map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{s.name}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400 text-right">{formatCurrency(s.totalCommandes)}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400 text-right">{formatCurrency(s.totalFactures)}</td>
                          <td className="px-6 py-4 text-sm font-mono text-emerald-500 dark:text-emerald-400 text-right">{formatCurrency(s.totalPaidFactures)}</td>
                          <td className="px-6 py-4 text-sm font-mono text-amber-500 font-bold text-right">{formatCurrency(s.solde)}</td>
                        </tr>
                      ))}
                      {sortedSuppliers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm italic">Aucun fournisseur enregistré</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section Dernières Saisies sur Accueil */}
              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dernières Saisies (Toutes catégories)</h3>
                  <button 
                    onClick={() => setActiveTab('saisie')}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider transition-colors"
                  >
                    Voir tout
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0e1629]">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {[...transactions]
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .slice(0, 10)
                        .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              ['TOTAL_ESPECE', 'TOTAL_VENTE_COMPTANT', 'TOTAL_VENTE_TIERS_PAYANT', 'TOTAL_TPE', 'COMPTANTS', 'TIERS_PAYANT'].includes(t.type) ? "bg-emerald-500/10 text-emerald-500" :
                              ['TOTAL_VENTE_A_CREDIT', 'COMMANDE', 'FACTURE'].includes(t.type) ? "bg-amber-500/10 text-amber-500" :
                              "bg-slate-500/10 text-slate-500"
                            )}>
                              {t.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 dark:text-white truncate max-w-[200px]">{t.description}</td>
                          <td className="px-6 py-4 text-sm font-mono font-bold text-right text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm italic">Aucune saisie enregistrée</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RECETTES */}
          {activeTab === 'recettes' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Espèce" value={formatCurrency(recettesData.totalEspece)} subValue="Espèces en caisse" color="emerald" />
                <StatCard label="Total Vente au Comptant" value={formatCurrency(recettesData.totalVenteComptant)} subValue="Ventes directes" color="emerald" />
                <StatCard label="Part Assurée Tiers Payant" value={formatCurrency(recettesData.partAssureeTiersPayant)} subValue="Part patient" color="blue" />
                <StatCard label="Total Vente Tiers Payant" value={formatCurrency(recettesData.totalVenteTiersPayant)} subValue="Total avec assurance" color="blue" />
                <StatCard label="Part Assurance à Réglée" value={formatCurrency(recettesData.partAssuranceAReglee)} subValue="Part mutuelle" color="amber" />
                <StatCard label="Total Vente à Crédit" value={formatCurrency(recettesData.totalVenteACredit)} subValue="Crédits patients" color="amber" />
                <StatCard label="Total TPE" value={formatCurrency(recettesData.totalTPE)} subValue="Paiements par carte" color="cyan" />
                <StatCard label="Rejets Assurances" value={formatCurrency(recettesData.rejetsAssurance)} subValue="Pertes sèches" color="red" />
                <StatCard label="Totale Toutes Ventes Confondu" value={formatCurrency(recettesData.totalGlobal)} subValue="Chiffre d'affaires" color="emerald" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Péremption & Avariés" value={formatCurrency(recettesData.peremptionAvarie)} subValue="Pertes sur produits" color="red" />
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Évolution des Flux de Recettes</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recettesChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                          border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                          borderRadius: '12px',
                          color: darkMode ? '#f8fafc' : '#0f172a'
                        }} 
                        itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="comptants" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Total Comptant (Espèce - Part Patient)" />
                      <Line type="monotone" dataKey="tiers" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Part Assurance" />
                      <Line type="monotone" dataKey="credit" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Total Vente à Crédit" />
                      <Line type="monotone" dataKey="tpe" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} name="Total TPE" />
                      <Line type="monotone" dataKey="rejets" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Rejets Assurances" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('label')}>Catégorie {getSortIcon('label')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('val')}>Montant {getSortIcon('val')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('val')}>% du Total {getSortIcon('val')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {sortData([
                      { label: 'Total Espèce', val: recettesData.totalEspece, color: 'text-emerald-500', desc: 'Total encaissé en espèces' },
                      { label: 'Total Vente au Comptant', val: recettesData.totalVenteComptant, color: 'text-emerald-500', desc: 'Ventes payées 100% cash' },
                      { label: 'Part Assurée Tiers Payant', val: recettesData.partAssureeTiersPayant, color: 'text-blue-500', desc: 'Part payée par le patient (Assurance)' },
                      { label: 'Total Vente Tiers Payant', val: recettesData.totalVenteTiersPayant, color: 'text-blue-500', desc: 'Valeur totale des ventes avec assurance' },
                      { label: 'Part Assurance à Réglée', val: recettesData.partAssuranceAReglee, color: 'text-amber-500', desc: 'Part à payer par la mutuelle' },
                      { label: 'Total Vente à Crédit', val: recettesData.totalVenteACredit, color: 'text-amber-500', desc: 'Ventes à crédit patients' },
                      { label: 'Total TPE', val: recettesData.totalTPE, color: 'text-cyan-500', desc: 'Paiements par carte bancaire' },
                      { label: 'Rejets Assurances', val: recettesData.rejetsAssurance, color: 'text-red-500', desc: 'Pertes sur rejets mutuelles' },
                    ]).map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">{row.label}</div>
                          <div className="text-[10px] text-slate-400">{row.desc}</div>
                        </td>
                        <td className={cn("px-6 py-4 text-sm font-mono font-bold", row.color)}>{formatCurrency(row.val)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{((row.val / recettesData.totalGlobal) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-white/5 border-t-2 border-slate-200 dark:border-white/10">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase">Totale Toutes Ventes Confondu</div>
                        <div className="text-[10px] text-slate-400 font-normal">Chiffre d'affaires global de la période</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(recettesData.totalGlobal)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">100%</td>
                    </tr>
                    <tr className="bg-red-50 dark:bg-red-500/5 border-t border-red-100 dark:border-red-500/10">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-red-600 dark:text-red-400 uppercase">Péremption & Avariés</div>
                        <div className="text-[10px] text-red-500/70 font-normal">Pertes sur produits</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-bold text-red-600 dark:text-red-400">{formatCurrency(recettesData.peremptionAvarie)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-red-600 dark:text-red-400">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: FOURNISSEURS */}
          {activeTab === 'fournisseurs' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-4">
                <div className="flex gap-4 overflow-x-auto no-scrollbar">
                  {['GLOBAL', 'COMMANDES', 'FACTURES', 'FACTURES PAYÉES'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => {
                        setSubTab(tab);
                        setSelectedInvoices([]);
                      }}
                      className={cn(
                        "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                        subTab === tab ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-white/10">
                  <Package size={16} className="text-slate-400" />
                  <select
                    value={selectedSupplierFilter}
                    onChange={(e) => {
                      setSelectedSupplierFilter(e.target.value);
                      setSelectedInvoices([]);
                    }}
                    className="bg-transparent border-none text-sm font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-[#0f172a]">Tous les fournisseurs</option>
                    {sortedSuppliers.map(s => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-[#0f172a]">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {subTab === 'GLOBAL' && (
                <div className="space-y-8">
                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Évolution des Commandes (Global)</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={fournisseursChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                              border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                              borderRadius: '12px',
                              color: darkMode ? '#f8fafc' : '#0f172a'
                            }} 
                            itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                          />
                          <Line type="monotone" dataKey="commandes" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Commandes" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {fournisseursPivotData.length > 0 ? (
                    <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-x-auto transition-colors duration-300">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fournisseur</th>
                            {Object.keys(fournisseursPivotData[0]).filter(k => k !== 'name' && k !== 'id' && k !== 'total').map(month => (
                              <th key={month} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort(month)}>{month} {getSortIcon(month)}</th>
                            ))}
                            <th className="px-6 py-4 text-[10px] font-bold text-emerald-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('total')}>Total {getSortIcon('total')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {sortData(fournisseursPivotData).map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{row.name}</td>
                              {Object.keys(row).filter(k => k !== 'name' && k !== 'id' && k !== 'total').map(month => (
                                <td key={month} className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">{formatCurrency(row[month])}</td>
                              ))}
                              <td className="px-6 py-4 text-sm font-mono font-bold text-emerald-500">{formatCurrency(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-8 text-center transition-colors duration-300">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Aucun fournisseur enregistré ou aucune donnée disponible.</p>
                    </div>
                  )}
                </div>
              )}

              {subTab === 'COMMANDES' && (
                <div className="space-y-12">
                  {/* SECTION 1: COMMANDES */}
                  <div className="bg-white dark:bg-[#0e1629] border-t-4 border-t-emerald-500 border-x border-b border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300 shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center gap-3 bg-emerald-50/30 dark:bg-emerald-500/5">
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                        <Package size={20} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">Suivi des Commandes</h3>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-white/5">
                      {sortedSuppliers.filter(e => selectedSupplierFilter === '' || e.id === selectedSupplierFilter).map(supplier => {
                        const supplierCommands = filteredTransactions.filter(t => 
                          t.entityId === supplier.id && t.type === 'COMMANDE'
                        ).sort((a, b) => b.date.getTime() - a.date.getTime());
                        
                        if (supplierCommands.length === 0) return null;
                        
                        const totalAmount = supplierCommands.reduce((sum, t) => sum + t.amount, 0);
                        const isExpanded = expandedSupplierId === `cmd-${supplier.id}`;

                        return (
                          <div key={`cmd-${supplier.id}`} className="flex flex-col">
                            <button
                              onClick={() => setExpandedSupplierId(isExpanded ? null : `cmd-${supplier.id}`)}
                              className="flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-white/2 transition-colors text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
                                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                                <div>
                                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{supplier.name}</h4>
                                  <p className="text-sm text-slate-500 dark:text-slate-400">{supplierCommands.length} commande(s)</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-mono font-bold text-emerald-500">{formatCurrency(totalAmount)}</p>
                              </div>
                            </button>
                            
                            {isExpanded && (
                              <div className="bg-slate-50 dark:bg-white/2 p-6 border-t border-slate-200 dark:border-white/5">
                                <div className="overflow-x-auto bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-white/5">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">N° Commande</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                        {userRole !== 'directrice' && (
                                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                      {supplierCommands.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                                          <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{t.invoiceNumber || '-'}</td>
                                          <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.description}</td>
                                          {userRole !== 'directrice' && (
                                            <td className="px-6 py-4 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                <button 
                                                  onClick={() => setEditingTransaction(t)}
                                                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                >
                                                  <Edit2 size={14} />
                                                </button>
                                                <button 
                                                  onClick={() => handleDeleteTransaction(t.id)}
                                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sortedSuppliers.every(supplier => !filteredTransactions.some(t => t.entityId === supplier.id && t.type === 'COMMANDE')) && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                          Aucune commande trouvée pour la période sélectionnée.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'FACTURES' && (
                <div className="space-y-12">
                  {/* SECTION 2: FACTURES EN ATTENTE */}
                  <div className="bg-white dark:bg-[#0e1629] border-t-4 border-t-blue-500 border-x border-b border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300 shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-50/30 dark:bg-blue-500/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                          <FileText size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">Factures en attente</h3>
                      </div>
                      {selectedInvoices.length > 0 && (
                        <button
                          onClick={() => handleBulkPaymentStatus(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <CheckCircle2 size={16} />
                          Marquer comme Payé ({selectedInvoices.length})
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-white/5">
                      {sortedSuppliers.filter(e => selectedSupplierFilter === '' || e.id === selectedSupplierFilter).map(supplier => {
                        const unpaidInvoices = filteredTransactions.filter(t => 
                          t.entityId === supplier.id && t.type === 'FACTURE' && !t.paid
                        ).sort((a, b) => b.date.getTime() - a.date.getTime());
                        
                        if (unpaidInvoices.length === 0) return null;
                        
                        const totalUnpaid = unpaidInvoices.reduce((sum, t) => sum + t.amount, 0);
                        const isExpanded = expandedSupplierId === `fac-${supplier.id}`;

                        return (
                          <div key={`fac-${supplier.id}`} className="flex flex-col">
                            <div className="flex items-center hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                              <div className="px-6 py-4 flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={unpaidInvoices.length > 0 && unpaidInvoices.every(t => selectedInvoices.includes(t.id))}
                                  onChange={() => {
                                    const allSelected = unpaidInvoices.every(t => selectedInvoices.includes(t.id));
                                    if (allSelected) {
                                      setSelectedInvoices(prev => prev.filter(id => !unpaidInvoices.find(inv => inv.id === id)));
                                    } else {
                                      const newIds = unpaidInvoices.map(inv => inv.id).filter(id => !selectedInvoices.includes(id));
                                      setSelectedInvoices(prev => [...prev, ...newIds]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </div>
                              <button
                                onClick={() => setExpandedSupplierId(isExpanded ? null : `fac-${supplier.id}`)}
                                className="flex-1 flex items-center justify-between p-6 pl-0 transition-colors text-left"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{supplier.name}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{unpaidInvoices.length} facture(s) en attente</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-mono font-bold text-emerald-500">{formatCurrency(totalUnpaid)}</p>
                                </div>
                              </button>
                            </div>
                            
                            {isExpanded && (
                              <div className="bg-slate-50 dark:bg-white/2 p-6 border-t border-slate-200 dark:border-white/5 space-y-6">
                                {Object.entries(
                                  unpaidInvoices.reduce((groups, t) => {
                                    const label = getFortnightLabel(t.date);
                                    if (!groups[label]) groups[label] = [];
                                    groups[label].push(t);
                                    return groups;
                                  }, {} as Record<string, typeof unpaidInvoices>)
                                ).map(([fortnight, invoicesGroup]) => {
                                  const invoices = invoicesGroup as Transaction[];
                                  const fortnightTotal = invoices.reduce((sum, t) => sum + t.amount, 0);
                                  const allInFortnightSelected = invoices.every(t => selectedInvoices.includes(t.id));
                                  
                                  return (
                                    <div key={fortnight} className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                      <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={allInFortnightSelected}
                                            onChange={() => {
                                              if (allInFortnightSelected) {
                                                setSelectedInvoices(prev => prev.filter(id => !invoices.find(inv => inv.id === id)));
                                              } else {
                                                const newIds = invoices.map(inv => inv.id).filter(id => !selectedInvoices.includes(id));
                                                setSelectedInvoices(prev => [...prev, ...newIds]);
                                              }
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fortnight}</span>
                                        </div>
                                        <span className="text-sm font-mono font-bold text-emerald-500">{formatCurrency(fortnightTotal)}</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/5">
                                              <th className="px-4 py-4 w-10"></th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">N° Facture</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                              {userRole !== 'directrice' && (
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                            {invoices.map((t) => (
                                              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                                                <td className="px-4 py-3 w-10">
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedInvoices.includes(t.id)}
                                                    onChange={() => {
                                                      setSelectedInvoices(prev => 
                                                        prev.includes(t.id) 
                                                          ? prev.filter(id => id !== t.id)
                                                          : [...prev, t.id]
                                                      );
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                  />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{t.invoiceNumber || '-'}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{t.description}</td>
                                                {userRole !== 'directrice' && (
                                                  <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <button 
                                                        onClick={() => setEditingTransaction(t)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                      >
                                                        <Edit2 size={14} />
                                                      </button>
                                                      <button 
                                                        onClick={() => handleDeleteTransaction(t.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </div>
                                                  </td>
                                                )}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sortedSuppliers.every(supplier => !filteredTransactions.some(t => t.entityId === supplier.id && t.type === 'FACTURE' && !t.paid)) && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                          Aucune facture en attente trouvée pour la période sélectionnée.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'FACTURES PAYÉES' && (
                <div className="space-y-12">
                  {/* SECTION 3: FACTURES PAYÉES */}
                  <div className="bg-white dark:bg-[#0e1629] border-t-4 border-t-amber-500 border-x border-b border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300 shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/30 dark:bg-amber-500/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                          <CheckCircle2 size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">Factures Payées</h3>
                      </div>
                      {selectedInvoices.length > 0 && (
                        <button
                          onClick={() => handleBulkPaymentStatus(false)}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20"
                        >
                          <XCircle size={16} />
                          Marquer comme Non Payé ({selectedInvoices.length})
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-white/5">
                      {sortedSuppliers.filter(e => selectedSupplierFilter === '' || e.id === selectedSupplierFilter).map(supplier => {
                        const paidInvoices = filteredTransactions.filter(t => 
                          t.entityId === supplier.id && t.type === 'FACTURE' && t.paid
                        ).sort((a, b) => b.date.getTime() - a.date.getTime());
                        
                        if (paidInvoices.length === 0) return null;
                        
                        const totalPaid = paidInvoices.reduce((sum, t) => sum + t.amount, 0);
                        const isExpanded = expandedSupplierId === `paid-${supplier.id}`;

                        return (
                          <div key={`paid-${supplier.id}`} className="flex flex-col">
                            <div className="flex items-center hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                              <div className="px-6 py-4 flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={paidInvoices.length > 0 && paidInvoices.every(t => selectedInvoices.includes(t.id))}
                                  onChange={() => {
                                    const allSelected = paidInvoices.every(t => selectedInvoices.includes(t.id));
                                    if (allSelected) {
                                      setSelectedInvoices(prev => prev.filter(id => !paidInvoices.find(inv => inv.id === id)));
                                    } else {
                                      const newIds = paidInvoices.map(inv => inv.id).filter(id => !selectedInvoices.includes(id));
                                      setSelectedInvoices(prev => [...prev, ...newIds]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                              </div>
                              <button
                                onClick={() => setExpandedSupplierId(isExpanded ? null : `paid-${supplier.id}`)}
                                className="flex-1 flex items-center justify-between p-6 pl-0 transition-colors text-left"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{supplier.name}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{paidInvoices.length} facture(s) payée(s)</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-mono font-bold text-emerald-500">{formatCurrency(totalPaid)}</p>
                                </div>
                              </button>
                            </div>
                            
                            {isExpanded && (
                              <div className="bg-slate-50 dark:bg-white/2 p-6 border-t border-slate-200 dark:border-white/5 space-y-6">
                                {Object.entries(
                                  paidInvoices.reduce((groups, t) => {
                                    const label = getFortnightLabel(t.date);
                                    if (!groups[label]) groups[label] = [];
                                    groups[label].push(t);
                                    return groups;
                                  }, {} as Record<string, typeof paidInvoices>)
                                ).map(([fortnight, invoicesGroup]) => {
                                  const invoices = invoicesGroup as Transaction[];
                                  const fortnightTotal = invoices.reduce((sum, t) => sum + t.amount, 0);
                                  const allInFortnightSelected = invoices.every(t => selectedInvoices.includes(t.id));
                                  
                                  return (
                                    <div key={fortnight} className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                      <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={allInFortnightSelected}
                                            onChange={() => {
                                              if (allInFortnightSelected) {
                                                setSelectedInvoices(prev => prev.filter(id => !invoices.find(inv => inv.id === id)));
                                              } else {
                                                const newIds = invoices.map(inv => inv.id).filter(id => !selectedInvoices.includes(id));
                                                setSelectedInvoices(prev => [...prev, ...newIds]);
                                              }
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          />
                                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fortnight}</span>
                                        </div>
                                        <span className="text-sm font-mono font-bold text-emerald-500">{formatCurrency(fortnightTotal)}</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/5">
                                              <th className="px-4 py-4 w-10"></th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">N° Facture</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                              {userRole !== 'directrice' && (
                                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                            {invoices.map((t) => (
                                              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                                                <td className="px-4 py-3 w-10">
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedInvoices.includes(t.id)}
                                                    onChange={() => {
                                                      setSelectedInvoices(prev => 
                                                        prev.includes(t.id) 
                                                          ? prev.filter(id => id !== t.id)
                                                          : [...prev, t.id]
                                                      );
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                  />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{t.invoiceNumber || '-'}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{t.description}</td>
                                                {userRole !== 'directrice' && (
                                                  <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                      <button 
                                                        onClick={() => setEditingTransaction(t)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                      >
                                                        <Edit2 size={14} />
                                                      </button>
                                                      <button 
                                                        onClick={() => handleDeleteTransaction(t.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </div>
                                                  </td>
                                                )}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {sortedSuppliers.every(supplier => !filteredTransactions.some(t => t.entityId === supplier.id && t.type === 'FACTURE' && t.paid)) && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                          Aucune facture payée trouvée pour la période sélectionnée.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DCSSA */}
          {activeTab === 'dcssa' && (
            <div className="space-y-8">
              <div className="flex gap-4 border-b border-slate-200 dark:border-white/5">
                {['DCSSA', 'KOUNDJOURE'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSubTab(tab)}
                    className={cn(
                      "px-6 py-3 text-sm font-bold transition-all border-b-2",
                      subTab === tab ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Consommation Mensuelle {subTab}</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dcssaChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                          border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                          borderRadius: '12px',
                          color: darkMode ? '#f8fafc' : '#0f172a'
                        }} 
                        itemStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }}
                      />
                      <Line type="monotone" dataKey={subTab} stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Consommation" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('date')}>Date {getSortIcon('date')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('period')}>Période {getSortIcon('period')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('description')}>Description {getSortIcon('description')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('amount')}>Montant {getSortIcon('amount')}</th>
                      {userRole !== 'directrice' && (
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {sortData(filteredTransactions
                      .filter(t => t.type === (subTab === 'DCSSA' ? 'CONSOMMATION_DCSSA' : 'CONSOMMATION_KOUNDJOURE')))
                      .slice(0, 10)
                      .map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{t.period || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.description}</td>
                        <td className="px-6 py-4 text-sm font-mono text-emerald-500 font-bold">{formatCurrency(t.amount)}</td>
                        {userRole !== 'directrice' && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setEditingTransaction(t)}
                                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: IMPLANTS */}
          {activeTab === 'implants' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StatCard label="Consommation Implants" value={formatCurrency(filteredTransactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').reduce((s, t) => s + t.amount, 0))} subValue="Période sélectionnée" color="emerald" />
                <StatCard label="Nombre d'Actes" value={filteredTransactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').length.toString()} subValue="Total interventions" color="blue" />
                <StatCard label="Moyenne par Acte" value={formatCurrency(filteredTransactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').reduce((s, t) => s + t.amount, 0) / (filteredTransactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').length || 1))} subValue="Coût moyen" color="amber" />
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('date')}>Date {getSortIcon('date')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('period')}>Période {getSortIcon('period')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('description')}>Description {getSortIcon('description')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('amount')}>Montant {getSortIcon('amount')}</th>
                      {userRole !== 'directrice' && (
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {sortData(transactions.filter(t => t.type === 'CONSOMMATION_IMPLANT')).slice(0, 15).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{t.period || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{t.description}</td>
                        <td className="px-6 py-4 text-sm font-mono text-emerald-500 font-bold">{formatCurrency(t.amount)}</td>
                        {userRole !== 'directrice' && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setEditingTransaction(t)}
                                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ASSURANCES */}
          {activeTab === 'assurances' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/5">
                <div className="flex gap-4 overflow-x-auto">
                  {['LISTE', 'REJETS', ...entities.filter(e => e.type === 'ASSURANCE').map(a => a.name)].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSubTab(tab)}
                      className={cn(
                        "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                        subTab === tab ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={handleExportAssurancesCSV}
                  className="flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-emerald-500/20 mb-2 md:mb-0"
                >
                  <Download size={14} />
                  Exporter CSV Assurances
                </button>
              </div>

              {subTab === 'LISTE' && (
                <div className="space-y-8">
                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                      <TrendingUp className="text-emerald-500" size={20} />
                      Top Assurances par Volume de Consommation
                    </h3>
                    <div className="space-y-4">
                      {entities
                        .filter(e => e.type === 'ASSURANCE')
                        .map(a => {
                          const amount = filteredTransactions.filter(t => t.entityId === a.id && t.type === 'CONSOMMATION_ASSURANCE').reduce((s, t) => s + t.amount, 0);
                          return { ...a, amount };
                        })
                        .sort((a, b) => b.amount - a.amount)
                        .slice(0, 5)
                        .map((a, index) => (
                          <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-200 dark:border-white/5">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                index === 0 ? "bg-amber-500 text-white" :
                                index === 1 ? "bg-slate-300 text-slate-800" :
                                index === 2 ? "bg-amber-700 text-white" :
                                "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                              )}>
                                {index + 1}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{a.name}</h4>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{a.code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-emerald-500">{formatCurrency(a.amount)}</div>
                              <div className="text-[10px] text-slate-500">Volume consommé</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {entities.filter(e => e.type === 'ASSURANCE').map(a => {
                      const amount = filteredTransactions.filter(t => t.entityId === a.id && t.type === 'CONSOMMATION_ASSURANCE').reduce((s, t) => s + t.amount, 0);
                      const rejets = filteredTransactions.filter(t => t.entityId === a.id && t.type === 'REJET_ASSURANCE').reduce((s, t) => s + t.amount, 0);
                      return (
                        <div key={a.id} className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-all group shadow-sm dark:shadow-none">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white">{a.name}</h4>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{a.code}</p>
                            </div>
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                              <ShieldCheck size={20} />
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Consommation</span>
                              <span className="text-slate-900 dark:text-white font-bold font-mono">{formatCurrency(amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Rejets</span>
                              <span className="text-red-400 font-bold font-mono">{formatCurrency(rejets)}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex justify-between text-sm">
                              <span className="text-slate-400 font-bold">Solde Net</span>
                              <span className="text-emerald-500 font-bold font-mono">{formatCurrency(amount - rejets)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {subTab === 'REJETS' && (
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('entityId')}>Assurance {getSortIcon('entityId')}</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('period')}>Période {getSortIcon('period')}</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('reason')}>Motif {getSortIcon('reason')}</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('date')}>Date {getSortIcon('date')}</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('amount')}>Montant {getSortIcon('amount')}</th>
                        {userRole !== 'directrice' && (
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {sortData(filteredTransactions.filter(t => t.type === 'REJET_ASSURANCE')).slice(0, 15).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{entities.find(e => e.id === t.entityId)?.name}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{t.period || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.reason}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{format(t.date, 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm font-mono text-red-500 font-bold">{formatCurrency(t.amount)}</td>
                          {userRole !== 'directrice' && (
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => setEditingTransaction(t)}
                                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {entities.filter(e => e.type === 'ASSURANCE').map(a => a.name).includes(subTab) && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard label="Total Facturé" value={formatCurrency(transactions.filter(t => t.entityId === entities.find(e => e.name === subTab)?.id && t.type === 'CONSOMMATION_ASSURANCE').reduce((s, t) => s + t.amount, 0))} subValue="Toutes périodes" color="blue" />
                    <StatCard label="Total Rejets" value={formatCurrency(transactions.filter(t => t.entityId === entities.find(e => e.name === subTab)?.id && t.type === 'REJET_ASSURANCE').reduce((s, t) => s + t.amount, 0))} subValue="Pertes sèches" color="red" />
                  </div>
                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('date')}>Date {getSortIcon('date')}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('period')}>Période {getSortIcon('period')}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('amount')}>Montant {getSortIcon('amount')}</th>
                          {userRole !== 'directrice' && (
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {sortData(filteredTransactions.filter(t => t.entityId === entities.find(e => e.name === subTab)?.id && t.type === 'CONSOMMATION_ASSURANCE')).slice(0, 15).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{t.period || '-'}</td>
                            <td className="px-6 py-4 text-sm font-mono text-emerald-500 font-bold">{formatCurrency(t.amount)}</td>
                            {userRole !== 'directrice' && (
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingTransaction(t)}
                                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteTransaction(t.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SAISIE */}
          {activeTab === 'saisie' && (
            <div className="space-y-6">
              {/* Summary Metrics for Saisie */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Espèce" value={formatCurrency(recettesData.totalEspece)} subValue="Espèces en caisse" color="emerald" />
                <StatCard label="Total Vente au Comptant" value={formatCurrency(recettesData.totalVenteComptant)} subValue="Ventes directes" color="emerald" />
                <StatCard label="Part Assurée Tiers Payant" value={formatCurrency(recettesData.partAssureeTiersPayant)} subValue="Part patient" color="blue" />
                <StatCard label="Total Vente Tiers Payant" value={formatCurrency(recettesData.totalVenteTiersPayant)} subValue="Total avec assurance" color="blue" />
                <StatCard label="Part Assurance à Réglée" value={formatCurrency(recettesData.partAssuranceAReglee)} subValue="Part mutuelle" color="amber" />
                <StatCard label="Total Vente à Crédit" value={formatCurrency(recettesData.totalVenteACredit)} subValue="Crédits patients" color="amber" />
                <StatCard label="Total TPE" value={formatCurrency(recettesData.totalTPE)} subValue="Paiements par carte" color="cyan" />
                <StatCard label="Totale Remise" value={formatCurrency(recettesData.totaleRemise)} subValue="Remises accordées" color="red" />
                <StatCard label="Totale Toutes Ventes Confondu" value={formatCurrency(recettesData.totalGlobal)} subValue="Chiffre d'affaires" color="emerald" />
              </div>

              {/* Saisie Sections Navigation */}
              <div className="flex flex-wrap gap-2 bg-white dark:bg-[#0e1629] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors duration-300">
                {[
                  { id: 'VENTES', label: 'Ventes & Recettes', icon: DollarSign },
                  { id: 'FOURNISSEURS', label: 'Fournisseurs', icon: Package },
                  { id: 'CONSOMMATIONS', label: 'Consommations', icon: Activity },
                  { id: 'REJETS', label: 'Assurances & Rejets', icon: ShieldCheck },
                  { id: 'PEREMPTIONS', label: 'Péremptions & Avariés', icon: AlertTriangle }
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSaisieSection(section.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                      saisieSection === section.id 
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <section.icon size={16} />
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                      {saisieSection === 'VENTES' && 'Saisie Ventes'}
                      {saisieSection === 'FOURNISSEURS' && 'Saisie Fournisseurs'}
                      {saisieSection === 'CONSOMMATIONS' && 'Saisie Consommations'}
                      {saisieSection === 'REJETS' && 'Saisie Rejets'}
                      {saisieSection === 'PEREMPTIONS' && 'Saisie Péremptions & Avariés'}
                    </h3>
                    <form className="space-y-4" onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const dateStr = formData.get('date') as string;
                      let date = dateStr ? new Date(dateStr) : new Date();
                      
                      // If the selected date is today, use the current time to allow evolution on charts
                      const today = new Date();
                      if (isSameDay(date, today)) {
                        date = today;
                      } else {
                        // For past dates, set to noon to avoid timezone issues but allow grouping
                        date.setHours(12, 0, 0, 0);
                      }

                      const desc = formData.get('desc') as string;

                      try {
                        if (saisieSection === 'VENTES') {
                          const types = [
                            'TOTAL_ESPECE',
                            'TOTAL_VENTE_COMPTANT',
                            'PART_ASSUREE_TIERS_PAYANT',
                            'TOTAL_VENTE_TIERS_PAYANT',
                            'PART_ASSURANCE_A_REGLEE',
                            'TOTAL_VENTE_A_CREDIT',
                            'TOTAL_TPE',
                            'TOTALE_REMISE',
                            'TOTALE_TOUTES_VENTES_CONFONDU'
                          ];
                          
                          const newTxs: Partial<Transaction>[] = [];
                          types.forEach(type => {
                            const amount = Number(formData.get(type));
                            if (amount > 0) {
                              newTxs.push({
                                date,
                                type: type as TransactionType,
                                amount,
                                category: 'Saisie Journalière',
                                description: desc || `Saisie journalière ${type.replace(/_/g, ' ')}`,
                              });
                            }
                          });

                          if (newTxs.length > 0) {
                            const results = await performWrite(
                              () => api.createTransactions(newTxs),
                              'CREATE',
                              'transactions',
                              newTxs
                            );
                            
                            if (results) {
                              results.forEach(tx => {
                                addLog('CREATE', 'TRANSACTION', tx.id, `Saisie journalière: ${tx.type} - ${formatCurrency(tx.amount)}`, undefined, tx);
                              });
                              toast.success('Recettes journalières enregistrées');
                            }
                          }
                        } else {
                          const type = (saisieSection === 'PEREMPTIONS' ? 'PEREMPTION_AVARIE' : formData.get('type')) as TransactionType;
                          const amount = Number(formData.get('amount'));
                          const entityId = formData.get('entityId') as string;
                          const dossiers = formData.get('dossiers') ? Number(formData.get('dossiers')) : undefined;
                          const beneficiaires = formData.get('beneficiaires') ? Number(formData.get('beneficiaires')) : undefined;
                          const reason = formData.get('reason') as string;
                          const period = formData.get('period') as string;
                          
                          let invoiceNumber: string | undefined;
                          let paid: boolean | undefined;
                          let delivered: boolean | undefined;
                          
                          if (saisieSection === 'FOURNISSEURS') {
                            invoiceNumber = formData.get('invoiceNumber') as string;
                            paid = formData.get('paid') === 'on';
                            delivered = formData.get('delivered') === 'on';
                          }

                          const txData = {
                            date,
                            type,
                            amount,
                            category: saisieSection === 'PEREMPTIONS' ? 'Pertes' : 'Saisie Manuelle',
                            description: desc || type.replace(/_/g, ' '),
                            entityId: entityId || undefined,
                            dossiers,
                            beneficiaires,
                            reason: reason || undefined,
                            invoiceNumber,
                            paid,
                            delivered,
                            period: period || undefined
                          };

                          const newTx = await performWrite(
                            () => api.createTransaction(txData),
                            'CREATE',
                            'transactions',
                            txData
                          );

                          if (newTx) {
                            addLog('CREATE', 'TRANSACTION', newTx.id, `Saisie manuelle: ${type} - ${formatCurrency(amount)}`, undefined, newTx);
                            
                            // Duplication automatique de COMMANDE vers FACTURE
                            if (type === 'COMMANDE') {
                              const invoiceData = {
                                ...txData,
                                type: 'FACTURE' as TransactionType,
                                description: `Facture (dupliquée de Commande) - ${desc || 'COMMANDE'}`,
                                paid: false // Les factures sont impayées par défaut
                              };
                              
                              const newInvoice = await performWrite(
                                () => api.createTransaction(invoiceData),
                                'CREATE',
                                'transactions',
                                invoiceData
                              );
                              
                              if (newInvoice) {
                                addLog('CREATE', 'TRANSACTION', newInvoice.id, `Facture dupliquée de la commande: ${formatCurrency(amount)}`, undefined, newInvoice);
                              }
                            }
                            
                            toast.success('Donnée enregistrée');
                          }
                        }
                        
                        // Reset form but keep the date
                        const form = e.target as HTMLFormElement;
                        form.reset();
                      } catch (error) {
                        // Error handled by performWrite
                      }
                    }}>
                      {/* Date Input for Backdating */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 mb-6">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Date de la saisie</label>
                        <input 
                          name="date" 
                          type="date" 
                          value={saisieDate}
                          onChange={(e) => setSaisieDate(e.target.value)}
                          required 
                          className="w-full bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" 
                        />
                        <p className="text-xs text-slate-500 mt-2">Modifiez cette date pour antidater une saisie. La date est conservée après chaque saisie.</p>
                      </div>

                      {/* Form Fields based on Section */}
                      {saisieSection === 'VENTES' && (
                        <div className="space-y-4">
                          <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-emerald-600 uppercase mb-3">Espèces & Comptant</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Espèce</label>
                                <input name="TOTAL_ESPECE" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente au Comptant</label>
                                <input name="TOTAL_VENTE_COMPTANT" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3">Tiers Payant</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Part Assurée Tiers Payant</label>
                                <input name="PART_ASSUREE_TIERS_PAYANT" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente Tiers Payant</label>
                                <input name="TOTAL_VENTE_TIERS_PAYANT" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Part Assurance à Réglée</label>
                                <input name="PART_ASSURANCE_A_REGLEE" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-amber-600 uppercase mb-3">Autres</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente à Crédit</label>
                                <input name="TOTAL_VENTE_A_CREDIT" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total TPE</label>
                                <input name="TOTAL_TPE" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Totale Remise</label>
                                <input name="TOTALE_REMISE" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-red-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Totale Toutes Ventes Confondu</label>
                                <input name="TOTALE_TOUTES_VENTES_CONFONDU" type="number" step="0.01" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {saisieSection === 'FOURNISSEURS' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Type</label>
                            <select name="type" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="COMMANDE">Commande</option>
                              <option value="FACTURE">Facture</option>
                              <option value="RETOUR">Retour</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Fournisseur</label>
                            <select name="entityId" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="">Sélectionner...</option>
                              {sortedSuppliers.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Numéro de Facture</label>
                            <input 
                              type="text" 
                              name="invoiceNumber" 
                              required 
                              placeholder="Ex: FAC-2026-001"
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300"
                            />
                          </div>
                          <div className="flex gap-4 items-center mt-2">
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input type="checkbox" name="paid" className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
                              Payée
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input type="checkbox" name="delivered" className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
                              Livrée
                            </label>
                          </div>
                        </>
                      )}

                      {saisieSection === 'CONSOMMATIONS' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Type de Consommation</label>
                            <select 
                              name="type" 
                              required 
                              value={saisieConsommationType}
                              onChange={(e) => setSaisieConsommationType(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300"
                            >
                              <option value="CONSOMMATION_DCSSA">DCSSA</option>
                              <option value="CONSOMMATION_KOUNDJOURE">Koundjouré</option>
                              <option value="CONSOMMATION_IMPLANT">Implants</option>
                              <option value="CONSOMMATION_ASSURANCE">Assurance</option>
                            </select>
                          </div>
                          {saisieConsommationType === 'CONSOMMATION_ASSURANCE' && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Assurance</label>
                              <select name="entityId" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                                <option value="">Sélectionner...</option>
                                {entities.filter(e => e.type === 'ASSURANCE').map(e => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {(saisieConsommationType === 'CONSOMMATION_ASSURANCE' || saisieConsommationType === 'CONSOMMATION_IMPLANT' || saisieConsommationType === 'CONSOMMATION_DCSSA') && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Période</label>
                              <select name="period" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                                <option value="">Sélectionner une période...</option>
                                {generatePeriodOptions(saisieConsommationType === 'CONSOMMATION_ASSURANCE' ? 'quinzaine' : 'mois').map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}

                      {saisieSection === 'REJETS' && (
                        <>
                          <input type="hidden" name="type" value="REJET_ASSURANCE" />
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Assurance</label>
                            <select name="entityId" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="">Sélectionner...</option>
                              {entities.filter(e => e.type === 'ASSURANCE').map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Période</label>
                            <select name="period" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="">Sélectionner une période...</option>
                              {generatePeriodOptions('quinzaine').map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Motif du Rejet</label>
                            <input name="reason" type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" placeholder="Ex: Dépassement plafond" />
                          </div>
                        </>
                      )}

                      {saisieSection === 'PEREMPTIONS' && (
                        <>
                          <input type="hidden" name="type" value="PEREMPTION_AVARIE" />
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Détails (Produits concernés)</label>
                            <input name="reason" type="text" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" placeholder="Ex: Paracétamol 500mg (2 boîtes)" />
                          </div>
                        </>
                      )}

                      {/* Common Fields */}
                      <div className="grid grid-cols-1 gap-4">
                        {saisieSection !== 'VENTES' && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Montant</label>
                            <input name="amount" type="number" step="0.01" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" placeholder="0" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Description</label>
                        <input name="desc" type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" placeholder="Détails..." />
                      </div>
                      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <Plus size={18} />
                        Enregistrer
                      </button>
                    </form>
                  </div>

                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Import Excel</h3>
                  <div className="space-y-4">
                    <button 
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white py-3 rounded-xl border border-slate-200 dark:border-white/10 transition-all text-sm"
                    >
                      <FileSpreadsheet size={18} className="text-emerald-500" />
                      Télécharger Modèle
                    </button>
                    <label className="w-full flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 py-3 rounded-xl border border-emerald-500/20 transition-all text-sm cursor-pointer">
                      <Upload size={18} />
                      Importer Fichier
                      <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                  <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Dernières Saisies</h3>
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 w-full md:w-auto">
                      <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                          type="text" 
                          placeholder="Rechercher..." 
                          className="w-full sm:w-auto bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input 
                          type="date" 
                          value={saisieStartDate}
                          onChange={(e) => setSaisieStartDate(e.target.value)}
                          className="flex-1 sm:flex-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                        />
                        <span className="text-slate-400 text-xs">à</span>
                        <input 
                          type="date" 
                          value={saisieEndDate}
                          onChange={(e) => setSaisieEndDate(e.target.value)}
                          className="flex-1 sm:flex-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                        />
                      </div>
                        <select 
                          className="w-full sm:w-auto bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                          value={saisieTypeFilter}
                          onChange={(e) => setSaisieTypeFilter(e.target.value)}
                        >
                          <option value="TOUS">Tous les types</option>
                          <option value="TOTAL_ESPECE">Total Espèce</option>
                          <option value="TOTAL_VENTE_COMPTANT">Total Vente au Comptant</option>
                          <option value="PART_ASSUREE_TIERS_PAYANT">Part Assurée Tiers Payant</option>
                          <option value="TOTAL_VENTE_TIERS_PAYANT">Total Vente Tiers Payant</option>
                          <option value="PART_ASSURANCE_A_REGLEE">Part Assurance à Réglée</option>
                          <option value="TOTAL_VENTE_A_CREDIT">Total Vente à Crédit</option>
                          <option value="TOTALE_REMISE">Totale Remise</option>
                          <option value="TOTALE_TOUTES_VENTES_CONFONDU">Totale Toutes Ventes Confondu</option>
                          <option value="PEREMPTION_AVARIE">Péremption & Avariés</option>
                          <option value="COMMANDE">Commande Fournisseur</option>
                          <option value="FACTURE">Facture Fournisseur</option>
                          <option value="CONSOMMATION_DCSSA">Consommation DCSSA</option>
                          <option value="CONSOMMATION_KOUNDJOURE">Consommation Koundjouré</option>
                          <option value="CONSOMMATION_ASSURANCE">Consommation Assurance</option>
                          <option value="REJET_ASSURANCE">Rejet Assurance</option>
                        </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#0e1629]">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Détails</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Montant</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {[...transactions]
                          .filter(t => {
                            const matchesSearch = (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                                               (t.type?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                                               (t.entityId && entities.find(e => e.id === t.entityId)?.name.toLowerCase().includes(searchQuery.toLowerCase()));
                            const matchesType = saisieTypeFilter === 'TOUS' || t.type === saisieTypeFilter;
                            
                            const txDate = new Date(t.date);
                            const matchesStartDate = !saisieStartDate || txDate >= new Date(saisieStartDate);
                            const matchesEndDate = !saisieEndDate || txDate <= new Date(saisieEndDate);
                            
                            return matchesSearch && matchesType && matchesStartDate && matchesEndDate;
                          })
                          .sort((a, b) => b.date.getTime() - a.date.getTime())
                          .slice(0, 100)
                          .map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                            <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                t.type.startsWith('CONSOMMATION') ? "bg-blue-500/10 text-blue-500" :
                                t.type.includes('REJET') || t.type === 'PEREMPTION_AVARIE' ? "bg-red-500/10 text-red-500" :
                                t.type.includes('COMMANDE') || t.type.includes('FACTURE') ? "bg-amber-500/10 text-amber-500" :
                                "bg-emerald-500/10 text-emerald-500"
                              )}>
                                {t.type === 'TOTAL_ESPECE' ? 'Total Espèce' :
                                 t.type === 'TOTAL_VENTE_COMPTANT' ? 'Total Vente au Comptant' :
                                 t.type === 'PART_ASSUREE_TIERS_PAYANT' ? 'Part Assurée Tiers Payant' :
                                 t.type === 'TOTAL_VENTE_TIERS_PAYANT' ? 'Total Vente Tiers Payant' :
                                 t.type === 'PART_ASSURANCE_A_REGLEE' ? 'Part Assurance à Réglée' :
                                 t.type === 'TOTAL_VENTE_A_CREDIT' ? 'Total Vente à Crédit' :
                                 t.type === 'TOTALE_REMISE' ? 'Totale Remise' :
                                 t.type === 'TOTALE_TOUTES_VENTES_CONFONDU' ? 'Totale Toutes Ventes Confondu' :
                                 t.type === 'PEREMPTION_AVARIE' ? 'Péremption & Avariés' :
                                 t.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-900 dark:text-white font-medium">
                                {t.entityId ? entities.find(e => e.id === t.entityId)?.name : t.description}
                              </div>
                              {t.reason && <div className="text-[10px] text-red-400/70 italic">{t.reason}</div>}
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white font-bold text-right">
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingTransaction(t);
                                    setEditAmount(t.amount.toString());
                                  }}
                                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* TAB: PARAMETRES */}
          {activeTab === 'previsions' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <LineChartIcon className="text-emerald-500" size={20} />
                  Prévisions des Ventes (Prochaines Semaines)
                </h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={previsionsChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                      <XAxis dataKey="name" stroke={darkMode ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={darkMode ? "#64748b" : "#94a3b8"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000000}M`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                          border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, 
                          borderRadius: '12px',
                          color: darkMode ? '#f1f5f9' : '#0f172a'
                        }}
                        itemStyle={{ fontSize: '12px', color: darkMode ? '#f1f5f9' : '#0f172a' }}
                      />
                      <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Ventes Réelles" />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Tendance Prévue" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-500 mt-4 text-center">
                  * Les prévisions sont basées sur une projection linéaire simple des données historiques récentes.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'parametres' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Gestion des Partenaires</h3>
                <form onSubmit={handleSaveEntity} className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Nom</label>
                      <input name="name" type="text" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Type</label>
                      <select name="type" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                        <option value="FOURNISSEUR">Fournisseur</option>
                        <option value="ASSURANCE">Assurance</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all">
                    Ajouter Partenaire
                  </button>
                </form>

                <div className="space-y-2">
                  {entities.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-white/5">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{e.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{e.type}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteEntity(e.id)}
                        className="text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Configuration Système</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-white/5">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Verrouillage de Saisie</p>
                      <p className="text-xs text-slate-500">Exiger un code pour modifier les données</p>
                    </div>
                    <button 
                      onClick={() => setIsSaisieUnlocked(!isSaisieUnlocked)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        !isSaisieUnlocked ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {!isSaisieUnlocked ? <Lock size={20} /> : <Unlock size={20} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-white/5">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Verrouillage des Paramètres</p>
                      <p className="text-xs text-slate-500">Exiger un code pour accéder aux réglages</p>
                    </div>
                    <button 
                      onClick={() => setIsParametresUnlocked(!isParametresUnlocked)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        !isParametresUnlocked ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {!isParametresUnlocked ? <Lock size={20} /> : <Unlock size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sauvegardes & Restauration</h3>
                  <button 
                    onClick={handleCreateManualBackup}
                    disabled={isBackingUp}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    {isBackingUp ? <Clock size={14} className="animate-spin" /> : <Database size={14} />}
                    Créer une sauvegarde
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Importer une sauvegarde</p>
                    <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-4 cursor-pointer hover:border-emerald-500 transition-colors group">
                      <Upload size={20} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      <span className="text-xs text-slate-500 group-hover:text-emerald-500 transition-colors">Choisir un fichier JSON</span>
                      <input type="file" accept=".json" className="hidden" onChange={handleUploadBackup} />
                    </label>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Dernière sauvegarde</p>
                    {backups.length > 0 ? (
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{backups[0].name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{format(backups[0].timestamp, 'dd MMMM yyyy HH:mm', { locale: fr })}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Aucune sauvegarde disponible</p>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5">
                        <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase">Date</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase">Nom</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase">Type</th>
                        <th className="pb-4 text-[10px] font-bold text-slate-500 uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {backups.slice(0, 10).map(backup => (
                        <tr key={backup.id} className="group">
                          <td className="py-4 text-xs text-slate-500 font-mono">{format(backup.timestamp, 'dd/MM/yy HH:mm')}</td>
                          <td className="py-4 text-xs font-bold text-slate-900 dark:text-white">{backup.name}</td>
                          <td className="py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                              backup.type === 'AUTO' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                            )}>
                              {backup.type}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleDownloadBackup(backup)}
                                className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                title="Télécharger"
                              >
                                <Download size={14} />
                              </button>
                              <button 
                                onClick={() => handleRestoreBackup(backup)}
                                className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                                title="Restaurer"
                              >
                                <History size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Maintenance des données</h3>
                  <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-500">Régulariser les anciennes commandes</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-500/70 mt-1">
                          Génère automatiquement les factures manquantes pour les commandes saisies avant la mise en place de la duplication automatique.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const commandes = transactions.filter(t => t.type === 'COMMANDE');
                          const factures = transactions.filter(t => t.type === 'FACTURE');
                          
                          let missingCount = 0;
                          const matchedFactureIds = new Set<string>();

                          for (const cmd of commandes) {
                            // 1. Try to find exact match (same entity, amount, and exact same day)
                            let matchingFacture = factures.find(f => 
                              !matchedFactureIds.has(f.id) &&
                              f.entityId === cmd.entityId && 
                              f.amount === cmd.amount && 
                              f.date.getFullYear() === cmd.date.getFullYear() &&
                              f.date.getMonth() === cmd.date.getMonth() &&
                              f.date.getDate() === cmd.date.getDate()
                            );
                            
                            // 2. If no exact match, try to find a facture with same entity and amount within 30 days
                            if (!matchingFacture) {
                              matchingFacture = factures.find(f => 
                                !matchedFactureIds.has(f.id) &&
                                f.entityId === cmd.entityId && 
                                f.amount === cmd.amount &&
                                Math.abs(f.date.getTime() - cmd.date.getTime()) < 30 * 24 * 60 * 60 * 1000
                              );
                            }
                            
                            if (matchingFacture) {
                              // Mark this facture as matched so we don't use it for another command
                              matchedFactureIds.add(matchingFacture.id);
                            } else {
                              // No matching facture found, we need to create one
                              const invoiceData = {
                                ...cmd,
                                type: 'FACTURE' as TransactionType,
                                description: `Facture (régularisation) - ${cmd.description || 'COMMANDE'}`,
                                paid: false
                              };
                              // Remove id to create a new one
                              const { id, ...dataToCreate } = invoiceData;
                              await api.createTransaction(dataToCreate as any);
                              missingCount++;
                            }
                          }
                          
                          if (missingCount > 0) {
                            toast.success(`${missingCount} facture(s) manquante(s) générée(s) avec succès.`);
                            // Reload transactions
                            const txs = await api.getTransactions();
                            setTransactions(txs);
                          } else {
                            toast.info("Toutes les commandes ont déjà leur facture correspondante.");
                          }
                        }}
                        className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        Générer les factures manquantes
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-red-900 dark:text-red-500">Nettoyer les factures en double</h4>
                        <p className="text-xs text-red-700 dark:text-red-500/70 mt-1">
                          Détecte et supprime automatiquement les factures générées en double par erreur.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const factures = transactions.filter(t => t.type === 'FACTURE');
                          const uniqueKeys = new Set<string>();
                          const duplicatesToDelete: string[] = [];

                          for (const f of factures) {
                            // Signature unique : fournisseur + montant + date exacte + description
                            const key = `${f.entityId}_${f.amount}_${f.date.getFullYear()}-${f.date.getMonth()}-${f.date.getDate()}_${f.description}`;
                            
                            if (uniqueKeys.has(key)) {
                              duplicatesToDelete.push(f.id);
                            } else {
                              uniqueKeys.add(key);
                            }
                          }

                          if (duplicatesToDelete.length > 0) {
                            setConfirmDialog({
                              open: true,
                              title: 'Nettoyer les doublons',
                              message: `${duplicatesToDelete.length} factures en double ont été détectées. Voulez-vous les supprimer définitivement ?`,
                              onConfirm: async () => {
                                try {
                                  // Suppression par lot
                                  await Promise.all(duplicatesToDelete.map(id => api.deleteTransaction(id)));
                                  
                                  await api.addLog({
                                    action: 'DELETE',
                                    targetType: 'TRANSACTION',
                                    targetId: 'BULK_CLEANUP',
                                    details: `Suppression de ${duplicatesToDelete.length} factures en double`
                                  });
                                  
                                  toast.success(`${duplicatesToDelete.length} doublons supprimés avec succès.`);
                                  const txs = await api.getTransactions();
                                  setTransactions(txs);
                                } catch (e) {
                                  toast.error("Erreur lors de la suppression des doublons.");
                                }
                              }
                            });
                          } else {
                            toast.info("Aucune facture en double détectée.");
                          }
                        }}
                        className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        Supprimer les doublons
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Journal d'Audit</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Du</span>
                    <input 
                      type="date" 
                      className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                      value={logStartDate}
                      onChange={(e) => setLogStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Au</span>
                    <input 
                      type="date" 
                      className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors duration-300"
                      value={logEndDate}
                      onChange={(e) => setLogEndDate(e.target.value)}
                    />
                  </div>
                  {(logStartDate || logEndDate) && (
                    <button 
                      onClick={() => { setLogStartDate(''); setLogEndDate(''); }}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('timestamp')}>Horodatage {getSortIcon('timestamp')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('action')}>Action {getSortIcon('action')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('target')}>Cible {getSortIcon('target')}</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={() => handleSort('details')}>Détails {getSortIcon('details')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {sortData(logs
                      .filter(log => {
                        if (!logStartDate && !logEndDate) return true;
                        const logDate = startOfDay(log.timestamp);
                        const start = logStartDate ? startOfDay(parseISO(logStartDate)) : null;
                        const end = logEndDate ? startOfDay(parseISO(logEndDate)) : null;
                        
                        if (start && logDate < start) return false;
                        if (end && logDate > end) return false;
                        return true;
                      }))
                      .map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">{format(log.timestamp, 'dd/MM/yy HH:mm:ss')}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold uppercase",
                            log.action === 'CREATE' ? "bg-emerald-500/10 text-emerald-500" :
                            log.action === 'UPDATE' ? "bg-blue-500/10 text-blue-500" :
                            log.action === 'DELETE' ? "bg-red-500/10 text-red-500" :
                            log.action === 'BACKUP' ? "bg-amber-500/10 text-amber-500" :
                            log.action === 'RESTORATION' ? "bg-purple-500/10 text-purple-500" :
                            "bg-slate-500/10 text-slate-500"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-900 dark:text-white font-medium">{log.targetType}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// Helper Components
function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all group",
        active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-white" : "text-slate-500")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function KPICard({ label, value, trend, icon, color, subMetrics }: { label: string; value: string; trend: number; icon: React.ReactNode; color: string; subMetrics?: { label: string; value: string }[] }) {
  const isPositive = trend >= 0;
  const formattedTrend = isFinite(trend) && !isNaN(trend) ? Math.abs(trend).toFixed(1) : '0.0';

  return (
    <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 relative overflow-hidden group transition-colors duration-300">
      <div className={cn("absolute top-0 left-0 w-1 h-full", {
        'bg-emerald-500': color === 'emerald',
        'bg-blue-500': color === 'blue',
        'bg-amber-500': color === 'amber',
        'bg-red-500': color === 'red',
        'bg-purple-500': color === 'purple',
      })} />
      <div className="flex justify-between items-start mb-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
      </div>
      <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-mono">{value}</h4>
      
      {subMetrics && subMetrics.length > 0 && (
        <div className="mb-3 space-y-1">
          {subMetrics.map((sm, idx) => (
            <div key={idx} className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span>{sm.label}</span>
              <span className="font-mono font-bold">{sm.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={cn(
          "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
          isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
        )}>
          {isPositive ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}
          {formattedTrend}%
        </span>
        <span className="text-[10px] text-slate-500">vs période préc.</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, color }: { label: string; value: string; subValue: string; color: string }) {
  return (
    <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <h4 className={cn("text-xl font-bold mb-1 font-mono", {
        'text-emerald-500': color === 'emerald',
        'text-blue-500': color === 'blue',
        'text-amber-500': color === 'amber',
        'text-red-500': color === 'red',
        'text-purple-500': color === 'purple',
      })}>{value}</h4>
      <p className="text-[10px] text-slate-500">{subValue}</p>
    </div>
  );
}
