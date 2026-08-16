const STATUS_TEXT = {
  idle: "Aucune capture en cours",
  ready: "Prêt à capturer (F9)",
  capturing: "Capture en cours…",
  captured: "Position capturée ✓",
  error: "Erreur",
};

function setStatus(state, message) {
  const dot = document.getElementById("dot");
  const text = document.getElementById("statusText");

  text.textContent = message || STATUS_TEXT[state] || state;

  if (state === "error") {
    dot.style.background = "var(--text-error)";
    dot.style.animation = "none";
  } else if (state === "capturing") {
    dot.style.background = "var(--text-accent)";
    dot.style.animation = "pulse 1.6s ease-in-out infinite";
  } else {
    dot.style.background = "var(--text-accent)";
    dot.style.animation = "none";
  }
}

window.setStatus = setStatus;
