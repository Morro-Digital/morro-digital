// main.js - Arquivo principal de inicialização do site Morro Digital

// Importações de módulos
import {
  initializeMap,
  setupGeolocation,
  showRoute,
} from "./map/map-controls.js";
import { initializeAssistant, showAssistant } from "./assistant/assistant.js";
import { translatePageContent } from "../i18n/translatePageContent.js";
import { initVoice } from "./voice/voiceSystem.js";
import { initAnalytics } from "./analytics/analytics.js";
import { initPerformanceOptimizations } from "./analytics/performance.js";
import { setupAssistantInteractions } from "./assistant/interface.js";
import { processUserInput } from "./dialog/dialog.js";
import { createSubmenuButtons, setupQuickActionButtons } from "./ui/submenu.js";
import { startCarousel } from "./navigation/carousel.js"; // Importe a função startCarousel
import { appendMessage } from "./assistant/assistant.js"; // Importe a função appendMessage

export let mapInstance; // Renomeie de "map" para "mapInstance" para consistência
export let map; // Mapa Leaflet
export let userLocation = [];
export let userPopup = null;
// Configura os botões de ação rápida
document.addEventListener("DOMContentLoaded", () => {
  setupQuickActionButtons();
});

// Variáveis globais
let language;
let userPopupShown = false;
let assistantScheduled = false;

// Função para detectar o idioma do navegador e definir o idioma da página
function setLanguage() {
  const userLang = navigator.language || navigator.userLanguage;
  language = userLang.split("-")[0];
  document.documentElement.lang = language;
  translatePageContent(language);
}

// Inicialização de elementos da interface
function setupUIElements() {
  // Configurar ação para o botão de assistente
  const assistantButton = document.querySelector(".action-button.primary");
  if (assistantButton) {
    assistantButton.addEventListener("click", showAssistant);
  }

  // Configurar botão de fechamento do submenu
  const closeButton = document.querySelector(".close-button");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      document.getElementById("submenu").classList.add("hidden");
    });
  }
}

// Manipula a seleção de categoria a partir dos botões rápidos
function handleCategorySelection(category) {
  const submenu = document.getElementById("submenu");
  const submenuTitle = document.querySelector(".submenu-title");
  const submenuContainer = document.getElementById("submenuContainer");

  // Define o título com base na categoria
  const titles = {
    praias: "Melhores Praias",
    comer: "Onde Comer",
    atrações: "Principais Atrações",
    dormir: "Onde se Hospedar",
  };

  if (submenuTitle) {
    submenuTitle.textContent = titles[category] || "Explorar Locais";
  }

  // Conteúdo de exemplo para cada categoria
  const mockData = {
    praias: [
      {
        name: "Segunda Praia",
        description: "A mais movimentada e cheia de quiosques.",
      },
      {
        name: "Terceira Praia",
        description: "Mais tranquila, com águas calmas.",
      },
      {
        name: "Praia do Encanto",
        description: "Paraíso isolado com águas cristalinas.",
      },
    ],
    comer: [
      {
        name: "Restaurante Farol",
        description: "Especializado em frutos do mar.",
      },
      { name: "Sabores da Ilha", description: "Comida baiana tradicional." },
    ],
    atrações: [
      { name: "Farol do Morro", description: "Vista panorâmica incrível." },
      { name: "Tirolesa", description: "Adrenalina com vista para o mar." },
    ],
    dormir: [
      { name: "Pousada Mar Azul", description: "Confortável e central." },
      { name: "Vila dos Coqueiros", description: "Bangalôs à beira-mar." },
    ],
  };

  // Renderiza os itens do submenu
  if (submenuContainer) {
    submenuContainer.innerHTML = "";
    const ul = document.createElement("ul");

    (mockData[category] || []).forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "submenu-item";
      li.innerHTML = `
        <div class="submenu-item-icon">
          <i class="fas fa-map-marker-alt"></i>
        </div>
        <div class="submenu-item-content">
          <div class="submenu-item-title">${item.name}</div>
          <div class="submenu-item-description">${item.description}</div>
        </div>
      `;

      // Adiciona evento para mostrar localização no mapa
      li.addEventListener("click", () => {
        showLocationOnMap(item.name, map);
        submenu.classList.add("hidden");
      });

      ul.appendChild(li);
    });

    submenuContainer.appendChild(ul);
  }

  // Exibe o submenu
  if (submenu) {
    submenu.classList.remove("hidden");
  }
}

/**
 * Solicita permissão de GPS e rastreia a posição do usuário em tempo real.
 */
/**
 * Exibe o marcador inicial do usuário no mapa sem iniciar o tracking.
 */
/**
 * Exibe o marcador inicial do usuário no mapa sem iniciar o tracking.
 * Exibe o popup "Você está aqui!" quando o marcador for criado.
 */ export function requestAndTrackUserLocation() {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userLocation.latitude = latitude;
      userLocation.longitude = longitude;

      console.log(
        `[requestAndTrackUserLocation] Localização: (${latitude}, ${longitude})`
      );

      if (!map) {
        map = initializeMap("map");
      }
      map.setView([-13.3815787, -38.9159057], 16);

      if (!window.userMarker) {
        const userIcon = L.divIcon({
          className: "user-marker-icon",
          html: `<i class=\"fas fa-location-arrow\" style=\"font-size: 24px; color: red;\"></i>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        window.userMarker = L.marker([latitude, longitude], {
          icon: userIcon,
        }).addTo(map);
        window.userMarker.bindPopup("Você está aqui!").openPopup();
        userPopupShown = true;

        console.log("[requestAndTrackUserLocation] Popup exibido com sucesso.");

        if (!assistantScheduled) {
          assistantScheduled = true;
          setTimeout(() => {
            if (userPopupShown) {
              showAssistant();
            }
          }, 2000);
        }
      }
    },
    (error) => {
      console.error(
        "[requestAndTrackUserLocation] Erro ao obter localização:",
        error
      );
      alert("Não foi possível acessar sua localização.");
    }
  );
}

function initApp() {
  setLanguage();
  map = initializeMap("map");
  requestAndTrackUserLocation();
  if (map) setupGeolocation(map);
  initVoice(language);

  setupAssistantInteractions(async (message) => {
    const response = await processUserInput(message);
    if (response.text) appendMessage("assistant", response.text);
    if (response.action) response.action();
  });

  initializeAssistant({
    map,
    lang: language,
    onReady: () => console.log("[Assistente] Pronto para interação."),
  });

  setupUIElements();
  initAnalytics();
  initPerformanceOptimizations();
}

window.addEventListener("DOMContentLoaded", () => {
  console.log("[Morro Digital] Sistema iniciando...");
  initApp();

  window.navigateTo = function (locationName) {
    showLocationOnMap(locationName, map);
  };

  createSubmenuButtons();
  setupQuickActionButtons();
  window.showRoute = showRoute;
  window.startCarousel = startCarousel;
  window.showAssistant = showAssistant;
});

document.addEventListener("DOMContentLoaded", () => {
  // Inicializa o mapa no elemento com id="map"
  mapInstance = L.map("map").setView([-13.379, -38.916], 13); // Coordenadas iniciais e zoom

  // Adiciona o tile layer ao mapa
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapInstance);

  console.log("[main.js] Mapa inicializado com sucesso.");
});
