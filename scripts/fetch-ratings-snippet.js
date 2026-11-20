/**
 * Snippet à coller dans la console DevTools de votre navigateur sur :
 *   https://inducks.org/recommend.php?top100=1
 *
 * Comme votre navigateur a déjà validé le challenge Anubis, ce script parcourt
 * toutes les pages du classement (page par page, avec 400ms de pause entre chaque)
 * jusqu'à épuisement du classement (le maximum possible).
 *
 * À la fin, il télécharge automatiquement `ratings.json` prêt à placer dans
 * `apps/InducksButBetter/public/datas/ratings.json`.
 */
(async function fetchAllInducksRatings() {
  console.log("🚀 Démarrage de l'extraction des notes Inducks...");
  const seen = new Set();
  const allRatings = [];
  let page = 0;
  let consecutiveEmpty = 0;

  while (true) {
    const url = page === 0 
      ? '/recommend.php?top100=1' 
      : `/recommend.php?top100=1&page=${page}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Arrêt : code HTTP ${res.status} à la page ${page}`);
        break;
      }
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Recherche des liens d'histoires dans les lignes du tableau
      const storyLinks = Array.from(doc.querySelectorAll('a[href*="story.php?c="], a[href*="s.php?c="]'));
      if (storyLinks.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) {
          console.log("🏁 Fin du classement atteinte.");
          break;
        }
        page++;
        continue;
      }
      consecutiveEmpty = 0;

      let pageCount = 0;
      for (const link of storyLinks) {
        const tr = link.closest('tr');
        if (!tr) continue;

        const href = link.getAttribute('href') || '';
        const match = href.match(/[?&]c=([^&]+)/);
        if (!match) continue;
        const storycode = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();

        if (seen.has(storycode)) continue;
        seen.add(storycode);

        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        if (cells.length < 2) continue;

        // Le rang est généralement le premier nombre entier
        const rankMatch = cells[0].match(/^(\d+)/);
        const rank = rankMatch ? parseInt(rankMatch[1], 10) : allRatings.length + 1;

        // Note et votes (généralement dans les dernières colonnes)
        let rating = null;
        let votes = null;

        for (let i = cells.length - 1; i >= 1; i--) {
          const val = cells[i].replace(',', '.');
          if (votes === null && /^\d+$/.test(val)) {
            votes = parseInt(val, 10);
          } else if (rating === null && /^\d+\.\d+$/.test(val)) {
            rating = parseFloat(val);
          }
        }

        allRatings.push({
          storycode,
          rank,
          rating,
          votes
        });
        pageCount++;
      }

      console.log(`✅ Page ${page + 1} terminée : +${pageCount} histoires (Total cumulé : ${allRatings.length})`);

      // Si la page a ramené moins de 5 nouvelles histoires, on approche de la fin
      if (pageCount === 0) {
        console.log("🏁 Aucune nouvelle histoire trouvée sur cette page, arrêt.");
        break;
      }

      page++;
      // Pause courtoise de 400ms pour respecter le serveur
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`Erreur page ${page}:`, err);
      break;
    }
  }

  console.log(`\n🎉 Extraction terminée avec succès ! ${allRatings.length} histoires classées extraites.`);

  // Sauvegarde automatique du fichier ratings.json
  const jsonStr = JSON.stringify(allRatings, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = 'ratings.json';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  console.log("💾 Le fichier `ratings.json` a été téléchargé sur votre ordinateur !");
  console.log("👉 Déplacez-le dans : apps/InducksButBetter/public/datas/ratings.json");
})();
