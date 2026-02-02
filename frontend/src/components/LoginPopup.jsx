import { useEffect, useRef, useState } from "react";
import {
  faQuestionCircle,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../styles/LoginPopup.css";
import "../styles/Home.css";

export default function LoginPopup({
  open,
  onClose,
  loginData,
  setLoginData,
  rememberMe,
  setRememberMe,
  onLogin,
  onHelp,
}) {
  const [pwVisible, setPwVisible] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPwVisible(false);
      setTimeout(() => userRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter") onLogin?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onLogin]);

  if (!open) return null;

  return (
    <div
      className="pw-overlay login-overlay"
      onClick={(e) => {
        if (e.target.classList.contains("pw-overlay")) onClose?.();
      }}
    >
      <div className="pw-modal login-modal" role="dialog" aria-modal="true">
        <div className="login-modal-head">
          <h3>Anmelden</h3>
        </div>

        <input
          ref={userRef}
          type="text"
          placeholder="Benutzername"
          value={loginData.username}
          onChange={(e) =>
            setLoginData({ ...loginData, username: e.target.value })
          }
          autoComplete="username"
        />

        <div className="pw-field">
          <input
            type={pwVisible ? "text" : "password"}
            placeholder="Passwort"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            autoComplete="current-password"
          />
          <button
            type="button"
            className="pw-eye-btn"
            onClick={() => setPwVisible((s) => !s)}
            aria-label={pwVisible ? "Passwort verbergen" : "Passwort anzeigen"}
            title={pwVisible ? "Verbergen" : "Anzeigen"}
          >
            <FontAwesomeIcon icon={pwVisible ? faEyeSlash : faEye} />
          </button>
        </div>

        <div className="forgot-password-wrapper login-forgot">
          <span className="forgot-password-text">Passwort vergessen?</span>
          <div className="forgot-password-tooltip">
            Melden Sie sich beim Systemadministrator, um Ihr Passwort
            zurückzusetzen.
          </div>
        </div>

        <label className="remember-me login-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
          />
          Login merken
        </label>

        <div className="pw-buttons login-buttons">
          <button className="pw-save-btn" type="button" onClick={onLogin}>
            Login
          </button>

          <button className="pw-cancel-btn" type="button" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
