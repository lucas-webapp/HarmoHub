// MODULE « synchro » — LES VERSIONS (historique du morceau). L'appli garde une version AVANT chaque opération lourde (transposition, suppression, import,
// restauration) et toutes les 5 minutes de travail. Elles vivent sur l'appareil ; les 5 plus récentes de chaque morceau sont aussi envoyées au cloud
// et lisibles sur les autres appareils (« autre appareil »). Restaurer remet la version dans le BROUILLON : il faut ensuite « Enregistrer ».
import {
  test, expect, C_AM_F_G, DO_SOL_DO, emailDe, connecter, attendreSynchronise, morceauxCloud, morceauxLocaux, accordsAffiches, titre, etat,
  ouvrirMorceauDeLaListe, bibliotheque, attendreNomsCloud, attendreNomsLocaux, transposerHaut, ouvrirParametres, choisirDansMenuMorceau,
  documentCloud, boutonEnregistrer, ouvrirMesMorceaux, ligne, repondreAuxBoitesNatives, titrePartie,
} from './aide-synchro';
import type { Page, Locator } from '@playwright/test';

const DEUX = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: DO_SOL_DO }], 'a');
const noms = async (page: Page) => (await accordsAffiches(page)).map(t => t.split(' ')[0]);

const choixMorceau = (f: Locator) => f.getByRole('combobox', { name: 'Morceau' });
// Les lignes de version (hors « Maintenant ») : chacune a un bouton « Restaurer ».
const versions = (f: Locator) => f.getByRole('listitem').filter({ has: f.page().getByRole('button', { name: 'Restaurer' }) });

test.describe('Versions : historique et restauration @synchro', () => {
  test('une transposition garde la version d\'AVANT, visible dans Paramètres, avec « Restaurer » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    let f = await ouvrirParametres(page);
    await expect(choixMorceau(f)).toContainText('Alpha — 0 version');
    await expect(f.getByText('Aucune version pour ce morceau pour l\'instant')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(f).toBeHidden();

    await transposerHaut(page);
    expect(await noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    f = await ouvrirParametres(page);
    await expect(choixMorceau(f)).toContainText('Alpha — 1 version');
    await expect(versions(f)).toHaveCount(1);
    await expect(versions(f).first()).toContainText('Avant transposition');
    await expect(versions(f).first()).toContainText('4 accords · 1 partie · C majeur · 120 BPM');
    await expect(versions(f).first().getByRole('button', { name: 'Restaurer' })).toBeVisible();
    // La ligne « Maintenant » décrit le brouillon actuel.
    await expect(f.getByRole('listitem').first()).toContainText('Brouillon modifié');
    await expect(f.getByRole('listitem').first()).toContainText('D♭ majeur');
  });

  test('« Historique du morceau… » du menu du nom ouvre les versions de ce morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await transposerHaut(page);
    await choisirDansMenuMorceau(page, 'Historique du morceau…');
    const f = page.getByRole('dialog', { name: 'Paramètres' });
    await expect(f).toBeVisible();
    await expect(choixMorceau(f)).toContainText('Alpha — 1 version');
    await expect(versions(f)).toHaveCount(1);
  });

  test('« Restaurer » remet la version dans le BROUILLON, garde l\'état d\'avant comme version, et « Enregistrer » la fixe @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await transposerHaut(page);
    await expect.poll(() => noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    const f = await ouvrirParametres(page);
    await versions(f).first().getByRole('button', { name: 'Restaurer' }).click();
    await expect(f.getByRole('status')).toContainText('remise dans le brouillon. Clique Enregistrer pour la garder.');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);   // la grille est revenue à l'état d'avant
    await expect(etat(page)).toContainText('Non enregistré');
    // L'état d'avant la restauration n'est pas perdu : c'est une nouvelle version.
    await expect(choixMorceau(f)).toContainText('Alpha — 2 versions');
    await expect(versions(f).first()).toContainText('Avant restauration');
    await expect(versions(f).first()).toContainText('D♭ majeur');
    // Le morceau enregistré, lui, n'a pas bougé tant qu'on n'a pas enregistré.
    await page.keyboard.press('Escape');
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText(/Enregistré à \d{1,2}:\d{2}/);
    expect((await morceauxLocaux(page)).find(m => m.name === 'Alpha')!.accords).toEqual(['Cmaj', 'Amin', 'Fmaj', 'Gmaj']);
  });

  test('les versions sont envoyées au cloud (index + document du morceau), avec leur motif', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await transposerHaut(page);
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-versions-a'))?.morceau ?? []).length, { timeout: 20_000 }).toBe(1);
    const doc = await documentCloud(uid, 'harmohub-versions-a');
    expect(doc.songId).toBe('a');
    expect(doc.morceau[0].motif).toBe('avant-transposition');
    expect(doc.morceau[0].libelle).toBe('Avant la transposition de +1 demi-ton');
    // La version porte le morceau d'AVANT (Do majeur), pas celui d'après.
    expect(JSON.parse(doc.morceau[0].charge).sections[0].chords.map((c: any) => c.root + c.quality)).toEqual(['Cmaj', 'Amin', 'Fmaj', 'Gmaj']);
    const index = await documentCloud(uid, 'harmohub-versions');
    expect(index.morceaux).toEqual([expect.objectContaining({ songId: 'a', songName: 'Alpha', n: 1 })]);
  });

  test('le cloud ne garde que les 5 versions les plus récentes ; l\'appareil les garde toutes', async ({ ouvrirAppli }, testInfo) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    const uid = await connecter(page, emailDe(testInfo));
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    for (let i = 1; i <= 7; i++) { await transposerHaut(page); await expect.poll(async () => (await morceauxLocaux(page)).length).toBe(2); }
    const f = await ouvrirParametres(page);
    await expect(choixMorceau(f)).toContainText('Alpha — 7 versions');
    await expect(versions(f)).toHaveCount(7);
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-versions-a'))?.morceau ?? []).length, { timeout: 20_000 }).toBe(5);
    await expect.poll(async () => (await documentCloud(uid, 'harmohub-versions'))?.morceaux?.[0]?.n, { timeout: 20_000 }).toBe(5);
  });

  test('un 2ᵉ appareil voit les versions de l\'appareil A (« autre appareil ») et peut en restaurer une @critique', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await transposerHaut(a);
    await boutonEnregistrer(a).click();   // le morceau transposé part aussi chez B
    await expect.poll(async () => (await morceauxCloud(uid)).find(m => m.name === 'Alpha')!.accords, { timeout: 20_000 }).toEqual(['C#maj', 'A#min', 'F#maj', 'G#maj']);
    // Enregistrer garde aussi une version « Enregistrée » : deux versions au total (« Avant transposition » et « Enregistrée »).
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-versions-a'))?.morceau ?? []).map((v: any) => v.motif).sort(), { timeout: 20_000 }).toEqual(['avant-transposition', 'enregistre']);

    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await ouvrirMorceauDeLaListe(b, 'Alpha');
    expect(await noms(b)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
    const f = await ouvrirParametres(b);
    await expect(versions(f)).toHaveCount(2, { timeout: 20_000 });
    const avant = versions(f).filter({ hasText: 'Avant transposition' });
    await expect(avant).toHaveCount(1);
    await expect(avant).toContainText('autre appareil');
    await expect(avant).toContainText('C majeur');
    await avant.getByRole('button', { name: 'Restaurer' }).click();
    await expect(f.getByRole('status')).toContainText('remise dans le brouillon');
    expect(await noms(b)).toEqual(['C', 'Am', 'F', 'G']);   // les accords d'avant la transposition, faite sur l'autre appareil
    await expect(etat(b)).toContainText('Non enregistré');
  });

  test('le sélecteur « Morceau » du 2ᵉ appareil compte aussi les versions venues du cloud', async ({ ouvrirAppli, nouvelAppareilOuvert }, testInfo) => {
    const a = await ouvrirAppli({ reglages: DEUX });
    const email = emailDe(testInfo);
    const uid = await connecter(a, email);
    await attendreNomsCloud(uid, ['Alpha', 'Bravo']);
    await transposerHaut(a);
    await expect.poll(async () => ((await documentCloud(uid, 'harmohub-versions-a'))?.morceau ?? []).length, { timeout: 20_000 }).toBe(1);
    const b = await nouvelAppareilOuvert();
    await connecter(b, email);
    await attendreNomsLocaux(b, ['Alpha', 'Bravo']);
    await ouvrirMorceauDeLaListe(b, 'Alpha');
    const f = await ouvrirParametres(b);
    await expect(versions(f)).toHaveCount(1, { timeout: 20_000 });
    await expect(choixMorceau(f)).toContainText('Alpha — 1 version');
  });

  test('« Vider l\'historique de cet appareil » efface les versions locales après confirmation ; refuser les garde', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    await transposerHaut(page);
    const f = await ouvrirParametres(page);
    await expect(versions(f)).toHaveCount(1);
    // Refus : rien ne change.
    const refus = repondreAuxBoitesNatives(page, false);
    await f.getByRole('button', { name: 'Vider l\'historique de cet appareil' }).click();
    await expect.poll(() => refus.length).toBe(1);
    await expect(versions(f)).toHaveCount(1);
    // Accord : l'historique local est vidé (le morceau, lui, reste).
    page.removeAllListeners('dialog');
    repondreAuxBoitesNatives(page, true);
    await f.getByRole('button', { name: 'Vider l\'historique de cet appareil' }).click();
    await expect(versions(f)).toHaveCount(0);
    await expect(f.getByText('Aucune version pour ce morceau pour l\'instant')).toBeVisible();
    expect(await noms(page)).toEqual(['D♭', 'B♭m', 'G♭', 'A♭']);
  });

  test('supprimer un morceau garde d\'abord une version « Avant suppression du morceau », rangée sous « Bravo (supprimé) »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX });
    repondreAuxBoitesNatives(page, true);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Bravo').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(page, 'Bravo')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const f = await ouvrirParametres(page);
    await expect(choixMorceau(f).locator('option', { hasText: 'Bravo (supprimé) — 1 version' })).toHaveCount(1);
    await choixMorceau(f).selectOption({ label: 'Bravo (supprimé) — 1 version' });
    await expect(versions(f)).toHaveCount(1);
    await expect(versions(f).first()).toContainText('Avant suppression du morceau');
    await expect(versions(f).first()).toContainText('3 accords · 1 partie');
  });

  // Le temps est avancé avec l'horloge simulée de Playwright (`page.clock`) : pas d'attente réelle de 5 minutes.
  test('après 5 minutes de travail sur un brouillon modifié, une version « Automatique » est gardée', async ({ ouvrirAppli, page }) => {
    await page.clock.install();
    await ouvrirAppli({ reglages: DEUX });
    await titrePartie(page).fill('Refrain');
    await titrePartie(page).press('Enter');
    await expect(etat(page)).toContainText('Non enregistré');
    await page.clock.fastForward('06:00');
    const f = await ouvrirParametres(page);
    await expect(versions(f)).toHaveCount(1);
    await expect(versions(f).first()).toContainText('Automatique');
    // Restaurer cette version redonne le brouillon tel qu'il était à ce moment-là (partie « Refrain »).
    await titrePartie(page).fill('Autre');
    await titrePartie(page).press('Enter');
    await versions(f).first().getByRole('button', { name: 'Restaurer' }).click();
    await expect(titrePartie(page)).toHaveValue('Refrain');
  });

  test('sans modification, 5 minutes de présence ne créent aucune version', async ({ ouvrirAppli, page }) => {
    await page.clock.install();
    await ouvrirAppli({ reglages: DEUX });
    await page.clock.fastForward('06:00');
    const f = await ouvrirParametres(page);
    await expect(choixMorceau(f)).toContainText('Alpha — 0 version');
    await expect(versions(f)).toHaveCount(0);
  });
});
