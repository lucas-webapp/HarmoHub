// Aides communes aux specs du module « accord » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { caseN, estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, cases, noms, estMobile, selectionner } from '../grille/aide-grille';

export type Onglet = 'Accord' | 'Voicing' | 'Rythme';

// La fenêtre d'accord : `#bulle-accord` à l'ordinateur, `#panneau-accord` (feuille du bas) au téléphone. Dans les deux cas c'est un `dialog`
// nommé « Accord <nom> » (la bibliothèque des rythmes, autre `dialog`, s'appelle « Tous les rythmes »).
export const fenetre = (page: Page): Locator => page.getByRole('dialog', { name: /^Accord / });

// Ouvre la fenêtre d'accord sur la case n de la partie p comme l'utilisateur : double-clic (ordinateur) ou double-tape (téléphone) sur la case.
export async function ouvrirFenetre(page: Page, partie: number, n: number): Promise<Locator> {
  const meta = caseN(page, partie, n).locator('.cell-meta');
  const f = fenetre(page);
  // Sous WebKit chargé (1 fois sur ~100), le double-clic n'est pas reconnu par l'appli : l'utilisateur recommencerait. On recommence donc, comme lui,
  // jusqu'à 3 fois ; si la fenêtre n'apparaît jamais, le test échoue sur le `toBeVisible` ci-dessous. Voir « instabilités » du rapport.
  const nom = new RegExp(`^Accord ${(await caseN(page, partie, n).locator('.cell-sym').innerText()).trim().replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`);
  for (let essai = 0; essai < 3; essai++) {
    if (estMobile(page)) { await meta.tap(); await meta.tap(); }
    else await meta.dblclick();
    // la fenêtre peut déjà être ouverte sur un autre accord : on attend qu'elle porte le nom de CETTE case
    if (await page.getByRole('dialog', { name: nom }).waitFor({ state: 'visible', timeout: 2_500 }).then(() => true, () => false)) break;
  }
  await expect(f).toBeVisible();
  // Au téléphone, l'appli ignore les touchers des ~300 ms qui suivent le double-tape (garde contre le « clic fantôme » : sans elle, le second
  // toucher retomberait sur le bouton qui apparaît sous le doigt). Un humain ne va pas aussi vite ; on attend donc la fin de cette garde, mesurée
  // sur l'horloge de la page (mesuré : 0 ms = ignoré, 300 ms = pris en compte).
  if (estMobile(page)) await page.evaluate(() => new Promise<void>(fin => { const t0 = performance.now(); const tic = () => performance.now() - t0 > 600 ? fin() : requestAnimationFrame(tic); tic(); }));
  return f;
}

// Les boutons de choix de la fenêtre ont des attributs `data-bulle` / `data-valeur` stables ; seule la rangée « Basse » répète les noms de la
// rangée « Fondamentale » (C, D…), d'où ces deux aides. `valeur` : « C# » pour do dièse, « » (vide) pour « — » (basse = fondamentale).
export const fondamentale = (f: Locator, valeur: string) => f.locator(`[data-bulle="root"][data-valeur="${valeur}"]`);
export const basse = (f: Locator, valeur: string) => f.locator(`[data-bulle="bass"][data-valeur="${valeur}"]`);

export async function choisirOnglet(f: Locator, onglet: Onglet) {
  await f.getByRole('button', { name: onglet, exact: true }).click();
  await expect(f.getByRole('button', { name: onglet, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

// L'accord tel que l'appli l'a enregistré (stockage local du morceau en cours) : la fenêtre écrit tout de suite.
export type AccordStocke = { root: string; quality: string; beats: number; inversion: number; drop: string; octave: number; bass: string | null; motifSeq?: string; arpPattern?: string };
export const accordStocke = (page: Page, partie: number, n: number): Promise<AccordStocke> =>
  page.evaluate(([p, i]) => JSON.parse(localStorage.getItem('myProgression')!).sections[p].chords[i], [partie, n] as const);
export async function attendreAccord(page: Page, partie: number, n: number, attendu: Partial<AccordStocke>) {
  await expect.poll(async () => {
    const a = await accordStocke(page, partie, n);
    // Le renversement posé depuis la fenêtre est enregistré en TEXTE ("1"), celui d'un morceau chargé en nombre (1) : on compare en nombre (voir A-03, bugs.md).
    return Object.fromEntries(Object.keys(attendu).map(k => [k, ['inversion', 'octave', 'beats'].includes(k) ? Number((a as any)[k]) : (a as any)[k]]));
  }).toEqual(attendu);
}
