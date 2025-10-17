import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/AdminPanel.css";
import { getToken } from "../utils/authUtils";

const API_URL = import.meta.env.VITE_API_URL;

function AdminPanel() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySortKey, setCategorySortKey] = useState(null);
  const [categorySortDirection, setCategorySortDirection] = useState("asc");
  const [reservations, setReservations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });

        const data = await res.json();
        if (data.permissions?.access_admin_panel !== "true") {
          navigate("/");
        } else {
          setPermissions(data.permissions);
        }
      } catch (err) {
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  useEffect(() => {
    if (loading) return;
    fetch(`${API_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => res.json())
      .then(setCategories);

    fetch(`${API_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => res.json())
      .then(setReservations);
  }, [loading]);

  const handleSort = (key) => {
    const direction =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDirection(direction);
  };

  const handleCategorySort = (key) => {
    const direction =
      categorySortKey === key && categorySortDirection === "asc"
        ? "desc"
        : "asc";
    setCategorySortKey(key);
    setCategorySortDirection(direction);
  };

  const filteredReservations = reservations.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.id.toString().includes(term) ||
      r.tool_name?.toLowerCase().includes(term) ||
      r.username?.toLowerCase().includes(term)
    );
  });

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey]?.toString().toLowerCase();
    const valB = b[sortKey]?.toString().toLowerCase();
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const sortedCategories = [...categories]
    .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    .sort((a, b) => {
      if (!categorySortKey) return 0;
      const valA = a[categorySortKey]?.toString().toLowerCase();
      const valB = b[categorySortKey]?.toString().toLowerCase();
      if (valA < valB) return categorySortDirection === "asc" ? -1 : 1;
      if (valA > valB) return categorySortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const handleDeleteReservation = async (id) => {
    if (!confirm("Reservation wirklich löschen?")) return;
    const res = await fetch(`${API_URL}/api/reservations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setReservations(reservations.filter((r) => r.id !== id));
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("Kategorie wirklich löschen?")) return;
    const res = await fetch(`${API_URL}/api/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Löschen.");
    setCategories(categories.filter((cat) => cat.id !== id));
  };

  const handleEditCategory = async (cat) => {
    const newName = prompt("Neuer Name für die Kategorie:", cat.name);
    if (!newName || newName === cat.name) return;
    const res = await fetch(`${API_URL}/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Umbenennen.");
    setCategories((prev) => prev.map((c) => (c.id === data.id ? data : c)));
  };

  const handleCreateCategory = async () => {
    const name = prompt("Name der neuen Kategorie:", "");
    if (!name) return;
    const res = await fetch(`${API_URL}/api/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Erstellen.");
    setCategories((prev) => [...prev, data]);
  };

  if (loading) return <p className="adminpanel-loading">Lade Admin-Panel...</p>;

  return (
    <div className="adminpanel-page">
      <div className="adminpanel-header">
        <h2 className="adminpanel-title">Admin-Panel</h2>
        <button
          className="adminpanel-back-button"
          onClick={() => navigate("/")}
        >
          ← Zurück zur Startseite
        </button>
      </div>

      <div className="adminpanel-section">
        <h3 className="adminpanel-section-title">Kategorien</h3>
        <div className="tools-actions">
          <button className="tools-add-button" onClick={handleCreateCategory}>
            + Kategorie hinzufügen
          </button>
          <input
            type="text"
            className="tools-search"
            placeholder="Suche nach Kategorie..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
          />
        </div>
        <table className="tools-table">
          <thead>
            <tr>
              <th onClick={() => handleCategorySort("id")}>
                ID{" "}
                <span className="sort-icon">
                  {categorySortKey === "id"
                    ? categorySortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>
              <th onClick={() => handleCategorySort("name")}>
                Name{" "}
                <span className="sort-icon">
                  {categorySortKey === "name"
                    ? categorySortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((cat) => (
              <tr key={cat.id}>
                <td>{cat.id}</td>
                <td>{cat.name}</td>
                <td>
                  <button
                    className="tools-edit-button"
                    onClick={() => handleEditCategory(cat)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="tools-delete-button"
                    onClick={() => handleDeleteCategory(cat.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adminpanel-section">
        <h3 className="adminpanel-section-title">Alle Reservationen</h3>
        <input
          type="text"
          placeholder="Suche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="adminpanel-search"
        />
        <table className="adminpanel-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("id")}>ID</th>
              <th onClick={() => handleSort("username")}>Benutzer</th>
              <th onClick={() => handleSort("tool_name")}>Werkzeug</th>
              <th onClick={() => handleSort("start_time")}>Start</th>
              <th onClick={() => handleSort("end_time")}>Ende</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedReservations.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.username}</td>
                <td>{r.tool_name}</td>
                <td>{r.start_time?.slice(0, 16).replace("T", " ")}</td>
                <td>{r.end_time?.slice(0, 16).replace("T", " ")}</td>
                <td>
                  <button
                    className="adminpanel-delete-button"
                    onClick={() => handleDeleteReservation(r.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adminpanel-section">
        <h3 className="adminpanel-section-title">Fehler-Logs</h3>
        <p className="adminpanel-placeholder">
          Log-Anzeige ist noch nicht implementiert.
        </p>
      </div>
    </div>
  );
}

export default AdminPanel;
