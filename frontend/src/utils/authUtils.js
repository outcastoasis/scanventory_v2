// src/utils/authUtils.js

import { jwtDecode } from "jwt-decode";

export const getToken = () => {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
};

export const isTokenExpired = () => {
  const token = getToken();
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const clearToken = () => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
};

export const setToken = (token, remember) => {
  clearToken();
  if (remember) {
    localStorage.setItem("token", token);
  } else {
    sessionStorage.setItem("token", token);
  }
};
