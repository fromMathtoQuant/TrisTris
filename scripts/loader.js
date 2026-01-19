
// scripts/loader.js
// Loader che fa debug con alert (no console)

function a(msg) { try { alert(msg); } catch (_) {} }

a("Loader avviato: provo a importare scripts/app.js...");

(async () => {
  // 1) Verifica base: esiste la risorsa?
  try {
    const head = await fetch("scripts/app.js", { method: "HEAD" });
    if (!head.ok) {
      a("ERRORE: scripts/app.js non trovato o non accessibile. HTTP " + head.status);
      a("Suggerimento: verifica che il file esista in /scripts/app.js e i nomi cartelle/maiuscole.");
      return;
    }
  } catch (e) {
    a("ERRORE di rete durante HEAD su scripts/app.js: " + (e && e.message));
    a("Se stai aprendo il file via file://, usa un server locale (es. python -m http.server).");
    return;
  }

  // 2) Prova l’import vero e proprio (coglie errori di percorso/parse/import)
  try {
    await import("./app.js");
    a("OK: scripts/app.js importato. Se vedi ancora 'Caricamento TrisTris…', il problema è dentro app.js/ui.js.");
  } catch (e) {
    a("ERRORE import modulo: " + (e && e.message));
    // Dettaglio utile: molti browser forniscono un 'cause' o un 'stack' testuale
    if (e && e.stack) a("STACK: " + e.stack);
    a("Controlla gli import relativi in app.js: ./ui.js e ../app/*.js e i nomi esatti delle cartelle.");
  }
})();

// 3) Listener globali per intercettare eventuali errori runtime del modulo e mostrarli in alert
window.addEventListener("error", (ev) => {
  a("JS ERROR: " + ev.message + (ev.filename ? ("\nFile: " + ev.filename) : "") + (ev.lineno ? ("\nLinea: " + ev.lineno) : ""));
}, true);

window.addEventListener("unhandledrejection", (ev) => {
  a("PROMISE REJECTION: " + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
}, true);
