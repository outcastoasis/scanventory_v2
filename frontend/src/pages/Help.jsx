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
          className="help-feedback-button"
          onClick={() =>
            (window.location.href =
              "mailto:jascha.bucher@rebsamen.net?subject=Scanventory%20Feedback")
          }
          title="Feedback senden"
        >
          Feedback
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
            Mithilfe von diesem Tool "Scanventory" kannst du Werkzeuge in der
            Werkstatt reservieren und ausleihen. Die Bedienung erfolgt entweder
            über das Scannen von QR-Codes oder über die Weboberfläche.
          </p>
          <br />
          <p>
            Beachte: Damit du per WEB-Oferfläche auf das Tool zugreifen kannst,
            musst du dich im internen Netzwerk der Rebsamen AG befinden.
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
              Rufe folgende Adresse in deinem Webbrowser auf:{" "}
              <a href="http://pizol/" target="_blank" rel="noopener noreferrer">
                http://pizol/
              </a>{" "}
              oder{" "}
              <a
                href="http://192.168.240.96/"
                target="_blank"
                rel="noopener noreferrer"
              >
                http://192.168.240.96/
              </a>
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
              Rufe folgende Adresse in deinem Webbrowser auf:{" "}
              <a href="http://pizol/" target="_blank" rel="noopener noreferrer">
                http://pizol/
              </a>{" "}
              oder{" "}
              <a
                href="http://192.168.240.96/"
                target="_blank"
                rel="noopener noreferrer"
              >
                http://192.168.240.96/
              </a>
            </li>
            <li>Melde dich mit deinem Login an</li>
            <li>
              Wähle im Kalender den Eintrag aus welchen du bearbeiten willst
            </li>
            <li>Ändere die Ausleihdauer</li>
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
      </main>
    </div>
  );
}
