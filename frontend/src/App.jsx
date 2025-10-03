<<<<<<< HEAD
// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home"; // neue Startseite
import AdminUsers from "./pages/AdminUsers";

function App() {
=======
// frontend/src/App.jsx
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AdminUsers from "./pages/AdminUsers";
import AdminTools from "./pages/AdminTools";
import AdminPermissions from "./pages/AdminPermissions";

export default function App() {
>>>>>>> 5d17132 (UI für Werkzeuge und Rechte)
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<AdminUsers />} />
<<<<<<< HEAD
    </Routes>
  );
}

export default App;
=======
      <Route path="/tools" element={<AdminTools />} />
      <Route path="/permissions" element={<AdminPermissions />} />
    </Routes>
  );
}
>>>>>>> 5d17132 (UI für Werkzeuge und Rechte)
