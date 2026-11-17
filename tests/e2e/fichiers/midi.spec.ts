// MODULE « fichiers » — export MIDI (menu « Fichiers ») et import MIDI (« En déduire une grille d'accords »).
// Le fichier téléchargé est relu octet par octet (en-tête, tempo, mesure, notes) ; l'import reçoit un MIDI fabriqué par le test ou l'export lui-même.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, bibliotheque, morceauxStockes, titre, etat, toast, choisirDansMenuFichiers, telecharger, preparerImport, creerMorceau, noms,
  lireMidi, classesDeLaMesure, fabriquerMidi, fichierMidi,
} from './aide-fichiers';

const exporterMidi = (page: import('@playwright/test').Page) => telecharger(page, () => choisirDansMenuFichiers(page, /Exporter en MIDI/));
const importerMidi = async (page: import('@playwright/test').Page, fichier: ReturnType<typeof fichierMidi>) => {
  await preparerImport(page, fichier);
  await choisirDansMenuFichiers(page, /Importer un MIDI/);
};

test.describe('Export MIDI @fichiers', () => {
  test('« Exporter en MIDI » télécharge un vrai fichier MIDI nommé d\'après le morceau, avec le tempo et la mesure @critique', async ({ ouvrirAppli, garde }) => {
    // (nom du morceau sans accent : sous Chromium et Edge le navigateur de test rend « download » pour un nom accentué, limite du navigateur de test, pas de l'appli : voir le rapport)
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'e2e-1', nom: 'Demo', accords: C_AM_F_G }], 'e2e-1') });
    const t = await exporterMidi(page);
    expect(t.nom).toMatch(/^HarmoHub - Demo - MIDI - \d{4}-\d{2}-\d{2} \d{4}\.mid$/);
    const m = lireMidi(t.contenu);
    expect(m.format).toBeLessThanOrEqual(1);
    expect(m.ppq).toBe(480);
    expect(m.tempoMicros).toBe(500_000);   // 120 BPM
    expect(m.signature).toBe('4/4');
    expect(m.noms).toContain('Demo');
    await expect(toast(page)).toContainText('MIDI exporté');
    expect(garde.bloquees).toEqual([]);
  });

  test('chaque accord de la grille devient les bonnes notes, une mesure chacun @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const m = lireMidi((await exporterMidi(page)).contenu);
    expect(classesDeLaMesure(m, 0)).toEqual([0, 4, 7]);      // C : do mi sol
    expect(classesDeLaMesure(m, 1)).toEqual([0, 4, 9]);      // Am : do mi la
    expect(classesDeLaMesure(m, 2)).toEqual([0, 5, 9]);      // F : do fa la
    expect(classesDeLaMesure(m, 3)).toEqual([2, 7, 11]);     // G : ré sol si
    expect(Math.max(...m.notes.map(n => n.tick))).toBeLessThan(4 * 1920);   // rien après la quatrième mesure
  });

  test('le tempo du morceau est celui du fichier', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { ...bibliotheque([{ id: 'e2e-1', nom: 'Rapide', accords: C_AM_F_G }], 'e2e-1') } });
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('harmohubSongs')!); s[0].bpm = 90; localStorage.setItem('harmohubSongs', JSON.stringify(s)); });
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    const m = lireMidi((await exporterMidi(page)).contenu);
    expect(Math.round(60_000_000 / m.tempoMicros!)).toBe(90);
  });

  test('un morceau nommé mais sans accord s\'exporte en MIDI sans note', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([{ id: 'e2e-1', nom: 'Silence', accords: [] }], 'e2e-1') });
    const t = await exporterMidi(page);
    expect(t.nom).toMatch(/^HarmoHub - Silence - MIDI.*\.mid$/);
    expect(lireMidi(t.contenu).notes).toEqual([]);
  });

  test('un morceau sans nom ne s\'exporte pas : l\'appli demande de le nommer d\'abord @critique', async ({ page, ouvrirAppli }) => {
    await ouvrirAppli();
    let telechargements = 0;
    page.on('download', () => { telechargements++; });
    await choisirDansMenuFichiers(page, /Exporter en MIDI/);
    await expect(toast(page)).toContainText('Nomme d\'abord ton morceau pour exporter le MIDI');
    expect(telechargements).toBe(0);
  });
});

test.describe('Import MIDI @fichiers', () => {
  test('un MIDI de quatre accords devient quatre accords de la grille, avec un message « 4 mesures importées » @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli();
    await importerMidi(page, fichierMidi('cafg.mid', fabriquerMidi([[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]])));
    await expect(toast(page)).toContainText('4 mesures importées · 4 accords reconnus');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(etat(page)).toContainText('Non enregistré');   // l'import modifie la grille ; rien n'est enregistré sans demande
    expect(await morceauxStockes(page)).toEqual([]);
    expect(garde.bloquees).toEqual([]);
  });

  test('l\'import s\'ajoute à la suite de la grille existante, sans rien effacer @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: 'min' }] });
    await importerMidi(page, fichierMidi('c.mid', fabriquerMidi([[60, 64, 67], [67, 71, 74]])));
    await expect(toast(page)).toContainText('2 mesures importées');
    expect(await noms(page)).toEqual(['Dm', 'C', 'G']);
  });

  test('aller-retour : un MIDI exporté par l\'appli se réimporte en retrouvant la même grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const t = await exporterMidi(page);
    await creerMorceau(page, 'Retour');
    expect(await noms(page)).toEqual([]);
    await importerMidi(page, fichierMidi(t.nom, t.contenu));
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(titre(page)).toHaveText('Retour');
  });

  test('un fichier qui n\'est pas un MIDI est refusé avec un message et ne change rien @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await importerMidi(page, fichierMidi('faux.mid', Buffer.from('ceci n\'est pas un fichier MIDI')));
    await expect(toast(page)).toContainText('Import MIDI impossible : ce fichier n\'est pas un MIDI');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(etat(page)).not.toContainText('Non enregistré');
  });

  test('l\'import MIDI est annulable (Ctrl+Z / bouton Annuler)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: 'min' }] });
    await importerMidi(page, fichierMidi('c.mid', fabriquerMidi([[60, 64, 67]])));
    await expect.poll(() => noms(page)).toEqual(['Dm', 'C']);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect.poll(() => noms(page)).toEqual(['Dm']);
  });

  test('un MIDI importé puis enregistré est retrouvé dans la bibliothèque', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await importerMidi(page, fichierMidi('cafg.mid', fabriquerMidi([[60, 64, 67], [57, 60, 64]])));
    await expect.poll(() => noms(page)).toEqual(['C', 'Am']);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nom du morceau…' }).fill('Venu du MIDI');
    await page.getByRole('textbox', { name: 'Nom du morceau…' }).press('Enter');
    await expect(titre(page)).toHaveText('Venu du MIDI');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await expect(titre(page)).toHaveText('Venu du MIDI');
    expect(await noms(page)).toEqual(['C', 'Am']);   // ce que l'utilisateur relit après rechargement
  });
});
