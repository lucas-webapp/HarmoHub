// MODULE « structure » — mise en page de la fenêtre : elle s'ouvre SOUS la barre du haut (les onglets restent atteignables), tient dans l'écran, ne fait pas
// défiler la page de côté, et reste utilisable quand la structure est longue (on défile dans la fenêtre, la barre de lecture ne cache rien).
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, fenetre, lignes, ligne, ajoutPartie, ajouterPartie, ongletGrille, ongletStructure,
  plus, moins, monter, descendre, ouvrirMenu, menuLigne, appuyer, ouvrirApercu, apercu,
} from './aide-structure';
import { tientDansL_ecran, defilementHorizontal, barreLecture, boite } from '../mobile/aide-mobile';

test.describe('Mise en page @structure', () => {
  test('la fenêtre s\'ouvre sous les onglets : Grille et Structure restent atteignables @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const f = await boite(fenetre(page));
    const onglets = await boite(ongletStructure(page));
    expect(f.y).toBeGreaterThanOrEqual(onglets.y + onglets.height - 1);        // rien ne recouvre la rangée des onglets
    await expect(ongletGrille(page)).toBeVisible();
    await retourGrille(page);                                                    // et on s'en sert pour revenir
  });

  test('la fenêtre tient dans la largeur de l\'écran, sans défilement latéral', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const f = await boite(fenetre(page)), v = page.viewportSize()!;
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.x + f.width).toBeLessThanOrEqual(v.width + 1);
    expect(await defilementHorizontal(page)).toBeLessThanOrEqual(0);
    for (let n = 0; n < 3; n++) {
      const l = await boite(ligne(page, n)), b = await boite(plus(page, n));
      expect(l.x + l.width).toBeLessThanOrEqual(v.width + 1);
      expect(b.x + b.width).toBeLessThanOrEqual(l.x + l.width + 1);              // les quatre boutons restent dans leur ligne
    }
  });

  test('les quatre boutons d\'une ligne sont visibles et cliquables sans se chevaucher', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const bs = [moins(page, 1), plus(page, 1), monter(page, 1), descendre(page, 1)];
    const boites = [];
    for (const b of bs) { await expect(b).toBeVisible(); await expect(b).toBeEnabled(); boites.push(await boite(b)); }
    for (let i = 1; i < boites.length; i++) expect(boites[i].x).toBeGreaterThanOrEqual(boites[i - 1].x + boites[i - 1].width - 1);
    for (const b of boites) { expect(b.width).toBeGreaterThanOrEqual(24); expect(b.height).toBeGreaterThanOrEqual(24); }
  });

  test('une structure longue : on défile dans la fenêtre jusqu\'à « + Partie… », la barre de lecture ne la cache pas', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 12; i++) await ajouterPartie(page, [/^Couplet/, /^Refrain/, /^Pont/][i % 3]);
    await expect(lignes(page)).toHaveCount(15);
    await ajoutPartie(page).scrollIntoViewIfNeeded();
    await expect(ajoutPartie(page)).toBeInViewport({ ratio: 1 });
    const a = await boite(ajoutPartie(page)), barre = await boite(barreLecture(page));
    expect(a.y + a.height).toBeLessThanOrEqual(barre.y + 1);                      // au-dessus de la barre de lecture, pas dessous
    // et la dernière ligne aussi
    await ligne(page, 14).scrollIntoViewIfNeeded();
    const l = await boite(ligne(page, 14));
    expect(l.y + l.height).toBeLessThanOrEqual(barre.y + 1);
  });

  test('le menu d\'une ligne s\'ouvre dans l\'écran, même sur la dernière ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirMenu(page, 2);
    await tientDansL_ecran(page, menuLigne(page));
  });

  test('l\'aperçu avant impression recouvre la fenêtre et tient dans l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await tientDansL_ecran(page, apercu(page));
    await expect(apercu(page).getByRole('button', { name: 'Enregistrer en PDF' })).toBeVisible();
  });

  test('la légende rappelle le geste du menu : clic droit à l\'ordinateur, appui long au téléphone', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const legende = fenetre(page).getByTitle('Clic droit (ou appui long) sur une partie : dupliquer, renommer, commenter, retirer.');
    await expect(legende).toHaveText('Clic droit : options');
    await appuyer(page, legende);   // la légende est inerte : elle n'ouvre rien
    await expect(menuLigne(page)).toBeHidden();
  });
});
