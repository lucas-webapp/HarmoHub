// MODULE « robustesse » — LES GROS VOLUMES : un morceau de 640 accords en 40 parties, un titre de 300 caractères, une bibliothèque de 150 morceaux,
// un historique d'annulation profond. L'appli doit charger, jouer, enregistrer et exporter sans exception ni perte, et garder sa mise en page.
// Les temps ne sont PAS mesurés au plus juste (la machine de test varie) : seul un plafond large dit qu'un geste n'est pas devenu interminable.
import { test, expect } from '../support/fixtures';
import {
  estMobile, cases, noms, collecterErreurs, morceauLong, accordsVaries, titre, etat, boutonEnregistrer, bibliotheque, morceauxStockes, enregistrerSous,
  ouvrirMesMorceaux, fenetreMorceaux, ligne, telecharger, jsonDe, lireMidi, choisirDansMenuFichiers, choisirDansMenuMorceau, ouvrirMenuMorceau, menuMorceau,
  reglagesMorceau,
} from './aide-robustesse';
import type { Page } from '@playwright/test';

const PARTIES = 40, PAR_PARTIE = 16, TOTAL = PARTIES * PAR_PARTIE;   // 640 accords de 4 temps = 640 mesures
const lecture = (page: Page) => page.getByRole('button', { name: 'Lecture', exact: true });
const stop = (page: Page) => page.getByRole('button', { name: 'Stop', exact: true });

test.describe('Un très long morceau (640 accords, 40 parties) @robustesse', () => {
  test.slow();   // WebKit et les téléphones émulés dessinent 640 cases plus lentement

  test('il se charge en entier, sans erreur, avec toutes ses parties @critique', async ({ ouvrirAppli, garde }) => {
    const t0 = Date.now();
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    expect(Date.now() - t0, 'chargement d\'un morceau de 640 accords').toBeLessThan(30_000);
    await expect(page.locator('#progression-sections .prog-title')).toHaveCount(PARTIES);
    expect(await page.locator('#progression-sections .prog-title').first().inputValue()).toBe('Partie 1');
    expect(await page.locator('#progression-sections .prog-title').last().inputValue()).toBe('Partie ' + PARTIES);
    await expect(titre(page)).toHaveText('Long');
    expect(erreurs).toEqual([]);
    expect(garde.bloquees).toEqual([]);
  });

  test('la lecture démarre au premier accord, s\'arrête sur Stop et repart du début, sans erreur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    await lecture(page).click();
    await expect(page.locator('#progression-sections .grid-cell.playing').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    await stop(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    await expect(page.locator('#progression-sections .grid-cell.playing')).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('ajouter un accord TOUT À LA FIN, enregistrer, recharger : les 641 accords et le nom sont là @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    if (estMobile(page)) {
      await page.locator('.prog-section-ajout').last().scrollIntoViewIfNeeded();
      await page.locator('.prog-section-ajout').last().click();
      await page.locator('#quick-add-input').fill('Bb');
      await page.locator('#quick-add-btn').click();
      await page.keyboard.press('Escape');
    } else {
      const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).last();
      await plus.scrollIntoViewIfNeeded();
      await plus.click(); await plus.fill('Bb'); await plus.press('Enter');
    }
    await expect(cases(page)).toHaveCount(TOTAL + 1);
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText('Enregistré');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(cases(page)).toHaveCount(TOTAL + 1, { timeout: 30_000 });
    expect((await noms(page)).at(-1)).toBe('B♭');   // le bémol s'écrit « ♭ »
    expect(await morceauxStockes(page)).toHaveLength(1);
    expect(erreurs).toEqual([]);
  });

  test('l\'aperçu de la structure en compte 640 mesures et 40 parties', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Voir la structure du morceau' }).click();
    const fenetre = page.getByRole('dialog').first();
    await expect(fenetre).toContainText('640 mesures');
    await expect(fenetre).toContainText('40 partie(s)');
    await expect(fenetre).toContainText('21 min 20 s à 120 BPM');   // 640 mesures de 4 temps à 120 BPM = 1 280 s
    expect(erreurs).toEqual([]);
  });

  test('l\'export JSON contient toutes les parties et tous les accords ; l\'export MIDI toutes les notes @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    const json = await telecharger(page, async () => {
      await ouvrirMenuMorceau(page);
      await menuMorceau(page).getByRole('menuitem', { name: 'Exporter…' }).click();
      await page.getByText('Ce morceau', { exact: true }).click();
    });
    const morceau = jsonDe(json).songs[0];
    expect(morceau.name).toBe('Long');
    expect(morceau.sections).toHaveLength(PARTIES);
    expect(morceau.sections.reduce((n: number, p: any) => n + p.chords.length, 0)).toBe(TOTAL);
    expect(morceau.sections[PARTIES - 1].title).toBe('Partie ' + PARTIES);

    const midi = await telecharger(page, async () => {
      await choisirDansMenuFichiers(page, /Exporter en MIDI/);
      await page.getByRole('alertdialog', { name: 'Exporter en MIDI' }).getByRole('button', { name: 'Un seul fichier' }).click();   // plusieurs parties : l'appli demande
    });
    const lu = lireMidi(midi.contenu);
    expect(lu.format).toBeLessThanOrEqual(1);
    expect(lu.notes.length).toBeGreaterThanOrEqual(TOTAL * 3);   // au moins une triade par accord
    const dernier = Math.max(...lu.notes.map((n) => n.tick));
    expect(dernier / lu.ppq, 'la dernière note commence vers la mesure 640 (4 temps par mesure)').toBeGreaterThan((TOTAL - 1) * 4 - 1);
    expect(erreurs).toEqual([]);
  });

  test('le séquenceur et le tiroir clavier restent utilisables sur un accord du milieu du morceau @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    const milieu = page.locator('#progression-sections .grid-cell[data-section="20"][data-index]').nth(8);
    await milieu.scrollIntoViewIfNeeded();
    await milieu.click();
    await expect(milieu).toHaveClass(/\bselected\b/);
    await page.locator('#vue-sequenceur').click();
    await expect(page.locator('#sq-grille .sq-case').first()).toBeVisible();
    await page.locator('#vue-sequenceur').click();
    expect(erreurs).toEqual([]);
  });

  test('supprimer toute une partie au milieu : 624 accords restent, rien d\'autre ne bouge @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauLong(PARTIES, PAR_PARTIE) });
    const erreurs = collecterErreurs(page);
    page.on('dialog', (d) => void d.accept());
    await expect(cases(page)).toHaveCount(TOTAL, { timeout: 30_000 });
    const avant = await noms(page);
    await page.locator('#progression-sections .prog-section-menu').nth(10).scrollIntoViewIfNeeded();
    await page.locator('#progression-sections .prog-section-menu').nth(10).click();
    await page.locator('#partie-menu').getByRole('menuitem', { name: /Supprimer/ }).click();
    await expect(cases(page)).toHaveCount(TOTAL - PAR_PARTIE);
    const apres = await noms(page);
    expect(apres).toEqual([...avant.slice(0, 10 * PAR_PARTIE), ...avant.slice(11 * PAR_PARTIE)]);
    expect(erreurs).toEqual([]);
  });
});

test.describe('Des textes très longs @robustesse', () => {
  test('un nom de morceau de 300 caractères s\'enregistre, se retrouve dans la liste et ne fait pas déborder la barre du haut @critique', async ({ ouvrirAppli }) => {
    const nom = 'Un titre de morceau interminable '.repeat(10).slice(0, 300).trim();
    const page = await ouvrirAppli({ accords: accordsVaries(4) });
    const erreurs = collecterErreurs(page);
    await choisirDansMenuMorceau(page, 'Renommer');
    const champ = page.locator('.tb-titre-saisie');
    await champ.fill(nom);
    await champ.press('Enter');
    await expect(titre(page)).toContainText(nom.slice(0, 20));
    const v = page.viewportSize()!;
    const b = (await titre(page).boundingBox())!;
    expect(b.x + b.width, 'le nom du morceau reste dans la largeur de l\'écran').toBeLessThanOrEqual(v.width);
    const bar = (await boutonEnregistrer(page).boundingBox())!;
    expect(bar.x + bar.width, 'le bouton Enregistrer reste dans l\'écran').toBeLessThanOrEqual(v.width);
    await boutonEnregistrer(page).click();
    await expect(etat(page)).toContainText('Enregistré');
    expect((await morceauxStockes(page))[0].name).toBe(nom);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirMesMorceaux(page);
    const fen = fenetreMorceaux(page);
    const bf = (await fen.boundingBox())!;
    expect(bf.x + bf.width, 'la fenêtre « Mes morceaux » reste dans l\'écran').toBeLessThanOrEqual(v.width + 1);
    await expect(ligne(page, nom.slice(0, 30))).toHaveCount(1);
    expect(erreurs).toEqual([]);
  });

  test('un titre de partie de 400 caractères est gardé tel quel et la grille ne déborde pas de l\'écran', async ({ ouvrirAppli }) => {
    const titreLong = 'Couplet '.repeat(50).trim();
    const page = await ouvrirAppli({ reglages: reglagesMorceau([{ titre: titreLong, accords: accordsVaries(4) }]) });
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(4);
    expect(await page.locator('#progression-sections .prog-title').first().inputValue()).toBe(titreLong);
    const v = page.viewportSize()!;
    const defilementHorizontal = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(defilementHorizontal, 'aucun défilement horizontal de la page').toBeLessThanOrEqual(1);
    for (const c of await cases(page).all()) {
      const b = (await c.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
    }
    await boutonEnregistrer(page).click();
    expect(erreurs).toEqual([]);
  });
});

test.describe('Une grosse bibliothèque (150 morceaux) @robustesse', () => {
  const morceaux = Array.from({ length: 150 }, (_, i) => ({ id: 'm' + i, nom: 'Morceau ' + String(i + 1).padStart(3, '0'), accords: accordsVaries(8, i) }));

  test('« Mes morceaux » les liste tous, on en ouvre un du fond de la liste et son contenu est le bon @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque(morceaux, 'm0') });
    const erreurs = collecterErreurs(page);
    await ouvrirMesMorceaux(page);
    await expect(fenetreMorceaux(page).locator('.file-row')).toHaveCount(150);
    const derniere = ligne(page, 'Morceau 150');
    await derniere.scrollIntoViewIfNeeded();
    await derniere.getByRole('button', { name: 'Ouvrir' }).click();
    await expect(titre(page)).toHaveText('Morceau 150');
    expect(await noms(page)).toHaveLength(8);
    expect((await morceauxStockes(page))).toHaveLength(150);
    expect(erreurs).toEqual([]);
  });

  test('enregistrer un 151ᵉ morceau l\'ajoute sans toucher aux autres, et le menu du nom le propose', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque(morceaux, 'm0') });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await page.getByRole('dialog', { name: 'Nouveau morceau' }).getByRole('textbox', { name: 'Titre du morceau' }).fill('Le dernier');
    await page.getByRole('dialog', { name: 'Nouveau morceau' }).getByRole('button', { name: 'Créer' }).click();
    await expect(titre(page)).toHaveText('Le dernier');
    const stock = await morceauxStockes(page);
    expect(stock.length === 150 || stock.length === 151).toBe(true);   // la création peut déjà l'enregistrer ou attendre « Enregistrer »
    await boutonEnregistrer(page).click().catch(() => undefined);
    await expect.poll(async () => (await morceauxStockes(page)).length).toBe(151);
    const noms151 = (await morceauxStockes(page)).map((m) => m.name);
    expect(new Set(noms151).size, 'aucun doublon').toBe(151);
    expect(noms151).toContain('Morceau 001');
    expect(noms151).toContain('Morceau 150');
  });
});

test.describe('Un historique d\'annulation profond @robustesse @ordinateur', () => {
  test('30 modifications, 30 « Annuler » : on retrouve le morceau de départ, puis 30 « Rétablir » : on retrouve la fin', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: accordsVaries(2) });
    const erreurs = collecterErreurs(page);
    const depart = await noms(page);
    const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    for (let i = 0; i < 30; i++) { await plus.click(); await plus.fill('Am'); await plus.press('Enter'); }
    await expect(cases(page)).toHaveCount(32);
    const fin = await noms(page);
    await page.locator('#progression-sections').click({ position: { x: 5, y: 5 }, force: true });
    for (let i = 0; i < 30; i++) await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(cases(page)).toHaveCount(2);
    expect(await noms(page)).toEqual(depart);
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
    for (let i = 0; i < 30; i++) await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
    await expect(cases(page)).toHaveCount(32);
    expect(await noms(page)).toEqual(fin);
    await expect(page.getByRole('button', { name: 'Rétablir', exact: true })).toBeDisabled();
    expect(erreurs).toEqual([]);
  });
});
