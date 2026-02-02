// components/AdminDropdown.jsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCog,
  faTools,
  faUser,
  faKey,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import "../styles/AdminDropdown.css";

export default function AdminDropdown({ permissions = {} }) {
  const navigate = useNavigate();

  const hasAnyPermission =
    permissions.manage_users === "true" ||
    permissions.manage_tools === "true" ||
    permissions.access_admin_panel === "true";

  if (!hasAnyPermission) return null;

  return (
    <div className="home-menu-wrapper">
      <button className="home-toggle">
        <FontAwesomeIcon icon={faCog} />
      </button>

      <div className="home-dropdown">
        {permissions.manage_tools === "true" && (
          <button onClick={() => navigate("/tools")}>
            <FontAwesomeIcon icon={faTools} /> Werkzeuge
          </button>
        )}
        {permissions.manage_users === "true" && (
          <button onClick={() => navigate("/users")}>
            <FontAwesomeIcon icon={faUser} /> Benutzer
          </button>
        )}
        {permissions.access_admin_panel === "true" && (
          <>
            <button onClick={() => navigate("/permissions")}>
              <FontAwesomeIcon icon={faKey} /> Rechte
            </button>
            <button onClick={() => navigate("/admin-panel")}>
              <FontAwesomeIcon icon={faWrench} /> Admin-Panel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
