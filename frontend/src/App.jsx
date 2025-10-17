// frontend/src/App.jsx
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AdminUsers from "./pages/AdminUsers";
import AdminTools from "./pages/AdminTools";
import AdminPermissions from "./pages/AdminPermissions";
import ManuelReservations from "./pages/ManualReservations";
import AdminPanel from "./pages/AdminPanel";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<AdminUsers />} />
      <Route path="/tools" element={<AdminTools />} />
      <Route path="/permissions" element={<AdminPermissions />} />
      <Route path="/reservations/manual" element={<ManuelReservations />} />
      <Route path="/admin-panel" element={<AdminPanel />} />
    </Routes>
  );
}
