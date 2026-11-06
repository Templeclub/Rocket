# DesertusPlan

PWA personnelle de planification d’entraînement vers le **Desertus Bikus** (10 avril 2027, 1 300 km, 13 000 m D+, 7 jours max).
Mobile Android, une main, en français, données locales uniquement, fuseau Europe/Paris.

**État : phase 0 (fondations) livrée, en attente de validation.**

## Utilisation

| Je veux… | Comment | Taps |
|---|---|---|
| Créer une séance | « + » sur le jour → séance type (les dernières utilisées en premier) | 2 |
| Reporter | « Reporter » sur la carte → jour (avec la charge déjà prévue ce jour-là) | 2 |
| Échanger deux séances | ⇄ sur la carte → l’autre séance | 2 |
| Annuler | ✕ sur la carte (bandeau « Annuler » pendant 5 s pour revenir en arrière) | 1 |
| Noter « fait comme prévu » | « Fait » sur la carte (bandeau « Détailler » pour saisir le réel) | 1 |
| Saisir le réalisé | Fiche séance → Réalisé → Saisir (durée, distance, D+, FC, puissance, RPE) | — |
| Activité non prévue | « + » → « Activité non prévue » | — |
| Modifier une séance | Tap sur la carte → Modifier (la séance est une copie : le modèle ne change pas) | — |
| Bibliothèque, profil, zones | Paramètres | — |
| Sauvegarder / restaurer | Paramètres → Exporter (JSON) / Importer | — |

Une séance prévue dont la date est passée s’affiche **« non faite »** en rouge et reste à sa date : elle n’est jamais rattrapée automatiquement.
Le bouton retour d’Android ferme le panneau ouvert.

La vue semaine affiche, par sport, les heures **faites / prévues**, le total **endurance** (vélo, course, natation) et le total **avec foot et enduro**, plus le taux de réalisation.

## Installation sur Android

1. Ouvrir l’URL Netlify dans Chrome.
2. Paramètres → « Installer sur l’écran d’accueil » (ou menu ⋮ → « Ajouter à l’écran d’accueil »).
3. L’appli fonctionne ensuite hors ligne. Les données restent sur le téléphone : **exporter régulièrement** (Paramètres → Exporter).

## Déploiement (Netlify)

Le dépôt contient `netlify.toml` : commande `npm run build`, dossier publié `dist`, Node 22. Il suffit de connecter le dépôt GitHub dans Netlify (« Add new site » → « Import an existing project » → choisir le dépôt), sans autre réglage. Chaque push redéploie.

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires (Vitest)
npm run build      # vérification TypeScript + build PWA
npm run icons      # régénère les icônes PNG depuis public/favicon.svg
```

`.npmrc` active `legacy-peer-deps` (un conflit de dépendances optionnelles de Vitest fait planter `npm install` sinon).

## Architecture

```
src/
  engine/          TypeScript pur, aucune dépendance à React ni à Dexie, testé
    config.ts      TOUTES les valeurs numériques des règles (un seul fichier)
    types.ts       modèle de données
    status.ts      statuts (prévue, faite, reportée, annulée), report, échange, annulation
    dates.ts       dates locales YYYY-MM-DD, Europe/Paris
    zones.ts       zones puissance (Coggan, % FTP) et FC (% FC max), durées, description des blocs
    stats.ts       dérivés non stockés : heures par sport, taux de réalisation
    library.ts     séances types de départ, copie modèle → séance planifiée
    backup.ts      format de sauvegarde JSON et validation à l’import
    activity.ts    réalisé « comme prévu », objectif par défaut
  db/              Dexie (IndexedDB) : schéma, actions avec annulation, export/import
  ui/              React : vues Semaine, Mois, Paramètres, fiche séance
```

Choix :
- **Dépendances de production** : React, Dexie, dexie-react-hooks. Pas de librairie de dates (Intl + code maison testé), pas de routeur (4 écrans).
- **Paramètres** : `config.ts` donne les valeurs par défaut ; le profil et les zones modifiés dans l’appli sont stockés et priment.
- **Report** : une seule ligne par séance ; `date` change, `originalDate` garde la toute première date, statut `postponed`. Revenir à la date d’origine efface le report. Reporter dans le passé est refusé.
- **Fait** = la séance a un réalisé lié. Supprimer le réalisé remet la séance en attente.
- **Heures d’endurance** = vélo + course + natation ; le foot et l’enduro comptent dans la charge, pas dans ces heures.

## Décisions prises avec toi (servent aux phases suivantes)

| Sujet | Décision |
|---|---|
| Home-trainer | Rouvy. Export `.zwo` + `.mrc` (phase 1), à vérifier sur ton compte. Montage du vélo : 10 min. |
| Volume | Plafond = rythme réel × 1,10 sur les heures d’endurance. Semaine « bloc » (congé, pont) × 1,30 si la semaine d’avant est réalisée à ≥ 80 %, au plus 1 toutes les 3 semaines, suivie d’une semaine allégée. Sortie la plus longue ≤ plus longue des 4 dernières semaines + 45 min. |
| Charge | sRPE (durée × RPE) pour tous les sports ; TSS en information sur home-trainer. |
| Semaine allégée | Dernière : semaine du 26 octobre ; cycle 3 + 1, donc prochaine semaine du 23 novembre. |
| Disponibilités | Semaine : 7h30–8h30. Week-end : jusqu’à 6 h/jour. Mardi et mercredi (Paris) : course optionnelle seulement. Pas de double séance sauf ajout manuel. |
| Foot | Lundi ou jeudi selon la semaine (jeudi par défaut), compté comme séance intense. |
| Lumière | Extérieur en semaine seulement entre l’aube civile et le crépuscule civil à Bordeaux. Avec 7h30–8h30 : possible début novembre et à partir de mars, home-trainer de fin novembre à fin février. |
| Météo | « Correcte » = pluie < 1 mm, vent < 40 km/h, > 0 °C ; contrôle la veille à 20 h. |
| Zones | Puissance : Coggan 7 zones. FC : 5 zones en % FC max (modifiables, à aligner sur Suunto). FC repos 49. |
| Course | Pas de blessure ; cibles en zone FC + RPE, allure recalée sur le réalisé en phase 2. |
| Natation | Bassin 25 ou 50 m, toutes nages, pull buoy. |
| Bikepacking | Oui : sortie longue chargée, sortie finissant de nuit, enchaînement 2 jours (spécifique). Pas de renforcement musculaire. |
| Indisponibilités connues | Congés de Noël du 24 décembre au 1er janvier inclus (bloc possible). **Du 6 au 20 février 2027 à l’étranger : course uniquement.** Ponts et week-ends prolongés à saisir. |

## Ce qui reste

**Phase 0**
- [ ] Brancher le dépôt GitHub sur Netlify et tester l’installation sur ton téléphone.
- Vérifié dans Chromium en émulation Pixel 7 : création en 2 taps, report en 2 taps, échange, annulation, fait, persistance au rechargement, hors ligne, export puis import dans un navigateur vierge.

**Phase 1, plan initial** : disponibilités (semaine type, jours Paris, exceptions dont congés et voyage « course uniquement »), jalons, macro-phases jusqu’au 10 avril (en tenant compte de l’absence de vélo du 6 au 20 février), générateur de semaine respectant les règles 4 à 8 (lever et coucher du soleil calculés localement), contenu détaillé (enchaînements, bikepacking, variante home-trainer des séances clés), export Rouvy.

**Phase 2** : import FIT/GPX, rapprochement prévu/réalisé, synchronisation Strava (scope `activity:read_all`).
**Phase 3** : rythme réel, recommandations chiffrées, bascule course/natation selon Open-Meteo, alertes home-trainer.
**Phase 4** : notification du dimanche (fonction planifiée Netlify + Web Push ; le bilan est calculé sur le téléphone).

Note : `npm audit` signale des vulnérabilités modérées dans `workbox-build` (outil de build du service worker, non embarqué dans l’appli).
