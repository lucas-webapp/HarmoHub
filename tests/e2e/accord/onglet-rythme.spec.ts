// MODULE « accord » — onglet « Rythme » : choisir la forme jouée par l'accord (Libre, Plaqué, Arpège, Pompe, Ballade, Autres). Ordinateur.
// Le détail des notes se joue dans le séquenceur (module `sequenceur`) : ici on vérifie le choix, son effet sur CET accord et l'ouverture du séquenceur.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, ouvrirFenetre, choisirOnglet, accordStocke, attendreAccord } from './aide-accord';

const FORMES: [string, string][] = [['Plaqué', 'plaque'], ['Arpège ↑', 'monte'], ['Arpège ↓', 'descend'], ['Pompe', 'pompe'], ['Ballade', 'ballade']];

test.describe('Onglet Rythme @accord @ordinateur', () => {
  test('l\'onglet propose sept formes, et le séquenceur est fermé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    const formes = f.getByRole('group', { name: 'Rythme de l\'accord' });
    await expect(formes.getByRole('button')).toHaveText(['Libre', 'Plaqué', 'Arpège ↑', 'Arpège ↓', 'Pompe', 'Ballade', 'Autres']);
    await expect(f.getByRole('button', { name: 'Ouvrir le séquenceur' })).toBeVisible();
    await expect(page.locator('#sequenceur')).toBeHidden();
  });

  test('choisir une forme l\'applique à l\'accord et ouvre le séquenceur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    const formes = f.getByRole('group', { name: 'Rythme de l\'accord' });
    await formes.getByRole('button', { name: 'Plaqué' }).click();
    await expect(formes.locator('[aria-pressed="true"]')).toHaveText('Plaqué');
    await expect(page.locator('#sequenceur')).toBeVisible();
    await attendreAccord(page, 0, 1, { motifSeq: 'plaque' });
    expect((await accordStocke(page, 0, 1)).arpPattern).toBeTruthy();
    // les autres accords gardent le rythme de départ (aucune forme)
    for (const n of [0, 2, 3]) expect((await accordStocke(page, 0, n)).motifSeq).toBeUndefined();
  });

  test('chacune des cinq formes se marque choisie et s\'enregistre sous son nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    const formes = f.getByRole('group', { name: 'Rythme de l\'accord' });
    const motifs = new Set<string>();
    for (const [bouton, motif] of FORMES) {
      await formes.getByRole('button', { name: bouton }).click();
      await expect(formes.locator('[aria-pressed="true"]'), bouton).toHaveText(bouton);
      await attendreAccord(page, 0, 1, { motifSeq: motif });
      motifs.add((await accordStocke(page, 0, 1)).arpPattern!);
    }
    expect(motifs.size, 'cinq formes = cinq motifs de notes différents').toBe(5);
  });

  test('« Libre » efface la forme : l\'accord n\'a plus de motif', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    const formes = f.getByRole('group', { name: 'Rythme de l\'accord' });
    await formes.getByRole('button', { name: 'Pompe' }).click();
    await attendreAccord(page, 0, 1, { motifSeq: 'pompe' });
    await formes.getByRole('button', { name: 'Libre' }).click();
    await expect(formes.locator('[aria-pressed="true"]')).toHaveText('Libre');
    await expect.poll(async () => (await accordStocke(page, 0, 1)).motifSeq).toBeUndefined();
    await expect.poll(async () => ((await accordStocke(page, 0, 1)).arpPattern ?? '').replace(/;/g, '')).toBe('');
  });

  test('la forme choisie est retrouvée en revenant sur l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    await f.getByRole('button', { name: 'Ballade' }).click();
    await attendreAccord(page, 0, 1, { motifSeq: 'ballade' });
    await f.getByRole('button', { name: 'Accord suivant' }).click();
    await expect(f).toHaveAccessibleName('Accord F');
    await expect(f.getByRole('group', { name: 'Rythme de l\'accord' }).getByRole('button', { name: 'Ballade' })).toHaveAttribute('aria-pressed', 'false');
    await f.getByRole('button', { name: 'Accord précédent' }).click();
    await expect(f.getByRole('group', { name: 'Rythme de l\'accord' }).locator('[aria-pressed="true"]')).toHaveText('Ballade');
  });

  test('« Ouvrir le séquenceur » ouvre le séquenceur sans changer la forme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    await f.getByRole('button', { name: 'Ouvrir le séquenceur' }).click();
    await expect(page.locator('#sequenceur')).toBeVisible();
    expect((await accordStocke(page, 0, 1)).motifSeq).toBeUndefined();
  });

  // A-03 (bugs.md) : un accord tenu, jamais retouché, n'est marqué « Plaqué » que quelques instants après l'ouverture du séquenceur ; séquenceur fermé,
  // aucune forme n'est marquée. Le test exige la lecture « un accord tenu est un accord Plaqué », séquenceur fermé comme ouvert.
  test('un accord tenu est marqué « Plaqué », séquenceur fermé comme ouvert', async ({ ouvrirAppli }) => {
    test.fail(true, 'A-03 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    const marquees = f.getByRole('group', { name: 'Rythme de l\'accord' }).locator('[aria-pressed="true"]');
    await expect(page.locator('#sequenceur')).toBeHidden();
    await expect(marquees).toHaveText('Plaqué');
    await f.getByRole('button', { name: 'Ouvrir le séquenceur' }).click();
    await expect(page.locator('#sequenceur')).toBeVisible();
    await expect(marquees).toHaveText('Plaqué');
  });

  test('« Autres » ouvre la bibliothèque des rythmes avec les cinq formes et les deux entrées « forme »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    await f.getByRole('button', { name: 'Autres' }).click();
    const biblio = page.getByRole('dialog', { name: 'Tous les rythmes' });
    await expect(biblio).toBeVisible();
    for (const [nom] of FORMES) await expect(biblio).toContainText(nom);
    await expect(biblio).toContainText('Enregistrer la forme');
    await expect(biblio).toContainText('Créer une forme');
    await expect(f).toBeVisible();   // la fenêtre d'accord reste ouverte derrière
  });

  test('un rythme choisi dans la bibliothèque s\'applique à l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Rythme');
    await f.getByRole('button', { name: 'Autres' }).click();
    const biblio = page.getByRole('dialog', { name: 'Tous les rythmes' });
    await biblio.getByText('Arpège ↓').first().click();
    await attendreAccord(page, 0, 1, { motifSeq: 'descend' });
  });
});
