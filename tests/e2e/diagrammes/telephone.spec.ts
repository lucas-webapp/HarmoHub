// MODULE « diagrammes » — au TÉLÉPHONE (< 900 px) : pas de tiroir, de poignée ni de fenêtre libre ; le clavier et le manche s'affichent au-dessus de la bande du bas
// (boutons Clavier / Guitare, couverts par le module « mobile »). Les doigtés, le cadenas, « Mes doigtés » et l'édition manuelle y fonctionnent au doigt.
import { test, expect } from '../support/fixtures';
import {
  morceauDeux, morceauDeuxAm7, caseN, noms, boutonPiano, boutonGuitare, tiroir, poignee, detacher, piano, guitare, nomAccord, notesAccord, constructionClavier, toucheBlanche,
  precedent, suivant, compteur, cadenas, crayon, listeDoigtes, doigteDeLaListe, pastilleCase, signature, position, editeur, ongletDessin, manche, valider, candidats, envoyer,
  poserDoigte, rondsDuManche, fermerEditeur, ouvrirEditeur, substitut, substituer,
} from './aide-diagrammes';
import type { Page } from '@playwright/test';

const toucher = async (page: Page, partie: number, n: number) => {
  await caseN(page, partie, n).tap();
  await expect(caseN(page, partie, n)).toHaveClass(/\bselected\b/);
};
// Au téléphone les diagrammes sont à la SUITE de la grille (en bas de la page, comme avant le chantier tiroir) : on les fait défiler jusqu'à l'écran, puis on
// vérifie qu'ils y tiennent tout entiers, sans passer sous la bande fixe du bas (boutons Clavier / Guitare).
const dansLEcran = async (page: Page, l: import('@playwright/test').Locator, sousLaBande = true) => {
  await l.scrollIntoViewIfNeeded();
  const h = page.viewportSize()!.height, w = page.viewportSize()!.width;
  await expect.poll(async () => {
    const b = (await l.boundingBox())!, bande = (await boutonPiano(page).boundingBox());
    const bas = sousLaBande && bande ? Math.min(h, bande.y + 1) : h;   // une fenêtre modale recouvre la bande : elle doit seulement tenir dans l'écran
    return b.y >= 0 && b.x >= 0 && b.x + b.width <= w && b.y + b.height <= bas;
  }).toBe(true);
};
// D-02 : on affiche la guitare AVANT de choisir l'accord.
async function guitareEtAccord(page: Page, partie = 0, n = 1) {
  if ((await boutonGuitare(page).getAttribute('aria-pressed')) !== 'true') await boutonGuitare(page).tap();
  await expect(guitare(page)).toBeVisible();
  await toucher(page, partie, n);
  await expect(nomAccord(page)).toHaveText(/\S/);
}

test.describe('Diagrammes au téléphone @diagrammes @mobile', () => {
  test('pas de tiroir : ni poignée, ni « Détacher en fenêtre libre » ; le clavier s\'affiche seul, dans l\'écran, au-dessus de la bande du bas @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await expect(piano(page)).toBeVisible();
    await expect(tiroir(page)).toBeHidden();
    await expect(poignee(page)).toBeHidden();
    await expect(detacher(page)).toBeHidden();
    await dansLEcran(page, piano(page));
    const p = (await piano(page).boundingBox())!, bande = (await boutonPiano(page).boundingBox())!;
    expect(p.y + p.height).toBeLessThanOrEqual(bande.y + 1);
  });

  test('le clavier et le manche suivent l\'accord touché ; le manche porte flèches, cadenas et crayon @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page, 0, 1);
    await expect(nomAccord(page)).toHaveText('Am7');
    await expect(notesAccord(page)).toHaveText(['A', 'C', 'E', 'G']);
    await dansLEcran(page, guitare(page));
    for (const b of [precedent(page), suivant(page), compteur(page), cadenas(page), crayon(page)]) await expect(b).toBeVisible();
    expect(await position(page)).toEqual({ rang: 1, total: 4 });
    await toucher(page, 1, 0);
    await expect(nomAccord(page)).toHaveText('Fmaj7');
    await expect(notesAccord(page)).toHaveText(['F', 'A', 'C', 'E']);
  });

  test('afficher la guitare alors qu\'un accord est déjà touché garde cet accord (D-02)', async ({ ouvrirAppli }) => {
    test.fail(true, 'D-02 (bugs.md) : « Afficher la guitare » avec un accord choisi remet les diagrammes sur Do (accord par défaut) jusqu\'au prochain choix');
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await toucher(page, 0, 1);
    await expect(nomAccord(page)).toHaveText('Am7');
    await boutonGuitare(page).tap();
    await expect(guitare(page)).toBeVisible();
    await expect(nomAccord(page)).toHaveText('Am7');
    await expect(notesAccord(page)).toHaveText(['A', 'C', 'E', 'G']);
  });

  test('toucher une touche du clavier ne construit pas d\'accord au téléphone et ne change rien au morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await toucher(page, 0, 1);
    await toucheBlanche(page, 3).tap();
    await expect(constructionClavier(page)).toBeHidden();
    await expect(nomAccord(page)).toHaveText('Am7');
    expect(await noms(page)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7']);
  });

  test('les flèches changent de doigté au doigt, dans les deux sens, en boucle @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    const vus = [await signature(page)];
    for (let n = 2; n <= 4; n++) { await suivant(page).tap(); await expect(compteur(page)).toHaveText(`${n}/4`); vus.push(await signature(page)); }
    expect(new Set(vus).size).toBe(4);
    await suivant(page).tap();
    await expect(compteur(page)).toHaveText('1/4');
    expect(await signature(page)).toBe(vus[0]);
    await precedent(page).tap();
    await expect(compteur(page)).toHaveText('4/4');
    expect(await signature(page)).toBe(vus[3]);
  });

  test('« Voir tous les doigtés » ouvre la liste dans l\'écran ; en toucher un le choisit et la referme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    await compteur(page).tap();
    await expect(listeDoigtes(page)).toBeVisible();
    await dansLEcran(page, listeDoigtes(page), false);
    await expect(listeDoigtes(page).getByRole('button', { name: /^Doigté \d sur 4/ })).toHaveCount(4);
    const avant = await signature(page);
    await doigteDeLaListe(page, 3).tap();
    await expect(listeDoigtes(page)).toBeHidden();
    await expect(compteur(page)).toHaveText('3/4');
    expect(await signature(page)).not.toBe(avant);
  });

  test('le cadenas fixe le doigté au doigt : flèches bloquées, point orange sur la case, retrouvé après « Enregistrer » et rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    await suivant(page).tap();
    await expect(compteur(page)).toHaveText('2/4');
    const sig = await signature(page);
    await cadenas(page).tap();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(suivant(page)).toBeDisabled();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).tap();
    await expect(page.locator('#tb-etat')).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    await page.reload();
    await expect(caseN(page, 0, 1)).toBeVisible();
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
    await guitareEtAccord(page);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await signature(page)).toBe(sig);
    await cadenas(page).tap();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(0);
    await expect(suivant(page)).toBeEnabled();
  });

  test('« Mes doigtés » au téléphone : le doigté fixé devient « Mon doigté » d\'un autre accord de même nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await guitareEtAccord(page, 0, 0);
    await suivant(page).tap(); await suivant(page).tap();
    const sig = await signature(page);
    await cadenas(page).tap();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await toucher(page, 1, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await signature(page)).toBe(sig);
    await compteur(page).tap();
    await expect(listeDoigtes(page).getByRole('button', { name: /Mon doigté/ })).toHaveCount(1);
    await expect(listeDoigtes(page).getByRole('button', { name: 'Retirer de Mes doigtés' })).toHaveCount(1);
  });

  test('le crayon ouvre l\'édition manuelle, entièrement dans l\'écran ; « Fermer » la referme @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    await crayon(page).tap();
    await expect(editeur(page)).toBeVisible();
    await dansLEcran(page, editeur(page), false);
    await expect(editeur(page).getByRole('tab')).toHaveCount(2);
    await fermerEditeur(page).tap();
    await expect(editeur(page)).toBeHidden();
  });

  test('dessiner au doigt un Do ouvert, le faire reconnaître et l\'ajouter à la grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    await crayon(page).tap();
    await expect(editeur(page)).toBeVisible();
    await ongletDessin(page).tap();
    await expect(ongletDessin(page)).toHaveAttribute('aria-selected', 'true');
    await expect(valider(page)).toBeDisabled();
    await poserDoigte(page, [null, 3, 2, 0, 1, 0]);
    await expect.poll(async () => new Set(await rondsDuManche(page)).size).toBe(5);
    await expect(valider(page)).toBeEnabled();
    await valider(page).tap();
    await expect(candidats(page).first()).toHaveText('C');
    await dansLEcran(page, editeur(page), false);
    await envoyer(page).tap();
    await expect(editeur(page)).toBeHidden();
    expect(await noms(page, 0)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7', 'C']);
  });

  test('dessiner au doigt un Do ouvert pour l\'accord Am7 : « Utiliser comme substitut guitare » met la pastille et fixe le doigté', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeux() });
    await guitareEtAccord(page);
    await crayon(page).tap();
    await ongletDessin(page).tap();
    await expect(ongletDessin(page)).toHaveAttribute('aria-selected', 'true');
    await poserDoigte(page, [null, 3, 2, 0, 1, 0]);
    await valider(page).tap();
    await substituer(page).tap();
    await expect(editeur(page)).toBeHidden();
    await expect(substitut(page)).toBeVisible();
    await expect(substitut(page)).toContainText('C');
    await expect(nomAccord(page)).toHaveText('Am7');
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(pastilleCase(page, 0, 1)).toHaveCount(1);
  });
});
