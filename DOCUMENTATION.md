# Documentation Technique : Application de Gestion Financière (PharmaPro)

Cette documentation détaille l'architecture, les fonctionnalités et les modèles de données de l'application de gestion financière PharmaPro.

## 1. Présentation du Projet
PharmaPro est une application web full-stack conçue pour la gestion quotidienne des flux financiers d'une officine ou d'une entreprise commerciale. Elle permet de suivre les recettes, les commandes fournisseurs, les consommations de services publics (DCSSA), les implants, les assurances, et d'effectuer des saisies de données structurées.

## 2. Stack Technique
- **Frontend :** React 19, TypeScript, Vite.
- **Styling :** Tailwind CSS 4.
- **Animations :** Framer Motion (motion/react).
- **Icônes :** Lucide React.
- **Graphiques :** Recharts.
- **Gestion des Dates :** date-fns.
- **Base de Données :** Firebase Firestore (NoSQL).
- **Authentification :** Firebase Auth (Google Login & Email/Password).
- **Export/Import :** XLSX (Excel), jsPDF (PDF).
- **Notifications :** Sonner.

## 3. Structure des Données (Modèles)

### Transaction
Représente un flux financier (entrée ou sortie).
- `id`: string
- `date`: Date (ISO string dans Firestore)
- `type`: TransactionType (Enum)
- `amount`: number
- `category`: string
- `description`: string
- `entityId`: string (Optionnel, ID du Fournisseur ou de l'Assurance)
- `status`: 'PAYÉE' | 'EN_ATTENTE' | 'REMBOURSÉ' | 'LIVRÉ' | 'PAYÉ_ET_LIVRÉ'
- `reason`: string (Pour les rejets/retours)
- `dossiers`: number (Pour DCSSA/Koundjouré)
- `beneficiaires`: number (Pour Assurances)
- `invoiceNumber`: string (Numéro de facture)
- `paid`: boolean (Statut de paiement)
- `delivered`: boolean (Statut de livraison)
- `period`: string (Label de quinzaine ou mois)

### Entity (Partenaire)
Représente un Fournisseur ou une Assurance.
- `id`: string
- `name`: string
- `type`: 'FOURNISSEUR' | 'ASSURANCE'
- `phone`: string
- `address`: string
- `email`: string
- `code`: string (Pour les assurances)
- `status`: 'ACTIF' | 'INACTIF'

### AuditLog
Trace les actions des utilisateurs.
- `id`: string
- `timestamp`: Date
- `action`: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORATION' | 'BACKUP'
- `targetType`: string
- `targetId`: string
- `details`: string
- `previousData`: any
- `newData`: any

## 4. Architecture de l'Interface (Navigation)

L'application est organisée en onglets principaux :

### A. Accueil (Dashboard)
- **KPI Cards :** Chiffre d'affaires, Recettes Totales, Commandes Fournisseurs, Consommations Services.
- **Graphiques :**
  - Évolution Entrées vs Sorties (AreaChart).
  - Répartition des Recettes (PieChart).
  - Évolution des Commandes Globales (LineChart).
- **Tableaux de synthèse :** Top fournisseurs, Recettes récentes.

### B. Recettes
- Vue détaillée des ventes journalières.
- Filtres par période (Jour, Semaine, Quinzaine, Mois, etc.).
- Export PDF/Excel des rapports de recettes.

### C. Fournisseurs
Divisé en quatre sous-sections :
1. **GLOBAL :** Résumé par fournisseur de l'évolution des commandes.
2. **COMMANDES :** Liste des commandes passées.
3. **FACTURES :** Factures en attente de paiement.
   - Les données des factures sont dupliquées à partir des commandes lors de la saisie, mais restent indépendantes.
   - Actions groupées : Sélection multiple pour marquer comme "Payé".
4. **FACTURES PAYÉES :** Historique des factures validées comme payées.
   - Groupement par quinzaine pour chaque fournisseur.
   - Les factures marquées comme payées dans la section "FACTURES" sont déplacées ici.

### D. DCSSA & Koundjouré
- Suivi des consommations pour les services publics.
- Affichage des montants et du nombre de dossiers.
- Historique détaillé.

### E. Implants
- Suivi spécifique des consommations d'implants.
- Liaison avec les fournisseurs d'implants.

### F. Assurances
- Liste des assurances partenaires.
- Suivi des consommations par assurance.
- Gestion des rejets (motifs, montants).

### G. Saisie (Data Entry)
Section protégée par mot de passe (`password2026`).
- **Ventes & Recettes :** Saisie journalière des différents types de ventes (Espèce, Tiers-Payant, Crédit, etc.).
- **Fournisseurs :** Saisie des commandes, factures et retours.
  - *Flux de commande :* Une commande peut être enregistrée sans numéro de facture. Une fois la facture reçue, elle est mise à jour avec son numéro et son statut de paiement.
- **Consommations :** Saisie pour DCSSA, Koundjouré, Implants et Assurances.
- **Rejets :** Saisie des rejets d'assurances avec motif obligatoire.
- **Péremptions & Avariés :** Saisie des pertes.
- **Import Excel :** Possibilité d'importer des transactions en masse via un template. Le système valide les colonnes et les types de données avant l'insertion.

### H. Validation et Sécurité
- **Verrouillage de Saisie :** Empêche toute modification des données historiques sans déverrouillage manuel.
- **Validation des Montants :** Les champs numériques sont validés pour éviter les erreurs de frappe (pas de montants négatifs, format monétaire).
- **Confirmation des Actions Critiques :** La suppression ou la modification d'une transaction nécessite une confirmation explicite (parfois avec saisie d'une chaîne de caractères de sécurité).
- **Audit Logs :** Chaque création, modification ou suppression est enregistrée avec l'ID de l'utilisateur, l'horodatage et les données avant/après.

### I. Prévisions
- Outils d'analyse prédictive basés sur l'historique (moyennes mobiles, tendances).

### J. Paramètres
Section protégée par mot de passe.
- **Gestion des Partenaires :** Ajout/Modification/Suppression de Fournisseurs et Assurances.
- **Sécurité :** Verrouillage/Déverrouillage global de la saisie et des paramètres.
- **Sauvegarde & Restauration :**
  - Création de sauvegardes manuelles.
  - Sauvegarde automatique quotidienne.
  - Restauration complète à partir d'un fichier JSON ou d'une sauvegarde cloud.
- **Logs d'Audit :** Visualisation de l'historique des actions système.

## 5. Fonctionnalités Clés

### Système de Verrouillage
Certaines sections critiques (Saisie, Paramètres) sont verrouillées par défaut. L'utilisateur doit entrer un code secret pour y accéder temporairement. Un indicateur visuel (Cadenas ouvert/fermé) montre l'état actuel.

### Gestion des Quinzaines
Les factures fournisseurs sont automatiquement regroupées par quinzaine (1ère Quinzaine : 1-15 du mois, 2ème Quinzaine : 16-fin du mois) pour faciliter le pointage comptable.

### Synchronisation Temps Réel
Grâce à Firebase Firestore, toutes les modifications effectuées par un utilisateur sont répercutées instantanément sur tous les autres terminaux connectés.

### Mode Hors-Ligne (SyncContext)
L'application utilise un contexte de synchronisation qui détecte la perte de connexion. Les opérations d'écriture sont mises en file d'attente et synchronisées dès le retour du réseau.

### Exportation de Données
- **Excel :** Utilisation de `xlsx-js-style` pour générer des fichiers Excel formatés avec des styles (couleurs, bordures).
- **PDF :** Utilisation de `jsPDF` et `jspdf-autotable` pour générer des rapports professionnels.

## 6. Guide de Reproduction

Pour reproduire cette application à l'identique :
1. **Initialiser un projet Vite + React + TS.**
2. **Installer les dépendances :** `firebase`, `lucide-react`, `recharts`, `date-fns`, `framer-motion`, `sonner`, `xlsx-js-style`, `jspdf`, `jspdf-autotable`.
3. **Configurer Firebase :** Créer un projet sur la console Firebase, activer Firestore et Auth (Google + Email).
4. **Implémenter le `SyncContext` :** Pour la gestion du mode hors-ligne.
5. **Développer les services API :** Créer des méthodes CRUD pour `transactions`, `entities`, `audit_logs` et `backups`.
6. **Construire l'interface `App.tsx` :** Utiliser un état `activeTab` pour la navigation et des composants modulaires pour chaque section.
7. **Appliquer le design :** Utiliser Tailwind CSS avec le mode sombre activé par défaut.

---
*Documentation générée le 31 Mars 2026.*
