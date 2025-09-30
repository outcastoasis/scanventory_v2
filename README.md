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

## 🚀 Projektstatus & Phasenplan

### ✅ Phase 1: Grundstruktur

* [x] Vite + Flask Grundgerüst
* [x] API-Endpunkte `/ping`, `/api/reservations`, etc.
* [x] ScannerHandler mit globalem Keybuffer

### ✅ Phase 2: Datenmodell & Auth

* [x] Modelle für User, Tool, Reservation, Rollen & Rechte
* [x] SQLite-DB mit SQLAlchemy
* [x] JWT-Login (Token-Handling)
* [x] Rollenmodell + Rechteprüfung via Middleware

### ✅ Phase 3: Scannerfunktionen & Rückgabe

* [x] Reservationen via QR-Scan (usr + tool + dur)
* [x] Rückgabe per "return" + Werkzeugcode
* [x] Rückgabe auch ohne Login
* [x] Kalenderansicht mit allen Einträgen (offentlich)

### ⏳ Phase 4: Adminbereich & UI-Erweiterung

* [x] Admin-Menü als Icon-Dropdown (⚙️)
* [ ] Benutzerverwaltung UI (/users)
* [ ] Werkzeugverwaltung UI (/tools)
* [ ] Rechteverwaltung UI (/admin-tools)

### ☑️ Phase 5: Erweiterte Funktionen (geplant)

* Automatische Rückgaben via Scheduler
* Filter nach Kategorien (Elektro, Handwerk etc.)
* CSV-Import/Export für Benutzer & Werkzeuge
* QR-Code-Export über Webinterface

---

## ✅ Features in Arbeit

* [ ] Manuelle Reservation per UI (statt QR)
* [ ] Bearbeitungsfunktion für eigene Einträge
* [ ] UI für Admin-Funktionen (`/users`, `/tools`, `/admin-tools`)
* [ ] Logging von Aktionen (auditierbar)

---

## 📄 Lizenz

MIT oder eigene Lizenz nach Bedarf
