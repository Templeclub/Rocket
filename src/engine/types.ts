// Modèle de données. Module pur : aucune dépendance à l'interface ni au stockage.

/** Date locale Europe/Paris au format YYYY-MM-DD. */
export type LocalDate = string;

export type Sport = 'gravel' | 'run' | 'swim' | 'football' | 'enduro';
export type Environment = 'indoor' | 'outdoor';
export type SessionStatus = 'planned' | 'done' | 'postponed' | 'cancelled';
export type Priority = 'key' | 'optional';
export type Origin = 'generated' | 'manual';

/** Catégorie d'affichage : le gravel est séparé en extérieur et home-trainer. */
export type SportKey = 'gravel-out' | 'gravel-in' | 'run' | 'swim' | 'football' | 'enduro';

export interface Target {
  /** Plage en % de la FTP (home-trainer, compatible ERG). */
  ftpPct?: [number, number];
  /** Zone de FC (1 à 5). */
  hrZone?: number;
  /** Effort perçu (1 à 10). */
  rpe?: number;
  /** Consigne libre : allure, nage, matériel… */
  text?: string;
}

export interface Block {
  id: string;
  label: string;
  /** Nombre de répétitions (1 = bloc simple). */
  repeat: number;
  /** Durée d'une répétition, en secondes. */
  durationSec?: number;
  /** Distance d'une répétition, en mètres (natation, course). */
  distanceM?: number;
  /** Récupération entre deux répétitions, en secondes. */
  recoverySec?: number;
  target: Target;
}

/** Contenu commun à une séance type et à une séance planifiée. */
export interface SessionContent {
  title: string;
  sport: Sport;
  /** Type libre : endurance, sweet spot, sortie longue, footing, technique… */
  type: string;
  environment: Environment;
  targetDurationMin: number;
  targetDistanceKm?: number;
  targetElevationM?: number;
  /** Intensité perçue visée (foot, enduro, ou globale). */
  rpe?: number;
  blocks: Block[];
  priority: Priority;
  notes?: string;
}

export interface SessionTemplate extends SessionContent {
  id: string;
  builtin: boolean;
  lastUsedAt?: number;
}

export interface PlannedSession extends SessionContent {
  id: string;
  date: LocalDate;
  status: SessionStatus;
  /** Date initiale si la séance a été reportée. */
  originalDate?: LocalDate;
  origin: Origin;
  templateId?: string;
  /** Variante basculable en 1 tap (home-trainer pour une sortie, natation pour une course). */
  alternative?: SessionContent;
  /** Séance confirmée par moi ; sinon « recommandée » par le programme. */
  confirmed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ActivitySource = 'manual' | 'fit' | 'gpx' | 'strava';

export interface Activity {
  id: string;
  source: ActivitySource;
  sport: Sport;
  environment: Environment;
  /** Date locale de l'activité (Europe/Paris). */
  date: LocalDate;
  /** Début ISO 8601, si connu. */
  start?: string;
  durationSec: number;
  distanceM?: number;
  elevationM?: number;
  avgHr?: number;
  avgPower?: number;
  rpe?: number;
  externalId?: string;
  plannedSessionId?: string;
  notes?: string;
  /** Titre de l'activité (Strava). */
  title?: string;
}

/** Connexion à Strava (stockée sur le téléphone, jamais exportée). */
export interface StravaIntegration {
  id: 'strava';
  accessToken: string;
  refreshToken: string;
  /** Expiration du jeton d'accès (secondes depuis 1970). */
  expiresAt: number;
  scope: string;
  athleteName?: string;
  connectedAt: number;
  lastSyncAt?: number;
  lastReport?: SyncReport;
}

export interface SyncReport {
  at: number;
  fetched: number;
  imported: number;
  updated: number;
  linked: number;
  /** Activités ignorées (discipline non reconnue), avec titre et type. */
  ignored: { title: string; type: string; date: LocalDate }[];
  error?: string;
}

export interface Goal {
  id: string;
  kind: 'main' | 'milestone';
  name: string;
  date: LocalDate;
  distanceKm?: number;
  elevationM?: number;
  maxDays?: number;
}

export interface Profile {
  ftp: number;
  hrMax: number;
  hrRest: number;
  vo2max: number;
}

export type ExceptionKind = 'leave' | 'runOnly' | 'unavailable';

export interface DayAvailability {
  /** Minutes disponibles ce jour-là (le matin en semaine). */
  minutes: number;
  /** Jour à Paris : course uniquement. */
  paris: boolean;
}

export interface AvailabilityException {
  id: string;
  start: LocalDate;
  end: LocalDate;
  /** leave = congé (journée libre), runOnly = course uniquement, unavailable = rien. */
  kind: ExceptionKind;
  label: string;
}

export interface Availability {
  /** Clés 1 (lundi) à 7 (dimanche). */
  template: Record<number, DayAvailability>;
  /** Jours de foot (1 = lundi … 7 = dimanche) : obligatoires sauf à Paris. */
  footballDays: number[];
  footballMin: number;
  /** Jours à Paris saisis pour une semaine (clé : lundi). Sinon : jours « Paris » de la semaine type. */
  parisByWeek: Record<LocalDate, LocalDate[]>;
  weekdayMorningStart: string;
  exceptions: AvailabilityException[];
}

export interface VolumeSettings {
  /** Heures d'endurance (vélo, course, natation, hors foot) par semaine au départ. */
  startWeeklyHours: number;
  /** Pic d'heures d'endurance tant que le rythme réel ne permet pas plus. */
  peakWeeklyHours: number;
  /** Base de calcul ; absent = ancienne version (heures totales, foot compris). */
  basis?: 'endurance';
}

export interface AppSettings {
  id: 'app';
  profile: Profile;
  availability: Availability;
  volume: VolumeSettings;
  /** Affichage : automatique, clair ou sombre. */
  theme?: 'auto' | 'light' | 'dark';
  /** Bornes hautes des zones de puissance, en % de la FTP (la dernière zone est ouverte). */
  powerZoneUpperPct: number[];
  /** Bornes des zones de FC, en % de la FC max : [bas Z1, haut Z1, haut Z2, …, haut Z5]. */
  hrZoneBoundsPct: number[];
}

export type Phase = 'base' | 'development' | 'specific' | 'taper';
export type WeekKind = 'load' | 'light' | 'block' | 'travel' | 'taper' | 'race';

export interface WeekPlan {
  weekStart: LocalDate;
  phase: Phase;
  kind: WeekKind;
  /** Cible en heures d'endurance (vélo, course, natation ; le foot est en plus). */
  targetHours: number;
  /** Plus longue sortie prévue (minutes). */
  longRideMin: number;
  notes: string[];
  generatedAt: number;
  /** Semaine confirmée lors du bilan hebdomadaire. */
  confirmedAt?: number;
  /** Semaine exclue du rythme réel (R1). */
  excluded?: boolean;
}

export interface Justification {
  metric: string;
  value: number;
  threshold: number;
  unit?: string;
}

export interface Recommendation {
  id: string;
  weekStart: LocalDate;
  type: string;
  text: string;
  justification: Justification;
  status: 'proposed' | 'accepted' | 'ignored';
  /** Libellé du choix retenu, si acceptée. */
  choice?: string;
  decidedAt?: number;
}

/** Sauvegarde en ligne (stockée sur le téléphone, jamais exportée). */
export interface CloudBackupState {
  id: 'cloud';
  passphrase: string;
  auto: boolean;
  lastBackupAt?: number;
  /** Empreinte des données au dernier envoi (pour n'envoyer que s'il y a du nouveau). */
  lastHash?: string;
  lastError?: string;
}
