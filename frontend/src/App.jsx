// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home"; // neue Startseite

function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Später erweiterbar mit:
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/login" element={<LoginPage />} /> */}
      </Routes>
  );
}

export default App;
