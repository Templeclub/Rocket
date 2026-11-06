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

export interface AppSettings {
  id: 'app';
  profile: Profile;
  /** Bornes hautes des zones de puissance, en % de la FTP (la dernière zone est ouverte). */
  powerZoneUpperPct: number[];
  /** Bornes des zones de FC, en % de la FC max : [bas Z1, haut Z1, haut Z2, …, haut Z5]. */
  hrZoneBoundsPct: number[];
}

export interface Recommendation {
  id: string;
  weekStart: LocalDate;
  type: string;
  text: string;
  justification: { metric: string; value: number; threshold: number; unit?: string };
  status: 'proposed' | 'accepted' | 'ignored';
}
