// MODULE « structure » — la fenêtre OUVERTE suit le morceau quand il change sous elle (essai neutre du 25/11, SN-03) : « Nouveau morceau », ou
// une modification venue d'un autre onglet du même appareil. Avant, la liste gardait l'ancien arrangement et un clic dessus agissait sur le nouveau morceau.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, lire, titresLignes, plus, monter, appuyer, lignes, creerMorceau, structureStockee, fenetre,
} from './aide-structure';
import { ouvrirOnglet } from '../robustesse/aide-robustesse';

test.describe('Fenêtre Structure ouverte pendant un changement de morceau @structure', () => {
  test('« Nouveau morceau » : la liste se vide aussitôt, un clic ensuite agit sur le nouveau morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 1));
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await creerMorceau(page, 'Morceau B');
    // La grille du nouveau morceau est vierge : la fenêtre ne montre plus « Couplet / Refrain / Pont ».
    await expect(fenetre(page)).toBeVisible();
    await expect.poll(() => titresLignes(page)).not.toContain('Refrain');
    expect((await lire(page)).mesures).toBe('0 mesures');
    expect(await structureStockee(page)).toEqual([]);                          // l'arrangement de l'ancien morceau n'a pas suivi
  });

  test('une modification d\'un autre onglet est vue ici sans aller-retour Grille / Structure @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(A);
    const B = await ouvrirOnglet(context);
    await ouvrirStructure(B);
    await B.bringToFront();
    await appuyer(B, plus(B, 0));
    await expect(lignes(B).first().locator('.struct-rep')).toHaveText('×2');
    await A.bringToFront();
    await expect(lignes(A).first().locator('.struct-rep')).toHaveText('×2', { timeout: 10_000 });   // A relit l'arrangement d'elle-même
    expect((await lire(A)).mesures).toBe('12 mesures');
  });
});
