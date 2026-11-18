// MODULE « structure » — la structure LIT les parties de la grille (pas de copie à synchroniser) : renommer, ajouter, supprimer, dupliquer, déplacer une
// partie ou y ajouter un accord dans la grille se voit aussitôt dans la fenêtre Structure. Dans l'autre sens, le « Répéter » du menu d'une partie de la
// grille est le même réglage que le ×N de la structure.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, repsLignes, lignes, ouvrirMenuPartie, appuyer, titresParties, titres,
  repondreAuxConfirmations, plus, badgeGrille, fenetre, ongletStructure, structureStockee, noms, choisirAction, estMobile,
} from './aide-structure';
import { taper } from '../tonalite/aide-tonalite';

const parties = (page: import('@playwright/test').Page) => page.locator('#progression-sections .prog-section');
// Taper des accords dans la partie n (les aides existantes visent la première) : champ de fin de partie à l'ordinateur, « + Accord » au téléphone.
const taperDans = async (page: import('@playwright/test').Page, partie: number, texte: string) => {
  if (estMobile(page)) {
    await page.locator('.prog-section-ajout').nth(partie).tap();
    const saisie = page.locator('#quick-add-input');
    await expect(saisie).toBeVisible();
    await saisie.fill(texte);
    await page.locator('#quick-add-btn').tap();
    await expect(saisie).toHaveValue('');
  } else {
    const champ = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).nth(partie);
    await champ.fill(texte);
    await champ.press('Enter');
    await expect(champ).toHaveValue('');
  }
};
const actionPartie = async (page: import('@playwright/test').Page, partie: number, nom: string | RegExp) => {
  const menu = await ouvrirMenuPartie(page, partie);
  await appuyer(page, menu.getByRole('menuitem', { name: nom }));
};

test.describe('La structure suit la grille @structure', () => {
  test('renommer une partie dans la grille renomme sa ligne dans la structure @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const titre = titresParties(page).nth(1);
    await appuyer(page, titre);
    await titre.fill('Chorus');
    await titre.press('Enter');
    await expect(titre).toHaveValue('Chorus');
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Chorus', 'Pont']);
    expect((await lire(page)).deroule).toBe('Couplet · Chorus · Pont');
    expect(garde.bloquees).toEqual([]);
  });

  test('« Ajouter une section » dans la grille ajoute une ligne « vide » à la structure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await appuyer(page, page.getByRole('button', { name: 'Ajouter une section' }));
    await expect(parties(page)).toHaveCount(4);
    await ouvrirStructure(page);
    await expect(lignes(page)).toHaveCount(4);
    await expect(lignes(page).nth(3)).toContainText('vide');
    const v = await lire(page);
    expect(v.mesures).toBe('9 mesures');            // une partie vide ne compte pas
    expect(v.deroule).toBe('Couplet · Refrain · Pont');
  });

  test('les accords tapés dans une nouvelle partie apparaissent dans sa ligne, et dans le déroulé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await appuyer(page, page.getByRole('button', { name: 'Ajouter une section' }));
    await expect(parties(page)).toHaveCount(4);
    const titre = titresParties(page).nth(3);
    await appuyer(page, titre);
    await titre.fill('Outro');
    await titre.press('Enter');
    await taperDans(page, 3, 'Em//Am');
    await expect.poll(() => noms(page, 3)).toEqual(['Em', 'Am']);
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.lignes.map(l => l.titre)).toEqual(['Couplet', 'Refrain', 'Pont', 'Outro']);
    expect(v.lignes[3].accords).toBe('| Em | Am |');
    expect(v.lignes[3].mesures).toBe('2 mes.');
    expect(v.mesures).toBe('11 mesures');
    expect(v.deroule).toBe('Couplet · Refrain · Pont · Outro');
  });

  test('ajouter un accord dans la grille allonge la partie dans la structure @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await taper(page, 'Em');
    expect((await noms(page, 0))).toEqual(['C', 'Am', 'F', 'G', 'Em']);
    await ouvrirStructure(page);
    const v = await lire(page);
    // Couplet : 12 + 4 temps = 16 temps = 4 mesures ; tout le morceau : 40 temps = 10 mesures = 20 s
    expect(v.lignes[0].mesures).toBe('4 mes.');
    expect(v.lignes[0].accords).toBe('| C | Am | F G | Em |');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–4', 'mes. 5–8', 'mes. 9–10']);
    expect(v.mesures).toBe('10 mesures');
    expect(v.duree).toBe('0 min 20 s à 120 BPM');
  });

  test('supprimer une partie dans la grille la retire de la structure @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const messages = repondreAuxConfirmations(page, true);
    await actionPartie(page, 1, 'Supprimer la partie');
    await expect(parties(page)).toHaveCount(2);
    expect(messages.length).toBe(1);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Pont']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Pont');
    expect(v.mesures).toBe('5 mesures');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–5']);
  });

  test('refuser la suppression dans la grille ne change pas la structure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    repondreAuxConfirmations(page, false);
    await actionPartie(page, 1, 'Supprimer la partie');
    await expect(parties(page)).toHaveCount(3);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
  });

  test('dupliquer une partie dans la grille ajoute sa copie à la structure, juste après', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await actionPartie(page, 1, 'Dupliquer');
    await expect(parties(page)).toHaveCount(4);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Refrain (copie)', 'Pont']);
    const v = await lire(page);
    expect(v.lignes[2].accords).toBe(v.lignes[1].accords);
    expect(v.mesures).toBe('13 mesures');
  });

  test('monter ou descendre une partie dans la grille réordonne la structure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await actionPartie(page, 0, 'Descendre');
    expect(await titres(page)).toEqual(['Refrain', 'Couplet', 'Pont']);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Refrain', 'Couplet', 'Pont']);
    expect((await lire(page)).lignes.map(l => l.position)).toEqual(['mes. 1–4', 'mes. 5–7', 'mes. 8–9']);
  });
});

test.describe('Répéter, de la grille à la structure @structure', () => {
  test('« + » du menu d\'une partie de la grille donne ×2 : badge dans la grille, ×2 dans la structure @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await expect(badgeGrille(page, 1)).toHaveCount(0);   // ×1 : pas de badge
    const menu = await ouvrirMenuPartie(page, 1);
    await expect(menu.getByRole('group', { name: 'Répétitions de Refrain' })).toContainText('×1');
    await appuyer(page, menu.getByRole('button', { name: 'Une répétition de plus' }));
    await expect(menu.getByRole('group', { name: 'Répétitions de Refrain' })).toContainText('×2');   // le menu reste ouvert pour enchaîner
    await expect(badgeGrille(page, 1)).toHaveText('×2');
    await page.keyboard.press('Escape');
    await ouvrirStructure(page);
    expect(await repsLignes(page)).toEqual(['', '×2', '']);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Refrain ×2 · Pont');
    expect(v.mesures).toBe('13 mesures');
    expect((await structureStockee(page)).map(o => o.rep)).toEqual([1, 2, 1]);
  });

  test('le menu d\'une partie de la grille lit le ×N réglé dans la structure, et le badge est là après rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await appuyer(page, plus(page, 0));
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×3');
    await retourGrille(page);
    const menu = await ouvrirMenuPartie(page, 0);
    await expect(menu.getByRole('group', { name: 'Répétitions de Couplet' })).toContainText('×3');
    await appuyer(page, menu.getByRole('button', { name: 'Une répétition de moins' }));
    await expect(menu.getByRole('group', { name: 'Répétitions de Couplet' })).toContainText('×2');
    await page.keyboard.press('Escape');
    await expect(badgeGrille(page, 0)).toHaveText('×2');   // (le réglage fait DEPUIS la grille met le badge à jour)
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(badgeGrille(page, 0)).toHaveText('×2');
    await expect(badgeGrille(page, 1)).toHaveCount(0);
  });

  test('le badge ×N de la grille suit un réglage fait dans la structure, sans rechargement (R-03)', async ({ ouvrirAppli }) => {
    test.fail(true, 'R-03 (bugs.md) : après « + » dans la structure, la grille garde l\'ancien affichage (pas de badge ×N) jusqu\'au rechargement');
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×2');
    await retourGrille(page);
    await expect(badgeGrille(page, 0)).toHaveText('×2');
  });

  test('une partie jouée à deux endroits : − et + grisés, avec la raison et un lien vers la structure', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const liste = fenetre(page).getByRole('combobox', { name: 'Ajouter une partie à la structure' });
    await liste.selectOption({ label: 'Pont (déjà 1×)' });
    await expect(lignes(page)).toHaveCount(4);
    await retourGrille(page);
    const menu = await ouvrirMenuPartie(page, 2);
    await expect(menu.getByText('Jouée à 2 endroits de la structure')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Une répétition de moins' })).toBeDisabled();
    await expect(menu.getByRole('button', { name: 'Une répétition de plus' })).toBeDisabled();
    await appuyer(page, menu.getByRole('menuitem', { name: 'Régler dans Structure' }));
    await expect(fenetre(page)).toBeVisible();
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('une partie absente de la structure : − et + grisés, raison « Absente de la structure »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    // on retire la ligne « Pont » (menu de la ligne : clic droit / appui long)
    await choisirAction(page, 2, /^Supprimer/);
    await retourGrille(page);
    const menu = await ouvrirMenuPartie(page, 2);
    await expect(menu.getByText('Absente de la structure')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Une répétition de plus' })).toBeDisabled();
    await expect(menu.getByRole('button', { name: 'Une répétition de moins' })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: 'Régler dans Structure' })).toBeVisible();
  });
});
