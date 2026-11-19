// Aides communes aux specs du module « parametres » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// La fenêtre « Paramètres » (bouton en forme de roue, barre du haut) réunit cinq sections : Son, Affichage, Apparence, Historique et récupération, À propos.
// Deux sections portent un volet « Options avancées » replié (une ligne « Son du métronome » / « Écouter en éditant » dans Son ; « Fonction harmonique » /
// « Repères de temps » dans Affichage). Ce sont des réglages de L'APPAREIL (stockage local), jamais du morceau : en changer ne rend pas le morceau « non enregistré ».
// L'historique des versions (Restaurer, Vider) est éprouvé par le module `synchro` ; ici on n'en parle pas.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, cases, noms, estMobile, reglagesMorceau } from '../grille/aide-grille';

// Un geste « comme l'utilisateur » : un clic à l'ordinateur, un toucher au téléphone.
export const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());

export const boutonParametres = (page: Page): Locator => page.locator('#open-settings');   // « Paramètres » (roue de la barre du haut)
export const fenetre = (page: Page): Locator => page.getByRole('dialog', { name: 'Paramètres' });

export async function ouvrir(page: Page): Promise<Locator> {
  await appuyer(page, boutonParametres(page));
  await expect(fenetre(page)).toBeVisible();
  return fenetre(page);
}
export async function fermer(page: Page) {
  await page.keyboard.press('Escape');
  await expect(fenetre(page)).toBeHidden();
}
// Les deux volets « Options avancées » se déplient d'un clic sur leur titre (ils sont repliés à chaque ouverture de l'appli).
export async function deplierAvancees(page: Page) {
  const volets = fenetre(page).locator('details.settings-advanced');
  const n = await volets.count();
  for (let i = 0; i < n; i++) {
    if (!(await volets.nth(i).evaluate((d: HTMLDetailsElement) => d.open))) await appuyer(page, volets.nth(i).locator('summary'));
    await expect(volets.nth(i)).toHaveJSProperty('open', true);
  }
}

// ---------- les commandes (noms accessibles, en français) ----------
export const interrupteur = (page: Page, nom: string): Locator => fenetre(page).getByRole('switch', { name: nom });
export const curseur = (page: Page, nom: string): Locator => fenetre(page).getByRole('slider', { name: nom });
export const liste = (page: Page, nom: string): Locator => fenetre(page).getByRole('combobox', { name: nom });
export const choix = (page: Page, groupe: string, valeur: string): Locator => fenetre(page).getByRole('radiogroup', { name: groupe }).getByRole('radio', { name: valeur, exact: true });

export const NOM = {
  sonDeplacement: 'Entendre les notes en déplaçant une note du séquenceur',
  jouerSelection: 'Jouer l\'accord en le sélectionnant dans la grille',
  decompte: 'Clics du décompte avant la lecture de la grille',
  ecouterEnEditant: 'Faire entendre une note du séquenceur dès qu\'on la pose, la sélectionne ou la déplace',
  degres: 'Degrés au-dessus de chaque accord',
  nomsRythmes: 'Noms des rythmes dans la barre du séquenceur',
  dateModif: 'Date de dernière modification à côté du nom des morceaux',
  nomsManche: 'Noms des notes sur le manche vide de dessin',
  fonction: 'Fonction harmonique au-dessus de chaque accord',
  verre: 'Verre dépoli',
};
// L'intitulé du réglage d'ouverture « Écouter en éditant » est plus long que son nom ; on le retrouve par son identifiant stable.
export const ecouterEnEditant = (page: Page): Locator => page.locator('#toggle-seq-edit-audio');
export const sonMetronome = (page: Page): Locator => page.locator('#metronome-sound');
export const reperesDeTemps = (page: Page): Locator => page.locator('#grid-beat-marks');

export const estCoche = (l: Locator) => l.getAttribute('aria-checked');

// ---------- relire l'état (l'appli est la source de vérité ; jamais utilisé pour DÉCLENCHER quelque chose) ----------
export const lireStockage = (page: Page, cle: string): Promise<string | null> => page.evaluate((c) => localStorage.getItem(c), cle);
export const lireEtat = <T = any>(page: Page, propriete: string): Promise<T> => page.evaluate((p) => (window as any).app[p], propriete);
// Volume du bus de sortie (Tone.js) : 0 dB à 100 %, coupé (muet) à 0 %.
export const sortie = (page: Page): Promise<{ db: number | null; muet: boolean }> => page.evaluate(() => {
  const d = (window as any).Tone.getDestination();
  return { db: d.volume.value as number | null, muet: !!d.mute };
});
// Tous les réglages de l'appareil dans le stockage local (clés « harmohub… »), sans les traces de la synchro.
export const reglagesStockes = (page: Page): Promise<Record<string, string>> => page.evaluate(() => {
  const r: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (/^harmohub/.test(k) && !/^harmohub_sync_|^harmohubSongs$|^harmohubCurrentSongId$|^harmohubVersions|^harmohubBarreLectureOrdre$|^harmohubGrilleDensite$|ZoomLevel/.test(k)) r[k] = localStorage.getItem(k)!;
  }
  return r;
});

// ---------- ce que la grille et les diagrammes disent (observé comme l'utilisateur) ----------
export const degresAffiches = (page: Page): Promise<string[]> =>
  page.locator('#progression-sections .row-roman').allTextContents().then(l => l.map(t => t.trim()));
export const fonctionsAffichees = (page: Page): Promise<string[]> =>
  page.locator('#progression-sections .row-function').allTextContents().then(l => l.map(t => t.trim()));
export const reperesAffiches = (page: Page): Promise<number> => page.locator('#progression-sections .row-offbeat').count();
// La mention sous chaque accord : « O3 », « O3-R1 », ou rien.
export const mentions = (page: Page): Promise<string[]> =>
  page.locator('#progression-sections .grid-cell[data-index] .cell-meta').allTextContents().then(l => l.map(t => t.trim()));
