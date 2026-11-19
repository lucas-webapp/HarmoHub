// MODULE « diagrammes » — le TIROIR clavier / guitare de l'ordinateur : épinglé au-dessus de la barre de lecture, allumé et éteint par les deux boutons « Vues »,
// redimensionné à la poignée, réglé (affichage des notes, nombre de doigtés), détaché en fenêtre libre (déplacer, redimensionner, réépingler).
import { test, expect } from '../support/fixtures';
import {
  morceauDeux, caseN, tiroir, boutonPiano, boutonGuitare, fermer, reglagesDiagrammes, detacher, poignee, coin, barreTitre, barreLecture, piano, guitare,
  nomAccord, notesAccord, touchesJouees, rolesJoues, compteur, position, selectionner, signature,
} from './aide-diagrammes';

const fenetreLibre = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Clavier et guitare' });
const hauteur = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!.height;

test.describe('Tiroir clavier / guitare @diagrammes @ordinateur', () => {
  test('au départ le piano est affiché, la guitare non ; le tiroir est épinglé juste au-dessus de la barre de lecture, sans rien recouvrir @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await expect(boutonPiano(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonGuitare(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(boutonPiano(page)).toHaveAccessibleName('Afficher le piano');
    await expect(boutonGuitare(page)).toHaveAccessibleName('Afficher la guitare');
    await expect(tiroir(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clavier et guitare' })).toBeVisible();
    await expect(piano(page)).toBeVisible();
    await expect(guitare(page)).toBeHidden();
    const t = (await tiroir(page).boundingBox())!, b = (await barreLecture(page).boundingBox())!;
    expect(t.y + t.height).toBeLessThanOrEqual(b.y + 1);           // posé sur la barre de lecture
    expect(b.y - (t.y + t.height)).toBeLessThanOrEqual(4);          // …et collé à elle
    expect(t.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 10);   // sur toute la largeur de l'écran
    // la grille cède la place : sa dernière partie reste au-dessus du tiroir (rien n'est recouvert)
    const derniere = (await caseN(page, 1, 1).boundingBox())!;
    expect(derniere.y + derniere.height).toBeLessThanOrEqual(t.y);
  });

  test('le diagramme suit l\'accord choisi : son nom, ses notes et les touches allumées, avec le rôle de chaque note @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 0);
    await expect(nomAccord(page)).toHaveText('Cmaj7');
    await expect(notesAccord(page)).toHaveText(['C', 'E', 'G', 'B']);
    await expect(touchesJouees(page)).toHaveCount(4);
    expect(await rolesJoues(page)).toEqual(['root', 'third', 'fifth', 'seventh']);
    await selectionner(page, 0, 1);
    await expect(nomAccord(page)).toHaveText('Am7');
    await expect(notesAccord(page)).toHaveText(['A', 'C', 'E', 'G']);
    await expect(touchesJouees(page)).toHaveCount(4);
    // un accord d'une autre partie
    await selectionner(page, 1, 0);
    await expect(nomAccord(page)).toHaveText('Fmaj7');
    await expect(notesAccord(page)).toHaveText(['F', 'A', 'C', 'E']);
    // les touches allumées sont bien celles des notes (do = 60, mi = 64, sol = 67, si = 71)
    await selectionner(page, 0, 0);
    const midi = await touchesJouees(page).evaluateAll(ts => ts.map(t => Number(t.getAttribute('data-midi')) % 12));
    expect([...midi].sort((a, b) => a - b)).toEqual([0, 4, 7, 11]);
  });

  test('pendant la lecture, le clavier et le manche suivent l\'accord joué @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await page.getByRole('toolbar', { name: 'Lecture' }).getByRole('button', { name: 'Lecture', exact: true }).click();
    // chaque accord dure 4 temps à 120 BPM = 2 s : on attend de les voir passer dans l'ordre
    await expect(nomAccord(page)).toHaveText('Cmaj7', { timeout: 10_000 });
    const sigDo = await signature(page);
    await expect(nomAccord(page)).toHaveText('Am7', { timeout: 10_000 });
    expect(await rolesJoues(page)).toEqual(['root', 'third', 'fifth', 'seventh']);
    expect(await signature(page)).not.toBe(sigDo);
    await expect(nomAccord(page)).toHaveText('Dm7', { timeout: 10_000 });
    await page.getByRole('toolbar', { name: 'Lecture' }).getByRole('button', { name: 'Stop', exact: true }).click();
  });

  test('le bouton Guitare montre le manche à côté du clavier ; chaque bouton éteint son diagramme ; le tiroir disparaît quand les deux sont éteints @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();   // la guitare d'abord (voir D-02) : l'accord est choisi ensuite
    await selectionner(page, 0, 1);
    await expect(boutonGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(guitare(page)).toBeVisible();
    await expect(piano(page)).toBeVisible();
    await boutonPiano(page).click();
    await expect(boutonPiano(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(piano(page)).toBeHidden();
    await expect(guitare(page)).toBeVisible();
    await expect(tiroir(page)).toBeVisible();
    await boutonGuitare(page).click();
    await expect(guitare(page)).toBeHidden();
    await expect(tiroir(page)).toBeHidden();
    // et il revient
    await boutonPiano(page).click();
    await expect(piano(page)).toBeVisible();
    await expect(tiroir(page)).toBeVisible();
  });

  test('afficher la guitare alors qu\'un accord est déjà choisi garde cet accord dans le tiroir (D-02)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 1);
    await expect(nomAccord(page)).toHaveText('Am7');
    await boutonGuitare(page).click();
    await expect(guitare(page)).toBeVisible();
    await expect(nomAccord(page)).toHaveText('Am7');
    await expect(notesAccord(page)).toHaveText(['A', 'C', 'E', 'G']);
    expect(await rolesJoues(page)).toEqual(['root', 'third', 'fifth', 'seventh']);
  });

  test('« Fermer » éteint le clavier ET la guitare, les deux boutons le disent, et la grille reprend la place @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await expect(guitare(page)).toBeVisible();
    await fermer(page).click();
    await expect(tiroir(page)).toBeHidden();
    await expect(boutonPiano(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(boutonGuitare(page)).toHaveAttribute('aria-pressed', 'false');
    await boutonPiano(page).click();
    await expect(tiroir(page)).toBeVisible();
    await expect(guitare(page)).toBeHidden();   // « Fermer » n'a pas laissé la guitare en réserve
  });

  test('le choix des diagrammes est retenu après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await boutonPiano(page).click();
    await expect(piano(page)).toBeHidden();
    await expect(guitare(page)).toBeVisible();
    await page.reload();
    await expect(caseN(page, 0, 0)).toBeVisible();
    await expect(boutonPiano(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(boutonGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(piano(page)).toBeHidden();
    await expect(guitare(page)).toBeVisible();
  });

  test('« Réglages des diagrammes » : l\'affichage du piano écrit le nom des notes ou leur degré sur les touches allumées', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await selectionner(page, 0, 1);
    const etiquettes = () => touchesJouees(page).evaluateAll(ts => ts.map(t => t.getAttribute('data-etiquette')));
    expect(await etiquettes()).toEqual([null, null, null, null]);                         // « Rien » au départ
    await reglagesDiagrammes(page).click();
    const fenetre = page.locator('#vues-reglages-pop');
    await expect(fenetre).toBeVisible();
    await expect(reglagesDiagrammes(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(fenetre.getByRole('radiogroup').first().getByRole('radio', { name: 'Rien' })).toBeChecked();
    await fenetre.locator('#vues-mode-piano').getByRole('radio', { name: 'Notes' }).click();
    await expect(fenetre.locator('#vues-mode-piano').getByRole('radio', { name: 'Notes' })).toBeChecked();
    expect(await etiquettes()).toEqual(['A', 'C', 'E', 'G']);
    await fenetre.locator('#vues-mode-piano').getByRole('radio', { name: 'Degrés' }).click();
    expect(await etiquettes()).toEqual(['1', '♭3', '5', '♭7']);
    await fenetre.locator('#vues-mode-piano').getByRole('radio', { name: 'Rien' }).click();
    expect(await etiquettes()).toEqual([null, null, null, null]);
  });

  test('« Nb diagrammes » règle le nombre de doigtés proposés à la guitare (le dénominateur du compteur)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect.poll(async () => (await position(page)).total).toBe(4);
    await reglagesDiagrammes(page).click();
    const nb = page.locator('#vues-max-doigtes');
    await expect(nb.getByRole('radio', { name: '4' })).toBeChecked();
    await nb.getByRole('radio', { name: '2' }).click();
    await expect(nb.getByRole('radio', { name: '2' })).toBeChecked();
    await expect(compteur(page)).toHaveText('1/2');
    await nb.getByRole('radio', { name: '8' }).click();
    await expect.poll(async () => (await position(page)).total).toBeGreaterThan(4);
    expect((await position(page)).total).toBeLessThanOrEqual(8);
    // le réglage survit à un rechargement
    await page.reload();
    await selectionner(page, 0, 1);
    await expect.poll(async () => (await position(page)).total).toBeGreaterThan(4);
  });

  test('la poignée du haut agrandit les diagrammes (jamais plus de 60 % de l\'écran), les réduit, et un double-clic rend la taille d\'origine', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await expect(guitare(page)).toBeVisible();
    const h0 = await hauteur(tiroir(page));
    const larg0 = (await piano(page).boundingBox())!.width;
    const p = (await poignee(page).boundingBox())!;
    const x = p.x + p.width / 2, y = p.y + p.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 8 });
    await page.mouse.up();
    // le tiroir grandit d'au moins 15 % (sur un écran étroit, comme l'iPad, la largeur limite la taille du clavier et du manche posés côte à côte)
    await expect.poll(() => hauteur(tiroir(page))).toBeGreaterThan(h0 * 1.15);
    expect((await piano(page).boundingBox())!.width).toBeGreaterThan(larg0);   // le clavier grandit avec le tiroir
    // tout en haut : plafonné
    const p2 = (await poignee(page).boundingBox())!;
    await page.mouse.move(p2.x + p2.width / 2, p2.y + 4); await page.mouse.down();
    await page.mouse.move(p2.x + p2.width / 2, 20, { steps: 10 });
    await page.mouse.up();
    const plein = await hauteur(tiroir(page));
    expect(plein).toBeLessThanOrEqual(page.viewportSize()!.height * 0.6 + 2);
    // vers le bas : plus petit que la taille d'origine
    const p3 = (await poignee(page).boundingBox())!;
    await page.mouse.move(p3.x + p3.width / 2, p3.y + 4); await page.mouse.down();
    await page.mouse.move(p3.x + p3.width / 2, page.viewportSize()!.height - 10, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => hauteur(tiroir(page))).toBeLessThan(h0);
    // double-clic : la taille d'origine
    await poignee(page).dblclick();
    await expect.poll(() => hauteur(tiroir(page))).toBeCloseTo(h0, 0);
  });

  test('« Détacher en fenêtre libre » sort le tiroir en fenêtre ; elle se déplace par sa barre de titre, se redimensionne au coin et reste dans l\'écran @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 1);
    await expect(detacher(page)).toHaveAccessibleName('Détacher en fenêtre libre');
    await detacher(page).click();
    await expect(fenetreLibre(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clavier et guitare' })).toBeHidden();
    await expect(detacher(page)).toHaveAccessibleName(/^Épingler en bas de l.écran$/);
    await expect(poignee(page)).toBeHidden();                       // la poignée du tiroir n'existe pas en fenêtre libre
    await expect(nomAccord(page)).toHaveText('Am7');                // elle montre toujours l'accord choisi
    const f0 = (await fenetreLibre(page).boundingBox())!;
    // déplacer
    const t = (await barreTitre(page).boundingBox())!;
    await page.mouse.move(t.x + 60, t.y + 10); await page.mouse.down();
    await page.mouse.move(t.x + 60 - 150, t.y + 10 - 120, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await fenetreLibre(page).boundingBox())!.x)).toBe(Math.round(f0.x - 150));
    expect(Math.round((await fenetreLibre(page).boundingBox())!.y)).toBe(Math.round(f0.y - 120));
    // redimensionner
    const w1 = (await fenetreLibre(page).boundingBox())!;
    const c = (await coin(page).boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2 + 120, c.y + c.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await fenetreLibre(page).boundingBox())!.width).toBeGreaterThan(w1.width + 60);
    // la tirer très loin : elle ne sort pas de l'écran
    const t2 = (await barreTitre(page).boundingBox())!;
    await page.mouse.move(t2.x + 60, t2.y + 10); await page.mouse.down();
    await page.mouse.move(2000, 2000, { steps: 8 });
    await page.mouse.up();
    const f2 = (await fenetreLibre(page).boundingBox())!;
    expect(f2.x).toBeGreaterThanOrEqual(0); expect(f2.y).toBeGreaterThanOrEqual(0);
    expect(f2.x + f2.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1); expect(f2.y + f2.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  });

  test('la fenêtre libre est retrouvée après un rechargement, et la punaise réépingle le tiroir en bas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await boutonGuitare(page).click();
    await detacher(page).click();
    await expect(fenetreLibre(page)).toBeVisible();
    const t = (await barreTitre(page).boundingBox())!;
    await page.mouse.move(t.x + 60, t.y + 10); await page.mouse.down();
    await page.mouse.move(t.x + 160, t.y - 90, { steps: 6 });
    await page.mouse.up();
    const avant = (await fenetreLibre(page).boundingBox())!;
    await page.reload();
    await expect(fenetreLibre(page)).toBeVisible();
    const apres = (await fenetreLibre(page).boundingBox())!;
    expect(Math.round(apres.x)).toBe(Math.round(avant.x));
    expect(Math.round(apres.y)).toBe(Math.round(avant.y));
    expect(Math.round(apres.width)).toBe(Math.round(avant.width));
    await detacher(page).click();
    await expect(page.getByRole('region', { name: 'Clavier et guitare' })).toBeVisible();
    await expect(fenetreLibre(page)).toBeHidden();
    const ti = (await tiroir(page).boundingBox())!, b = (await barreLecture(page).boundingBox())!;
    expect(Math.round(ti.y + ti.height)).toBeLessThanOrEqual(Math.round(b.y) + 1);
    expect(ti.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 10);
  });

  test('« Fermer » éteint aussi la fenêtre libre, et le bouton « Vues » la rallume dans le même mode', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await detacher(page).click();
    await expect(fenetreLibre(page)).toBeVisible();
    await fermer(page).click();
    await expect(fenetreLibre(page)).toBeHidden();
    await expect(boutonPiano(page)).toHaveAttribute('aria-pressed', 'false');
    await boutonPiano(page).click();
    await expect(fenetreLibre(page)).toBeVisible();   // la fenêtre garde son mode libre
  });
});
