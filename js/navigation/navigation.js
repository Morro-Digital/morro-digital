/**
 * Módulo: navigation.js
 * Descrição: Este módulo gerencia o fluxo de navegação, incluindo validação de destino, obtenção de rotas, monitoramento contínuo da posição do usuário e atualização da interface.
 * Observação:
 * Certifique-se de que todas as dependências estão disponíveis no escopo global ou importadas corretamente.
 */
import { map, mapInstance } from "../main.js"; // Importa o mapa e a instância do Leaflet
import { userLocation } from "../map/map-controls.js";
import { getGeneralText } from "../../i18n/translatePageContent.js"; // Importa a função de tradução
import {
  initializeAssistant,
  showAssistant,
  appendMessage,
} from "../assistant/assistant.js";
// Defina userLocation como uma variável global no início do arquivo navigation.js
export let selectedRoute = {}; // Variável global para armazenar a rota selecionada
export let selectedDestination = {}; // Inicializa como um objeto vazio
export let selectedLanguage = "pt"; // Idioma padrão
export const apiKey =
  "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";

// Define o estado de navegação como um objeto global
export const navigationState = {
  isActive: false,
  isPaused: false,
  currentStepIndex: 0,
  instructions: [],
  lastVoiceInstruction: "", // ← aqui
};

const ORS_TYPE_MAP = {
  0: "head", // Início
  1: "continue",
  2: "turn-slight-right",
  3: "turn-right",
  4: "turn-sharp-right",
  5: "uturn",
  6: "turn-sharp-left",
  7: "turn-left",
  8: "turn-slight-left",
  9: "roundabout", // Entrada em rotatória
  10: "roundabout-exit", // Saída da rotatória
  11: "arrive",
  12: "enter-against",
  13: "leave-against",
  // adicionar outros conforme necessário
};

/////////////////////////////
// 1. FLUXO PRINCIPAL
/////////////////////////////

/**
 * 1.1. startNavigation
 * Inicia a navegação para o destino selecionado, configurando o fluxo completo:
 *  - Validação do destino e disponibilidade de localização;
 *  - Obtenção de múltiplas opções de rota e escolha pelo usuário;
 *  - Enriquecimento das instruções de rota (por exemplo, com dados do OSM);
 *  - Animação e plotagem da rota no mapa;
 *  - Configuração do monitoramento contínuo da posição do usuário.
 */
export async function startNavigation() {
  // 1. Valida o destino selecionado.
  if (!validateDestination(selectedDestination)) {
    return;
  }

  // 2. Verifica se a localização do usuário está disponível.
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    showNotification(
      "Localização não disponível. Permita o acesso à localização primeiro.",
      "error"
    );
    return;
  }

  // 3. Inicializa o estado da navegação.
  initNavigationState();
  navigationState.isActive = true;
  navigationState.isPaused = false;
  navigationState.watchId = true;
  navigationState.currentStepIndex = 0;
  navigationState.lastVoiceInstruction = "";

  // 4. Obtém a rota com base na posição do usuário e no destino.
  let routeData = await plotRouteOnMap(
    userLocation.latitude,
    userLocation.longitude,
    selectedDestination.lat,
    selectedDestination.lon
  );

  if (!routeData) {
    showNotification(
      "Erro ao calcular a rota. Verifique sua conexão e tente novamente.",
      "error"
    );
    return;
  }

  // 5. Enriquece as instruções da rota com dados adicionais (ex.: POIs via OSM).
  let routeInstructions = await enrichInstructionsWithOSM(
    routeData.instructions,
    selectedLanguage
  );
  if (!routeInstructions || routeInstructions.length === 0) {
    showNotification(
      "Erro ao carregar instruções de navegação. Tente novamente.",
      "error"
    );
    return;
  }

  navigationState.instructions = routeInstructions;

  animateMapToLocalizationUser(userLocation.latitude, userLocation.longitude);

  // 6. Plota a rota escolhida no mapa e adiciona os marcadores de origem e destino.
  finalizeRouteMarkers(
    userLocation.latitude,
    userLocation.longitude,
    selectedDestination
  );

  // 7. Ajusta a interface:
  updateInstructionBanner(routeInstructions[0], selectedLanguage);
  giveVoiceFeedback(getGeneralText("navigationStarted", selectedLanguage));

  // 8. Inicia o monitoramento contínuo da posição do usuário utilizando watchPosition.
  if (!navigator.geolocation) {
    showNotification(
      "Seu navegador não suporta geolocalização. Navegação indisponível.",
      "error"
    );
    return;
  }

  window.positionWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      if (navigationState.isPaused) return;

      const { latitude, longitude, heading, speed, accuracy } = pos.coords;

      // Atualiza a localização do usuário
      userLocation.latitude = latitude;
      userLocation.longitude = longitude;
      userLocation.accuracy = accuracy;
      userLocation.heading = heading;

      // Atualiza o marcador e o círculo de precisão
      updateUserMarker(latitude, longitude, heading, accuracy);

      adjustMapZoomBasedOnSpeed(speed);

      if (heading !== null) setMapRotation(heading);

      if (
        navigationState.instructions &&
        navigationState.instructions.length > 0
      ) {
        updateRealTimeNavigation(
          latitude,
          longitude,
          navigationState.instructions,
          selectedDestination.lat,
          selectedDestination.lon,
          selectedLanguage,
          heading
        );
      }

      if (
        shouldRecalculateRoute(
          latitude,
          longitude,
          navigationState.instructions
        )
      ) {
        notifyDeviation();
      }
    },
    (error) => {
      console.error("Erro no watchPosition:", error);
      showNotification(
        getGeneralText("trackingError", selectedLanguage),
        "error"
      );
    },
    { enableHighAccuracy: true }
  );

  console.log("startNavigation: Navegação iniciada com sucesso.");
}

export function cancelNavigation() {
  // 1. Parar geolocalização contínua
  if (window.positionWatcher) {
    navigator.geolocation.clearWatch(window.positionWatcher);
    window.positionWatcher = null;
  }

  // 2. Remover rota do mapa
  if (window.currentRoute) {
    mapInstance.removeLayer(window.currentRoute);
    window.currentRoute = null;
  }

  // 3. Resetar estado de navegação
  navigationState.isActive = false;
  navigationState.isPaused = false;
  navigationState.watchId = null;
  navigationState.currentStepIndex = 0;
  navigationState.instructions = [];

  // 4. Remover sumário de rota, se presente
  const summary = document.getElementById("route-summary");
  if (summary) {
    document.body.removeChild(summary);
  }

  // 5. Esconder banner de instruções
  const instructionBanner = document.getElementById("instruction-banner");
  if (instructionBanner) {
    instructionBanner.classList.add("hidden");
  }

  // 6. Reiniciar e mostrar assistente virtual apenas após carregar e configurar
  initializeAssistant({
    lang: "pt",
    onReady: () => {
      const assistantWrapper = document.getElementById("assistant-wrapper");
      if (assistantWrapper) {
        assistantWrapper.classList.remove("hidden");
      }
      appendMessage(
        "assistant",
        "Se precisar de algo, estou aqui para ajudar!"
      );
    },
  });

  // 7. Feedback visual
  showNotification("Navegação cancelada.", "info");
  console.log("cancelNavigation: Navegação cancelada e assistente reativado.");
}

function validateDestination(destination = selectedDestination) {
  if (!destination || !destination.lat || !destination.lon) {
    showNotification(
      "Destino inválido. Selecione um destino válido antes de iniciar a navegação.",
      "error"
    );
    return false;
  }

  const { lat, lon } = destination;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    showNotification(
      "Coordenadas do destino estão fora dos limites permitidos.",
      "error"
    );
    return false;
  }

  return true;
}

function initNavigationState() {
  console.log("[initNavigationState] Reinicializando estado de navegação...");
  navigationState.isActive = false;
  navigationState.isPaused = false;
  navigationState.watchId = null;
  navigationState.currentStepIndex = 0;
  navigationState.instructions = [];
  navigationState.selectedDestination = null;
  if (navigationState.currentRouteLayer) {
    mapInstance.removeLayer(navigationState.currentRouteLayer);
    navigationState.currentRouteLayer = null;
  }
  console.log("[initNavigationState] Estado de navegação reinicializado.");
}

async function enrichInstructionsWithOSM(instructions, lang = "pt") {
  try {
    const enriched = await Promise.all(
      instructions.map(async (step) => {
        if (!step.latitude || !step.longitude) {
          console.warn(
            "[enrichInstructionsWithOSM] Coordenadas inválidas:",
            step
          );
          return step;
        }

        const clonedManeuver = step.maneuver ? { ...step.maneuver } : null;
        const pois = await FetchPOIsNearby(step.latitude, step.longitude, lang);

        return {
          ...step,
          raw: {
            maneuver: clonedManeuver,
            street: step.name || "",
            landmarks: pois.map((p) => ({
              name: p.name,
              type: p.type,
            })),
          },
          enrichedInfo: pois.length
            ? getGeneralText("pois_nearby", lang).replace(
                "{count}",
                pois.length
              )
            : null,
        };
      })
    );

    console.log(
      "[enrichInstructionsWithOSM] Instruções enriquecidas com POIs."
    );
    return enriched;
  } catch (error) {
    console.error("[enrichInstructionsWithOSM] Erro:", error);
    return instructions;
  }
}

export let routeSegments = []; // Array global para armazenar os trechos da rota

async function plotRouteOnMap(
  startLat,
  startLon,
  destLat,
  destLon,
  profile = "foot-walking"
) {
  if (!mapInstance) {
    console.error("[plotRouteOnMap] mapInstance não está inicializado.");
    return null;
  }

  const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}&start=${startLon},${startLat}&end=${destLon},${destLat}&instructions=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[plotRouteOnMap] Erro ao obter rota:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.features || !data.features[0]?.geometry?.coordinates) {
      console.error("[plotRouteOnMap] Dados inválidos retornados pela API.");
      return null;
    }

    const coords = data.features[0].geometry.coordinates;
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    if (window.currentRoute) {
      mapInstance.removeLayer(window.currentRoute);
    }

    window.currentRoute = createPolyline(latLngs, {
      color: "blue",
      weight: 5,
    });

    mapInstance.fitBounds(window.currentRoute.getBounds(), {
      padding: [50, 50],
    });

    console.log("[plotRouteOnMap] Rota plotada com sucesso.");

    const steps = data.features[0].properties.segments[0].steps;
    const instructions = steps.map((step) => {
      const [startIndex, endIndex] = step.way_points;
      const startCoords = coords[startIndex];
      return {
        text: step.instruction,
        latitude: startCoords ? startCoords[1] : undefined,
        longitude: startCoords ? startCoords[0] : undefined,
        distance: step.distance,
        duration: step.duration,
        maneuver: {
          type: ORS_TYPE_MAP[step.type] || "continue",
          location: {
            lat: startCoords ? startCoords[1] : null,
            lon: startCoords ? startCoords[0] : null,
          },
        },
      };
    });

    return {
      distance: data.features[0].properties.segments[0].distance,
      duration: data.features[0].properties.segments[0].duration,
      instructions,
    };
  } catch (error) {
    console.error("[plotRouteOnMap] Erro ao plotar rota:", error);
    return null;
  }
}

function finalizeRouteMarkers(userLat, userLon, destination) {
  if (!mapInstance) {
    console.error("[finalizeRouteMarkers] mapInstance não está inicializado.");
    return;
  }
  console.log(
    "[finalizeRouteMarkers] Marcadores de origem e destino adicionados."
  );
}

/**
 * Atualiza o modal de instruções com base na instrução atual.
 * @param {Object} instruction - Objeto contendo os dados da instrução.
 * @param {string} lang - Idioma selecionado (ex.: "pt", "en").
 */
/**
 * updateInstructionBanner
 * Atualiza o banner de instruções exibido na interface.
 * - Formata a mensagem utilizando buildInstructionMessage e mapORSInstruction.
 * - Atualiza o ícone correspondente à manobra.
 *
 * @param {Object} instruction - Objeto contendo a instrução atual.
 * @param {string} [lang=selectedLanguage] - Código do idioma.
 */
function updateInstructionBanner(instruction, lang = currentLang) {
  const banner = document.getElementById("instruction-banner");
  const mainEl = document.getElementById("instruction-main");

  if (!banner || !mainEl) return;

  let finalMessage = "";

  if (instruction.raw) {
    console.log("[DEBUG] Instrução recebida:", instruction.raw);
    finalMessage = buildInstructionMessage(instruction.raw, lang);
  } else if (instruction.text) {
    const translated = getGeneralText(instruction.text, lang);
    finalMessage =
      translated !== instruction.text ? translated : instruction.text;
  } else {
    finalMessage = getGeneralText("unknown", lang);
  }

  mainEl.textContent = finalMessage;
  banner.classList.remove("hidden");
  banner.style.display = "flex";

  console.log("updateInstructionBanner:", finalMessage);
}

function mapORSInstruction(rawInstruction) {
  const maneuverType = rawInstruction?.maneuver?.type || "unknown";
  return { maneuverKey: maneuverType.replace(/-/g, "_") };
}

function giveVoiceFeedback(message) {
  if (!("speechSynthesis" in window)) {
    console.warn("speechSynthesis não suportado.");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = selectedLanguage === "pt" ? "pt-BR" : "en-US";
  window.speechSynthesis.speak(utterance);
}

/**
 * Atualiza a navegação em tempo real com base na posição do usuário.
 * @param {number} lat - Latitude atual do usuário.
 * @param {number} lon - Longitude atual do usuário.
 * @param {Array} instructions - Lista de instruções da rota.
 * @param {number} destLat - Latitude do destino.
 * @param {number} destLon - Longitude do destino.
 * @param {string} lang - Idioma selecionado (ex.: "pt", "en").
 * @param {number} heading - Direção atual do usuário.
 */
function updateRealTimeNavigation(
  lat,
  lon,
  instructions,
  destLat,
  destLon,
  lang,
  heading
) {
  if (!map) return;

  updateUserMarker(lat, lon, heading);

  if (instructions && instructions.length > 0) {
    let index = navigationState.currentStepIndex;
    const step = instructions[index];

    const distance = calculateDistance(lat, lon, step.latitude, step.longitude);
    if (distance < 15 && index < instructions.length - 1) {
      navigationState.currentStepIndex++;
      index++;
    }

    const currentInstruction = instructions[index];
    if (!currentInstruction || !currentInstruction.raw) return;

    const message = buildInstructionMessage(currentInstruction.raw, lang); // ← Definir antes de usar
    updateInstructionBanner(currentInstruction, lang);

    // Só falar se for diferente da última
    if (message !== navigationState.lastVoiceInstruction) {
      giveVoiceFeedback(message);
      navigationState.lastVoiceInstruction = message;
    }

    map.panTo([lat, lon], { animate: true, duration: 0.5 });
  }
}

function adjustMapZoomBasedOnSpeed(speed) {
  let zoomLevel;

  if (speed < 5) {
    zoomLevel = 18;
  } else if (speed < 15) {
    zoomLevel = 16;
  } else if (speed < 50) {
    zoomLevel = 14;
  } else {
    zoomLevel = 12;
  }

  map.setZoom(zoomLevel);
}

function setMapRotation(heading) {
  const tileLayerElement = document.querySelector(".leaflet-tile-pane");
  if (!tileLayerElement) {
    console.warn("[setMapRotation] Camada de tiles não encontrada.");
    return;
  }

  if (!navigationState.isActive || !navigationState.isRotationEnabled) {
    tileLayerElement.style.transform = "none";
    return;
  }

  const now = Date.now();
  if (navigationState.quietMode) {
    if (navigationState.speed < 0.5) return;
    if (
      now - navigationState.lastRotationTime <
      navigationState.rotationInterval
    )
      return;
  }

  const desiredHeading = heading < 0 ? (heading % 360) + 360 : heading % 360;
  tileLayerElement.style.transition = "transform 0.3s ease-out";
  tileLayerElement.style.transform = `rotate(${desiredHeading}deg)`;
  navigationState.lastRotationTime = now;
}

function shouldRecalculateRoute(userLat, userLon, instructions) {
  const currentStep = instructions[navigationState.currentStepIndex];
  if (!currentStep) return false;
  const distance = calculateDistance(
    userLat,
    userLon,
    currentStep.latitude,
    currentStep.longitude
  );
  if (distance > 50) {
    console.log(
      "[shouldRecalculateRoute] Desvio detectado: distância =",
      distance
    );
    return true;
  }
  return false;
}

async function recalculateRoute(
  userLat,
  userLon,
  destLat,
  destLon,
  options = {}
) {
  const {
    lang = "pt",
    bigDeviation = false,
    profile = "foot-walking",
  } = options;
  console.log("Recalculando rota...");
  try {
    // Interrompe o rastreamento atual para reiniciar a rota
    if (window.positionWatcher) {
      navigator.geolocation.clearWatch(window.positionWatcher);
      window.positionWatcher = null;
    }
    if (bigDeviation) {
      showNotification(getGeneralText("routeDeviated", lang), "warning");
      //speakInstruction(
      //  getGeneralText("offRoute", lang),
      //  lang === "pt" ? "pt-BR" : "en-US"
      //);
    }
    // Busca novas instruções para a rota recalculada
    const newInstructions = await fetchRouteInstructions(
      userLat,
      userLon,
      destLat,
      destLon,
      lang,
      profile
    );
    if (!newInstructions || newInstructions.length === 0) {
      showNotification(getGeneralText("noInstructions", lang), "error");
      return;
    }
    // Limpa a rota atual do mapa
    clearCurrentRoute();
    // Plota a nova rota
    const routeData = await plotRouteOnMap(
      userLat,
      userLon,
      destLat,
      destLon,
      profile
    );
    // Atualiza o estado da navegação com as novas instruções
    updateNavigationState({
      instructions: newInstructions,
      currentStepIndex: 0,
      isActive: true,
      isPaused: false,
    });
    showNotification(getGeneralText("routeRecalculatedOk", lang), "success");
    // Destaca o próximo passo da nova rota
    highlightNextStepInMap(newInstructions[0]);
    // Reinicia o watchPosition para monitorar a nova rota
    window.positionWatcher = navigator.geolocation.watchPosition(
      (pos) => {
        if (navigationState.isPaused) return;
        const { latitude, longitude } = pos.coords;
        updateRealTimeNavigation(
          latitude,
          longitude,
          newInstructions,
          destLat,
          destLon,
          lang
        );
      },
      (err) => {
        console.error("Erro no watchPosition durante recalc:", err);
        fallbackToSensorNavigation();
      },
      { enableHighAccuracy: true }
    );
  } catch (error) {
    console.error("Erro em recalculateRoute:", error);
    showNotification(getGeneralText("routeError", lang), "error");
  }
}

function notifyDeviation() {
  const lang = navigationState.lang || "pt";
  showNotification(getGeneralText("routeDeviated", lang), "warning");
  if (userLocation && selectedDestination) {
    recalculateRoute(
      userLocation.latitude,
      userLocation.longitude,
      selectedDestination.lat,
      selectedDestination.lon,
      { bigDeviation: true, lang }
    );
  }
  console.log(
    "[notifyDeviation] Notificação de desvio enviada e recálculo iniciado."
  );
}

/**
 * updateUserMarker
 * Atualiza ou cria o marcador do usuário no mapa com base na localização e heading.
 *
 * @param {number} latitude - Latitude do usuário.
 * @param {number} longitude - Longitude do usuário.
 * @param {number} heading - Direção (em graus) do usuário.
 * @param {number} accuracy - Precisão da localização do usuário.
 */
export function updateUserMarker(
  latitude,
  longitude,
  heading = 0,
  accuracy = 15
) {
  console.log(
    `[updateUserMarker] Atualizando posição para: (${latitude}, ${longitude}) com heading: ${heading} e precisão: ${accuracy}`
  );

  // Cria o marcador do usuário, se ainda não existir
  if (!window.userMarker) {
    const userIcon = L.divIcon({
      className: "user-marker-icon",
      html: `<i class="fas fa-location-arrow" style="font-size: 24px; color: red; transform: rotate(${heading}deg);"></i>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    window.userMarker = L.marker([latitude, longitude], {
      icon: userIcon,
    }).addTo(map);

    console.log("[updateUserMarker] Marcador do usuário criado.");
  } else {
    // Atualiza o marcador existente
    window.userMarker.setLatLng([latitude, longitude]);
    if (window.userMarker._icon) {
      window.userMarker._icon.style.transform = `rotate(${heading}deg)`;
    }
  }

  // Atualiza ou cria o círculo de precisão
  if (window.userAccuracyCircle) {
    window.userAccuracyCircle.setLatLng([latitude, longitude]);
    window.userAccuracyCircle.setRadius(accuracy);
  } else {
    window.userAccuracyCircle = L.circle([latitude, longitude], {
      radius: accuracy,
      className: "gps-accuracy-circle",
    }).addTo(map);
  }
}

/**
 * Calcula o ângulo (bearing) entre dois pontos geográficos.
 * @param {number} lat1 - Latitude do ponto inicial.
 * @param {number} lon1 - Longitude do ponto inicial.
 * @param {number} lat2 - Latitude do ponto final.
 * @param {number} lon2 - Longitude do ponto final.
 * @returns {number} Ângulo em graus entre os dois pontos.
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / 360;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normaliza para o intervalo [0, 360)
}

/**
 * showNotification
 * Exibe uma notificação para o usuário.
 *
 * @param {string} message - Mensagem a ser exibida.
 * @param {string} type - Tipo da notificação ("error", "warning", "success", "info").
 * @param {number} [duration=3000] - Duração em milissegundos para ocultar a notificação.
 */
export function showNotification(message, type, duration = 3000) {
  // Tenta selecionar o container de notificações; se não existir, cria um novo
  let container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "1000";
    document.body.appendChild(container);
  }
  // Cria a notificação com a mensagem e define estilos básicos
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.marginBottom = "10px";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.color = "#fff";
  // Define a cor de fundo de acordo com o tipo
  switch (type) {
    case "error":
      notification.style.backgroundColor = "#e74c3c";
      break;
    case "warning":
      notification.style.backgroundColor = "#f39c12";
      break;
    case "success":
      notification.style.backgroundColor = "#27ae60";
      break;
    default:
      notification.style.backgroundColor = "#3498db";
  }
  container.appendChild(notification);
  // Remove a notificação após o tempo definido (3000ms por padrão)
  setTimeout(() => {
    notification.remove();
  }, duration);
}

/**
 * Esconde o resumo da rota exibido na interface.
 */
export function hideRouteSummary() {
  const routeSummary = document.getElementById("route-summary");
  if (routeSummary) {
    routeSummary.style.display = "none"; // Esconde o elemento
    console.log("[hideRouteSummary] Resumo da rota escondido.");
  } else {
    console.warn(
      "[hideRouteSummary] Nenhum resumo da rota encontrado para esconder."
    );
  }
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * @param {number} lat1 - Latitude do primeiro ponto.
 * @param {number} lon1 - Longitude do primeiro ponto.
 * @param {number} lat2 - Latitude do segundo ponto.
 * @param {number} lon2 - Longitude do segundo ponto.
 * @returns {number} Distância em metros.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distância em metros
}

function translatePOI(name, lang = "pt") {
  const translations = {
    "Praça Aureliano Lima": {
      pt: "Praça Aureliano Lima",
      en: "Aureliano Lima Square",
      es: "Plaza Aureliano Lima",
      he: "כיכר אורליאנו לימה",
    },
    "Igreja de Nossa Senhora da Luz": {
      pt: "Igreja de Nossa Senhora da Luz",
      en: "Church of Our Lady of Light",
      es: "Iglesia de Nuestra Señora de la Luz",
      he: "כנסיית גבירתנו של האור",
    },
    // outros pontos importantes aqui...
  };

  return translations[name]?.[lang] || name;
}

function createPolyline(latLngs, options) {
  if (
    !latLngs ||
    latLngs.some(([lat, lon]) => lat === undefined || lon === undefined)
  ) {
    console.error("createPolyline: Coordenadas inválidas fornecidas.");
    return null;
  }
  return L.polyline(latLngs, options).addTo(map);
}

function buildInstructionMessage(rawInstruction, lang = currentLang) {
  if (!rawInstruction || !rawInstruction.maneuver) {
    console.warn("buildInstructionMessage: Instrução inválida.");
    return getDirectionIcon("unknown") + " " + getGeneralText("unknown", lang);
  }

  const { maneuver, street = "", landmarks = [] } = rawInstruction;
  const { maneuverKey } = mapORSInstruction(rawInstruction);

  const translationKey =
    maneuverKey + (street && street !== "unknown" ? "_on" : "");
  let translation = getGeneralText(translationKey, lang);

  if (!translation) {
    console.warn(
      `[buildInstructionMessage] Tradução ausente para '${translationKey}'`
    );
    translation = getGeneralText("unknown", lang);
  }

  const icon = getDirectionIcon(maneuverKey);
  let message = `${icon} ${translation.replace("{street}", street)}`;

  if (landmarks.length) {
    const names = landmarks.map((l) => l.name).join(", ");
    message += ` (${names})`;
  }

  return message;
}

function buildOverpassQuery(lat, lon, radius = 30) {
  return `
    [out:json];
    (
      node(around:${radius},${lat},${lon})["tourism"];
      node(around:${radius},${lat},${lon})["historic"];
      node(around:${radius},${lat},${lon})["amenity"];
    );
    out center;
  `;
}

async function FetchPOIsNearby(lat, lon, lang = currentLang) {
  try {
    const query = buildOverpassQuery(lat, lon);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" },
    });

    const data = await response.json();

    return data.elements
      .filter((el) => el.tags && el.tags.name)
      .map((el) => ({
        name: translatePOI(el.tags.name, lang),
        type:
          el.tags.tourism || el.tags.historic || el.tags.amenity || "landmark",
      }));
  } catch (error) {
    console.error("[FetchPOIsNearby] Erro:", error);
    return [];
  }
}

function getDirectionIcon(maneuverKey) {
  const icons = {
    turn_left: "⬅️",
    turn_right: "➡️",
    continue_straight: "⬆️",
    u_turn: "↩️",
    head_south: "⬇️",
    head_north: "⬆️",
    head_east: "➡️",
    head_west: "⬅️",
    // Adicione os outros se desejar
    unknown: "❓",
  };

  if (!icons[maneuverKey]) {
    console.warn(
      `[getDirectionIcon] Manobra não reconhecida: "${maneuverKey}"`
    );
  }

  return icons[maneuverKey] || icons["unknown"];
}

/**
 * animateMapToLocalizationUser(targetLat, targetLon)
 * Realiza uma animação suave para centralizar o mapa na localização do usuário.
 * A animação interpola entre o centro atual e a posição (targetLat, targetLon) durante 1 segundo.
 */
function animateMapToLocalizationUser(targetLat, targetLon) {
  const animationDuration = 1000; // duração em milissegundos
  const startCenter = map.getCenter();
  const startLat = startCenter.lat;
  const startLon = startCenter.lng;
  const startTime = performance.now();

  function animateFrame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / animationDuration, 1); // Progresso de 0 a 1
    // Interpolação linear entre a posição atual e a posição alvo
    const interpolatedLat = startLat + (targetLat - startLat) * progress;
    const interpolatedLon = startLon + (targetLon - startLon) * progress;
    // Atualiza a vista do mapa sem animação nativa
    map.setView([interpolatedLat, interpolatedLon], map.getZoom(), {
      animate: false,
    });
    if (progress < 1) {
      requestAnimationFrame(animateFrame);
    }
  }
  requestAnimationFrame(animateFrame);
}

export { FetchPOIsNearby };
