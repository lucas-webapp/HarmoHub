// Aides communes aux specs du module « sequenceur » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Le séquenceur est une grille « notes × croches » : une colonne par accord de la ligne affichée, huit croches par colonne (une mesure à 4 temps),
// une ligne par note de l'accord (vue « Accord ») ou une ligne par hauteur (vue « Piano »). Le son est factice dans la VM : on vérifie l'ÉTAT.
//
// CASES : ce sont des `gridcell` nommés « E4, croche 3 : vide » (états : vide, normal, fort, doux). Dans une vue Accord, plusieurs colonnes
// portent la même note (C4 sous deux accords) : on cible donc la case par ses attributs `data-c` (colonne = accord), `data-v` (voix, 0 = grave)
// et `data-k` (croche, de 0 à 7). Ces trois attributs sont stables mais ne sont pas des `data-testid` : à proposer (voir le rapport).
// Sur ordinateur, la grille montre tous les accords de la ligne ; au téléphone, la feuille d'accord n'en montre qu'un (mais `data-c` reste le rang de l'accord).
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { estMobile } from '../grille/aide-grille';
import { fenetre, choisirOnglet } from '../accord/aide-accord';

export { C_AM_F_G, estMobile, reglagesMorceau, caseN } from '../grille/aide-grille';
export { fenetre, ouvrirFenetre, choisirOnglet, accordStocke, attendreAccord } from '../accord/aide-accord';

export const sequenceur = (page: Page): Locator => page.locator('#sequenceur');
export const grille = (page: Page): Locator => page.locator('#sq-grille');

// La barre d'outils du séquenceur. Les cinq rythmes prédéfinis sont des boutons à bascule (aria-pressed) dont l'`id` est stable.
export const RYTHMES: [string, string][] = [['Plaqué', 'plaque'], ['Arpège ↑', 'monte'], ['Arpège ↓', 'descend'], ['Pompe', 'pompe'], ['Ballade', 'ballade']];
export const bouton = (page: Page, nom: string): Locator => sequenceur(page).getByRole('button', { name: nom, exact: true });
export const rythme = (page: Page, id: string): Locator => page.locator(`#sq-motif-${id}`);
export const boutonLibre = (page: Page): Locator => page.locator('#sq-motif-main');   // le « + » : rythme libre
export const boutonIntensite = (page: Page): Locator => page.locator('#sq-intensite');
export const boutonCopier = (page: Page): Locator => page.locator('#sq-copier');
export const boutonColler = (page: Page): Locator => page.locator('#sq-coller');
export const boutonEffacer = (page: Page): Locator => page.locator('#sq-effacer');
export const vueAccord = (page: Page): Locator => page.locator('#sq-vue-voix');
export const vuePiano = (page: Page): Locator => page.locator('#sq-vue-notes');
export const poignee = (page: Page): Locator => page.locator('#sq-poignee');

// Ouvre le séquenceur comme l'utilisateur. Ordinateur : le bouton « Séquenceur » de la barre d'outils. Téléphone : le bouton « … » de la barre de
// lecture ouvre le panneau « Lecture », dont le bouton « Séquenceur » ouvre la feuille d'accord sur son onglet « Rythme » (le séquenceur y vit).
export async function ouvrirSequenceur(page: Page) {
  if (estMobile(page)) {
    await page.locator('#bl-plus').tap();
    const panneau = page.getByRole('dialog', { name: 'Lecture', exact: true });
    await expect(panneau).toBeVisible();
    await panneau.getByRole('button', { name: 'Séquenceur', exact: true }).tap();
    await expect(fenetre(page)).toBeVisible();
  } else {
    await page.locator('#vue-sequenceur').click();
    await expect(page.locator('#vue-sequenceur')).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(sequenceur(page)).toBeVisible();
  await expect(grille(page)).toBeVisible();
}

// Choisit l'accord n (celui que la barre d'outils modifie). Ordinateur : un clic sur son nom, en tête de colonne. Téléphone : les flèches de la
// feuille d'accord (on part de l'accord 0).
export async function choisirAccord(page: Page, n: number) {
  if (estMobile(page)) {
    const f = fenetre(page);
    for (let i = 0; i < n; i++) await f.getByRole('button', { name: 'Accord suivant' }).tap();
    return;
  }
  await grille(page).locator(`.sq-nom[data-c="${n}"]`).click();
  await expect(grille(page).locator(`.sq-nom[data-c="${n}"]`)).toHaveClass(/\bchoisi\b/);
}

// Ouvre le séquenceur sur l'accord n (le plus court pour la plupart des tests).
export async function ouvrirSurAccord(page: Page, n: number) {
  await ouvrirSequenceur(page);
  await choisirAccord(page, n);
}

// ── Les cases ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const cellule = (page: Page, c: number, v: number, k: number): Locator =>
  grille(page).locator(`.sq-case[data-c="${c}"][data-v="${v}"][data-k="${k}"]`);
// Vue Piano : la case se trouve par le nom de la note (« A3 ») et la croche (1 à 8) ; la colonne `c` désigne l'accord.
export const celluleNote = (page: Page, c: number, note: string, croche: number): Locator =>
  grille(page).locator(`.sq-case[data-c="${c}"][aria-label^="${note}, croche ${croche} :"]`);

export type Niveau = 'vide' | 'normal' | 'fort' | 'doux';
export async function niveau(cellule: Locator): Promise<Niveau> {
  const nom = (await cellule.getAttribute('aria-label')) ?? '';
  return nom.split(' : ').pop() as Niveau;
}
export async function attendreNiveau(cellule: Locator, attendu: Niveau) {
  await expect(cellule).toHaveAttribute('aria-label', new RegExp(`: ${attendu}$`));
}

// Les notes allumées de la colonne c, sous la forme « voix.croche:niveau » (vue Accord) ou « note.croche:niveau » (vue Piano), triées.
export async function notesAllumees(page: Page, c: number): Promise<string[]> {
  return grille(page).locator(`.sq-case.on[data-c="${c}"]`).evaluateAll(cases =>
    cases.map(e => {
      const el = e as HTMLElement;
      const m = (el.getAttribute('aria-label') ?? '').match(/^(.*), croche (\d+) : (.*)$/)!;
      return `${el.dataset.v ?? m[1]}.${Number(m[2]) - 1}:${m[3]}`;
    }).sort());
}
// Nombre de cases allumées de la colonne c.
export const nombreAllume = (page: Page, c: number): Promise<number> => grille(page).locator(`.sq-case.on[data-c="${c}"]`).count();
// Rangées (voix) qui portent au moins une note dans la colonne c, et croches occupées de chaque rangée : « v → [k, k, …] ».
export async function croches(page: Page, c: number, v: number): Promise<number[]> {
  return grille(page).locator(`.sq-case.on[data-c="${c}"][data-v="${v}"]`).evaluateAll(cases => cases.map(e => Number((e as HTMLElement).dataset.k)).sort((a, b) => a - b));
}

// Motif de l'accord tel que l'appli l'a enregistré (stockage local du morceau en cours) : `arpPattern` = 16 pas séparés par « ; » (« 0;0t » = voix 0 qui commence, « t » = tenue).
export const motifStocke = (page: Page, partie: number, n: number): Promise<{ motifSeq?: string; arpPattern?: string; seqEdited?: boolean; intensiteVoix?: Record<string, number>; extraNotes?: { note: string; octave: number }[] }> =>
  page.evaluate(([p, i]) => JSON.parse(localStorage.getItem('myProgression')!).sections[p].chords[i], [partie, n] as const);

// ── Les gestes à la souris ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function centre(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
// Glisse la souris du centre d'une case (ou d'une position) au centre d'une autre, comme l'utilisateur : appuyer, bouger par étapes, relâcher.
export async function glisser(page: Page, depuis: { x: number; y: number }, vers: { x: number; y: number }, etapes = 8) {
  await page.mouse.move(depuis.x, depuis.y);
  await page.mouse.down();
  await page.mouse.move(vers.x, vers.y, { steps: etapes });
  await page.mouse.up();
}
// La note qui COMMENCE dans la case (le `span.sq-note` y est posé) ; ses poignées d'étirement : « g » (gauche) et « d » (droite).
export const noteDe = (cellule: Locator): Locator => cellule.locator('.sq-note');
export const poigneeGauche = (cellule: Locator): Locator => noteDe(cellule).locator('.sq-bord.g');
export const poigneeDroite = (cellule: Locator): Locator => noteDe(cellule).locator('.sq-bord.d');

export async function etirerVers(page: Page, poigneeDeLaNote: Locator, cible: Locator) {
  const p = await centre(poigneeDeLaNote), c = await centre(cible);
  await glisser(page, p, { x: c.x, y: p.y });
}
export async function deplacerVers(page: Page, depuis: Locator, vers: Locator) {
  const a = await centre(depuis), b = await centre(vers);
  await glisser(page, a, b);
}

// Clic (ordinateur) ou toucher (téléphone) sur une case, comme l'utilisateur.
export async function toucher(page: Page, cellule: Locator) {
  if (estMobile(page)) await cellule.tap(); else await cellule.click();
}

// Choisit un onglet de la feuille d'accord (téléphone) : utilisé pour revenir sur « Rythme ».
export { choisirOnglet };
