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
  Search,
  Filter,
  Download,
  AlertTriangle,
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  Printer,
  Database,
  Upload,
  Sun,
  Moon,
  Menu
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
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfQuarter, 
  startOfYear, 
  isSameDay, 
  isWithinInterval, 
  subDays,
  eachDayOfInterval,
  addDays,
  addMonths,
  isSameWeek,
  isSameMonth,
  isSameQuarter,
  isSameYear,
  parseISO,
  endOfMonth,
  endOfYear
} from 'date-fns';
import { fr } from 'date-fns/locale';
import XLSX from 'xlsx-js-style';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '@/src/lib/utils';
import { Transaction, Entity, AuditLog, TransactionType, EntityType } from '@/src/lib/data';
import { api, OperationType } from '@/src/services/api';
import { Toaster, toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { auth } from './lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

type Period = 'JOUR' | 'SEMAINE' | 'QUINZAINE' | 'MOIS' | 'TRIMESTRE' | 'SEMESTRE' | 'ANNEE';

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'TOTAL_ESPECE', label: 'Total Espèce' },
  { value: 'TOTAL_VENTE_COMPTANT', label: 'Total Vente au Comptant' },
  { value: 'PART_ASSUREE_TIERS_PAYANT', label: 'Part Assurée Tiers Payant' },
  { value: 'TOTAL_VENTE_TIERS_PAYANT', label: 'Total Vente Tiers Payant' },
  { value: 'PART_ASSURANCE_A_REGLEE', label: 'Part Assurance à Réglée' },
  { value: 'TOTAL_VENTE_A_CREDIT', label: 'Total Vente à Crédit' },
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

export default function App() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [subTab, setSubTab] = useState<string>('');
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaisieUnlocked, setIsSaisieUnlocked] = useState(false);
  const [isParametresUnlocked, setIsParametresUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; target: 'saisie' | 'parametres'; onUnlock: () => void } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('MOIS');
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
        const email = user.email || '';
        if (email === 'directrice@pharmapro.com') {
          setUserRole('directrice');
        } else if (email === 'assistant@pharmapro.com' || email === 'kennethafantsawo@gmail.com') {
          setUserRole('assistant');
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
      const fetchData = async () => {
        try {
          const [txs, ents, auditLogs] = await Promise.all([
            api.getTransactions(),
            api.getEntities(),
            api.getLogs()
          ]);
          setTransactions(txs);
          setEntities(ents);
          setLogs(auditLogs);
        } catch (error) {
          toast.error("Erreur lors du chargement des données");
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
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

      const updatedTx = await api.updateTransaction(editingTransaction.id, updates);
      
      setTransactions(prev => prev.map(t => 
        t.id === editingTransaction.id ? { ...t, ...updatedTx, date: new Date(editDate) } : t
      ));

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
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Auth Logic
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
      if (error.code === 'auth/too-many-requests') {
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

  // Global Filtering Logic
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let intervalStart: Date;
    switch (selectedPeriod) {
      case 'JOUR': intervalStart = startOfDay(now); break;
      case 'SEMAINE': intervalStart = startOfWeek(now, { weekStartsOn: 1 }); break;
      case 'QUINZAINE': intervalStart = now.getDate() <= 15 ? startOfMonth(now) : addDays(startOfMonth(now), 15); break;
      case 'MOIS': intervalStart = startOfMonth(now); break;
      case 'TRIMESTRE': intervalStart = startOfQuarter(now); break;
      case 'SEMESTRE': intervalStart = now.getMonth() < 6 ? startOfYear(now) : addDays(startOfYear(now), 182); break;
      case 'ANNEE': intervalStart = startOfYear(now); break;
      default: intervalStart = startOfMonth(now);
    }
    return transactions.filter(t => t.date >= intervalStart);
  }, [transactions, selectedPeriod]);

  // KPIs for Accueil
  const kpis = useMemo(() => {
    const totalRecettes = filteredTransactions
      .filter(t => ['COMPTANTS', 'PART_ASSUREE', 'TIERS_PAYANT', 'TOTAL_ESPECE', 'TOTAL_VENTE_COMPTANT', 'PART_ASSUREE_TIERS_PAYANT', 'PART_ASSURANCE_A_REGLEE'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalCommandes = filteredTransactions
      .filter(t => t.type === 'COMMANDE')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCredit = filteredTransactions
      .filter(t => ['CREDIT', 'TOTAL_VENTE_A_CREDIT'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalRejets = filteredTransactions
      .filter(t => t.type === 'REJET_ASSURANCE')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalImplants = filteredTransactions
      .filter(t => t.type === 'CONSOMMATION_IMPLANT')
      .reduce((sum, t) => sum + t.amount, 0);

    return { totalRecettes, totalCommandes, totalCredit, totalRejets, totalImplants };
  }, [filteredTransactions]);

  // Recettes Data
  const recettesData = useMemo(() => {
    const categories = {
      TOTAL_ESPECE: 0,
      TOTAL_VENTE_COMPTANT: 0,
      PART_ASSUREE_TIERS_PAYANT: 0,
      TOTAL_VENTE_TIERS_PAYANT: 0,
      PART_ASSURANCE_A_REGLEE: 0,
      TOTAL_VENTE_A_CREDIT: 0,
      TOTALE_REMISE: 0,
      TOTALE_TOUTES_VENTES_CONFONDU: 0,
      PEREMPTION_AVARIE: 0,
      // Keep old ones for backward compatibility if needed
      COMPTANTS: 0,
      PART_ASSUREE: 0,
      TIERS_PAYANT: 0,
      CREDIT: 0,
      REMISE: 0
    };
    filteredTransactions.forEach(t => {
      if (t.type in categories) {
        categories[t.type as keyof typeof categories] += t.amount;
      }
    });
    
    // If there are old transactions, map them to the new logic
    const totalEspece = categories.TOTAL_ESPECE + categories.COMPTANTS + categories.PART_ASSUREE;
    const totalVenteComptant = categories.TOTAL_VENTE_COMPTANT + categories.COMPTANTS;
    const partAssureeTiersPayant = categories.PART_ASSUREE_TIERS_PAYANT + categories.PART_ASSUREE;
    const totalVenteTiersPayant = categories.TOTAL_VENTE_TIERS_PAYANT + categories.PART_ASSUREE + categories.TIERS_PAYANT;
    const partAssuranceAReglee = categories.PART_ASSURANCE_A_REGLEE + categories.TIERS_PAYANT;
    const totalVenteACredit = categories.TOTAL_VENTE_A_CREDIT + categories.CREDIT;
    const totaleRemise = categories.TOTALE_REMISE + categories.REMISE;
    const totalGlobal = categories.TOTALE_TOUTES_VENTES_CONFONDU + categories.COMPTANTS + categories.PART_ASSUREE + categories.TIERS_PAYANT + categories.CREDIT;
    const peremptionAvarie = categories.PEREMPTION_AVARIE;

    return { 
      ...categories, 
      total: totalGlobal,
      totalEspece,
      totalVenteComptant,
      partAssureeTiersPayant,
      totalVenteTiersPayant,
      partAssuranceAReglee,
      totalVenteACredit,
      totaleRemise,
      totalGlobal,
      peremptionAvarie
    };
  }, [filteredTransactions]);

  // Chart Data for Recettes (follows selectedPeriod)
  const recettesChartData = useMemo(() => {
    const now = new Date();
    let filtered: Transaction[] = [];
    let groupingFn: (date: Date) => Date;
    let labelFormat: string;
    if (selectedPeriod === 'JOUR') {
      groupingFn = startOfDay;
      labelFormat = 'dd MMM';
      const targetDate = new Date(selectedDate);
      filtered = transactions.filter(t => isSameDay(t.date, targetDate));
    } else {
      let intervalStart: Date;
      switch (selectedPeriod) {
        case 'SEMAINE':
          intervalStart = subDays(now, 60); // Show last 8 weeks
          groupingFn = (d) => startOfWeek(d, { weekStartsOn: 1 });
          labelFormat = 'dd/MM';
          break;
        case 'QUINZAINE':
          intervalStart = subDays(now, 120);
          groupingFn = (d) => d.getDate() <= 15 ? startOfMonth(d) : addDays(startOfMonth(d), 15);
          labelFormat = 'dd/MM';
          break;
        case 'MOIS':
          intervalStart = startOfYear(now);
          groupingFn = startOfMonth;
          labelFormat = 'MMM';
          break;
        case 'TRIMESTRE':
          intervalStart = subDays(now, 730);
          groupingFn = startOfQuarter;
          labelFormat = 'QQQ yyyy';
          break;
        case 'SEMESTRE':
          intervalStart = subDays(now, 1825);
          groupingFn = (d) => d.getMonth() < 6 ? startOfYear(d) : addMonths(startOfYear(d), 6);
          labelFormat = 'S';
          break;
        case 'ANNEE':
          intervalStart = subDays(now, 1825); // 5 years
          groupingFn = startOfYear;
          labelFormat = 'yyyy';
          break;
        default:
          intervalStart = startOfMonth(now);
          groupingFn = startOfDay;
          labelFormat = 'dd MMM';
      }
      filtered = transactions.filter(t => t.date >= intervalStart);
    }
    
    const groups: Record<string, any> = {};

    filtered.forEach(t => {
      const key = groupingFn(t.date).toISOString();
      if (!groups[key]) {
        let name = format(groupingFn(t.date), labelFormat, { locale: fr });
        if (selectedPeriod === 'SEMESTRE') {
          name = groupingFn(t.date).getMonth() < 6 ? `S1 ${format(groupingFn(t.date), 'yyyy')}` : `S2 ${format(groupingFn(t.date), 'yyyy')}`;
        } else if (selectedPeriod === 'QUINZAINE') {
          const d = groupingFn(t.date);
          const isFirstHalf = d.getDate() <= 15;
          const month = format(d, 'MMM', { locale: fr });
          name = isFirstHalf ? `1-15 ${month}` : `16-fin ${month}`;
        }
        groups[key] = {
          date: groupingFn(t.date),
          name: name,
          comptants: 0,
          tiers: 0,
          credit: 0,
          remises: 0,
          commandes: 0,
          total: 0
        };
      }
      if (t.type === 'COMPTANTS' || t.type === 'PART_ASSUREE' || t.type === 'TOTAL_ESPECE' || t.type === 'TOTAL_VENTE_COMPTANT' || t.type === 'PART_ASSUREE_TIERS_PAYANT') {
        groups[key].comptants += t.amount;
        groups[key].total += t.amount;
      }
      if (t.type === 'TIERS_PAYANT' || t.type === 'PART_ASSURANCE_A_REGLEE') {
        groups[key].tiers += t.amount;
        groups[key].total += t.amount;
      }
      if (t.type === 'CREDIT' || t.type === 'TOTAL_VENTE_A_CREDIT') {
        groups[key].credit += t.amount;
        groups[key].total += t.amount;
      }
      if (t.type === 'REMISE' || t.type === 'TOTALE_REMISE') groups[key].remises += t.amount;
      if (t.type === 'COMMANDE') groups[key].commandes += t.amount;
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [transactions, selectedPeriod]);

  // Fournisseurs Chart Data
  const fournisseursChartData = useMemo(() => {
    return recettesChartData.map(d => ({
      name: d.name,
      commandes: d.commandes
    }));
  }, [recettesChartData]);

  const dcssaChartData = useMemo(() => {
    const now = new Date();
    let intervalStart = startOfYear(now);
    const filtered = transactions.filter(t => t.date >= intervalStart && (t.type === 'CONSOMMATION_DCSSA' || t.type === 'CONSOMMATION_KOUNDJOURE'));
    const groups: Record<string, any> = {};

    filtered.forEach(t => {
      const key = startOfMonth(t.date).toISOString();
      if (!groups[key]) {
        groups[key] = {
          date: startOfMonth(t.date),
          name: format(startOfMonth(t.date), 'MMM', { locale: fr }),
          DCSSA: 0,
          KOUNDJOURE: 0
        };
      }
      if (t.type === 'CONSOMMATION_DCSSA') groups[key].DCSSA += t.amount;
      if (t.type === 'CONSOMMATION_KOUNDJOURE') groups[key].KOUNDJOURE += t.amount;
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [transactions]);

  // Fournisseurs Pivot Table Data
  const fournisseursPivotData = useMemo(() => {
    const suppliers = entities.filter(e => e.type === 'FOURNISSEUR');
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => subDays(now, (5 - i) * 30));

    return suppliers.map(s => {
      const row: any = { name: s.name, id: s.id };
      let total = 0;
      months.forEach(m => {
        const key = format(m, 'MMM', { locale: fr });
        const amount = transactions
          .filter(t => t.entityId === s.id && t.type === 'COMMANDE' && isSameMonth(t.date, m))
          .reduce((sum, t) => sum + t.amount, 0);
        row[key] = amount;
        total += amount;
      });
      row.total = total;
      return row;
    });
  }, [entities, transactions]);

  const supplierSpecificChartData = useMemo(() => {
    const supplier = entities.find(e => e.name === subTab);
    if (!supplier) return [];

    const now = new Date();
    const intervalStart = startOfYear(now);
    const filtered = transactions.filter(t => t.entityId === supplier.id && t.type === 'COMMANDE' && t.date >= intervalStart);
    
    const groups: Record<string, any> = {};
    filtered.forEach(t => {
      const key = startOfMonth(t.date).toISOString();
      if (!groups[key]) {
        groups[key] = {
          date: startOfMonth(t.date),
          name: format(startOfMonth(t.date), 'MMM', { locale: fr }),
          commandes: 0
        };
      }
      groups[key].commandes += t.amount;
    });

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [transactions, subTab, entities]);

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
        const savedTxs = await api.createTransactions(newTransactions);
        setTransactions(prev => [...savedTxs, ...prev]);
        addLog('IMPORT', 'TRANSACTION', 'multiple', `${savedTxs.length} transactions importées via Excel`);
        toast.success(`${savedTxs.length} transactions importées avec succès`);
      } catch (err) {
        console.error("Erreur d'import:", err);
        let message = "Erreur lors de l'importation";
        if (err instanceof Error) {
          try {
            const info = JSON.parse(err.message);
            if (info.error.includes('insufficient permissions')) {
              message = "Permissions insuffisantes pour importer des données.";
            } else {
              message = `Erreur: ${info.error}`;
            }
          } catch {
            message = err.message;
          }
        }
        toast.error(message);
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

    const kpiLabelStyle = {
      font: { bold: true, color: { rgb: "64748b" } },
      fill: { fgColor: { rgb: "f8fafc" } }
    };

    const kpiValueStyle = {
      font: { bold: true, color: { rgb: "10b981" } },
      alignment: { horizontal: "right" }
    };

    // 1. Dashboard Sheet
    const dashboardData = [
      ["RAPPORT DE GESTION PHARMACIE - AÉROPORT DE LOMÉ"],
      [],
      ["PARAMÈTRES DU RAPPORT"],
      ["Période sélectionnée", selectedPeriod],
      ["Date d'extraction", format(new Date(), 'dd/MM/yyyy HH:mm')],
      ["Utilisateur", "Admin Pharma Pro"],
      [],
      ["RÉSUMÉ DES INDICATEURS CLÉS (KPI)"],
      ["Recettes Totales", kpis.totalRecettes],
      ["Commandes Fournisseurs", kpis.totalCommandes],
      ["Crédits Patients", kpis.totalCredit],
      ["Rejets Assurances", kpis.totalRejets],
      ["Consommation Implants", kpis.totalImplants],
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
    ];

    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
    
    // Styling Dashboard
    wsDashboard['A1'].s = titleStyle;
    wsDashboard['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    
    // Style KPI Section
    ['A3', 'A8', 'A15'].forEach(addr => { if(wsDashboard[addr]) wsDashboard[addr].s = { font: { bold: true, sz: 12, color: { rgb: "334155" } } }; });
    
    for(let i = 9; i <= 13; i++) {
      wsDashboard[`A${i}`].s = kpiLabelStyle;
      wsDashboard[`B${i}`].s = kpiValueStyle;
      wsDashboard[`B${i}`].z = "#,##0 \"FCFA\"";
    }

    for(let i = 16; i <= 24; i++) {
      wsDashboard[`A${i}`].s = kpiLabelStyle;
      wsDashboard[`B${i}`].s = kpiValueStyle;
      wsDashboard[`B${i}`].z = "#,##0 \"FCFA\"";
    }

    wsDashboard['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Tableau de Bord");

    // 2. Transactions Sheet
    const txData = filteredTransactions.map(t => ({
      Date: format(t.date, 'dd/MM/yyyy'),
      Type: t.type,
      Montant: t.amount,
      Catégorie: t.category,
      Description: t.description,
      Entité: entities.find(e => e.id === t.entityId)?.name || '-',
      Statut: t.status || '-'
    }));

    const wsTransactions = XLSX.utils.json_to_sheet(txData);
    
    // Style Transactions Headers
    const range = XLSX.utils.decode_range(wsTransactions['!ref']!);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (wsTransactions[address]) wsTransactions[address].s = headerStyle;
    }

    // Style Amount Column
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const address = XLSX.utils.encode_col(2) + (R + 1);
      if (wsTransactions[address]) {
        wsTransactions[address].s = { font: { bold: true }, alignment: { horizontal: "right" } };
        wsTransactions[address].z = "#,##0";
      }
    }

    wsTransactions['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, wsTransactions, "Détail Transactions");

    XLSX.writeFile(wb, `PharmaPro_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Export Excel professionnel généré');
    addLog('CREATE', 'EXPORT', 'excel', 'Export Excel complet avec mise en forme');
  };

  // CRUD Handlers
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    setConfirmDialog({
      open: true,
      title: 'Supprimer Transaction',
      message: 'Voulez-vous vraiment supprimer cette donnée ? Cette action est irréversible.',
      onConfirm: async () => {
        try {
          await api.deleteTransaction(id);
          setTransactions(prev => prev.filter(t => t.id !== id));
          addLog('DELETE', 'TRANSACTION', id, `Suppression transaction ${id}`, tx);
          toast.success('Transaction supprimée');
          setConfirmDialog(null);
        } catch (error) {
          toast.error("Erreur lors de la suppression");
        }
      }
    });
  };

  const handleDeleteEntity = (id: string) => {
    const entity = entities.find(e => e.id === id);
    setConfirmDialog({
      open: true,
      title: 'Supprimer Partenaire',
      message: `Voulez-vous vraiment supprimer ${entity?.name} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await api.deleteEntity(id);
          setEntities(prev => prev.filter(e => e.id !== id));
          addLog('DELETE', 'ENTITY', id, `Suppression partenaire ${entity?.name}`, entity);
          toast.success('Partenaire supprimé');
          setConfirmDialog(null);
        } catch (error) {
          toast.error("Erreur lors de la suppression");
        }
      }
    });
  };

  const handleSaveEntity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const type = formData.get('type') as EntityType;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const address = formData.get('address') as string;

    try {
      if (editingEntity) {
        const updated = { ...editingEntity, name, type, phone, email, address };
        const saved = await api.saveEntity(updated);
        setEntities(prev => prev.map(e => e.id === editingEntity.id ? saved : e));
        addLog('UPDATE', 'ENTITY', updated.id, `Modification ${type.toLowerCase()} ${name}`, editingEntity, updated);
        toast.success('Partenaire mis à jour');
      } else {
        const newEntity: Partial<Entity> = {
          name,
          type,
          phone,
          email,
          address,
          status: 'ACTIF'
        };
        const saved = await api.saveEntity(newEntity);
        setEntities(prev => [...prev, saved]);
        addLog('CREATE', 'ENTITY', saved.id, `Ajout ${type.toLowerCase()} ${name}`, undefined, saved);
        toast.success('Partenaire ajouté');
      }
      setEditingEntity(null);
      (e.target as HTMLFormElement).reset();
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

          <form onSubmit={handleLogin} className="space-y-6">
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
              {isLoggingIn ? 'Connexion...' : 'Se connecter'}
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
          <NavItem active={activeTab === 'recettes'} onClick={() => { setActiveTab('recettes'); setSubTab(''); setIsSidebarOpen(false); }} icon={<TrendingUp size={18}/>} label="Recettes" />
          <NavItem active={activeTab === 'fournisseurs'} onClick={() => { setActiveTab('fournisseurs'); setSubTab('COMMANDES'); setIsSidebarOpen(false); }} icon={<Package size={18}/>} label="Fournisseurs" />
          <NavItem active={activeTab === 'dcssa'} onClick={() => { setActiveTab('dcssa'); setSubTab('DCSSA'); setIsSidebarOpen(false); }} icon={<FileText size={18}/>} label="DCSSA" />
          <NavItem active={activeTab === 'implants'} onClick={() => { setActiveTab('implants'); setSubTab(''); setIsSidebarOpen(false); }} icon={<Database size={18}/>} label="Implants" />
          <NavItem active={activeTab === 'assurances'} onClick={() => { setActiveTab('assurances'); setSubTab('LISTE'); setIsSidebarOpen(false); }} icon={<ShieldCheck size={18}/>} label="Assurances" />
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
                 activeTab === 'dcssa' ? "DCSSA" :
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
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="hidden sm:block p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all border border-slate-200 dark:border-white/5 shrink-0"
              title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex bg-slate-100 dark:bg-white/5 rounded-xl p-1 overflow-x-auto border border-slate-200 dark:border-white/5 shrink-0">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-transparent text-slate-600 dark:text-slate-200 border-none focus:outline-none"
              />
              {(['JOUR', 'SEMAINE', 'QUINZAINE', 'MOIS', 'TRIMESTRE', 'SEMESTRE', 'ANNEE'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
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
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                  <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{confirmDialog.message}</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setConfirmDialog(null)}
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm font-medium border border-slate-200 dark:border-white/10"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={confirmDialog.onConfirm}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-medium"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <KPICard label="Recettes Totales" value={formatCurrency(kpis.totalRecettes)} trend={12} icon={<DollarSign className="text-emerald-500" />} color="emerald" />
                <KPICard label="Commandes Fournisseurs" value={formatCurrency(kpis.totalCommandes)} trend={-5} icon={<Package className="text-blue-500" />} color="blue" />
                <KPICard label="Crédits Patients" value={formatCurrency(kpis.totalCredit)} trend={8} icon={<Users className="text-amber-500" />} color="amber" />
                <KPICard label="Rejets Assurances" value={formatCurrency(kpis.totalRejets)} trend={-15} icon={<XCircle className="text-red-500" />} color="red" />
                <KPICard label="Consommation Implants" value={formatCurrency(kpis.totalImplants)} trend={22} icon={<Database className="text-purple-500" />} color="purple" />
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
                        <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Recettes" />
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
                            { name: 'Totale Remise', value: recettesData.totaleRemise },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#3b82f6" />
                          <Cell fill="#8b5cf6" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: darkMode ? '#0f172a' : '#ffffff', 
                            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, 
                            borderRadius: '12px',
                            color: darkMode ? '#f1f5f9' : '#0f172a'
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Section Implants sur Accueil */}
              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dernières Consommations d'Implants</h3>
                  <button 
                    onClick={() => setActiveTab('implants')}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider transition-colors"
                  >
                    Voir tout
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/2">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {transactions
                        .filter(t => t.type === 'CONSOMMATION_IMPLANT')
                        .slice(0, 5)
                        .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{t.description}</td>
                          <td className="px-6 py-4 text-sm font-mono text-emerald-500 font-bold text-right">{formatCurrency(t.amount)}</td>
                        </tr>
                      ))}
                      {transactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm italic">Aucune transaction d'implant enregistrée</td>
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
                <StatCard label="Totale Remise" value={formatCurrency(recettesData.totaleRemise)} subValue="Remises accordées" color="red" />
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
                      <Line type="monotone" dataKey="comptants" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Total Comptant (Espèce + Part Patient)" />
                      <Line type="monotone" dataKey="tiers" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Part Assurance" />
                      <Line type="monotone" dataKey="credit" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Total Vente à Crédit" />
                      <Line type="monotone" dataKey="remises" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Totale Remise" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Catégorie</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">% du Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {[
                      { label: 'Total Espèce', val: recettesData.totalEspece, color: 'text-emerald-500', desc: 'Total encaissé en espèces' },
                      { label: 'Total Vente au Comptant', val: recettesData.totalVenteComptant, color: 'text-emerald-500', desc: 'Ventes payées 100% cash' },
                      { label: 'Part Assurée Tiers Payant', val: recettesData.partAssureeTiersPayant, color: 'text-blue-500', desc: 'Part payée par le patient (Assurance)' },
                      { label: 'Total Vente Tiers Payant', val: recettesData.totalVenteTiersPayant, color: 'text-blue-500', desc: 'Valeur totale des ventes avec assurance' },
                      { label: 'Part Assurance à Réglée', val: recettesData.partAssuranceAReglee, color: 'text-amber-500', desc: 'Part à payer par la mutuelle' },
                      { label: 'Total Vente à Crédit', val: recettesData.totalVenteACredit, color: 'text-amber-500', desc: 'Ventes à crédit patients' },
                      { label: 'Totale Remise', val: recettesData.totaleRemise, color: 'text-red-500', desc: 'Total des remises effectuées' },
                    ].map((row) => (
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
              <div className="flex gap-4 border-b border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar">
                {['GLOBAL', 'COMMANDES', 'FACTURES', ...entities.filter(e => e.type === 'FOURNISSEUR').map(e => e.name)].map(tab => (
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
                              <th key={month} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{month}</th>
                            ))}
                            <th className="px-6 py-4 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {fournisseursPivotData.map((row) => (
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
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white p-6 border-b border-slate-200 dark:border-white/5">Toutes les Commandes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fournisseur</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                          {userRole !== 'directrice' && (
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {transactions.filter(t => t.type === 'COMMANDE').sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 50).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{entities.find(e => e.id === t.entityId)?.name}</td>
                            <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.description}</td>
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

              {subTab !== 'GLOBAL' && subTab !== 'COMMANDES' && subTab !== 'FACTURES' && (
                <div className="space-y-8">
                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl p-6 transition-colors duration-300">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Commandes: {subTab}</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={supplierSpecificChartData}>
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

                  <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white p-6 border-b border-slate-200 dark:border-white/5">Détail des Commandes: {subTab}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                            {userRole !== 'directrice' && (
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {transactions
                            .filter(t => t.type === 'COMMANDE' && entities.find(e => e.id === t.entityId)?.name === subTab)
                            .sort((a, b) => b.date.getTime() - a.date.getTime())
                            .map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.description}</td>
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
                </div>
              )}

              {subTab === 'FACTURES' && (
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fournisseur</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                        {userRole !== 'directrice' && (
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {transactions.filter(t => t.type === 'FACTURE').slice(0, 10).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{entities.find(e => e.id === t.entityId)?.name}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{formatCurrency(t.amount)}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[9px] font-bold uppercase",
                              t.status === 'PAYÉE' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {t.status}
                            </span>
                          </td>
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
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                      {userRole !== 'directrice' && (
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {transactions
                      .filter(t => t.type === (subTab === 'DCSSA' ? 'CONSOMMATION_DCSSA' : 'CONSOMMATION_KOUNDJOURE'))
                      .slice(0, 10)
                      .map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
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
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                      {userRole !== 'directrice' && (
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {transactions.filter(t => t.type === 'CONSOMMATION_IMPLANT').slice(0, 15).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {entities.filter(e => e.type === 'ASSURANCE').map(a => {
                    const amount = transactions.filter(t => t.entityId === a.id && t.type === 'CONSOMMATION_ASSURANCE').reduce((s, t) => s + t.amount, 0);
                    const rejets = transactions.filter(t => t.entityId === a.id && t.type === 'REJET_ASSURANCE').reduce((s, t) => s + t.amount, 0);
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
                            <span className="text-white font-bold font-mono">{formatCurrency(amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Rejets</span>
                            <span className="text-red-400 font-bold font-mono">{formatCurrency(rejets)}</span>
                          </div>
                          <div className="pt-3 border-t border-white/5 flex justify-between text-sm">
                            <span className="text-slate-400 font-bold">Solde Net</span>
                            <span className="text-emerald-500 font-bold font-mono">{formatCurrency(amount - rejets)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {subTab === 'REJETS' && (
                <div className="bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/2 border-b border-slate-200 dark:border-white/5">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assurance</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Motif</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                        {userRole !== 'directrice' && (
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {transactions.filter(t => t.type === 'REJET_ASSURANCE').slice(0, 15).map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{entities.find(e => e.id === t.entityId)?.name}</td>
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
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                          {userRole !== 'directrice' && (
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {transactions.filter(t => t.entityId === entities.find(e => e.name === subTab)?.id && t.type === 'CONSOMMATION_ASSURANCE').slice(0, 15).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{format(t.date, 'dd/MM/yyyy')}</td>
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
                      const date = new Date(formData.get('date') as string);
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
                            'TOTALE_REMISE',
                            'TOTALE_TOUTES_VENTES_CONFONDU'
                          ];
                          const promises = types.map(async (type) => {
                            const amount = Number(formData.get(type));
                            if (amount > 0) {
                              return api.createTransaction({
                                date,
                                type: type as TransactionType,
                                amount,
                                category: 'Saisie Journalière',
                                description: desc || `Saisie journalière ${type.replace(/_/g, ' ')}`,
                              });
                            }
                            return null;
                          });

                          const results = (await Promise.all(promises)).filter(r => r !== null) as Transaction[];
                          if (results.length > 0) {
                            setTransactions(prev => [...results, ...prev]);
                            results.forEach(tx => {
                              addLog('CREATE', 'TRANSACTION', tx.id, `Saisie journalière: ${tx.type} - ${formatCurrency(tx.amount)}`, undefined, tx);
                            });
                            toast.success('Recettes journalières enregistrées');
                          }
                        } else {
                          const type = (saisieSection === 'PEREMPTIONS' ? 'PEREMPTION_AVARIE' : formData.get('type')) as TransactionType;
                          const amount = Number(formData.get('amount'));
                          const entityId = formData.get('entityId') as string;
                          const status = formData.get('status') as any;
                          const dossiers = formData.get('dossiers') ? Number(formData.get('dossiers')) : undefined;
                          const beneficiaires = formData.get('beneficiaires') ? Number(formData.get('beneficiaires')) : undefined;
                          const reason = formData.get('reason') as string;

                          const newTx = await api.createTransaction({
                            date,
                            type,
                            amount,
                            category: saisieSection === 'PEREMPTIONS' ? 'Pertes' : 'Saisie Manuelle',
                            description: desc,
                            entityId: entityId || undefined,
                            status: status || undefined,
                            dossiers,
                            beneficiaires,
                            reason: reason || undefined
                          });

                          setTransactions(prev => [newTx, ...prev]);
                          addLog('CREATE', 'TRANSACTION', newTx.id, `Saisie manuelle: ${type} - ${formatCurrency(amount)}`, undefined, newTx);
                          toast.success('Donnée enregistrée');
                        }
                        (e.target as HTMLFormElement).reset();
                      } catch (error) {
                        console.error("Erreur détaillée lors de l'enregistrement:", error);
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
                    }}>
                      {/* Date Input for Backdating */}
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 mb-6">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Date de la saisie</label>
                        <input 
                          name="date" 
                          type="date" 
                          defaultValue={new Date().toISOString().split('T')[0]}
                          required 
                          className="w-full bg-white dark:bg-[#0e1629] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" 
                        />
                        <p className="text-xs text-slate-500 mt-2">Modifiez cette date pour antidater une saisie.</p>
                      </div>

                      {/* Form Fields based on Section */}
                      {saisieSection === 'VENTES' && (
                        <div className="space-y-4">
                          <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-emerald-600 uppercase mb-3">Espèces & Comptant</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Espèce</label>
                                <input name="TOTAL_ESPECE" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente au Comptant</label>
                                <input name="TOTAL_VENTE_COMPTANT" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3">Tiers Payant</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Part Assurée Tiers Payant</label>
                                <input name="PART_ASSUREE_TIERS_PAYANT" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente Tiers Payant</label>
                                <input name="TOTAL_VENTE_TIERS_PAYANT" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Part Assurance à Réglée</label>
                                <input name="PART_ASSURANCE_A_REGLEE" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-colors" placeholder="0" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 mb-4">
                            <h4 className="text-[10px] font-bold text-amber-600 uppercase mb-3">Autres</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Vente à Crédit</label>
                                <input name="TOTAL_VENTE_A_CREDIT" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Totale Remise</label>
                                <input name="TOTALE_REMISE" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-red-500 outline-none transition-colors" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Totale Toutes Ventes Confondu</label>
                                <input name="TOTALE_TOUTES_VENTES_CONFONDU" type="number" className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors" placeholder="0" />
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
                              {entities.filter(e => e.type === 'FOURNISSEUR').map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Statut</label>
                            <select name="status" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="EN_ATTENTE">En attente</option>
                              <option value="PAYÉE">Payée</option>
                              <option value="LIVRÉ">Livré</option>
                            </select>
                          </div>
                        </>
                      )}

                      {saisieSection === 'CONSOMMATIONS' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Type de Consommation</label>
                            <select name="type" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300">
                              <option value="CONSOMMATION_DCSSA">DCSSA</option>
                              <option value="CONSOMMATION_KOUNDJOURE">Koundjouré</option>
                              <option value="CONSOMMATION_IMPLANT">Implants</option>
                              <option value="CONSOMMATION_ASSURANCE">Assurance</option>
                            </select>
                          </div>
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
                            <input name="amount" type="number" required className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-colors duration-300" placeholder="0" />
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/2">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Détails</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Montant</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {transactions
                          .filter(t => {
                            const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                               t.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                               (t.entityId && entities.find(e => e.id === t.entityId)?.name.toLowerCase().includes(searchQuery.toLowerCase()));
                            const matchesType = saisieTypeFilter === 'TOUS' || t.type === saisieTypeFilter;
                            
                            const txDate = new Date(t.date);
                            const matchesStartDate = !saisieStartDate || txDate >= new Date(saisieStartDate);
                            const matchesEndDate = !saisieEndDate || txDate <= new Date(saisieEndDate);
                            
                            return matchesSearch && matchesType && matchesStartDate && matchesEndDate;
                          })
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
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Horodatage</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cible</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {logs
                      .filter(log => {
                        if (!logStartDate && !logEndDate) return true;
                        const logDate = startOfDay(log.timestamp);
                        const start = logStartDate ? startOfDay(parseISO(logStartDate)) : null;
                        const end = logEndDate ? startOfDay(parseISO(logEndDate)) : null;
                        
                        if (start && logDate < start) return false;
                        if (end && logDate > end) return false;
                        return true;
                      })
                      .map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">{format(log.timestamp, 'dd/MM/yy HH:mm:ss')}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold uppercase",
                            log.action === 'CREATE' ? "bg-emerald-500/10 text-emerald-500" :
                            log.action === 'UPDATE' ? "bg-blue-500/10 text-blue-500" :
                            log.action === 'DELETE' ? "bg-red-500/10 text-red-500" :
                            "bg-purple-500/10 text-purple-500"
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

function KPICard({ label, value, trend, icon, color }: { label: string; value: string; trend: number; icon: React.ReactNode; color: string }) {
  const isPositive = trend >= 0;
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
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded",
          isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
        )}>
          {isPositive ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}
          {Math.abs(trend)}%
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
