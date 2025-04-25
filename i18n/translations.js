export const translations = {
  pt: {
    beach: "praia",
    restaurant: "restaurante",
  },
  en: {
    beach: "beach",
    restaurant: "restaurant",
  },
};

function translate(key, lang = "pt") {
  return translations[lang][key] || key;
}
