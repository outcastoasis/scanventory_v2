# Scanventory – Werkzeugreservierung per QR-Code

**Scanventory** ist ein webbasiertes Tool zur Verwaltung und Ausleihe von Werkzeugen mittels QR-Codes. Es besteht aus einem React-Frontend und einem Flask-Backend mit SQLite-Datenbank.

---

## 📆 Aktueller Stand (Oktober 2025)

- QR-Scan per Tastaturemulation (User, Werkzeug, Dauer)
- Werkzeugreservierungen mit Start-/Endzeitpunkt (UTC)
- Rückgabe per QR-Scan oder Login
- Kalenderansicht mit allen Einträgen (öffentlich sichtbar)
- Login-System mit JWT-Token
- Rollenbasiertes Berechtigungssystem: `guest`, `user`, `supervisor`, `admin`
- Adminmenü mit Dropdown (Werkzeuge, Benutzer, Rechte, Reservation)
- Rechte-Logik vollständig datenbankgesteuert
- Rückgabe auch ohne Login möglich
- **Benutzerverwaltung im Adminbereich:**
  - Benutzerliste mit Filter & Sortierfunktion
  - Erstellen, Bearbeiten, Löschen von Benutzern
  - Visuelle Sortieranzeige (▲▼)
  - QR-ID-Vergabe mit nächster freier `usr000X`-ID
  - Zugriff nur mit `manage_users = true`
  - Anzeige von:
    - Benutzername
    - Vorname, Nachname
    - Firma (Dropdown-Auswahl: Administration, RTS, RSS, RTC, PZM)
    - Rolle & Erstellungsdatum
- `.env`-basierte Konfiguration im Backend **und im Frontend**

---

## 🔧 Setup

### 🔹 Backend (Flask + SQLite)

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

#### ⚙️ .env Struktur im Backend (Beispiel)

```ini
# backend/.env
SECRET_KEY=admin1234

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_QR=usr0001

SUPERVISOR_USERNAME=supervisor
SUPERVISOR_PASSWORD=supervisor123
SUPERVISOR_QR=usr0002

TESTUSER_USERNAME=testuser
TESTUSER_PASSWORD=testuser123
TESTUSER_QR=usr0003
```

Starten:

```bash
python app.py
```

---

#### ⚙️ .env Struktur im Frontend (neu erforderlich)

```ini
# frontend/.env
VITE_API_URL=http://localhost:5050
```

Diese Variable wird benötigt, damit alle API-Calls (z. B. `/api/users`) an das Backend weitergeleitet werden. Ohne diese Konfiguration funktionieren keine Admin-Funktionen.

### 🔹 Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

---

## 🚧 Phasenplan

### ✅ Phase 1: Grundgerüst

- [x] Vite + Flask Grundgerüst
- [x] API-Endpunkte `/ping`, `/api/reservations`, etc.
- [x] ScannerHandler mit globalem Keybuffer
- [x] QR-Scan-Logik implementiert

### ✅ Phase 2: Datenmodelle & Auth

- [x] Modelle für User, Tool, Reservation, Rollen & Rechte
- [x] SQLite-DB mit SQLAlchemy
- [x] JWT-Login (Token-Handling)
- [x] Rollenmodell + Rechteprüfung via Middleware

### ✅ Phase 3: Ausleihe per Scanner

- [x] Reservationen via QR-Scan (usr + tool + dur)
- [x] Rückgabe per "return" + Werkzeugcode
- [x] Rückgabe auch ohne Login
- [x] Kalenderansicht mit allen Einträgen (öffentlich)

### ✅ Phase 4: Kalender & Anzeige

- [x] Monats-/Wochenansicht mit Reservationen
- [x] PopUps für Bearbeiten (eigene + adminfähig)
- [x] Farbcodierung, Anzeige nach Rollen

### ✅ Phase 5: Adminbereich

- [x] Admin-Menü als Icon-Dropdown (⚙️)
- [x] Benutzerverwaltung UI (`/users`)
  - Suche über alle Spalten
  - Sortierbare Spalten mit Icons (▲▼)
  - QR-ID-Vergabe automatisch (`usr000X`)
  - Modal-Fenster für neue Benutzer
  - Admin kann sich nicht selbst löschen
- [x] QR-Code-Exportfunktion in /users
  - Einzel-QR als PNG (inkl. Vorschau)
  - Massenexport (ZIP mit mehreren PNGs)
  - Dynamisches Canvas mit weißem Hintergrund, Textausrichtung und Schriftanpassung
- [ ] Werkzeugverwaltung UI (`/tools`)
- [ ] Rechteverwaltung UI (`/admin-tools`)

---

## ✅ Weitere Features in Arbeit

- [ ] Manuelle Reservation per UI (statt QR)
- [ ] Bearbeitungsfunktion für eigene Einträge
- [ ] Logging von Aktionen (auditierbar)
- [ ] Sondercodes wie reload, cancel, return
- [ ] CSV-/QR-Code-Export für Werkzeuge

---

## 🔲 Zusatzfunktionen

- Offline-Hilfe für Admins und Nutzer
- Tool-Kategorien & Einschränkungen nach Rollen (geplant)

---

## 📄 Lizenz

MIT oder eigene Lizenz nach Bedarf
