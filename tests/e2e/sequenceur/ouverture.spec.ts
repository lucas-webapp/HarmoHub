// MODULE « sequenceur » — ouvrir et fermer le séquenceur, sa barre d'outils, sa grille, le choix de l'accord, ce qui est retenu au rechargement.
// Ordinateur : le bouton « Séquenceur » de la barre d'outils ouvre une bande en bas de l'écran. Téléphone : le séquenceur vit dans l'onglet « Rythme »
// de la feuille d'accord, ouverte par le panneau « Lecture » (bouton « … » de la barre de lecture).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, RYTHMES, sequenceur, grille, bouton, rythme, boutonLibre, boutonIntensite, boutonCopier, boutonColler, boutonEffacer, vueAccord, vuePiano,
  ouvrirSequenceur, ouvrirSurAccord, choisirAccord, fenetre, nombreAllume,
} from './aide-sequenceur';

test.describe('Ouvrir et fermer le séquenceur — ordinateur @sequenceur @ordinateur', () => {
  test('le séquenceur est fermé au départ ; le bouton « Séquenceur » l\'ouvre et le referme @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const interrupteur = page.locator('#vue-sequenceur');
    await expect(sequenceur(page)).toBeHidden();
    await expect(interrupteur).toHaveAttribute('aria-pressed', 'false');
    await interrupteur.click();
    await expect(sequenceur(page)).toBeVisible();
    await expect(interrupteur).toHaveAttribute('aria-pressed', 'true');
    await interrupteur.click();
    await expect(sequenceur(page)).toBeHidden();
    await expect(interrupteur).toHaveAttribute('aria-pressed', 'false');
    expect(garde.bloquees).toEqual([]);
  });

  test('la croix « Fermer le séquenceur » le ferme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await bouton(page, 'Fermer le séquenceur').click();
    await expect(sequenceur(page)).toBeHidden();
    await expect(page.locator('#vue-sequenceur')).toHaveAttribute('aria-pressed', 'false');
  });

  test('la barre d\'outils propose les cinq rythmes, la vue, l\'intensité, copier / coller / effacer, les réglages et la croix', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(boutonLibre(page)).toBeVisible();
    for (const [nom, id] of RYTHMES) { await expect(rythme(page, id)).toBeVisible(); await expect(rythme(page, id)).toContainText(nom); }
    await expect(bouton(page, 'Tous les rythmes')).toBeVisible();
    await expect(vueAccord(page)).toBeVisible();
    await expect(vuePiano(page)).toBeVisible();
    await expect(boutonIntensite(page)).toBeVisible();
    await expect(boutonCopier(page)).toBeVisible();
    await expect(boutonColler(page)).toBeVisible();
    await expect(boutonEffacer(page)).toBeVisible();
    await expect(bouton(page, 'Réglages du séquenceur')).toBeVisible();
    await expect(bouton(page, 'Fermer le séquenceur')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Rythme' })).toBeVisible();
  });

  test('la grille montre une colonne par accord (huit croches chacune) et trois lignes par accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await expect(grille(page)).toHaveAttribute('role', 'grid');
    // quatre accords × huit croches × trois voix
    await expect(grille(page).getByRole('gridcell')).toHaveCount(4 * 8 * 3);
    await expect(grille(page).locator('.sq-nom')).toHaveText([/^C\s*I$/, /^Am\s*vi$/, /^F\s*IV$/, /^G\s*V$/]);
    // un accord tenu, jamais retouché : trois notes tenues sur toute la mesure (les voix sont celles de l'accord : G3-E4-C4…)
    for (const c of [0, 1, 2, 3]) expect(await nombreAllume(page, c)).toBe(24);
  });

  test('cliquer le nom d\'un accord dans le séquenceur le choisit, aussi dans la grille d\'accords @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await choisirAccord(page, 2);
    await expect(grille(page).locator('.sq-nom.choisi')).toHaveCount(1);
    await expect(grille(page).locator('.sq-nom.choisi')).toContainText('F');
    await expect(page.locator('#progression-sections .grid-cell[data-index="2"]')).toHaveClass(/\bselected\b/);
    await choisirAccord(page, 3);
    await expect(grille(page).locator('.sq-nom.choisi')).toContainText('G');
    await expect(page.locator('#progression-sections .grid-cell[data-index="3"]')).toHaveClass(/\bselected\b/);
  });

  test('« Coller » est inactif tant que rien n\'a été copié', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(boutonColler(page)).toBeDisabled();
    await expect(boutonColler(page)).toHaveAccessibleName(/rien de copié/);
  });

  test('le séquenceur ouvert, et sa vue, sont retrouvés après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await vuePiano(page).click();
    await expect(vuePiano(page)).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await expect(page.locator('#vue-sequenceur')).toHaveAttribute('aria-pressed', 'true');
    await expect(vuePiano(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(vueAccord(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('fermé, il reste fermé après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await bouton(page, 'Fermer le séquenceur').click();
    await expect(sequenceur(page)).toBeHidden();
    await page.reload();
    await expect(page.locator('#vue-sequenceur')).toHaveAttribute('aria-pressed', 'false');
    await expect(sequenceur(page)).toBeHidden();
  });
});

test.describe('Ouvrir le séquenceur — téléphone @sequenceur @mobile', () => {
  test('le panneau « Lecture » ouvre la feuille d\'accord sur l\'onglet « Rythme » avec le séquenceur @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(sequenceur(page)).toBeHidden();
    await ouvrirSequenceur(page);
    const f = fenetre(page);
    await expect(f).toHaveAccessibleName('Accord C');
    await expect(f.getByRole('button', { name: 'Rythme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const [nom, id] of RYTHMES) { await expect(rythme(page, id)).toBeVisible(); await expect(rythme(page, id)).toContainText(nom); }
    await expect(boutonIntensite(page)).toBeVisible();
    await expect(boutonCopier(page)).toBeVisible();
    await expect(boutonColler(page)).toBeDisabled();
    await expect(boutonEffacer(page)).toBeVisible();
    // une seule colonne (l'accord de la feuille), huit croches, trois voix
    await expect(grille(page).getByRole('gridcell')).toHaveCount(8 * 3);
    expect(garde.bloquees).toEqual([]);
  });

  test('les flèches de la feuille changent d\'accord et le séquenceur suit', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await expect(grille(page).locator('.sq-case[data-c="0"]').first()).toBeAttached();
    await fenetre(page).getByRole('button', { name: 'Accord suivant' }).tap();
    await expect(fenetre(page)).toHaveAccessibleName('Accord Am');
    await expect(grille(page).locator('.sq-case[data-c="1"]').first()).toBeAttached();
    await expect(grille(page).locator('.sq-case[data-c="0"]')).toHaveCount(0);
  });

  test('« Fermer » la feuille ferme le séquenceur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await fenetre(page).getByRole('button', { name: /^Fermer/ }).first().tap();
    await expect(fenetre(page)).toBeHidden();
    await expect(sequenceur(page)).toBeHidden();
  });
});
