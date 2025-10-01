// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home"; // neue Startseite
import AdminUsers from "./pages/AdminUsers";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<AdminUsers />} />
    </Routes>
  );
}

export default App;
