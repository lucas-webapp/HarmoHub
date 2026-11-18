// MODULE « tonalite » — « Transposer » : les flèches bas / haut déplacent TOUS les accords d'un demi-ton et la tonalité avec eux (les degrés ne changent
// pas). Contraste avec le choix de la tonalité, qui ne déplace aucun accord. Ordinateur et téléphone.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, noms, libelle, degres, transposerHaut, transposerBas, ouvrirReglages, appuyer, racinesStockees, etat, boutonEnregistrer, tonaliteStockee,
  choisir, fermerFenetre, reglagesMorceau, caseN,
} from './aide-tonalite';
import type { Page } from '@playwright/test';

async function haut(page: Page, fois = 1) { await ouvrirReglages(page); for (let i = 0; i < fois; i++) await appuyer(page, transposerHaut(page)); }
async function bas(page: Page, fois = 1) { await ouvrirReglages(page); for (let i = 0; i < fois; i++) await appuyer(page, transposerBas(page)); }

test.describe('Transposition du morceau @tonalite', () => {
  test('« Transposer vers le haut » monte tous les accords d\'un demi-ton et emmène la tonalité ; les degrés restent @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await haut(page);
    await expect.poll(() => noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    expect(await libelle(page)).toBe('D♭ majeur');
    expect(await degres(page)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(await racinesStockees(page)).toEqual(['C#', 'A#', 'F#', 'G#']);
    expect(garde.bloquees).toEqual([]);
  });

  test('« Transposer vers le bas » descend d\'un demi-ton : do devient si ; la tonalité suit et s\'écrit avec des dièses @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await bas(page);
    await expect.poll(() => noms(page)).toEqual(['B', 'G#m', 'E', 'F#']);
    expect(await libelle(page)).toBe('B majeur');
    expect(await degres(page)).toEqual(['I', 'vi', 'IV', 'V']);
  });

  test('deux pas vers le haut puis deux vers le bas rendent le morceau tel qu\'il était', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await haut(page, 2);
    await expect.poll(() => noms(page)).toEqual(['D', 'Bm', 'G', 'A']);
    expect(await libelle(page)).toBe('D majeur');
    await bas(page, 2);
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    expect(await libelle(page)).toBe('C majeur');
    expect(await racinesStockees(page)).toEqual(['C', 'A', 'F', 'G']);
  });

  test('douze pas vers le haut font le tour : mêmes accords, même tonalité', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await haut(page, 12);
    await expect.poll(() => racinesStockees(page)).toEqual(['C', 'A', 'F', 'G']);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    expect(await libelle(page)).toBe('C majeur');
  });

  test('le mode, les types d\'accord et les basses suivent : A mineur, Cmaj7, G7, Bdim, C/E', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: 'maj7' }, { root: 'G', quality: 'dom7' }, { root: 'B', quality: 'dim' }, { root: 'A', quality: 'min' }] });
    await ouvrirReglages(page);
    await choisir(page, 'A', 'Mineur');
    await fermerFenetre(page);
    await page.evaluate(() => {   // une basse sur le premier accord, posée dans le morceau comme le ferait la fenêtre d'accord
      const p = JSON.parse(localStorage.getItem('myProgression')!); p.sections[0].chords[0].bass = 'E';
      localStorage.setItem('myProgression', JSON.stringify(p));
    });
    // la basse est lue au prochain chargement : on enregistre puis on recharge comme un utilisateur qui rouvre son morceau
    await appuyer(page, boutonEnregistrer(page));
    await expect(etat(page)).toContainText('Enregistré');
    page.on('dialog', d => void d.accept());
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect.poll(() => noms(page)).toEqual(['Cmaj7/E', 'G7', 'Bdim', 'Am']);
    const avant = await degres(page);
    await haut(page);
    await expect.poll(() => noms(page)).toEqual(['D♭maj7/F', 'A♭7', 'Cdim', 'B♭m']);
    expect(await libelle(page)).toBe('B♭ mineur');
    expect(await degres(page)).toEqual(avant);
  });

  test('toutes les parties sont transposées, pas seulement la première', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
      { titre: 'Refrain', accords: [{ root: 'F', quality: '' }, { root: 'D', quality: 'min' }] },
    ]) });
    await haut(page, 2);
    await expect.poll(() => noms(page, 0)).toEqual(['D', 'A']);
    expect(await noms(page, 1)).toEqual(['G', 'Em']);
    await expect(caseN(page, 1, 1).locator('.cell-sym')).toHaveText('Em');
    expect(await racinesStockees(page)).toEqual(['D', 'A', 'G', 'E']);
  });

  test('chaque appui sur une flèche est un pas d\'historique : « Annuler » en défait un seul, « Rétablir » le refait @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await haut(page, 2);
    await expect.poll(() => noms(page)).toEqual(['D', 'Bm', 'G', 'A']);
    await appuyer(page, page.getByRole('button', { name: 'Annuler' }));
    await expect.poll(() => noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    expect(await libelle(page)).toBe('D♭ majeur');
    await appuyer(page, page.getByRole('button', { name: 'Annuler' }));
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    expect(await libelle(page)).toBe('C majeur');
    await appuyer(page, page.getByRole('button', { name: 'Rétablir' }));
    await expect.poll(() => noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
  });

  test('transposer rend le morceau « Non enregistré » ; enregistré, il garde la tonalité transposée au rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(etat(page)).toContainText('Enregistré');
    await haut(page, 2);
    await expect(etat(page)).toContainText('Non enregistré');
    await appuyer(page, boutonEnregistrer(page));
    await expect(etat(page)).toContainText('Enregistré');
    expect(await tonaliteStockee(page)).toEqual({ root: 'D', mode: 'maj' });
    page.on('dialog', d => void d.accept());
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect.poll(() => noms(page)).toEqual(['D', 'Bm', 'G', 'A']);
    expect(await libelle(page)).toBe('D majeur');
  });

  test('transposer ne perd rien : durée des accords et nombre de cases inchangés', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '', beats: 8 }, { root: 'A', quality: 'min', beats: 2 }, { root: 'F', quality: '', beats: 6 }] });
    await haut(page, 3);
    await expect.poll(() => noms(page)).toEqual(['E♭', 'Cm', 'A♭']);
    const beats = await page.evaluate(() => (JSON.parse(localStorage.getItem('myProgression')!).sections as any[]).flatMap(s => s.chords.map((c: any) => Number(c.beats))));
    expect(beats).toEqual([8, 2, 6]);
  });
});
