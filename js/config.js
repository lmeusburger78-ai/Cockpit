/* ============================================================
   config.js – Konfiguration für den Mehrbenutzer-/Login-Modus
   ------------------------------------------------------------
   LEER lassen  -> lokaler Einzelbenutzer-Modus (Daten nur im Browser)
   AUSGEFÜLLT   -> Mehrbenutzer mit Login & Cloud-Sync über Supabase

   So aktivierst du den Mehrbenutzer-Modus (Details in SETUP.md):
   1. Kostenloses Projekt auf https://supabase.com anlegen
   2. Project URL und den "anon public"-Key hier eintragen
   3. Das SQL aus SETUP.md im Supabase SQL-Editor ausführen
   ============================================================ */
window.COCKPIT_CONFIG = {
  supabaseUrl: "",      // z. B. "https://xxxx.supabase.co"
  supabaseAnonKey: "",  // der öffentliche "anon"-Key
};
