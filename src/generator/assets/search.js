// Client-side search progressive enhancement
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search-input');
  const resultsList = document.getElementById('search-results');
  const resultsCard = document.getElementById('results-card');
  const resultsCount = document.getElementById('results-count');
  const status = document.getElementById('search-status');

  if (!input || !resultsList) return;

  let searchIndex = null;
  let isLoading = false;

  const loadIndex = async () => {
    if (searchIndex || isLoading) return;
    isLoading = true;
    try {
      const resp = await fetch('search-index.json');
      if (resp.ok) {
        searchIndex = await resp.json();
        if (status) status.textContent = `${searchIndex.length} fascicoli consultabili.`;
      }
    } catch (err) {
      if (status) status.textContent = 'Indice di ricerca non disponibile: apri il sito da un server (non come file locale).';
    } finally {
      isLoading = false;
    }
  };

  input.addEventListener('focus', loadIndex);

  input.addEventListener('input', async () => {
    if (!searchIndex) {
      await loadIndex();
    }
    const q = input.value.trim().toLowerCase();
    if (!q || !searchIndex) {
      resultsCard.style.display = 'none';
      resultsList.innerHTML = '';
      return;
    }

    const matches = searchIndex.filter((item) => {
      if (item.display_name.toLowerCase().includes(q)) return true;
      if (item.maiden_name && item.maiden_name.toLowerCase().includes(q)) return true;
      if (item.alternative_names && item.alternative_names.some((alt) => alt.toLowerCase().includes(q))) return true;
      if (item.birth_year && String(item.birth_year).includes(q)) return true;
      if (item.death_year && String(item.death_year).includes(q)) return true;
      if (item.places && item.places.some((pl) => pl.toLowerCase().includes(q))) return true;
      return false;
    });

    resultsCount.textContent = matches.length;
    resultsCard.style.display = 'block';

    if (matches.length === 0) {
      resultsList.innerHTML = '<li class="search-result-item muto">Nessun fascicolo corrisponde. Prova con il solo cognome o con un anno.</li>';
      return;
    }

    resultsList.innerHTML = matches
      .slice(0, 50)
      .map((item) => {
        const years = item.birth_year || item.death_year
          ? ` <span class="dattilo muto">${item.birth_year || ''}–${item.death_year || ''}</span>`
          : '';
        const places = item.places && item.places.length > 0 ? `<div class="muto">${item.places.slice(0, 2).join(', ')}</div>` : '';
        return `
        <li class="search-result-item">
          <a href="${item.url}">${item.display_name}</a>${years}${places}
        </li>
        `;
      })
      .join('');
  });
});
