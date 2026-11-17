// Aides communes aux specs du module « fichiers » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Les morceaux vivent dans le stockage local (`harmohubSongs`) ; les téléchargements et le sélecteur de fichiers se pilotent par les
// évènements `download` et `filechooser` de Playwright ; le dossier de rangement (File System Access) est simulé par un répertoire OPFS.
import { expect } from '../support/fixtures';
import type { Page, Locator, Download } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { readFileSync } from 'node:fs';
import { C_AM_F_G, estMobile, noms } from '../grille/aide-grille';
import type { Accord } from '../support/appli';

export { C_AM_F_G, estMobile, noms };

const accordComplet = (a: Accord) => ({ root: a.root, quality: a.quality, beats: a.beats ?? 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });

export type MorceauGraine = { id: string; nom: string; accords: Accord[]; dossier?: string | null; savedAt?: number };

// Une bibliothèque de départ (plusieurs morceaux enregistrés), posée dans le stockage local avant le chargement ; `courant` est ouvert.
export function bibliotheque(morceaux: MorceauGraine[], courant: string): Record<string, string> {
  const songs = morceaux.map(m => ({
    id: m.id, name: m.nom, savedAt: m.savedAt ?? Date.now(), folder: m.dossier ?? null,
    sections: [{ title: 'Couplet', chords: m.accords.map(accordComplet) }],
  }));
  const actif = songs.find(s => s.id === courant)!;
  return { harmohubSongs: JSON.stringify(songs), harmohubCurrentSongId: courant, myProgression: JSON.stringify({ sections: actif.sections }) };
}

// ---------- lire l'état (l'appli est la source de vérité ; jamais utilisé pour DÉCLENCHER quelque chose) ----------
export type MorceauStocke = { id: string; name: string; folder: string | null; accords: string[]; parties: number };
export const morceauxStockes = (page: Page): Promise<MorceauStocke[]> => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).map(s => ({
    id: s.id, name: s.name, folder: s.folder ?? null, parties: s.sections.length,
    accords: s.sections.flatMap((p: any) => p.chords.map((c: any) => c.root + (c.quality || ''))),
  })));
export const morceauCourantId = (page: Page): Promise<string | null> => page.evaluate(() => localStorage.getItem('harmohubCurrentSongId'));

// ---------- la barre du haut ----------
export const titre = (page: Page): Locator => page.locator('#tb-titre');          // le bouton qui porte le nom du morceau et ouvre son menu
export const etat = (page: Page): Locator => page.locator('#tb-etat');            // « Nouveau morceau », « Enregistré à 11:45 », « Non enregistré »
export const toast = (page: Page): Locator => page.locator('#toast');
export const boutonEnregistrer = (page: Page): Locator => page.getByRole('button', { name: 'Enregistrer', exact: true });
export const champNomMorceau = (page: Page): Locator => page.getByRole('textbox', { name: 'Nom du morceau…' });
export const menuMorceau = (page: Page): Locator => page.getByRole('menu', { name: 'Morceau' });

export async function ouvrirMenuMorceau(page: Page): Promise<Locator> {
  await titre(page).click();
  await expect(menuMorceau(page)).toBeVisible();
  return menuMorceau(page);
}
export async function choisirDansMenuMorceau(page: Page, entree: string | RegExp) {
  const menu = await ouvrirMenuMorceau(page);
  await menu.getByRole('menuitem', { name: entree }).click();
}

// Nomme et enregistre un morceau neuf (bouton « Enregistrer », champ « Nom du morceau… », Entrée).
export async function enregistrerSous(page: Page, nom: string) {
  await boutonEnregistrer(page).click();
  await champNomMorceau(page).fill(nom);
  await champNomMorceau(page).press('Enter');
  await expect(titre(page)).toHaveText(nom);
  await expect(etat(page)).toContainText('Enregistré');
}

// Une modification d'utilisateur qui marche aussi au téléphone : changer le titre de la partie (le champ « Section »).
export async function modifierLeMorceau(page: Page, texte = 'Refrain') {
  await page.getByRole('textbox', { name: 'Section' }).first().fill(texte);
  await page.getByRole('textbox', { name: 'Section' }).first().press('Enter');
  await expect(etat(page)).toContainText('Non enregistré');
}

// ---------- la fenêtre « Mes morceaux » ----------
export const fenetreMorceaux = (page: Page): Locator => page.getByRole('dialog', { name: 'Mes morceaux' });
export const ligne = (page: Page, nom: string | RegExp): Locator => fenetreMorceaux(page).locator('.file-row').filter({ has: page.locator('.file-name', { hasText: nom }) });
export const groupe = (page: Page, nom: string): Locator => fenetreMorceaux(page).locator('details.file-group').filter({ has: page.locator('.file-group-name', { hasText: nom }) });
export async function ouvrirMesMorceaux(page: Page): Promise<Locator> {
  await choisirDansMenuMorceau(page, 'Mes morceaux…');
  await expect(fenetreMorceaux(page)).toBeVisible();
  return fenetreMorceaux(page);
}

// L'appli demande confirmation (boîte native) avant de supprimer ; renvoie les messages vus. `reponse` : true = OK, false = Annuler.
export function repondreAuxBoitesNatives(page: Page, reponse = true): string[] {
  const messages: string[] = [];
  page.on('dialog', d => {
    if (d.type() === 'beforeunload') { void d.accept(); return; }
    messages.push(d.message());
    void (reponse ? d.accept() : d.dismiss());
  });
  return messages;
}

// ---------- la fenêtre « Modifications non enregistrées » ----------
export const alerteNonEnregistre = (page: Page): Locator => page.getByRole('alertdialog', { name: 'Modifications non enregistrées' });
export const fenetreNouveau = (page: Page): Locator => page.getByRole('dialog', { name: 'Nouveau morceau' });
export async function creerMorceau(page: Page, nom: string) {
  await choisirDansMenuMorceau(page, 'Nouveau morceau');
  await expect(fenetreNouveau(page)).toBeVisible();
  await fenetreNouveau(page).getByRole('textbox', { name: 'Titre du morceau' }).fill(nom);
  await fenetreNouveau(page).getByRole('button', { name: 'Créer' }).click();
  await expect(fenetreNouveau(page)).toBeHidden();
}

// ---------- téléchargements ----------
export type Telechargement = { nom: string; contenu: Buffer; texte: string };
// Déclenche `action` et attend le téléchargement qu'elle provoque (évènement `download`).
export async function telecharger(page: Page, action: () => Promise<unknown>): Promise<Telechargement> {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), action()]);
  return lire(dl);
}
async function lire(dl: Download): Promise<Telechargement> {
  const chemin = await dl.path();
  const contenu = readFileSync(chemin);
  return { nom: dl.suggestedFilename(), contenu, texte: contenu.toString('utf8') };
}
// Récolte TOUS les téléchargements pendant `action` (export intégral : plusieurs fichiers) ; attend `attendus` fichiers.
export async function telechargerPlusieurs(page: Page, attendus: number, action: () => Promise<unknown>): Promise<Telechargement[]> {
  const vus: Download[] = [];
  const ecoute = (d: Download) => vus.push(d);
  page.on('download', ecoute);
  await action();
  await expect.poll(() => vus.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(attendus);
  page.off('download', ecoute);
  return Promise.all(vus.map(lire));
}

// ---------- sélecteur de fichiers (import) ----------
// Selon le navigateur, l'appli passe par `showOpenFilePicker` (Chromium / Edge, fenêtre native hors de portée de Playwright) ou par un champ
// <input type="file"> (évènement `filechooser`). On prépare les DEUX : le sélecteur natif est remplacé par un faux qui rend le fichier donné,
// et le champ classique reçoit le même fichier. À appeler AVANT le geste qui ouvre le sélecteur.
export type FichierAImporter = { name: string; mimeType: string; buffer: Buffer };
export const fichierJson = (name: string, objet: unknown): FichierAImporter => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof objet === 'string' ? objet : JSON.stringify(objet)) });
export async function preparerImport(page: Page, fichier: FichierAImporter) {
  page.removeAllListeners('filechooser');
  page.on('filechooser', (fc) => { void fc.setFiles(fichier); });
  await page.evaluate(({ nom, type, b64 }) => {
    if (typeof (window as any).showOpenFilePicker !== 'function') return;
    (window as any).showOpenFilePicker = async () => [{ kind: 'file', name: nom, getFile: async () => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], nom, { type }) }];
  }, { nom: fichier.name, type: fichier.mimeType, b64: fichier.buffer.toString('base64') });
}

// ---------- le dossier de rangement (File System Access simulé par OPFS) ----------
// Script d'initialisation : `showDirectoryPicker` rend un répertoire du stockage privé du navigateur (vrai système de fichiers, mais isolé).
export function simulerDossierDeRangement(page: Page, nom = 'RangementE2E') {
  return page.addInitScript((n) => {
    // seulement là où le navigateur connaît l'API : Firefox et Safari ne l'ont pas, et il ne faut pas leur en inventer une
    if (typeof (window as any).showDirectoryPicker !== 'function') return;
    (window as any).showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true });
  }, nom);
}
// Les fichiers présents dans ce dossier, en chemins relatifs (« MIDI/HarmoHub - … .mid »).
export const arbreDuDossier = (page: Page, nom = 'RangementE2E'): Promise<string[]> => page.evaluate(async (n) => {
  const sortie: string[] = [];
  const rec = async (d: any, p: string) => { for await (const [nomE, h] of d.entries()) { if (h.kind === 'directory') await rec(h, p + nomE + '/'); else sortie.push(p + nomE); } };
  await rec(await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true }), '');
  return sortie.sort();
}, nom);
export const lireFichierDuDossier = (page: Page, chemin: string, nom = 'RangementE2E'): Promise<string> => page.evaluate(async ([n, c]) => {
  let d: any = await (await navigator.storage.getDirectory()).getDirectoryHandle(n);
  const morceaux = c.split('/');
  for (const m of morceaux.slice(0, -1)) d = await d.getDirectoryHandle(m);
  return (await (await d.getFileHandle(morceaux[morceaux.length - 1])).getFile()).text();
}, [nom, chemin] as const);

// ---------- le menu « Fichiers » (en haut à droite à l'ordinateur, bouton « Fichier » au téléphone) ----------
export const boutonFichiers = (page: Page): Locator => page.getByRole('button', { name: 'Importer / exporter' });
export async function ouvrirMenuFichiers(page: Page) {
  await boutonFichiers(page).click();
  await expect(boutonFichiers(page)).toHaveAttribute('aria-expanded', 'true');
}
export async function choisirDansMenuFichiers(page: Page, entree: RegExp | string) {
  await ouvrirMenuFichiers(page);
  await page.getByRole('button', { name: entree }).click();
}

export const jsonDe = (t: Telechargement) => JSON.parse(t.texte);

// ---------- MIDI : lire un fichier (format 0/1) et en fabriquer un ----------
export type NoteMidi = { piste: number; tick: number; note: number; vitesse: number };
export type MidiLu = { format: number; ppq: number; pistes: number; noms: string[]; tempoMicros: number | null; signature: string | null; notes: NoteMidi[] };
export function lireMidi(buf: Buffer): MidiLu {
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('en-tête MThd absent');
  const format = buf.readUInt16BE(8), nbPistes = buf.readUInt16BE(10), ppq = buf.readUInt16BE(12);
  const sortie: MidiLu = { format, ppq, pistes: nbPistes, noms: [], tempoMicros: null, signature: null, notes: [] };
  let p = 14;
  for (let piste = 0; piste < nbPistes; piste++) {
    if (buf.toString('latin1', p, p + 4) !== 'MTrk') throw new Error('piste attendue en ' + p);
    const fin = p + 8 + buf.readUInt32BE(p + 4); p += 8;
    let tick = 0, statut = 0;
    const vlq = () => { let v = 0, o; do { o = buf[p++]; v = (v << 7) | (o & 0x7f); } while (o & 0x80); return v; };
    while (p < fin) {
      tick += vlq();
      let o = buf[p];
      if (o & 0x80) { statut = o; p++; }
      if (statut === 0xff) {
        const type = buf[p++], n = vlq(), data = buf.subarray(p, p + n); p += n;
        if (type === 0x03) sortie.noms.push(data.toString('utf8'));
        if (type === 0x51 && sortie.tempoMicros === null) sortie.tempoMicros = (data[0] << 16) | (data[1] << 8) | data[2];
        if (type === 0x58 && sortie.signature === null) sortie.signature = `${data[0]}/${2 ** data[1]}`;
      } else if (statut === 0xf0 || statut === 0xf7) { p += vlq(); }
      else {
        const type = statut & 0xf0, n = (type === 0xc0 || type === 0xd0) ? 1 : 2;
        const d1 = buf[p], d2 = n === 2 ? buf[p + 1] : 0; p += n;
        if (type === 0x90 && d2 > 0) sortie.notes.push({ piste, tick, note: d1, vitesse: d2 });
      }
    }
    p = fin;
  }
  return sortie;
}
// Les classes de hauteur (0 = do … 11 = si) des notes qui sonnent dans la mesure `n` (0 = première) à 480 ticks par noire, 4/4.
export const classesDeLaMesure = (m: MidiLu, n: number): number[] => {
  const mesure = m.ppq * 4;
  return [...new Set(m.notes.filter(x => x.tick >= n * mesure && x.tick < (n + 1) * mesure).map(x => x.note % 12))].sort((a, b) => a - b);
};

// Un fichier MIDI minimal : une piste, 480 ticks à la noire, 4/4, 120 BPM, un accord (liste de numéros de notes) tenu une mesure chacun.
export function fabriquerMidi(accords: number[][]): Buffer {
  const vlq = (n: number) => { const o = [n & 0x7f]; while ((n >>= 7)) o.unshift((n & 0x7f) | 0x80); return o; };
  const ev: number[] = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xff, 0x58, 4, 4, 2, 24, 8];
  for (const notes of accords) {
    notes.forEach(n => ev.push(0, 0x90, n, 80));
    notes.forEach((n, k) => ev.push(...(k === 0 ? vlq(1920) : [0]), 0x80, n, 0));
  }
  ev.push(0, 0xff, 0x2f, 0);
  const l = ev.length;
  return Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, (l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255, ...ev]);
}
export const fichierMidi = (name: string, buffer: Buffer): FichierAImporter => ({ name, mimeType: 'audio/midi', buffer });

// Les octets d'un fichier du dossier (pour un MIDI ou un PDF : ne pas passer par du texte).
export const lireOctetsDuDossier = async (page: Page, chemin: string, nom = 'RangementE2E'): Promise<Buffer> => Buffer.from(await page.evaluate(async ([n, c]) => {
  let d: any = await (await navigator.storage.getDirectory()).getDirectoryHandle(n);
  const morceaux = c.split('/');
  for (const m of morceaux.slice(0, -1)) d = await d.getDirectoryHandle(m);
  return Array.from(new Uint8Array(await (await (await d.getFileHandle(morceaux[morceaux.length - 1])).getFile()).arrayBuffer()));
}, [nom, chemin] as const));
