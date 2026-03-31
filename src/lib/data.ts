import { subDays, eachDayOfInterval } from 'date-fns';

export type TransactionType = 
  | 'TOTAL_ESPECE'
  | 'TOTAL_VENTE_COMPTANT'
  | 'PART_ASSUREE_TIERS_PAYANT'
  | 'TOTAL_VENTE_TIERS_PAYANT'
  | 'PART_ASSURANCE_A_REGLEE'
  | 'TOTAL_VENTE_A_CREDIT'
  | 'TOTAL_TPE'
  | 'TOTALE_REMISE'
  | 'TOTALE_TOUTES_VENTES_CONFONDU'
  | 'PEREMPTION_AVARIE'
  | 'COMPTANTS' 
  | 'PART_ASSUREE' 
  | 'TIERS_PAYANT' 
  | 'CREDIT' 
  | 'REMISE'
  | 'COMMANDE' 
  | 'FACTURE' 
  | 'RETOUR'
  | 'CONSOMMATION_DCSSA'
  | 'CONSOMMATION_KOUNDJOURE'
  | 'CONSOMMATION_IMPLANT'
  | 'CONSOMMATION_ASSURANCE'
  | 'REJET_ASSURANCE';

export interface Transaction {
  id: string;
  date: Date;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  entityId?: string; // Fournisseur or Assurance ID
  status?: 'PAYÉE' | 'EN_ATTENTE' | 'REMBOURSÉ' | 'LIVRÉ' | 'PAYÉ_ET_LIVRÉ';
  reason?: string; // For rejets/retours
  dossiers?: number; // For DCSSA
  beneficiaires?: number; // For Assurances
  invoiceNumber?: string; // For Fournisseurs
  paid?: boolean; // For Fournisseurs
  delivered?: boolean; // For Fournisseurs
  period?: string; // For Saisie par période
}

export type EntityType = 'FOURNISSEUR' | 'ASSURANCE';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  phone?: string;
  address?: string;
  email?: string;
  bankInfo?: string;
  contactPerson?: string;
  code?: string; // For assurances
  status: 'ACTIF' | 'INACTIF';
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORATION' | 'BACKUP';
  targetType: string;
  targetId: string;
  details: string;
  previousData?: any;
  newData?: any;
}

export interface Backup {
  id: string;
  timestamp: Date;
  transactions: Transaction[];
  entities: Entity[];
  createdBy: string;
  type: 'AUTO' | 'MANUAL';
  name: string;
}

export const INITIAL_ENTITIES: Entity[] = [
  { id: 'f1', name: 'Laborex', type: 'FOURNISSEUR', status: 'ACTIF', phone: '22 21 00 00', address: 'Zone Industrielle', email: 'contact@laborex.tg' },
  { id: 'f2', name: 'Ubipharm', type: 'FOURNISSEUR', status: 'ACTIF', phone: '22 22 11 11', address: 'Lomé Port', email: 'info@ubipharm.tg' },
  { id: 'f3', name: 'Labopharma', type: 'FOURNISSEUR', status: 'ACTIF', phone: '22 23 22 22', address: 'Adidogomé', email: 'sales@labopharma.tg' },
  { id: 'a1', name: 'CNSS', type: 'ASSURANCE', status: 'ACTIF', code: 'AS001', contactPerson: 'M. Koffi' },
  { id: 'a2', name: 'NSIA', type: 'ASSURANCE', status: 'ACTIF', code: 'AS002', contactPerson: 'Mme. Adjo' },
  { id: 'a3', name: 'SUNU', type: 'ASSURANCE', status: 'ACTIF', code: 'AS003', contactPerson: 'M. Mensah' },
  { id: 'a4', name: 'GTA C2A', type: 'ASSURANCE', status: 'ACTIF', code: 'AS004', contactPerson: 'Mme. Lawson' },
];

const generateSimulationData = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const end = new Date();
  const start = subDays(end, 365);
  const days = eachDayOfInterval({ start, end });

  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

  days.forEach(day => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const multiplier = isWeekend ? 0.6 : 1;

    // 1. RECETTES (Daily)
    const baseSales = rand(400000, 800000) * multiplier;
    const totalVenteComptant = Math.round(baseSales * 0.6);
    const partAssureeTiersPayant = Math.round(baseSales * 0.4);
    const totalEspece = totalVenteComptant + partAssureeTiersPayant;
    const partAssuranceAReglee = Math.round(baseSales * 0.3);
    const totalVenteTiersPayant = partAssureeTiersPayant + partAssuranceAReglee;
    const totalVenteACredit = Math.random() > 0.8 ? rand(50000, 150000) : 0;
    const totaleRemise = rand(10000, 30000);
    const totalGlobal = totalVenteComptant + partAssureeTiersPayant + partAssuranceAReglee + totalVenteACredit;

    transactions.push({ id: `te-${day.getTime()}`, date: day, type: 'TOTAL_ESPECE', amount: totalEspece, category: 'Ventes', description: 'Total Espèce' });
    transactions.push({ id: `tvc-${day.getTime()}`, date: day, type: 'TOTAL_VENTE_COMPTANT', amount: totalVenteComptant, category: 'Ventes', description: 'Total Vente au Comptant' });
    transactions.push({ id: `patp-${day.getTime()}`, date: day, type: 'PART_ASSUREE_TIERS_PAYANT', amount: partAssureeTiersPayant, category: 'Ventes', description: 'Part Assurée Tiers Payant' });
    transactions.push({ id: `tvtp-${day.getTime()}`, date: day, type: 'TOTAL_VENTE_TIERS_PAYANT', amount: totalVenteTiersPayant, category: 'Ventes', description: 'Total Vente Tiers Payant' });
    transactions.push({ id: `paar-${day.getTime()}`, date: day, type: 'PART_ASSURANCE_A_REGLEE', amount: partAssuranceAReglee, category: 'Ventes', description: 'Part Assurance à Réglée' });
    if (totalVenteACredit > 0) {
      transactions.push({ id: `tvac-${day.getTime()}`, date: day, type: 'TOTAL_VENTE_A_CREDIT', amount: totalVenteACredit, category: 'Ventes', description: 'Total Vente à Crédit' });
    }
    transactions.push({ id: `tr-${day.getTime()}`, date: day, type: 'TOTALE_REMISE', amount: totaleRemise, category: 'Ventes', description: 'Totale Remise' });
    transactions.push({ id: `ttvc-${day.getTime()}`, date: day, type: 'TOTALE_TOUTES_VENTES_CONFONDU', amount: totalGlobal, category: 'Ventes', description: 'Totale Toutes Ventes Confondu' });

    if (Math.random() > 0.9) {
      transactions.push({ id: `per-${day.getTime()}`, date: day, type: 'PEREMPTION_AVARIE', amount: rand(5000, 25000), category: 'Pertes', description: 'Péremption et avariés' });
    }

    // 2. FOURNISSEURS (Weekly orders)
    if (day.getDay() === 1 || day.getDay() === 4) {
      const f = INITIAL_ENTITIES.filter(e => e.type === 'FOURNISSEUR')[rand(0, 2)];
      const isPaid = Math.random() > 0.3;
      transactions.push({ id: `cmd-${f.id}-${day.getTime()}`, date: day, type: 'COMMANDE', amount: rand(500000, 1500000), category: 'Approvisionnement', description: `Commande ${f.name}`, entityId: f.id, paid: isPaid, delivered: true, invoiceNumber: `INV-${rand(1000, 9999)}` });
      transactions.push({ id: `fac-${f.id}-${day.getTime()}`, date: day, type: 'FACTURE', amount: rand(500000, 1500000), category: 'Comptabilité', description: `Facture ${f.name}`, entityId: f.id, paid: isPaid, delivered: true, invoiceNumber: `INV-${rand(1000, 9999)}` });
    }

    // 3. DCSSA (Twice a month)
    if (day.getDate() === 1 || day.getDate() === 15) {
      transactions.push({ id: `dcssa-${day.getTime()}`, date: day, type: 'CONSOMMATION_DCSSA', amount: rand(1000000, 2500000), category: 'Service Public', description: 'Consommation DCSSA', dossiers: rand(10, 25) });
      transactions.push({ id: `koundj-${day.getTime()}`, date: day, type: 'CONSOMMATION_KOUNDJOURE', amount: rand(800000, 1800000), category: 'Service Public', description: 'Consommation Koundjouré', dossiers: rand(5, 15) });
    }

    // 4. IMPLANTS (Weekly)
    if (day.getDay() === 3) {
      transactions.push({ id: `impl-${day.getTime()}`, date: day, type: 'CONSOMMATION_IMPLANT', amount: rand(500000, 2000000), category: 'Implants', description: 'Consommation implants', entityId: 'f1' });
    }

    // 5. ASSURANCES (Daily consumption)
    INITIAL_ENTITIES.filter(e => e.type === 'ASSURANCE').forEach(a => {
      if (Math.random() > 0.5) {
        transactions.push({ id: `ass-${a.id}-${day.getTime()}`, date: day, type: 'CONSOMMATION_ASSURANCE', amount: rand(100000, 500000), category: 'Assurance', description: `Consommation ${a.name}`, entityId: a.id, beneficiaires: rand(5, 15) });
      }
      if (Math.random() > 0.95) {
        transactions.push({ id: `rej-${a.id}-${day.getTime()}`, date: day, type: 'REJET_ASSURANCE', amount: rand(20000, 80000), category: 'Assurance', description: `Rejet ${a.name}`, entityId: a.id, reason: 'Dépassement plafond' });
      }
    });
  });

  return transactions;
};

export const simulationData = generateSimulationData();
