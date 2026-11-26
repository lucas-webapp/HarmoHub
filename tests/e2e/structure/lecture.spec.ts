// MODULE « structure » — la LECTURE ne suit PAS la structure (décision de l'utilisateur du 25/11 : « on reste simple »). La structure est un plan de travail et d'impression ;
// la lecture joue la grille, dans l'ordre des parties de la grille, quel que soit l'arrangement. Ce test fige cette frontière : si un jour la lecture suit la structure,
// il doit rougir et être remplacé par les vrais tests (ordre des passages, ×N, boucle, compteur de mesure). Plan : tests/PLAN-structure.md, points A et J.
import { test, expect } from '../support/fixtures';
import { morceauTroisParties, ouvrirStructure, retourGrille, plus, monter, appuyer } from './aide-structure';
import { lireEtAttendre, passagesVus, vitesseMax, boutonStop, enLecture } from '../lecture/aide-lecture';

test.describe('La lecture joue la grille, pas la structure @structure @ordinateur', () => {
  test('arrangement « Pont, Couplet ×3, Refrain » : la lecture commence quand même par le Couplet et suit l\'ordre de la grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await appuyer(page, plus(page, 0));                            // Couplet ×3
    await appuyer(page, monter(page, 2));
    await appuyer(page, monter(page, 1));                          // Pont, Couplet ×3, Refrain
    await retourGrille(page);
    await vitesseMax(page);
    await lireEtAttendre(page);
    await expect.poll(async () => (await passagesVus(page)).some(p => p.s === 2), { timeout: 30_000 }).toBe(true);   // le Pont (3e partie de la grille) est atteint
    const parties = (await passagesVus(page)).map(p => p.s);
    expect(parties[0]).toBe(0);                                    // c'est le Couplet qui sonne en premier, pas le Pont de la structure
    expect(parties).toEqual([...parties].sort((a, b) => a - b));   // 0, 1, 2 : jamais de retour au Couplet pour les « ×3 »
    await boutonStop(page).click();
    expect(await enLecture(page)).toBe(false);
  });
});
