// Aides communes aux specs du module « diagrammes » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Les « diagrammes » = le clavier de piano et le manche de guitare qui montrent l'accord choisi dans la grille. À l'ordinateur ils sont dans un TIROIR épinglé
// au-dessus de la barre de lecture (ou détachés en fenêtre libre) ; au téléphone ils s'affichent au-dessus de la bande du bas (Clavier / Guitare).
// Le manche offre : des flèches pour changer de DOIGTÉ, un bouton « Voir tous les doigtés », un CADENAS qui fixe le doigté pour l'accord (et l'ajoute à
// « Mes doigtés », une bibliothèque personnelle synchronisée) et un crayon qui ouvre l'ÉDITION MANUELLE (dessiner sur le manche, ou taper un nom d'accord).
// Sélecteurs : rôles et noms accessibles d'abord ; les `id` ci-dessous sont ceux de l'appli (aucun `data-testid`), voir le rapport pour ce qui manque.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import type { Accord } from '../support/appli';
import { reglagesMorceau, caseN, estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, noms, estMobile, reglagesMorceau, cases } from '../grille/aide-grille';

// Choisir un accord (clic simple) et attendre que la sélection soit posée. (G-01, corrigé le 24/11 : le premier clic sur une case d'une autre partie la
// sélectionne aussi sous Firefox ; plus de second clic.)
export async function selectionner(page: Page, partie: number, n: number) {
  await caseN(page, partie, n).click();
  await expect(caseN(page, partie, n)).toHaveClass(/\bselected\b/);
  // Le tiroir suit la sélection avec un léger retard (sous Firefox jusqu'à ~1 s) : on attend qu'il montre l'accord de la case avant d'agir dessus.
  if (await tiroir(page).isVisible()) await expect(nomAccord(page)).toHaveText(((await caseN(page, partie, n).locator('.cell-sym').textContent()) || '').trim());
}

// Un morceau de départ : « Couplet » (Cmaj7, Am7, Dm7, G7) et « Refrain » (Fmaj7, Em7).
export const DO: Accord[] = [{ root: 'C', quality: 'maj7' }, { root: 'A', quality: 'min7' }, { root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }];
export const REFRAIN: Accord[] = [{ root: 'F', quality: 'maj7' }, { root: 'E', quality: 'min7' }];
export const morceauDeux = (): Record<string, string> => reglagesMorceau([{ titre: 'Couplet', accords: DO }, { titre: 'Refrain', accords: REFRAIN }]);
// Un morceau avec DEUX « Am7 » (partie différente) pour éprouver « Mes doigtés », partagés par nom d'accord.
export const morceauDeuxAm7 = (): Record<string, string> => reglagesMorceau([
  { titre: 'Couplet', accords: [{ root: 'A', quality: 'min7' }, { root: 'D', quality: 'min7' }] },
  { titre: 'Refrain', accords: [{ root: 'G', quality: 'dom7' }, { root: 'A', quality: 'min7' }] },
]);

// ── le tiroir (ordinateur) et ses boutons ───────────────────────────────────────────────────────────────────────────────────────────────────
export const tiroir = (page: Page): Locator => page.locator('#vues-tiroir');
export const boutonPiano = (page: Page): Locator => page.locator('#toggle-viz-piano');      // « Afficher le piano » (barre de lecture, bloc « Vues »)
export const boutonGuitare = (page: Page): Locator => page.locator('#toggle-viz-guitar');   // « Afficher la guitare »
export const fermer = (page: Page): Locator => page.getByRole('button', { name: 'Fermer le clavier et la guitare' });
export const reglagesDiagrammes = (page: Page): Locator => page.getByRole('button', { name: 'Réglages des diagrammes' });
export const detacher = (page: Page): Locator => page.locator('#vues-detacher');           // « Détacher en fenêtre libre » / « Épingler en bas de l'écran »
export const poignee = (page: Page): Locator => page.getByRole('separator', { name: 'Taille du clavier et de la guitare' });
export const coin = (page: Page): Locator => page.getByRole('button', { name: 'Redimensionner la fenêtre' });
export const barreTitre = (page: Page): Locator => page.locator('#vues-barre');
export const barreLecture = (page: Page): Locator => page.getByRole('toolbar', { name: 'Lecture' });

// ── piano ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const piano = (page: Page): Locator => page.locator('#piano-viz');
export const nomAccord = (page: Page): Locator => page.locator('#current-chord-display .chord-title');
export const notesAccord = (page: Page): Locator => page.locator('#current-chord-display .chord-note');
export const touchesJouees = (page: Page): Locator => page.locator('#piano-viz .key.active');
// Les touches blanches du clavier affiché, de la gauche vers la droite (la première est un do) : 0 = do, 1 = ré, 2 = mi, 3 = fa, 4 = sol, 5 = la, 6 = si, 7 = do…
export const toucheBlanche = (page: Page, rang: number): Locator => page.locator('#piano-viz .key.white').nth(rang);
// Le nom des notes jouées (classes `key active`, dans l'ordre du clavier), pris sur l'attribut accessible quand il existe, sinon sur le rôle.
export const rolesJoues = (page: Page): Promise<string[]> =>
  touchesJouees(page).evaluateAll(ts => ts.map(t => (/\brole-(\w+)/.exec(t.className)?.[1]) ?? ''));

// ── l'accord construit au clavier ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const constructionClavier = (page: Page): Locator => page.getByRole('group', { name: 'Accord construit au clavier' });
export const remplacer = (page: Page): Locator => page.locator('#kb-remplacer');
export const ajouter = (page: Page): Locator => page.locator('#kb-ajouter');
export const effacer = (page: Page): Locator => page.locator('#kb-effacer');

// ── guitare ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const guitare = (page: Page): Locator => page.locator('#guitar-viz');
export const precedent = (page: Page): Locator => page.locator('#guitar-prev');
export const suivant = (page: Page): Locator => page.locator('#guitar-next');
export const compteur = (page: Page): Locator => page.locator('#guitar-nav-label');         // « 2/4 » ; clic = « Voir tous les doigtés »
export const cadenas = (page: Page): Locator => page.locator('#guitar-lock-btn');
export const crayon = (page: Page): Locator => page.locator('#guitar-edit-btn');
export const substitut = (page: Page): Locator => page.locator('#guitar-override-row');      // la pastille de l'accord joué à la guitare quand il diffère de la grille
export const retirerSubstitut = (page: Page): Locator => page.locator('#guitar-override-clear');
export const listeDoigtes = (page: Page): Locator => page.getByRole('dialog', { name: 'Doigtés proposés' });
export const doigteDeLaListe = (page: Page, n: number): Locator => listeDoigtes(page).getByRole('button', { name: new RegExp(`^Doigté ${n} sur \\d+`) });
export const pastilleCase = (page: Page, partie: number, n: number): Locator => caseN(page, partie, n).locator('.cell-perso');   // le point orange « doigté fixé »

// Le doigté DESSINÉ, lu comme le voit l'utilisateur : les ronds posés sur le manche (centre, en unités du dessin) et les cordes étouffées (les « X » rouges).
// Les ronds de la pastille lumineuse (rayon 10 à 13) ne comptent pas : seuls les ronds pleins (remplis par un dégradé « gdot ») dessinent une note.
export type Doigte = { notes: string[]; etouffees: number };
export async function doigteDessine(zone: Locator): Promise<Doigte> {
  return zone.evaluate(el => {
    const svg = el.querySelector('svg');
    if (!svg) return { notes: [], etouffees: 0 };
    const notes = [...svg.querySelectorAll('circle')].filter(c => /^url\(#gdot/.test(c.getAttribute('fill') || '')).map(c => `${c.getAttribute('cx')},${c.getAttribute('cy')}`);
    const etouffees = [...svg.querySelectorAll('text')].filter(t => (t.textContent || '').trim() === 'X').length;
    return { notes, etouffees };
  });
}
export const doigteDuManche = (page: Page): Promise<Doigte> => doigteDessine(guitare(page));
// Une signature courte : de quoi dire « le doigté a changé ».
export const signature = async (page: Page): Promise<string> => { const d = await doigteDuManche(page); return d.notes.join('|') + '#' + d.etouffees; };

// « 2/4 » → { rang: 2, total: 4 }
export async function position(page: Page): Promise<{ rang: number; total: number }> {
  const t = ((await compteur(page).textContent()) || '').trim();
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (!m) throw new Error(`Compteur de doigtés illisible : « ${t} »`);
  return { rang: Number(m[1]), total: Number(m[2]) };
}

// ── l'édition manuelle ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const editeur = (page: Page): Locator => page.getByRole('dialog', { name: 'Édition manuelle — Guitare' });
export const ongletDessin = (page: Page): Locator => editeur(page).getByRole('tab', { name: 'Dessiner sur le manche' });
export const ongletNom = (page: Page): Locator => editeur(page).getByRole('tab', { name: 'Taper le nom' });
export const manche = (page: Page): Locator => page.locator('#guitar-edit-neck');
export const jouer = (page: Page): Locator => page.locator('#guitar-draw-play');
export const valider = (page: Page): Locator => page.locator('#guitar-draw-validate');
export const resultat = (page: Page): Locator => page.locator('#guitar-draw-result');
export const champNom = (page: Page): Locator => page.locator('#guitar-name-input');
export const validerNom = (page: Page): Locator => page.locator('#guitar-name-validate');
export const fermerEditeur = (page: Page): Locator => page.locator('#guitar-edit-close');

// Ouvre l'éditeur avec le crayon sous le manche (le tiroir ou la bande du téléphone doit montrer la guitare).
export async function ouvrirEditeur(page: Page): Promise<Locator> {
  await crayon(page).click();
  await expect(editeur(page)).toBeVisible();
  return editeur(page);
}

// Le manche COMPLET de l'éditeur (24 cases) est un SVG de 748 × 105 unités : cordes à y = 8 (corde 1, la plus fine, en haut) … 88 (corde 6, la plus grave, en bas),
// pas de 16 ; cases de 30 unités depuis le sillet (x = 20) ; la corde à vide se pose à gauche du sillet (x = 10). Aucun élément du dessin n'est une cible
// (le clic est reçu par le dessin entier) : on clique donc à la position calculée (`data-testid` manquant : voir le rapport).
export async function poserNote(page: Page, corde: number, frette: number, options: { button?: 'left' | 'right' } = {}) {
  const svg = manche(page).locator('svg');
  await expect(svg).toBeVisible();   // le dessin est refait à chaque changement d'onglet
  const b = (await svg.boundingBox())!;
  const vb = (await svg.evaluate(s => (s.getAttribute('viewBox') || '0 0 748 105').split(' ').map(Number))) as number[];
  const echelle = b.width / vb[2];
  const x = frette === 0 ? 10 : 20 + 30 * frette - 15;
  const y = 8 + 16 * (corde - 1);
  // au téléphone un doigt, pas une souris : un vrai toucher (le clic droit n'existe pas : « appui long » à la place, non couvert)
  if (estMobile(page) && !options.button) await page.touchscreen.tap(b.x + x * echelle, b.y + y * echelle);
  else await page.mouse.click(b.x + x * echelle, b.y + y * echelle, options);
}
// Poser tout un doigté : une liste de 6 valeurs (corde 6 d'abord, comme on lit un accord : null = étouffée, 0 = à vide, n = case n).
export async function poserDoigte(page: Page, cases: (number | null)[]) {
  for (let i = 0; i < 6; i++) {
    const frette = cases[i];
    if (frette === null) continue;
    await poserNote(page, 6 - i, frette);
  }
}
// Les notes posées sur le manche de l'éditeur : un rond plein (dégradé ou gris) par note, avec sa position.
export const rondsDuManche = (page: Page): Promise<string[]> =>
  manche(page).evaluate(el => [...el.querySelectorAll('svg circle')].filter(c => Number(c.getAttribute('r')) >= 7).map(c => `${c.getAttribute('cx')},${c.getAttribute('cy')}`));
export const candidats = (page: Page): Locator => resultat(page).locator('.guitar-draw-candidate');
export const envoyer = (page: Page): Locator => page.locator('#guitar-draw-send');          // « Ajouter X à la grille »
export const substituer = (page: Page): Locator => page.locator('#guitar-draw-lock');       // « Utiliser comme substitut guitare »

export const toast = (page: Page): Locator => page.locator('#toast, .toast').first();
export { estMobile as telephone };
