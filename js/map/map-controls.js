// map-control.js - Controle e interação com o mapa Leaflet

import {
  selectedDestination,
  selectedRoute,
  navigationState,
  showNotification,
  startNavigation,
  updateUserMarker,
  cancelNavigation,
} from "../navigation/navigation.js";
import { mapInstance } from "../main.js"; // Importa a instância do mapa
import { hidePopup } from "../map/uiMap.js"; // Importa a função hidePopup

/* O que esse módulo cobre:
Inicializa o mapa OpenStreetMap com Leaflet.
Centraliza o mapa em Morro de São Paulo.
Permite ao assistente exibir localizações com base no nome.
Remove marcadores e rotas anteriores para manter o mapa limpo.
Adiciona controle de geolocalização para o usuário encontrar sua localização no mapa.
*/

const apiKey = "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";

// Variáveis de controle de mapa e marcadores
export let markers = []; // Array global para armazenar os marcadores no mapa
export let userLocation = null;

/**
 * Inicializa o mapa Leaflet e configura as camadas.
 * @param {string} containerId - ID do elemento HTML que conterá o mapa.
 * @returns {Object} Instância do mapa Leaflet.
 */
export function initializeMap(containerId) {
  if (mapInstance) {
    console.warn("[initializeMap] Mapa já inicializado.");
    return mapInstance; // Retorna a instância existente
  }

  const mapElement = document.getElementById(containerId);
  if (!mapElement) {
    console.error(
      `[initializeMap] Elemento com ID "${containerId}" não encontrado no DOM.`
    );
    return null;
  }

  map = L.map(containerId).setView([-13.3815787, -38.9159057], 16); // Zoom inicial 16
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance);

  console.log("[initializeMap] Mapa inicializado com sucesso.");
  return mapInstance;
}

/**
 * Limpa todos os marcadores e rotas existentes no mapa.
 */
export function clearMarkers() {
  if (!mapInstance) {
    console.error("[clearMarkers] mapInstance não está inicializado.");
    return;
  }

  markers.forEach((marker) => {
    if (
      marker !== selectedDestination.marker &&
      marker.options?.title !== "Sua localização"
    ) {
      mapInstance.removeLayer(marker); // Remove o marcador do mapa
    }
  });

  // Atualiza o array de marcadores para conter apenas o marcador do destino
  markers = markers.filter(
    (marker) =>
      marker === selectedDestination.marker ||
      marker.options?.title === "Sua localização"
  );

  console.log(
    "[clearMarkers] Marcadores antigos removidos, exceto o destino e a localização do usuário."
  );
}

/**
 * Mostra uma localização no mapa com base no nome do local e coordenadas.
 * @param {string} locationName - Nome descritivo (ex: 'Praia do Encanto')
 * @param {number} lat - Latitude da localização
 * @param {number} lon - Longitude da localização
 */
export function showLocationOnMap(locationName, lat, lon) {
  if (!mapInstance) {
    console.error("[showLocationOnMap] mapInstance não está inicializado.");
    return;
  }

  clearMarkers();

  if (!lat || !lon) {
    console.warn(
      "[showLocationOnMap] Coordenadas inválidas para a localização:",
      locationName
    );
    return;
  }

  try {
    const icon = getMarkerIconForLocation(locationName.toLowerCase());
    if (!icon) {
      console.error(
        "[showLocationOnMap] Nenhum ícone válido encontrado para a localização:",
        locationName
      );
      return;
    }

    const marker = window.L.marker([lat, lon], { icon }).addTo(mapInstance);
    marker.bindPopup(createPopupContent(locationName)).openPopup();
    markers.push(marker);

    mapInstance.flyTo([lat, lon], 16, { animate: true, duration: 1.5 });
  } catch (error) {
    console.error("[showLocationOnMap] Erro ao adicionar marcador:", error);
  }
}

/**
 * Exibe todos os marcadores de uma categoria no mapa.
 * @param {Array} locations - Lista de locais com nome, latitude e longitude.
 */
export function showAllLocationsOnMap(locations) {
  clearMarkers();

  if (!locations || locations.length === 0) {
    console.warn("Nenhuma localização encontrada para exibir.");
    return;
  }

  const bounds = window.L.latLngBounds();

  locations.forEach((location) => {
    const { name, lat, lon } = location;

    // Verifica se as coordenadas coincidem com a localização do usuário
    if (
      userLocation &&
      lat === userLocation.latitude &&
      lon === userLocation.longitude
    ) {
      console.warn(
        `[showAllLocationsOnMap] Ignorando local com coordenadas da localização do usuário: ${name}`
      );
      return;
    }

    const icon = getMarkerIconForLocation(name.toLowerCase());
    const marker = window.L.marker([lat, lon], { icon }).addTo(mapInstance);
    marker.bindPopup(createPopupContent(name));
    markers.push(marker);

    bounds.extend([lat, lon]);
  });

  mapInstance.fitBounds(bounds); // Ajusta o mapa para mostrar todos os marcadores
}

/**
 * Seleciona o ícone apropriado com base no tipo de localização usando Font Awesome.
 * @param {string} name - Nome do local.
 * @returns {Object} Configuração do ícone.
 */
function getMarkerIconForLocation(name) {
  let iconClass = "fa-map-marker-alt"; // Ícone padrão

  if (name.includes("praia")) {
    iconClass = "fa-umbrella-beach";
  } else if (name.includes("restaurante") || name.includes("sabores")) {
    iconClass = "fa-utensils";
  } else if (
    name.includes("pousada") ||
    name.includes("hotel") ||
    name.includes("vila")
  ) {
    iconClass = "fa-bed";
  } else if (name.includes("atração") || name.includes("farol")) {
    iconClass = "fa-mountain";
  } else if (name.includes("loja") || name.includes("mercado")) {
    iconClass = "fa-shopping-bag";
  } else if (name.includes("hospital") || name.includes("polícia")) {
    iconClass = "fa-ambulance";
  }

  // Retorna um ícone do Leaflet com Font Awesome
  return window.L.divIcon({
    html: `<i class="fas ${iconClass}" style="font-size: 24px; color: #3b82f6;"></i>`,
    className: "custom-marker-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

/**
 * Cria conteúdo HTML personalizado para os popups
 */
/**
 * Creates the HTML content for a popup.
 * @param {string} name - The name of the location.
 * @returns {string} - The HTML string for the popup content.
 */
function createPopupContent(name) {
  return `<div class="custom-popup">
    <h3>${name}</h3>
    <p>${getLocationDescription(name.toLowerCase())}</p>
    <div class="popup-buttons">
      <button class="popup-button" onclick="window.navigateTo('${name.toLowerCase()}')">Mais detalhes</button>
      <button class="popup-button" onclick="startCarousel('${name}')">Fotos</button>
      <button class="popup-button" onclick="showRoute('${name}')">Como Chegar</button>
    </div>
  </div>`;
}

/**
 * Retorna uma descrição curta para a localização
 */
function getLocationDescription(key) {
  const descriptions = {
    "segunda praia": "A mais movimentada e cheia de quiosques.",
    "terceira praia": "Mais tranquila, com águas calmas.",
    "quarta praia": "Extensa e com menos estrutura, perfeita para caminhadas.",
    "praia do encanto": "Paraíso isolado com águas cristalinas.",
    // Adicione mais descrições conforme necessário
  };

  return (
    descriptions[key] ||
    "Um local incrível para conhecer em Morro de São Paulo."
  );
}

/**
 * Adicionar controle de geolocalização para o usuário encontrar sua localização no mapa
 */
export function setupGeolocation(map = mapInstance) {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      // Atualiza a localização do usuário
      userLocation = { latitude, longitude };

      console.log(
        `[setupGeolocation] Localização do usuário atualizada: (${latitude}, ${longitude})`
      );

      // Atualiza o mapa para centralizar na localização do usuário
      if (map) {
        map.flyTo([-13.3815787, -38.9159057], 15);
      }

      // Atualiza o marcador do usuário (se necessário)
      if (typeof updateUserMarker === "function") {
        updateUserMarker(latitude, longitude, position.coords.heading || 0);
      } else {
        console.warn(
          "[setupGeolocation] Função updateUserMarker não está disponível."
        );
      }
    },
    (error) => {
      console.error("[setupGeolocation] Erro ao obter localização:", error);
      alert("Não foi possível acessar sua localização.");
    }
  );
}

/**
 * Exibe a rota entre a localização atual do usuário e o destino.
 * @param {string} locationName - Nome do destino.
 */
export async function showRoute(locationName) {
  try {
    const assistantWrapper = document.getElementById("assistant-wrapper");
    if (assistantWrapper) {
      assistantWrapper.style.display = "none";
    }

    const location = markers.find((marker) =>
      marker.getPopup()?.getContent()?.includes(locationName)
    );

    if (!location) {
      console.error(
        `[showRoute] Marcador não encontrado para: ${locationName}`
      );
      alert("Localização não encontrada no mapa.");
      return;
    }

    const { lat, lng } = location.getLatLng();

    if (!selectedDestination) {
      console.error("[showRoute] selectedDestination não foi inicializado.");
      return;
    }

    selectedDestination.lat = lat;
    selectedDestination.lon = lng;

    const userLocation = await getCurrentPosition();

    const routeData = await plotRouteOnMap(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lng
    );

    if (!routeData) {
      alert("Erro ao calcular a rota. Tente novamente.");
      return;
    }

    selectedRoute.routeData = routeData;

    showRouteSummary(locationName, routeData.distance, routeData.duration);

    console.log("[showRoute] Dados da rota:", selectedRoute.routeData);

    // Esconde o popup associado ao locationName
    hidePopup(locationName);
  } catch (error) {
    console.error("[showRoute] Erro ao exibir a rota:", error);
    alert("Erro ao exibir a rota. Verifique sua conexão e tente novamente.");
  }
}

/**
 * Exibe o resumo da rota com os botões "Iniciar Navegação" e "Cancelar Navegação".
 * @param {string} locationName - Nome do destino.
 * @param {number} totalDistance - Distância total da rota (em metros).
 * @param {number} totalTime - Tempo estimado da rota (em segundos).
 */
function showRouteSummary(locationName, totalDistance, totalTime) {
  const routeSummary = document.createElement("div");
  routeSummary.id = "route-summary";
  routeSummary.className = "route-summary";
  routeSummary.innerHTML = `
  <div class="route-info">
    <h3>Rota para ${locationName}</h3>
    <p>Distância total: ${(totalDistance / 1000).toFixed(2)} km</p>
    <p>Tempo estimado: ${(totalTime / 60).toFixed(2)} minutos</p>
    </div>
    <div class="route-buttons">
      <button id="start-navigation" class="route-button">Iniciar Navegação</button>
      <button id="cancel-navigation" class="route-button">Cancelar Navegação</button>
    </div>
  `;

  document.body.appendChild(routeSummary);

  const startButton = document.getElementById("start-navigation");
  const cancelButton = document.getElementById("cancel-navigation");
  const routeInfo = routeSummary.querySelector(".route-info");

  // Evento: Iniciar Navegação
  if (startButton) {
    startButton.addEventListener("click", async () => {
      try {
        if (!userLocation) {
          showNotification(
            "Localização não disponível. Permita o acesso à localização primeiro.",
            "error"
          );
          return;
        }

        navigationState.instructions = selectedRoute.routeData.instructions;

        if (
          !navigationState.instructions ||
          navigationState.instructions.length === 0
        ) {
          console.error("[startNavigation] Nenhuma instrução encontrada.");
          showNotification(
            "Erro ao iniciar navegação. Nenhuma instrução disponível.",
            "error"
          );
          return;
        }

        await startNavigation();

        // Em vez de esconder todo o resumo, apenas o botão é ocultado

        routeInfo.style.display = "none";
        startButton.style.display = "none";
        cancelButton.style.display = "inline-block"; // Garante visibilidade do botão

        showNotification(
          "Navegação iniciada! Siga as instruções na tela.",
          "success"
        );
      } catch (error) {
        console.error("Erro ao iniciar a navegação:", error);
        showNotification(
          "Erro ao iniciar a navegação. Tente novamente.",
          "error"
        );
      }
    });
  } else {
    console.error(
      "[showRouteSummary] Botão 'start-navigation' não encontrado."
    );
  }

  // Evento: Cancelar Navegação (adicionado ao botão de cancelamento)
  if (cancelButton) {
    cancelButton.addEventListener("click", cancelNavigation);
  } else {
    console.error(
      "[startNavigation] Botão 'cancel-navigation' não encontrado."
    );
  }
}

/**
 * Destaca um marcador no mapa com base no nome da localização.
 * @param {string} locationName - Nome da localização.
 */
export function highlightMarker(locationName) {
  const marker = markers.find((m) =>
    m.getPopup().getContent().includes(locationName)
  );
  if (marker) {
    marker.openPopup();
    marker.setZIndexOffset(1000); // Destaca o marcador
    mapInstance.flyTo(marker.getLatLng(), 16, { animate: true });
  }
}

/**
 * Obtém a localização atual do usuário.
 * @returns {Promise<{ latitude: number, longitude: number }>}}
 */
export async function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não é suportada pelo navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        resolve(userLocation);
      },
      (error) => {
        reject(new Error("Erro ao obter localização: " + error.message));
      }
    );
  });
}

/**
 * Consulta a API OpenRouteService, obtém as coordenadas e plota a rota no mapa.
 * @param {number} startLat - Latitude de partida.
 * @param {number} startLon - Longitude de partida.
 * @param {number} destLat - Latitude do destino.
 * @param {number} destLon - Longitude do destino.
 * @param {string} [profile="foot-walking"] - Perfil de navegação.
 * @returns {Promise<{ distance: number, duration: number, instructions: Array } | null>}}
 */
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
    const coords = data.features[0].geometry.coordinates;
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    if (window.currentRoute) {
      mapInstance.removeLayer(window.currentRoute);
    }

    window.currentRoute = L.polyline(latLngs, {
      color: "blue",
      weight: 5,
    }).addTo(mapInstance);
    mapInstance.fitBounds(window.currentRoute.getBounds(), {
      padding: [50, 50],
    });

    console.log("[plotRouteOnMap] Rota plotada com sucesso.");

    const steps = data.features[0].properties.segments[0].steps;
    const instructions = steps.map((step) => ({
      text: step.instruction,
      latitude: step.way_points[0][1],
      longitude: step.way_points[0][0],
      distance: step.distance,
      duration: step.duration,
      maneuver: step.maneuver,
    }));

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
