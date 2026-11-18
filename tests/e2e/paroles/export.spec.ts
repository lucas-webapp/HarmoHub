// MODULE « paroles » — les trois sorties de la page des paroles : « Exporter en texte » (fichier .txt), « Copier le texte dans le presse-papiers »
// et « Enregistrer en PDF » (le PDF est dessiné d'après la page : on contrôle sa validité, sa taille et son nombre de pages, pas son rendu).
// Le texte contient : le titre du morceau, puis pour chaque partie « [Titre] », « Accords : … » et les paroles. Il ne contient PAS les accords posés au-dessus des
// paroles, ni les ×N (constat, voir le rapport).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  morceauParoles, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, ecrire, zoneTexte, poserAccord, boutonArreter, boutonTexte, boutonCopier, boutonPdf, cadre, pastilles,
  attendreStockage, appuyer, telecharger, regionParoles,
} from './aide-paroles';

const estUnPdf = (c: Buffer) => c.subarray(0, 5).toString('latin1') === '%PDF-' && c.toString('latin1').trimEnd().endsWith('%%EOF');
const pages = (c: Buffer) => c.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
const SUR_CHROMIUM = (page: Page) => page.context().browser()?.browserType().name() === 'chromium';

const TEXTE_ATTENDU = 'Demo\n====\n\n[Couplet]\nAccords : C, Am, F, G\n\nPremier vers\nSecond vers\n\n[Refrain]\nAccords : F, G\n\n';

async function preparerDeuxParties(page: Page) {
  await ouvrirParoles(page);
  await ecrire(page, 0, 'Premier vers\nSecond vers');
}

test.describe('Exporter en texte @paroles', () => {
  test('« Exporter en texte » télécharge un fichier .txt : titre, parties, accords et paroles @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await preparerDeuxParties(page);
    await attendreStockage(page, s => s.sections[0].lyricsHtml.length > 0, true);
    const t = await telecharger(page, () => appuyer(page, boutonTexte(page)));
    expect(t.nom).toMatch(/^HarmoHub - Demo - Texte - \d{4}-\d{2}-\d{2} \d{4}\.txt$/);
    expect(t.texte).toBe(TEXTE_ATTENDU);
    await expect(cadre(page).getByText('Texte exporté')).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('une partie sans paroles figure dans le texte avec ses accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    const t = await telecharger(page, () => appuyer(page, boutonTexte(page)));
    // les lignes vides finales ne comptent pas (la page en ajoute après chaque partie) : on compare le texte sans elles
    expect(t.texte.trimEnd()).toBe('Demo\n====\n\n[Couplet]\nAccords : C, Am, F, G\n\n[Refrain]\nAccords : F, G');
  });

  test('le texte exporté suit les dernières paroles tapées (accents compris)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Été brûlant, ça danse');
    const t = await telecharger(page, () => appuyer(page, boutonTexte(page)));
    expect(t.texte).toContain('Été brûlant, ça danse');
    expect(t.texte).toContain('[Couplet]');
  });
});

test.describe('Copier le texte @paroles', () => {
  test('« Copier » met le même texte que le fichier dans le presse-papiers et le confirme @critique', async ({ ouvrirAppli, context }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    if (SUR_CHROMIUM(page)) await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await preparerDeuxParties(page);
    await appuyer(page, boutonCopier(page));
    await expect(cadre(page).getByText('Texte copié dans le presse-papiers.')).toBeVisible();
    if (SUR_CHROMIUM(page)) {
      // Firefox et WebKit refusent la lecture du presse-papiers par un test : on y vérifie seulement la confirmation ci-dessus.
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(TEXTE_ATTENDU);
    }
  });
});

test.describe('Enregistrer en PDF @paroles', () => {
  test('« Enregistrer en PDF » télécharge un PDF valide au nom du morceau @critique', async ({ ouvrirAppli, garde }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await preparerDeuxParties(page);
    await poserAccord(page, 'Am', 0, 0.3);
    await appuyer(page, boutonArreter(page));
    const t = await telecharger(page, () => appuyer(page, boutonPdf(page)));
    expect(t.nom).toMatch(/^HarmoHub - Demo - Paroles - \d{4}-\d{2}-\d{2} \d{4}\.pdf$/);
    expect(estUnPdf(t.contenu)).toBe(true);
    expect(t.contenu.length).toBeGreaterThan(5_000);
    expect(pages(t.contenu)).toBe(1);
    expect(garde.bloquees).toEqual([]);
  });

  test('après l\'export, la page est comme avant : accords posés à la même place, bouton de nouveau actif', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Une ligne de texte assez longue');
    await poserAccord(page, 'C', 0, 0.1);
    await appuyer(page, boutonArreter(page));
    // positions relatives à la zone de texte : un bandeau de confirmation peut décaler toute la page vers le bas, pas les accords par rapport au texte
    const lire = () => pastilles(page).evaluateAll(es => { const z = es[0].parentElement!.querySelector('.lyrics-text')!.getBoundingClientRect(); return es.map(e => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.left - z.left), Math.round(r.top - z.top)]; }); });
    const avant = await lire();
    await telecharger(page, () => appuyer(page, boutonPdf(page)));
    await expect(boutonPdf(page)).toBeEnabled();
    await expect(cadre(page).locator('body.pdf-export-mode')).toHaveCount(0);
    expect(await lire()).toEqual(avant);
    // la page reste utilisable : on peut encore écrire
    await ecrire(page, 0, ' !');
    await expect(cadre(page).locator('.lyrics-text').first()).toContainText('!');
  });

  test('un long texte est mis à l\'échelle pour tenir sur UNE page : l\'image du PDF reste entre les marges', async ({ ouvrirAppli }) => {
    test.setTimeout(120_000);
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    // 60 lignes tapées (Entrée entre chacune) : assez pour dépasser la hauteur d'une feuille A4 à la largeur de la carte
    await ecrire(page, 0, Array.from({ length: 60 }, (_, i) => `Ligne ${i + 1}`).join('\n'));
    await expect(zoneTexte(page, 0)).toContainText('Ligne 60');
    const t = await telecharger(page, () => appuyer(page, boutonPdf(page)));
    expect(estUnPdf(t.contenu)).toBe(true);
    expect(pages(t.contenu)).toBe(1);
    // L'image de la page est posée par « largeur hauteur x y cm » (en points, origine en bas à gauche) : elle doit rester dans la feuille A4 avec 20 pt de marge.
    const m = t.contenu.toString('latin1').match(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/)!;
    const [w, h, x, y] = m.slice(1).map(Number);
    expect(x).toBeGreaterThanOrEqual(20);
    expect(y).toBeGreaterThanOrEqual(20);
    expect(x + w).toBeLessThanOrEqual(595.28 - 20);
    expect(y + h).toBeLessThanOrEqual(841.89 - 20);
  });

  test('on peut exporter un morceau sans paroles (le PDF est valide)', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    const t = await telecharger(page, () => appuyer(page, boutonPdf(page)));
    expect(estUnPdf(t.contenu)).toBe(true);
    expect(pages(t.contenu)).toBe(1);
  });

  test('les trois boutons de sortie sont dans la barre de la page des paroles, avec une infobulle', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    for (const b of [boutonTexte(page), boutonCopier(page), boutonPdf(page)]) {
      await expect(b).toBeVisible();
      await expect(b).toHaveAttribute('title', /.+/);
    }
    await expect(regionParoles(page)).toBeVisible();
  });
});
