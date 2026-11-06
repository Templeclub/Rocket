# Ascèse

> *Ascèse* : discipline que l’on s’impose, exercice régulier pour progresser.

PWA personnelle de planification d’entraînement vers le **Desertus Bikus** (10 avril 2027, 1 300 km, 13 000 m D+, 7 jours max).
Mobile Android, une main, en français, données locales uniquement, fuseau Europe/Paris.

**État : phase 1 (programme et confirmation hebdomadaire) livrée sur la branche `phase-1`, en attente de validation.** La phase 0 est sur `main`.

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

| Je veux… | Comment | Taps |
|---|---|---|
| Créer une séance | « + » sur le jour → séance type | 2 |
| Reporter | « Reporter » → jour | 2 |
| Échanger | ⇄ → l’autre séance | 2 |
| Annuler | ✕ (bandeau « Annuler » 5 s) | 1 |
| Fait comme prévu | « Fait » | 1 |
| Basculer HT ↔ extérieur, course ↔ natation | Fiche séance → « Basculer sur la variante » | 2 |

### Vue Mois
Deux affichages : **Séances** (un point par séance, plein si faite, rouge si non faite) et **Disciplines** (un rond par discipline et par jour, **ronds imbriqués** si plusieurs disciplines, la plus longue à l’extérieur, légende en dessous). La liste des semaines indique phase, type de semaine et confirmation.

## Le programme généré

| Période | Phase | Semaines |
|---|---|---|
| 9 nov → 28 déc | Base | charge, allégée le 23 nov et le 14 déc, **bloc des congés** du 28 déc (3 jours enchaînés) |
| 4 janv → 8 févr | Développement | allégée le 4 janv et le 1er févr, **voyage course uniquement** du 8 févr |
| 15 févr → 22 mars | Spécifique | voyage jusqu’au 20 févr, reprise, sortie chargée, sortie qui finit de nuit, **bloc de 3 jours** le 12–14 mars (pose ton vendredi), répétition générale 27–28 mars |
| 29 mars → 10 avril | Affûtage | déblocage, volume −40 % puis −65 %, pas de foot la semaine de l’objectif |

Construction d’une semaine type (foot le jeudi) : lundi séance structurée home-trainer (clé, en mode ERG), mardi footing à Paris (variante natation), jeudi foot, vendredi endurance optionnelle (dehors seulement s’il fait jour), samedi sortie longue (clé, variante home-trainer), dimanche seconde sortie si le volume le permet. En spécifique, le week-end enchaîne deux jours.

Volume : de **4h45** (4h30 × 1,10, arrondi en dessous) à **7h** fin janvier, blocs jusqu’à **~9h**, plus longue sortie qui progresse de 45 min au plus.

> ⚠️ **Écart avec l’objectif.** Avec un pic de 7h par semaine foot compris, la plus longue sortie plafonne vers 3h, alors que le Desertus demande environ 7 à 8 h de vélo par jour pendant 7 jours. Le plan respecte ta règle (le rythme réel prime) et le bilan hebdomadaire proposera d’allonger dès que ton rythme le permet. Tu peux aussi relever le pic dans Paramètres → Programme.

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
npm test           # tests unitaires (Vitest) : 93 tests
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
  sun.ts           aube, lever, coucher, crépuscule (Bordeaux, sans API)
  status.ts, stats.ts, zones.ts, dates.ts, library.ts, backup.ts, activity.ts
src/db/            Dexie : schéma v2 (semaines, recommandations), actions, programme
src/ui/            vues Semaine, Mois, Paramètres, fiche séance, bilan
```

- La base IndexedDB garde son nom technique `desertusplan` : la renommer effacerait les données. Les sauvegardes s’appellent désormais `ascese-AAAA-MM-JJ.json` ; les anciennes restent importables.
- Couleurs des disciplines : palette vérifiée (écart de couleur ≥ 15 entre toutes les paires en vision normale, clair et sombre). Pour les daltoniens, l’orange et le vert restent proches : la légende et le détail au tap font foi. L’enduro, rare, est en gris.

## Décisions prises avec toi

| Sujet | Décision |
|---|---|
| Volume | 4h30 **foot compris** (réponse « oui » à la question 3) : le plan raisonne en heures totales. Pic 7h, relevé si le rythme réel le permet. |
| Plafond | rythme réel × 1,10 ; semaine bloc × 1,30 (congés, ou vendredi posé en spécifique), au plus 1 toutes les 3 semaines, suivie d’une allégée. |
| Home-trainer | Rouvy, montage 10 min. Export `.zwo`/`.mrc` : à faire (voir ci-dessous). |
| Disponibilités | 7h30–8h30 en semaine, mardi et mercredi à Paris (course seulement), foot le jeudi, week-end jusqu’à 6 h/jour, pas de double séance. |
| Exceptions | Noël du 24 déc au 1er janv (congés), étranger du 6 au 20 févr (course uniquement). |
| Charge | sRPE (durée × RPE), TSS en info sur HT (phase 3). |

## Ce qui reste

**Phase 1** : export des séances home-trainer vers **Rouvy** (`.zwo` / `.mrc`), jalons intermédiaires (sortie test 200 km…) pris en compte par le générateur.
**Phase 2** : import FIT/GPX, rapprochement prévu/réalisé, synchronisation Strava (`activity:read_all`).
**Phase 3** : bascule course/natation automatique selon Open-Meteo, alertes de logistique home-trainer plus fines, charge sRPE.
**Phase 4** : notification push le dimanche (Netlify planifié + Web Push) ; le bilan reste calculé sur le téléphone. En attendant, le rappel est le bandeau dans l’appli.
