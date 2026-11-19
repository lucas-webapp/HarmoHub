// MODULE « tonalite » — degrés (chiffres romains) au-dessus des cases : leur écriture selon le type d'accord (majeur, mineur, diminué, septième, sus, dominante
// secondaire). Ordinateur et téléphone.
import { test, expect } from '../support/fixtures';
import { degres, taper } from './aide-tonalite';

test.describe('Degrés au-dessus des cases @tonalite', () => {
  test('la qualité de l\'accord se lit dans le chiffre : majuscule, minuscule, ° (diminué), ø (m7b5), 7, sus4 @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: [
      { root: 'C', quality: '' }, { root: 'D', quality: 'min' }, { root: 'B', quality: 'dim' }, { root: 'G', quality: 'dom7' },
      { root: 'A', quality: 'min7' }, { root: 'B', quality: 'm7b5' }, { root: 'F', quality: 'sus4' },
    ] });
    expect(await degres(page)).toEqual(['I', 'ii', 'vii°', 'V7', 'vi7', 'viiø', 'IVsus4']);
    expect(garde.bloquees).toEqual([]);
  });

  test('un accord étranger à la tonalité est marqué par un bémol (E♭ en do : bIII) et une dominante secondaire par « V7/… » (D7 : V7/V)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D#', quality: '' }, { root: 'A#', quality: '' }, { root: 'D', quality: 'dom7' }, { root: 'G', quality: '' }] });
    expect(await degres(page)).toEqual(['bIII', 'bVII', 'V7/V', 'V']);
  });

  test('un accord ajouté reçoit son chiffre à la suite : F en do majeur (C G) donne IV', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] });
    expect(await degres(page)).toEqual(['I', 'V']);
    await taper(page, 'F');
    await expect.poll(() => degres(page)).toEqual(['I', 'V', 'IV']);
  });

  test('T-04 : un accord de septième majeure et un accord de septième de dominante n\'ont pas le même chiffre (Fmaj7 ≠ F7)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'F', quality: 'maj7' }, { root: 'F', quality: 'dom7' }] });
    const d = await degres(page);
    expect(d[0]).not.toBe(d[1]);
  });
});
