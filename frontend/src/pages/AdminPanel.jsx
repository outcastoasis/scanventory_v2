import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/AdminPanel.css";
import { getToken } from "../utils/authUtils";

const API_URL = import.meta.env.VITE_API_URL;

function AdminPanel() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Kategorien
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySortKey, setCategorySortKey] = useState(null);
  const [categorySortDirection, setCategorySortDirection] = useState("asc");

  // Firmen
  const [companies, setCompanies] = useState([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companySortKey, setCompanySortKey] = useState(null);
  const [companySortDirection, setCompanySortDirection] = useState("asc");

  // Reservationen
  const [reservations, setReservations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [reservationSortKey, setReservationSortKey] = useState(null);
  const [reservationSortDirection, setReservationSortDirection] =
    useState("asc");

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

    fetch(`${API_URL}/api/companies`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => res.json())
      .then(setCompanies);

    fetch(`${API_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => res.json())
      .then(setReservations);
  }, [loading]);

  // --- Sortier-Handler ---
  const handleReservationSort = (key) => {
    const direction =
      reservationSortKey === key && reservationSortDirection === "asc"
        ? "desc"
        : "asc";
    setReservationSortKey(key);
    setReservationSortDirection(direction);
  };

  const handleCategorySort = (key) => {
    const direction =
      categorySortKey === key && categorySortDirection === "asc"
        ? "desc"
        : "asc";
    setCategorySortKey(key);
    setCategorySortDirection(direction);
  };

  const handleCompanySort = (key) => {
    const direction =
      companySortKey === key && companySortDirection === "asc" ? "desc" : "asc";
    setCompanySortKey(key);
    setCompanySortDirection(direction);
  };

  // --- Filter & Sort Reservations ---
  const filteredReservations = reservations.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.id.toString().includes(term) ||
      r.tool_name?.toLowerCase().includes(term) ||
      r.username?.toLowerCase().includes(term)
    );
  });

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (!reservationSortKey) return 0;

    let valA, valB;

    switch (reservationSortKey) {
      case "username":
        valA = a.user?.username?.toLowerCase() || "";
        valB = b.user?.username?.toLowerCase() || "";
        break;
      case "tool_name":
        valA = a.tool?.name?.toLowerCase() || "";
        valB = b.tool?.name?.toLowerCase() || "";
        break;
      case "start":
        valA = a.start || "";
        valB = b.start || "";
        break;
      case "end":
        valA = a.end || "";
        valB = b.end || "";
        break;
      default:
        valA = a[reservationSortKey]?.toString().toLowerCase() || "";
        valB = b[reservationSortKey]?.toString().toLowerCase() || "";
    }

    if (valA < valB) return reservationSortDirection === "asc" ? -1 : 1;
    if (valA > valB) return reservationSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // --- Filter & Sort Kategorien ---
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

  // --- Filter & Sort Firmen ---
  const sortedCompanies = [...companies]
    .filter((c) => c.name.toLowerCase().includes(companySearch.toLowerCase()))
    .sort((a, b) => {
      if (!companySortKey) return 0;
      const valA = a[companySortKey]?.toString().toLowerCase();
      const valB = b[companySortKey]?.toString().toLowerCase();
      if (valA < valB) return companySortDirection === "asc" ? -1 : 1;
      if (valA > valB) return companySortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // --- Actions ---
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

  const handleCreateCompany = async () => {
    const name = prompt("Name der neuen Firma:", "");
    if (!name) return;
    const res = await fetch(`${API_URL}/api/companies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Erstellen.");
    setCompanies((prev) => [...prev, data]);
  };

  const handleEditCompany = async (comp) => {
    const newName = prompt("Neuer Name für die Firma:", comp.name);
    if (!newName || newName === comp.name) return;
    const res = await fetch(`${API_URL}/api/companies/${comp.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Umbenennen.");
    setCompanies((prev) => prev.map((c) => (c.id === data.id ? data : c)));
  };

  const handleDeleteCompany = async (id) => {
    if (!confirm("Firma wirklich löschen?")) return;
    const res = await fetch(`${API_URL}/api/companies/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Fehler beim Löschen.");
    setCompanies(companies.filter((c) => c.id !== id));
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

      {/* Kategorien */}
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
              <th
                onClick={() => handleCategorySort("id")}
                className={categorySortKey === "id" ? "sorted" : ""}
              >
                ID
                <span className="sort-icon">
                  {categorySortKey === "id"
                    ? categorySortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>
              <th
                onClick={() => handleCategorySort("name")}
                className={categorySortKey === "name" ? "sorted" : ""}
              >
                Name
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

      {/* Firmen */}
      <div className="adminpanel-section">
        <h3 className="adminpanel-section-title">Firmen</h3>
        <div className="tools-actions">
          <button className="tools-add-button" onClick={handleCreateCompany}>
            + Firma hinzufügen
          </button>
          <input
            type="text"
            className="tools-search"
            placeholder="Suche nach Firma..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
          />
        </div>
        <table className="tools-table">
          <thead>
            <tr>
              <th
                onClick={() => handleCompanySort("id")}
                className={companySortKey === "id" ? "sorted" : ""}
              >
                ID
                <span className="sort-icon">
                  {companySortKey === "id"
                    ? companySortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>
              <th
                onClick={() => handleCompanySort("name")}
                className={companySortKey === "name" ? "sorted" : ""}
              >
                Name
                <span className="sort-icon">
                  {companySortKey === "name"
                    ? companySortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedCompanies.map((comp) => (
              <tr key={comp.id}>
                <td>{comp.id}</td>
                <td>{comp.name}</td>
                <td>
                  <button
                    className="tools-edit-button"
                    onClick={() => handleEditCompany(comp)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="tools-delete-button"
                    onClick={() => handleDeleteCompany(comp.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alle Reservationen */}
      <div className="adminpanel-section">
        <h3 className="adminpanel-section-title">Alle Reservationen</h3>
        <input
          type="text"
          placeholder="Suche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="adminpanel-search"
        />
        <table className="tools-table">
          <thead>
            <tr>
              <th
                onClick={() => handleReservationSort("id")}
                className={reservationSortKey === "id" ? "sorted" : ""}
              >
                ID
                <span className="sort-icon">
                  {reservationSortKey === "id"
                    ? reservationSortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>

              <th
                onClick={() => handleReservationSort("username")}
                className={reservationSortKey === "username" ? "sorted" : ""}
              >
                Benutzer
                <span className="sort-icon">
                  {reservationSortKey === "username"
                    ? reservationSortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>

              <th
                onClick={() => handleReservationSort("tool_name")}
                className={reservationSortKey === "tool_name" ? "sorted" : ""}
              >
                Werkzeug
                <span className="sort-icon">
                  {reservationSortKey === "tool_name"
                    ? reservationSortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>

              <th
                onClick={() => handleReservationSort("start")}
                className={reservationSortKey === "start" ? "sorted" : ""}
              >
                Start
                <span className="sort-icon">
                  {reservationSortKey === "start"
                    ? reservationSortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>

              <th
                onClick={() => handleReservationSort("end")}
                className={reservationSortKey === "end" ? "sorted" : ""}
              >
                Ende
                <span className="sort-icon">
                  {reservationSortKey === "end"
                    ? reservationSortDirection === "asc"
                      ? "▲"
                      : "▼"
                    : "▲"}
                </span>
              </th>

              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedReservations.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.user?.username}</td>
                <td>{r.tool?.name}</td>
                <td>{r.start?.slice(0, 16).replace("T", " ")}</td>
                <td>{r.end?.slice(0, 16).replace("T", " ")}</td>
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
