// MODULE « fichiers » — rangement sur le disque (File System Access : Chromium et Edge seulement).
// Le sélecteur de dossier natif est hors de portée de Playwright : `showDirectoryPicker` est remplacé par un faux qui rend un répertoire du
// stockage privé du navigateur (OPFS, un vrai système de fichiers isolé). Tout le reste (écriture, noms, sous-dossiers, versions) est le vrai code de l'appli.
// LIMITE DE LA VM (voir bugs.md, F-04) : sous le Chromium « headless » de cette VM, exporter pour un morceau ENREGISTRÉ vers ce dossier fait mourir
// le navigateur (« Target page, context or browser has been closed », déjà vu par les bancs historiques). Edge, lui, passe. Ces tests tournent donc sur Edge
// partout ; sur le projet `chromium` ils sont ignorés sauf si E2E_DISQUE_CHROMIUM=1 (à lancer pour vérifier si le défaut a disparu d'une version à l'autre).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, bibliotheque, toast, simulerDossierDeRangement, arbreDuDossier, lireFichierDuDossier, lireOctetsDuDossier, choisirDansMenuFichiers, ouvrirMenuFichiers,
  choisirDansMenuMorceau, ouvrirMenuMorceau, menuMorceau, lireMidi, jsonDe, telecharger, ouvrirMesMorceaux, fenetreMorceaux,
} from './aide-fichiers';

const MORCEAU = () => bibliotheque([{ id: 'e2e-1', nom: 'Demo', accords: C_AM_F_G }], 'e2e-1');
const nomDeFichier = (c: string) => c.split('/').pop()!.replace(/ - \d{4}-\d{2}-\d{2} \d{6}/, '').replace(/ - \d{4}-\d{2}-\d{2} \d{4}/, '');

test.describe('Rangement sur le disque @fichiers @disque @ordinateur', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const vmChromium = testInfo.project.name === 'chromium' && !process.env.E2E_DISQUE_CHROMIUM;
    test.fixme(vmChromium, 'F-04 : le Chromium headless de cette VM meurt à l\'écriture vers le dossier simulé ; tourne sur Edge');
    await simulerDossierDeRangement(page);
  });
  // Là où File System Access n'existe pas (Firefox, Safari, iPad), le repli téléchargement est éprouvé par les autres specs ; ici on le constate.
  async function ouvrirSiPossible(page: Page, ouvrirAppli: (o?: any) => Promise<Page>) {
    await ouvrirAppli({ reglages: MORCEAU() });
    const peut = await page.evaluate(() => typeof (window as any).showDirectoryPicker === 'function' && 'getDirectory' in (navigator.storage || {}));
    test.skip(!peut, 'File System Access absent de ce navigateur : le repli (téléchargement) est couvert par les specs midi / pdf / export-import-json');
    return page;
  }
  const choisirLeDossier = async (page: Page) => {
    await choisirDansMenuFichiers(page, /Choisir un dossier de rangement/);
    await expect(toast(page)).toContainText('RangementE2E');
  };

  test('« Choisir un dossier de rangement » crée l\'arborescence et le menu affiche le dossier retenu @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Choisir un dossier de rangement/ })).toBeVisible();
    await page.getByRole('button', { name: /Choisir un dossier de rangement/ }).click();
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Dossier : RangementE2E/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ne plus ranger automatiquement/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Choisir un dossier de rangement/ })).toHaveCount(0);
  });

  test('« Rangement sur le disque… » du menu du nom fait le même choix de dossier', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirDansMenuMorceau(page, 'Rangement sur le disque…');
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Dossier : RangementE2E/ })).toBeVisible();
  });

  test('l\'export MIDI va dans le dossier (sous-dossier MIDI) et non dans les téléchargements @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    let telechargements = 0;
    page.on('download', () => { telechargements++; });
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect(toast(page)).toContainText('MIDI exporté → RangementE2E/MIDI');
    await expect.poll(() => arbreDuDossier(page)).toContain('MIDI/HarmoHub - Demo - MIDI.mid');
    const m = lireMidi(await lireOctetsDuDossier(page, 'MIDI/HarmoHub - Demo - MIDI.mid'));
    expect(m.notes.length).toBeGreaterThan(0);
    expect(telechargements).toBe(0);
  });

  test('l\'export PDF va dans PDF/Accords', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    await page.getByRole('dialog', { name: 'Exporter en PDF' }).getByRole('button', { name: 'Exporter' }).click();
    await expect(toast(page)).toContainText('PDF exporté → RangementE2E/PDF/Accords');
    await expect.poll(() => arbreDuDossier(page)).toContain('PDF/Accords/HarmoHub - Demo - Accords.pdf');
    expect((await lireOctetsDuDossier(page, 'PDF/Accords/HarmoHub - Demo - Accords.pdf')).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('réexporter remplace le fichier du même nom et garde l\'ancienne version dans « _versions » @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect.poll(() => arbreDuDossier(page)).toContain('MIDI/HarmoHub - Demo - MIDI.mid');
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect.poll(async () => (await arbreDuDossier(page)).filter(c => c.startsWith('MIDI/_versions/')).length).toBe(1);
    const arbre = await arbreDuDossier(page);
    expect(arbre.filter(c => c.startsWith('MIDI/') && !c.includes('_versions')).map(nomDeFichier)).toEqual(['HarmoHub - Demo - MIDI.mid']);
  });

  test('l\'export intégral range sauvegarde, deux PDF et MIDI chacun dans son dossier @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await choisirDansMenuFichiers(page, /Export intégral/);
    await page.getByRole('dialog', { name: 'Export intégral du morceau' }).getByRole('button', { name: 'Exporter' }).click();
    await expect(toast(page)).toContainText('4 fichier(s) exporté(s) pour « Demo »', { timeout: 30_000 });
    const arbre = (await arbreDuDossier(page)).filter(c => !c.includes('_versions'));
    expect(arbre).toEqual([
      'MIDI/HarmoHub - Demo - MIDI.mid',
      'Morceaux/HarmoHub - Demo - Morceau.json',
      'PDF/Accords/HarmoHub - Demo - Accords.pdf',
      'PDF/Structure/HarmoHub - Demo - Structure.pdf',
    ]);
    const sauvegarde = JSON.parse(await lireFichierDuDossier(page, 'Morceaux/HarmoHub - Demo - Morceau.json'));
    expect(sauvegarde.kind).toBe('library-backup');
    expect(sauvegarde.songs[0].name).toBe('Demo');
  });

  test('la sauvegarde de toute la bibliothèque va dans le sous-dossier Bibliotheque', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await ouvrirMesMorceaux(page);
    await fenetreMorceaux(page).getByRole('button', { name: 'Exporter toute la bibliothèque' }).click();
    await expect.poll(async () => (await arbreDuDossier(page)).filter(c => c.startsWith('Bibliotheque/')).length).toBeGreaterThanOrEqual(1);
  });

  test('« Ne plus ranger automatiquement » ramène les exports dans les téléchargements @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await choisirDansMenuFichiers(page, /Ne plus ranger automatiquement/);
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Choisir un dossier de rangement/ })).toBeVisible();
    await page.keyboard.press('Escape');
    const t = await telecharger(page, () => choisirDansMenuFichiers(page, /Exporter en MIDI/));
    expect(t.nom).toMatch(/^HarmoHub - Demo - MIDI - .*\.mid$/);
    await expect(toast(page)).toContainText('dossier Téléchargements');
  });

  test('le dossier choisi est retenu après un rechargement', async ({ page, ouvrirAppli }) => {
    await ouvrirSiPossible(page, ouvrirAppli);
    await choisirLeDossier(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Dossier : RangementE2E/ })).toBeVisible();
  });
});

test.describe('Sans File System Access (repli téléchargement) @fichiers @ordinateur', () => {
  test('là où le navigateur ne sait pas ranger dans un dossier, ni « Rangement sur le disque… » ni « Choisir un dossier » ne sont proposés ; les exports sont des téléchargements @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirAppli({ reglages: MORCEAU() });
    const peut = await page.evaluate(() => typeof (window as any).showDirectoryPicker === 'function');
    await ouvrirMenuMorceau(page);
    await expect(menuMorceau(page).getByRole('menuitem', { name: 'Rangement sur le disque…' })).toHaveCount(peut ? 1 : 0);
    await page.keyboard.press('Escape');
    await ouvrirMenuFichiers(page);
    await expect(page.getByRole('button', { name: /Choisir un dossier de rangement/ })).toHaveCount(peut ? 1 : 0);
    await page.keyboard.press('Escape');
    if (!peut) {
      const t = await telecharger(page, () => choisirDansMenuFichiers(page, /Exporter en MIDI/));
      expect(t.nom).toMatch(/^HarmoHub - Demo - MIDI/);
      await expect(toast(page)).toContainText('dossier Téléchargements');
    }
  });
});
