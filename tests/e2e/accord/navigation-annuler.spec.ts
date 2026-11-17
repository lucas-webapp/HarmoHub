// MODULE « accord » — passer d'un accord à l'autre dans la fenêtre, et annuler / rétablir ce qu'on y a fait. Ordinateur.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, ouvrirFenetre, fondamentale, attendreAccord } from './aide-accord';
import { reglagesMorceau } from '../grille/aide-grille';

test.describe('Fenêtre d\'accord — navigation et annulation @accord @ordinateur', () => {
  test('« Accord suivant » et « Accord précédent » parcourent la partie ; aux deux bouts le bouton est inactif @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 0);
    const prec = f.getByRole('button', { name: 'Accord précédent' }), suiv = f.getByRole('button', { name: 'Accord suivant' });
    await expect(prec).toBeDisabled();
    for (const [nom, mes] of [['Am', 'mes. 2'], ['F', 'mes. 3'], ['G', 'mes. 4']]) {
      await suiv.click();
      await expect(f).toHaveAccessibleName(`Accord ${nom}`);
      await expect(f).toContainText(mes);
    }
    await expect(suiv).toBeDisabled();
    await expect(f.getByTitle('Couplet · accord 4 sur 4')).toBeVisible();
    await prec.click();
    await expect(f).toHaveAccessibleName('Accord F');
    await expect(caseN(page, 0, 2)).toHaveClass(/\bselected\b/);   // la sélection de la grille suit
  });

  test('dans un morceau à deux parties, la fenêtre nomme la partie et son nombre d\'accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: C_AM_F_G }, { titre: 'Refrain', accords: [{ root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }] },
    ]) });
    const f = await ouvrirFenetre(page, 1, 1);
    await expect(f).toHaveAccessibleName('Accord Em');
    await expect(f.getByTitle('Refrain · accord 2 sur 2')).toBeVisible();
    await f.getByRole('button', { name: 'Accord précédent' }).click();
    await expect(f).toHaveAccessibleName('Accord Dm');
    await expect(f.getByRole('button', { name: 'Accord précédent' })).toBeDisabled();   // la navigation reste dans la partie
    await caseN(page, 0, 3).click();
    await expect(f).toHaveAccessibleName('Accord G');
    await expect(f.getByTitle('Couplet · accord 4 sur 4')).toBeVisible();
    await expect(f.getByRole('button', { name: 'Accord suivant' })).toBeDisabled();
  });

  test('les réglages faits dans la fenêtre s\'annulent d\'un coup avec Ctrl+Z, et se rétablissent @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await fondamentale(f, 'E').click();
    await f.getByRole('button', { name: 'Dom 7', exact: true }).click();
    await f.getByRole('button', { name: 'Un temps de plus' }).click();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('E7');
    await attendreAccord(page, 0, 1, { root: 'E', quality: 'dom7', beats: 5 });
    await page.keyboard.press('Control+z');
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Am');   // les trois réglages d'un coup
    await attendreAccord(page, 0, 1, { root: 'A', quality: 'min', beats: 4 });
    await page.keyboard.press('Control+y');
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('E7');
    await attendreAccord(page, 0, 1, { root: 'E', quality: 'dom7', beats: 5 });
  });

  test('le bouton « Annuler » de la barre du haut défait aussi un réglage de la fenêtre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 2);
    await f.getByRole('button', { name: 'Maj 7', exact: true }).click();
    await expect(caseN(page, 0, 2).locator('.cell-sym')).toHaveText('Fmaj7');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(caseN(page, 0, 2).locator('.cell-sym')).toHaveText('F');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('ouvrir puis fermer la fenêtre sans rien toucher ne laisse rien à annuler', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await f.getByRole('button', { name: 'Fermer' }).click();
    await expect(f).toBeHidden();
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
  });
});
