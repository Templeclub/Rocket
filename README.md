# Ascèse

> *Ascèse* : discipline que l’on s’impose, exercice régulier pour progresser.

PWA personnelle de planification d’entraînement vers le **Desertus Bikus** (10 avril 2027, 1 300 km, 13 000 m D+, 7 jours max).
Mobile Android, une main, en français, données locales uniquement, fuseau Europe/Paris.

**État : phase 1 et interface sur `main`. Strava, illustrations, phases et paramètres rangés sur la branche `strava-design`, en attente de validation.**

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

### Paramètres
Rangés par rubriques : **Entraînement** (Programme, Disponibilités, Objectif), **Profil** (Profil et zones, Séances types), **Connexions** (Strava), **Données et application** (Sauvegarde, Application). Chaque rubrique s’ouvre dans son panneau.

### Vue Mois
Deux affichages : **Séances** (un point par séance, plein si faite, rouge si non faite) et **Disciplines** (un rond par discipline et par jour, **ronds imbriqués** si plusieurs disciplines, la plus longue à l’extérieur, légende en dessous). La liste des semaines indique phase, type de semaine et confirmation.

## Le programme généré

| Période | Phase | Semaines |
|---|---|---|
| 9 nov → 28 déc | Base | charge, allégée le 23 nov et le 14 déc, **bloc des congés** du 28 déc (3 jours enchaînés) |
| 4 janv → 8 févr | Développement | allégée le 4 janv et le 1er févr, **voyage course uniquement** du 8 févr |
| 15 févr → 22 mars | Spécifique | voyage jusqu’au 20 févr, reprise, sortie chargée, sortie qui finit de nuit, **bloc de 3 jours** le 12–14 mars (pose ton vendredi), répétition générale 27–28 mars |
| 29 mars → 10 avril | Affûtage | déblocage, volume −40 % puis −65 %, pas de foot la semaine de l’objectif |

Semaine type (Paris mardi-mercredi) : lundi foot, mardi footing à Paris (variante natation), jeudi foot, vendredi endurance (dehors s’il fait jour), samedi sortie longue avec la séance structurée intégrée (clé, variante home-trainer), dimanche seconde sortie si le volume le permet. Quand Paris tombe sur d’autres jours, la séance structurée revient un matin compatible (en home-trainer, mode ERG). En spécifique, le week-end enchaîne deux jours.

Volume **d’endurance** (vélo, course, natation ; le foot s’ajoute) : de **3h15** (3h × 1,10, arrondi en dessous) jusqu’au pic de **5h30**, blocs jusqu’à **~7h**. Tes 4h30 et 7h incluaient un foot de 1h30 : ce sont 3h et 5h30 d’endurance, et le second foot de la semaine vient en plus.

> ⚠️ **Écart avec l’objectif.** La plus longue sortie plafonne vers 3h, alors que le Desertus demande environ 7 à 8 h de vélo par jour pendant 7 jours. Le plan respecte ta règle (le rythme réel prime) ; l’évaluation de la semaine propose de relever le pic dès que ton rythme le dépasse.

## Règles appliquées (valeurs dans `src/engine/config.ts`)

| Règle | Où |
|---|---|
| R1 rythme réel sur 4 semaines (semaines allégées, voyage, affûtage et semaines exclues ignorées) | `review.ts` `realRhythm` |
| R2 séance manquée : laisser tomber, ou déplacer si clé et semaine pas chargée ; jamais automatique | bilan |
| R3 volume ≤ rythme × 1,10 (× 1,30 en semaine bloc) ; < 70 % deux semaines → baisser la cible | macro-plan + bilan |
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
npm test           # tests unitaires (Vitest) : 140 tests
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
  strava.ts        classement des activités Strava (titre puis type), conversion, rapprochement jour + discipline
netlify/functions/strava.mjs   relais Strava (échange du code, jetons, activités), sans stockage
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
| Volume | En heures d’**endurance** : 3h au départ, pic 5h30 (tes 4h30 / 7h moins un foot de 1h30). Le foot s’ajoute. |
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
