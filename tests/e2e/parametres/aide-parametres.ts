// Aides communes aux specs du module « parametres » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// La fenêtre « Paramètres » (bouton en forme de roue, barre du haut) range ses réglages en quatre ONGLETS : Son, Affichage (avec l'Apparence), Historique, À propos.
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
// LES ONGLETS (26/11) : la fenêtre range ses réglages par catégorie, une à la fois (Son, Affichage, Historique, À propos). Un réglage n'est visible que dans son onglet ;
// `allerA` clique l'onglet (comme l'utilisateur) s'il n'est pas déjà affiché. « Apparence » (verre dépoli, couleur du fond) est dans « Affichage ».
export type Onglet = 'Son' | 'Affichage' | 'Historique' | 'À propos';
export const ongletReglages = (page: Page, nom: Onglet): Locator => fenetre(page).getByRole('tab', { name: nom, exact: true });
export async function allerA(page: Page, nom: Onglet) {
  const o = ongletReglages(page, nom);
  if ((await o.getAttribute('aria-selected')) !== 'true') await appuyer(page, o);
  await expect(o).toHaveAttribute('aria-selected', 'true');
}
export async function ouvrirSur(page: Page, nom: Onglet): Promise<Locator> {
  const f = await ouvrir(page);
  await allerA(page, nom);
  return f;
}
export async function fermer(page: Page) {
  await page.keyboard.press('Escape');
  await expect(fenetre(page)).toBeHidden();
}
// Le volet « Options avancées » de l'onglet AFFICHÉ se déplie d'un clic sur son titre (il est replié à chaque ouverture de l'appli) ; il y en a un dans Son et un dans
// Affichage : on appelle donc cette aide après `allerA`, pour chaque onglet dont on veut les réglages avancés.
export async function deplierAvancees(page: Page) {
  const volets = fenetre(page).locator('details.settings-advanced:visible');
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
