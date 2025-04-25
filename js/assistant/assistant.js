// assistant.js - Integração e controle do assistente virtual
import { processUserInput } from "../dialog/dialog.js";
import { speak } from "../voice/voiceSystem.js";

let assistantConfig = {
  map: null,
  lang: "pt",
};

export let conversationState = {
  lastTopic: null,
  preferences: {
    favoriteBeach: null,
    favoriteRestaurant: null,
  },
};

/**
 * Inicializa o assistente virtual e configura eventos
 * @param {Object} config - Configurações do assistente
 */
export function initializeAssistant(config) {
  assistantConfig = { ...assistantConfig, ...config };

  // Configura os eventos para o assistente usando elementos existentes
  setupAssistantEvents();

  // Mostra a mensagem de boas-vindas
  setTimeout(() => {
    const welcomeMessage =
      "Olá! Bem-vindo ao Morro Digital. Como posso ajudar?";
    appendMessage("assistant", welcomeMessage);
    speak(welcomeMessage);
  }, 1000);

  if (config.onReady) {
    config.onReady();
  }
}

/**
 * Configura os eventos de interação do assistente
 */
function setupAssistantEvents() {
  const assistantSection = document.getElementById("assistant-wrapper");
  const assistantInput = document.getElementById("assistantInput");
  const sendButton = document.getElementById("sendButton");
  const minimizeButton = document.querySelector(".minimize-button");
  const assistantHandle = document.querySelector(".assistant-handle");

  // Evento para enviar mensagem
  const sendMessage = async () => {
    const message = assistantInput.value.trim();
    if (!message) return;

    // Adiciona a mensagem do usuário
    appendMessage("user", message);
    assistantInput.value = "";

    // Processa a resposta
    try {
      const response = await processUserInput(message, assistantConfig);
      appendMessage("assistant", response.text);
      speak(response.text);

      // Executa ação específica se existir
      if (response.action) {
        response.action();
      }
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      appendMessage(
        "assistant",
        "Desculpe, tive um problema ao processar sua mensagem."
      );
    }
  };

  // Configura eventos de interação
  sendButton.addEventListener("click", sendMessage);

  assistantInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Minimizar/maximizar assistente
  minimizeButton.addEventListener("click", () => {
    assistantSection.classList.add("hidden");
  });

  // Implementa funcionalidade da alça para arrastar assistente
  let isDragging = false;
  let startY, startHeight;

  assistantHandle.addEventListener("mousedown", (e) => {
    isDragging = true;
    startY = e.clientY;
    startHeight = assistantSection.offsetHeight;
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  });

  assistantHandle.addEventListener("touchstart", (e) => {
    isDragging = true;
    startY = e.touches[0].clientY;
    startHeight = assistantSection.offsetHeight;
    document.addEventListener("touchmove", handleTouchDrag);
    document.addEventListener("touchend", stopDrag);
  });

  function handleDrag(e) {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    const newHeight = startHeight + deltaY;
    if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
      assistantSection.style.height = `${newHeight}px`;
    }
  }

  function handleTouchDrag(e) {
    if (!isDragging) return;
    const deltaY = startY - e.touches[0].clientY;
    const newHeight = startHeight + deltaY;
    if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
      assistantSection.style.height = `${newHeight}px`;
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("touchmove", handleTouchDrag);
  }
}

/**
 * Adiciona uma nova mensagem no painel de mensagens.
 * @param {string} sender - 'user' ou 'assistant'
 * @param {string} text - Texto da mensagem
 * @param {Array} quickReplies - Respostas rápidas
 */
export function appendMessage(sender, text, quickReplies = []) {
  const messagesContainer = document.getElementById("assistant-messages");
  if (!messagesContainer) return;

  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.textContent = text;
  messagesContainer.appendChild(messageElement);

  if (quickReplies.length > 0) {
    const quickReplyContainer = document.createElement("div");
    quickReplyContainer.classList.add("quick-replies");
    quickReplies.forEach((reply) => {
      const button = document.createElement("button");
      button.textContent = reply;
      button.addEventListener("click", () => processUserInput(reply));
      quickReplyContainer.appendChild(button);
    });
    messagesContainer.appendChild(quickReplyContainer);
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Mostra o assistente virtual na interface
 */
export function showAssistant() {
  const assistantWrapper = document.getElementById("assistant-wrapper");
  if (assistantWrapper) {
    assistantWrapper.classList.remove("hidden");
    // Foca no campo de input para melhor UX
    setTimeout(() => {
      const input = document.getElementById("assistantInput");
      if (input) input.focus();
    }, 300);
  }
}
