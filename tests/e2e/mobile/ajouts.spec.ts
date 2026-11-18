// MODULE « mobile » — « + Accord » dans l'en-tête de chaque partie et « + Section » discret sous la grille. Au téléphone il n'y a plus de « + » nu au bout des lignes.
// La saisie rapide elle-même (« C//Am//F//G », « Bbadd9/C », « xyz ») est éprouvée au téléphone par le module grille (ajout-rapide.spec.ts) : ici la destination,
// le panneau, les accords de la tonalité et la création d'une section.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, DEUX_PARTIES, caseN, cases, noms, titresParties, boutonAccord, boutonSection, panneauAjout, saisieAjout, annuler, bandeClavier, barreLecture, boite, defiler, tientDansL_ecran,
} from './aide-mobile';

// une puce d'accord : la rangée « Souvent après … » (si elle y est) puis celle des accords de la tonalité ; `.last()` vise la rangée de la tonalité, toujours complète
const puce = (page: any, nom: string) => panneauAjout(page).getByRole('button', { name: new RegExp(`^${nom} `) }).last();

test.describe('« + Accord » et « + Section » au téléphone @mobile', () => {
  test('chaque partie a son « + Accord » à droite de son en-tête, petit et sans « + » nu au bout des lignes @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    for (const [i, nom] of [[0, 'Couplet'], [1, 'Refrain']] as const) {
      const b = boutonAccord(page, i);
      await expect(b).toBeVisible();
      await expect(b).toHaveAccessibleName(`Ajouter des accords à ${nom}`);
      await expect(b).toHaveText('Accord');
      const [r, menu] = [await boite(b), await boite(page.getByRole('button', { name: `Actions de la partie ${nom}` }))];
      expect(r.height).toBeLessThanOrEqual(32);      // un petit bouton (28 px), pas un bouton plein
      expect(r.x).toBeGreaterThan(menu.x + menu.width - 1);   // à droite du menu « … » de la partie
      expect(Math.abs(r.y + r.height / 2 - (menu.y + menu.height / 2))).toBeLessThanOrEqual(6);
      await tientDansL_ecran(page, b);
    }
    // les anciens « + » de bout de ligne ne se voient plus
    await expect(page.locator('#progression-sections .grid-cell-add:visible')).toHaveCount(0);
    expect(garde.bloquees).toEqual([]);
  });

  test('« + Accord » de la seconde partie ouvre le panneau sur CETTE partie ; un accord de la tonalité s\'y ajoute à la fin, en une annulation @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await boutonAccord(page, 1).tap();
    const p = panneauAjout(page);
    await expect(p).toBeVisible();
    await expect(p).toContainText('Refrain, à la fin, après C');
    await tientDansL_ecran(page, p);
    await expect(saisieAjout(page)).toBeVisible();
    await expect(p.getByText(/Accords de C majeur/i)).toBeVisible();
    for (const n of ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']) await expect(puce(page, n)).toBeVisible();

    await puce(page, 'G').tap();
    expect(await noms(page, 1)).toEqual(['F', 'C', 'G']);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);   // l'autre partie n'a pas bougé
    await expect(p).toBeVisible();                                 // le panneau reste ouvert pour enchaîner
    await expect(p).toContainText('Refrain, à la fin, après G');
    await puce(page, 'Em').tap();
    expect(await noms(page, 1)).toEqual(['F', 'C', 'G', 'Em']);

    // une annulation par accord ajouté
    await annuler(page).tap();
    expect(await noms(page, 1)).toEqual(['F', 'C', 'G']);
    await annuler(page).tap();
    expect(await noms(page, 1)).toEqual(['F', 'C']);
  });

  test('« Souvent après … » propose des suites de l\'accord précédent, et « avec 7e » passe aux accords de septième', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonAccord(page, 0).tap();
    const p = panneauAjout(page);
    await expect(p.getByText(/Souvent après G/i)).toBeVisible();
    await p.getByRole('button', { name: 'avec 7e' }).tap();
    await expect(puce(page, 'Cmaj7')).toBeVisible();
    await expect(puce(page, 'G7')).toBeVisible();
    await puce(page, 'G7').tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'G7']);
  });

  test('toucher « + Accord » d\'une autre partie change la destination du panneau ; « Fermer » le referme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await boutonAccord(page, 1).tap();
    await expect(panneauAjout(page)).toContainText('Refrain, à la fin');
    await boutonAccord(page, 0).tap();
    await expect(panneauAjout(page)).toContainText('Couplet, à la fin, après G');
    await puce(page, 'Dm').tap();
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G', 'Dm']);
    await panneauAjout(page).getByRole('button', { name: 'Fermer' }).tap();
    await expect(panneauAjout(page)).toBeHidden();
    await expect(bandeClavier(page)).toBeVisible();
  });

  test('« + Accord » d\'une partie vide : « partie vide » dans le panneau, et la saisie rapide y ajoute un premier accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await expect(cases(page)).toHaveCount(0);
    await boutonAccord(page, 0).tap();
    await expect(panneauAjout(page)).toContainText('partie vide');
    await saisieAjout(page).fill('Em7');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual(['Em7']);
  });

  test('« + Section » est sous le pli, apparaît en défilant, reste petit et pointillé @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    const b = boutonSection(page);
    await expect(b).toHaveAccessibleName('Ajouter une section');
    await expect(b).toHaveText(/section/i);
    // au départ il est caché sous la barre de lecture (en bas de la page), pas encore offert au doigt
    expect((await boite(b)).y).toBeGreaterThanOrEqual((await boite(barreLecture(page))).y);
    await defiler(page, 400);
    const r = await boite(b);
    expect(r.y + r.height).toBeLessThanOrEqual((await boite(bandeClavier(page))).y);   // au-dessus de la bande du bas
    expect(r.height).toBeLessThanOrEqual(32);
    expect(r.width).toBeLessThan(140);                        // petit bouton sobre, pas une barre pleine largeur
    expect(await b.evaluate(e => getComputedStyle(e).borderStyle)).toBe('dashed');
    await tientDansL_ecran(page, b);
  });

  test('« + Section » ajoute une partie vide ; on la nomme, on y ajoute un accord ; Annuler retire le tout @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await defiler(page, 400);
    await boutonSection(page).tap();
    await expect(titresParties(page)).toHaveCount(3);
    await expect(boutonAccord(page, 2)).toBeAttached();
    const nom = titresParties(page).nth(2);
    await nom.scrollIntoViewIfNeeded();
    await nom.fill('Pont');
    await nom.press('Enter');
    await expect(nom).toHaveValue('Pont');

    await boutonAccord(page, 2).scrollIntoViewIfNeeded();
    await boutonAccord(page, 2).tap();
    await expect(panneauAjout(page)).toContainText('Pont');
    await expect(panneauAjout(page)).toContainText('partie vide');
    await puce(page, 'Am').tap();
    expect(await noms(page, 2)).toEqual(['Am']);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
    expect(await noms(page, 1)).toEqual(['F', 'C']);

    // le tout est gardé après un rechargement
    await page.reload();
    await expect(cases(page)).toHaveCount(7);
    await expect(titresParties(page)).toHaveCount(3);
    await expect(titresParties(page).nth(2)).toHaveValue('Pont');
    expect(await noms(page, 2)).toEqual(['Am']);
  });

  test('plusieurs « + Section » de suite : chaque partie a son propre « + Accord »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await defiler(page, 400);
    await boutonSection(page).tap();
    await expect(titresParties(page)).toHaveCount(2);
    await boutonSection(page).scrollIntoViewIfNeeded();
    await boutonSection(page).tap();
    await expect(titresParties(page)).toHaveCount(3);
    await expect(page.locator('#progression-sections .prog-section-ajout')).toHaveCount(3);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await annuler(page).tap();
    await expect(titresParties(page)).toHaveCount(2);
    await annuler(page).tap();
    await expect(titresParties(page)).toHaveCount(1);
  });
});
