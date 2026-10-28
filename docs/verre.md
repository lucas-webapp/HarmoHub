# L'effet « verre dépoli » — HarmoHub, TabHub (et TrainHub, qui l'a inventé)

Retour utilisateur : *« un affichage de type verre comme sur TrainHub, il est très joli, je veux le retrouver sur toutes les
applis. Il doit rester gérable en paramètres. »*

C'est une **option par appareil**, éteinte par défaut : fond « aurore » (ou une seule teinte parmi sept), surfaces translucides
qui floutent ce qu'elles recouvrent, reflet clair sur le bord haut des boutons. Elle se manie dans
**Paramètres > Apparence** (HarmoHub) / **Réglages > Apparence** (TabHub) : un interrupteur, et sept pastilles de couleur.
TrainHub l'a déjà (ses réglages à lui, son CSS à lui) ; il n'a pas été touché.

## Les quatre fichiers

| Fichier | Rôle | Partagé ? |
|---|---|---|
| `verre.js` | Retient les deux réglages (allumé ? quelle couleur ?) dans `localStorage`, pose `data-glass` / `data-glass-bg` sur `<html>` **avant le premier affichage**, prévient l'interface (`window.Verre`) | **identique** dans HarmoHub et TabHub |
| `verre.css` | Palette en translucide, sept fonds, UNE variable de flou (`--glass-filter`), replis opaques, et le dessin du réglage (interrupteur, pastilles) | **identique** |
| `verre-surfaces.css` | Quelles surfaces floutent, quels contrôles deviennent translucides, ce qui reste opaque | propre à chaque appli |
| `tests/_verre_commun.js` | Outils des bancs (signature de rendu, contrastes, enregistreur d'attribut) | **identique** |

**Règle de maintenance : ces trois fichiers communs se corrigent à un seul endroit puis se recopient à l'autre.** Aucun banc
ne compare les deux dépôts : une dérive silencieuse est possible, d'où cette consigne (`cmp` entre les deux avant de livrer).

## Comment ça tient

- **Éteint, rien ne change.** Éteint = *aucun* attribut `data-glass` sur `<html>`, et chaque règle de `verre.css` /
  `verre-surfaces.css` commence par `html[data-glass="1"]` (sauf le dessin du réglage lui-même, qui doit se voir éteint puisque
  c'est là qu'on l'allume). Un banc le prouve en comparant le rendu calculé de chaque élément, `verre.css` retiré de la page
  contre chargé-mais-éteint.
- **Posé avant le premier affichage.** `verre.js` est un script classique, sans `defer`, dans le `<head>` : l'attribut existe avant
  que `<body>` n'existe. Sinon l'appli paraîtrait un instant sans verre, puis serait repeinte.
- **Une clé par appli.** `harmohub.glass.v1` / `harmohub.glassBg.v1`, `tabhub.glass.v1` / `tabhub.glassBg.v1` : les applis qui
  partagent une origine ne partagent pas leurs réglages. Allumé seulement par un « 1 » explicite ; une couleur inconnue retombe
  sur « aurora » ; un stockage qui plante (navigation privée) ne casse rien.
- **Le réglage suit ailleurs.** Un autre onglet de l'appareil qui change le réglage (évènement `storage`) l'applique ici, et la
  fenêtre de réglage redonne l'état vrai. Les abonnements de la fenêtre se libèrent (`surChangement` rend une fonction de
  désabonnement) : rouvrir dix fois la fenêtre n'empile rien.
- **Le flou ne va que sur les grandes surfaces** (barres, fenêtres, menus, cartes), jamais sur chaque bouton — un flou par
  case ou par bouton fait ramer les téléphones modestes. Il passe toujours par `var(--glass-filter)` : le repli
  (`@supports not (backdrop-filter…)`, `prefers-reduced-transparency`) met cette variable à `none` et rend les fonds opaques, en
  un seul endroit. Un flou écrit en dur échapperait au repli : le banc le refuse.
- **Les listes déroulantes restent opaques** (une liste translucide se lit mal), et les menus ont une sous-couche sombre
  (`--glass-pop-fond`) pour ne pas grisonner sur du clair.

## Ce que le verre ne touche pas

- **Le papier de TabHub** (`.feuille`) reste clair, avec son bord et son ombre : on lit une tablature comme du papier. Le verre
  habille ce qui l'entoure.
- **La feuille de structure de HarmoHub** (aperçu et PDF) : du papier blanc aux couleurs écrites en dur, qui ne bouge pas d'un pixel
  (le banc compare ses 40 éléments, verre allumé contre éteint).

## Pièges rencontrés (et ce que le banc en a gardé)

1. **Le gris sous les dégradés.** Un bouton qui ne pose qu'un `background-image` laisse le navigateur fournir la couleur de
   dessous. Les dégradés opaques la cachaient ; les translucides la laissent voir : pastilles *blanches* au texte clair sur la
   page Paroles, sans une seule erreur. Réglé par `:where(html[data-glass="1"]) :where(button) { background-color: transparent }`
   (spécificité nulle : toute règle de l'appli qui pose son propre fond l'emporte) et `color-scheme: dark`.
2. **La règle générique `button`.** HarmoHub donne `min-width: 120px` et un grand padding à tout `button` : les pastilles de
   couleur sortaient en ovales de 120 px. `min-width: 0; padding: 0` sur `.verre-fond`.
3. **Le fond des champs.** Une règle générique sur `input` peignait des plaques sombres derrière les titres de programme ; seuls
   les champs nommés prennent le creux.
4. **`.top-bar` sur ordinateur** n'est pas une barre mais un conteneur de pastilles flottantes : le flou n'y va que sous 900 px.
5. **Texte devenu illisible.** Aucune règle ne dit « le texte est lisible » ; le banc le MESURE (contraste texte/fond effectif, en
   empilant les fonds des ancêtres), verre éteint puis allumé : tout nouveau contraste < 3:1 est une régression du verre.
6. **Pastilles trop petites au doigt.** 28 px à la souris, 40 px sur écran tactile, sur leur propre ligne sous le libellé.

## Bancs

| Banc | Dépôt | Contrôles |
|---|---|---|
| `tests/verre_module_test.js` | HarmoHub | 25 — le module sans navigateur (défaut éteint, valeurs illisibles, deux applis/une origine, stockage qui plante, abonnés) |
| `tests/verre_test.js` | HarmoHub | 64 (63 dans une version sans aperçu de structure) — fichiers et ordre de chargement, attribut avant le premier affichage, éteint = rendu d'avant (accueil, Paramètres, menu, confirmation, séquenceur, aperçu de structure), flou aux bons endroits, repli, contrastes, boutons sans tuile pleine, Paroles, réglage, téléphone |
| `tests/verre_test.js` | TabHub | 54 — idem, plus le papier qui reste clair |

Chaque banc a été éprouvé par des sabotages (une ligne de source cassée, le banc doit rougir) ; voir `docs/dette-tests.md`.

## Ce qui n'est PAS vérifié

- Un vrai Safari / iPhone : `backdrop-filter` y a des préfixes et des limites (les surfaces écrivent les deux formes), mais le
  rendu n'a été vu que dans Chromium.
- La **performance** du flou sur un vieux téléphone. Le flou est limité aux grandes surfaces, et « moins de transparence »
  le coupe, mais rien n'a été mesuré sur un appareil réel.
