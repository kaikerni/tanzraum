"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Zustand = "laedt" | "nicht_unterstuetzt" | "ios_installieren" | "aus" | "an" | "blockiert";

function schluesselBytes(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64url(puffer: ArrayBuffer | null) {
  if (!puffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(puffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Push-Benachrichtigungen fuer neue Chatnachrichten auf diesem Geraet an-/ausschalten.
export function PushSchalter() {
  const [zustand, setZustand] = useState<Zustand>("laedt");
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installiert = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setZustand(ios && !installiert ? "ios_installieren" : "nicht_unterstuetzt");
      }
      if (Notification.permission === "denied") return setZustand("blockiert");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const abo = await reg?.pushManager.getSubscription();
      setZustand(abo ? "an" : "aus");
    })().catch(() => setZustand("nicht_unterstuetzt"));
  }, []);

  async function einschalten() {
    setFehler(null);
    try {
      const erlaubnis = await Notification.requestPermission();
      if (erlaubnis !== "granted") return setZustand(erlaubnis === "denied" ? "blockiert" : "aus");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const antwort = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-push`);
      const { publicKey } = await antwort.json();
      if (!publicKey) throw new Error("Push ist auf dem Server noch nicht eingerichtet.");
      const alt = await reg.pushManager.getSubscription();
      if (alt) await alt.unsubscribe();
      const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(publicKey) });
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Bitte neu anmelden.");
      await supabase.from("push_subscriptions").delete().eq("endpoint", abo.endpoint);
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        endpoint: abo.endpoint,
        p256dh: b64url(abo.getKey("p256dh")),
        auth: b64url(abo.getKey("auth")),
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (error) {
        await abo.unsubscribe();
        // RLS: Kinderkonten unter 16 nur mit Einwilligung der Eltern (Datenbank prueft)
        throw new Error(
          error.code === "42501"
            ? "Push-Benachrichtigungen gibt es für Kinderkonten unter 16 nur mit Einwilligung deiner Eltern."
            : "Das Gerät konnte nicht gespeichert werden.",
        );
      }
      setZustand("an");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Push konnte nicht aktiviert werden.");
    }
  }

  async function ausschalten() {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const abo = await reg?.pushManager.getSubscription();
    if (abo) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", abo.endpoint);
      await abo.unsubscribe();
    }
    setZustand("aus");
  }

  if (zustand === "laedt" || zustand === "nicht_unterstuetzt") return null;

  const hinweis =
    zustand === "ios_installieren"
      ? "Auf dem iPhone: Teilen → „Zum Home-Bildschirm“, dann TanzRaum von dort öffnen, um Benachrichtigungen zu erhalten."
      : zustand === "blockiert"
        ? "Benachrichtigungen sind im Browser blockiert. Du kannst sie in den Website-Einstellungen wieder erlauben."
        : null;

  return (
    <div className="mx-4 mb-3">
      {hinweis ? (
        <p className="flex gap-2 rounded-xl bg-brand-bg px-3 py-2 text-[12px] text-brand-ink-soft">
          <Bell size={15} className="mt-0.5 shrink-0" />
          {hinweis}
        </p>
      ) : zustand === "aus" ? (
        <button
          type="button"
          onClick={einschalten}
          className="flex min-h-10 w-full items-center gap-2 rounded-xl bg-brand-blue-wash px-3 text-left text-[12.5px] font-semibold text-brand-blue"
        >
          <BellRing size={16} /> Messenger-Benachrichtigungen auf diesem Gerät aktivieren
        </button>
      ) : (
        <button type="button" onClick={ausschalten} className="flex min-h-9 items-center gap-1.5 text-[12px] text-brand-ink-faint hover:text-brand-ink">
          <Bell size={14} /> Messenger-Benachrichtigungen an · auf diesem Gerät ausschalten
        </button>
      )}
      {fehler && <p className="form-error mt-2">{fehler}</p>}
    </div>
  );
}
