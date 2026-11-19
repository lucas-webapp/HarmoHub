// MODULE « robustesse » — LE STOCKAGE DU NAVIGATEUR qui refuse ou qui est plein : `localStorage` qui lève `QuotaExceededError` (plein) ou `SecurityError`
// (bloqué, navigation privée de certains navigateurs), `indexedDB` qui lève, des données de morceau qui ont le bon JSON mais pas la bonne forme.
// Le stockage est refusé par un script posé avant le chargement (voir `preparerRefusStockage`), comme le fait un navigateur : l'appli ne le sait pas d'avance.
// Ce qui est déjà éprouvé ailleurs n'est pas redit : réglages abîmés (parametres/persistance), SDK Firebase absent (demarrage/hors-ligne).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, cases, noms, collecterErreurs, ajouterAccords, titre, etat, boutonEnregistrer, bibliotheque, morceauxStockes, ouvrirMesMorceaux, fenetreMorceaux,
  preparerRefusStockage, armerRefus, refusVus, indexedDBRefuse, messagesVisibles, enregistrerSous,
} from './aide-robustesse';
import type { Page } from '@playwright/test';

const lecture = (page: Page) => page.getByRole('button', { name: 'Lecture', exact: true });
const BIBLIO = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }], 'a');
const MOT_DE_STOCKAGE = /stockage|espace|plein|mémoire|enregistr\w+ impossible|impossible d.enregistrer|échec|n.a pas pu|erreur/i;

// Ouvre l'appli avec un stockage qui REFUSERA (une fois armé) l'écriture des clés dont le nom correspond à `cles`.
async function ouvrirAvecStockageQuiRefuse(ouvrirAppli: (o?: any) => Promise<Page>, page: Page, cles: string) {
  await preparerRefusStockage(page);
  await ouvrirAppli({ reglages: BIBLIO });
  await armerRefus(page, { cles });
}

test.describe('Stockage plein : la bibliothèque ne peut plus être écrite @robustesse', () => {
  test('« Enregistrer » ne réussit pas : l\'écran garde l\'accord ajouté, dit « Non enregistré » et la bibliothèque stockée reste intacte @critique', async ({ ouvrirAppli, page }) => {
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^harmohubSongs$');
    await ajouterAccords(page, ['E']);
    await expect(cases(page)).toHaveCount(5);
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await refusVus(page)).ecritures, { message: 'la simulation doit avoir refusé au moins une écriture' }).toBeGreaterThan(0);
    // l'écran ne ment pas : le morceau n'est PAS enregistré
    await expect(etat(page)).not.toContainText(/^Enregistré/);
    await expect(etat(page)).toContainText('Non enregistré');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'E']);
    // ce qui était enregistré l'est toujours, tel quel
    expect(await morceauxStockes(page)).toMatchObject([{ name: 'Alpha', accords: ['C', 'Amin', 'F', 'G'] }]);
    // l'appli reste vivante : la lecture démarre
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
  });

  test('Z-02 : l\'échec de « Enregistrer » est annoncé à l\'utilisateur (message, pas seulement un morceau resté « Non enregistré »)', async ({ ouvrirAppli, page }) => {
    test.fail(true, 'Z-02 (bugs.md) : stockage plein, « Enregistrer » ne dit rien (exception non interceptée, aucun message) ; l\'utilisateur ne sait pas pourquoi son morceau reste « Non enregistré »');
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^harmohubSongs$');
    await ajouterAccords(page, ['E']);
    await expect(cases(page)).toHaveCount(5);
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await refusVus(page)).ecritures).toBeGreaterThan(0);
    await expect(messagesVisibles(page).filter({ hasText: MOT_DE_STOCKAGE }).first()).toBeVisible();
  });

  test('l\'échec de « Enregistrer » n\'est pas une exception non interceptée de la page', async ({ ouvrirAppli, page }) => {
    test.fail(true, 'Z-02 (bugs.md) : l\'écriture refusée remonte comme une exception JavaScript non interceptée (« The quota has been exceeded. »)');
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^harmohubSongs$');
    const erreurs = collecterErreurs(page);
    await ajouterAccords(page, ['E']);
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await refusVus(page)).ecritures).toBeGreaterThan(0);
    expect(erreurs).toEqual([]);
  });

  test('l\'espace libéré, « Enregistrer » réussit et rien n\'a été perdu entre-temps', async ({ ouvrirAppli, page }) => {
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^harmohubSongs$');
    await ajouterAccords(page, ['E']);
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await refusVus(page)).ecritures).toBeGreaterThan(0);
    await expect(etat(page)).toContainText('Non enregistré');
    await armerRefus(page, { cles: null });
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText('Enregistré');
    expect(await morceauxStockes(page)).toMatchObject([{ name: 'Alpha', accords: ['C', 'Amin', 'F', 'G', 'Emaj'] }]);
  });

  test('un nouveau morceau nommé alors que le stockage est plein : il reste affiché, sans entrer dans la bibliothèque ni la corrompre', async ({ ouvrirAppli, page }) => {
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^harmohubSongs$');
    await ouvrirMesMorceaux(page);
    await expect(fenetreMorceaux(page).locator('.file-row')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await ajouterAccords(page, ['Dm']);
    await boutonEnregistrer(page).click();
    await expect.poll(async () => (await refusVus(page)).ecritures).toBeGreaterThan(0);
    const stock = await morceauxStockes(page);
    expect(stock).toHaveLength(1);
    expect(stock[0].accords).toEqual(['C', 'Amin', 'F', 'G']);
  });
});

test.describe('Stockage plein : la copie de travail ne peut plus être écrite @robustesse', () => {
  test('la grille déjà affichée reste intacte et la lecture marche (le stockage ne sert pas à jouer) @critique', async ({ ouvrirAppli, page }) => {
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^myProgression$');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    await expect(page.locator('#progression-sections .grid-cell.playing').first()).toBeVisible();
  });

  test('Z-03 : ajouter un accord alors que la copie de travail ne s\'écrit plus l\'affiche quand même', async ({ ouvrirAppli, page }) => {
    test.fail(true, 'Z-03 (bugs.md) : stockage refusé, ajouter un accord ne fait rien (le texte reste dans le champ, aucun accord, aucun message) : l\'appli est inutilisable au lieu de travailler « en mémoire »');
    await ouvrirAvecStockageQuiRefuse(ouvrirAppli, page, '^myProgression$');
    await ajouterAccords(page, ['E']);
    await expect.poll(async () => (await refusVus(page)).ecritures).toBeGreaterThan(0);
    await expect(cases(page)).toHaveCount(5);
  });
});

test.describe('Stockage bloqué en lecture et en écriture dès le chargement @robustesse', () => {
  test('Z-04 : « localStorage » inaccessible (SecurityError) : l\'appli démarre et propose une grille utilisable', async ({ page }) => {
    test.fail(true, 'Z-04 (bugs.md) : avec un stockage local bloqué, window.app n\'existe jamais : la page reste un décor sans aucun bouton qui réponde (aucun message)');
    await page.addInitScript(() => {
      sessionStorage.setItem('cc_accueil_vu', '1');
      const origine: Record<string, (...a: unknown[]) => unknown> = {};
      for (const m of ['getItem', 'setItem', 'removeItem', 'key', 'clear'] as const) {
        origine[m] = (Storage.prototype as any)[m];
        (Storage.prototype as any)[m] = function (...a: unknown[]) {
          if (this === window.sessionStorage) return origine[m].apply(this, a);   // seul le stockage local est bloqué ; la graine de la fixture vit dans sessionStorage
          throw new DOMException('The operation is insecure.', 'SecurityError');
        };
      }
    });
    await page.goto('/index.html');
    await page.waitForFunction(() => !!(window as any).app, null, { timeout: 10_000 });
    await expect(page.locator('#progression-sections')).toBeVisible();
  });
});

test.describe('IndexedDB refusé @robustesse', () => {
  test('l\'appli démarre, enregistre comme d\'habitude, et la fenêtre Paramètres dit pourquoi l\'historique est indisponible @critique', async ({ page, ouvrirAppli }) => {
    await indexedDBRefuse(page);
    await ouvrirAppli({ accords: C_AM_F_G });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(4);
    await ajouterAccords(page, ['E']);
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText('Enregistré');
    expect(await morceauxStockes(page)).toMatchObject([{ accords: ['C', 'Amin', 'F', 'G', 'Emaj'] }]);
    await page.locator('#open-settings').click();
    const fenetre = page.getByRole('dialog', { name: 'Paramètres' });
    await expect(fenetre).toBeVisible();
    await expect(fenetre).toContainText('Le stockage de l\'historique est refusé');
    await expect(fenetre).toContainText('Enregistrer fonctionne comme d\'habitude');
    expect(erreurs).toEqual([]);
  });

  test('IndexedDB refusé : un nouveau morceau se crée, s\'enregistre et se rouvre après rechargement', async ({ page, ouvrirAppli }) => {
    await indexedDBRefuse(page);
    await ouvrirAppli();
    await ajouterAccords(page, ['C', 'G']);
    await enregistrerSous(page, 'Sans historique');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(titre(page)).toHaveText('Sans historique');
    expect(await noms(page)).toEqual(['C', 'G']);
  });
});

test.describe('Des données de morceau qui ne sont pas du bon format @robustesse', () => {
  // L'appli doit démarrer avec un morceau vide plutôt que rester morte : un seul morceau abîmé ne doit jamais interdire d'ouvrir l'appli.
  const BONNE = [{ title: 'Couplet', chords: [{ root: 'C', quality: '', beats: 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' }] }];
  const tolerees: [string, Record<string, string>][] = [
    ['la bibliothèque n\'est pas du JSON', { harmohubSongs: '{[', harmohubCurrentSongId: 'x' }],
    ['la bibliothèque vaut « null »', { harmohubSongs: 'null' }],
    ['la copie de travail n\'est pas du JSON', { myProgression: '{{{' }],
    ['les parties de la copie de travail ne sont pas une liste', { myProgression: '{"sections": 5}' }],
    ['un morceau de la bibliothèque n\'a aucune partie', { harmohubSongs: JSON.stringify([{ id: 'z', name: 'Z', savedAt: 1 }]), harmohubCurrentSongId: 'z' }],
  ];
  for (const [nom, reglages] of tolerees) {
    test(`${nom} : l'appli démarre avec un morceau sans accord, sans exception`, async ({ page }) => {
      const erreurs = collecterErreurs(page);
      await page.addInitScript((r) => { if (sessionStorage.getItem('e2e-graine')) return; sessionStorage.setItem('e2e-graine', '1'); sessionStorage.setItem('cc_accueil_vu', '1'); for (const [k, v] of Object.entries(r)) localStorage.setItem(k, v as string); }, reglages);
      await page.goto('/index.html');
      await page.waitForFunction(() => !!(window as any).app, null, { timeout: 10_000 });
      await expect(page.locator('#progression-sections')).toBeVisible();
      await expect(cases(page)).toHaveCount(0);
      expect(erreurs).toEqual([]);
    });
  }

  const mortelles: [string, string, Record<string, string>][] = [
    ['la bibliothèque est un objet et non une liste', 'songs-objet', { harmohubSongs: '{"a":1}', harmohubCurrentSongId: 'x' }],
    ['la bibliothèque contient un élément « null »', 'songs-null', { harmohubSongs: '[null, 3, {"id":"z"}]', harmohubCurrentSongId: 'z' }],
    ['une partie de la copie de travail n\'a pas de liste d\'accords', 'partie-sans-accords', { myProgression: JSON.stringify({ sections: [{ title: 'A' }] }) }],
    ['la copie de travail contient un accord « null »', 'accord-null', { myProgression: JSON.stringify({ sections: [{ title: 'A', chords: [null, 3] }] }) }],
  ];
  for (const [nom, id, reglages] of mortelles) {
    test(`Z-05 : ${nom} : l'appli démarre quand même [${id}]`, async ({ page }) => {
      test.fail(true, 'Z-05 (bugs.md) : des données de morceau de la mauvaise forme (JSON valide) empêchent l\'appli de démarrer : window.app n\'existe jamais, la page reste morte tant que le stockage n\'est pas vidé à la main');
      await page.addInitScript((r) => { if (sessionStorage.getItem('e2e-graine')) return; sessionStorage.setItem('e2e-graine', '1'); sessionStorage.setItem('cc_accueil_vu', '1'); for (const [k, v] of Object.entries(r)) localStorage.setItem(k, v as string); }, reglages);
      await page.goto('/index.html');
      await page.waitForFunction(() => !!(window as any).app, null, { timeout: 10_000 });
      await expect(page.locator('#progression-sections')).toBeVisible();
    });
  }

  for (const [nom, beats] of [['négative', -3], ['en texte', 'abc'], ['nulle', 0], ['absente (null)', null]] as const) {
    test(`une durée d'accord ${nom} dans le stockage : l'accord s'affiche, sans exception`, async ({ ouvrirAppli }) => {
      const sections = [{ title: 'A', chords: [{ ...BONNE[0].chords[0], beats }, { ...BONNE[0].chords[0], root: 'D', beats: 4 }] }];
      const page = await ouvrirAppli({ reglages: { harmohubSongs: JSON.stringify([{ id: 'z', name: 'Z', savedAt: Date.now(), sections }]), harmohubCurrentSongId: 'z', myProgression: JSON.stringify({ sections }) } });
      const erreurs = collecterErreurs(page);
      await page.reload();
      await page.waitForFunction(() => !!(window as any).app);
      expect(await noms(page)).toEqual(['C', 'D']);
      await lecture(page).click();
      await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
      expect(erreurs).toEqual([]);
    });
  }
});
