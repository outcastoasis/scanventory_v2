# Scanventory – Werkzeugreservierung per QR-Code

**Scanventory** ist ein webbasiertes Tool zur Verwaltung und Ausleihe von Werkzeugen mittels QR-Codes. Es besteht aus einem React-Frontend und einem Flask-Backend mit SQLite-Datenbank.

---

## 📆 Aktueller Stand (September 2025)

* QR-Scan per Tastaturemulation (User, Werkzeug, Dauer)
* Werkzeugreservierungen mit Start-/Endzeitpunkt (UTC)
* Rückgabe per QR-Scan oder Login
* Kalenderansicht mit allen Einträgen (offentlich sichtbar)
* Login-System mit JWT-Token
* Rollenbasiertes Berechtigungssystem: `guest`, `user`, `supervisor`, `admin`
* Adminmenü mit Dropdown (Werkzeuge, Benutzer, Rechte, Reservation)
* Rechte-Logik vollständig datenbankgesteuert
* Rückgabe auch ohne Login möglich
* `.env`-basierte Konfiguration im Backend

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
SECRET_KEY=admin1234 #für jwt Token
ADMIN_USERNAME=admin #wird beim start erstellt, wenn nicht vorhanden
ADMIN_PASSWORD=admin123
ADMIN_QR=usr0001

```

Starten:

```bash
python app.py
```

### 🔹 Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

---

## 🚧 Phasenplan

### ✅ Phase 1: Grundgerüst

* [x] Vite + Flask Grundgerüst
* [x] API-Endpunkte `/ping`, `/api/reservations`, etc.
* [x] ScannerHandler mit globalem Keybuffer
* [x] QR-Scan-Logik implementiert

### ✅ Phase 2: Datenmodelle & Auth

* [x] Modelle für User, Tool, Reservation, Rollen & Rechte
* [x] SQLite-DB mit SQLAlchemy
* [x] JWT-Login (Token-Handling)
* [x] Rollenmodell + Rechteprüfung via Middleware

### ✅ Phase 3: Ausleihe per Scanner

* [x] Reservationen via QR-Scan (usr + tool + dur)
* [x] Rückgabe per "return" + Werkzeugcode
* [x] Rückgabe auch ohne Login
* [x] Kalenderansicht mit allen Einträgen (offentlich)

### ⏳ Phase 4: Kalender & Anzeige

* [x] Monats-/Wochenansicht mit Reservationen
* [ ] PopUps für Bearbeiten (eigene + adminfähig)
* [ ] Farbcodierung, Anzeige nach Rollen

### 🔲 Phase 5: Adminbereich

* [x] Admin-Menü als Icon-Dropdown (⚙️)
* [ ] Benutzerverwaltung UI (/users)
* [ ] Werkzeugverwaltung UI (/tools)
* [ ] Rechteverwaltung UI (/admin-tools)
* [ ] QR-Code-Export über Webinterface als PNG/ZIP

### ✅ Features in Arbeit

* [ ] Manuelle Reservation per UI (statt QR)
* [ ] Bearbeitungsfunktion für eigene Einträge
* [ ] UI für Admin-Funktionen (`/users`, `/tools`, `/admin-tools`)
* [ ] Logging von Aktionen (auditierbar)
* [ ] Sondercodes wie reload, cancel, return
* [ ] QR-Code-Export über Webinterface als PNG/ZIP

### 🔲 Zusatzfunktionen

* Offline-Hilfe implementieren

---

## 📄 Lizenz

MIT oder eigene Lizenz nach Bedarf
