// MODULE « sequenceur » — les cinq rythmes prédéfinis (Plaqué, Arpège ↑, Arpège ↓, Pompe, Ballade), le rythme libre « + », « Effacer »,
// le menu du clic droit sur un rythme (modifier le schéma, masquer, rétablir) et, au téléphone, la portée « Toute la partie / Cet accord ».
// La grille est lue par ses cases : « voix.croche:niveau » (voix 0 = la plus grave). Les nombres de notes viennent de l'observation de l'appli.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, RYTHMES, rythme, boutonLibre, boutonEffacer, sequenceur, cellule, ouvrirSurAccord, notesAllumees, nombreAllume, croches,
  motifStocke, attendreNiveau, toucher,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

// Nombre de cases allumées pour chaque rythme sur un accord de trois notes, et ce qui le distingue.
const ATTENDU: Record<string, number> = { plaque: 24, monte: 12, descend: 12, pompe: 8, ballade: 14 };   // 12 / 12 / 14 depuis le 22/11 : les arpèges et la Ballade perdent la voix qu'une triade n'a pas (EB-07)

test.describe('Rythmes prédéfinis — ordinateur @sequenceur @ordinateur', () => {
  test('chacun des cinq rythmes se marque choisi, remplit la grille de l\'accord et s\'enregistre sous son nom @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const signatures = new Set<string>();
    for (const [nom, id] of RYTHMES) {
      await rythme(page, id).click();
      await expect(rythme(page, id), nom).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => (await motifStocke(page, 0, 1)).motifSeq, nom).toBe(id);
      await expect.poll(() => nombreAllume(page, 1), nom).toBe(ATTENDU[id]);
      signatures.add((await notesAllumees(page, 1)).join(' '));
      // un seul rythme est marqué choisi à la fois
      await expect(sequenceur(page).locator('.sq-motifs [aria-pressed="true"]')).toHaveCount(1);
    }
    expect(signatures.size, 'cinq rythmes = cinq dessins différents').toBe(5);
    expect(garde.bloquees).toEqual([]);
  });

  test('un rythme ne touche que l\'accord choisi', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    for (const c of [0, 2, 3]) expect(await nombreAllume(page, c), `accord ${c}`).toBe(24);
    for (const n of [0, 2, 3]) expect((await motifStocke(page, 0, n)).motifSeq).toBeUndefined();
  });

  test('Arpège ↑ joue les notes du grave à l\'aigu, Arpège ↓ de l\'aigu au grave', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    // dans les deux arpèges la voix grave (0) est tenue ; voix 1 = note du milieu, voix 2 = note aiguë
    await rythme(page, 'monte').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(12);
    expect(await croches(page, 1, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const milieuMonte = (await croches(page, 1, 1))[0], aigueMonte = (await croches(page, 1, 2))[0];
    expect(milieuMonte, 'montant : le milieu avant l\'aigu').toBeLessThan(aigueMonte);
    await rythme(page, 'descend').click();
    await expect.poll(async () => (await croches(page, 1, 2))[0]).toBeLessThan((await croches(page, 1, 1))[0] ?? 99);
    expect(await nombreAllume(page, 1)).toBe(12);
  });

  test('Pompe : la basse puis l\'accord, deux fois par mesure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    expect(await croches(page, 1, 0), 'la basse tombe sur les temps 1 et 3, tenue une noire').toEqual([0, 1, 4, 5]);
    expect(await croches(page, 1, 1), 'l\'accord (deux notes) répond sur les temps 2 et 4').toEqual([2, 6]);
    expect(await croches(page, 1, 2)).toEqual([2, 6]);
  });

  test('un rythme remplace le précédent, Annuler le rend @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'ballade').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(14);
    await rythme(page, 'plaque').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(24);
    await expect(rythme(page, 'ballade')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Control+z');
    await expect.poll(() => nombreAllume(page, 1)).toBe(14);
    await expect(rythme(page, 'ballade')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => nombreAllume(page, 1)).toBe(24);
  });

  test('chaque accord garde son rythme : on le retrouve en revenant sur lui', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#sq-grille .sq-nom[data-c="2"]').click();
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'false');
    await rythme(page, 'ballade').click();
    await expect(rythme(page, 'ballade')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#sq-grille .sq-nom[data-c="1"]').click();
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'true');
    await expect(rythme(page, 'ballade')).toHaveAttribute('aria-pressed', 'false');
  });

  test('le rythme choisi est retrouvé après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).motifSeq).toBe('pompe');
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await page.locator('#sq-grille .sq-nom[data-c="1"]').click();
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'true');
    expect(await nombreAllume(page, 1)).toBe(8);
  });
});

test.describe('Rythme libre et « Effacer » — ordinateur @sequenceur @ordinateur', () => {
  test('« Effacer » vide le rythme de l\'accord sans toucher aux autres, et se défait @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(boutonEffacer(page)).toHaveAccessibleName('Effacer le rythme de cet accord');
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    for (const c of [0, 2, 3]) expect(await nombreAllume(page, c)).toBe(24);
    expect(((await motifStocke(page, 0, 1)).arpPattern ?? '').replace(/;/g, '')).toBe('');
    await expect(boutonLibre(page)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Control+z');
    await expect.poll(() => nombreAllume(page, 1)).toBe(24);
  });

  test('retoucher une note d\'un rythme prédéfini le fait passer en « rythme libre » (+)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonLibre(page)).toHaveAttribute('aria-pressed', 'false');
    // pose une croche de plus sur la voix grave (case vide), comme l'utilisateur
    await cellule(page, 1, 0, 7).click();
    await attendreNiveau(cellule(page, 1, 0, 7), 'normal');
    await expect(boutonLibre(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => nombreAllume(page, 1)).toBe(9);
  });
});

test.describe('Menu d\'un rythme (clic droit) — ordinateur @sequenceur @ordinateur', () => {
  test('« Masquer ce rythme » retire le bouton, « Rétablir » le ramène', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const retablir = page.locator('#sq-rythmes-retablir');
    await expect(retablir).toBeHidden();
    await rythme(page, 'ballade').click({ button: 'right' });
    await expect(page.getByText('Rythme « Ballade »')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Masquer ce rythme' }).or(page.getByText('Masquer ce rythme')).first().click();
    await expect(rythme(page, 'ballade')).toBeHidden();
    await expect(retablir).toBeVisible();
    await expect(retablir).toContainText('(1)');
    await retablir.click();
    await expect(rythme(page, 'ballade')).toBeVisible();
    await expect(retablir).toBeHidden();
  });

  test('« Modifier ce schéma… » ouvre l\'éditeur du rythme ; « Annuler » le ferme sans rien changer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click({ button: 'right' });
    await page.getByText('Modifier ce schéma…').click();
    const editeur = page.getByRole('dialog', { name: 'Modifier le schéma' });
    await expect(editeur).toBeVisible();
    await expect(editeur.getByRole('textbox')).toHaveValue('Pompe');
    await expect(editeur.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await expect(editeur.getByRole('button', { name: 'Rétablir l\'original' })).toBeHidden();
    await editeur.getByRole('button', { name: 'Annuler' }).click();
    await expect(editeur).toBeHidden();
    expect(await nombreAllume(page, 1)).toBe(24);   // l'accord n'a pas bougé (aucun rythme choisi)
  });

  test('modifier le schéma d\'un rythme puis « Rétablir l\'original » le rend tel qu\'avant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const editeur = page.getByRole('dialog', { name: 'Modifier le schéma' });
    const ouvrirEditeur = async () => {
      await rythme(page, 'pompe').click({ button: 'right' });
      await page.getByText('Modifier ce schéma…').click();
      await expect(editeur).toBeVisible();
    };
    await ouvrirEditeur();
    // l'éditeur montre quatre voix de huit croches ; on pose la voix 1 (grave) à la croche 8, qui est vide dans « Pompe »
    const caseVide = editeur.getByRole('button', { name: 'Voix 1, croche 8 : vide' });
    await expect(caseVide).toHaveAttribute('aria-pressed', 'false');
    await caseVide.click();
    await expect(editeur.getByRole('button', { name: 'Voix 1, croche 8 : posée' })).toHaveAttribute('aria-pressed', 'true');
    await editeur.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(editeur).toBeHidden();
    // le rythme appliqué à l'accord est celui qui a été modifié : une croche de plus
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(9);
    // « Rétablir l'original » n'apparaît que sur un schéma modifié
    await ouvrirEditeur();
    await expect(editeur.getByRole('button', { name: 'Rétablir l\'original' })).toBeVisible();
    await editeur.getByRole('button', { name: 'Rétablir l\'original' }).click();
    await expect(editeur).toBeHidden();
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
  });
});

test.describe('Rythmes — téléphone @sequenceur @mobile', () => {
  test('un rythme s\'applique à toute la partie par défaut, à l\'accord seul avec « Cet accord » @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const partie = page.locator('#sq-portee-partie'), accord = page.locator('#sq-portee-accord');
    await expect(partie).toHaveAttribute('aria-pressed', 'true');
    await expect(accord).toHaveAttribute('aria-pressed', 'false');
    await rythme(page, 'pompe').tap();
    for (const n of [0, 1, 2, 3]) await expect.poll(async () => (await motifStocke(page, 0, n)).motifSeq, `accord ${n}`).toBe('pompe');
    await accord.tap();
    await expect(accord).toHaveAttribute('aria-pressed', 'true');
    await rythme(page, 'ballade').tap();
    await expect.poll(async () => (await motifStocke(page, 0, 1)).motifSeq).toBe('ballade');
    for (const n of [0, 2, 3]) expect((await motifStocke(page, 0, n)).motifSeq, `accord ${n}`).toBe('pompe');
    expect(garde.bloquees).toEqual([]);
  });

  test('chacun des cinq rythmes remplit la grille de l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.locator('#sq-portee-accord').tap();
    for (const [nom, id] of RYTHMES) {
      await rythme(page, id).tap();
      await expect(rythme(page, id), nom).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => nombreAllume(page, 1), nom).toBe(ATTENDU[id]);
    }
  });

  test('« Effacer » vide l\'accord, un toucher sur une case pose une note', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.locator('#sq-portee-accord').tap();
    await boutonEffacer(page).tap();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await toucher(page, cellule(page, 1, 1, 3));
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    expect(await notesAllumees(page, 1)).toEqual(['1.3:normal']);
  });
});
