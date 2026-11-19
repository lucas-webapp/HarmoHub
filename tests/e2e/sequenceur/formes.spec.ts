// MODULE « sequenceur » — les FORMES PERSONNELLES : le bouton « Tous les rythmes » (signet) liste les cinq rythmes et propose « Enregistrer la forme… »
// (garder le rythme de l'accord choisi) et « Créer une forme… » (dessiner un schéma de 3 ou 4 voix sur huit croches). Une forme enregistrée devient un
// bouton de la barre d'outils, appliquable à n'importe quel accord ; clic droit : modifier le schéma, ou supprimer (en deux temps). Les formes sont
// gardées dans le navigateur (`harmohubFormes`). Elles ne dépendent pas du morceau.
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import {
  C_AM_F_G, RYTHMES, rythme, boutonEffacer, bouton, ouvrirSurAccord, choisirAccord, notesAllumees, nombreAllume, motifStocke, estMobile, sequenceur, fenetre, ouvrirSequenceur,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

const biblio = (page: Page): Locator => page.getByRole('dialog', { name: 'Tous les rythmes' });
const formes = (page: Page): Locator => page.locator('#sq-formes');
// le bouton d'une forme porte son nom en infobulle (« Ma forme — clic droit : modifier ce schéma ») ; au téléphone le libellé est masqué
const forme = (page: Page, nom: string): Locator => formes(page).locator(`button.sq-motif[title^="${nom} — "]`);
const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());
const ouvrirBiblio = async (page: Page) => { await appuyer(page, bouton(page, 'Tous les rythmes')); await expect(biblio(page)).toBeVisible(); };
const formesStockees = (page: Page) => page.evaluate(() => {
  const j = JSON.parse(localStorage.getItem('harmohubFormes') || '{"entrees":{}}');
  return Object.values(j.entrees as Record<string, { nom: string }>).map(f => f.nom);
});

// Enregistre le rythme de l'accord choisi sous un nom (le champ propose « Forme 1 »).
async function enregistrerForme(page: Page, nom: string) {
  await ouvrirBiblio(page);
  await biblio(page).getByRole('button', { name: /Enregistrer la forme/ }).click();
  await expect(biblio(page).getByText(/^Enregistrer la forme · /)).toBeVisible();
  const champ = biblio(page).getByRole('textbox', { name: 'Nom de la forme' });
  await champ.fill(nom);
  await biblio(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(forme(page, nom)).toBeVisible();
}

test.describe('Formes personnelles — ordinateur @sequenceur @ordinateur', () => {
  test('« Tous les rythmes » liste les cinq rythmes et propose d\'enregistrer ou de créer une forme', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    for (const [nom] of RYTHMES) await expect(biblio(page)).toContainText(nom);
    await expect(biblio(page).getByRole('button', { name: /Enregistrer la forme/ })).toBeVisible();
    await expect(biblio(page).getByRole('button', { name: /Créer une forme/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(biblio(page)).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });

  test('un rythme choisi dans la liste s\'applique à l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByText('Pompe', { exact: true }).click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).motifSeq).toBe('pompe');
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
  });

  test('« Enregistrer la forme… » propose « Forme 1 » ; le nom choisi devient un bouton, retenu par l\'accord @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Enregistrer la forme/ }).click();
    await expect(biblio(page).getByRole('textbox', { name: 'Nom de la forme' })).toHaveValue('Forme 1');
    await biblio(page).getByRole('textbox', { name: 'Nom de la forme' }).fill('Ma forme');
    await biblio(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(forme(page, 'Ma forme')).toBeVisible();
    await expect(forme(page, 'Ma forme')).toHaveAttribute('aria-pressed', 'true');   // l'accord d'où elle vient la porte
    expect(await formesStockees(page)).toEqual(['Ma forme']);
    expect(await nombreAllume(page, 1)).toBe(8);   // le rythme de l'accord n'a pas changé
    expect(garde.bloquees).toEqual([]);
  });

  test('« Annuler » à l\'enregistrement n\'ajoute aucune forme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Enregistrer la forme/ }).click();
    await biblio(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(biblio(page).getByRole('button', { name: /Créer une forme/ })).toBeVisible();   // retour à la liste
    await expect(formes(page).locator('button.sq-motif')).toHaveCount(0);
    expect(await formesStockees(page)).toEqual([]);
  });

  test('une forme enregistrée s\'applique à un autre accord : mêmes croches, mêmes voix @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    const modele = await notesAllumees(page, 1);
    await enregistrerForme(page, 'Ma pompe');
    await choisirAccord(page, 2);
    await expect(forme(page, 'Ma pompe')).toHaveAttribute('aria-pressed', 'false');
    expect(await nombreAllume(page, 2)).toBe(24);
    await forme(page, 'Ma pompe').click();
    await expect.poll(() => notesAllumees(page, 2)).toEqual(modele);
    await expect(forme(page, 'Ma pompe')).toHaveAttribute('aria-pressed', 'true');
    expect((await motifStocke(page, 0, 2)).motifSeq).toMatch(/^f-/);
    for (const n of [0, 3]) expect(await nombreAllume(page, n)).toBe(24);   // les autres accords n'ont pas bougé
  });

  test('on peut enregistrer le rythme qu\'on vient de dessiner à la main', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    for (const [v, k] of [[0, 0], [2, 4]]) await page.locator(`#sq-grille .sq-case[data-c="1"][data-v="${v}"][data-k="${k}"]`).click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.0:normal', '2.4:normal']);
    await enregistrerForme(page, 'Deux notes');
    await choisirAccord(page, 2);
    await forme(page, 'Deux notes').click();
    await expect.poll(() => notesAllumees(page, 2)).toEqual(['0.0:normal', '2.4:normal']);
  });

  test('« Créer une forme… » : on dessine un schéma de quatre voix, on le nomme, il devient un bouton qu\'on applique @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Créer une forme/ }).click();
    const d = biblio(page);
    await expect(d.getByText('Créer une forme', { exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Tétrade · 4' })).toHaveAttribute('aria-pressed', 'true');
    // quatre lignes (Aiguë, 3e note, 2e note, Grave) × huit croches, toutes vides
    await expect(d.locator('.bi-case')).toHaveCount(32);
    await expect(d.locator('.bi-case[aria-pressed="true"]')).toHaveCount(0);
    await d.getByRole('button', { name: 'Grave, croche 1' }).click();
    await d.getByRole('button', { name: 'Grave, croche 5' }).click();
    await d.getByRole('button', { name: 'Aiguë, croche 3' }).click();
    await expect(d.locator('.bi-case[aria-pressed="true"]')).toHaveCount(3);
    await expect(d.getByRole('textbox')).toHaveValue('Forme 1');
    await d.getByRole('textbox').fill('Ma figure');
    await d.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(forme(page, 'Ma figure')).toBeVisible();
    expect(await formesStockees(page)).toEqual(['Ma figure']);
    // la forme est dans la bibliothèque : on l'applique à l'accord (triade : aiguë = voix 2, grave = voix 0)
    await forme(page, 'Ma figure').click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.0:normal', '0.4:normal', '2.2:normal']);
  });

  test('dans « Créer une forme… », « Triade · 3 » passe à trois lignes et « Effacer » vide le schéma', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Créer une forme/ }).click();
    const d = biblio(page);
    await d.getByRole('button', { name: 'Triade · 3' }).click();
    await expect(d.getByRole('button', { name: 'Triade · 3' })).toHaveAttribute('aria-pressed', 'true');
    await expect(d.locator('.bi-case')).toHaveCount(24);
    await expect(d.getByRole('button', { name: 'Milieu, croche 1' })).toBeVisible();
    await d.getByRole('button', { name: 'Milieu, croche 1' }).click();
    await d.getByRole('button', { name: 'Grave, croche 2' }).click();
    await expect(d.locator('.bi-case[aria-pressed="true"]')).toHaveCount(2);
    await d.getByRole('button', { name: 'Effacer', exact: true }).click();
    await expect(d.locator('.bi-case[aria-pressed="true"]')).toHaveCount(0);
    await d.getByRole('button', { name: 'Annuler' }).click();
    expect(await formesStockees(page)).toEqual([]);
  });

  test('clic droit sur une forme : « Modifier ce schéma… » la renomme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'ballade').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(16);
    await enregistrerForme(page, 'Ma forme');
    await forme(page, 'Ma forme').click({ button: 'right' });
    await expect(page.getByText('Rythme « Ma forme »')).toBeVisible();
    await page.getByText('Modifier ce schéma…').click();
    const editeur = page.getByRole('dialog', { name: 'Modifier le schéma' });
    await expect(editeur).toBeVisible();
    await expect(editeur.getByRole('textbox')).toHaveValue('Ma forme');
    await editeur.getByRole('textbox').fill('Renommée');
    await editeur.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(editeur).toBeHidden();
    await expect(forme(page, 'Renommée')).toBeVisible();
    await expect(forme(page, 'Ma forme')).toHaveCount(0);
    expect(await formesStockees(page)).toEqual(['Renommée']);
  });

  test('« Supprimer cette forme » demande une confirmation, retire le bouton et laisse les accords tels quels @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    await enregistrerForme(page, 'Ma forme');
    await forme(page, 'Ma forme').click({ button: 'right' });
    await page.getByText('Supprimer cette forme').click();
    // premier temps : rien n'est encore supprimé
    await expect(page.getByRole('menuitem', { name: 'Confirmer la suppression' })).toBeVisible();
    await expect(forme(page, 'Ma forme')).toBeVisible();
    expect(await formesStockees(page)).toEqual(['Ma forme']);
    await page.getByRole('menuitem', { name: 'Confirmer la suppression' }).click();
    await expect(formes(page).locator('button.sq-motif')).toHaveCount(0);
    expect(await formesStockees(page)).toEqual([]);
    expect(await nombreAllume(page, 1)).toBe(8);   // l'accord garde le dessin du rythme
  });

  test('une forme retirée par erreur : on renonce à la confirmation, elle reste', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await enregistrerForme(page, 'Ma forme');
    await forme(page, 'Ma forme').click({ button: 'right' });
    await page.getByText('Supprimer cette forme').click();
    await expect(page.getByRole('menuitem', { name: 'Confirmer la suppression' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Confirmer la suppression' })).toBeHidden();
    await expect(forme(page, 'Ma forme')).toBeVisible();
    expect(await formesStockees(page)).toEqual(['Ma forme']);
  });

  test('les formes sont retrouvées après un rechargement, et s\'appliquent à un autre morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'ballade').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(16);
    const modele = await notesAllumees(page, 1);
    await enregistrerForme(page, 'Ma forme');
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await choisirAccord(page, 3);
    await expect(forme(page, 'Ma forme')).toBeVisible();
    await expect(forme(page, 'Ma forme')).toHaveAttribute('aria-pressed', 'false');
    await forme(page, 'Ma forme').click();
    await expect.poll(() => notesAllumees(page, 3)).toEqual(modele);
  });
});

test.describe('Formes personnelles — téléphone @sequenceur @mobile', () => {
  // S-02 (bugs.md) : au téléphone, toucher « Enregistrer la forme… » dans le menu « Tous les rythmes » ferme la feuille d'accord (donc le séquenceur) ;
  // le menu, lui, reste ouvert. À l'ordinateur la grille d'accords n'est pas touchée. Le test exige que la feuille reste ouverte.
  test('« Enregistrer la forme… » laisse la feuille d\'accord et le séquenceur ouverts', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Enregistrer la forme/ }).tap();
    await expect(biblio(page).getByRole('textbox', { name: 'Nom de la forme' })).toBeVisible();
    await expect(fenetre(page)).toBeVisible();
    await expect(sequenceur(page)).toBeVisible();
  });

  test('on enregistre la forme d\'un accord, on rouvre le séquenceur et on l\'applique à un autre @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.locator('#sq-portee-accord').tap();
    await rythme(page, 'pompe').tap();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    const modele = await notesAllumees(page, 1);
    await ouvrirBiblio(page);
    await biblio(page).getByRole('button', { name: /Enregistrer la forme/ }).tap();
    await expect(sequenceur(page)).toBeVisible();   // S-02 (corrigé le 20/11) : la feuille et le séquenceur restent ouverts
    await biblio(page).getByRole('textbox', { name: 'Nom de la forme' }).fill('Ma forme');
    await biblio(page).getByRole('button', { name: 'Enregistrer', exact: true }).tap();
    await expect(biblio(page)).toBeHidden();
    await expect.poll(() => formesStockees(page)).toEqual(['Ma forme']);
    await expect(sequenceur(page)).toBeVisible();
    // on va sur F (même séquenceur, toujours ouvert, encore sur Am : un « Accord suivant ») et on applique la forme
    await choisirAccord(page, 1);
    await forme(page, 'Ma forme').tap();
    await expect.poll(() => notesAllumees(page, 2)).toEqual(modele);
    expect(garde.bloquees).toEqual([]);
  });
});
