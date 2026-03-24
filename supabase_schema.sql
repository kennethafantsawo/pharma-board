-- ==========================================
-- SCRIPT SQL POUR SUPABASE - PHARMACIE
-- ==========================================

-- 1. Création de la table 'entities' (Fournisseurs et Assurances)
CREATE TABLE public.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('FOURNISSEUR', 'ASSURANCE')),
    phone TEXT,
    address TEXT,
    email TEXT,
    "bankInfo" TEXT,
    "contactPerson" TEXT,
    code TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIF' CHECK (status IN ('ACTIF', 'INACTIF')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Création de la table 'transactions' (Toutes les opérations financières)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    type TEXT NOT NULL CHECK (type IN (
        'COMPTANTS', 'PART_ASSUREE', 'TIERS_PAYANT', 'CREDIT', 'REMISE',
        'COMMANDE', 'FACTURE', 'RETOUR', 'CONSOMMATION_DCSSA',
        'CONSOMMATION_KOUNDJOURE', 'CONSOMMATION_IMPLANT',
        'CONSOMMATION_ASSURANCE', 'REJET_ASSURANCE'
    )),
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    "entityId" UUID REFERENCES public.entities(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('PAYÉE', 'EN_ATTENTE', 'REMBOURSÉ', 'LIVRÉ')),
    reason TEXT,
    dossiers INTEGER,
    beneficiaires INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Création de la table 'audit_logs' (Historique et traçabilité)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'RESTORATION', 'AUTH')),
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    details TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB
);

-- ==========================================
-- TRIGGERS POUR LA MISE À JOUR AUTOMATIQUE DE 'updated_at'
-- ==========================================

-- Fonction générique pour mettre à jour la date
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour entities
CREATE TRIGGER update_entities_modtime
BEFORE UPDATE ON public.entities
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Trigger pour transactions
CREATE TRIGGER update_transactions_modtime
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ==========================================
-- SÉCURITÉ (Row Level Security - RLS)
-- ==========================================
-- Optionnel : Décommentez ces lignes si vous souhaitez activer la sécurité RLS
-- et restreindre l'accès uniquement aux utilisateurs authentifiés.

-- ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow authenticated full access on entities" ON public.entities FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated full access on transactions" ON public.transactions FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated full access on audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true);

-- ==========================================
-- DONNÉES DE BASE (Optionnel - Pour tester)
-- ==========================================
INSERT INTO public.entities (id, name, type, status, phone, address, email) VALUES
    (gen_random_uuid(), 'Laborex', 'FOURNISSEUR', 'ACTIF', '22 21 00 00', 'Zone Industrielle', 'contact@laborex.tg'),
    (gen_random_uuid(), 'Ubipharm', 'FOURNISSEUR', 'ACTIF', '22 22 11 11', 'Lomé Port', 'info@ubipharm.tg'),
    (gen_random_uuid(), 'CNSS', 'ASSURANCE', 'ACTIF', '22 23 33 33', 'Centre Ville', 'contact@cnss.tg');
