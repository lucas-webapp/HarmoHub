// MODULE « paroles » — la page des paroles au téléphone (< 900 px) : tout tient dans l'écran, les gestes se font au doigt.
import { test, expect } from '../support/fixtures';
import {
  morceauParoles, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, cadre, carte, zoneTexte, pastilles, nomsPastilles, ecrire, armer, poser, poserLibre, modeLibre, modeSyllabe,
  boutonTexte, boutonCopier, boutonPdf, boutonOptions, boutonArreter, telecharger, annuler, retablir, curseurTaille, panneauOptions, estMobile, attendreStockage, rectLigne,
} from './aide-paroles';
import { defilementHorizontal } from '../mobile/aide-mobile';

test.describe('Paroles au téléphone @paroles @mobile', () => {
  test('la page des paroles tient en largeur : pas de défilement de côté, barre d\'outils entière dans l\'écran @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    expect(estMobile(page)).toBe(true);
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un très long texte de paroles qui doit passer à la ligne dans la carte sans la faire déborder de l\'écran du téléphone');
    expect(await defilementHorizontal(page)).toBeLessThanOrEqual(1);
    expect(await cadre(page).locator('html').evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
    const v = page.viewportSize()!;
    for (const b of [modeSyllabe(page), modeLibre(page), boutonTexte(page), boutonCopier(page), boutonPdf(page), boutonOptions(page)]) {
      const r = (await b.boundingBox())!;
      expect(r.x, 'bord gauche').toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width, 'bord droit').toBeLessThanOrEqual(v.width + 1);
    }
    const c = (await carte(page, 0).boundingBox())!;
    expect(c.x + c.width).toBeLessThanOrEqual(v.width + 1);
  });

  test('les boutons de la barre d\'outils font au moins 32 px de côté', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    for (const b of [modeSyllabe(page), modeLibre(page), boutonTexte(page), boutonCopier(page), boutonPdf(page), boutonOptions(page)]) {
      const r = (await b.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(32);
      expect(r.width).toBeGreaterThanOrEqual(32);
    }
  });

  test('en mode Libre, un accord se pose au doigt à l\'endroit touché, puis « Annuler » / « Rétablir » du haut', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Au creux de la nuit');
    await modeLibre(page).tap();
    await armer(page, 'C');
    await poserLibre(page, 0, 0.5);
    await expect(pastilles(page)).toHaveCount(1);
    await attendreStockage(page, s => s.sections[0].placements.map(x => [x.type, Math.round(x.xPct!)]), [['free', 50]]);
    await boutonArreter(page).tap();
    await annuler(page).tap();
    await expect(pastilles(page)).toHaveCount(0);
    await retablir(page).tap();
    await expect(pastilles(page)).toHaveCount(1);
    expect(await nomsPastilles(page)).toEqual(['C']);
  });

  test('plusieurs accords de suite au doigt, dans l\'ordre de la partie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Au creux de la nuit tombante');
    await armer(page, 'C');
    for (const fx of [0.05, 0.3, 0.55, 0.8]) await poser(page, 0, fx);
    expect(await nomsPastilles(page)).toEqual(['C', 'Am', 'F', 'G']);
    const l = await rectLigne(page, 0, 0);
    const xs = await pastilles(page).evaluateAll(es => es.map(e => e.getBoundingClientRect().left));
    expect(xs[3] - xs[0]).toBeGreaterThan(l.width * 0.5);   // vraiment étalés sur la ligne, pas empilés
  });

  test('le panneau « Options » tient dans l\'écran et le curseur de taille agit au doigt', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un peu de texte');
    const avant = await zoneTexte(page, 0).evaluate(e => parseFloat(getComputedStyle(e).fontSize));
    await boutonOptions(page).tap();
    await expect(panneauOptions(page)).toBeVisible();
    const p = (await panneauOptions(page).boundingBox())!, v = page.viewportSize()!;
    expect(p.x).toBeGreaterThanOrEqual(-1);
    expect(p.x + p.width).toBeLessThanOrEqual(v.width + 1);
    await curseurTaille(page).fill('1.5');
    expect(await zoneTexte(page, 0).evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(avant * 1.4);
  });

  test('« Exporter en texte » et « Enregistrer en PDF » fonctionnent au téléphone', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Au creux de la nuit');
    const t = await telecharger(page, () => boutonTexte(page).tap());
    expect(t.texte).toContain('Au creux de la nuit');
    const pdf = await telecharger(page, () => boutonPdf(page).tap());
    expect(pdf.contenu.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

test.describe('Paroles sur ordinateur : rien du téléphone @paroles @ordinateur', () => {
  test('la page des paroles s\'affiche centrée dans une colonne, avec la barre d\'outils sur une ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    expect(estMobile(page)).toBe(false);
    await ouvrirParoles(page);
    const v = page.viewportSize()!, c = (await carte(page, 0).boundingBox())!;
    expect(c.width).toBeLessThan(v.width - 100);
    expect(Math.abs((c.x + c.width / 2) - v.width / 2)).toBeLessThanOrEqual(20);
    const ys = [];
    for (const b of [modeSyllabe(page), modeLibre(page), boutonTexte(page), boutonCopier(page), boutonPdf(page), boutonOptions(page)]) ys.push(Math.round((await b.boundingBox())!.y));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(6);
  });
});
