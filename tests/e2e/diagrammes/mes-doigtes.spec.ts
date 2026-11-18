// MODULE « diagrammes » — « MES DOIGTÉS » : fixer un doigté avec le cadenas l'ajoute à une bibliothèque PERSONNELLE, partagée par nom d'accord (tous les « Am7 » du
// morceau, et des autres morceaux, le proposent en premier, « Mon doigté »), qu'on peut vider un doigté à la fois (confirmation en deux clics) et qui suit le
// compte (document `harmohub-doigtes` du cloud, relu sur un autre appareil).
import { test, expect, emailDe, connecter, attendreSynchronise, documentCloud, ouvrirDans } from '../synchro/aide-synchro';
import {
  morceauDeuxAm7, caseN, selectionner, boutonGuitare, precedent, suivant, compteur, cadenas, listeDoigtes, doigteDeLaListe, pastilleCase, signature, position,
  DO,
} from './aide-diagrammes';
import type { Page } from '@playwright/test';

const entrees = (page: Page) => page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('harmohubMesDoigtes') || '{"entrees":{}}').entrees) || {}));
const supprimes = (page: Page) => page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('harmohubMesDoigtes') || '{"supprimes":{}}').supprimes) || {}));
const retirer = (page: Page) => listeDoigtes(page).getByRole('button', { name: 'Retirer de Mes doigtés' });
const monDoigte = (page: Page) => listeDoigtes(page).getByRole('button', { name: /Mon doigté/ });

// Fixe le 3ᵉ doigté de l'accord choisi (un doigté qui n'est pas celui du départ) ; rend son dessin.
async function fixerLeTroisieme(page: Page): Promise<string> {
  await suivant(page).click();
  await suivant(page).click();
  const sig = await signature(page);
  await cadenas(page).click();
  await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
  return sig;
}

test.describe('Mes doigtés @diagrammes @ordinateur', () => {
  test('fixer un doigté l\'ajoute à « Mes doigtés » : un autre accord de même nom le propose en premier, « Mon doigté », sans être verrouillé @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    const sig = await fixerLeTroisieme(page);
    expect(await entrees(page)).toHaveLength(1);
    // l'autre Am7 (partie « Refrain ») : même doigté en tête, mais la case n'est pas verrouillée
    await selectionner(page, 1, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(pastilleCase(page, 1, 1)).toHaveCount(0);
    await expect(suivant(page)).toBeEnabled();
    await expect(compteur(page)).toHaveText('1/4');
    expect(await signature(page)).toBe(sig);
    await compteur(page).click();
    await expect(monDoigte(page)).toHaveCount(1);
    await expect(doigteDeLaListe(page, 1)).toContainText('Mon doigté');
    await expect(doigteDeLaListe(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(retirer(page)).toHaveCount(1);
    await expect(listeDoigtes(page).getByRole('button', { name: /^Doigté \d sur 4/ })).toHaveCount(4);   // il remplace le doublon de la liste, il n'ajoute pas un 5ᵉ
  });

  test('« Mes doigtés » est propre à chaque accord : Dm7 ou G7 ne reçoivent pas le doigté d\'Am7', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    const sigAm7 = await fixerLeTroisieme(page);
    await selectionner(page, 0, 1);
    await compteur(page).click();
    await expect(monDoigte(page)).toHaveCount(0);
    await expect(retirer(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(await signature(page)).not.toBe(sigAm7);
  });

  test('fixer deux fois le même doigté ne le range qu\'une fois', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    await fixerLeTroisieme(page);
    await cadenas(page).click();                             // libère
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    await cadenas(page).click();                             // fixe de nouveau le doigté affiché (« Mon doigté », 1ᵉʳ)
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await entrees(page)).toHaveLength(1);
  });

  test('un second doigté fixé s\'ajoute au premier : les deux sont proposés', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    const sigA = await fixerLeTroisieme(page);
    await selectionner(page, 1, 1);                          // l'autre Am7 : on y fixe un AUTRE doigté (le 2ᵉ de la liste)
    await suivant(page).click();
    const sigB = await signature(page);
    expect(sigB).not.toBe(sigA);
    await cadenas(page).click();
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await entrees(page)).toHaveLength(2);
    await selectionner(page, 0, 0);                          // le 1ᵉʳ Am7 reste sur son doigté fixé…
    expect(await signature(page)).toBe(sigA);
    await expect(suivant(page)).toBeDisabled();
    await cadenas(page).click();                             // …et libéré, il propose les deux
    await compteur(page).click();
    await expect(monDoigte(page)).toHaveCount(2);
  });

  test('« Retirer de Mes doigtés » demande une confirmation (deuxième clic), puis le doigté redevient un doigté ordinaire @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    await fixerLeTroisieme(page);
    await selectionner(page, 1, 1);
    await compteur(page).click();
    await expect(retirer(page)).toHaveText('×');
    await retirer(page).click();
    await expect(retirer(page)).toHaveText('Retirer ?');      // armé : rien n'est encore retiré
    expect(await entrees(page)).toHaveLength(1);
    await expect(monDoigte(page)).toHaveCount(1);
    await retirer(page).click();                              // confirmé
    await expect(monDoigte(page)).toHaveCount(0);
    await expect(retirer(page)).toHaveCount(0);
    expect(await entrees(page)).toHaveLength(0);
    expect(await supprimes(page)).toHaveLength(1);            // la suppression est mémorisée (elle doit atteindre les autres appareils)
    await expect(listeDoigtes(page).getByRole('button', { name: /^Doigté \d sur 4/ })).toHaveCount(4);
  });

  test('armer « Retirer ? » puis fermer la liste ne retire rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    await fixerLeTroisieme(page);
    await selectionner(page, 1, 1);
    await compteur(page).click();
    await retirer(page).click();
    await expect(retirer(page)).toHaveText('Retirer ?');
    await page.keyboard.press('Escape');
    await expect(listeDoigtes(page)).toBeHidden();
    expect(await entrees(page)).toHaveLength(1);
    await compteur(page).click();
    await expect(monDoigte(page)).toHaveCount(1);
    await expect(retirer(page)).toHaveText('×');              // rouvert : de nouveau désarmé
  });

  test('« Mes doigtés » est retenu après un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    const sig = await fixerLeTroisieme(page);
    await page.reload();
    await selectionner(page, 1, 1);
    await expect(cadenas(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await signature(page)).toBe(sig);
    await expect(compteur(page)).toHaveText('1/4');
    expect(await entrees(page)).toHaveLength(1);
  });

  test('connecté, « Mes doigtés » part dans le cloud ; un 2ᵉ appareil du même compte le retrouve, et le retrait s\'y propage @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreSynchronise(a);
    await boutonGuitare(a).click();
    await selectionner(a, 0, 0);
    const sig = await fixerLeTroisieme(a);
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-doigtes'))?.entrees ?? []).length, { timeout: 20_000 }).toBe(1);
    const doc = await documentCloud(uid, 'harmohub-doigtes');
    expect(doc.app).toBe('HarmoHub-Doigtes');
    expect(doc.entrees[0]).toMatchObject({ root: 'A', quality: 'min7' });
    expect(JSON.parse(doc.entrees[0].json)).toHaveLength(6);

    // un autre appareil (stockage vide) du même compte
    const b = await nouvelAppareilOuvert({ accords: [{ root: 'A', quality: 'min7' }, ...DO.slice(2)], titre: 'Autre' });
    await connecter(b, email);
    await attendreSynchronise(b);
    await expect.poll(() => entrees(b), { timeout: 20_000 }).toHaveLength(1);
    await boutonGuitare(b).click();
    await selectionner(b, 0, 0);
    await expect(cadenas(b)).toHaveAttribute('aria-pressed', 'false');
    expect(await signature(b)).toBe(sig);                     // le doigté de l'autre appareil est proposé en premier
    await compteur(b).click();
    await expect(monDoigte(b)).toHaveCount(1);
    // retrait sur l'appareil B : il disparaît du cloud, puis de A
    await retirer(b).click();
    await retirer(b).click();
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-doigtes'))?.entrees ?? []).length, { timeout: 20_000 }).toBe(0);
    await expect.poll(() => entrees(a), { timeout: 20_000 }).toHaveLength(0);
  });

  test('connecté sur un appareil vide, la connexion n\'efface pas « Mes doigtés » déjà posés sur cet appareil', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: morceauDeuxAm7() });
    await boutonGuitare(page).click();
    await selectionner(page, 0, 0);
    await fixerLeTroisieme(page);
    const uid = await connecter(page, emailDe(testInfo));
    await attendreSynchronise(page);
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-doigtes'))?.entrees ?? []).length, { timeout: 20_000 }).toBe(1);
    expect(await entrees(page)).toHaveLength(1);
    await selectionner(page, 1, 1);
    await expect(compteur(page)).toHaveText('1/4');
  });
});
