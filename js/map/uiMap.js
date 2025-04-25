/**
 * Esconde ou elimina o popup associado a um nome específico
 * @param {string} name - O nome do local associado ao popup
 * @param {boolean} [remove=false] - Se true, elimina o popup; caso contrário, apenas esconde
 */
export function hidePopup(name, remove = false) {
  // Encontrar todos os popups abertos no mapa
  const popupElements = document.querySelectorAll(".leaflet-popup");

  // Iterar sobre os popups para encontrar o que contém o nome especificado
  popupElements.forEach((popup) => {
    const h3 = popup.querySelector(".custom-popup h3");
    if (h3 && h3.textContent.trim() === name) {
      if (remove) {
        // Eliminar o popup do DOM
        popup.remove();
      } else {
        // Esconder o popup
        popup.style.display = "none";
      }
    }
  });

  // Se nenhum popup for encontrado, exibir um aviso
  if (!popupElements.length) {
    console.warn(`Popup para "${name}" não encontrado.`);
  }
}
