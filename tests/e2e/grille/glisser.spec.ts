// MODULE « grille » — glisser une case (ordinateur, souris) pour la déplacer : avant ou après la case visée selon la moitié survolée.
// Au toucher, le glisser est un appui long : couvert par les bancs historiques (gestes tactiles) et par le futur module « mobile ».
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, glisserCase, reglagesMorceau } from './aide-grille';

test.describe('Glisser une case @grille @ordinateur', () => {
  test('glisser C sur la moitié droite de F la place derrière F @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await glisserCase(page, caseN(page, 0, 0), caseN(page, 0, 2), 0.7);
    expect(await noms(page)).toEqual(['Am', 'F', 'C', 'G']);
    expect(garde.bloquees).toEqual([]);
  });

  test('glisser G sur la moitié gauche d\'Am la place devant Am', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await glisserCase(page, caseN(page, 0, 3), caseN(page, 0, 1), 0.25);
    expect(await noms(page)).toEqual(['C', 'G', 'Am', 'F']);
  });

  test('le déplacement est annulable (Ctrl+Z) puis rétablissable', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await glisserCase(page, caseN(page, 0, 0), caseN(page, 0, 2), 0.7);
    expect(await noms(page)).toEqual(['Am', 'F', 'C', 'G']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await page.keyboard.press('Control+Shift+z');
    expect(await noms(page)).toEqual(['Am', 'F', 'C', 'G']);
  });

  test('un petit mouvement sans lâcher sur une autre case ne déplace rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const b = (await caseN(page, 0, 1).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2);
    await page.mouse.up();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  // Observé : le glisser reste dans la partie. Lâcher sur une autre partie ne déplace rien (ni perte, ni doublon) ; à confirmer si c'est voulu.
  test('lâcher une case sur une autre partie ne perd ni ne duplique aucun accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: C_AM_F_G }, { titre: 'Refrain', accords: [{ root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }] },
    ]) });
    await glisserCase(page, caseN(page, 0, 3), caseN(page, 1, 0), 0.7);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
    expect(await noms(page, 1)).toEqual(['Dm', 'Em']);
  });

  test('glisser une case ne change pas le nombre total d\'accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await glisserCase(page, caseN(page, 0, 1), caseN(page, 0, 3), 0.8);
    expect([...(await noms(page))].sort()).toEqual(['Am', 'C', 'F', 'G']);
    expect(await noms(page)).toEqual(['C', 'F', 'G', 'Am']);
  });
});
