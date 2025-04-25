// interface.js - Responsável por montar e gerenciar a interface do assistente

import { startVoiceRecognition } from "../voice/voiceSystem.js";

/* Esse módulo:
Cria a interface completa do assistente no container #digital-assistant.
Gerencia input e envio de mensagens.
Adiciona mensagens do usuário e do assistente dinamicamente.

/**
 * Cria dinamicamente a interface do assistente dentro do container existente.
 * @param {string} containerId - ID do elemento HTML onde a interface será inserida.
 */
export function createAssistantUI(containerId = "digital-assistant") {
  const container = document.getElementById(containerId);
  if (!container)
    return console.error(
      "Container do assistente não encontrado:",
      containerId
    );

  container.classList.remove("hidden");
  container.innerHTML = `
      <div id="assistant-header">
        <p class="welcome-message">👋 Olá! Seja bem-vindo ao Morro Digital.</p>
      </div>
      <div id="assistant-messages" aria-live="polite" class="scrollable"></div>
      <div id="assistant-input-area">
        <input type="text" id="assistantInput" placeholder="Digite aqui..." aria-label="Campo de entrada do assistente"/>
        <button id="sendButton" aria-label="Enviar mensagem">Enviar</button>
        <button id="voiceButton" aria-label="Ativar reconhecimento de voz">🎤</button>
      </div>
    `;
}

/**
 * Configura os eventos de interação do assistente virtual.
 * @param {Function} onUserMessage - Função callback para processar a mensagem do usuário.
 */
export function setupAssistantInteractions(onUserMessage) {
  const input = document.getElementById("assistantInput");
  const sendButton = document.getElementById("sendButton");
  const voiceButton = document.getElementById("voiceButton");

  if (!input || !sendButton || !voiceButton) {
    console.error("Campos de entrada do assistente não encontrados.");
    return;
  }

  const sendMessage = () => {
    const message = input.value.trim();
    if (message) {
      appendMessage("user", message);
      onUserMessage(message);
      input.value = "";
    }
  };

  sendButton.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Evento para o botão de voz
  voiceButton.addEventListener("click", () => {
    startVoiceRecognition((transcript) => {
      appendMessage("user", transcript);
      onUserMessage(transcript);
    });
  });
}

/**
 * Adiciona uma nova mensagem no painel de mensagens.
 * @param {string} sender - 'user' ou 'assistant'
 * @param {string} text - Texto da mensagem
 */
export function appendMessage(sender, text) {
  const messageArea = document.getElementById("assistant-messages");
  if (!messageArea) return;

  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  messageArea.appendChild(msg);
  messageArea.scrollTop = messageArea.scrollHeight;
}
