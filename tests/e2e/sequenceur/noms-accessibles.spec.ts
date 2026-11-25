// MODULE « sequenceur » — noms accessibles (ES-20, essai neutre du 20/11). Les cases se nomment « Am, E4, croche 1 : vide » (l'accord d'abord : dans une partie de quatre
// accords, quatre cases portaient exactement le même nom) et les boutons de rythme gardent leur NOM, que le schéma soit retouché ou non.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, grille, ouvrirSurAccord } from './aide-sequenceur';

test.describe('Noms accessibles du séquenceur @sequenceur', () => {
  test('chaque case dit son accord : les noms ne se répètent plus d\'un accord à l\'autre @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const noms = await grille(page).locator('[role="gridcell"][data-v="0"][data-k="0"]').evaluateAll(l => l.map(e => e.getAttribute('aria-label')));
    expect(noms).toHaveLength(4);   // un accord par colonne, sur la voix grave, à la première croche
    expect(noms[0]).toMatch(/^C, [A-G]#?\d, croche 1 : /);
    expect(noms[1]).toMatch(/^Am, [A-G]#?\d, croche 1 : /);
    expect(new Set(noms).size).toBe(4);   // quatre noms différents
    // et on retrouve une case par son nom complet
    await expect(grille(page).getByRole('gridcell', { name: /^Am, A\d, croche 1 : / })).toHaveCount(1);
  });

  test('un bouton de rythme garde son nom accessible, quelle que soit son infobulle @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const b = page.locator('#sq-motif-plaque');
    await expect(b).toHaveAttribute('aria-label', 'Plaqué');
    await expect(b).toHaveAttribute('title', /clic droit/);   // l'infobulle, elle, dit toujours comment le modifier : elle n'est plus le nom
    await expect(page.getByRole('button', { name: 'Plaqué', exact: true })).toHaveCount(1);
  });
});
