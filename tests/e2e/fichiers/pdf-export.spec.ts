// MODULE « fichiers » — export PDF de la grille (fenêtre d'options, fichier téléchargé) et export intégral (plusieurs fichiers d'un coup).
// Le PDF est un vrai fichier (jsPDF + html2canvas, servis par le dépôt) : on vérifie qu'il est valide (en-tête, fin de fichier, pages), pas son rendu.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, bibliotheque, toast, choisirDansMenuFichiers, boutonFichiers, telecharger, telechargerPlusieurs, lireMidi, jsonDe, Telechargement,
} from './aide-fichiers';

const MORCEAU = () => bibliotheque([{ id: 'e2e-1', nom: 'Demo', accords: C_AM_F_G }], 'e2e-1');   // nom sans accent : limite du navigateur de test, voir le rapport
const fenetrePdf = (page: Page) => page.getByRole('dialog', { name: 'Exporter en PDF' });
const fenetreIntegral = (page: Page) => page.getByRole('dialog', { name: 'Export intégral du morceau' });
const pagesPdf = (t: Telechargement) => (t.contenu.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
const estUnPdf = (t: Telechargement) => t.contenu.subarray(0, 5).toString('latin1') === '%PDF-' && t.contenu.toString('latin1').trimEnd().endsWith('%%EOF');

test.describe('Export PDF @fichiers', () => {
  test('« Exporter en PDF » ouvre la fenêtre d\'options (position d\'accord, diagrammes, mesures par ligne) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    const f = fenetrePdf(page);
    await expect(f).toBeVisible();
    await expect(f.getByRole('switch', { name: 'Position d\'accord sur le PDF' })).toHaveAttribute('aria-checked', 'true');
    await expect(f.getByRole('switch', { name: 'Diagrammes des accords sur le PDF' })).toHaveAttribute('aria-checked', 'true');
    await expect(f.getByRole('combobox', { name: 'Mesures par ligne' })).toHaveValue('4');
    await expect(f.getByRole('button', { name: 'Exporter' })).toBeVisible();
    await expect(f.getByRole('button', { name: 'Annuler' })).toBeVisible();
  });

  test('« Exporter » télécharge un PDF valide nommé d\'après le morceau @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    const t = await telecharger(page, () => fenetrePdf(page).getByRole('button', { name: 'Exporter' }).click());
    expect(t.nom).toMatch(/^HarmoHub - Demo - Accords - \d{4}-\d{2}-\d{2} \d{4}\.pdf$/);
    expect(estUnPdf(t)).toBe(true);
    expect(pagesPdf(t)).toBeGreaterThanOrEqual(1);
    expect(t.contenu.length).toBeGreaterThan(3_000);
    await expect(fenetrePdf(page)).toBeHidden();
    await expect(toast(page)).toContainText('PDF exporté');
    expect(garde.bloquees).toEqual([]);
  });

  test('« Annuler » ferme la fenêtre sans rien télécharger', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    let telechargements = 0;
    page.on('download', () => { telechargements++; });
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    await fenetrePdf(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(fenetrePdf(page)).toBeHidden();
    await expect(boutonFichiers(page)).toBeVisible();
    expect(telechargements).toBe(0);
  });

  test('les interrupteurs et le nombre de mesures par ligne se règlent ; un PDF sans diagrammes est plus léger', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    const exporter = async (reglage?: (f: ReturnType<typeof fenetrePdf>) => Promise<void>) => {
      await choisirDansMenuFichiers(page, /Exporter en PDF/);
      if (reglage) await reglage(fenetrePdf(page));
      return telecharger(page, () => fenetrePdf(page).getByRole('button', { name: 'Exporter' }).click());
    };
    const complet = await exporter();
    const sobre = await exporter(async (f) => {
      await f.getByRole('switch', { name: 'Diagrammes des accords sur le PDF' }).click();
      await expect(f.getByRole('switch', { name: 'Diagrammes des accords sur le PDF' })).toHaveAttribute('aria-checked', 'false');
      await f.getByRole('switch', { name: 'Position d\'accord sur le PDF' }).click();
      await expect(f.getByRole('switch', { name: 'Position d\'accord sur le PDF' })).toHaveAttribute('aria-checked', 'false');
      await f.getByRole('combobox', { name: 'Mesures par ligne' }).selectOption('2');
    });
    expect(estUnPdf(complet) && estUnPdf(sobre)).toBe(true);
    expect(sobre.contenu.length).toBeLessThan(complet.contenu.length);
  });

  test('un morceau sans nom ne s\'exporte pas en PDF : l\'appli demande de le nommer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    let telechargements = 0;
    page.on('download', () => { telechargements++; });
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    await fenetrePdf(page).getByRole('button', { name: 'Exporter' }).click();
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour exporter le PDF');
    expect(telechargements).toBe(0);
  });
});

test.describe('Export intégral @fichiers', () => {
  test('la fenêtre propose la sauvegarde, les deux PDF et le MIDI cochés ; les paroles et l\'audio non cochés @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Export intégral/);
    const f = fenetreIntegral(page);
    await expect(f).toBeVisible();
    await expect(f).toContainText('Tous les fichiers de « Demo »');
    for (const n of [/Sauvegarde du morceau/, /Grille d'accords/, /Structure/, /MIDI/]) await expect(f.getByRole('checkbox', { name: n })).toBeChecked();
    for (const n of [/Données pour l'outil Paroles/, /Rendu audio/]) await expect(f.getByRole('checkbox', { name: n })).not.toBeChecked();
    await f.getByRole('button', { name: 'Annuler' }).click();
    await expect(f).toBeHidden();
  });

  test('sans dossier de rangement, les PDF et le MIDI sont téléchargés (décochant le reste) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Export intégral/);
    const f = fenetreIntegral(page);
    await f.getByRole('checkbox', { name: /Sauvegarde du morceau/ }).uncheck();
    const fichiers = await telechargerPlusieurs(page, 3, () => f.getByRole('button', { name: 'Exporter' }).click());
    expect(fichiers.map(t => t.nom.replace(/ - \d{4}-\d{2}-\d{2} \d{4}/, '')).sort()).toEqual([
      'HarmoHub - Demo - Accords.pdf', 'HarmoHub - Demo - MIDI.mid', 'HarmoHub - Demo - Structure.pdf',
    ]);
    for (const t of fichiers.filter(x => x.nom.endsWith('.pdf'))) expect(estUnPdf(t)).toBe(true);
    expect(lireMidi(fichiers.find(x => x.nom.endsWith('.mid'))!.contenu).notes.length).toBeGreaterThan(0);
    await expect(toast(page)).toContainText('3 fichier(s) exporté(s)');
    await expect(f).toBeHidden();
  });

  test('on peut n\'exporter que le MIDI : un seul fichier', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Export intégral/);
    const f = fenetreIntegral(page);
    for (const n of [/Sauvegarde du morceau/, /Grille d'accords/, /Structure/]) await f.getByRole('checkbox', { name: n }).uncheck();
    const t = await telecharger(page, () => f.getByRole('button', { name: 'Exporter' }).click());
    expect(t.nom).toMatch(/^HarmoHub - Demo - MIDI - .*\.mid$/);
    await expect(toast(page)).toContainText('1 fichier(s) exporté(s)');
  });

  test('l\'export intégral livre aussi la sauvegarde JSON du morceau (4 fichiers) sans message d\'échec @critique', async ({ ouvrirAppli }) => {
    test.fail(true, 'F-03 (bugs.md) : sans dossier de rangement, la « Sauvegarde du morceau » échoue (« échec : Sauvegarde du morceau », erreur « pas-de-dossier »)');
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    await choisirDansMenuFichiers(page, /Export intégral/);
    const fichiers = await telechargerPlusieurs(page, 4, () => fenetreIntegral(page).getByRole('button', { name: 'Exporter' }).click());
    expect(fichiers.some(t => /Morceau.*\.json$/.test(t.nom))).toBe(true);
    expect(jsonDe(fichiers.find(t => /\.json$/.test(t.nom))!).kind).toBe('library-backup');
    await expect(toast(page)).not.toContainText('échec');
  });

  test('tout décocher puis « Exporter » ferme la fenêtre sans rien télécharger (aucun message : voir les observations du rapport)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: MORCEAU() });
    let telechargements = 0;
    page.on('download', () => { telechargements++; });
    await choisirDansMenuFichiers(page, /Export intégral/);
    const f = fenetreIntegral(page);
    for (const n of [/Sauvegarde du morceau/, /Grille d'accords/, /Structure/, /MIDI/]) await f.getByRole('checkbox', { name: n }).uncheck();
    await f.getByRole('button', { name: 'Exporter' }).click();
    await expect(f).toBeHidden();
    expect(telechargements).toBe(0);
  });
});
