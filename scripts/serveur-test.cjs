#!/usr/bin/env node
// SERVEUR DE L'APPLI EN MODE TEST (tests @playwright/test ET exploration avec playwright-cli). Sert le dépôt tel quel, avec TROIS substitutions,
// faites à la volée et jamais écrites dans le dépôt : l'appli de production n'est pas modifiée.
//   1. le SDK Firebase compat chargé depuis www.gstatic.com (bloqué dans la VM cloud) est servi depuis node_modules/firebase, MÊME version ;
//   2. firebase-config.js (configuration de PRODUCTION) est remplacé par une configuration « demo-… » qui branche les émulateurs Auth et Firestore ;
//   3. rien d'autre : toute autre ressource est servie à l'identique.
// Refuse de démarrer si le projet n'est pas un projet « demo-… ».
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT_APPLI || 8936);
const PROJET = process.env.GCLOUD_PROJECT || process.env.PROJET_TEST || 'demo-harmohub';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const VERSION_SDK = require(path.join(RACINE, 'node_modules', 'firebase', 'package.json')).version;
const SLUG = process.env.SLUG_APPLI || 'harmohub';

if (!/^demo-[a-z0-9-]+$/.test(PROJET)) { console.error(`GARDE-FOU : projet « ${PROJET} » refusé (seuls les projets « demo-… » sont permis).`); process.exit(1); }

function configDeTest() {
  const [hf, pf] = FIRESTORE.split(':');
  return `// CONFIGURATION DE TEST (scripts/serveur-test.cjs) — projet « ${PROJET} », émulateurs locaux. Jamais servie en production.
var FIREBASE_CONFIG = { apiKey: 'demo-cle-de-test', authDomain: '${PROJET}.firebaseapp.com', projectId: '${PROJET}', storageBucket: '', messagingSenderId: '0', appId: '1:0:web:0' };
var FIREBASE_APP_SLUG = '${SLUG}';
window.__EMULATEURS_BRANCHES = false;
(function () {
  if (typeof firebase === 'undefined') return;
  var initialiser = firebase.initializeApp.bind(firebase);
  firebase.initializeApp = function (config, nom) {
    if (!config || !/^demo-/.test(config.projectId)) throw new Error('GARDE-FOU : initializeApp hors projet demo- refusé');
    var app = initialiser(config, nom);
    app.auth().useEmulator('http://${AUTH}', { disableWarnings: true });
    app.firestore().useEmulator('${hf}', ${pf});
    window.__EMULATEURS_BRANCHES = true;
    return app;
  };
})();
`;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mid': 'audio/midi', '.webmanifest': 'application/manifest+json' };
const SDK = /https:\/\/www\.gstatic\.com\/firebasejs\/([\d.]+)\//g;

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let chemin = decodeURIComponent(url.pathname);
  const envoyer = (code, type, corps) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(corps); };
  if (chemin === '/firebase-config.js') return envoyer(200, TYPES['.js'], configDeTest());
  if (chemin.startsWith('/__e2e__/firebase/')) {
    const fichier = path.basename(chemin);
    const p = path.join(RACINE, 'node_modules', 'firebase', fichier);
    if (!/^firebase-[a-z-]+\.js$/.test(fichier) || !fs.existsSync(p)) return envoyer(404, 'text/plain', 'SDK introuvable');
    return envoyer(200, TYPES['.js'], fs.readFileSync(p));
  }
  if (chemin.endsWith('/')) chemin += 'index.html';
  const p = path.join(RACINE, chemin);
  if (!p.startsWith(RACINE + path.sep) || /[\\/](node_modules|\.git)([\\/]|$)/.test(p) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return envoyer(404, 'text/plain', 'Introuvable');
  const ext = path.extname(p);
  if (ext === '.html') {
    let html = fs.readFileSync(p, 'utf8');
    html = html.replace(SDK, (tout, version) => {
      if (version !== VERSION_SDK) throw new Error(`Le site charge le SDK Firebase ${version}, node_modules a ${VERSION_SDK} : mettre package.json à jour`);
      return '/__e2e__/firebase/';
    });
    return envoyer(200, TYPES['.html'], html);
  }
  return envoyer(200, TYPES[ext] || 'application/octet-stream', fs.readFileSync(p));
}).listen(PORT, '127.0.0.1', () => console.log(`Appli en mode test : http://127.0.0.1:${PORT}/index.html (projet ${PROJET}, Firestore ${FIRESTORE}, Auth ${AUTH})`));
