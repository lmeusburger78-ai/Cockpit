/* ============================================================
   auth.js – Login & Nutzerverwaltung (Supabase)
   Aktiv nur, wenn in config.js Supabase-Zugangsdaten hinterlegt sind.
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";
  const { el, $ } = C;

  const cfg = window.COCKPIT_CONFIG || {};
  let client = null;

  C.auth = {
    /** Mehrbenutzer-Modus aktiv? */
    enabled() {
      return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
    },

    client() {
      if (!client && this.enabled()) {
        client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      }
      return client;
    },

    async getUser() {
      const c = this.client();
      if (!c) return null;
      const { data } = await c.auth.getSession();
      return data && data.session ? data.session.user : null;
    },

    onChange(cb) {
      const c = this.client();
      if (c) c.auth.onAuthStateChange((_e, session) => cb(session ? session.user : null));
    },

    // --- Anmeldungen ---
    signInPassword(email, pw) { return this.client().auth.signInWithPassword({ email, password: pw }); },
    signUp(email, pw) { return this.client().auth.signUp({ email, password: pw, options: { emailRedirectTo: location.href.split("#")[0] } }); },
    magicLink(email) { return this.client().auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } }); },
    google() { return this.client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } }); },
    signOut() { return this.client().auth.signOut(); },

    // --- Cloud-Datenspeicher (eine JSONB-Zeile pro Nutzer) ---
    async loadData(userId) {
      const { data, error } = await this.client()
        .from("cockpit_data").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    },
    async saveData(userId, store) {
      const { error } = await this.client()
        .from("cockpit_data")
        .upsert({ user_id: userId, data: store, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
  };

  /* ---------------- Login-Screen ---------------- */
  let loginMode = "magic"; // "magic" | "google" | "password"

  C.showLogin = function () {
    $(".app").hidden = true;
    const scr = $("#login-screen");
    scr.hidden = false;
    scr.innerHTML = "";
    scr.appendChild(loginCard());
  };

  C.hideLogin = function () {
    $("#login-screen").hidden = true;
    $(".app").hidden = false;
  };

  function loginCard() {
    const emailIn = el("input", { type: "email", id: "login-email", placeholder: "du@beispiel.at", autocomplete: "email" });
    const pwIn = el("input", { type: "password", id: "login-pw", placeholder: "Passwort", autocomplete: "current-password" });
    const msg = el("div", { class: "login-msg", hidden: "hidden" });

    const show = (text, ok) => { msg.hidden = false; msg.textContent = text; msg.className = "login-msg " + (ok ? "ok" : "err"); };

    // Tabs
    const tabs = el("div", { class: "seg", style: "width:100%;justify-content:center;margin-bottom:18px;" }, [
      tab("Magic-Link", "magic"), tab("Google", "google"), tab("Passwort", "password"),
    ]);
    function tab(label, mode) {
      return el("button", { class: loginMode === mode ? "active" : "", type: "button",
        onclick: () => { loginMode = mode; renderBody(); C.$$(".login-card .seg button").forEach((b) => b.classList.toggle("active", b.textContent === label)); } }, label);
    }

    const bodyHost = el("div", { class: "login-body" });

    function renderBody() {
      bodyHost.innerHTML = "";
      if (loginMode === "magic") {
        bodyHost.appendChild(el("label", { class: "field" }, ["E-Mail", emailIn]));
        bodyHost.appendChild(el("button", { class: "btn block", type: "button", style: "margin-top:12px;", onclick: async () => {
          if (!emailIn.value) return show("Bitte E-Mail eingeben.", false);
          show("Sende Link …", true);
          try { await C.auth.magicLink(emailIn.value.trim()); show("Link gesendet! Bitte E-Mail-Postfach prüfen und auf den Link klicken.", true); }
          catch (e) { show("Fehler: " + e.message, false); }
        } }, "Anmelde-Link senden"));
        bodyHost.appendChild(el("p", { class: "hint", text: "Du bekommst einen Link per E-Mail – kein Passwort nötig." }));
      } else if (loginMode === "google") {
        bodyHost.appendChild(el("button", { class: "btn block", type: "button", onclick: async () => {
          show("Weiterleitung zu Google …", true);
          try { await C.auth.google(); } catch (e) { show("Fehler: " + e.message, false); }
        } }, "Mit Google anmelden"));
        bodyHost.appendChild(el("p", { class: "hint", text: "Anmeldung mit deinem Google-Konto (muss in Supabase aktiviert sein)." }));
      } else {
        bodyHost.appendChild(el("label", { class: "field" }, ["E-Mail", emailIn]));
        bodyHost.appendChild(el("label", { class: "field", style: "margin-top:10px;" }, ["Passwort", pwIn]));
        const row = el("div", { style: "display:flex;gap:10px;margin-top:14px;" }, [
          el("button", { class: "btn block", type: "button", onclick: async () => {
            show("Anmelden …", true);
            try { const { error } = await C.auth.signInPassword(emailIn.value.trim(), pwIn.value); if (error) throw error; }
            catch (e) { show("Fehler: " + e.message, false); }
          } }, "Anmelden"),
          el("button", { class: "btn ghost block", type: "button", onclick: async () => {
            show("Konto anlegen …", true);
            try { const { error } = await C.auth.signUp(emailIn.value.trim(), pwIn.value); if (error) throw error;
              show("Konto angelegt. Falls E-Mail-Bestätigung aktiv ist, bitte Postfach prüfen.", true); }
            catch (e) { show("Fehler: " + e.message, false); }
          } }, "Registrieren"),
        ]);
        bodyHost.appendChild(row);
      }
    }
    renderBody();

    return el("div", { class: "login-card" }, [
      el("div", { class: "login-brand" }, [
        el("div", { class: "brand-mark", text: "◈" }),
        el("div", {}, [el("strong", { text: "Cockpit" }), el("div", { class: "sym-name", text: "Dein Portfolio – überall synchron" })]),
      ]),
      tabs, bodyHost, msg,
    ]);
  }
})(window.Cockpit);
