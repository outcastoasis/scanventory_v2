import "./../styles/Help.css";

export default function Help() {
  return (
    <div className="help-page">
      <header className="help-header">
        <h1>Scanventory – Benutzeranleitung</h1>
        <button
          className="help-download-button"
          onClick={() => window.print()}
          title="Als PDF speichern"
        >
          Seite drucken
        </button>
        <button
          className="help-back-button"
          onClick={() => (window.location.href = "/")}
          aria-label="Zurück zur Startseite"
          title="Zurück zur Startseite"
        >
          ← Zurück zur Startseite
        </button>
      </header>

      <main className="help-content">
        <section>
          <h2>Überblick</h2>
          <p>
            Scanventory ist ein webbasiertes Werkzeugverwaltungssystem. Es
            ermöglicht dir, Werkzeuge zu reservieren, auszugeben und
            zurückzugeben – per Weboberfläche oder QR-Code-Scan. Alle Benutzer
            sehen jederzeit den Kalender, in dem alle Reservierungen sichtbar
            sind.
          </p>
        </section>

        <section>
          <h2>Werkzeuge Reservieren</h2>
          <p>
            Reservierungen können über den QR-Code Scan oder über die
            Weboberfläche erfolgen
          </p>
          <br></br>

          <h4>Mit QR-Code</h4>
          <ol>
            <li>Scanne den QR-Code für deinen User</li>
            <li>
              Scanne den QR-Code des Werkzeuges, welches du ausleihen willst
            </li>
            <li>
              Scanne den QR-Code für die Dauer (erscheinen nach Schritt 2 auf
              dem Display)
            </li>
            <li>Reservation abgeschlossen</li>
          </ol>
          <br></br>

          <h4>Mit WEB-Oberfläche</h4>
          <ol>
            <li>
              Rufe folgende Adresse in deinem Webbrowser auf:
              http://localhost:5173/
            </li>
            <li>Melde dich mit deinem Login an</li>
            <li>Gehe auf «+ Manuelle Reservation»</li>
            <li>Wähle die Start- und Endzeit aus und suche nach Werkzeugen</li>
            <p>
              Beachte: Es werden dir nur Werkzeuge angezeigt, welche in dem
              gewählten Zeitraum verfügbar sind
            </p>
            <li>
              Wähle die Werkzeuge aus welche du reservieren möchtest und klicke
              auf «Ausgewählte reservieren»
            </li>
            <li>Reservation abgeschlossen</li>
          </ol>
        </section>

        <section>
          <h2>Reservierungen bearbeiten</h2>
          <p>Beachte: du kannst nur deine eigenen Einträge bearbeiten</p>
          <ol>
            <li>
              Rufe folgende Adresse in deinem Webbrowser auf:
              http://localhost:5173/
            </li>
            <li>Melde dich mit deinem Login an</li>
            <li>
              Wähle im Kalender den Eintrag aus welchen du bearbeiten willst
            </li>
            <li>Ändere die Ausleihdauer und füge optional eine Notiz ein</li>
            <li>Speichere deine Änderungen</li>
            <li>Bearbeitung abgeschlossen</li>
          </ol>
        </section>

        <section>
          <h2>Werkzeug zurückgeben</h2>
          <p>
            Die Rückgabe erfolgt ausschliesslich über den QR-Code Scan. Somit
            müssen die Werkzeuge zurück in die Werkstatt gebracht werden.
          </p>
          <ol>
            <li>Scanne den QR-Code für die Rückgabe</li>
            <li>Scanne das Werkzeug, welches du zurückgeben möchtest</li>
            <li>Rückgabe abgeschlossen</li>
          </ol>
        </section>

        {/* Rollen & Rechte */}
        <section>
          <h2>Übersicht zu Berechtigungen und Kalenderansicht</h2>
          <p>
            Grundprinzip: Alle sehen alles – aber nur bestimmte Rollen dürfen
            etwas ändern.
          </p>
          <br></br>
          <h4>Rollen und Rechte</h4>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Rollen mit Beschreibung und Zugriffsrechten
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rolle</th>
                  <th scope="col">Beschreibung</th>
                  <th scope="col">Zugriffsrechte</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Admin</th>
                  <td>Vollzugriff auf alle Funktionen</td>
                  <td>Benutzer-, Werkzeug- und Rechteverwaltung</td>
                </tr>
                <tr>
                  <th scope="row">Supervisor</th>
                  <td>Verantwortlicher für Werkzeuge</td>
                  <td>Alle Reservierungen bearbeiten, Werkzeuge verwalten</td>
                </tr>
                <tr>
                  <th scope="row">User</th>
                  <td>Normale Benutzer</td>
                  <td>Eigene Reservierungen erstellen/bearbeiten</td>
                </tr>
                <tr>
                  <th scope="row">Guest</th>
                  <td>Nur lesender Zugriff</td>
                  <td>Kalender anzeigen</td>
                </tr>
              </tbody>
            </table>
          </div>
          <br></br>
          <h4>Kalenderansicht</h4>
          <p>
            Die Kalenderansicht zeigt alle Reservierungen an – unabhängig vom
            Login. Jeder Benutzer kann den aktuellen Belegungsplan der Werkzeuge
            einsehen.
          </p>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Sichtbarkeit und Aktionen je Status/Rolle
              </caption>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Sichtbarkeit</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Nicht eingeloggt / QR-Scan</th>
                  <td>Alle Reservierungen sichtbar</td>
                  <td>Werkzeuge scannen, ausleihen, zurückgeben</td>
                </tr>
                <tr>
                  <th scope="row">Eingeloggt (User)</th>
                  <td>Alle sichtbar</td>
                  <td>Eigene Reservierungen erstellen/bearbeiten</td>
                </tr>
                <tr>
                  <th scope="row">Supervisor</th>
                  <td>Alle sichtbar</td>
                  <td>Alle Reservierungen bearbeiten, Werkzeuge verwalten</td>
                </tr>
                <tr>
                  <th scope="row">Admin</th>
                  <td>Alle sichtbar</td>
                  <td>Alles bearbeiten, Benutzer- &amp; Rechte verwalten</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
