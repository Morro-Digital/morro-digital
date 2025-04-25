// analytics.js - Monitoramento anônimo de uso para melhorias

let analyticsEnabled = false;

/**
 * Inicializa o sistema de analytics com consentimento do usuário
 */
export function initAnalytics() {
  // Verifica se o usuário já deu consentimento
  const consent = localStorage.getItem("analytics_consent");

  if (consent === null) {
    // Mostra banner de consentimento
    showConsentBanner();
  } else if (consent === "true") {
    enableAnalytics();
  }
}

/**
 * Mostra banner solicitando consentimento para analytics
 */
function showConsentBanner() {
  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = `
    <div class="consent-content">
      <p>Usamos cookies para melhorar sua experiência. Podemos coletar dados anônimos de uso para aprimorar o app?</p>
      <div class="consent-buttons">
        <button id="accept-consent">Aceitar</button>
        <button id="reject-consent">Recusar</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Configura eventos dos botões
  document.getElementById("accept-consent").addEventListener("click", () => {
    localStorage.setItem("analytics_consent", "true");
    enableAnalytics();
    banner.remove();
  });

  document.getElementById("reject-consent").addEventListener("click", () => {
    localStorage.setItem("analytics_consent", "false");
    banner.remove();
  });
}

/**
 * Ativa a coleta de dados analíticos básicos
 */
function enableAnalytics() {
  analyticsEnabled = true;

  // Implementação básica de rastreamento de eventos
  window.trackEvent = function (category, action, label) {
    if (!analyticsEnabled) return;

    // Aqui você pode integrar com Google Analytics, Matomo, etc.
    console.log(`[Analytics] ${category}: ${action} - ${label}`);

    // Exemplo de envio para sua API
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        action,
        label,
        timestamp: new Date().toISOString(),
        session: getSessionId(),
      }),
      keepalive: true,
    }).catch((e) => console.error("Erro ao enviar analytics", e));
  };

  // Registra visualização de página
  trackEvent("app", "pageview", window.location.pathname);
}

/**
 * Gera ou recupera ID de sessão anônimo
 */
function getSessionId() {
  let sessionId = sessionStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("session_id", sessionId);
  }
  return sessionId;
}
