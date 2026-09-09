# Mehrbenutzer-Modus einrichten (Login & Cloud-Sync)

Standardmäßig läuft das Cockpit **lokal** – jede Person hat ihr Depot nur im
eigenen Browser. Für **mehrere Nutzer mit eigenem, geräteübergreifend
synchronisiertem Depot** aktivierst du den Login über **Supabase** (kostenlos).

Empfehlung für einen Freundeskreis: **Magic-Link** (Anmeldung per E-Mail-Link,
kein Passwort) und optional **Google**. E-Mail/Passwort ist ebenfalls eingebaut.

## Schritt 1 – Supabase-Projekt anlegen
1. Auf <https://supabase.com> kostenlos registrieren und ein neues Projekt anlegen.
2. Unter **Project Settings → API** findest du:
   - **Project URL** (z. B. `https://xxxx.supabase.co`)
   - **anon public**-Key

## Schritt 2 – Zugangsdaten eintragen
In `js/config.js` eintragen:

```js
window.COCKPIT_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ... (anon public key)",
};
```

Sobald hier Werte stehen, verlangt das Cockpit beim Start einen Login.
Der `anon`-Key ist für den Browser gedacht und darf veröffentlicht werden –
die Datensicherheit kommt über **Row Level Security** (Schritt 3).

## Schritt 3 – Datenbank + Sicherheit (SQL)
Im Supabase-Dashboard unter **SQL Editor** einmalig ausführen:

```sql
-- Eine Zeile pro Nutzer, gesamtes Depot als JSON
create table if not exists public.cockpit_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.cockpit_data enable row level security;

-- Jeder darf nur seine eigene Zeile lesen/schreiben
create policy "own row select" on public.cockpit_data
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.cockpit_data
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.cockpit_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Schritt 4 – Login-Methoden aktivieren
Im Supabase-Dashboard unter **Authentication → Providers**:
- **Email** aktivieren (für Magic-Link und E-Mail/Passwort).
  - Magic-Link funktioniert ohne weitere Einstellung.
  - Für Passwort-Login ggf. „Confirm email" nach Wunsch an/aus.
- **Google** (optional): aktivieren und Google-OAuth-Client hinterlegen
  (Anleitung: Supabase-Doku „Login with Google").

Unter **Authentication → URL Configuration** die Adresse eintragen, unter der
das Cockpit läuft (z. B. deine Hosting-URL oder `http://localhost:5173`),
damit die Magic-Link-/OAuth-Weiterleitung funktioniert.

## Schritt 5 – Hosting
Da Login-Weiterleitungen (Magic-Link, Google) eine echte URL brauchen, sollte
die Seite gehostet sein (z. B. **Netlify**, **Vercel** oder **GitHub Pages** –
es sind nur statische Dateien, kein Server nötig). Lokales Öffnen per Datei
(`file://`) funktioniert für den Login **nicht** zuverlässig.

Zum lokalen Testen genügt ein einfacher Webserver, z. B.:
```bash
npx serve .
# oder
python3 -m http.server 5173
```

## Hinweise
- **Live-Börsendaten (Finnhub)** und der Mehrbenutzer-Login sind unabhängig
  voneinander – beides kann gleichzeitig genutzt werden.
- Jeder Nutzer trägt seinen eigenen Finnhub-Key in den Einstellungen ein
  (wird pro Nutzer in der Cloud gespeichert).
- Zum Zurückschalten auf den lokalen Modus einfach die Werte in
  `js/config.js` wieder leeren.
