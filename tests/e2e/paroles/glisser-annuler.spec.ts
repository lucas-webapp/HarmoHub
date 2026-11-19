// MODULE « paroles » — glisser une pastille, annuler / rétablir, réinitialiser.
// Glisser : on attrape le corps d'une pastille et on la déplace (au-delà de ~6 px ; un simple clic, lui, la ramasse). Annuler / Rétablir : les boutons de la barre
// du haut de l'appli et Ctrl+Z / Ctrl+Maj+Z agissent sur l'historique des PAROLES quand l'onglet Paroles est ouvert (historique distinct de celui de la grille).
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import {
  morceauParoles, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, retourGrille, zoneTexte, reserve, pastilles, nomsPastilles, boutonReinit, ecrire, armer,
  poser, poserLibre, poserAccord, rectLigne, parolesStockees, attendreStockage, annuler, retablir, appuyer, estMobile, repPlus, cadre, modeLibre,
  repondreAuxConfirmations, boutonArreter, selectionner,
} from './aide-paroles';
import { glisserDoigt, gesteComposeDisponible } from '../mobile/aide-mobile';

const PHRASE = 'Une ligne de texte assez longue';
const boite = async (l: Locator) => (await l.boundingBox())!;
const gauchePastille = async (page: Page, n = 0) => (await boite(pastilles(page).nth(n))).x;

// Glisse la pastille `n` de `dx` pixels vers la droite (souris : appuyer, dépasser le seuil, aller au point, relâcher).
async function glisser(page: Page, n: number, versX: number) {
  const b = await boite(pastilles(page).nth(n));
  const de = { x: b.x + 8, y: b.y + b.height / 2 };   // sur le nom de l'accord, loin de la croix
  const vers = { x: versX, y: de.y };
  if (estMobile(page)) { await glisserDoigt(page, de, vers, 12); return; }
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(de.x + 30, de.y, { steps: 4 });   // dépasse le seuil de déclenchement
  await page.mouse.move(vers.x, vers.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('Glisser une pastille @paroles', () => {
  test('glisser une pastille la déplace sans la dupliquer ni changer son identifiant @critique @ordinateur', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.1);
    await page.keyboard.press('Escape');
    await attendreStockage(page, s => s.sections[0].placements.length, 1);
    const avant = (await parolesStockees(page))!.sections[0].placements[0];
    const x0 = await gauchePastille(page);
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.75);
    await expect(pastilles(page)).toHaveCount(1);
    expect(await gauchePastille(page)).toBeGreaterThan(x0 + 150);
    await expect.poll(async () => (await parolesStockees(page))!.sections[0].placements[0].id).toBe(avant.id);
    await expect.poll(async () => {
      const p = (await parolesStockees(page))!.sections[0].placements[0];
      return p.type === 'char' ? p.charIndex : p.xPct;
    }).not.toBe(avant.charIndex);
    const apres = (await parolesStockees(page))!.sections[0].placements;
    expect(apres).toHaveLength(1);
    expect(apres[0].chordIndex).toBe(0);
    expect(garde.bloquees).toEqual([]);
  });

  test('en mode Syllabe, une pastille glissée reste accrochée à un caractère (placement « char ») @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.1);
    await page.keyboard.press('Escape');
    await attendreStockage(page, s => s.sections[0].placements.length, 1);
    const avant = JSON.stringify((await parolesStockees(page))!.sections[0].placements[0]);
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.75);
    // on attend que le glissé soit enregistré (la ligne stockée change), puis on regarde son type
    await expect.poll(async () => JSON.stringify((await parolesStockees(page))!.sections[0].placements[0])).not.toBe(avant);
    expect((await parolesStockees(page))!.sections[0].placements[0].type).toBe('char');
  });

  test('glisser une pastille vers la gauche la ramène vers le début de la ligne @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.8);
    await page.keyboard.press('Escape');
    const x0 = await gauchePastille(page);
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.1);
    expect(await gauchePastille(page)).toBeLessThan(x0 - 150);
  });

  test('la pastille glissée ne se pose pas dans le vide : elle reste au-dessus du texte, sur sa ligne @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.1);
    await page.keyboard.press('Escape');
    const y0 = (await boite(pastilles(page).first())).y;
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.6);
    expect(Math.abs((await boite(pastilles(page).first())).y - y0)).toBeLessThanOrEqual(1);
  });

  test('en mode Libre, glisser change la position en % et garde l\'identifiant @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await appuyer(page, modeLibre(page));
    await armer(page, 'C');
    await poserLibre(page, 0, 0.5);
    await page.keyboard.press('Escape');
    await attendreStockage(page, s => s.sections[0].placements.map(x => Math.round(x.xPct!)), [50]);
    const id = (await parolesStockees(page))!.sections[0].placements[0].id;
    const zone = await boite(zoneTexte(page, 0));
    await glisser(page, 0, zone.x + zone.width * 0.2);
    await expect.poll(async () => Math.round((await parolesStockees(page))!.sections[0].placements[0].xPct!)).toBe(20);
    expect((await parolesStockees(page))!.sections[0].placements[0].id).toBe(id);
  });

  test('glisser est annulé d\'un seul « Annuler » : la pastille revient où elle était @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.1);
    await page.keyboard.press('Escape');
    const x0 = await gauchePastille(page);
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.75);
    const x1 = await gauchePastille(page);
    expect(x1).toBeGreaterThan(x0 + 150);
    await appuyer(page, annuler(page));
    await expect.poll(() => gauchePastille(page)).toBeCloseTo(x0, 0);
    await expect(pastilles(page)).toHaveCount(1);
    await appuyer(page, retablir(page));
    await expect.poll(() => gauchePastille(page)).toBeCloseTo(x1, 0);
  });

  test('au doigt : glisser la pastille la déplace @mobile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    test.skip(!gesteComposeDisponible(page), 'WebKit mobile : Playwright n\'offre pas de glissé tactile composé (limite de l\'outil, voir le module mobile) ; couvert sur Android');
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Une ligne de texte');
    await poserAccord(page, 'C', 0, 0.1);
    await appuyer(page, boutonArreter(page));
    const x0 = await gauchePastille(page);
    const l = await rectLigne(page, 0, 0);
    await glisser(page, 0, l.x + l.width * 0.8);
    await expect.poll(() => gauchePastille(page)).toBeGreaterThan(x0 + 60);
    await expect(pastilles(page)).toHaveCount(1);
  });
});

test.describe('Annuler et rétablir @paroles', () => {
  test('au départ rien à annuler ni à rétablir ; écrire active « Annuler » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await expect(annuler(page)).toBeDisabled();
    await expect(retablir(page)).toBeDisabled();
    await ecrire(page, 0, 'Un peu de texte');
    await expect(annuler(page)).toBeEnabled();
    await expect(retablir(page)).toBeDisabled();
  });

  test('« Annuler » retire la phrase écrite d\'un coup, « Rétablir » la ramène @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un peu de texte');
    await appuyer(page, annuler(page));
    await expect(zoneTexte(page, 0)).toHaveText('');
    await expect(retablir(page)).toBeEnabled();
    await appuyer(page, retablir(page));
    await expect(zoneTexte(page, 0)).toHaveText('Un peu de texte');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Un peu de texte');
  });

  test('Ctrl+Z et Ctrl+Maj+Z font la même chose que les boutons @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un peu de texte');
    await page.keyboard.press('Control+z');
    await expect(zoneTexte(page, 0)).toHaveText('');
    await page.keyboard.press('Control+Shift+z');
    await expect(zoneTexte(page, 0)).toHaveText('Un peu de texte');
  });

  test('« Annuler » retire l\'accord posé, « Rétablir » le repose au même endroit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.4);
    await appuyer(page, boutonArreter(page));
    const x = await gauchePastille(page);
    await appuyer(page, annuler(page));
    await expect(pastilles(page)).toHaveCount(0);
    await attendreStockage(page, s => s.sections[0].placements, []);
    await appuyer(page, retablir(page));
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['Am']);
    expect(Math.abs((await gauchePastille(page)) - x)).toBeLessThanOrEqual(1);
  });

  test('« Annuler » ramène une pastille retirée par sa croix', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.2);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, pastilles(page).first().locator('.pill-del'));
    await expect(pastilles(page)).toHaveCount(0);
    await appuyer(page, annuler(page));
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['C']);
  });

  test('plusieurs gestes s\'annulent un par un, dans l\'ordre inverse', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await armer(page, 'C');
    await poser(page, 0, 0.1);
    await poser(page, 0, 0.5);
    await appuyer(page, boutonArreter(page));
    await expect(pastilles(page)).toHaveCount(2);
    await appuyer(page, annuler(page));
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['C']);
    await appuyer(page, annuler(page));
    await expect(pastilles(page)).toHaveCount(0);
    await expect(zoneTexte(page, 0)).toHaveText(PHRASE);   // la phrase écrite avant n'a pas bougé
    await appuyer(page, annuler(page));
    await expect(zoneTexte(page, 0)).toHaveText('');
    await expect(annuler(page)).toBeDisabled();
  });

  test('un nouveau geste après « Annuler » vide la pile « Rétablir »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Premier jet');
    await appuyer(page, annuler(page));
    await expect(retablir(page)).toBeEnabled();
    await ecrire(page, 0, 'Autre idée');
    await expect(zoneTexte(page, 0)).toHaveText('Autre idée');
    await expect(retablir(page)).toBeDisabled();
  });

  test('l\'historique des paroles est distinct de celui de la grille : annuler ici ne touche pas la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    repondreAuxConfirmations(page, true);
    // un accord supprimé dans la grille : « Annuler » de la grille devient actif
    await selectionner(page, 0, 3);
    await page.keyboard.press('Delete');
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(3);
    await expect(annuler(page)).toBeEnabled();
    await ouvrirParoles(page);
    await expect(annuler(page)).toBeDisabled();   // l'historique des paroles est vide, malgré la suppression faite dans la grille
    await ecrire(page, 0, 'Texte');
    await appuyer(page, annuler(page));
    await expect(zoneTexte(page, 0)).toHaveText('');
    await expect(reserve(page, 0)).toHaveText(['C', 'Am', 'F']);   // la suppression de la grille est toujours là
    await retourGrille(page);
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(3);
  });
});

test.describe('Réinitialiser une partie @paroles', () => {
  test('« Réinitialiser » demande confirmation puis efface paroles et accords posés de CETTE partie seulement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    const messages = repondreAuxConfirmations(page, true);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Couplet un');
    await ecrire(page, 1, 'Refrain un');
    await poserAccord(page, 'C', 0, 0.3);
    await poserAccord(page, 'F', 1, 0.3);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, boutonReinit(page, 0));
    await expect(zoneTexte(page, 0)).toHaveText('');
    await expect(pastilles(page, 0)).toHaveCount(0);
    await expect(zoneTexte(page, 1)).toHaveText('Refrain un');
    await expect(pastilles(page, 1)).toHaveCount(1);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Effacer les paroles et tous les accords posés de « Couplet »');
    await attendreStockage(page, s => s.sections.map(p => [p.lyricsHtml, p.placements.length]), [['', 0], ['Refrain un', 1]]);
  });

  test('refuser la confirmation ne change rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    const messages = repondreAuxConfirmations(page, false);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Je garde tout');
    await poserAccord(page, 'C', 0, 0.3);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, boutonReinit(page, 0));
    await expect.poll(() => messages.length).toBe(1);
    await expect(zoneTexte(page, 0)).toHaveText('Je garde tout');
    await expect(pastilles(page)).toHaveCount(1);
  });

  test('« Annuler » après « Réinitialiser » rend les paroles ET les accords posés', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    repondreAuxConfirmations(page, true);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un peu de texte');
    await poserAccord(page, 'Am', 0, 0.4);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, boutonReinit(page, 0));
    await expect(zoneTexte(page, 0)).toHaveText('');
    await appuyer(page, annuler(page));
    await expect(zoneTexte(page, 0)).toHaveText('Un peu de texte');
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['Am']);
  });

  test('un nouveau ×N (répétitions) s\'annule d\'un cran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    for (let i = 0; i < 3; i++) await appuyer(page, repPlus(page));
    await expect(cadre(page).getByText('× 4')).toBeVisible();
    await appuyer(page, annuler(page));
    await expect(cadre(page).getByText('× 3')).toBeVisible();
    await appuyer(page, retablir(page));
    await expect(cadre(page).getByText('× 4')).toBeVisible();
  });
});
