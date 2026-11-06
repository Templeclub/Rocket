// Toutes les valeurs numériques des règles sont ici, et seulement ici.
// Les paramètres saisis dans l'appli (profil, zones) viennent se superposer à ces valeurs.

export const CONFIG = {
  timeZone: 'Europe/Paris',

  /** Plan démarrant le lundi 9 novembre 2026. */
  planStart: '2026-11-09',

  profile: {
    ftp: 184,
    hrMax: 199,
    hrRest: 49,
    vo2max: 53.8,
  },

  /** Zones de puissance Coggan (7 zones) : bornes hautes en % de la FTP, la Z7 est ouverte. */
  powerZoneUpperPct: [55, 75, 90, 105, 120, 150],
  powerZoneNames: ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VO2max', 'Anaérobie', 'Neuromusculaire'],

  /** Zones de FC en % de la FC max (5 zones, découpage type montre). */
  hrZoneBoundsPct: [50, 60, 70, 80, 90, 100],
  hrZoneNames: ['Très facile', 'Facile', 'Modéré', 'Difficile', 'Maximal'],

  /** Point de départ du rythme réel (heures d'endurance : vélo + course + natation). */
  startVolume: {
    weeklyHours: 4.5,
    peakWeeklyHours: 7,
  },

  ui: {
    /** Durée d'affichage du bandeau « Annuler l'action », en ms. */
    undoToastMs: 5000,
    /** Nombre de jours proposés dans la feuille de report. */
    postponeDaysOffered: 7,
  },

  // --- Règles d'adaptation (utilisées à partir des phases 1 et 3) ---
  rules: {
    /** R1 : fenêtre du rythme réel, en semaines. */
    rollingWeeks: 4,
    /** R3 : volume semaine suivante ≤ rythme réel × ce facteur. */
    weeklyVolumeCap: 1.1,
    /** R3 bis : semaine bloc (congé ou pont) ≤ rythme réel × ce facteur. */
    blockWeekCap: 1.3,
    /** Semaine bloc autorisée si la semaine précédente est réalisée à au moins ce taux. */
    blockWeekMinPrevCompletion: 0.8,
    /** Au plus une semaine bloc toutes les N semaines, suivie d'une semaine allégée. */
    blockWeekEveryWeeks: 3,
    /** Sortie la plus longue ≤ plus longue des 4 dernières semaines + N minutes. */
    longestRideIncreaseMin: 45,
    /** R3 : proposer de baisser la cible si taux de réalisation < seuil pendant N semaines. */
    lowCompletionThreshold: 0.7,
    lowCompletionWeeks: 2,
    /** R4 : séances clés par semaine. */
    keySessionsMin: 1,
    keySessionsMax: 2,
    /** R5 : semaine allégée. */
    lightWeekReduction: 0.3,
    lightWeekEveryMin: 3,
    lightWeekEveryMax: 4,
    /** Dernière semaine allégée connue (lundi). */
    lastLightWeek: '2026-10-26',
    /** R6 : séquence extérieur / home-trainer / extérieur sur N jours. */
    trainerSequenceDays: 3,
    /** Temps de montage ou démontage du vélo sur le home-trainer, en minutes. */
    trainerSwapMin: 10,
    /** R7 : pas de séance intense à ± N jour(s) du football. */
    footballBufferDays: 1,
    /** RPE à partir duquel une séance est considérée intense. */
    intenseRpe: 7,
    /** R8 : marge de lumière, aube et crépuscule civils (soleil à −6°). */
    sunAltitudeDeg: -6,
    /** R9 : météo « correcte » pour courir. */
    weatherMaxRainMm: 1,
    weatherMaxWindKmh: 40,
    weatherMinTempC: 0,
    /** Heure de contrôle de la météo la veille. */
    weatherCheckHour: 20,
  },

  /** Disponibilités connues (saisie en phase 1). */
  availability: {
    weekdayMorning: { start: '07:30', end: '08:30' },
    weekendMaxHoursPerDay: 6,
    parisDefaultDays: [2, 3], // mardi, mercredi (1 = lundi)
    location: { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
  },
} as const;

export type Config = typeof CONFIG;
