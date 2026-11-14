// Client-side search progressive enhancement con tolleranza a varianti storiche e prefissi
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search-input');
  const resultsList = document.getElementById('search-results');
  const resultsCard = document.getElementById('results-card');
  const resultsCount = document.getElementById('results-count');
  const status = document.getElementById('search-status');

  if (!input || !resultsList) return;

  let searchIndex = null;
  let isLoading = false;

  function normalizeText(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactText(str) {
    return normalizeText(str).replace(/\s+/g, '');
  }

  function phoneticVariant(str) {
    return compactText(str)
      .replace(/ou/g, 'o')
      .replace(/([a-z])\1+/g, '$1');
  }

  function prepareRecord(item) {
    const parts = [
      item.display_name,
      item.given_names,
      item.surname,
      item.maiden_name,
      ...(item.alternative_names || []),
      ...(item.places || []),
      item.birth_year ? String(item.birth_year) : '',
      item.death_year ? String(item.death_year) : '',
    ];
    item._norm = parts.map(normalizeText).filter(Boolean).join(' ');
    item._compact = parts.map(compactText).filter(Boolean).join('');
    item._phonetic = parts.map(phoneticVariant).filter(Boolean).join('');
    return item;
  }

  const loadIndex = async () => {
    if (searchIndex || isLoading) return;
    isLoading = true;
    try {
      const resp = await fetch('search-index.json');
      if (resp.ok) {
        const raw = await resp.json();
        searchIndex = raw.map(prepareRecord);
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
    const qRaw = input.value.trim();
    const qNorm = normalizeText(qRaw);
    if (!qNorm || !searchIndex) {
      resultsCard.style.display = 'none';
      resultsList.innerHTML = '';
      return;
    }

    const tokens = qNorm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      resultsCard.style.display = 'none';
      resultsList.innerHTML = '';
      return;
    }

    const matches = searchIndex.filter((item) => {
      for (const token of tokens) {
        const compactTok = token.replace(/\s+/g, '');
        const phoneticTok = phoneticVariant(token);

        // 1. Match testuale diretto
        if (item._norm && item._norm.includes(token)) continue;

        // 2. Match compatto (es. 'decapitani' con 'de capitani' o 'de\' capitani')
        if (compactTok && item._compact && item._compact.includes(compactTok)) continue;

        // 3. Match fonetico/storico per token di almeno 3 caratteri (evita falsi positivi)
        if (phoneticTok.length >= 3 && item._phonetic && item._phonetic.includes(phoneticTok)) continue;

        return false;
      }
      return true;
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
