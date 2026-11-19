// MODULE « paroles » — poser les accords AU-DESSUS des paroles.
// Geste : cliquer la pastille d'un accord dans la réserve (elle s'« arme »), puis cliquer dans le texte à l'endroit voulu. Mode « Syllabe » : la pastille s'accroche
// au caractère le plus proche (placement `char`) ; mode « Libre » : position horizontale libre (placement `free`, en %), hauteur = celle de la ligne visée.
// Par défaut l'accord SUIVANT de la partie s'arme tout seul après chaque pose (« Enchaîner les accords »).
import { test, expect } from '../support/fixtures';
import {
  morceauParoles, focaliser, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, zoneTexte, accordReserve, reserve, pastilles, croix, nomsPastilles, modeLibre, modeSyllabe, boutonArreter,
  boutonOptions, caseEnchainer, ecrire, armer, poser, poserLibre, poserAccord, rectLigne, parolesStockees, attendreStockage, appuyer, estMobile, cadre,
} from './aide-paroles';

const PHRASE = 'Une ligne de texte assez longue';

const boite = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!;

test.describe('Armer un accord @paroles', () => {
  test('cliquer un accord de la réserve l\'arme : il est mis en évidence et « Arrêter » apparaît @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await expect(boutonArreter(page)).toBeHidden();
    await armer(page, 'Am');
    await expect(boutonArreter(page)).toBeVisible();
    await expect(cadre(page).locator('.chord-chip.armed')).toHaveCount(1);
    await expect(accordReserve(page, 'C')).not.toHaveClass(/\barmed\b/);
  });

  test('recliquer l\'accord armé le désarme, comme le dit son infobulle', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await armer(page, 'Am');
    await expect(accordReserve(page, 'Am')).toHaveAttribute('title', /reclique ici pour désarmer/);
    await appuyer(page, accordReserve(page, 'Am'));
    await expect(accordReserve(page, 'Am')).not.toHaveClass(/\barmed\b/);
    await expect(boutonArreter(page)).toBeHidden();
  });

  test('Échap désarme l\'accord @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await armer(page, 'F');
    await page.keyboard.press('Escape');
    await expect(accordReserve(page, 'F')).not.toHaveClass(/\barmed\b/);
    await expect(boutonArreter(page)).toBeHidden();
  });

  test('« Arrêter » désarme l\'accord (seule sortie possible au doigt)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await armer(page, 'G');
    await appuyer(page, boutonArreter(page));
    await expect(accordReserve(page, 'G')).not.toHaveClass(/\barmed\b/);
    await expect(boutonArreter(page)).toBeHidden();
    // rien n'est armé : un clic dans le texte ne pose rien
    await ecrire(page, 0, PHRASE);
    await poser(page, 0, 0.5);
    await expect(pastilles(page)).toHaveCount(0);
  });

  test('un clic dans le texte sans accord armé ne pose rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poser(page, 0, 0.5);
    await expect(pastilles(page)).toHaveCount(0);
    expect((await parolesStockees(page))?.sections[0].placements ?? []).toEqual([]);
  });
});

test.describe('Poser un accord (mode Syllabe) @paroles', () => {
  test('armer puis cliquer dans le texte pose l\'accord au-dessus de la ligne, à l\'endroit cliqué @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.4);
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['Am']);
    const p = await boite(pastilles(page).first()), ligne = await rectLigne(page, 0, 0);
    // horizontalement : la pastille est CENTRÉE sur le caractère le plus proche du clic (un caractère fait moins de 15 px de large à la taille de
    // départ : d'où la marge de 10 px entre le centre de la pastille et le point cliqué)
    expect(Math.abs(p.x + p.width / 2 - (ligne.x + ligne.width * 0.4))).toBeLessThanOrEqual(10);
    // verticalement : au-dessus du texte de la ligne (à 2 px près), jamais dessus
    expect(p.y + p.height).toBeLessThanOrEqual(ligne.y + 2);
    await attendreStockage(page, s => s.sections[0].placements.map(x => [x.type, x.chordIndex]), [['char', 1]]);
    expect(garde.bloquees).toEqual([]);
  });

  test('l\'accord posé est marqué « posé » dans la réserve et l\'accord suivant s\'arme tout seul', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.1);
    await expect(accordReserve(page, 'C')).toHaveClass(/\bplaced\b/);
    await expect(accordReserve(page, 'C')).not.toHaveClass(/\barmed\b/);
    await expect(accordReserve(page, 'Am')).toHaveClass(/\barmed\b/);
    await expect(accordReserve(page, 'F')).not.toHaveClass(/\barmed\b/);
    await expect(boutonArreter(page)).toBeVisible();
  });

  test('on pose les quatre accords du couplet d\'affilée, dans l\'ordre, sans recliquer la réserve @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await armer(page, 'C');
    for (const fx of [0.05, 0.3, 0.55, 0.8]) await poser(page, 0, fx);
    await expect(pastilles(page)).toHaveCount(4);
    expect(await nomsPastilles(page)).toEqual(['C', 'Am', 'F', 'G']);
    // de gauche à droite, comme les clics
    const xs = await pastilles(page).evaluateAll(es => es.map(e => e.getBoundingClientRect().left));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    await attendreStockage(page, s => s.sections[0].placements.map(x => x.chordIndex), [0, 1, 2, 3]);
    await expect(reserve(page, 0).filter({ has: page.locator('xpath=self::*[contains(@class,"placed")]') })).toHaveCount(4);
  });

  test('après le dernier accord de la partie, la chaîne repart au premier (de quoi chanter un 2ᵉ couplet sur les mêmes accords)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 1, PHRASE);
    await armer(page, 'F', 1);
    await poser(page, 1, 0.2);
    await expect(accordReserve(page, 'G', 1)).toHaveClass(/\barmed\b/);
    await poser(page, 1, 0.6);
    await expect(pastilles(page, 1)).toHaveCount(2);
    await expect(accordReserve(page, 'F', 1)).toHaveClass(/\barmed\b/);
    await expect(accordReserve(page, 'G', 1)).not.toHaveClass(/\barmed\b/);
    await expect(cadre(page).locator('.chord-chip.armed')).toHaveCount(1);   // un seul accord armé à la fois, dans une seule partie
  });

  test('sans « Enchaîner les accords », l\'accord reste armé : on en pose plusieurs exemplaires, chacun avec son identifiant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await appuyer(page, boutonOptions(page));
    await expect(caseEnchainer(page)).toBeChecked();
    await caseEnchainer(page).uncheck();
    await armer(page, 'C');
    for (const fx of [0.1, 0.4, 0.7]) await poser(page, 0, fx);
    await expect(pastilles(page)).toHaveCount(3);
    expect(await nomsPastilles(page)).toEqual(['C', 'C', 'C']);
    await expect(accordReserve(page, 'C')).toHaveClass(/\barmed\b/);
    await attendreStockage(page, s => s.sections[0].placements.map(x => x.chordIndex), [0, 0, 0]);
    const ids = (await parolesStockees(page))!.sections[0].placements.map(x => x.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('la case « Enchaîner les accords » est retenue après rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await appuyer(page, boutonOptions(page));
    await caseEnchainer(page).uncheck();
    await page.reload();
    await ouvrirParoles(page);
    await appuyer(page, boutonOptions(page));
    await expect(caseEnchainer(page)).not.toBeChecked();
  });

  test('deux lignes : l\'accord se pose à la hauteur de la ligne cliquée, au-dessus de son texte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Première ligne du couplet\nSeconde ligne du couplet');
    await armer(page, 'C');
    await poser(page, 0, 0.2, 0);
    await poser(page, 0, 0.2, 1);
    await expect(pastilles(page)).toHaveCount(2);
    const [p1, p2] = [await boite(pastilles(page).nth(0)), await boite(pastilles(page).nth(1))];
    const [l1, l2] = [await rectLigne(page, 0, 0), await rectLigne(page, 0, 1)];
    expect(p2.y).toBeGreaterThan(p1.y + 15);                 // la 2ᵉ pastille est une ligne plus bas
    expect(p1.y + p1.height).toBeLessThanOrEqual(l1.y + 2);  // chacune au-dessus de SA ligne
    expect(p2.y + p2.height).toBeLessThanOrEqual(l2.y + 2);
    expect(p2.y).toBeGreaterThanOrEqual(l1.bas - 4);         // et la 2ᵉ pas dans la 1ʳᵉ ligne
  });

  test('deux accords sur la même ligne sont alignés (même hauteur)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await armer(page, 'C');
    await poser(page, 0, 0.1);
    await poser(page, 0, 0.6);
    const tops = await pastilles(page).evaluateAll(es => es.map(e => Math.round(e.getBoundingClientRect().top)));
    expect(tops.length).toBe(2);
    expect(tops[0]).toBe(tops[1]);
  });

  test('chaque partie pose ses propres accords : la réserve de l\'une n\'arme rien dans l\'autre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await ecrire(page, 1, 'Refrain qui revient encore');
    await poserAccord(page, 'Am', 0, 0.3);
    await poserAccord(page, 'G', 1, 0.5);
    expect(await nomsPastilles(page, 0)).toEqual(['Am']);
    expect(await nomsPastilles(page, 1)).toEqual(['G']);
    await attendreStockage(page, s => s.sections.map(p => p.placements.map(x => x.chordIndex)), [[1], [1]]);
  });

  test('les accords posés sont retrouvés à la même place après un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await armer(page, 'C');
    await poser(page, 0, 0.1);
    await poser(page, 0, 0.5);
    await attendreStockage(page, s => s.sections[0].placements.length, 2);
    const avant = await pastilles(page).evaluateAll(es => es.map(e => [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)]));
    await page.reload();
    await ouvrirParoles(page);
    await expect(pastilles(page)).toHaveCount(2);
    expect(await nomsPastilles(page)).toEqual(['C', 'Am']);
    const apres = await pastilles(page).evaluateAll(es => es.map(e => [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top)]));
    expect(apres).toEqual(avant);
  });

  test('en mode Syllabe l\'accord suit son caractère quand on ajoute du texte avant lui @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Bonjour le monde');
    await poserAccord(page, 'C', 0, 0.5);
    const avant = (await boite(pastilles(page).first())).x;
    await focaliser(page, 0);
    await page.keyboard.press('Home');
    await page.keyboard.type('Allez ');
    await expect(zoneTexte(page, 0)).toHaveText('Allez Bonjour le monde');
    await expect.poll(async () => (await boite(pastilles(page).first())).x).toBeGreaterThan(avant + 20);
  });
});

test.describe('Poser un accord (mode Libre) @paroles', () => {
  test('« Libre » et « Syllabe » forment un choix exclusif', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await expect(modeSyllabe(page)).toHaveClass(/\bactive\b/);
    await expect(modeLibre(page)).not.toHaveClass(/\bactive\b/);
    await appuyer(page, modeLibre(page));
    await expect(modeLibre(page)).toHaveClass(/\bactive\b/);
    await expect(modeSyllabe(page)).not.toHaveClass(/\bactive\b/);
    await appuyer(page, modeSyllabe(page));
    await expect(modeSyllabe(page)).toHaveClass(/\bactive\b/);
  });

  test('en mode Libre l\'accord se pose à la position horizontale cliquée (en %), sans accrochage à un caractère @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await appuyer(page, modeLibre(page));
    await armer(page, 'C');
    await poserLibre(page, 0, 0.5);
    await expect(pastilles(page)).toHaveCount(1);
    await attendreStockage(page, s => s.sections[0].placements.map(x => [x.type, x.chordIndex, x.lineIndex, Math.round(x.xPct!)]), [['free', 0, 0, 50]]);
    const zone = await boite(zoneTexte(page, 0)), p = await boite(pastilles(page).first());
    expect(Math.abs(p.x + p.width / 2 - (zone.x + zone.width * 0.5))).toBeLessThanOrEqual(3);   // pas d'accrochage : centrée au pixel près (3 px de marge d'arrondi)
  });

  test('en mode Libre, des clics à des abscisses très proches donnent des positions distinctes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await appuyer(page, modeLibre(page));
    await armer(page, 'C');
    await poserLibre(page, 0, 0.300);
    await poserLibre(page, 0, 0.312);
    const [a, b] = await pastilles(page).evaluateAll(es => es.map(e => e.getBoundingClientRect().left));
    expect(b).toBeGreaterThan(a);
  });

  test('en mode Libre sur deux lignes : la hauteur est celle de la ligne visée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Première ligne du couplet\nSeconde ligne du couplet');
    await appuyer(page, modeLibre(page));
    await armer(page, 'C');
    await poserLibre(page, 0, 0.3, 0);
    await poserLibre(page, 0, 0.3, 1);
    await attendreStockage(page, s => s.sections[0].placements.map(x => [x.type, x.lineIndex]), [['free', 0], ['free', 1]]);
    const [p1, p2] = [await boite(pastilles(page).nth(0)), await boite(pastilles(page).nth(1))];
    expect(p2.y).toBeGreaterThan(p1.y + 15);
  });
});

test.describe('Retirer, ramasser, reposer @paroles', () => {
  test('la croix d\'une pastille retire CET exemplaire seulement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await armer(page, 'C');
    await poser(page, 0, 0.1);
    await poser(page, 0, 0.5);
    await expect(pastilles(page)).toHaveCount(2);
    await appuyer(page, croix(pastilles(page).first()));
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['Am']);
    await attendreStockage(page, s => s.sections[0].placements.map(x => x.chordIndex), [1]);
    await expect(accordReserve(page, 'C')).not.toHaveClass(/\bplaced\b/);
    await expect(accordReserve(page, 'Am')).toHaveClass(/\bplaced\b/);
  });

  test('cliquer le corps d\'une pastille la ramasse : l\'accord est de nouveau armé et se repose ailleurs @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.15);
    await page.keyboard.press('Escape');
    await expect(pastilles(page)).toHaveCount(1);
    const p = await boite(pastilles(page).first());
    // un simple clic, sans bouger, sur le nom de l'accord (loin de la croix)
    await page.mouse.click(p.x + 6, p.y + p.height / 2);
    await expect(pastilles(page)).toHaveCount(0);
    await expect(accordReserve(page, 'C')).toHaveClass(/\barmed\b/);
    await poser(page, 0, 0.7);
    await expect(pastilles(page)).toHaveCount(1);
    const ligne = await rectLigne(page, 0, 0), q = await boite(pastilles(page).first());
    expect(q.x + q.width / 2).toBeGreaterThan(ligne.x + ligne.width * 0.6);   // reposée vers la droite, là où on a recliqué
    await attendreStockage(page, s => s.sections[0].placements.map(x => x.chordIndex), [0]);
  });

  test('réarmer depuis la réserve un accord déjà posé ne retire pas sa pastille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.15);
    await appuyer(page, boutonArreter(page));
    await armer(page, 'C');
    await expect(pastilles(page)).toHaveCount(1);
    await poser(page, 0, 0.6);
    await expect(pastilles(page)).toHaveCount(2);
    expect(await nomsPastilles(page)).toEqual(['C', 'C']);
  });
});

test.describe('Sur téléphone @paroles', () => {
  test('au doigt : armer, poser l\'accord au-dessus du texte, le retirer par sa croix @mobile @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    expect(estMobile(page)).toBe(true);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Au creux de la nuit');
    await poserAccord(page, 'Am', 0, 0.5);
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['Am']);
    const p = await boite(pastilles(page).first()), l = await rectLigne(page, 0, 0);
    expect(p.y + p.height).toBeLessThanOrEqual(l.y + 2);
    const v = page.viewportSize()!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(v.width + 1);
    await attendreStockage(page, s => s.sections[0].placements.map(x => [x.type, x.chordIndex]), [['char', 1]]);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, croix(pastilles(page).first()));
    await expect(pastilles(page)).toHaveCount(0);
    await attendreStockage(page, s => s.sections[0].placements, []);
  });

  test('les boutons de la réserve ont une cible tactile d\'au moins 28 px de haut @mobile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    for (const l of await reserve(page, 0).all()) {
      const b = (await l.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(28);
      expect(b.width).toBeGreaterThanOrEqual(28);
    }
  });
});
