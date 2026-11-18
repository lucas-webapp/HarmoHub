// MODULE « structure » — « Aperçu / PDF » : l'aperçu avant impression de la structure (une feuille dessinée dans la page), ses réglages (page, taille, contenu),
// leur mémoire, et les deux sorties : « Enregistrer en PDF » (fichier téléchargé) et « Imprimer ».
// La feuille est du HTML ordinaire (classes `sf-*`) : on lit son texte et ses dimensions ; le PDF est un vrai fichier dont on contrôle la validité, pas le rendu.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  morceauTroisParties, ouvrirStructure, ouvrirApercu, apercu, feuille, pagesApercu, etatApercu, caseApercu, fenetre, lire, plus, renommer, commenter,
  appuyer, telecharger, ajouterPartie,
} from './aide-structure';
import { tientDansL_ecran } from '../mobile/aide-mobile';

const texteFeuille = async (page: Page) => ((await feuille(page).innerText()).replace(/\s+/g, ' ').trim());
const reglage = (page: Page, nom: 'Format' | 'Orientation' | 'Colonnes') => apercu(page).getByRole('combobox', { name: nom });
const ratio = async (page: Page) => { const b = (await pagesApercu(page).first().boundingBox())!; return b.height / b.width; };
const estUnPdf = (c: Buffer) => c.subarray(0, 5).toString('latin1') === '%PDF-' && c.toString('latin1').trimEnd().endsWith('%%EOF');

test.describe('Aperçu avant impression @structure', () => {
  test('« Aperçu / PDF » ouvre l\'aperçu : titre, réglages et boutons de sortie @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(apercu(page).getByRole('heading', { name: 'Aperçu avant impression' })).toBeVisible();
    await expect(apercu(page).getByRole('button', { name: 'Fermer' })).toBeVisible();
    await expect(reglage(page, 'Format')).toHaveValue('a4');
    await expect(reglage(page, 'Orientation')).toHaveValue('portrait');
    await expect(reglage(page, 'Colonnes')).toHaveValue('1');
    await expect(apercu(page).getByRole('button', { name: 'Imprimer' })).toBeVisible();
    await expect(apercu(page).getByRole('button', { name: 'Enregistrer en PDF' })).toBeVisible();
    await expect(etatApercu(page)).toHaveText('1 page · taille 100 %');
    expect(garde.bloquees).toEqual([]);
  });

  test('la feuille reprend le morceau : titre, tonalité, tempo, mesures, déroulé, lignes avec repère de temps et accords @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    const f = feuille(page);
    await expect(f.getByRole('heading', { name: 'Démo' })).toBeVisible();
    await expect(f.locator('.sf-meta')).toHaveText(/^\s*C Majeur\s*·\s*4\/4\s*·\s*120 BPM\s*·\s*9 mesures\s*·\s*0 min 18 s\s*$/);
    await expect(f.locator('.sf-deroule .sf-puce')).toHaveText(['Couplet', 'Refrain', 'Pont']);
    await expect(f.locator('.sf-row .sf-nom')).toHaveText(['Couplet', 'Refrain', 'Pont']);
    await expect(f.locator('.sf-row .sf-etendue')).toHaveText(['à 0:00 · mes. 1–3 · 3 mes.', 'à 0:06 · mes. 4–7 · 4 mes.', 'à 0:14 · mes. 8–9 · 2 mes.']);
    await expect(f.locator('.sf-row .sf-grille')).toHaveText([/^\s*\|\s*C\s*\|\s*Am\s*\|\s*F G\s*\|\s*$/, /^\s*\|\s*F\s*\|\s*%\s*\|\s*C\s*\|\s*G\s*\|\s*$/, /^\s*\|\s*Dm\s*\|\s*G7\s*\|\s*$/]);
    await expect(f.locator('.sf-pied')).toHaveText(/^HARMOHUB · \d{1,2} \S+ \d{4}$/i);
  });

  test('l\'aperçu reflète la structure : ×N, nom d\'occurrence, commentaire, ordre @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await renommer(page, 1, 'Final');
    await commenter(page, 2, 'mes. 2 : tout le monde');
    await ouvrirApercu(page);
    const f = feuille(page);
    await expect(f.locator('.sf-deroule')).toContainText('Couplet ×2');
    await expect(f.locator('.sf-row .sf-nom')).toHaveText(['Couplet', 'Final', 'Pont']);
    await expect(f.locator('.sf-row').first().locator('.sf-rep')).toHaveText('×2');
    await expect(f.locator('.sf-row .sf-etendue').first()).toHaveText('à 0:00 · mes. 1–6 · 3 mes. × 2');
    await expect(f.locator('.sf-note-txt')).toHaveText('mes. 2 : tout le monde');
    await expect(f.locator('.sf-meta')).toContainText('12 mesures');
  });

  test('Fermer referme l\'aperçu, la fenêtre Structure reste ouverte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await appuyer(page, apercu(page).getByRole('button', { name: 'Fermer' }));
    await expect(apercu(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
  });

  test('Échap referme d\'abord l\'aperçu, puis la fenêtre Structure @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await page.keyboard.press('Escape');
    await expect(apercu(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
  });
});

test.describe('Contenu de la feuille @structure', () => {
  test('« Déroulé » retire ou remet la ligne de puces', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(caseApercu(page, 'Déroulé')).toBeChecked();
    await expect(feuille(page).locator('.sf-deroule')).toHaveCount(1);
    await caseApercu(page, 'Déroulé').uncheck();
    await expect(feuille(page).locator('.sf-deroule')).toHaveCount(0);
    await expect(feuille(page).locator('.sf-row')).toHaveCount(3);
    await caseApercu(page, 'Déroulé').check();
    await expect(feuille(page).locator('.sf-deroule')).toHaveCount(1);
  });

  test('« Tonalité, tempo, durée » retire ou remet la ligne de renseignements', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-meta')).toHaveCount(1);
    await caseApercu(page, 'Tonalité, tempo, durée').uncheck();
    await expect(feuille(page).locator('.sf-meta')).toHaveCount(0);
    expect(await texteFeuille(page)).not.toContain('120 BPM');
    await caseApercu(page, 'Tonalité, tempo, durée').check();
    await expect(feuille(page).locator('.sf-meta')).toHaveCount(1);
  });

  test('« Accords de chaque partie » retire ou remet les accords des lignes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-grille')).toHaveCount(3);
    await caseApercu(page, 'Accords de chaque partie').uncheck();
    await expect(feuille(page).locator('.sf-grille')).toHaveCount(0);
    await expect(feuille(page).locator('.sf-row')).toHaveCount(3);   // les lignes restent, sans leurs accords
    await caseApercu(page, 'Accords de chaque partie').check();
    await expect(feuille(page).locator('.sf-grille')).toHaveCount(3);
  });

  test('« Repère de temps » retire ou remet « à 0:06 » devant la position', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-row .sf-etendue').nth(1)).toHaveText('à 0:06 · mes. 4–7 · 4 mes.');
    await caseApercu(page, /^Repère de temps/).uncheck();
    await expect(feuille(page).locator('.sf-row .sf-etendue').nth(1)).toHaveText('mes. 4–7 · 4 mes.');
    await caseApercu(page, /^Repère de temps/).check();
    await expect(feuille(page).locator('.sf-row .sf-etendue').nth(1)).toHaveText('à 0:06 · mes. 4–7 · 4 mes.');
  });

  test('« Liste des accords utilisés » (décochée au départ) ajoute les accords distincts du morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(caseApercu(page, 'Liste des accords utilisés')).not.toBeChecked();
    expect(await texteFeuille(page)).not.toContain('ACCORDS');
    await caseApercu(page, 'Liste des accords utilisés').check();
    await expect.poll(() => texteFeuille(page)).toMatch(/ACCORDS C · Am · F · G · Dm · G7/i);
    await caseApercu(page, 'Liste des accords utilisés').uncheck();
    await expect.poll(() => texteFeuille(page)).not.toMatch(/ACCORDS/i);
  });

  test('« Commentaires » montre ou cache les commentaires des lignes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await commenter(page, 0, 'batterie seule');
    await ouvrirApercu(page);
    await expect(caseApercu(page, 'Commentaires')).toBeChecked();
    await expect(feuille(page)).toContainText('batterie seule');
    await caseApercu(page, 'Commentaires').uncheck();
    await expect(feuille(page)).not.toContainText('batterie seule');
    await caseApercu(page, 'Commentaires').check();
    await expect(feuille(page)).toContainText('batterie seule');
  });

  test('« Couleurs » colore ou grise les liserés des parties', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    const liserés = () => feuille(page).locator('.sf-row').evaluateAll(l => l.map(e => getComputedStyle(e).borderLeftColor));
    const colorees = await liserés();
    expect(new Set(colorees).size).toBe(3);     // une couleur par famille de parties
    await caseApercu(page, 'Couleurs').uncheck();
    await expect.poll(async () => new Set(await liserés()).size).toBe(1);
    await caseApercu(page, 'Couleurs').check();
    await expect.poll(async () => await liserés()).toEqual(colorees);
  });
});

test.describe('Mise en page @structure', () => {
  test('format et orientation changent les proportions de la page : A4 / Lettre, portrait / paysage @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect.poll(() => ratio(page)).toBeCloseTo(297 / 210, 2);                  // A4 portrait
    await reglage(page, 'Format').selectOption('Lettre');
    await expect.poll(() => ratio(page)).toBeCloseTo(11 / 8.5, 2);                   // Lettre portrait
    await reglage(page, 'Orientation').selectOption('Paysage');
    await expect.poll(() => ratio(page)).toBeCloseTo(8.5 / 11, 2);                   // Lettre paysage
    await reglage(page, 'Format').selectOption('A4');
    await expect.poll(() => ratio(page)).toBeCloseTo(210 / 297, 2);                  // A4 paysage
    await expect(pagesApercu(page)).toHaveCount(1);
  });

  test('deux colonnes rangent les parties côte à côte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    const haut = (n: number) => feuille(page).locator('.sf-row').nth(n).evaluate(e => Math.round(e.getBoundingClientRect().top));
    const gauche = (n: number) => feuille(page).locator('.sf-row').nth(n).evaluate(e => Math.round(e.getBoundingClientRect().left));
    expect(await haut(1)).toBeGreaterThan(await haut(0));        // une colonne : l'une sous l'autre
    expect(await gauche(1)).toBe(await gauche(0));
    await reglage(page, 'Orientation').selectOption('Paysage');
    await reglage(page, 'Colonnes').selectOption('2');
    await expect.poll(async () => (await haut(1)) === (await haut(0))).toBe(true);   // deux colonnes : même hauteur…
    expect(await gauche(1)).toBeGreaterThan(await gauche(0));                         // … et la seconde à droite
    await expect.poll(async () => (await haut(2)) > (await haut(0))).toBe(true);       // la troisième repasse sous la première
  });

  test('« Tout sur une page » réduit la taille quand la structure est longue, et verrouille le zoom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 9; i++) await ajouterPartie(page, i % 2 ? /^Refrain/ : /^Couplet/);
    await ouvrirApercu(page);
    await expect(caseApercu(page, /^Tout sur une page/)).toBeChecked();
    await expect(apercu(page).getByRole('slider')).toBeDisabled();
    await expect(pagesApercu(page)).toHaveCount(1);
    await expect(etatApercu(page)).toHaveText(/^1 page · taille \d+ %$/);
    const taille = Number(((await etatApercu(page).textContent()) || '').match(/taille (\d+) %/)![1]);
    expect(taille).toBeLessThan(100);
    expect(taille).toBeGreaterThanOrEqual(60);
    await expect(feuille(page).locator('.sf-row')).toHaveCount(12);
  });

  test('si même réduite à 60 % la structure ne tient pas, l\'aperçu le dit et passe sur plusieurs pages', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 24; i++) await ajouterPartie(page, [/^Couplet/, /^Refrain/, /^Pont/][i % 3]);
    await expect(fenetre(page).locator('.struct-row')).toHaveCount(27);
    await ouvrirApercu(page);
    await expect(etatApercu(page)).toHaveText(/^2 pages : même réduite à 60 %, la structure ne tient pas sur une seule$/);
    await expect(pagesApercu(page)).toHaveCount(2);
    await expect(pagesApercu(page).first().locator('.sf-row')).toHaveCount(27);   // chaque page montre une fenêtre sur la même feuille complète
  });

  test('sans « Tout sur une page », le curseur de zoom règle la taille et le nombre de pages', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 9; i++) await ajouterPartie(page, i % 2 ? /^Refrain/ : /^Couplet/);
    await ouvrirApercu(page);
    await caseApercu(page, /^Tout sur une page/).uncheck();
    const curseur = apercu(page).getByRole('slider');
    await expect(curseur).toBeEnabled();
    await curseur.fill('100');
    await expect(apercu(page).locator('#apercu-zoom-val')).toHaveText('100 %');
    await expect(etatApercu(page)).toHaveText(/^\d+ pages? · taille 100 %$/);
    const grande = await pagesApercu(page).count();
    expect(grande).toBeGreaterThan(1);                       // à 100 %, douze parties ne tiennent plus sur une page
    await curseur.fill('60');
    await expect(apercu(page).locator('#apercu-zoom-val')).toHaveText('60 %');
    await expect(etatApercu(page)).toHaveText(/taille 60 %$/);
    await expect.poll(() => pagesApercu(page).count()).toBeLessThan(grande);
  });

  test('les réglages de l\'aperçu sont retenus : fermeture, réouverture et rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await reglage(page, 'Format').selectOption('Lettre');
    await reglage(page, 'Orientation').selectOption('Paysage');
    await reglage(page, 'Colonnes').selectOption('2');
    await caseApercu(page, 'Déroulé').uncheck();
    await caseApercu(page, 'Liste des accords utilisés').check();
    await appuyer(page, apercu(page).getByRole('button', { name: 'Fermer' }));
    await expect(apercu(page)).toBeHidden();
    const verifier = async () => {
      await ouvrirApercu(page);
      await expect(reglage(page, 'Format')).toHaveValue('lettre');
      await expect(reglage(page, 'Orientation')).toHaveValue('landscape');
      await expect(reglage(page, 'Colonnes')).toHaveValue('2');
      await expect(caseApercu(page, 'Déroulé')).not.toBeChecked();
      await expect(caseApercu(page, 'Liste des accords utilisés')).toBeChecked();
      await expect(feuille(page).locator('.sf-deroule')).toHaveCount(0);
    };
    await verifier();
    await appuyer(page, apercu(page).getByRole('button', { name: 'Fermer' }));
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirStructure(page);
    await verifier();
  });
});

test.describe('Sorties de l\'aperçu @structure', () => {
  test('« Enregistrer en PDF » télécharge un PDF valide d\'après le morceau @critique', async ({ ouvrirAppli, garde }) => {
    // nom de morceau sans accent : Chromium ne rend pas le nom accentué d'un téléchargement (limite du navigateur de test, voir fichiers)
    const page = await ouvrirAppli(morceauTroisParties(undefined, 'Demo'));
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    const t = await telecharger(page, () => appuyer(page, apercu(page).getByRole('button', { name: 'Enregistrer en PDF' })));
    expect(t.nom).toMatch(/^HarmoHub - Demo - Structure - \d{4}-\d{2}-\d{2} \d{4}\.pdf$/);
    expect(estUnPdf(t.contenu)).toBe(true);
    expect(t.contenu.length).toBeGreaterThan(3_000);
    expect(t.contenu.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)?.length).toBe(1);
    expect(garde.bloquees).toEqual([]);
  });

  test('le PDF compte autant de pages que l\'aperçu', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 24; i++) await ajouterPartie(page, [/^Couplet/, /^Refrain/, /^Pont/][i % 3]);
    await ouvrirApercu(page);
    await expect(pagesApercu(page)).toHaveCount(2);
    const t = await telecharger(page, () => appuyer(page, apercu(page).getByRole('button', { name: 'Enregistrer en PDF' })));
    expect(estUnPdf(t.contenu)).toBe(true);
    expect(t.contenu.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)?.length).toBe(2);
  });

  test('« Imprimer » lance l\'impression du navigateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await page.evaluate(() => { (window as any).__impressions = 0; window.print = () => { (window as any).__impressions++; }; });
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await appuyer(page, apercu(page).getByRole('button', { name: 'Imprimer' }));
    await expect.poll(() => page.evaluate(() => (window as any).__impressions)).toBe(1);
  });

  test('l\'aperçu tient dans l\'écran du téléphone, réglages et sorties atteignables @mobile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await tientDansL_ecran(page, apercu(page));
    await apercu(page).getByRole('button', { name: 'Enregistrer en PDF' }).scrollIntoViewIfNeeded();
    await expect(apercu(page).getByRole('button', { name: 'Enregistrer en PDF' })).toBeInViewport();
    await expect(apercu(page).getByRole('button', { name: 'Imprimer' })).toBeInViewport();
  });
});
