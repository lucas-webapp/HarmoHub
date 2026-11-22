// MODULE « sequenceur » — corrections du 2e essai neutre (20/11 : rapport tests/reports/2026-11-20-essai-sequenceur-2.md, EB-01 à EB-19).
// Un groupe par constat, avec les gestes de l'utilisateur (souris, clavier).
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import { C_AM_F_G, celluleNote, grille, ouvrirSurAccord, glisser } from './aide-sequenceur';

const bande = (page: Page): Locator => page.getByRole('group', { name: 'Note libre' });
const bandeau = (page: Page): Locator => page.locator('#proposition-nom');
const texte = (page: Page): Locator => page.locator('#proposition-nom-texte');
const nomCase = (page: Page, partie: number, n: number): Locator => page.locator(`.grid-cell[data-section="${partie}"][data-index="${n}"] .cell-sym`);

async function ajouterLigne(page: Page, nom: string) {
  await page.getByRole('button', { name: 'Ajouter une note libre' }).click();
  await page.locator('#sq-libre-saisie').fill(nom);
  await page.locator('#sq-libre-ajouter').click();
  await expect(bande(page)).toBeHidden();
}
async function tracer(page: Page, note: string, c = 1, de = 1, a = 8) {
  const d = await celluleNote(page, c, note, de).boundingBox(), f = await celluleNote(page, c, note, a).boundingBox();
  await glisser(page, { x: d!.x + d!.width / 2, y: d!.y + d!.height / 2 }, { x: f!.x + f!.width / 2, y: f!.y + f!.height / 2 }, 14);
}
const normal = (l: Locator) => expect(l).toHaveAttribute('aria-label', /: normal$/);
const vide = (l: Locator) => expect(l).toHaveAttribute('aria-label', /: vide$/);

test.describe('Corrections du 2e essai neutre @sequenceur @ordinateur', () => {
  test('EB-01 : Ctrl+Z referme le bandeau de renommage (il ne reste pas à écrire une qualité périmée) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await page.mouse.click(5, 300);   // à côté : le focus quitte le bandeau
    await page.keyboard.press('Control+z');
    await expect(bandeau(page)).toBeHidden({ timeout: 5000 });
    await expect(nomCase(page, 0, 1)).toHaveText('Am');
  });

  test('EB-01 : accepter un bandeau garde toutes les notes qui sonnaient (rien n\'est supprimé)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Renommer' }).click();
    for (const n of ['A3', 'C4', 'E4', 'G3']) await normal(celluleNote(page, 1, n, 4));
  });

  test('EB-02 : les notes ajoutées gardent le nom de leur ligne dans le bandeau (G#, pas A♭)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G#4');
    await tracer(page, 'G#4');
    await expect(texte(page)).toContainText('+ G#', { timeout: 5000 });
    await expect(texte(page)).not.toContainText('♭');
  });

  test('EB-03 : une note lâchée entre deux lignes suit la ligne la plus proche (le déplacement n\'est plus annulé) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G4');
    await ajouterLigne(page, 'A4');
    await tracer(page, 'G4', 1, 1, 2);
    await normal(celluleNote(page, 1, 'G4', 1));
    const dep = (await celluleNote(page, 1, 'G4', 1).boundingBox())!, haut = (await celluleNote(page, 1, 'A4', 1).boundingBox())!;
    // Le point d'arrivée est l'interstice juste sous la case A4 (les cases font 26 px dans des lignes de 29 px) : avant, le déplacement était annulé sans un mot.
    await glisser(page, { x: dep.x + dep.width / 2, y: dep.y + dep.height / 2 }, { x: dep.x + dep.width / 2, y: haut.y + haut.height + 1 }, 10);
    await normal(celluleNote(page, 1, 'A4', 1));
    await vide(celluleNote(page, 1, 'G4', 1));
  });

  test('EB-04 : déposer une note sur une place occupée : case d\'arrivée rouge pendant le glisser, message au lâcher, rien ne bouge @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'B3');
    await tracer(page, 'B3', 1, 1, 2);
    const dep = (await celluleNote(page, 1, 'B3', 1).boundingBox())!, arr = (await celluleNote(page, 1, 'C4', 1).boundingBox())!;
    await page.mouse.move(dep.x + dep.width / 2, dep.y + dep.height / 2);
    await page.mouse.down();
    await page.mouse.move(arr.x + arr.width / 2, arr.y + arr.height / 2, { steps: 10 });
    await expect(grille(page).locator('.sq-case.sq-refus')).toHaveCount(1);
    await page.mouse.up();
    await expect(grille(page).locator('.sq-case.sq-refus')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText(/occupe déjà cette place/);
    await normal(celluleNote(page, 1, 'B3', 1));
  });

  test('EB-04 : un déplacement qui sortirait de la mesure est montré en rouge et dit pourquoi', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'B3');
    await tracer(page, 'B3', 1, 7, 8);   // deux croches tout à droite de la mesure
    const dep = (await celluleNote(page, 1, 'B3', 7).boundingBox())!, arr = (await celluleNote(page, 1, 'B3', 8).boundingBox())!;
    await page.mouse.move(dep.x + dep.width / 2, dep.y + dep.height / 2);
    await page.mouse.down();
    await page.mouse.move(arr.x + arr.width / 2, arr.y + arr.height / 2, { steps: 8 });
    await expect(grille(page).locator('.sq-case.sq-refus')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator('#toast')).toContainText(/sortirait de la mesure/);
    await normal(celluleNote(page, 1, 'B3', 7));
    await normal(celluleNote(page, 1, 'B3', 8));
  });

  test('EB-05 : un rythme choisi s\'applique à TOUS les accords sélectionnés dans la grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 0);
    const avant = await Promise.all([0, 1, 2, 3].map(i => page.evaluate((n) => JSON.parse(localStorage.getItem('myProgression')!).sections[0].chords[n].motifSeq ?? null, i)));
    const cases = (n: number) => page.locator(`.grid-cell[data-section="0"][data-index="${n}"]`);
    await cases(1).click({ modifiers: ['Control'] });
    await cases(2).click({ modifiers: ['Control'] });
    await expect(page.locator('.grid-cell.multi-selected')).toHaveCount(3);
    await page.locator('#sq-motif-pompe').click();
    const apres = await Promise.all([0, 1, 2, 3].map(i => page.evaluate((n) => JSON.parse(localStorage.getItem('myProgression')!).sections[0].chords[n].motifSeq ?? null, i)));
    expect(apres.slice(0, 3)).toEqual(['pompe', 'pompe', 'pompe']);
    expect(apres[3]).toEqual(avant[3]);   // l'accord non sélectionné ne bouge pas
  });

  test('EB-06 : Ctrl+C / Ctrl+V sur une note copie la NOTE (la grille garde ses 6 mesures)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G4');
    await tracer(page, 'G4', 1, 1, 2);
    const nb = await page.locator('.grid-cell[data-section="0"]').count();
    await celluleNote(page, 1, 'G4', 1).click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await normal(celluleNote(page, 1, 'G4', 3));
    await normal(celluleNote(page, 1, 'G4', 4));
    expect(await page.locator('.grid-cell[data-section="0"]').count()).toBe(nb);
  });

  test('EB-08 : Maj + clic ajoute une note à la sélection', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await celluleNote(page, 1, 'E4', 1).click();
    await celluleNote(page, 1, 'C4', 1).click({ modifiers: ['Shift'] });
    await expect(grille(page).locator('.sq-case.sq-sel')).not.toHaveCount(1);
    expect(await grille(page).locator('.sq-case.sq-sel').count()).toBeGreaterThan(8);
  });

  test('EB-19 : Échap désélectionne les notes (après Ctrl+A)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await celluleNote(page, 1, 'E4', 1).click();
    await page.keyboard.press('Control+a');
    await expect(grille(page).locator('.sq-case.sq-sel').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(grille(page).locator('.sq-case.sq-sel')).toHaveCount(0);
  });

  test('EB-10 : « Ignorer » est retenu tant que la combinaison ne change pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Ignorer' }).click();
    await expect(bandeau(page)).toBeHidden();
    // Une autre note tenue puis retirée ramène la MÊME combinaison : le bandeau ne revient pas.
    await ajouterLigne(page, 'D4');
    await tracer(page, 'D4');
    await page.waitForTimeout(1500);
    await celluleNote(page, 1, 'D4', 1).click();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1500);
    await expect(bandeau(page)).toBeHidden();
  });

  test('EB-09 : un renversement est reconnu (A C F sur Am : « renommer en F/A ? »)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await celluleNote(page, 1, 'E4', 1).click();
    await page.keyboard.press('Delete');
    await ajouterLigne(page, 'F4');
    await tracer(page, 'F4');
    await expect(texte(page)).toContainText('F/A', { timeout: 5000 });
    await page.getByRole('button', { name: 'Renommer' }).click();
    await expect(nomCase(page, 0, 1)).toHaveText(/^F/);   // F en 1er renversement : les notes gardent leur hauteur (A3 C4 F4)
    for (const n of ['A3', 'C4', 'F4']) await normal(celluleNote(page, 1, n, 4));
  });

  test('EB-09 : une combinaison sans nom le dit (message), au lieu de se taire', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'D#4');
    await tracer(page, 'D#4');
    await expect(page.locator('#toast')).toContainText(/aucun nom/, { timeout: 5000 });
    await expect(bandeau(page)).toBeHidden();
  });

  test('EB-13 : dans une case au rythme vidé, « silence » ne chevauche plus le badge d\'octave', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 0);
    await page.locator('#sq-effacer').click();
    const meta = page.locator('.grid-cell[data-section="0"][data-index="0"] .cell-meta');
    await expect(page.locator('.grid-cell[data-section="0"][data-index="0"]')).toHaveClass(/grid-cell-muet/);
    if (await meta.count()) await expect(meta).toHaveCSS('visibility', 'hidden');
  });

  test('EB-12 : l\'étiquette d\'une ligne dit de quel accord elle est (infobulle)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.locator('#sq-vue-voix').click();
    await expect(grille(page).locator('.sq-etiq').first()).toHaveAttribute('title', /accord choisi \(Am\)/);
  });

  test('EB-14 : enregistrer une forme ne fait pas tomber les noms des rythmes fournis (1400 px)', async ({ ouvrirAppli }) => {
    // La tablette (pointeur tactile, boutons plus larges) n'a pas la même largeur de barre : la fenêtre où une seule étape suffit y est ailleurs.
    test.skip(test.info().project.name === 'tablette', 'barre plus large au toucher : autre seuil');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.setViewportSize({ width: 1400, height: 900 });
    await ouvrirSurAccord(page, 1);
    await expect(page.locator('#sq-motif-pompe > span:not(.sq-vignette)')).toBeVisible();   // le nom est visible (et pas seulement présent dans le texte)
    for (const nom of ['Ma forme']) {
      await page.locator('#sq-forme-enregistrer').click();
      const biblio = page.getByRole('dialog', { name: 'Tous les rythmes' });
      await biblio.getByRole('button', { name: /Enregistrer la forme/ }).click();
      await biblio.getByRole('textbox', { name: 'Nom de la forme' }).fill(nom);
      await biblio.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await expect(page.locator(`#sq-formes button.sq-motif[title^="${nom} — "]`)).toBeVisible();
      await expect(biblio).toBeHidden();
    }
    // Les formes passent en icône seule d'abord ; les cinq rythmes fournis gardent leur nom.
    await expect(page.locator('#sq-motif-pompe > span:not(.sq-vignette)')).toBeVisible();   // le nom est visible (et pas seulement présent dans le texte)
  });
});

test.describe('Corrections du 2e essai neutre — téléphone @sequenceur @mobile', () => {
  test('EB-16 : la proposition de renommer s\'affiche aussi au téléphone et les poignées d\'étirement ont au moins 12 px', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.getByRole('button', { name: 'Ajouter une note libre' }).tap();
    await page.locator('#sq-libre-saisie').fill('G3');
    await page.locator('#sq-libre-ajouter').tap();
    for (const k of [1, 2, 3, 4, 5]) await celluleNote(page, 1, 'G3', k).tap();
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await expect(texte(page)).toContainText('Am7');
    const poignee = (await grille(page).locator('.sq-bord').first().boundingBox())!;
    expect(poignee.width).toBeGreaterThanOrEqual(12);
  });
});

// Améliorations du 2e essai neutre (21/11, amélioration 2, 13 et 15).
test.describe('Améliorations du 2e essai neutre @sequenceur @ordinateur', () => {
  test('le bandeau de renommage se pose juste au-dessus du séquenceur, pas sur le clavier du bas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    const b = (await bandeau(page).boundingBox())!, q = (await page.locator('#sequenceur').boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(q.y + 1);
    expect(q.y - (b.y + b.height)).toBeLessThan(40);
  });

  test('double-clic sur une note : son menu ; « Dupliquer la note » la pose juste après elle', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G4');
    await tracer(page, 'G4', 1, 1, 2);
    await celluleNote(page, 1, 'G4', 1).dblclick();
    const menu = page.locator('#sq-menu-note');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Dupliquer la note' }).click();
    await normal(celluleNote(page, 1, 'G4', 1));
    await normal(celluleNote(page, 1, 'G4', 3));
    await normal(celluleNote(page, 1, 'G4', 4));
  });

  test('« Copier la note » du menu puis Ctrl+V : la copie se pose après la note', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G4');
    await tracer(page, 'G4', 1, 1, 2);
    await celluleNote(page, 1, 'G4', 1).click({ button: 'right' });
    await page.locator('#sq-menu-note').getByRole('menuitem', { name: 'Copier la note' }).click();
    await page.keyboard.press('Control+v');
    await normal(celluleNote(page, 1, 'G4', 3));
    await normal(celluleNote(page, 1, 'G4', 4));
  });

  test('Alt + glisser : le curseur dit « copier » pendant le geste', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ajouterLigne(page, 'G4');
    await tracer(page, 'G4', 1, 1, 2);
    const d = (await celluleNote(page, 1, 'G4', 1).boundingBox())!, v = (await celluleNote(page, 1, 'G4', 5).boundingBox())!;
    await page.keyboard.down('Alt');
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await page.mouse.down();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2, { steps: 8 });
    await expect(page.locator('body')).toHaveClass(/sq-copie/);
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect(page.locator('body')).not.toHaveClass(/sq-copie/);
  });
});
