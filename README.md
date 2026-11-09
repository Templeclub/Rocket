# Ascèse

> *Ascèse* : discipline que l’on s’impose, exercice régulier pour progresser.

PWA personnelle de planification d’entraînement vers le **Desertus Bikus** (10 avril 2027, 1 300 km, 13 000 m D+, 7 jours max).
Mobile Android, une main, en français, données locales uniquement, fuseau Europe/Paris.

**État : `main` à jour (motivation comprise). Méthode de planification v2 sur la branche `methode-v2`.**

## Utilisation

### Le programme
Au premier lancement, la vue Semaine propose **« Générer mon programme »** : 22 semaines du 9 novembre au 10 avril, avec phases, semaines allégées, congés de Noël, voyage de février et contenu détaillé de chaque séance. Tout reste modifiable (reporter, échanger, annuler, éditer).

Paramètres → Programme : volume de départ, pic, et **« Recalculer à partir du … »** (repart du rythme réel ; le réalisé et les semaines passées sont conservés, les séances générées non faites sont remplacées). Paramètres → Disponibilités : minutes par jour, jours à Paris, jour du foot, congés, voyages et indisponibilités.

### La confirmation de chaque semaine
Du **samedi au dimanche**, un bandeau « Confirme ta semaine du … » apparaît (et le **lundi/mardi** si la semaine en cours n’est pas confirmée). Le bilan affiche :
- la semaine écoulée : heures faites / prévues, taux de réalisation, séances non faites ;
- le **rythme réel** (4 dernières semaines normales) et le **plafond** qui en découle ;
- des **propositions chiffrées** (le chiffre qui la justifie en gros, le seuil à côté), chacune acceptable ou ignorable ;
- la semaine prévue, puis **« Confirmer la semaine »**.

Aucune proposition n’est appliquée sans ton accord, et chaque choix accepté s’annule depuis le bandeau.

### Gestes rapides

Chaque carte n’a qu’un bouton « ⋯ » : il ouvre un panneau avec toutes les actions, les jours de report et les séances à échanger. Les jours de report sont **autour de la date de la séance** (3 jours avant, une semaine après, jamais dans le passé), la date actuelle repérée « Prévue ».

| Je veux… | Comment | Taps |
|---|---|---|
| Créer une séance | « + » sur le jour → séance type | 2 |
| Reporter | « ⋯ » → jour | 2 |
| Échanger | « ⋯ » → l’autre séance | 2 |
| Annuler | « ⋯ » → Annuler (bandeau « Annuler » 5 s) | 2 |
| Fait comme prévu | « ⋯ » → Fait | 2 |
| Confirmer une séance recommandée | pastille « Recommandée · Confirmer » | 1 |
| Tout confirmer pour la semaine | carte de la semaine → « Tout confirmer » | 1 |
| Basculer HT ↔ extérieur, course ↔ natation | « ⋯ » → variante | 2 |

### Recommandée ou confirmée
Les séances proposées par le programme sont **recommandées** : bord pointillé, fond transparent, pastille « Recommandée · Confirmer ». Une fois **confirmées** (pastille, « Tout confirmer », bilan de la semaine, ou dès que tu reportes ou échanges la séance), elles deviennent des cartes pleines. Les séances ajoutées à la main sont confirmées d’office.

### Jours à Paris et foot
En haut de la vue Semaine, un point sous chaque jour :
- semaine **sans** Paris : un tap pose **2 jours** à partir du jour touché ;
- ensuite, **chaque tap ajoute ou retire un jour** (1 seul jour, 3 jours, jours séparés…) ;
- « modifier » ouvre le panneau de la semaine : jours à cocher, **Aucun jour**, **Semaine type**, et « Replanifier la semaine » si quelque chose ne colle plus.

Le **foot est obligatoire le lundi et le jeudi, sauf à Paris**, et prioritaire : rien d’autre n’est prévu ces jours-là. À Paris, course uniquement. Avec Paris mardi-mercredi (foot lundi et jeudi), aucun matin de semaine n’est compatible avec la règle R7 pour la séance structurée : elle est **intégrée à la sortie du samedi** (efforts en zone de FC).

### Évaluation de la semaine (retard, avance, ajustements)
En haut de chaque semaine en cours ou à venir :
- **suivi du programme** : heures d’endurance faites / prévues sur les 4 dernières semaines terminées → *En retard* (< 85 %), *Dans le plan*, *En avance* (> 110 %), avec le rythme réel et ce qu’il permet cette semaine ;
  - en retard → « Recalculer le programme » (repart du rythme réel, sans forcer) ;
  - en avance → « Recalculer » ou « Relever le pic à … et recalculer » si ton rythme dépasse le pic ;
- **ce qui ne colle plus** (séance un jour à Paris, autre chose qu’un foot un lundi ou jeudi, foot manquant, intense à côté du foot, deux séances le même jour), sur les séances recommandées comme confirmées → « Replanifier la semaine » : aperçu avant/après, puis « Appliquer » (annulable). Les séances faites et ajoutées à la main sont gardées ; une séance identique reste en place avec sa confirmation.

### Phases du programme
Un fil en haut des vues Semaine et Mois : une case par semaine colorée par phase (Base sable, Développement abricot, Spécifique terre cuite, Affûtage vert), plus basse pour les semaines allégées ou de voyage, plus haute pour les blocs ; la semaine affichée est encadrée, un tap ouvre une semaine. Dans le calendrier du mois, chaque ligne prend la teinte de sa phase, avec le nom de la phase quand elle change.

### Strava
Paramètres → Connexions → **Strava**. La Suunto envoie déjà les activités sur Strava ; Ascèse les récupère :
- **à l’ouverture** de l’appli et **à chaque retour dedans** (au plus toutes les 30 min), plus un bouton « Synchroniser » ;
- **discipline** : d’abord le **titre** (« Football » en *Workout* → foot ; « Rouvy », « Zwift », « HT » → home-trainer ; « gravel », « vélo », « route », « VTT » → gravel ; « footing », « course » → course ; « natation », « piscine » → natation ; « enduro », « moto » → enduro), puis le type Strava, puis l’indicateur home-trainer. Le reste (marche, muscu…) est ignoré et listé ;
- **rapprochement** : même jour, même discipline, sans regarder la durée ni le contenu (une sortie prévue dehors et faite sur Rouvy valide la séance, qui passe à « faite ») ; sinon l’activité apparaît en « non prévue ». Un « Fait » saisi à la main ce jour-là est remplacé. Aucune activité n’est importée deux fois.

Mise en place (une fois) : créer une application sur `strava.com/settings/api` (domaine de rappel = l’adresse Netlify), puis dans Netlify → *Site configuration* → *Environment variables* : `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET`, et redéployer. L’écran Strava de l’appli détaille ces étapes. Le secret reste chez Netlify (fonction `netlify/functions/strava.mjs`, qui ne stocke rien) ; les jetons restent sur le téléphone et ne sont pas exportés. Scope demandé : `activity:read_all` (laisser cochées les activités privées).

Limites : pas de synchronisation quand l’appli est fermée (il faudrait stocker les jetons sur un serveur : phase 4) ; une activité supprimée sur Strava n’est pas retirée d’Ascèse.

### Motivation
Principe : récompenser la **régularité et les bonnes décisions**, jamais le volume en plus du plan. Toutes les valeurs dans `CONFIG.gamification`.
- **Prêt pour le Desertus (… %)** : ce qui a réellement été fait, comparé à ce que l’épreuve demande. 5 composantes sur 100 : rythme réel sur les semaines terminées (25, objectif 8 h d’endurance par semaine), plus longue sortie (20, objectif 6 h), jours enchaînés avec 2 h de vélo ou plus (15, objectif 3), spécifique (15 : sortie chargée, sortie de nuit, sortie à 1 500 m de D+), régularité (25 : semaines tenues sur l’ensemble du programme). La composante où il reste le plus de points est mise en avant avec sa prochaine marche. Plan suivi à la lettre : environ 60 % à la fin (le pic de 5h30 ne couvre pas tout ce que demande le Desertus, et la jauge le dit).
- **Semaines tenues** : semaine de charge ou bloc tenue si les séances clés sont faites (ou laissées tombées proprement, aucune laissée « non faite ») et au moins 60 % des heures prévues ; semaine allégée ou affûtage tenue si l’on reste entre 40 % et 110 % du prévu (respecter le repos compte) ; voyage tenu avec une sortie. **Un joker par mois** sauve une semaine difficile. Série en cours, record, et ce qu’il reste pour tenir la semaine en cours.
- **Niveaux** : points = minutes × effort perçu (RPE de l’activité, sinon celui de la séance, sinon une valeur par sport), **plafonnés chaque semaine à la charge prévue** ; +150 par semaine tenue. Novice → Pèlerin (5 000) → Nomade (15 000) → Méhariste (28 000) → Ascète du désert (42 000) → **Finisher** (une sortie vélo pendant le Desertus). Programme suivi à la lettre : Ascète du désert la semaine de l’épreuve.
- **Petits plaisirs** : vibration et éclat discret sur « Fait » (+ points dans le bandeau), carte animée pour une semaine tenue ou un niveau atteint (fêtés une seule fois), image de la semaine à partager (menu de partage Android) depuis « Ma progression ». Désactivable dans Paramètres → Application ; pas d’animation si le téléphone demande moins de mouvements.

Accès : le bandeau à 3 tuiles sous le compte à rebours (jauge, série, niveau) ouvre « Ma progression ».

### Thème et couleurs
Paramètres → Application → **Automatique / Jour / Nuit** (automatique suit le téléphone). Couleurs « sport » : dégradé orange → rouge pour les actions principales, l’onglet actif et le bandeau d’objectif (compte à rebours J-xx), barre de navigation bleu nuit, phases en bleu (base), ambre (développement), orange vif (spécifique) et vert (affûtage). Contraste du texte d’accent : 4,7:1 sur fond blanc.

### Sauvegarde en ligne
Les données restent sur le téléphone d’une version à l’autre de l’appli (un déploiement ne touche pas IndexedDB). La sauvegarde en ligne protège contre une désinstallation, un effacement des données de Chrome ou un changement de téléphone :
- **chiffrée sur le téléphone** (AES-GCM 256, clé dérivée de la phrase secrète par PBKDF2) : Netlify ne stocke que du chiffré ;
- envoyée **automatiquement** à l’ouverture, toutes les 2 minutes s’il y a du nouveau, et en quittant l’appli ; 30 versions quotidiennes conservées ; restauration de n’importe laquelle ;
- stockée dans **Netlify Blobs** (fonction `netlify/functions/backup.mjs`, rien d’autre à créer) ;
- contient programme, séances, réalisé, séances types, objectif et paramètres (thème compris) ; **pas** la connexion Strava (à refaire sur un nouveau téléphone) ni la phrase secrète.

À faire une fois : choisir une phrase secrète (12 caractères ou plus, à noter), l’ajouter dans Netlify → *Environment variables* sous `ASCESE_BACKUP_KEY`, redéployer, puis la saisir dans Paramètres → Sauvegarde. Sur un nouveau téléphone : installer l’appli, saisir la même phrase, la dernière sauvegarde est proposée.

### Paramètres
Rangés par rubriques : **Entraînement** (Programme, Disponibilités, Objectif), **Profil** (Profil et zones, Séances types), **Connexions** (Strava), **Données et application** (Sauvegarde, Application). Chaque rubrique s’ouvre dans son panneau.

### Vue Mois
Deux affichages : **Séances** (un point par séance, plein si faite, rouge si non faite) et **Disciplines** (un rond par discipline et par jour, **ronds imbriqués** si plusieurs disciplines, la plus longue à l’extérieur, légende en dessous). La liste des semaines indique phase, type de semaine et confirmation.

## Le programme généré

| Période | Phase | Semaines |
|---|---|---|
| 9 nov → 28 déc | Base | charge, allégée le 23 nov et le 14 déc, **bloc des congés** du 1er au 3 janv (3 longues journées, sans foot pendant les congés) |
| 4 janv → 8 févr | Développement | montée vers **8 h d’endurance** (7h de vélo) fin janvier, allégée le 4 janv et le 1er févr, **voyage course uniquement** du 6 au 20 févr |
| 15 févr → 28 mars | Spécifique | **3 longs week-ends de 3 jours** (pose les vendredis 26 févr, 12 mars et 26 mars) avec semaine allégée entre deux, sortie qui finit de nuit, vélo chargé, répétition générale le dernier |
| 29 mars → 10 avril | Affûtage | déblocage, volume −40 % puis −65 %, pas de foot la semaine de l’objectif |

Semaine type (Paris mardi-mercredi) : lundi et jeudi foot, vendredi à la maison (course, ou home-trainer le soir quand le volume le demande), samedi sortie longue avec la séance structurée intégrée (clé, variante home-trainer), dimanche seconde sortie. Quand Paris tombe sur d’autres jours, les jours à la maison libérés reçoivent la séance structurée (home-trainer, mode ERG, le matin ou le soir) et la course ; la course ne va à Paris (2e jour) qu’en dernier recours. Les jours à la maison sans foot acceptent un home-trainer le soir jusqu’à 1h30.

Volume **d’endurance** (vélo, course, natation ; le foot s’ajoute) — **méthode v2** : la tendance monte de 10 % par semaine (les semaines allégées sont un creux, pas un retour en arrière) jusqu’au pic de **8 h**, longs week-ends jusqu’à **~10 h**. Tant que la dernière semaine de charge est faite à 80 % ou plus, le plan continue ; sinon le plafond revient au rythme réel × 1,10. Sortie longue : +45 min par marche, environ 2h30 laissées au dimanche et à la semaine.

> **Où en est la préparation.** Plan suivi à la lettre : 7 à 10 h de vélo par semaine de mi-janvier à fin mars, plus longue sortie ~4h45, 3 longs week-ends d’environ 10 h ; la jauge « Prêt pour le Desertus » finit vers 89 %. Ce qui manque encore : une sortie de 6 h et plus (à ajouter si tu poses une journée, idéalement une sortie test de 200 km début mars) et du dénivelé (1 500 m sur une sortie).

## Règles appliquées (valeurs dans `src/engine/config.ts`)

| Règle | Où |
|---|---|
| R1 rythme réel sur 4 semaines (semaines allégées, voyage, affûtage et semaines exclues ignorées) | `review.ts` `realRhythm` |
| R2 séance manquée : laisser tomber, ou déplacer si clé et semaine pas chargée ; jamais automatique | bilan |
| R3 volume : le plan monte de 10 % par semaine tant que la dernière semaine de charge est faite à 80 % ; sinon ≤ rythme réel × 1,10 (× 1,30 en bloc) ; < 70 % deux semaines → baisser la cible | macro-plan + bilan |
| R4 1 à 2 séances clés, les optionnelles sacrifiées en premier | construction + bilan |
| R5 semaine allégée −30 % toutes les 3 à 4 semaines | macro-plan |
| R6 alerte extérieur / home-trainer / extérieur (montage 10 min) | bilan |
| R7 pas d’intense la veille, le jour ou le lendemain du foot | construction + bilan |
| R8 extérieur en semaine seulement entre l’aube et le crépuscule civils de Bordeaux (calcul local) | `sun.ts` |
| R9 course ↔ natation : bascule manuelle en 1 tap (automatique avec la météo en phase 3) | variante |
| R10 macro-phases ; réalisé en retard 2 semaines → le dire et proposer de recalculer | macro-plan + bilan |

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires (Vitest) : 171 tests
npm run build      # vérification TypeScript + build PWA
npm run icons      # régénère les icônes PNG depuis public/favicon.svg
```

`.npmrc` active `legacy-peer-deps` (un conflit de dépendances optionnelles de Vitest fait planter `npm install` sinon).

## Architecture

```
src/engine/        TypeScript pur, testé, sans React ni Dexie
  config.ts        toutes les valeurs numériques
  planner.ts       macro-plan (phases, types de semaine, volumes) + construction des semaines
  workouts.ts      séances paramétrées (HT ERG, extérieur FC/RPE, sortie longue, course, natation)
  review.ts        rythme réel, plafond, recommandations chiffrées, semaine à confirmer
  evaluate.ts      signalements, suivi du programme (retard/avance), reconstruction d’une semaine
  gamification.ts  jauge de préparation, semaines tenues (joker), points plafonnés et niveaux
  strava.ts        classement des activités Strava (titre puis type), conversion, rapprochement jour + discipline
netlify/functions/strava.mjs   relais Strava (échange du code, jetons, activités), sans stockage
netlify/functions/backup.mjs   sauvegarde en ligne chiffrée (Netlify Blobs, 30 versions)
netlify/tests/                 tests des fonctions (hors du dossier des fonctions, sinon Netlify les déploie)
  sun.ts           aube, lever, coucher, crépuscule (Bordeaux, sans API)
  status.ts, stats.ts, zones.ts, dates.ts, library.ts, backup.ts, activity.ts
src/db/            Dexie : schéma v2 (semaines, recommandations), actions, programme
src/ui/            vues Semaine, Mois, Paramètres, fiche séance, bilan
```

- La base IndexedDB garde son nom technique `desertusplan` : la renommer effacerait les données. Les sauvegardes s’appellent désormais `ascese-AAAA-MM-JJ.json` ; les anciennes restent importables.
- Polices embarquées (hors ligne) : Inter pour le texte, Outfit pour les titres et les chiffres.
- Illustrations des disciplines : pictogrammes au trait dessinés en SVG (`SportGlyph.tsx`), dans la couleur de chaque discipline sur une pastille teintée ; plus d’emojis.
- Couleurs des disciplines : palette vérifiée (écart de couleur ≥ 15 entre toutes les paires en vision normale, clair et sombre). Pour les daltoniens, l’orange et le vert restent proches : la légende et le détail au tap font foi. L’enduro, rare, est en gris.

## Décisions prises avec toi

| Sujet | Décision |
|---|---|
| Volume | En heures d’**endurance** : 3h au départ, **pic 8h** (méthode v2), le foot s’ajoute. Home-trainer le soir possible les jours à la maison. |
| Plafond | rythme réel × 1,10 ; semaine bloc × 1,30 (congés, ou vendredi posé en spécifique), au plus 1 toutes les 3 semaines, suivie d’une allégée. |
| Home-trainer | Rouvy, montage 10 min. Export `.zwo`/`.mrc` : à faire (voir ci-dessous). |
| Disponibilités | 7h30–8h30 en semaine ; Paris mardi-mercredi par défaut, réglable semaine par semaine (course seulement) ; **foot lundi et jeudi obligatoire sauf à Paris, prioritaire** ; week-end jusqu’à 6 h/jour ; pas de double séance. |
| Recalcul | Les séances recommandées **et** confirmées qui ne collent plus sont signalées ; la replanification est proposée avec aperçu, jamais appliquée seule. |
| Exceptions | Noël du 24 déc au 1er janv (congés), étranger du 6 au 20 févr (course uniquement). |
| Charge | sRPE (durée × RPE), TSS en info sur HT (phase 3). |

## Ce qui reste

**Phase 1** : export des séances home-trainer vers **Rouvy** (`.zwo` / `.mrc`), jalons intermédiaires (sortie test 200 km…) pris en compte par le générateur.
**Phase 2** : Strava fait (voir ci-dessus). Reste : import manuel FIT/GPX, suppression des activités retirées de Strava.
**Phase 3** : bascule course/natation automatique selon Open-Meteo, alertes de logistique home-trainer plus fines, charge sRPE.
**Phase 4** : notification push le dimanche (Netlify planifié + Web Push) ; le bilan reste calculé sur le téléphone. En attendant, le rappel est le bandeau dans l’appli.
