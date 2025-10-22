# Scanventory – Werkzeugreservierung per QR-Code

**Scanventory** ist ein webbasiertes Tool zur Verwaltung und Ausleihe von Werkzeugen mittels QR-Codes. Es besteht aus einem React-Frontend und einem Flask-Backend mit SQLite-Datenbank.

---

## 📆 Aktueller Stand (Oktober 2025)

- QR-Scan per Tastaturemulation (User, Werkzeug, Dauer) -> Bei aktuellen oder in Zukunft vorhandenen Reservationen = Fail
- Werkzeugreservierungen mit Start-/Endzeitpunkt (UTC)
- Rückgabe per QR-Scan oder Login
- Kalenderansicht mit allen Einträgen (öffentlich sichtbar)
- Login-System mit JWT-Token
- Rollenbasiertes Berechtigungssystem: `guest`, `user`, `supervisor`, `admin`
- Adminmenü mit Dropdown (Werkzeuge, Benutzer, Rechte, Reservation)
- Manuelle Reservation per Button auf Startseite nach Login
- Rechte-Logik vollständig datenbankgesteuert
- Rückgabe auch ohne Login möglich

### **Benutzerverwaltung im Adminbereich**

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

### **Werkzeugverwaltung im Adminbereich**

- Werkzeugliste mit Filter & Sortierfunktion
- Erstellen, Bearbeiten, Löschen von Werkzeugen
- Visuelle Sortieranzeige (▲▼)
- QR-ID-Vergabe mit nächster freier `tool000X`-ID
- Zugriff nur mit `manage_tools = true`
- Anzeige von:
  - ID
  - Name
  - QR-Code
  - Kategorie
  - Status
  - Erstellungsdatum

### **Rechteverwaltung im Adminbereich**

- Rechteliste mit Filter & Sortierfunktion
- Erstellen, Bearbeiten, Löschen von Rechten
- Visuelle Sortieranzeige (▲▼)
- QR-ID-Vergabe mit nächster freier `permission000X`-ID
- Zugriff nur mit `manage_permission = true`
- Anzeige von:
  - ID
  - Permission-Key
  - admin
  - guest
  - supervisor
  - user

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

#### ⚙️ .env Struktur im Frontend

```ini
# frontend/.env
VITE_API_URL=http://localhost:5050
# VITE_API_URL=http://server-scanventory (wenn auf RPI installiert -> Hostname von Server-RPI)
```

Diese Variable wird benötigt, damit alle API-Calls (z.B. `/api/users`) an das Backend weitergeleitet werden. Ohne diese Konfiguration funktionieren keine Admin-Funktionen.

---

### 🔹 Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

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
- [x] Farbcodierung, Anzeige nach Aktiven oder Vergangenen Einträgen

### ✅ Phase 5: Adminbereich

- [x] Admin-Menü als Icon-Dropdown (⚙️)
- [x] Benutzerverwaltung UI (`/users`)
- [x] Werkzeugverwaltung UI (`/tools`)
- [x] Rechteverwaltung UI (`/permissions`)
- [x] QR-Code-Exportfunktion in `/users`
  - Einzel-QR als PNG (inkl. Vorschau)
  - Massenexport (ZIP mit mehreren PNGs)
  - Dynamisches Canvas mit weißem Hintergrund, Textausrichtung und Schriftanpassung

---

## ✅ Weitere Features in Arbeit

- [x] `export_data` und `export_qr_codes` müssen in Exportlogik integriert werden (Berechtigungsprüfung)
- [x] Entfernen der Bearbeitungsfunktion einzelner Permission-Keys (nicht sinnvoll)
- [/] Admin-Panel für: (Teilweise umgesetzt, zurzeit noch in Testphase von Jascha)
  - [x] Kategorienpflege bei Werkzeugen
  - [x] Firmenpflege bei Benutzern (nicht hardcoded)
  - [x] Firmenpflege fehlt noch sortierfunktion mit Pfeilen
  - [-] Anzeige und Download von QR Codes wie: cancel, reload
  - [x] alle Reservationen auflisten, sortierbar und Suchbar machen (Wie bei Userliste/Toolliste) und löschen per Button
  - [ ] Nur eine gewisse Anzahl reservationen auflisten (zB 10 Einträge und dann auf nächste Seite) und Suchfunktion einbauen.
  - [-] Fehler Logs einbauen und hier auflisten
- [x] Darstellung von Reservationen auf der Startseite als: `Start – Ende | Werkzeug – Nachname Vorname`
- [x] Kalenderhöhe dynamisch anpassen je nach Eintragsanzahl pro Tag
- [x] Klickbare Reservationen für alle sichtbar, Bearbeitung nur wenn berechtigt (`edit_reservations: true` oder `self_only`)
- [x] Seite zur manuellen Reservation für eingeloggte Benutzer (`create_reservations = self_only/true`)
- [ ] Import von CSV für Benutzer und Werkzeuglisten mit automatischer QR Code ID vergabe (Vorhandene Überspringen)
- [x] Rückgabe-QR-Code (`return`) auf Startseite anzeigen
- [x] QR-Code für Dauerwahl (`dur1`, `dur2`, `dur3`) nach erfolgreichem Scan von `usrXXXX` und `toolXXXX` anzeigen

---

## 🧠 Weitere geplante Verbesserungen

- [x] Wenn Tool zuerst gescannt, info der aktuellen Reservation und des werkzeuges anzeigen
- [x] Offline-Hilfe für Admins und Nutzer (Teilweise umgesetzt, Adminhilfe noch ausstehend)
  - [x] Anleitung für Werkzeug reservieren und Rückgabe
  - [x] Übersicht der Rollen
- [x] Automatischer Reset von `is_borrowed` per Scheduler im Backend
- [x] Automatisches Polling der Kalenderdaten alle 30 Sekunden (Live-Update bei Scannerverwendung)
- [x] Reservation bearbeiten endzeit abfangen, um keine negativen Einträge zu verursachen (Nicht erlaubt dass endzeit vor startzeit reserviert werden kann)
- [ ] Notizen für reservationen fixen -> werden aktuell nicht gespeichert
- [ ] create_reservations Rechte in manuelle reservation einbauen
- [x] view_all_reservations und export_data entfernen
- [x] Return Funktion sollte nach einiger Zeit (zB 15 Sekunden) wieder abgebrochen werden.

## 🧠 Quality of Life

- [x] bessere visuelle bestätigung bei reservationen per Scanner (zB Scan Status Feld grün aufleuchten lassen kurz)
- [x] Eigene Komponente für System-Statusmeldungen (z.B. Fehler, Erfolg-popup)
- [x] Rückgabe QR Code auf Startseite benennen/beschreiben/Titel hinzufügen
- [x] Responsivness verbessern von aktueller Seite (Hochformat priorisieren)
- [x] Kalendersprache auf Deutsch stellen (October, Wed, 7:57 PM, etc)
- [x] Heute Reserviert Liste unterhalb vom Kalender

---

## 📄 Lizenz

MIT oder eigene Lizenz nach Bedarf
