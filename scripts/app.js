// scripts/app.js - DEBUG CON ALERT
alert("1. app.js caricato");

try {
  const { renderBoard, renderStatus } = await import("./ui.js");
  alert("2. ui.js importato OK");

  const { initGameState } = await import("../app/gameState.js");
  alert("3. gameState.js importato OK");

  const { isMicroPlayable } = await import("../app/gameRules.js");
  alert("4. gameRules.js importato OK");

  const { playMove } = await import("../app/engine.js");
  alert("5. engine.js importato OK");

  // Anno footer
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
    alert("6. Anno impostato");
  } else {
    alert("6. ERRORE: elemento #year non trovato");
  }

  // Install prompt
  let deferredPrompt = null;
  const installBtn = document.getElementById("install-btn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });
  installBtn?.addEventListener("click", async () => {
    deferredPrompt?.prompt();
    await deferredPrompt?.userChoice;
    installBtn.hidden = true;
    deferredPrompt = null;
  });

  // Stato iniziale
  alert("7. Inizializzo stato...");
  const state = initGameState();
  alert("8. Stato creato: " + JSON.stringify(state).substring(0, 100));

  // Primo render
  alert("9. Rendering status...");
  renderStatus(state);
  alert("10. Rendering board...");
  renderBoard(state);
  alert("11. Render completato! Il gioco dovrebbe essere visibile.");

  // ==========================================
  // CLICK HANDLER PRINCIPALE
  // ==========================================

  document.addEventListener("click", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;

    /* ---- CHIUSURA FULLSCREEN ---- */
    if (el.dataset.closeMicro === "true") {
      const microIndex = state.ui.viewingMicro;
    
      animateMicroZoomOut(microIndex, () => {
        state.ui.viewingMicro = null;
        renderStatus(state);
        renderBoard(state);
      });
    
      return;
    }

    /* ---- PRIMO CLICK: macro → APRI MICRO con animazione ---- */
    if (el.closest(".macro-cell") && state.ui.viewingMicro === null) {
      const cell = el.closest(".macro-cell");
      const idx = Number(cell.dataset.micro);
    
      if (!isMicroPlayable(state, idx)) return;
    
      animateMicroZoomIn(cell, idx);
      return;
    }

    /* ---- SECONDO CLICK: micro fullscreen → mossa ---- */
    if (el.classList.contains("micro-cell") && state.ui.viewingMicro !== null) {
      const micro = Number(el.dataset.micro);
      const row   = Number(el.dataset.row);
      const col   = Number(el.dataset.col);

      const moved = playMove(state, micro, row, col);

      if (moved) {
        // chiudi modal e torna alla macro
        state.ui.viewingMicro = null;
        renderStatus(state);
        renderBoard(state);
      }

      return;
    }
  });

  /* =============================
     ANIMAZIONE ZOOM-IN
  ============================= */
  function animateMicroZoomIn(macroCellEl, microIndex) {
    const fade = document.createElement("div");
    fade.className = "fade-overlay";
    document.body.appendChild(fade);

    const preview = macroCellEl.querySelector(".micro-grid");
    const clone = preview.cloneNode(true);
    clone.classList.add("micro-zoom-clone");
    document.body.appendChild(clone);

    const rect = preview.getBoundingClientRect();
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";

    clone.getBoundingClientRect();

    const scaleX = window.innerWidth / rect.width;
    const scaleY = window.innerHeight / rect.height;

    fade.classList.add("active");
    clone.style.transform = `scale(${scaleX}, ${scaleY})`;

    setTimeout(() => {
      state.ui.viewingMicro = microIndex;
      renderStatus(state);
      renderBoard(state);
      clone.remove();
      fade.remove();
    }, 350);
  }

  /* =============================
     ANIMAZIONE ZOOM-OUT
  ============================= */
  function animateMicroZoomOut(targetMicroIndex, onComplete) {
    const fullscreen = document.querySelector(".fullscreen-micro");
    if (!fullscreen) {
      onComplete();
      return;
    }

    const rectStart = fullscreen.getBoundingClientRect();
    const macroCell = document.querySelector(`.macro-cell[data-micro="${targetMicroIndex}"]`);
    const preview = macroCell.querySelector(".micro-grid");
    const rectEnd = preview.getBoundingClientRect();

    const fade = document.createElement("div");
    fade.className = "fade-overlay active";
    document.body.appendChild(fade);

    const clone = fullscreen.cloneNode(true);
    clone.classList.add("micro-zoom-clone", "micro-zoom-out");

    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";
    clone.style.width = rectStart.width + "px";
    clone.style.height = rectStart.height + "px";
    document.body.appendChild(clone);

    clone.getBoundingClientRect();

    const scaleX = rectEnd.width / rectStart.width;
    const scaleY = rectEnd.height / rectStart.height;
    const dx = rectEnd.left - rectStart.left;
    const dy = rectEnd.top - rectStart.top;

    clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    fade.classList.remove("active");

    setTimeout(() => {
      clone.remove();
      fade.remove();
      onComplete();
    }, 350);
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(err => alert("SW registration failed: " + err.message));
    });
  }

} catch (error) {
  alert("ERRORE CRITICO: " + error.message + "\n\nStack: " + error.stack);
}

// Listener globali per errori
window.addEventListener("error", (ev) => {
  alert("JS ERROR: " + ev.message + "\nFile: " + ev.filename + "\nLinea: " + ev.lineno);
}, true);

window.addEventListener("unhandledrejection", (ev) => {
  alert("PROMISE REJECTION: " + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
}, true);
