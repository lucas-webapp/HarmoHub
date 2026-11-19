// MODULE « sequenceur » — les NOTES AJOUTÉES (« notes libres ») : une note hors de l'accord, avec sa propre ligne dans la grille.
// Le bouton « Ajouter une note libre » (à gauche de la grille) ouvre la bande « Note libre » : un nom (do, do#… si), une octave, ou le nom tapé
// (« C4 », « Eb3 », « F#2 »). La ligne est rangée par hauteur ; elle n'est enregistrée dans l'accord qu'à la première note posée dedans. Les dièses
// et bémols suivent la tonalité (en do : « Eb » tapé s'affiche « D# »). À l'ordinateur, un clic sur l'étiquette de la ligne la renomme.
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import {
  C_AM_F_G, celluleNote, notesAllumees, nombreAllume, ouvrirSurAccord, grille, motifStocke, estMobile, attendreNiveau, boutonEffacer, noteDe, choisirAccord,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

const bande = (page: Page): Locator => page.getByRole('group', { name: 'Note libre' });
const boutonAjouterLibre = (page: Page): Locator => page.getByRole('button', { name: 'Ajouter une note libre' });
const saisie = (page: Page): Locator => page.locator('#sq-libre-saisie');
const valider = (page: Page): Locator => page.locator('#sq-libre-ajouter');
const etiquettes = (page: Page) => grille(page).locator('.sq-etiq');
const nomLibre = (page: Page, nom: string): Locator => grille(page).locator('.sq-etiq.libre').getByRole('button', { name: nom, exact: true });   // le nom (span role=button « Renommer cette note ») ; la croix s'appelle « Retirer la note libre … »
const retirer = (page: Page, nom: string): Locator => page.getByRole('button', { name: `Retirer la note libre ${nom}` });
const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());

async function ouvrirBande(page: Page) {
  await appuyer(page, boutonAjouterLibre(page));
  await expect(bande(page)).toBeVisible();
}
// Ajoute une ligne libre en tapant son nom, puis valide avec le bouton.
async function ajouterLigne(page: Page, nom: string) {
  await ouvrirBande(page);
  await saisie(page).fill(nom);
  await appuyer(page, valider(page));
  await expect(bande(page)).toBeHidden();
}
async function accordSeul(page: Page, n = 1) {
  await ouvrirSurAccord(page, n);
  if (estMobile(page)) await page.locator('#sq-portee-accord').tap();
}

test.describe('Notes ajoutées — ordinateur @sequenceur @ordinateur', () => {
  test('« Ajouter une note libre » ouvre la bande « Note libre » : douze noms, la saisie, l\'octave, « Ajouter C4 » et « Annuler »', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await expect(bande(page)).toBeHidden();
    await ouvrirBande(page);
    await expect(bande(page).getByRole('group', { name: 'Nom de la note' }).getByRole('button')).toHaveText(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    await expect(bande(page).getByRole('button', { name: 'C', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(saisie(page)).toHaveValue('C4');
    await expect(page.locator('#sq-libre-octave')).toHaveText('4');
    await expect(valider(page)).toHaveText('Ajouter C4');
    await expect(bande(page).getByRole('button', { name: 'Annuler' })).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('choisir un nom et une octave met à jour la saisie et le bouton', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ouvrirBande(page);
    await bande(page).getByRole('button', { name: 'F#', exact: true }).click();
    await expect(saisie(page)).toHaveValue('F#4');
    await expect(valider(page)).toHaveText('Ajouter F#4');
    await bande(page).getByRole('button', { name: 'Octave plus grave' }).click();
    await expect(page.locator('#sq-libre-octave')).toHaveText('3');
    await expect(valider(page)).toHaveText('Ajouter F#3');
    await bande(page).getByRole('button', { name: 'Octave plus aiguë' }).click();
    await bande(page).getByRole('button', { name: 'Octave plus aiguë' }).click();
    await expect(valider(page)).toHaveText('Ajouter F#5');
  });

  test('taper « Eb3 » montre « D#3 » (les altérations suivent la tonalité) et Entrée ajoute la ligne @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    await ouvrirBande(page);
    await saisie(page).fill('Eb3');
    await expect(valider(page)).toHaveText('Ajouter D#3');
    await expect(bande(page).getByRole('button', { name: 'D#', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sq-libre-octave')).toHaveText('3');
    await saisie(page).press('Enter');
    await expect(bande(page)).toBeHidden();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3', 'D#3']);   // rangée par hauteur : D#3 est sous A3
    await expect(retirer(page, 'D#3')).toBeVisible();
  });

  test('« Annuler » ferme la bande sans ajouter de ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ouvrirBande(page);
    await saisie(page).fill('G3');
    await bande(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(bande(page)).toBeHidden();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
  });

  test('un nom invalide n\'ajoute aucune ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ouvrirBande(page);
    await saisie(page).fill('Z9');
    await saisie(page).press('Enter');
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    expect((await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
  });

  test('poser une note sur la ligne ajoutée l\'enregistre dans l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await ajouterLigne(page, 'D4');
    // la ligne existe dans la grille mais n'est pas enregistrée tant qu'elle est vide
    await attendreNiveau(celluleNote(page, 1, 'D4', 3), 'vide');
    expect((await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
    await celluleNote(page, 1, 'D4', 3).click();
    await attendreNiveau(celluleNote(page, 1, 'D4', 3), 'normal');
    await expect(noteDe(celluleNote(page, 1, 'D4', 3))).toHaveText('D4');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    // voix n° 3 (la première note ajoutée), pas 4 et 5 : « 3 » puis « 3t »
    await expect.poll(async () => (await motifStocke(page, 0, 1)).arpPattern?.split(';').slice(4, 6)).toEqual(['3', '3t']);
  });

  test('la ligne ajoutée se joue comme les autres : étirer, déplacer, supprimer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await celluleNote(page, 1, 'D4', 6).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(2);
    await celluleNote(page, 1, 'D4', 6).click();
    await expect(celluleNote(page, 1, 'D4', 6)).toHaveClass(/\bsq-sel\b/);
    await page.keyboard.press('Delete');
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['3.1:normal']);
  });

  test('un clic sur l\'étiquette de la ligne la renomme : « Eb3 » devient « D#3 » et la note suit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    await nomLibre(page, 'D4').click();   // le nom est un bouton « Renommer cette note »
    const champ = page.getByRole('textbox', { name: 'Nom de la note (D4, Eb3…)' });
    await expect(champ).toBeVisible();
    await champ.fill('Eb3');
    await champ.press('Enter');
    await expect(champ).toBeHidden();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3', 'D#3']);
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D#', octave: 3 }]);
    // la note posée a suivi la ligne : même croche, nouvelle hauteur
    await attendreNiveau(celluleNote(page, 1, 'D#3', 2), 'normal');
    await expect(noteDe(celluleNote(page, 1, 'D#3', 2))).toHaveText('D#3');
    expect(await nombreAllume(page, 1)).toBe(24 + 1);
  });

  test('Échap pendant le renommage garde le nom d\'origine', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    await nomLibre(page, 'D4').click();
    const champ = page.getByRole('textbox', { name: 'Nom de la note (D4, Eb3…)' });
    await champ.fill('G2');
    await champ.press('Escape');
    await expect(champ).toBeHidden();
    await expect(etiquettes(page)).toHaveText(['E4', 'D4', 'C4', 'A3']);
    expect((await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
  });

  test('la croix de l\'étiquette retire la ligne et ses notes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    await retirer(page, 'D4').click();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
    expect(await nombreAllume(page, 1)).toBe(24);   // les trois notes tenues de l'accord sont intactes
  });

  test('chaque accord a ses notes ajoutées : celle de Am ne joue pas sous F', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    expect((await motifStocke(page, 0, 2)).extraNotes ?? []).toEqual([]);
    await attendreNiveau(celluleNote(page, 2, 'D4', 2), 'vide');
    await celluleNote(page, 2, 'D4', 5).click();
    await expect.poll(async () => (await motifStocke(page, 0, 2)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
  });

  test('les notes ajoutées sont retrouvées après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await accordSeul(page);
    await ajouterLigne(page, 'Eb3');
    await celluleNote(page, 1, 'D#3', 4).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D#', octave: 3 }]);
    await page.reload();
    await expect(grille(page)).toBeVisible();
    await choisirAccord(page, 1);   // au rechargement, c'est le premier accord qui est choisi
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3', 'D#3']);
    await attendreNiveau(celluleNote(page, 1, 'D#3', 4), 'normal');
  });

  test('Ctrl+Z défait la pose d\'une note ajoutée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'D4');
    await celluleNote(page, 1, 'D4', 2).click();
    await attendreNiveau(celluleNote(page, 1, 'D4', 2), 'normal');
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
    await expect.poll(() => nombreAllume(page, 1)).toBe(24);
  });

  // S-01 (bugs.md) : ajouter une note libre qui est DÉJÀ une note de l'accord (C4 sous Am) crée une seconde ligne « C4 », identique à celle de l'accord.
  // Ajouter deux fois la même note libre (D4) n'en crée qu'une : le doublon avec l'accord devrait être traité de la même façon.
  test('ajouter une note déjà présente dans l\'accord ne crée pas une seconde ligne identique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ajouterLigne(page, 'C4');
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
  });
});

test.describe('Notes ajoutées — téléphone @sequenceur @mobile', () => {
  test('on ajoute une ligne par le nom tapé, on y pose une note au toucher, on la retire par la croix @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await boutonEffacer(page).tap();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await ajouterLigne(page, 'Eb3');
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3', 'D#3']);
    await celluleNote(page, 1, 'D#3', 3).tap();
    await attendreNiveau(celluleNote(page, 1, 'D#3', 3), 'normal');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D#', octave: 3 }]);
    await retirer(page, 'D#3').tap();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
    expect(garde.bloquees).toEqual([]);
  });

  test('la bande « Note libre » : un nom et une octave choisis, « Annuler » la ferme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordSeul(page);
    await ouvrirBande(page);
    await bande(page).getByRole('button', { name: 'G', exact: true }).tap();
    await bande(page).getByRole('button', { name: 'Octave plus grave' }).tap();
    await expect(valider(page)).toHaveText('Ajouter G3');
    await bande(page).getByRole('button', { name: 'Annuler' }).tap();
    await expect(bande(page)).toBeHidden();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
  });
});
