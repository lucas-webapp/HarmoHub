// Aides communes aux specs du module « voicing » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// « Voicing » = la CONDUITE DES VOIX : une fenêtre flottante (dialog « Conduite des voix ») ouverte par le bouton « Voicing » tout à droite de la barre
// de réglages (ordinateur et iPad seulement). Elle dessine, pour la partie ACTIVE, un piano-roll : une barre par note de chaque accord (une ligne par
// hauteur, une colonne par accord), la voix de même rang étant reliée d'un accord au suivant (trait plein = note tenue, pointillé = mouvement).
// Rien de tout cela n'a de rôle accessible (c'est du SVG) : on s'appuie sur les classes `vl-note` / `vl-tenue` / `vl-mouvement` et l'attribut
// `data-role` (root | third | fifth | seventh | ext). À proposer comme `data-testid` : voir le rapport.
//
// L'onglet « Voicing » de la fenêtre d'accord (octave, renversement, drop, basse) est un AUTRE écran, déjà couvert par `accord/onglet-voicing.spec.ts`.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import type { Accord } from '../support/appli';
import { reglagesMorceau, caseN, estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, noms, estMobile, reglagesMorceau, selectionner } from '../grille/aide-grille';
export { ouvrirFenetre, choisirOnglet, attendreAccord } from '../accord/aide-accord';

// Un morceau de quatre parties : « Couplet » (Cmaj7 deux fois, puis deux changements : voix tenues ET voix qui bougent), « Refrain » (trois accords),
// « Pont » (UN accord : rien à enchaîner) et « Long » (douze accords : le dessin déborde de la fenêtre et il faut défiler).
export const CMAJ7: Accord = { root: 'C', quality: 'maj7' };
export const COUPLET: Accord[] = [CMAJ7, CMAJ7, { root: 'F', quality: 'maj7' }, { root: 'G', quality: 'dom7' }];
export const REFRAIN: Accord[] = [{ root: 'F', quality: 'maj7' }, { root: 'G', quality: 'dom7' }, CMAJ7];
export const LONG: Accord[] = ['C', 'A', 'D', 'G', 'C', 'A', 'D', 'G', 'C', 'A', 'D', 'G'].map((root, i) => ({ root, quality: ['maj7', 'min7', 'min7', 'dom7'][i % 4] }));
export const PARTIES: { titre: string; accords: Accord[] }[] = [
  { titre: 'Couplet', accords: COUPLET }, { titre: 'Refrain', accords: REFRAIN }, { titre: 'Pont', accords: [{ root: 'A', quality: 'min7' }] }, { titre: 'Long', accords: LONG },
];
export const morceauQuatreParties = () => reglagesMorceau(PARTIES);

// ── La fenêtre ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const bouton = (page: Page): Locator => page.getByRole('button', { name: 'Conduite des voix' });
export const popover = (page: Page): Locator => page.getByRole('dialog', { name: 'Conduite des voix' });
export const dessin = (page: Page): Locator => popover(page).getByRole('img', { name: 'Conduite de voix' });
export const notes = (page: Page): Locator => dessin(page).locator('.vl-note');
export const tenues = (page: Page): Locator => dessin(page).locator('line.vl-tenue');
export const mouvements = (page: Page): Locator => dessin(page).locator('line.vl-mouvement');
export const titre = (page: Page): Locator => popover(page).getByTitle('Partie montrée');
export const defilante = (page: Page): Locator => popover(page).locator('.voice-leading-scroll');
export const touches = (page: Page): Locator => popover(page).locator('.voice-leading-keys');

export async function ouvrirVoicing(page: Page): Promise<Locator> {
  await bouton(page).click();
  await expect(popover(page)).toBeVisible();
  await expect(bouton(page)).toHaveAttribute('aria-expanded', 'true');
  return popover(page);
}
export async function attendreFermee(page: Page) {
  await expect(popover(page)).toBeHidden();
  await expect(bouton(page)).toHaveAttribute('aria-expanded', 'false');
}

// Les noms de notes écrits sur les barres, dans l'ordre du dessin (accord par accord, du grave à l'aigu) ; et les rôles (couleurs) dans le même ordre.
// Les textes du dessin sont de deux sortes : les en-têtes de colonne (en haut, y < 40 : nom de l'accord puis chiffre romain) et les noms de notes (dessous).
const textes = (page: Page, enTete: boolean): Promise<string[]> =>
  dessin(page).locator('text').evaluateAll((ts, entete) => ts.filter(t => (Number(t.getAttribute('y')) < 40) === entete).map(t => (t.textContent ?? '').trim()), enTete);
export const nomsDesNotes = (page: Page): Promise<string[]> => textes(page, false);
export const rolesDesNotes = (page: Page): Promise<string[]> => notes(page).evaluateAll(ns => ns.map(n => n.getAttribute('data-role') ?? ''));
// Les en-têtes de colonne : un nom d'accord (« Cmaj7 ») puis son chiffre romain (« I7 »), en alternance.
export const entetes = (page: Page): Promise<string[]> => textes(page, true);
// Hauteur (attribut `y`, en pixels du dessin : plus petit = plus aigu) de chaque barre, dans l'ordre du dessin.
export const hauteurs = (page: Page): Promise<number[]> => notes(page).evaluateAll(ns => ns.map(n => Number(n.getAttribute('y'))));

// Dimensions du dessin (la zone SVG qui défile) et de la fenêtre.
export async function taille(page: Page) {
  const b = (await dessin(page).boundingBox())!;
  return { largeur: b.width, hauteur: b.height };
}
export const reglageEchelle = (page: Page) => page.evaluate(() => [localStorage.getItem('harmohubVoiceLeadingZoomLevelX'), localStorage.getItem('harmohubVoiceLeadingZoomLevelY')]);

// Rendre une partie « active » : on sélectionne un de ses accords (la fenêtre, ouverte, couvre la grille : on la ferme d'abord, comme l'utilisateur).
// (G-01, corrigé le 24/11 : le premier clic sur une case d'une autre partie la sélectionne aussi sous Firefox ; plus de second clic.)
export async function activerPartie(page: Page, partie: number, n = 0) {
  if (await popover(page).isVisible()) { await page.keyboard.press('Escape'); await attendreFermee(page); }
  await caseN(page, partie, n).click();
  await expect(caseN(page, partie, n)).toHaveClass(/\bselected\b/);
}

export { estMobile as telephone };
