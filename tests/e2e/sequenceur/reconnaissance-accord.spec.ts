// MODULE « sequenceur » — le séquenceur RECONNAÎT l'accord d'après les notes (essai neutre du 20/11, ES-01 à ES-05 et améliorations 1 à 3).
// Quand on ajoute, déplace ou retire des notes tenues dans l'accord choisi, l'appli propose le NOM qui correspond à toutes les notes qui sonnent
// (bandeau « Am + G : renommer en Am7 ? »), sans jamais renommer toute seule. « Renommer » garde la hauteur choisie (Am7/G, pas G4).
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import { C_AM_F_G, celluleNote, grille, ouvrirSurAccord, glisser } from './aide-sequenceur';

const bande = (page: Page): Locator => page.getByRole('group', { name: 'Note libre' });
const bandeau = (page: Page): Locator => page.locator('#proposition-nom');
const texte = (page: Page): Locator => page.locator('#proposition-nom-texte');
const etiquettes = (page: Page) => grille(page).locator('.sq-etiq');
const nomCase = (page: Page, partie: number, n: number): Locator => page.locator(`.grid-cell[data-section="${partie}"][data-index="${n}"] .cell-sym`);

async function ajouterLigne(page: Page, nom: string) {
  await page.getByRole('button', { name: 'Ajouter une note libre' }).click();
  await page.locator('#sq-libre-saisie').fill(nom);
  await page.locator('#sq-libre-ajouter').click();
  await expect(bande(page)).toBeHidden();
}
// Trace la note sur la mesure entière : un glisser de la première à la dernière croche, comme à la souris.
async function tracer(page: Page, note: string, c = 1, de = 1, a = 8) {
  const d = await celluleNote(page, c, note, de).boundingBox(), f = await celluleNote(page, c, note, a).boundingBox();
  await glisser(page, { x: d!.x + d!.width / 2, y: d!.y + d!.height / 2 }, { x: f!.x + f!.width / 2, y: f!.y + f!.height / 2 }, 14);
}
// Retire une note tenue comme l'utilisateur : un clic la choisit, Suppr l'efface (la note entière, d'une annulation).
async function effacer(page: Page, note: string, col = 1) {
  await celluleNote(page, col, note, 1).click();
  await page.keyboard.press('Delete');
  await expect(celluleNote(page, col, note, 1)).toHaveAttribute('aria-label', /: vide$/);
}
async function ouvrirSurAm(page: Page) { await ouvrirSurAccord(page, 1); }

test.describe('Reconnaissance de l\'accord d\'après les notes @sequenceur @ordinateur', () => {
  test('Am + G tenu : « renommer en Am7 ? », et après « Renommer » la case dit Am7/G avec la note à sa hauteur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(texte(page)).toContainText('Am7', { timeout: 5000 });
    await expect(texte(page)).toContainText('+ G');
    await page.getByRole('button', { name: 'Renommer' }).click();
    await expect(nomCase(page, 0, 1)).toHaveText('Am7/G');
    await expect(etiquettes(page)).toContainText(['G3']);   // ES-03 : elle n'est pas montée d'une octave, hors de la vue
  });

  test('rien n\'est jamais renommé sans le clic : la case garde son nom tant qu\'on ne répond pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await expect(nomCase(page, 0, 1)).toHaveText('Am');
  });

  test('le bandeau reste affiché tant qu\'on n\'a pas répondu (plus de disparition au bout de 12 s)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'G3');
    await tracer(page, 'G3');
    await expect(bandeau(page)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(13000);
    await expect(bandeau(page)).toBeVisible();
  });

  test('Am : C4 retiré et C#4 tenu : « renommer en A ? » (déplacer ou retirer une note compte aussi, ES-01) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await effacer(page, 'C4');
    await ajouterLigne(page, 'C#4');
    await tracer(page, 'C#4');
    await expect(texte(page)).toContainText(/renommer en A \?/, { timeout: 5000 });
  });

  test('C : E retiré et F tenu : « Csus4 » et non « Cadd11 » (ES-02)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 0);
    const lignes = await etiquettes(page).allTextContents();
    const e = lignes.find(l => /^E\d$/.test(l.trim()))!.trim();
    await effacer(page, e, 0);
    await ajouterLigne(page, 'F4');
    await tracer(page, 'F4', 0);
    await expect(texte(page)).toContainText('Csus4', { timeout: 5000 });
    await expect(texte(page)).not.toContainText('Cadd11');
  });

  test('Am + B tenu : « renommer en Am(add9) ? » (les extensions mineures sont reconnues, ES-04)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'B4');
    await tracer(page, 'B4');
    await expect(texte(page)).toContainText('Am(add9)', { timeout: 5000 });
  });

  test('un accord qui n\'existe pas (Am + D#) : aucune proposition', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'D#4');
    await tracer(page, 'D#4');
    await page.waitForTimeout(2000);
    await expect(bandeau(page)).toBeHidden();
  });

  test('une note d\'une seule croche (note de passage) ne change pas l\'accord proposé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAm(page);
    await ajouterLigne(page, 'G3');
    await celluleNote(page, 1, 'G3', 3).click();
    await page.waitForTimeout(2000);
    await expect(bandeau(page)).toBeHidden();
  });

  test('les altérations s\'écrivent comme des fondamentales de la tonalité : « C + Bb », pas « A# » (ES-05)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 0);
    await ajouterLigne(page, 'A#3');
    await tracer(page, 'A#3', 0);
    await expect(texte(page)).toContainText('B♭', { timeout: 5000 });
  });
});
