// MODULE « parametres » — sections « Affichage » et « Apparence » : degrés, fonction harmonique, repères de temps, position d'accord, date de dernière
// modification, noms des rythmes, hauteur des barres du séquenceur, verre dépoli et couleur du fond. Chaque réglage est vérifié sur ce qu'on VOIT.
// (Les touches du piano, les pastilles de la guitare et le manche de dessin sont dans `instruments.spec.ts`.)
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, estMobile, appuyer, ouvrir, fermer, deplierAvancees, interrupteur, curseur, liste, choix, NOM, reperesDeTemps, lireStockage,
  degresAffiches, fonctionsAffichees, reperesAffiches, mentions,
} from './aide-parametres';
import { bibliotheque, ouvrirMesMorceaux, ligne } from '../fichiers/aide-fichiers';
import { ouvrirSequenceur, rythme, grille } from '../sequenceur/aide-sequenceur';

// Un morceau dont les accords portent un renversement ou un drop : « O3-R1 », « O3-D2 », « O3-R2 », « O3 ».
const accord = (root: string, quality: string, inversion: number, drop: string) => ({ root, quality, beats: 4, inversion, drop, octave: 3, bass: null, playStyle: 'held' });
function morceauRenverse(): Record<string, string> {
  const sections = [{ title: 'Couplet', chords: [accord('C', '', 1, 'none'), accord('A', 'min', 0, 'drop2'), accord('F', '', 2, 'none'), accord('G', 'dom7', 0, 'none')] }];
  return { harmohubSongs: JSON.stringify([{ id: 'e2e-1', name: 'Démo', savedAt: Date.now(), sections }]), harmohubCurrentSongId: 'e2e-1', myProgression: JSON.stringify({ sections }) };
}

test.describe('Affichage de la grille @parametres', () => {
  test('« Degrés » : allumé au départ, éteint il retire les chiffres romains de la grille, rallumé il les rend @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await degresAffiches(page)).toEqual(['I', 'vi', 'IV', 'V']);
    await ouvrir(page);
    await appuyer(page, interrupteur(page, NOM.degres));
    await expect(interrupteur(page, NOM.degres)).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => degresAffiches(page)).toEqual([]);
    expect(await page.locator('#progression-sections .grid-cell[data-index]').count()).toBe(4);   // les cases, elles, sont toujours là
    await appuyer(page, interrupteur(page, NOM.degres));
    await expect.poll(() => degresAffiches(page)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(garde.bloquees).toEqual([]);
  });

  test('« Fonction harmonique » (options avancées) : éteinte au départ ; allumée, T / SD / D s\'affichent sous les degrés, « ? » quand elle n\'est pas sûre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await fonctionsAffichees(page)).toEqual([]);
    await ouvrir(page);
    await deplierAvancees(page);
    await appuyer(page, interrupteur(page, NOM.fonction));
    await expect(interrupteur(page, NOM.fonction)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => fonctionsAffichees(page)).toEqual(['T', '?', 'SD', 'D']);   // C = tonique, Am = incertain, F = sous-dominante, G = dominante
    await appuyer(page, interrupteur(page, NOM.fonction));
    await expect.poll(() => fonctionsAffichees(page)).toEqual([]);
  });

  test('« Repères de temps » (options avancées) : un repère par mesure au départ, un par temps (trois de plus par mesure) en choisissant « Tous les temps »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });   // 4 mesures de 4 temps
    expect(await reperesAffiches(page)).toBe(4);
    await ouvrir(page);
    await deplierAvancees(page);
    await expect(reperesDeTemps(page).locator('option')).toHaveText(['Milieu de mesure', 'Tous les temps']);
    await reperesDeTemps(page).selectOption({ label: 'Tous les temps' });
    await expect.poll(() => reperesAffiches(page)).toBe(12);
    await reperesDeTemps(page).selectOption({ label: 'Milieu de mesure' });
    await expect.poll(() => reperesAffiches(page)).toBe(4);
  });

  test('« Position d\'accord » : « Masquée » ne montre rien, « Octave seule » montre O3, « Octave + renversement » montre aussi R1, D2… @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauRenverse() });
    await ouvrir(page);
    const l = liste(page, 'Position d\'accord');
    await expect(l.locator('option')).toHaveText(['Masquée', 'Octave seule (O3)', 'Octave + renversement (O3-R1)']);
    expect(await mentions(page)).toEqual(['O3-R1', 'O3-D2', 'O3-R2', 'O3']);   // choix d'usine : octave + renversement
    await l.selectOption({ label: 'Octave seule (O3)' });
    await expect.poll(() => mentions(page)).toEqual(['O3', 'O3', 'O3', 'O3']);
    await l.selectOption({ label: 'Masquée' });
    await expect.poll(() => mentions(page).then(m => m.filter(Boolean))).toEqual([]);
    await l.selectOption({ label: 'Octave + renversement (O3-R1)' });
    await expect.poll(() => mentions(page)).toEqual(['O3-R1', 'O3-D2', 'O3-R2', 'O3']);
  });

  test('« Date de dernière modification » : la liste « Mes morceaux » écrit la date à côté du nom ; éteinte, elle ne reste que le nombre d\'accords', async ({ ouvrirAppli }) => {
    const savedAt = Date.UTC(2026, 5, 15, 8, 30);   // 15 juin 2026, 10 h 30 à Paris (le fuseau des tests)
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G, savedAt }], 'a') });
    let liste_ = await ouvrirMesMorceaux(page);
    await expect(ligne(page, 'Alpha')).toContainText('4 accord(s) · 15 juin 2026 10:30');
    await page.keyboard.press('Escape');
    await expect(liste_).toBeHidden();

    await ouvrir(page);
    await appuyer(page, interrupteur(page, NOM.dateModif));
    await expect(interrupteur(page, NOM.dateModif)).toHaveAttribute('aria-checked', 'false');
    await fermer(page);
    liste_ = await ouvrirMesMorceaux(page);
    await expect(ligne(page, 'Alpha')).toContainText('4 accord(s)');
    await expect(ligne(page, 'Alpha')).not.toContainText('2026');
    expect(await lireStockage(page, 'harmohubShowSavedDate')).toBe('0');
  });
});

test.describe('Séquenceur : affichage @parametres @ordinateur', () => {
  test('« Noms des rythmes » : allumé, chaque rythme écrit son nom ; éteint, seule la vignette reste (les boutons rétrécissent) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    // l'état d'usine dépend de la largeur (allumé au-dessus de 1340 px, éteint en dessous : iPad en paysage = 1194 px) : on part de « allumé » dans tous les cas
    await ouvrir(page);
    if ((await interrupteur(page, NOM.nomsRythmes).getAttribute('aria-checked')) !== 'true') await interrupteur(page, NOM.nomsRythmes).click();
    await expect(interrupteur(page, NOM.nomsRythmes)).toHaveAttribute('aria-checked', 'true');
    await fermer(page);
    await ouvrirSequenceur(page);
    const nom = rythme(page, 'plaque').getByText('Plaqué', { exact: true });
    await expect(nom).toBeVisible();
    const largeurAvant = (await rythme(page, 'plaque').boundingBox())!.width;
    await ouvrir(page);
    await interrupteur(page, NOM.nomsRythmes).click();
    await expect(interrupteur(page, NOM.nomsRythmes)).toHaveAttribute('aria-checked', 'false');
    await expect(nom).toBeHidden();
    await expect.poll(async () => (await rythme(page, 'plaque').boundingBox())!.width).toBeLessThan(largeurAvant - 20);
    await expect(rythme(page, 'plaque')).toHaveAttribute('title', /Plaqué/);   // le nom reste lisible au survol
    await interrupteur(page, NOM.nomsRythmes).click();
    await expect(nom).toBeVisible();
  });

  test('« Barres du séquenceur » : 26 px au départ, de 22 à 48 par pas de 2 ; la hauteur des cases suit le curseur et est retenue @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    const hauteur = () => grille(page).locator('.sq-case').first().evaluate(e => Math.round(e.getBoundingClientRect().height));
    expect(await hauteur()).toBe(26);
    await ouvrir(page);
    const c = curseur(page, 'Barres du séquenceur');
    await expect(c).toHaveValue('26');
    await expect(c).toHaveAttribute('min', '22');
    await expect(c).toHaveAttribute('max', '48');
    await expect(c).toHaveAttribute('step', '2');
    await c.fill('40');
    await expect(c.locator('xpath=..')).toContainText('40 px');
    await expect.poll(hauteur).toBe(40);
    await c.fill('22');
    await expect.poll(hauteur).toBe(22);
    await c.fill('48');
    await expect.poll(hauteur).toBe(48);
    expect(await lireStockage(page, 'harmohubSequenceurLigne')).toBe('48');
    await fermer(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    // (l'appli rouvre le séquenceur tel qu'on l'a laissé : on ne le rouvre que s'il est fermé)
    if ((await page.locator('#vue-sequenceur').getAttribute('aria-pressed')) !== 'true') await ouvrirSequenceur(page);
    await expect(grille(page)).toBeVisible();
    await expect.poll(hauteur).toBe(48);
  });
});

test.describe('Apparence : verre dépoli @parametres', () => {
  const fond = (page: Page) => page.evaluate(() => ({
    verre: document.documentElement.getAttribute('data-glass'),
    couleur: document.documentElement.getAttribute('data-glass-bg'),
    image: getComputedStyle(document.body).backgroundImage,
  }));

  test('« Verre dépoli » : éteint au départ (fond uni) ; allumé, la page prend un fond coloré ; éteint de nouveau, le fond uni revient @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await fond(page)).toMatchObject({ verre: null, image: 'none' });
    await ouvrir(page);
    await appuyer(page, interrupteur(page, NOM.verre));
    await expect(interrupteur(page, NOM.verre)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await fond(page)).verre).toBe('1');
    expect((await fond(page)).image).toContain('gradient');
    await appuyer(page, interrupteur(page, NOM.verre));
    await expect.poll(async () => (await fond(page)).verre).toBeNull();
    expect((await fond(page)).image).toBe('none');
  });

  test('« Couleur du fond » : sept couleurs, « Aurore » au départ, chacune donne un fond différent quand le verre est allumé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrir(page);
    const groupe = page.getByRole('dialog', { name: 'Paramètres' }).getByRole('radiogroup', { name: 'Couleur du fond' });
    await expect(groupe.getByRole('radio')).toHaveText(['', '', '', '', '', '', '']);   // des pastilles : le nom est dans l'étiquette
    await expect(groupe.getByRole('radio')).toHaveCount(7);
    const noms = ['Aurore', 'Bleu', 'Vert', 'Violet', 'Rose', 'Ambre', 'Gris'];
    for (const n of noms) await expect(groupe.getByRole('radio', { name: n, exact: true })).toBeVisible();
    await expect(choix(page, 'Couleur du fond', 'Aurore')).toBeChecked();
    // la couleur est mémorisée même verre éteint, mais ne se voit qu'une fois le verre allumé
    await appuyer(page, choix(page, 'Couleur du fond', 'Bleu'));
    await expect(choix(page, 'Couleur du fond', 'Bleu')).toBeChecked();
    expect((await fond(page)).image).toBe('none');
    await appuyer(page, interrupteur(page, NOM.verre));
    await expect.poll(async () => (await fond(page)).image).toContain('gradient');
    const vus = new Set<string>();
    for (const n of noms) {
      await appuyer(page, choix(page, 'Couleur du fond', n));
      await expect(choix(page, 'Couleur du fond', n)).toBeChecked();
      await expect.poll(async () => (await fond(page)).couleur).not.toBeNull();
      vus.add((await fond(page)).image);
    }
    expect(vus.size).toBe(7);   // sept fonds distincts
  });
});
