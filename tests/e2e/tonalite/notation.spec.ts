// MODULE « tonalite » — notation : les dièses et les bémols suivent la tonalité. L'appli range toujours une fondamentale avec un dièse (« Eb » tapé est
// enregistré « D# ») et l'ÉCRIT selon la tonalité : bémols en do, dièses dans les tonalités à dièses (« D# » en mi). Ordinateur et téléphone.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, noms, libelle, libelleBrut, ouvrirTonalite, choisir, fermerFenetre, racinesStockees, taper, DOUZE, boutonTonique, puce, caseN,
} from './aide-tonalite';
import type { Page } from '@playwright/test';

const ECRITURE_DO = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// Les douze fondamentales (stockées en dièses) vues dans la grille quand la tonalité est `tonique` + `mode`.
async function lesDouze(page: Page, tonique: string, mode = 'Majeur'): Promise<string[]> {
  await choisir(page, tonique, mode);
  return noms(page);
}

test.describe('Notation : dièses et bémols selon la tonalité @tonalite', () => {
  test('en do majeur, les douze fondamentales s\'écrivent avec des bémols (D♭ E♭ G♭ A♭ B♭) @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: DOUZE });
    expect(await noms(page)).toEqual(ECRITURE_DO);
    expect(await racinesStockees(page)).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);   // enregistrées en dièses
    expect(garde.bloquees).toEqual([]);
  });

  test('« Eb », « Bb », « F# », « C#m » tapés s\'écrivent en do : E♭ B♭ G♭ D♭m, et sont enregistrés avec des dièses @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    await taper(page, 'Eb//Bb//F#//C#m');
    await expect.poll(() => noms(page)).toEqual(['C', 'E♭', 'B♭', 'G♭', 'D♭m']);
    expect(await racinesStockees(page)).toEqual(['C', 'D#', 'A#', 'F#', 'C#']);
  });

  test('« Eb » et « D# » tapés sont le même accord ; seule la tonalité décide de l\'écriture : E♭ en do, D# en mi @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    await taper(page, 'Eb//D#//Db//C#');
    await expect.poll(() => noms(page)).toEqual(['C', 'E♭', 'E♭', 'D♭', 'D♭']);
    expect(await racinesStockees(page)).toEqual(['C', 'D#', 'D#', 'C#', 'C#']);
    await choisir(page, 'E');
    await fermerFenetre(page);
    await expect.poll(() => noms(page)).toEqual(['C', 'D#', 'D#', 'C#', 'C#']);   // en mi majeur : D# et C# sont dans l'armure
    expect(await racinesStockees(page)).toEqual(['C', 'D#', 'D#', 'C#', 'C#']);   // changer la tonalité ne retouche pas les accords
  });

  test('une basse tapée « C/Eb » est enregistrée avec un dièse (D#) et s\'écrit C/E♭ en fa majeur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: '' }] });
    await choisir(page, 'F');
    await fermerFenetre(page);
    await taper(page, 'C/Eb');
    await expect.poll(() => noms(page)).toEqual(['D', 'C/E♭']);
    const basse = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')!).sections[0].chords[1].bass);
    expect(basse).toBe('D#');
  });

  test('T-03 : en do majeur, la basse s\'écrit comme la fondamentale : « C/Eb » donne C/E♭, comme « Eb » donne E♭', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: '' }] });
    await taper(page, 'C/Eb//Eb');
    await expect.poll(() => noms(page)).toEqual(['D', 'C/E♭', 'E♭']);
  });

  test('T-03 : en mi majeur, la basse « F# » s\'écrit comme la fondamentale F# (« D/F# »), pas D/G♭', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: '' }] });
    await choisir(page, 'E');
    await fermerFenetre(page);
    await taper(page, 'D/F#//F#');
    await expect.poll(() => noms(page)).toEqual(['D', 'D/F#', 'F#']);
  });

  test('dans les tonalités à dièses, les notes de l\'armure s\'écrivent en dièses, les autres en bémols', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: DOUZE });
    const attendu: Record<string, string[]> = {
      G: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B'],            // un dièse : fa#
      D: ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B'],            // deux : fa#, do#
      A: ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B♭', 'B'],            // trois : + sol#
      E: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B♭', 'B'],            // quatre : + ré#
      B: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],            // cinq : + la#
      'F♯': ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],         // six
    };
    for (const [tonique, noms12] of Object.entries(attendu)) expect(await lesDouze(page, tonique), `${tonique} majeur`).toEqual(noms12);
  });

  test('dans les tonalités à bémols, tout s\'écrit en bémols (fa, si bémol, mi bémol, la bémol)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: DOUZE });
    for (const t of ['F', 'B♭', 'E♭', 'A♭']) expect(await lesDouze(page, t), `${t} majeur`).toEqual(ECRITURE_DO);
  });

  test('les tonalités mineures suivent la même règle : do et ré mineur en bémols, la et mi mineur avec leurs dièses', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: DOUZE });
    expect(await lesDouze(page, 'C', 'Mineur')).toEqual(ECRITURE_DO);
    expect(await lesDouze(page, 'D', 'Mineur')).toEqual(ECRITURE_DO);
    expect(await lesDouze(page, 'A', 'Mineur')).toEqual(['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B♭', 'B']);
    expect(await lesDouze(page, 'E', 'Mineur')).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B♭', 'B']);
  });

  test('la fenêtre de tonalité écrit ses toniques avec ♯ et ♭ (F♯, B♭) et le choix d\'une altérée est pris en compte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTonalite(page);
    await expect(boutonTonique(page, 'F♯')).toBeVisible();
    await expect(boutonTonique(page, 'B♭')).toBeVisible();
    await choisir(page, 'F♯');
    await expect(puce(page)).toContainText('F♯');
    await expect.poll(() => libelle(page)).toBe('F♯ majeur');
    await choisir(page, 'B♭', 'Mineur');
    await expect.poll(() => libelle(page)).toBe('B♭ mineur');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('T-01 : la tonalité s\'écrit pareil dans la fenêtre et dans le résumé du morceau (F♯ / F♯)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'F♯');
    expect(await libelleBrut(page)).toBe('F♯ majeur');
  });

  test('un accord posé en bémol garde sa case à jour quand on change de tonalité (aucun accord perdu, même durée)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'A#', quality: 'maj7' }, { root: 'D#', quality: 'dom7' }] });
    await expect.poll(() => noms(page)).toEqual(['B♭maj7', 'E♭7']);
    await choisir(page, 'B');
    await fermerFenetre(page);
    await expect.poll(() => noms(page)).toEqual(['A#maj7', 'D#7']);
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('A#maj7');
    expect(await racinesStockees(page)).toEqual(['A#', 'D#']);
  });
});
