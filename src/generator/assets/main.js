// Navigation menu toggle and global behaviors
(function () {
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    var btn = target.closest('.menu-btn');
    if (!btn) return;
    var barra = btn.closest('.barra');
    if (!barra) return;
    var open = barra.classList.toggle('aperta');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  });
})();
