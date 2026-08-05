'use strict';
// Paroles — HarmoHub : outil compagnon À PART (voir paroles.html). Reçoit un JSON exporté par
// HarmoHub (bouton "Exporter pour paroles", voir exportLyricsData dans script.js) : parties + accords
// (symbole + durée), rien d'autre — ni voicing, ni instrument. Le placement des accords sur le texte
// est ENTIÈREMENT MANUEL (retour utilisateur : "positionner précisément et manuellement au-dessus du
// texte") : deux modes possibles par accord posé —
//   - "syllabe" (par défaut) : accroché au caractère le plus proche du clic (via caretRangeFromPoint),
//     donc précis à la syllabe près et STABLE si le texte se redispose ensuite (contrairement à des
//     coordonnées pixel figées) ;
//   - "libre" : position relative (%) dans la zone de texte, pour les cas sans caractère à accrocher
//     (fin de ligne, ligne encore vide).
// Persistance en localStorage (voir STORAGE_PREFIX/storageKeyForSong) : ce fichier ne dépend d'aucun
// serveur, comme le reste de HarmoHub. L'enregistrement est visible (voir #save-status) plutôt que
// silencieux : retour utilisateur "assure-toi que les enregistrements sont bien réalisés, avec
// messages d'erreur si nécessaire".

const STORAGE_PREFIX = 'harmohub_lyrics_v1_';

const state = {
    song: null,          // { version, song, songId, beatsPerBar, sections: [{ title, chords: [{symbol,beats}], _placements }] }
    armed: null,         // { si, ci } | null — accord actuellement "en main", prêt à être posé
    freeMode: false,
    sectionEls: [],       // [{ pool, wrap, text }] par section, remplis une seule fois par buildSectionsDOM
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function slugForSong(name) {
    return (name || 'Sans titre').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

// Clé de session : préfère l'identifiant STABLE du morceau (songId, voir exportLyricsData dans
// script.js) au seul nom affiché — deux morceaux de même nom (ou renommés depuis) ne doivent jamais
// se marcher dessus. Repli sur le nom seul pour un fichier exporté avant l'ajout de songId (vieux
// export encore sur le disque de l'utilisateur).
function storageKeyForSong(song) {
    return song.songId ? `${STORAGE_PREFIX}id-${song.songId}` : `${STORAGE_PREFIX}name-${slugForSong(song.song)}`;
}

// ---------- Bandeaux de notification (avertissements/erreurs visibles, pas juste la console) ----------

function showBanner(text, kind = 'info') {
    const host = document.getElementById('banners');
    const el = document.createElement('div');
    el.className = `banner banner-${kind}`;
    el.innerHTML = `<span>${escapeHtml(text)}</span><button type="button" class="banner-close" aria-label="Fermer">×</button>`;
    el.querySelector('.banner-close').addEventListener('click', () => el.remove());
    host.appendChild(el);
    return el;
}

// ---------- État d'enregistrement (voir #save-status) ----------

function setSaveStatus(kind, detail) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.classList.remove('save-pending', 'save-ok', 'save-error');
    if (kind === 'pending') {
        el.textContent = 'Enregistrement…';
        el.classList.add('save-pending');
        el.title = '';
    } else if (kind === 'ok') {
        const t = new Date();
        el.textContent = `Enregistré ✓ ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        el.classList.add('save-ok');
        el.title = '';
    } else {
        el.textContent = '⚠ Échec de l\'enregistrement';
        el.classList.add('save-error');
        el.title = detail || '';
    }
}

// ---------- Persistance ----------

let saveTimer = null;

// Écriture proprement dite, factorisée pour être appelable soit après le délai anti-rebond normal
// (voir saveSession), soit IMMÉDIATEMENT (voir "beforeunload" plus bas) — sans ça, fermer l'onglet ou
// naviguer moins de 350ms après une dernière frappe perdrait cette toute dernière modification, jamais
// écrite (retour utilisateur : "assure-toi que les enregistrements sont bien réalisés").
function writeSessionNow() {
    if (!state.song) return;
    const payload = {
        songName: state.song.song,
        sections: state.song.sections.map(sec => ({
            lyricsHtml: sec._lyricsHtml || '',
            placements: sec._placements || [],
        })),
    };
    try {
        localStorage.setItem(storageKeyForSong(state.song), JSON.stringify(payload));
        setSaveStatus('ok');
    } catch (e) {
        // Ex. quota localStorage dépassé, ou navigation privée qui bloque l'écriture — retour
        // utilisateur explicite : "assure-toi que les enregistrements sont bien réalisés, avec
        // messages d'erreur si nécessaire", pas juste une trace dans la console que personne ne
        // regarde.
        console.error('Sauvegarde paroles impossible :', e);
        setSaveStatus('error', e && e.message);
        showBanner(
            "Échec de l'enregistrement des paroles (stockage plein, ou navigation privée ?). Tes dernières modifications ne sont peut-être pas conservées — exporte/imprime par précaution avant de fermer cet onglet.",
            'error'
        );
    }
}

function saveSession() {
    if (!state.song) return;
    setSaveStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeSessionNow, 350);
}

// Filet de sécurité : si une écriture est encore en attente (dans les 350ms) au moment de fermer
// l'onglet/naviguer ailleurs, on la force IMMÉDIATEMENT plutôt que de la laisser expirer dans le vide.
window.addEventListener('beforeunload', () => {
    if (saveTimer) { clearTimeout(saveTimer); writeSessionNow(); }
});

function loadSavedSession(song) {
    const key = storageKeyForSong(song);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        // Session illisible (localStorage corrompu/tronqué) : le signale plutôt que de repartir de
        // zéro sans un mot — l'utilisateur pourrait croire que ses paroles n'ont jamais été perdues.
        console.error('Session paroles illisible :', e);
        showBanner("La session précédente de ce morceau était illisible (données corrompues) — on repart d'une page vierge pour ne pas bloquer, mais tes anciennes paroles n'ont pas pu être récupérées.", 'error');
        return null;
    }
}

// ---------- Import ----------

function loadSong(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.sections)) {
        alert("Fichier invalide — utilise le fichier téléchargé depuis le bouton « Exporter pour paroles » de HarmoHub.");
        return;
    }
    document.getElementById('banners').innerHTML = '';
    const saved = loadSavedSession(data);
    let droppedPlacements = 0;
    data.sections.forEach((sec, si) => {
        const savedSec = saved && saved.sections && saved.sections[si];
        sec._lyricsHtml = savedSec ? (savedSec.lyricsHtml || '') : '';
        // Défensif : ignore un emplacement dont l'accord référencé n'existe plus (le morceau a pu
        // changer côté HarmoHub depuis le dernier export) — plutôt que de planter ou d'afficher une
        // pastille orpheline. Compté pour prévenir l'utilisateur (voir plus bas), pas juste ignoré en
        // silence.
        const rawPlacements = savedSec ? (savedSec.placements || []) : [];
        sec._placements = rawPlacements.filter(p => p.chordIndex < sec.chords.length);
        droppedPlacements += rawPlacements.length - sec._placements.length;
    });
    state.song = data;
    state.armed = null;

    document.getElementById('empty-state').hidden = true;
    document.getElementById('toolbar').hidden = false;
    document.getElementById('btn-print').hidden = false;
    document.getElementById('btn-export-text').hidden = false;
    const nameEl = document.getElementById('song-name');
    nameEl.hidden = false;
    nameEl.textContent = data.song;

    buildSectionsDOM();
    updateModeUI();

    if (droppedPlacements > 0) {
        showBanner(
            `Le morceau a changé dans HarmoHub depuis ta dernière session ici : ${droppedPlacements} accord(s) posé(s) référençaient des accords qui n'existent plus et ont été retiré(s). Vérifie le placement de tes accords.`,
            'warning'
        );
    }
    setSaveStatus('ok'); // la session vient d'être chargée telle quelle : rien à réécrire pour l'instant
}

document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try { loadSong(JSON.parse(reader.result)); }
        catch (err) { alert('Impossible de lire ce fichier JSON.'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // permet de réimporter le même fichier plusieurs fois de suite
});
document.getElementById('btn-print').addEventListener('click', () => window.print());

// Export texte brut : lisible n'importe où (éditeur de texte, mail, autre appareil), pas seulement
// dans un navigateur — contrairement à Imprimer/PDF. Liste les accords de chaque partie PUIS ses
// paroles telles quelles, sans tenter de reproduire au caractère près le placement visuel (une
// reconstruction fiable en ASCII demanderait de rejouer toute la mise en page du texte — bien plus
// fragile que de laisser le navigateur l'afficher lui-même, voir les pastilles à l'écran/à
// l'impression) : ce fichier sert de sauvegarde/référence portable, pas de copie exacte de la vue.
document.getElementById('btn-export-text').addEventListener('click', () => {
    if (!state.song) return;
    const title = state.song.song || 'Sans titre';
    let out = `${title}\n${'='.repeat(title.length)}\n\n`;
    state.song.sections.forEach((sec, si) => {
        const secTitle = sec.title || `Partie ${si + 1}`;
        out += `[${secTitle}]\n`;
        if (sec.chords.length) out += `Accords : ${sec.chords.map(c => c.symbol).join(', ')}\n`;
        const lyrics = (state.sectionEls[si].text.innerText || '').trim();
        out += lyrics ? `\n${lyrics}\n\n` : '\n';
    });
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]+/g, '_')} - paroles.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// ---------- Récupération automatique depuis HarmoHub (même navigateur) ----------
// Voir exportLyricsData dans script.js : en plus du fichier téléchargé (utile pour partager/changer
// d'appareil), les mêmes données sont déposées ici — évite de repasser par "Importer un fichier" à
// chaque export (retour utilisateur : "il faut réimporter un morceau ensuite"). Consommé une seule
// fois (retiré aussitôt lu) : une visite ultérieure de cette page (favori, retour en arrière) retombe
// normalement sur le morceau déjà ouvert dans CETTE page, pas sur un réimport fantôme.
const PENDING_IMPORT_KEY = 'harmohub_lyrics_pending_import';
(function tryAutoImportFromHarmoHub() {
    try {
        const raw = localStorage.getItem(PENDING_IMPORT_KEY);
        if (!raw) return;
        localStorage.removeItem(PENDING_IMPORT_KEY);
        loadSong(JSON.parse(raw));
    } catch (e) { console.error('Récupération automatique depuis HarmoHub impossible :', e); }
})();

// ---------- Construction du DOM (une seule fois par import) ----------

function buildSectionsDOM() {
    const host = document.getElementById('sections');
    host.innerHTML = '';
    state.sectionEls = [];

    state.song.sections.forEach((sec, si) => {
        const block = document.createElement('div');
        block.className = 'section-block';

        const titleRow = document.createElement('div');
        titleRow.className = 'section-title-row';
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = sec.title || `Partie ${si + 1}`;
        titleRow.appendChild(title);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn-reset-section';
        resetBtn.textContent = 'Réinitialiser';
        resetBtn.title = 'Efface les paroles et les accords posés de cette partie (les accords eux-mêmes restent disponibles dans la réserve)';
        resetBtn.addEventListener('click', () => {
            const label = sec.title || `Partie ${si + 1}`;
            if (!confirm(`Effacer les paroles et tous les accords posés de « ${label} » ? Cette action ne peut pas être annulée.`)) return;
            sec._lyricsHtml = '';
            sec._placements = [];
            state.sectionEls[si].text.innerHTML = '';
            if (state.armed && state.armed.si === si) state.armed = null;
            saveSession();
            renderPool(si);
            renderPills(si);
            updateModeUI();
        });
        titleRow.appendChild(resetBtn);
        block.appendChild(titleRow);

        const pool = document.createElement('div');
        pool.className = 'chord-pool';
        block.appendChild(pool);

        if (!sec.chords.length) {
            const note = document.createElement('div');
            note.className = 'no-chords-note';
            note.textContent = 'Aucun accord dans cette partie.';
            block.appendChild(note);
        }

        const wrap = document.createElement('div');
        wrap.className = 'lyrics-wrap';
        const text = document.createElement('div');
        text.className = 'lyrics-text';
        text.contentEditable = 'true';
        text.spellcheck = false;
        text.innerHTML = sec._lyricsHtml || '';
        wrap.appendChild(text);
        block.appendChild(wrap);

        host.appendChild(block);
        state.sectionEls[si] = { pool, wrap, text };

        // --- Écouteurs (posés une seule fois, jamais reconstruits) ---
        text.addEventListener('input', () => {
            sec._lyricsHtml = text.innerHTML;
            saveSession();
            renderPills(si); // le texte a pu se redisposer : les pastilles ancrées à un caractère suivent
        });

        wrap.addEventListener('click', (e) => {
            const pill = e.target.closest('.lyric-pill');
            if (pill) {
                e.stopPropagation();
                const ci = +pill.dataset.chordIndex;
                if (e.target.dataset.del) removePlacement(si, ci);
                else armChord(si, ci); // reprend l'accord posé pour le repositionner ailleurs
                return;
            }
            if (state.armed && state.armed.si === si) placeArmedAt(si, e);
        });

        window.addEventListener('resize', debounce(() => renderPills(si), 150));

        renderPool(si);
        renderPills(si);
    });
}

// ---------- Réserve d'accords (pastilles cliquables, une par occurrence) ----------

function renderPool(si) {
    const sec = state.song.sections[si];
    const { pool } = state.sectionEls[si];
    pool.innerHTML = '';
    sec.chords.forEach((chord, ci) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chord-chip';
        const isPlaced = (sec._placements || []).some(p => p.chordIndex === ci);
        const isArmed = state.armed && state.armed.si === si && state.armed.ci === ci;
        if (isPlaced) chip.classList.add('placed');
        if (isArmed) chip.classList.add('armed');
        chip.textContent = chord.symbol;
        chip.title = isPlaced ? 'Déjà posé — cliquer pour le reprendre et le replacer' : 'Cliquer puis clique dans le texte pour le poser';
        chip.addEventListener('click', () => {
            if (isArmed) disarm();
            else armChord(si, ci);
        });
        pool.appendChild(chip);
    });
}

// ---------- Armement / pose ----------

function armChord(si, ci) {
    const sec = state.song.sections[si];
    // "Ramasse" un éventuel ancien emplacement de CE MÊME accord : on le repositionne, pas de doublon.
    sec._placements = (sec._placements || []).filter(p => p.chordIndex !== ci);
    state.armed = { si, ci };
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

function disarm() {
    state.armed = null;
    updateModeUI();
    refreshAllPoolsAndPills();
}

function removePlacement(si, ci) {
    const sec = state.song.sections[si];
    sec._placements = (sec._placements || []).filter(p => p.chordIndex !== ci);
    if (state.armed && state.armed.si === si && state.armed.ci === ci) state.armed = null;
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

function placeArmedAt(si, e) {
    const sec = state.song.sections[si];
    const ci = state.armed.ci;
    const { wrap, text } = state.sectionEls[si];
    const wrapRect = wrap.getBoundingClientRect();
    const noText = text.textContent.trim().length === 0;

    let placement = null;
    if (!state.freeMode && !noText) {
        const charIndex = caretOffsetFromPoint(text, e.clientX, e.clientY);
        if (charIndex != null) placement = { chordIndex: ci, type: 'char', charIndex };
    }
    if (!placement) {
        const xPct = ((e.clientX - wrapRect.left) / wrapRect.width) * 100;
        const yPct = ((e.clientY - wrapRect.top) / wrapRect.height) * 100;
        placement = { chordIndex: ci, type: 'free', xPct: clamp(xPct, 0, 100), yPct: clamp(yPct, 0, 100) };
    }

    sec._placements = (sec._placements || []).filter(p => p.chordIndex !== ci);
    sec._placements.push(placement);
    state.armed = null;
    saveSession();
    refreshAllPoolsAndPills();
    updateModeUI();
}

function refreshAllPoolsAndPills() {
    state.song.sections.forEach((sec, si) => { renderPool(si); renderPills(si); });
}

// ---------- Ancrage au caractère (mode "syllabe") ----------

function textNodesOf(container) {
    const nodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

function globalOffsetFromRange(container, range) {
    let offset = 0;
    for (const node of textNodesOf(container)) {
        if (node === range.startContainer) return offset + range.startOffset;
        offset += node.textContent.length;
    }
    return offset;
}

function rangeFromGlobalOffset(container, globalOffset) {
    const nodes = textNodesOf(container);
    let remaining = globalOffset;
    for (const node of nodes) {
        if (remaining <= node.textContent.length) {
            const range = document.createRange();
            range.setStart(node, Math.max(0, remaining));
            range.collapse(true);
            return range;
        }
        remaining -= node.textContent.length;
    }
    if (nodes.length) {
        const last = nodes[nodes.length - 1];
        const range = document.createRange();
        range.setStart(last, last.textContent.length);
        range.collapse(true);
        return range;
    }
    return null;
}

function caretOffsetFromPoint(container, x, y) {
    let range = null;
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
    }
    if (!range || !container.contains(range.startContainer)) return null;
    return globalOffsetFromRange(container, range);
}

// ---------- Rendu des pastilles posées ----------

function renderPills(si) {
    const sec = state.song.sections[si];
    const { wrap, text } = state.sectionEls[si];
    wrap.querySelectorAll('.lyric-pill').forEach(p => p.remove());
    const wrapRect = wrap.getBoundingClientRect();

    (sec._placements || []).forEach(pl => {
        const chord = sec.chords[pl.chordIndex];
        if (!chord) return;
        const pill = document.createElement('div');
        pill.className = 'lyric-pill';
        pill.dataset.chordIndex = pl.chordIndex;
        pill.innerHTML = `${escapeHtml(chord.symbol)}<span class="pill-del" data-del="1" title="Retirer">×</span>`;

        if (pl.type === 'char') {
            const range = rangeFromGlobalOffset(text, pl.charIndex);
            if (!range) return;
            const rects = range.getClientRects();
            const rect = (rects && rects[0]) || range.getBoundingClientRect();
            pill.style.left = (rect.left - wrapRect.left) + 'px';
            pill.style.top = (rect.top - wrapRect.top - 20) + 'px';
        } else {
            pill.style.left = pl.xPct + '%';
            pill.style.top = pl.yPct + '%';
        }
        wrap.appendChild(pill);
    });
}

// ---------- Mode syllabe / libre ----------

document.getElementById('mode-syllable').addEventListener('click', () => setFreeMode(false));
document.getElementById('mode-free').addEventListener('click', () => setFreeMode(true));

function setFreeMode(v) {
    state.freeMode = v;
    updateModeUI();
}

function updateModeUI() {
    document.getElementById('mode-syllable').classList.toggle('active', !state.freeMode);
    document.getElementById('mode-free').classList.toggle('active', state.freeMode);

    const hint = document.getElementById('armed-hint');
    if (state.armed && state.song) {
        const sec = state.song.sections[state.armed.si];
        const chord = sec.chords[state.armed.ci];
        hint.hidden = false;
        hint.textContent = `Clique dans le texte pour poser « ${chord.symbol} » (${state.freeMode ? 'libre' : 'syllabe'}) — Échap pour annuler`;
    } else {
        hint.hidden = true;
    }

    state.sectionEls.forEach(({ wrap }) => {
        wrap.classList.toggle('armable', !!state.armed);
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.armed) disarm();
});

// ---------- Utilitaire ----------

function debounce(fn, ms) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
