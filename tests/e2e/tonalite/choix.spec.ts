// MODULE « tonalite » — choix de la tonalité (tonique + mode) : la fenêtre « Tonalité de référence », les degrés qui changent, les accords qui ne bougent pas,
// l'annulation, l'enregistrement dans le morceau. Ordinateur et téléphone (la fenêtre est la même ; seul l'accès à la puce change).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, noms, puce, fenetre, ouvrirTonalite, choisir, fermerFenetre, boutonTonique, boutonMode, libelle, degres, tonaliteStockee,
  TONIQUES, MODES, appuyer, etat, boutonEnregistrer, racinesStockees, creerMorceau,
} from './aide-tonalite';

test.describe('Choix de la tonalité @tonalite', () => {
  test('la fenêtre propose douze toniques et sept modes ; do majeur est marqué au départ', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await libelle(page)).toBe('C majeur');
    await ouvrirTonalite(page);
    const f = fenetre(page);
    await expect(f.getByText('Tonique', { exact: true })).toBeVisible();
    await expect(f.getByText('Mode', { exact: true })).toBeVisible();
    await expect(f.getByRole('button', { name: new RegExp(`^(${TONIQUES.join('|')})$`) })).toHaveText(TONIQUES);
    await expect(f.getByRole('button', { name: new RegExp(`^(${MODES.map(m => m[1]).join('|')})$`) })).toHaveText(MODES.map(m => m[0]));
    await expect(boutonTonique(page, 'C')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.locator('button[aria-pressed="true"]').filter({ hasText: /^(C|D♭|D|E♭|E|F|F♯|G|A♭|A|B♭|B)$/ })).toHaveCount(1);
    await expect(boutonMode(page, 'Majeur')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('button', { name: /^Suggérer/ })).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('choisir une autre tonique change les degrés et la puce, mais déplace aucun accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await degres(page)).toEqual(['I', 'vi', 'IV', 'V']);
    await choisir(page, 'D');
    expect(await libelle(page)).toBe('D majeur');
    await expect(puce(page)).toContainText('D');
    expect(await degres(page)).toEqual(['bVII', 'v', 'bIII', 'IV']);   // en ré : do = bVII, la = v (mineur), fa = bIII, sol = IV
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);          // « les accords ne bougent pas »
    expect(await racinesStockees(page)).toEqual(['C', 'A', 'F', 'G']);
    await expect(boutonTonique(page, 'D')).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonTonique(page, 'C')).toHaveAttribute('aria-pressed', 'false');
  });

  test('choisir le mode relit les degrés : la mineur donne III i VI VII @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'A', 'Mineur');
    expect(await libelle(page)).toBe('A mineur');
    expect(await degres(page)).toEqual(['III', 'i', 'VI', 'VII']);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(boutonMode(page, 'Mineur')).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonMode(page, 'Majeur')).toHaveAttribute('aria-pressed', 'false');
  });

  test('les sept modes sont proposés ; chacun nomme la tonalité et relit les degrés (do : C Dm Em F G Am Bdim)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [
      { root: 'C', quality: '' }, { root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }, { root: 'F', quality: '' },
      { root: 'G', quality: '' }, { root: 'A', quality: 'min' }, { root: 'B', quality: 'dim' },
    ] });
    await ouvrirTonalite(page);
    const attendu: [string, string, string[]][] = [
      ['Majeur', 'majeur', ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']],
      ['Mineur', 'mineur', ['I', 'ii', '#iii', 'IV', 'V', '#vi', '#vii°']],
      ['Dorien', 'dorien', ['I', 'ii', 'biv', 'IV', 'V', 'vi', 'bi°']],
      ['Lydien', 'lydien', ['I', 'ii', 'iii', 'bIV', 'V', 'vi', 'vii°']],
      ['Locrien', 'locrien', ['I', 'biii', 'biv', 'IV', 'bVI', 'bvii', 'bi°']],
    ];
    for (const [bouton, mot, d] of attendu) {
      await choisir(page, 'C', bouton);
      expect(await libelle(page), bouton).toBe(`C ${mot}`);
      expect(await degres(page), bouton).toEqual(d);
    }
    // Phrygien et mixolydien : seulement le nom (les degrés hors de l'échelle sont écrits par convention : voir le rapport, T-05)
    await choisir(page, 'C', 'Phrygien');
    expect(await libelle(page)).toBe('C phrygien');
    await choisir(page, 'C', 'Mixolydien');
    expect(await libelle(page)).toBe('C mixolydien');
    await expect(puce(page)).toContainText(/mix/);
  });

  test('les douze toniques sont accessibles ; la puce affiche la tonique choisie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTonalite(page);
    for (const t of TONIQUES) {
      await choisir(page, t);
      expect(await libelle(page), t).toBe(`${t} majeur`);
      await expect(puce(page), t).toContainText(t);
    }
  });

  test('la tonalité choisie se défait avec « Annuler » et se refait avec « Rétablir » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'G');
    await fermerFenetre(page);
    expect(await libelle(page)).toBe('G majeur');
    expect(await degres(page)).toEqual(['IV', 'ii', 'bVII', 'I']);
    await appuyer(page, page.getByRole('button', { name: 'Annuler' }));
    await expect.poll(() => libelle(page)).toBe('C majeur');
    expect(await degres(page)).toEqual(['I', 'vi', 'IV', 'V']);
    await appuyer(page, page.getByRole('button', { name: 'Rétablir' }));
    await expect.poll(() => libelle(page)).toBe('G majeur');
    expect(await degres(page)).toEqual(['IV', 'ii', 'bVII', 'I']);
  });

  test('changer la tonalité rend le morceau « Non enregistré » ; « Enregistrer » la range dans le morceau, et elle revient au rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(etat(page)).toContainText('Enregistré');
    await choisir(page, 'E♭', 'Dorien');
    await fermerFenetre(page);
    await expect(etat(page)).toContainText('Non enregistré');
    await appuyer(page, boutonEnregistrer(page));
    await expect(etat(page)).toContainText('Enregistré');
    expect(await tonaliteStockee(page)).toEqual({ root: 'D#', mode: 'dorian' });   // l'appli range les toniques avec des dièses
    page.on('dialog', d => void d.accept());
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect.poll(() => libelle(page)).toBe('E♭ dorien');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('un morceau qui vient d\'être créé est en do majeur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await choisir(page, 'F', 'Mineur');
    await fermerFenetre(page);
    await appuyer(page, boutonEnregistrer(page));
    await expect(etat(page)).toContainText('Enregistré');
    await creerMorceau(page, 'Autre');
    await expect.poll(() => libelle(page)).toBe('C majeur');
    expect(await noms(page)).toEqual([]);
  });

  test('Échap (ordinateur) ou un toucher à côté (téléphone) referme la fenêtre ; un second appui sur la puce aussi', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTonalite(page);
    await fermerFenetre(page);
    await ouvrirTonalite(page);
    await appuyer(page, puce(page));
    await expect(fenetre(page)).toBeHidden();
    await expect(puce(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await libelle(page)).toBe('C majeur');   // fermer sans choisir ne change rien
  });
});
