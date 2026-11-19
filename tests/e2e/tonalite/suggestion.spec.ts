// MODULE « tonalite » — « Suggérer une tonalité d'après les accords du morceau » : la liste classée (pourcentage, coche « confirmée »), le choix d'une
// proposition, le morceau vide, la fermeture. Ordinateur et téléphone.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, noms, fenetre, menuSuggestion, boutonSuggerer, ouvrirTonalite, fermerFenetre, libelle, degres, boutonTonique, boutonMode, appuyer,
} from './aide-tonalite';

const propositions = (page: Page) => menuSuggestion(page).locator('button');
const etiquettes = (page: Page) => menuSuggestion(page).locator('.key-suggest-label');

async function suggerer(page: Page) {
  await ouvrirTonalite(page);
  await appuyer(page, boutonSuggerer(page));
  await expect(menuSuggestion(page)).toBeVisible();
}

test.describe('Suggestion de tonalité @tonalite', () => {
  test('« C Am F G » : do majeur arrive en tête, confirmé par la coche, avec un pourcentage par proposition @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await suggerer(page);
    await expect(etiquettes(page).first()).toHaveText('C majeur');
    await expect(propositions(page).first()).toContainText('✓');
    await expect(etiquettes(page).nth(1)).toHaveText('A mineur');   // la relative mineure suit
    const n = await propositions(page).count();
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
    await expect(menuSuggestion(page).locator('.key-suggest-pct')).toHaveText(new Array(n).fill(/^\d{1,3}%( ✓)?$/));
    // classées de la plus à la moins probable
    const pct = (await menuSuggestion(page).locator('.key-suggest-pct').allTextContents()).map(t => parseInt(t, 10));
    expect(pct).toEqual([...pct].sort((a, b) => b - a));
    expect(garde.bloquees).toEqual([]);
  });

  test('choisir « A mineur » dans la liste règle tonique et mode, relit les degrés et referme la liste @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await suggerer(page);
    await appuyer(page, propositions(page).filter({ hasText: 'A mineur' }));
    await expect(menuSuggestion(page)).toBeHidden();
    await expect.poll(() => libelle(page)).toBe('A mineur');
    await expect(boutonTonique(page, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonMode(page, 'Mineur')).toHaveAttribute('aria-pressed', 'true');
    expect(await degres(page)).toEqual(['III', 'i', 'VI', 'VII']);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);   // la suggestion ne déplace aucun accord
  });

  test('un morceau en mineur (Cm Fm G7 Cm) est reconnu : do mineur en tête', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: 'min' }, { root: 'F', quality: 'min' }, { root: 'G', quality: 'dom7' }, { root: 'C', quality: 'min' }] });
    await suggerer(page);
    await expect(etiquettes(page).first()).toHaveText('C mineur');
    await expect(propositions(page).first()).toContainText('✓');
    await appuyer(page, propositions(page).first());
    await expect.poll(() => libelle(page)).toBe('C mineur');
    expect(await degres(page)).toEqual(['i', 'iv', 'V7', 'i']);
  });

  test('un ii-V-I de jazz (Cm7 F7 B♭maj7) est reconnu en si bémol majeur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [
      { root: 'C', quality: 'min7' }, { root: 'F', quality: 'dom7' }, { root: 'A#', quality: 'maj7' }, { root: 'A#', quality: 'maj7' },
    ] });
    await suggerer(page);
    await expect(etiquettes(page).first()).toHaveText('B♭ majeur');
    await appuyer(page, propositions(page).first());
    await expect.poll(() => libelle(page)).toBe('B♭ majeur');
    await expect(boutonTonique(page, 'B♭')).toHaveAttribute('aria-pressed', 'true');
    expect((await degres(page)).slice(0, 2)).toEqual(['ii7', 'V7']);
  });

  test('sans accord, la suggestion prévient au lieu de proposer et ne change rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ouvrirTonalite(page);
    await appuyer(page, boutonSuggerer(page));
    await expect(page.locator('#toast')).toContainText('Pose d\'abord quelques accords dans la grille pour pouvoir analyser la tonalité');
    await expect(menuSuggestion(page)).toBeHidden();
    expect(await libelle(page)).toBe('C majeur');
  });

  test('la suggestion suit le morceau : on pose d\'autres accords, la proposition change', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await suggerer(page);
    await expect(etiquettes(page).first()).toHaveText('C majeur');
    await page.keyboard.press('Escape');   // referme la liste ; fermerFenetre referme ensuite la fenêtre
    await expect(menuSuggestion(page)).toBeHidden();
    await fermerFenetre(page);
    // on remplace le morceau par D Bm G A (ré majeur) : stockage + rechargement, comme un morceau ouvert
    await page.evaluate(() => {
      const mk = (r: string, q: string) => ({ root: r, quality: q, beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });
      const s = [{ title: 'Couplet', chords: [mk('D', ''), mk('B', 'min'), mk('G', ''), mk('A', '')] }];
      localStorage.setItem('myProgression', JSON.stringify({ sections: s }));
    });
    page.on('dialog', d => void d.accept());
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await suggerer(page);
    await expect(etiquettes(page).first()).toHaveText('D majeur');
  });

  test('Échap referme d\'abord la liste, puis la fenêtre (ordinateur) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await suggerer(page);
    await page.keyboard.press('Escape');
    await expect(menuSuggestion(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
  });

  test('la proposition choisie se défait avec « Annuler » (comme un choix de tonique)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await suggerer(page);
    await appuyer(page, propositions(page).filter({ hasText: 'A mineur' }));
    await expect.poll(() => libelle(page)).toBe('A mineur');
    await fermerFenetre(page);
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeEnabled();
    await appuyer(page, page.getByRole('button', { name: 'Annuler' }));
    await expect.poll(() => libelle(page)).toBe('C majeur');
  });
});
