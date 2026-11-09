// Toutes les valeurs numériques des règles sont ici, et seulement ici.
// Les paramètres saisis dans l'appli (profil, zones, disponibilités, volume) viennent se superposer à ces valeurs.

export const CONFIG = {
  appName: 'Ascèse',
  timeZone: 'Europe/Paris',

  /** Version de la méthode de construction du plan (un programme plus ancien est à recalculer). */
  planVersion: 2,

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

  /**
   * Point de départ du rythme réel, en heures d'ENDURANCE par semaine (vélo, course, natation).
   * Mes 4h30 (pic 7h) incluaient un foot de 1h30 : 3h et 5h30 d'endurance. Le foot (lundi et jeudi) s'ajoute.
   * Le pic n'est relevé que si le rythme réel le permet.
   */
  startVolume: {
    weeklyHours: 3,
    peakWeeklyHours: 8,
    /** Foot inclus dans les anciennes valeurs (heures totales), retiré à la migration. */
    legacyFootballHours: 1.5,
    /** Plus longue sortie récente supposée, en minutes. */
    longestRideMin: 120,
  },

  ui: {
    /** Durée d'affichage du bandeau « Annuler l'action », en ms. */
    undoToastMs: 5000,
    /** Nombre de jours proposés dans la feuille de report. */
    postponeDaysOffered: 7,
  },

  // --- Règles d'adaptation ---
  rules: {
    /** R1 : fenêtre du rythme réel, en semaines. */
    rollingWeeks: 4,
    /** R1 : on remonte au plus loin de N semaines pour trouver 4 semaines « normales ». */
    rollingLookbackWeeks: 8,
    /** R3 : volume semaine suivante ≤ rythme réel × ce facteur. */
    weeklyVolumeCap: 1.1,
    /** R3 bis : semaine bloc (congé ou pont) ≤ rythme réel × ce facteur. */
    blockWeekCap: 1.3,
    /** Semaine bloc autorisée si la semaine précédente est réalisée à au moins ce taux. */
    blockWeekMinPrevCompletion: 0.8,
    /** Au plus une semaine bloc toutes les N semaines, suivie d'une semaine allégée. */
    blockWeekEveryWeeks: 3,
    /** En spécifique : bloc (week-end de 3 jours) une semaine sur deux, allégée entre deux. */
    blockWeekEveryWeeksSpecific: 2,
    /** Progression : la tendance monte de 10 % par semaine (les semaines allégées n'interrompent pas la tendance). */
    weeklyGrowth: 1.1,
    /** Le plan continue de monter tant que la dernière semaine de charge est faite à au moins ce ratio. */
    followRatio: 0.8,
    /** Nombre minimal de jours de semaine en congé pour faire d'une semaine une semaine bloc. */
    blockWeekMinLeaveDays: 3,
    /** Sortie la plus longue ≤ plus longue des 4 dernières semaines + N minutes. */
    longestRideIncreaseMin: 45,
    /** R3 : proposer de baisser la cible si taux de réalisation < seuil pendant N semaines. */
    lowCompletionThreshold: 0.7,
    lowCompletionWeeks: 2,
    /** R3 : baisse proposée de la cible dans ce cas. */
    lowCompletionReduction: 0.15,
    /** Écart minimal (h) pour proposer une baisse ou une hausse de volume. */
    volumeToleranceH: 0.25,
    raiseMinGapH: 0.5,
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
    /** % FTP à partir duquel un bloc est considéré intense. */
    intenseFtpPct: 88,
    /** Zone de FC à partir de laquelle un bloc est considéré intense. */
    intenseHrZone: 4,
    /** R8 : marge de lumière, aube et crépuscule civils (soleil à −6°). */
    sunAltitudeDeg: -6,
    /** R9 : météo « correcte » pour courir. */
    weatherMaxRainMm: 1,
    weatherMaxWindKmh: 40,
    weatherMinTempC: 0,
    /** Heure de contrôle de la météo la veille. */
    weatherCheckHour: 20,
    /** R10 : le réalisé est « en retard » s'il est sous ce ratio de la cible pendant N semaines. */
    behindRatio: 0.8,
    behindWeeks: 2,
  },

  /** Motivation : jauge de préparation, semaines tenues, niveaux. Récompense la régularité, jamais le surplus. */
  gamification: {
    /** Ce que le Desertus demande (cibles de la jauge « Prêt à … % »). */
    readiness: {
      weeklyEnduranceH: 8,
      longestRideMin: 360,
      backToBackDays: 3,
      /** Une journée d'enchaînement compte si la sortie fait au moins N minutes. */
      backToBackMinMin: 120,
      bigClimbM: 1500,
      /** Poids des composantes (total 100). */
      weights: { rhythm: 25, longest: 20, backToBack: 15, specific: 15, consistency: 25 },
    },
    /** Semaine tenue. */
    held: {
      /** Charge ou bloc : au moins ce ratio des heures d'endurance prévues. */
      loadMinRatio: 0.6,
      /** Allégée, affûtage : rester entre ces ratios (respecter le repos compte). */
      lightMinRatio: 0.4,
      lightMaxRatio: 1.1,
      /** Jokers par mois civil. */
      jokersPerMonth: 1,
    },
    /** Points : durée (min) × effort perçu, plafonnés à la charge prévue de la semaine. */
    xp: {
      defaultRpe: { gravel: 4, run: 5, swim: 4, football: 7, enduro: 6 } as Record<string, number>,
      heldWeekBonus: 150,
      /** Seuils des niveaux (le dernier, Finisher, s'obtient en terminant l'objectif). */
      levels: [
        { name: 'Novice', xp: 0 },
        { name: 'Pèlerin', xp: 6000 },
        { name: 'Nomade', xp: 18000 },
        { name: 'Méhariste', xp: 33000 },
        { name: 'Ascète du désert', xp: 48000 },
      ],
      finisher: 'Finisher',
    },
  },

  /** Jalon : la sortie de 6 h et plus, à placer en mars. */
  longRideMilestone: {
    month: '2027-03',
    defaultMin: 360,
    choicesMin: [360, 420, 480, 540],
    name: 'Sortie de 6 h',
  },

  /** Suivi du programme (évaluation en haut de chaque semaine). */
  progress: {
    /** Semaines terminées prises en compte. */
    weeks: 4,
    /** Réalisé / prévu sous ce ratio : en retard. */
    behindRatio: 0.85,
    /** Réalisé / prévu au-dessus de ce ratio : en avance. */
    aheadRatio: 1.1,
  },

  /** Macro-phases par défaut (R10). */
  phases: {
    /** Base jusqu'à cette date incluse (semaines qui commencent avant). */
    baseEnd: '2026-12-31',
    /** Développement jusqu'à cette date incluse. */
    devEnd: '2027-02-14',
    /** Affûtage : nombre de semaines finales (semaine de l'objectif comprise). */
    taperWeeks: 2,
  },

  /** Construction des semaines. */
  plan: {
    /** Semaine allégée = dernière semaine de charge × ce facteur (soit −30 %). */
    lightFactor: 0.7,
    /** Avant-dernière semaine (affûtage) = dernière charge × ce facteur. */
    taperFactor: 0.6,
    /** Semaine de l'objectif (hors objectif) = dernière charge × ce facteur. */
    raceWeekFactor: 0.35,
    /** Première semaine après un voyage : plafond = rythme × ce facteur. */
    reentryFactor: 0.9,
    /** Sorties de course pendant un voyage « course uniquement » (minutes). */
    travelRunsMin: [40, 40, 50],
    /** Séance structurée de semaine (minutes). */
    keyWeekdayMin: 60,
    /** Footing du jour à Paris (minutes), avant / à partir du développement. */
    parisRunMin: [30, 40],
    /** Endurance optionnelle de semaine (minutes). */
    optionalWeekdayMin: 45,
    /** Séance de semaine : durée minimale utile (minutes). */
    minWeekdayMin: 45,
    /** Samedi : environ cette part du volume de la semaine (sans dépasser le plafond de progression). */
    saturdayShareOfWeek: 0.55,
    /** Ce que le samedi laisse au dimanche et aux séances de semaine (minutes). */
    weekRestAfterSaturdayMin: 150,
    /** Dimanche (enchaînement) : au plus cette part de la sortie du samedi. */
    sundayShareOfSaturday: 0.75,
    /** Course à pied de la semaine (minutes), avant / à partir du développement. */
    runMin: [35, 45],
    /** En dessous de ce reste (min), on renonce à la séance optionnelle de semaine. */
    minWeekendMin: 120,
    /** Au-delà de ce reste (min), on ajoute une sortie le dimanche. */
    secondWeekendRideAboveMin: 210,
    /** Part de la sortie du samedi quand il y en a deux. */
    saturdayShare: 0.6,
    /** Part du samedi dans un enchaînement de 2 jours (spécifique). */
    backToBackShare: 0.55,
    /** Répartition d'un bloc de 3 jours. */
    blockShares: [0.28, 0.44, 0.28],
    /** Durées arrondies à ce pas (minutes). */
    roundMin: 15,
    /** Vitesse moyenne gravel (km/h), normale et chargé. */
    gravelSpeedKmh: 17,
    loadedSpeedKmh: 15,
    /** D+ par km selon la phase (le Desertus est à 10 m/km). */
    elevationPerKm: { base: 8, development: 10, specific: 13, taper: 10 },
    /** Variante home-trainer d'une sortie longue : durée maximale (minutes). */
    trainerVariantMaxMin: 120,
    /** Durée max sur une journée posée ou de week-end (minutes). */
    weekendMaxMin: 360,
  },

  /** Disponibilités par défaut (modifiables dans les paramètres). */
  availability: {
    /** 1 = lundi … 7 = dimanche ; minutes disponibles et jour à Paris. */
    // minutes = le matin (7h30) ; evening = home-trainer le soir (soirs sans foot, à la maison).
    template: {
      1: { minutes: 60, paris: false, evening: 0 },
      2: { minutes: 60, paris: true, evening: 90 },
      3: { minutes: 60, paris: true, evening: 90 },
      4: { minutes: 60, paris: false, evening: 0 },
      5: { minutes: 60, paris: false, evening: 90 },
      6: { minutes: 360, paris: false, evening: 0 },
      7: { minutes: 360, paris: false, evening: 0 },
    },
    weekdayMorningStart: '07:30',
    /** Lundi et jeudi : obligatoires sauf à Paris, prioritaires sur les autres séances. */
    footballDays: [1, 4],
    footballMin: 90,
    /** Présence à Paris posée depuis la vue semaine : nombre de jours par défaut. */
    parisDefaultLength: 2,
    exceptions: [
      { id: 'exc:noel-2026', start: '2026-12-24', end: '2027-01-01', kind: 'leave', label: 'Congés de Noël' },
      { id: 'exc:etranger-fev-2027', start: '2027-02-06', end: '2027-02-20', kind: 'runOnly', label: 'Étranger (course uniquement)' },
    ],
    location: { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
  },
} as const;

export type Config = typeof CONFIG;
