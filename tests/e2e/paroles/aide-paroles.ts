// Aides communes aux specs du module « paroles » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// L'onglet « Paroles » de la barre du haut affiche, dans une `<iframe>` (région « Paroles du morceau »), la page `paroles.html` : une carte par partie
// du morceau avec ses accords (les « pastilles de la réserve », boutons « C », « Am »…), une zone de texte éditable (les paroles) et, au-dessus du texte,
// les accords POSÉS (les « pastilles » : `Am×`). On arme un accord en cliquant sa pastille de réserve, puis on clique dans le texte pour le poser ;
// deux modes : « Syllabe » (la pastille s'accroche au caractère le plus proche) et « Libre » (position horizontale libre, hauteur = celle de la ligne).
// Rien dans cette page n'a de rôle ni de `data-testid` : zone de texte = `.lyrics-text`, pastille posée = `.lyric-pill`, croix = `.pill-del`,
// carte de partie = `.section-block` (à proposer en `data-testid`, voir le rapport).
import { expect } from '../support/fixtures';
import type { Page, Locator, FrameLocator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import type { Accord } from '../support/appli';
import { reglagesMorceau, estMobile, C_AM_F_G } from '../grille/aide-grille';

export { C_AM_F_G, estMobile, reglagesMorceau, caseN, saisirAjoutRapide, repondreAuxConfirmations, selectionner, cliquerPlusAvant } from '../grille/aide-grille';
export { telecharger } from '../fichiers/aide-fichiers';

export const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());

// Deux parties : « Couplet » (C, Am, F, G = 4 mesures) et « Refrain » (F, G = 2 mesures). Nom sans accent : Chromium ne rend pas le nom accentué
// d'un téléchargement (limite du navigateur de test, voir le module « fichiers »).
export const COUPLET: Accord[] = C_AM_F_G;
export const REFRAIN: Accord[] = [{ root: 'F', quality: '' }, { root: 'G', quality: '' }];
export const UNE_PARTIE = [{ titre: 'Couplet', accords: COUPLET }];
export const DEUX_PARTIES = [{ titre: 'Couplet', accords: COUPLET }, { titre: 'Refrain', accords: REFRAIN }];
export const morceauParoles = (parties = UNE_PARTIE, nom = 'Demo') => ({ reglages: reglagesMorceau(parties, nom) });

// ── L'onglet et son cadre ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ongletParoles = (page: Page): Locator => page.getByRole('button', { name: 'Ouvrir dans Paroles' });
export const ongletGrille = (page: Page): Locator => page.getByRole('button', { name: 'Grille', exact: true });
export const regionParoles = (page: Page): Locator => page.getByRole('region', { name: 'Paroles du morceau' });
export const cadre = (page: Page): FrameLocator => regionParoles(page).frameLocator('iframe');

export async function ouvrirParoles(page: Page): Promise<FrameLocator> {
  await appuyer(page, ongletParoles(page));
  await expect(regionParoles(page)).toBeVisible();
  await expect(cadre(page).locator('.chord-chip').first()).toBeVisible();
  return cadre(page);
}
export async function retourGrille(page: Page) {
  await appuyer(page, ongletGrille(page));
  await expect(regionParoles(page)).toBeHidden();
}

// ── Ce qu'on voit dans la page des paroles ────────────────────────────────────────────────────────────────────────────────────────────────
export const cartes = (page: Page): Locator => cadre(page).locator('.section-block');
export const carte = (page: Page, partie = 0): Locator => cartes(page).nth(partie);
export const zoneTexte = (page: Page, partie = 0): Locator => carte(page, partie).locator('.lyrics-text');
export const reserve = (page: Page, partie = 0): Locator => carte(page, partie).locator('.chord-chip');
export const accordReserve = (page: Page, nom: string, partie = 0, rang = 0): Locator =>
  carte(page, partie).getByRole('button', { name: nom, exact: true }).nth(rang);
export const pastilles = (page: Page, partie?: number): Locator =>
  (partie === undefined ? cadre(page) : carte(page, partie)).locator('.lyric-pill');
export const croix = (p: Locator): Locator => p.locator('.pill-del');

export const modeSyllabe = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Syllabe', exact: true });
export const modeLibre = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Libre', exact: true });
export const boutonArreter = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Arrêter', exact: true });
export const boutonOptions = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Options', exact: true });
export const panneauOptions = (page: Page): Locator => cadre(page).locator('#options-panel');
export const caseEnchainer = (page: Page): Locator => cadre(page).getByRole('checkbox', { name: /^Enchaîner les accords/ });
export const curseurTaille = (page: Page): Locator => cadre(page).getByRole('slider', { name: /^Taille du texte/ });
export const boutonReinit = (page: Page, partie = 0): Locator => carte(page, partie).getByRole('button', { name: 'Réinitialiser' });
export const repMoins = (page: Page, partie = 0): Locator => carte(page, partie).getByRole('button', { name: 'Une répétition de moins' });
export const repPlus = (page: Page, partie = 0): Locator => carte(page, partie).getByRole('button', { name: 'Une répétition de plus' });
export const repAffichee = (page: Page, partie = 0): Locator => carte(page, partie).getByText(/^× \d+$/);
export const boutonTexte = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Exporter en texte' });
export const boutonCopier = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Copier le texte dans le presse-papiers' });
export const boutonPdf = (page: Page): Locator => cadre(page).getByRole('button', { name: 'Enregistrer en PDF' });
export const voyantEnregistre = (page: Page): Locator => cadre(page).getByText(/^(Enregistré|Enregistrement|Modifié)/).first();
// Annuler / Rétablir : ceux de la barre du haut de l'appli (les boutons de la page des paroles, eux, sont masqués dans l'onglet).
export const annuler = (page: Page): Locator => page.getByRole('button', { name: 'Annuler', exact: true });
export const retablir = (page: Page): Locator => page.getByRole('button', { name: 'Rétablir', exact: true });

// Noms des accords posés (sans la croix), dans l'ordre du document.
export const nomsPastilles = async (page: Page, partie?: number): Promise<string[]> =>
  pastilles(page, partie).evaluateAll(es => es.map(e => (e.childNodes[0].textContent || '').trim()));

// ── Écrire ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Met le curseur dans la zone de texte d'une partie. Sous Firefox, le PREMIER clic dans l'iframe ne fait qu'activer le cadre (évènements de souris
// livrés, mais la zone ne prend pas le focus) ; reproduit sur une page témoin sans l'appli (un bouton du parent déjà actif, un `contenteditable` dans
// une `iframe`), donc propre à ce navigateur de test et non à l'appli : on clique jusqu'à ce que la zone soit réellement active, ce qu'un utilisateur fait
// d'instinct. L'attente porte sur l'état (focus), jamais sur une durée.
export async function focaliser(page: Page, partie: number) {
  const zone = zoneTexte(page, partie);
  await expect(async () => {
    await appuyer(page, zone);
    await expect(zone).toBeFocused({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
}
// Clique dans la zone de texte d'une partie (au doigt sur téléphone) puis tape. Entrée = nouvelle ligne.
export async function ecrire(page: Page, partie: number, texte: string) {
  await focaliser(page, partie);
  const lignes = texte.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    if (i > 0) await page.keyboard.press('Enter');
    if (lignes[i]) await page.keyboard.type(lignes[i]);
  }
}
export const texteSaisi = (page: Page, partie = 0): Promise<string> => zoneTexte(page, partie).innerText();

// ── Poser un accord : cliquer sa pastille de réserve (arme), puis la zone de texte à une fraction (fx, fy) de sa taille ────────────────────
export async function armer(page: Page, nom: string, partie = 0, rang = 0) {
  await appuyer(page, accordReserve(page, nom, partie, rang));
  await expect(accordReserve(page, nom, partie, rang)).toHaveClass(/\barmed\b/);
}
// Clique (souris) ou touche (téléphone) un point de la page.
export const viser = (page: Page, x: number, y: number) => (estMobile(page) ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

// Pose l'accord armé en mode « Syllabe » : à la fraction `fx` de la LARGEUR DU TEXTE de la ligne (un clic au-delà de la fin du texte s'accroche au dernier
// caractère : on vise donc dans le texte), au milieu de la hauteur de la ligne `ligne`.
export async function poser(page: Page, partie: number, fx: number, ligne = 0) {
  await zoneTexte(page, partie).scrollIntoViewIfNeeded();   // les coordonnées absolues ne font pas défiler la page toutes seules
  const l = await rectLigne(page, partie, ligne);
  await viser(page, l.x + l.width * fx, l.y + l.height / 2);
}
// Pose en mode « Libre » : à la fraction `fx` de la LARGEUR DE LA ZONE (la position est enregistrée en % de cette largeur), sur la ligne `ligne`.
export async function poserLibre(page: Page, partie: number, fx: number, ligne = 0) {
  await zoneTexte(page, partie).scrollIntoViewIfNeeded();
  const zone = (await zoneTexte(page, partie).boundingBox())!, l = await rectLigne(page, partie, ligne);
  await viser(page, zone.x + zone.width * fx, l.y + l.height / 2);
}
export async function poserAccord(page: Page, nom: string, partie: number, fx: number, ligne = 0) {
  await armer(page, nom, partie);
  await poser(page, partie, fx, ligne);
}

// ── Ce que l'appli a enregistré (clé propre au morceau) ───────────────────────────────────────────────────────────────────────────────────
export type Placement = { id: string; type: 'char' | 'free'; chordIndex: number; charIndex?: number; lineIndex?: number; xPct?: number };
export type PartieStockee = { lyricsHtml: string; placements: Placement[]; repeatCount: number };
export const parolesStockees = (page: Page): Promise<{ songName: string; sections: PartieStockee[] } | null> =>
  page.evaluate(() => { const v = localStorage.getItem('harmohub_lyrics_v1_id-' + localStorage.getItem('harmohubCurrentSongId')); return v ? JSON.parse(v) : null; });
// L'enregistrement est différé de quelques centaines de millisecondes : on attend l'état, jamais une durée.
export async function attendreStockage<T>(page: Page, lire: (p: { songName: string; sections: PartieStockee[] }) => T, attendu: T) {
  await expect.poll(async () => { const p = await parolesStockees(page); return p ? lire(p) : undefined; }, { timeout: 10_000 }).toEqual(attendu);
}
// HTML d'une zone → lignes de texte. Entrée donne `Un<div>Deux</div>` sous Chromium et WebKit, `<div>Un</div><div>Deux</div>` sous Firefox : on ignore ce détail de structure.
export const sansTags = (html: string) => html.replace(/<div>/g, '\n').replace(/<\/div>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/&nbsp;/g, ' ').replace(/^\n/, '');

// Rectangle (dans la page) du TEXTE de la n-ième ligne d'une zone : la 1ʳᵉ ligne est un nœud texte, les suivantes des `<div>` (Entrée).
export async function rectLigne(page: Page, partie: number, n: number): Promise<{ x: number; y: number; width: number; height: number; bas: number }> {
  const r = await zoneTexte(page, partie).evaluate((e, i) => {
    // une ligne = un nœud texte non vide ou un `<div>` (la 1ʳᵉ ligne est un nœud texte sous Chromium / WebKit, un `<div>` sous Firefox)
    const cible = [...e.childNodes].filter(x => x.nodeType === 1 || (x.nodeType === 3 && (x.textContent || '').trim() !== ''))[i];
    const range = e.ownerDocument.createRange();
    range.selectNodeContents(cible);
    const b = range.getBoundingClientRect(), premiere = range.getClientRects()[0] ?? b;   // 1ʳᵉ ligne VISUELLE si le texte passe à la ligne
    return { x: b.x, y: premiere.y, width: b.width, height: premiere.height };
  }, n);
  // Les coordonnées sont celles de l'iframe : on ajoute la position de l'iframe dans la page pour comparer avec `boundingBox()` (page entière).
  const cadreBox = (await regionParoles(page).locator('iframe').boundingBox())!;
  return { x: r.x + cadreBox.x, y: r.y + cadreBox.y, width: r.width, height: r.height, bas: r.y + cadreBox.y + r.height };
}

// L'invite « Clique ici pour écrire les paroles de cette partie… » d'une zone vide est dessinée en CSS (pseudo-élément) : on lit son contenu calculé.
export const invite = (page: Page, partie = 0): Promise<string> =>
  zoneTexte(page, partie).evaluate(e => { const c = getComputedStyle(e, '::before').content; return c === 'none' || c === 'normal' ? '' : c.replace(/^"|"$/g, ''); });

// Morceau sans nom : l'onglet ne montre pas la page des paroles mais une invite et ce bouton (dans l'appli, hors de l'iframe).
export const nommer = (page: Page): Locator => page.getByRole('button', { name: 'Nommer le morceau' });
