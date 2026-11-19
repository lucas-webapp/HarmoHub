// MODULE « robustesse » — les ÉTATS VIDES : un morceau sans accord, une partie vide au milieu d'un morceau, le dernier accord supprimé.
// L'appli doit rester calme : pas d'exception, pas de case allumée, des boutons qui n'ont rien à faire qui le disent, des messages clairs.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, cases, noms, collecterErreurs, ajouterAccords, titre, etat, toast, morceauxStockes, enregistrerSous, telecharger,
  choisirDansMenuFichiers, champNomMorceau, ouvrirMenuMorceau, menuMorceau, lireMidi, reglagesMorceau, caseN,
} from './aide-robustesse';

// Le message « Nomme d'abord… » ouvre le champ du nom du morceau, au clavier : Échap l'abandonne (un clic ailleurs enregistrerait « Sans titre », voir Z-01).
async function abandonnerLeNom(page: import('@playwright/test').Page) {
  await expect(champNomMorceau(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(champNomMorceau(page)).toBeHidden();
}
const lecture = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Lecture', exact: true });
const stop = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Stop', exact: true });

test.describe('États vides : un morceau sans accord @robustesse', () => {
  test('au premier lancement : une partie vide, « Nouveau morceau », Annuler et Rétablir éteints, aucune erreur @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await expect(cases(page)).toHaveCount(0);
    await expect(titre(page)).toHaveText('Nouveau morceau');
    await expect(etat(page)).toHaveText('Nouveau morceau');
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Rétablir', exact: true })).toBeDisabled();
    // la partie vide est bien là, avec de quoi y écrire
    await expect(page.locator('#progression-sections .prog-title')).toHaveCount(1);
    if (!estMobile(page)) await expect(page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' })).toBeVisible();
    else await expect(page.locator('.prog-section-ajout').first()).toBeVisible();
    expect(erreurs).toEqual([]);
    expect(garde.bloquees).toEqual([]);
  });

  test('« Lecture » puis « Stop » sans accord : rien ne joue, rien ne s\'allume, aucune erreur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await lecture(page).click();
    // la lecture ne démarre pas : aucune case (il n'y en a pas) et le bouton Lecture ne passe pas en « pause »
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying), { timeout: 3000 }).toBe(false);
    await stop(page).click();
    await lecture(page).click();
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    await expect(page.locator('#progression-sections .grid-cell.playing')).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('la barre de lecture d\'un morceau vide : mesure 1, tempo 120, métronome et boucle actionnables sans erreur @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await expect(page.getByRole('button', { name: /^120\s*BPM/ })).toBeVisible();
    await page.getByRole('button', { name: /^Bouc/ }).click();   // « Boucler — … » puis « Boucle activée — … » : le nom change
    await page.getByRole('button', { name: /^Bouc/ }).click();
    await page.getByRole('button', { name: /^Garder le métronome/ }).click();
    await page.getByRole('button', { name: /^Garder le métronome/ }).click();
    await lecture(page).click();
    await stop(page).click();
    await expect(page.getByRole('button', { name: /^120\s*BPM/ })).toBeVisible();
    expect(erreurs).toEqual([]);
  });

  test('les raccourcis clavier sans accord (Suppr, Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y, Échap) ne font rien et ne plantent pas @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await page.locator('#progression-sections').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    for (const touche of ['Delete', 'Backspace', 'Control+a', 'Control+c', 'Control+v', 'Control+x', 'Control+z', 'Control+y', 'Control+Shift+z', 'Escape', 'ArrowRight', 'ArrowLeft', 'Space']) {
      await page.keyboard.press(touche);
    }
    await expect(cases(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
    expect(erreurs).toEqual([]);
  });

  test('le séquenceur d\'un morceau vide dit d\'ajouter un accord, et le tiroir clavier / guitare reste utilisable @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await page.locator('#vue-sequenceur').click();
    await expect(page.getByText('Ajoute un accord à la partie pour régler son rythme ici.')).toBeVisible();
    await expect(page.locator('#sq-grille .sq-case')).toHaveCount(0);
    await page.locator('#vue-sequenceur').click();
    await page.getByRole('button', { name: 'Afficher la guitare' }).click();
    await page.getByRole('button', { name: 'Afficher le piano' }).click();
    expect(erreurs).toEqual([]);
  });

  test('transposer un morceau vide vers le haut puis vers le bas : la grille reste vide, aucune erreur @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    await page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' }).click();
    await page.getByRole('button', { name: 'Transposer tout le morceau vers le bas' }).click();
    await page.getByRole('button', { name: 'Transposer tout le morceau vers le bas' }).click();
    await expect(cases(page)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('exporter un morceau SANS NOM : chaque export dit « Nomme d\'abord ton morceau… » au lieu de produire un fichier vide @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const telechargements: string[] = [];
    page.on('download', (d) => telechargements.push(d.suggestedFilename()));
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour exporter le MIDI');
    await abandonnerLeNom(page);
    await choisirDansMenuFichiers(page, /Export intégral/);
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour l\'exporter en entier');
    await abandonnerLeNom(page);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitem', { name: 'Exporter…' }).click();
    await page.getByText('Ce morceau', { exact: true }).click();
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour le sauvegarder');
    await abandonnerLeNom(page);
    expect(telechargements).toEqual([]);
    expect(await morceauxStockes(page)).toEqual([]);
  });

  test('Z-01 : après « Nomme d\'abord ton morceau… », un clic à côté du champ n\'enregistre pas un morceau vide « Sans titre »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour exporter le MIDI');
    await expect(champNomMorceau(page)).toBeFocused();
    await page.locator('#progression-sections').click({ position: { x: 10, y: 10 }, force: true });
    await expect(champNomMorceau(page)).toBeHidden();
    expect(await morceauxStockes(page)).toEqual([]);
  });

  test('un morceau VIDE mais nommé s\'enregistre, se retrouve après rechargement et s\'exporte (JSON, MIDI sans note, PDF) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const erreurs = collecterErreurs(page);
    page.on('dialog', (d) => void d.accept());
    await enregistrerSous(page, 'Vide');
    expect(await morceauxStockes(page)).toMatchObject([{ name: 'Vide', accords: [] }]);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(titre(page)).toHaveText('Vide');
    await expect(cases(page)).toHaveCount(0);

    const json = await telecharger(page, async () => {
      await ouvrirMenuMorceau(page);
      await menuMorceau(page).getByRole('menuitem', { name: 'Exporter…' }).click();
      await page.getByText('Ce morceau', { exact: true }).click();
    });
    expect(JSON.parse(json.texte).songs).toMatchObject([{ name: 'Vide' }]);
    const midi = await telecharger(page, () => choisirDansMenuFichiers(page, /Exporter en MIDI/));
    const lu = lireMidi(midi.contenu);
    expect(lu.notes).toEqual([]);
    expect(lu.noms).toEqual(['Vide']);
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    const pdf = await telecharger(page, () => page.getByRole('dialog', { name: 'Exporter en PDF' }).getByRole('button', { name: 'Exporter', exact: true }).click());
    expect(pdf.contenu.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(erreurs).toEqual([]);
  });
});

test.describe('États vides : le dernier accord, une partie vide au milieu @robustesse', () => {
  test('supprimer le dernier accord ramène à l\'état vide : lecture muette, rechargement propre, Annuler le rend @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    const erreurs = collecterErreurs(page);
    page.on('dialog', (d) => void d.accept());
    await caseN(page, 0, 0).click();
    await expect(caseN(page, 0, 0)).toHaveClass(/\bselected\b/);
    await page.keyboard.press('Delete');
    await expect(cases(page)).toHaveCount(0);
    await lecture(page).click();
    await expect.poll(() => page.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C']);   // « Annuler » rend l'accord supprimé
    await page.keyboard.press('Control+y');
    await expect(cases(page)).toHaveCount(0);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(cases(page)).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('une partie vide entre deux parties pleines : la lecture la traverse sans s\'arrêter et le morceau s\'enregistre @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: [{ root: 'C', quality: '', beats: 1 }, { root: 'G', quality: '', beats: 1 }] },
      { titre: 'Vide', accords: [] },
      { titre: 'Refrain', accords: [{ root: 'F', quality: '', beats: 1 }, { root: 'A', quality: 'min', beats: 1 }] },
    ]) });
    const erreurs = collecterErreurs(page);
    await expect(page.locator('#progression-sections .prog-title')).toHaveCount(3);
    expect(await noms(page)).toEqual(['C', 'G', 'F', 'Am']);
    const vus = new Set<string>();
    await page.exposeFunction('__vu', (t: string) => { vus.add(t); });
    await page.evaluate(() => {
      new MutationObserver(() => document.querySelectorAll('#progression-sections .grid-cell.playing .cell-sym').forEach((e) => (window as any).__vu((e.textContent || '').trim())))
        .observe(document.querySelector('#progression-sections')!, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await lecture(page).click();
    await expect.poll(() => vus.has('Am'), { timeout: 25_000, message: 'la lecture doit atteindre le dernier accord, après la partie vide' }).toBe(true);
    expect([...vus]).toEqual(expect.arrayContaining(['C', 'G', 'F', 'Am']));
    await stop(page).click();
    await expect(page.locator('#progression-sections .grid-cell.playing')).toHaveCount(0);
    expect(erreurs).toEqual([]);
  });

  test('ajouter le premier accord à un morceau vide le fait exister : grille, état « Non enregistré », Annuler actif @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ajouterAccords(page, ['Dm7']);
    await expect(cases(page)).toHaveCount(1);
    expect(await noms(page)).toEqual(['Dm7']);
    await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeEnabled();
    await enregistrerSous(page, 'Premier');
    expect(await morceauxStockes(page)).toMatchObject([{ name: 'Premier', accords: ['Dmin7'] }]);
  });
});

test.describe('États vides : une bibliothèque sans le morceau courant @robustesse', () => {
  test('l\'identifiant du morceau courant ne correspond à rien : l\'appli ouvre un morceau neuf, sans erreur, et la bibliothèque reste intacte', async ({ ouvrirAppli }) => {
    const m = reglagesMorceau([{ titre: 'Couplet', accords: C_AM_F_G }], 'Alpha');
    const page = await ouvrirAppli({ reglages: { harmohubSongs: m.harmohubSongs, harmohubCurrentSongId: 'fantome' } });
    const erreurs = collecterErreurs(page);
    await expect(titre(page)).toHaveText('Nouveau morceau');
    await expect(cases(page)).toHaveCount(0);
    expect(await morceauxStockes(page)).toMatchObject([{ name: 'Alpha', accords: ['C', 'Amin', 'F', 'G'] }]);
    expect(erreurs).toEqual([]);
  });
});
