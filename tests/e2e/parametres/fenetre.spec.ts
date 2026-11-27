// MODULE « parametres » — la fenêtre « Paramètres » elle-même : ouverture, fermeture, sections, valeurs d'usine, « À propos ».
// Ordinateur et téléphone (la fenêtre est la même ; au téléphone elle occupe l'écran et défile).
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, appuyer, boutonParametres, fenetre, ouvrir, fermer, allerA, ongletReglages, deplierAvancees, interrupteur, curseur, liste, choix, NOM, ecouterEnEditant, sonMetronome,
  reperesDeTemps, lireStockage, lireEtat,
} from './aide-parametres';

test.describe('Fenêtre Paramètres @parametres', () => {
  test('la roue ouvre la fenêtre « Paramètres » : quatre onglets, dans l\'ordre, une catégorie à la fois, et un bouton Fermer @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(fenetre(page)).toBeHidden();
    await expect(boutonParametres(page)).toHaveAccessibleName('Paramètres');
    const f = await ouvrir(page);
    await expect(f.getByRole('heading', { level: 2 })).toHaveText('Paramètres');
    await expect(f.getByRole('tablist', { name: 'Catégories de réglages' }).getByRole('tab')).toHaveText(['Son', 'Affichage', 'Historique', 'À propos']);
    // appareil neuf : l'onglet « Son » est affiché, et lui seul (les autres catégories sont masquées, pas empilées à la suite)
    await expect(ongletReglages(page, 'Son')).toHaveAttribute('aria-selected', 'true');
    await expect(f.getByRole('heading', { level: 3 })).toHaveText(['Son']);
    await allerA(page, 'Affichage');
    await expect(f.getByRole('heading', { level: 3 })).toHaveText(['Affichage', 'Apparence']);
    await allerA(page, 'Historique');
    await expect(f.getByRole('heading', { level: 3 })).toHaveText(['Historique et récupération']);
    await allerA(page, 'À propos');
    await expect(f.getByRole('heading', { level: 3 })).toHaveText(['À propos']);
    await expect(f.getByRole('button', { name: 'Fermer' })).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('chaque réglage part de sa valeur d\'usine (appareil neuf) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await allerA(page, 'Son');
    await deplierAvancees(page);
    await expect(curseur(page, 'Volume général')).toHaveValue('100');
    await expect(curseur(page, 'Volume du métronome')).toHaveValue('80');
    await expect(interrupteur(page, NOM.sonDeplacement)).toHaveAttribute('aria-checked', 'true');
    await expect(liste(page, 'Rythme des nouveaux accords')).toHaveValue('held');
    await expect(interrupteur(page, NOM.jouerSelection)).toHaveAttribute('aria-checked', 'true');
    await expect(interrupteur(page, NOM.decompte)).toHaveAttribute('aria-checked', 'true');
    await expect(sonMetronome(page)).toHaveValue('click');
    await expect(ecouterEnEditant(page)).toHaveAttribute('aria-checked', 'true');
    await allerA(page, 'Affichage');
    await deplierAvancees(page);
    await expect(interrupteur(page, NOM.degres)).toHaveAttribute('aria-checked', 'true');
    // « Noms des rythmes » : sans réglage, allumé au-dessus de 1340 px de large, éteint en dessous (c'est ce que dit son infobulle)
    await expect(interrupteur(page, NOM.nomsRythmes)).toHaveAttribute('aria-checked', page.viewportSize()!.width > 1340 ? 'true' : 'false');
    await expect(curseur(page, 'Barres du séquenceur')).toHaveValue('26');
    await expect(liste(page, 'Position d\'accord')).toHaveValue(/.+/);
    await expect(liste(page, 'Position d\'accord').locator('option:checked')).toHaveText('Octave + renversement (O3-R1)');
    await expect(interrupteur(page, NOM.dateModif)).toHaveAttribute('aria-checked', 'true');
    await expect(choix(page, 'Touches du piano', 'Rien')).toBeChecked();
    await expect(choix(page, 'Pastilles de la guitare', 'Rien')).toBeChecked();
    await expect(interrupteur(page, NOM.nomsManche)).toHaveAttribute('aria-checked', 'false');
    await expect(interrupteur(page, NOM.fonction)).toHaveAttribute('aria-checked', 'false');
    await expect(reperesDeTemps(page).locator('option:checked')).toHaveText('Milieu de mesure');
    // Apparence
    await expect(interrupteur(page, NOM.verre)).toHaveAttribute('aria-checked', 'false');
    await expect(choix(page, 'Couleur du fond', 'Aurore')).toBeChecked();
  });

  test('la fenêtre se ferme par « Fermer », par Échap et par un clic à côté ; un clic dedans ne la ferme pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrir(page);
    await appuyer(page, f.getByRole('button', { name: 'Fermer' }));
    await expect(f).toBeHidden();

    await ouvrir(page);
    await appuyer(page, f.getByRole('heading', { level: 2 }));
    await expect(f).toBeVisible();   // un clic sur la fenêtre ne la ferme pas
    await allerA(page, 'Affichage');
    await appuyer(page, interrupteur(page, NOM.nomsRythmes));
    await expect(f).toBeVisible();   // ni un réglage
    await fermer(page);

    await ouvrir(page);
    const dehors = page.locator('#settings-overlay');
    if (estMobile(page)) await dehors.tap({ position: { x: 3, y: 300 } }); else await dehors.click({ position: { x: 3, y: 300 } });
    await expect(f).toBeHidden();
  });

  test('la fenêtre tient dans l\'écran, défile, et « Recharger l\'application » est atteignable en bas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrir(page);
    await allerA(page, 'À propos');
    const taille = page.viewportSize()!;
    const b = (await f.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(taille.width);
    expect(b.y + b.height).toBeLessThanOrEqual(taille.height);
    const recharger = f.getByRole('button', { name: 'Recharger l\'application' });
    await recharger.scrollIntoViewIfNeeded();
    await expect(recharger).toBeInViewport();
    const r = (await recharger.boundingBox())!;
    expect(r.y + r.height).toBeLessThanOrEqual(b.y + b.height + 1);   // le bouton est DANS la fenêtre, pas coupé
    // le titre reste visible : la fenêtre défile par son corps, pas en entier
    await expect(f.getByRole('heading', { level: 2 })).toBeInViewport();
  });

  test('« À propos » : numéro de version à 12 chiffres, le même que celui des scripts chargés, et sa date', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrir(page);
    await allerA(page, 'À propos');
    const version = (await f.getByText('Version de l\'application').locator('xpath=..').locator('strong').textContent())!.trim();
    expect(version).toMatch(/^\d{12}$/);
    // le même numéro que le « ?v= » des fichiers servis : sinon on affiche un numéro qui ne dit pas ce qu'on exécute
    const dansLesScripts = await page.evaluate(() => [...document.querySelectorAll('script[src*="script.js"]')].map(s => (s.getAttribute('src') || '').match(/[?&]v=(\d+)/)?.[1]));
    expect(dansLesScripts.length).toBeGreaterThan(0);
    expect(dansLesScripts[0]).toBe(version);
    // « Dernière mise à jour » écrit la date de ce numéro (AAAAMMJJ…) en français
    const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const [annee, m, j] = [version.slice(0, 4), Number(version.slice(4, 6)), Number(version.slice(6, 8))];
    const date = (await f.getByText('Dernière mise à jour').locator('xpath=..').locator('strong').textContent())!.trim();
    expect(date).toBe(`${j} ${mois[m - 1]} ${annee}`);
  });

  test('« Recharger l\'application » recharge la page et garde les réglages et le morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrir(page);
    await allerA(page, 'Affichage');
    await appuyer(page, interrupteur(page, NOM.degres));
    await expect(interrupteur(page, NOM.degres)).toHaveAttribute('aria-checked', 'false');
    await allerA(page, 'À propos');
    await page.evaluate(() => { (window as any).__avantRechargement = true; });
    const recharger = f.getByRole('button', { name: 'Recharger l\'application' });
    await recharger.scrollIntoViewIfNeeded();
    await appuyer(page, recharger);
    // la page est neuve : le marqueur posé avant a disparu
    await expect.poll(() => page.evaluate(() => (window as any).__avantRechargement === true).catch(() => 'en cours'), { timeout: 15_000 }).toBe(false);
    await page.waitForFunction(() => !!(window as any).app);
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(4);
    expect(await lireStockage(page, 'harmohubShowRomanNumerals')).toBe('0');
    expect(await lireEtat(page, 'generalVolumePercent')).toBe(100);
  });

  test('changer des réglages ne modifie pas le morceau : il reste « Enregistré », Annuler reste grisé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const etat = page.locator('#tb-etat');
    const avant = (await etat.textContent())!.trim();
    const morceauAvant = await lireStockage(page, 'harmohubSongs');
    await ouvrir(page);
    await allerA(page, 'Affichage');
    await appuyer(page, interrupteur(page, NOM.degres));
    await appuyer(page, interrupteur(page, NOM.dateModif));
    await liste(page, 'Position d\'accord').selectOption({ index: 0 });
    await appuyer(page, choix(page, 'Couleur du fond', 'Vert'));
    await allerA(page, 'Son');
    await curseur(page, 'Volume général').fill('40');
    await fermer(page);
    await expect(etat).toHaveText(avant);
    await expect(etat).not.toContainText('Non enregistré');
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
    expect(await lireStockage(page, 'harmohubSongs')).toBe(morceauAvant);
  });
});

test.describe('Fenêtre Paramètres : clavier @parametres @ordinateur', () => {
  test('E-01 : ouverte au clavier, la fenêtre reçoit le focus, et Tab reste dans la fenêtre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await boutonParametres(page).focus();
    await page.keyboard.press('Enter');
    await expect(fenetre(page)).toBeVisible();
    const dedans = () => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('[role="dialog"][aria-label="Paramètres"], #settings-overlay'));
    await expect.poll(dedans).toBe(true);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); expect(await dedans()).toBe(true); }
  });

  test('la fenêtre se règle au clavier : Tab jusqu\'à un interrupteur, Entrée le bascule, Échap ferme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await allerA(page, 'Affichage');
    const degres = interrupteur(page, NOM.degres);
    await degres.focus();
    await expect(degres).toBeFocused();
    await expect(degres).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(degres).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Enter');
    await expect(degres).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
  });

  test('E-02 : Espace sur un interrupteur le bascule, sans lancer la lecture du morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    await allerA(page, 'Affichage');
    const degres = interrupteur(page, NOM.degres);
    await degres.focus();
    await page.keyboard.press('Space');
    await expect(degres).toHaveAttribute('aria-checked', 'false');
    expect(await lireEtat(page, 'isPlaying')).toBe(false);
  });
});
