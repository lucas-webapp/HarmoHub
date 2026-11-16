// CE QUI EST PROPRE À HARMOHUB pour les tests (le reste de `support/` est commun).
// Le SDK Firebase (compat 10.13.2, depuis node_modules) et la configuration `demo-…` branchée sur les émulateurs sont servis par
// scripts/serveur-test.cjs, sans modifier l'appli (`synchro-cloud.js`, partagé avec TabHub et TrainHub, n'y voit que FIREBASE_CONFIG).

// Ressources externes sans rapport avec Firebase, interrompues partout pour que la VM et la CI testent la même chose
// (échantillons de piano de Tone.js : l'appli bascule sur son synthé de secours ; police Google : la police de repli suffit ; scripts
// Google que le SDK Auth précharge pour sa fenêtre de connexion — l'émulateur Auth n'en a pas besoin).
export const URL_EXTERNES_COUPEES = /^https:\/\/(tonejs\.github\.io|fonts\.googleapis\.com|fonts\.gstatic\.com|apis\.google\.com|accounts\.google\.com)\//;

// Un morceau de départ, posé dans le stockage local de l'appli AVANT son chargement (mode « sans connexion »).
export type Accord = { root: string; quality: string; beats?: number };
export function morceauDeDepart(accords: Accord[], titrePartie = 'Couplet', nom = 'Démo') {
  const sections = [{ title: titrePartie, chords: accords.map(a => ({ root: a.root, quality: a.quality, beats: a.beats ?? 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' })) }];
  return { sections, nom };
}
