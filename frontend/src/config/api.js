const host = window.location.hostname;

// Produktiv: immer den aktuellen Host nutzen
const API_BASE = import.meta.env.PROD
  ? `http://${host}`
  : import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export default API_BASE;
