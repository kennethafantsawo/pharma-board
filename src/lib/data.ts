import { subDays, eachDayOfInterval } from 'date-fns';

export type TransactionType = 
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
  status?: 'PAYÉE' | 'EN_ATTENTE' | 'REMBOURSÉ' | 'LIVRÉ';
  reason?: string; // For rejets/retours
  dossiers?: number; // For DCSSA
  beneficiaires?: number; // For Assurances
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
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORATION';
  targetType: string;
  targetId: string;
  details: string;
  previousData?: any;
  newData?: any;
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
    transactions.push({ id: `comp-${day.getTime()}`, date: day, type: 'COMPTANTS', amount: Math.round(baseSales * 0.6), category: 'Ventes', description: 'Ventes comptants' });
    transactions.push({ id: `part-${day.getTime()}`, date: day, type: 'PART_ASSUREE', amount: Math.round(baseSales * 0.4), category: 'Ventes', description: 'Part assurée encaissée' });
    
    if (Math.random() > 0.2) {
      transactions.push({ id: `tp-${day.getTime()}`, date: day, type: 'TIERS_PAYANT', amount: Math.round(baseSales * 0.3), category: 'Ventes', description: 'Remboursements attendus', entityId: ['a1', 'a2', 'a3', 'a4'][rand(0, 3)] });
    }
    
    if (Math.random() > 0.8) {
      transactions.push({ id: `cred-${day.getTime()}`, date: day, type: 'CREDIT', amount: rand(50000, 150000), category: 'Ventes', description: 'Crédits patients' });
    }
    
    transactions.push({ id: `rem-${day.getTime()}`, date: day, type: 'REMISE', amount: rand(10000, 30000), category: 'Ventes', description: 'Remises autorisées' });

    // 2. FOURNISSEURS (Weekly orders)
    if (day.getDay() === 1 || day.getDay() === 4) {
      const f = INITIAL_ENTITIES.filter(e => e.type === 'FOURNISSEUR')[rand(0, 2)];
      transactions.push({ id: `cmd-${f.id}-${day.getTime()}`, date: day, type: 'COMMANDE', amount: rand(500000, 1500000), category: 'Approvisionnement', description: `Commande ${f.name}`, entityId: f.id, status: 'LIVRÉ' });
      transactions.push({ id: `fac-${f.id}-${day.getTime()}`, date: day, type: 'FACTURE', amount: rand(500000, 1500000), category: 'Comptabilité', description: `Facture ${f.name}`, entityId: f.id, status: Math.random() > 0.3 ? 'PAYÉE' : 'EN_ATTENTE' });
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
