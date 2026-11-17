// MODULE « accord » — onglet « Voicing » : octave, renversement, drop, basse (liste). Ordinateur.
// Chaque réglage s'affiche dans la case sous la forme « O5-R1 » (octave 5, 1er renversement) ou « O5-D2 » (drop 2).
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, ouvrirFenetre, choisirOnglet, basse, attendreAccord } from './aide-accord';

const meta = (page: any, n = 1) => caseN(page, 0, n).locator('.cell-meta');

test.describe('Onglet Voicing @accord @ordinateur', () => {
  test('l\'onglet propose octave, renversement, drop et basse ; l\'état de départ est « fondamental, octave 3 »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await expect(f.getByRole('group', { name: 'Octave' })).toContainText('3');
    await expect(f.getByRole('group', { name: 'Renv.' }).getByRole('button')).toHaveText(['1', '2', '3']);
    await expect(f.getByRole('group', { name: 'Drop' }).getByRole('button')).toHaveText(['2', '3']);
    await expect(f.getByRole('group', { name: 'Renv.' }).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(f.getByRole('group', { name: 'Drop' }).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(f.getByRole('combobox')).toHaveValue('');
    await expect(meta(page)).toHaveText('O3');
  });

  test('l\'octave se règle entre 2 et 5 et se lit dans la case @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    const plus = f.getByRole('button', { name: 'Monter d\'une octave' }), moins = f.getByRole('button', { name: 'Descendre d\'une octave' });
    await plus.click();
    await expect(f.getByRole('group', { name: 'Octave' })).toContainText('4');
    await expect(meta(page)).toHaveText('O4');
    await plus.click();
    await expect(meta(page)).toHaveText('O5');
    await expect(plus).toBeDisabled();            // butée haute
    await attendreAccord(page, 0, 1, { octave: 5 });
    for (let i = 0; i < 3; i++) await moins.click();
    await expect(meta(page)).toHaveText('O2');
    await expect(moins).toBeDisabled();           // butée basse
    await attendreAccord(page, 0, 1, { octave: 2 });
    await expect(meta(page, 0)).toHaveText('O3');   // les voisins ne bougent pas
  });

  test('un renversement se pose, se lit dans la case, et un second clic dessus revient à « fondamental » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    const renv = f.getByRole('group', { name: 'Renv.' });
    await renv.getByRole('button', { name: '1er renv.' }).click();
    await expect(meta(page)).toHaveText('O3-R1');
    await attendreAccord(page, 0, 1, { inversion: 1 });
    await renv.getByRole('button', { name: '2e renv.' }).click();
    await expect(meta(page)).toHaveText('O3-R2');
    await expect(renv.locator('[aria-pressed="true"]')).toHaveText('2');
    await attendreAccord(page, 0, 1, { inversion: 2 });
    await renv.getByRole('button', { name: '2e renv.' }).click();
    await expect(meta(page)).toHaveText('O3');
    await attendreAccord(page, 0, 1, { inversion: 0 });
  });

  test('un drop se pose et se retire de la même façon @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    const drop = f.getByRole('group', { name: 'Drop' });
    await drop.getByRole('button', { name: 'Drop 2' }).click();
    await expect(meta(page)).toHaveText('O3-D2');
    await attendreAccord(page, 0, 1, { drop: 'drop2' });
    await drop.getByRole('button', { name: 'Drop 3' }).click();
    await expect(meta(page)).toHaveText('O3-D3');
    await expect(drop.locator('[aria-pressed="true"]')).toHaveText('3');
    await attendreAccord(page, 0, 1, { drop: 'drop3' });
    await drop.getByRole('button', { name: 'Drop 3' }).click();
    await expect(meta(page)).toHaveText('O3');
    await attendreAccord(page, 0, 1, { drop: 'none' });
  });

  test('renversement et drop se combinent', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: '1er renv.' }).click();
    await f.getByRole('button', { name: 'Drop 2' }).click();
    await attendreAccord(page, 0, 1, { inversion: 1, drop: 'drop2' });
    await expect(f.getByRole('button', { name: '1er renv.' })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('button', { name: 'Drop 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('le 3e renversement n\'existe que pour un accord à quatre sons', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    const troisieme = f.getByRole('button', { name: '3e renv.' });
    await expect(troisieme).toBeDisabled();       // Am : trois sons
    await choisirOnglet(f, 'Accord');
    await f.getByRole('button', { name: 'Min 7', exact: true }).click();
    await choisirOnglet(f, 'Voicing');
    await expect(troisieme).toBeEnabled();        // Am7 : quatre sons
    await troisieme.click();
    await expect(meta(page)).toHaveText('O3-R3');
    await attendreAccord(page, 0, 1, { inversion: 3 });
  });

  test('changer le type remet renversement et drop à zéro et garde l\'octave', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Monter d\'une octave' }).click();
    await f.getByRole('button', { name: '2e renv.' }).click();
    await f.getByRole('button', { name: 'Drop 3' }).click();
    await attendreAccord(page, 0, 1, { inversion: 2, drop: 'drop3', octave: 4 });
    await choisirOnglet(f, 'Accord');
    await f.getByRole('button', { name: 'Majeur', exact: true }).click();
    await attendreAccord(page, 0, 1, { quality: 'maj', inversion: 0, drop: 'none', octave: 4 });
    await expect(meta(page)).toHaveText('O4');
  });

  test('la basse se choisit aussi dans la liste du Voicing, en accord avec la rangée « Basse » de l\'onglet Accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('combobox').selectOption('E');
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Am/E');
    await attendreAccord(page, 0, 1, { bass: 'E' });
    await choisirOnglet(f, 'Accord');
    await expect(basse(f, 'E')).toHaveAttribute('aria-pressed', 'true');
    await basse(f, 'G').click();
    await choisirOnglet(f, 'Voicing');
    await expect(f.getByRole('combobox')).toHaveValue('G');
    await f.getByRole('combobox').selectOption('');
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Am');
  });

  test('les valeurs enregistrées restent des nombres (durée, octave, renversement)', async ({ ouvrirAppli }) => {
    test.fail(true, 'A-01 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await f.getByRole('button', { name: 'Un temps de moins' }).click();
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Monter d\'une octave' }).click();
    await f.getByRole('button', { name: '1er renv.' }).click();
    await expect(meta(page)).toHaveText('O4-R1');
    await expect.poll(async () => {
      const a = await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')!).sections[0].chords[1]);
      return [typeof a.beats, typeof a.octave, typeof a.inversion];
    }).toEqual(['number', 'number', 'number']);
  });
});
