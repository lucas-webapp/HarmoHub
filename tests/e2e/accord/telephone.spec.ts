// MODULE « accord » — au téléphone, la fenêtre d'accord est une feuille qui monte du bas (`#panneau-accord`) ; double-tape sur la case pour l'ouvrir.
// Mêmes réglages qu'à l'ordinateur (Accord, Voicing, Rythme), mais en une seule feuille défilante, avec Supprimer / Dupliquer en bas.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, ouvrirFenetre, fenetre, fondamentale, basse, choisirOnglet, attendreAccord } from './aide-accord';

test.describe('Panneau d\'accord au téléphone @accord @mobile', () => {
  test('un double-tape sur une case ouvre le panneau : nom, fonction, mesure, trois onglets @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(fenetre(page)).toBeHidden();
    const f = await ouvrirFenetre(page, 0, 1);
    await expect(f).toHaveAccessibleName('Accord Am');
    await expect(f).toContainText('vi');
    await expect(f).toContainText('mes. 2');
    await expect(f.getByTitle('Couplet · accord 2 sur 4')).toBeVisible();
    await expect(f.getByRole('group', { name: 'Accord, son ou rythme' }).getByRole('button')).toHaveText(['Accord', 'Voicing', 'Rythme']);
    // la feuille est collée au bas de l'écran et ne dépasse pas la largeur
    const b = (await f.boundingBox())!, vue = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vue.width + 1);
    expect(b.y).toBeGreaterThan(vue.height * 0.15);
    expect(garde.bloquees).toEqual([]);
  });

  test('un seul toucher sélectionne la case sans ouvrir le panneau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 1).tap();
    await expect(caseN(page, 0, 1)).toHaveClass(/\bselected\b/);
    await expect(fenetre(page)).toBeHidden();
  });

  test('la fondamentale et le type se changent au doigt et la grille suit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await expect(fondamentale(f, 'A')).toHaveAttribute('aria-pressed', 'true');
    await fondamentale(f, 'D').tap();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Dm');
    await f.getByRole('button', { name: 'Dom 7', exact: true }).tap();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('D7');
    await expect(f).toHaveAccessibleName('Accord D7');
    await attendreAccord(page, 0, 1, { root: 'D', quality: 'dom7' });
    expect(await noms(page)).toEqual(['C', 'D7', 'F', 'G']);
  });

  test('la durée se règle au temps près', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await f.getByRole('button', { name: 'Un temps de plus' }).tap();
    await expect(f.getByText('1 mesure et 1 temps')).toBeVisible();
    await attendreAccord(page, 0, 1, { beats: 5 });
    await f.getByRole('button', { name: 'Un temps de moins' }).tap();
    await f.getByRole('button', { name: 'Un temps de moins' }).tap();
    await expect(f.getByText('3 temps', { exact: true })).toBeVisible();
    await attendreAccord(page, 0, 1, { beats: 3 });
  });

  test('l\'onglet Voicing donne octave, renversement, drop et basse @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Monter d\'une octave' }).tap();
    await expect(caseN(page, 0, 1).locator('.cell-meta')).toHaveText('O4');
    await f.getByRole('button', { name: '1er renv.' }).tap();
    await expect(caseN(page, 0, 1).locator('.cell-meta')).toHaveText('O4-R1');
    await f.getByRole('button', { name: 'Drop 2' }).tap();
    await attendreAccord(page, 0, 1, { octave: 4, inversion: 1, drop: 'drop2' });
    await basse(f, 'E').scrollIntoViewIfNeeded();
    await basse(f, 'E').tap();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Am/E');
    await attendreAccord(page, 0, 1, { bass: 'E' });
  });

  test('l\'onglet Rythme propose les formes ; en choisir une l\'applique à l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    await expect(f.getByText('Cet accord')).toBeVisible();
    await expect(f.getByText('Toute la partie')).toBeVisible();
    await f.getByRole('button', { name: 'Arpège ↑' }).tap();
    await attendreAccord(page, 0, 1, { motifSeq: 'monte' });
    await expect(f.getByRole('button', { name: 'Arpège ↑' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('suivant / précédent changent d\'accord, « Fermer » referme la feuille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 0);
    await expect(f.getByRole('button', { name: 'Accord précédent' })).toBeDisabled();
    await f.getByRole('button', { name: 'Accord suivant' }).tap();
    await expect(f).toHaveAccessibleName('Accord Am');
    await f.getByRole('button', { name: 'Accord suivant' }).tap();
    await expect(f).toHaveAccessibleName('Accord F');
    await f.getByRole('button', { name: 'Accord précédent' }).tap();
    await expect(f).toHaveAccessibleName('Accord Am');
    await f.getByRole('button', { name: 'Fermer' }).tap();
    await expect(f).toBeHidden();
  });

  test('« Dupliquer l\'accord » ajoute une copie juste après ; « Supprimer l\'accord » retire l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    page.on('dialog', d => { void d.accept(); });   // l'appli peut demander confirmation avant de supprimer
    const f = await ouvrirFenetre(page, 0, 1);
    await f.getByRole('button', { name: 'Dupliquer l\'accord' }).tap();
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'Am', 'F', 'G']);
    await ouvrirFenetre(page, 0, 3);
    await fenetre(page).getByRole('button', { name: 'Supprimer l\'accord' }).tap();
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'Am', 'G']);
  });

  test('« Réglages du son » (en bas) mène à l\'onglet Voicing, « Moins » revient à l\'onglet Accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await f.getByRole('button', { name: 'Réglages du son' }).tap();
    await expect(f.getByRole('button', { name: 'Voicing', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('group', { name: 'Octave' })).toBeVisible();
    await f.getByRole('button', { name: 'Moins', exact: true }).tap();
    await expect(f.getByRole('button', { name: 'Accord', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('button', { name: 'Réglages du son' })).toBeVisible();
  });
});
