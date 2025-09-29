# Scanventory – Werkzeugreservierung per QR-Code

**Scanventory** ist ein webbasiertes Tool zur Verwaltung und Ausleihe von Werkzeugen mittels QR-Codes. Es besteht aus einem React-Frontend und einem Flask-Backend mit SQLite-Datenbank.

---

## 📦 Aktueller Stand

- QR-Scan per Tastaturemulation (user, tool, duration)
- Werkzeugreservierungen mit Start-/Enddatum
- Rückgabe via "return" + Werkzeugcode
- Werkzeugstatus (verfügbar / ausgeliehen)
- Adminbereich ist geplant, aber noch nicht umgesetzt

---

## 🔧 Setup

### 🔹 Backend (Flask + SQLite)

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
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

- [x] Vite + Flask Grundstruktur
- [x] API-Server mit `/ping`
- [x] ScannerHandler mit globalem Keybuffer
- [x] QR-Scan-Logik implementiert

### ✅ Phase 2: Datenmodelle & Auth

- [x] SQLite-DB mit User, Tool, Reservation
- [ ] JWT-Auth mit Login (User + Passwort)
- [ ] Rollenmodell mit Permission-Middleware

### ⏳ Phase 3: Ausleihe per Scanner

- [x] Benutzer-, Werkzeug- und Dauer-QR
- [x] Speicherung in DB
- [x] Rückgabe per „return“ + Werkzeug-QR
- [ ] Rückgaben automatisch verwalten (zeitbasiert)

### 🔲 Phase 4–6 folgen:
> Details im Projektplan (siehe Phasenliste)

---

## ✨ To Do

- Admin Login & Rollen
- Kalenderansicht für Reservationen
- CSV-Import von Werkzeugen
- Rechteverwaltung über UI

---

## 📄 Lizenz

MIT oder eigene Lizenz nach Bedarf