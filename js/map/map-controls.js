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
import { hidePopup, markers } from "../map/uiMap.js"; // Importa a função hidePopup
import { plotRouteOnMap } from "./osm-service.js";

/* O que esse módulo cobre:
Inicializa o mapa OpenStreetMap com Leaflet.
Centraliza o mapa em Morro de São Paulo.
Permite ao assistente exibir localizações com base no nome.
Remove marcadores e rotas anteriores para manter o mapa limpo.
Adiciona controle de geolocalização para o usuário encontrar sua localização no mapa.
*/

const apiKey = "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";

// Variáveis de controle de mapa e marcadores
export let userLocation = null;

/**
 * Inicializa o mapa Leaflet e configura as camadas.
 * @param {string} containerId - ID do elemento HTML que conterá o mapa.
 * @returns {Object} Instância do mapa Leaflet.
 */
export function initializeMap(containerId) {
  if (mapInstance) {
    console.warn("[initializeMap] Mapa já inicializado.");
    return mapInstance;
  }

  const mapElement = document.getElementById(containerId);
  if (!mapElement) {
    console.error(
      `[initializeMap] Elemento com ID "${containerId}" não encontrado no DOM.`
    );
    return null;
  }

  // Corrija a atribuição usando mapInstance em vez de map
  mapInstance = L.map(containerId).setView([-13.3815787, -38.9159057], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance);

  return mapInstance;
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
