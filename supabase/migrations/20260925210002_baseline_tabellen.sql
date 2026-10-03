-- TanzRaum – Baseline-Migration 2/12: Tabellen (inkl. Primärschlüssel, UNIQUE, CHECK) und Spaltenkommentare
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

CREATE TABLE public.abos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inhaber text NOT NULL,
    user_id uuid,
    verein_id uuid,
    tarif text NOT NULL,
    periode text NOT NULL,
    preis_cent integer DEFAULT 0 NOT NULL,
    anbieter text NOT NULL,
    anbieter_abo_id text,
    anbieter_kunde_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    laeuft_bis timestamp with time zone,
    gekuendigt_zum timestamp with time zone,
    gekuendigt_am timestamp with time zone,
    pause_grund text,
    pause_verein_id uuid,
    pausiert_am timestamp with time zone,
    reaktiviert_am timestamp with time zone,
    letzter_fehler text,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    aktualisiert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT abos_pkey PRIMARY KEY (id),
    CONSTRAINT abos_anbieter_check CHECK ((anbieter = ANY (ARRAY['stripe'::text, 'paypal'::text, 'manuell'::text]))),
    CONSTRAINT abos_check CHECK ((((inhaber = 'person'::text) AND (tarif = 'basic'::text) AND (user_id IS NOT NULL)) OR ((inhaber = 'verein'::text) AND (tarif = 'verein'::text) AND (verein_id IS NOT NULL)))),
    CONSTRAINT abos_inhaber_check CHECK ((inhaber = ANY (ARRAY['person'::text, 'verein'::text]))),
    CONSTRAINT abos_periode_check CHECK ((periode = ANY (ARRAY['monat'::text, 'jahr'::text, 'unbefristet'::text]))),
    CONSTRAINT abos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'trialing'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text, 'paused_by_organization'::text]))),
    CONSTRAINT abos_tarif_check CHECK ((tarif = ANY (ARRAY['basic'::text, 'verein'::text])))
);

CREATE TABLE public.altersklassen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sortierung integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT altersklassen_pkey PRIMARY KEY (id),
    CONSTRAINT altersklassen_name_key UNIQUE (name)
);

CREATE TABLE public.anruf_signale (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    anruf_id uuid NOT NULL,
    von uuid NOT NULL,
    an uuid NOT NULL,
    typ text NOT NULL,
    daten jsonb NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anruf_signale_pkey PRIMARY KEY (id),
    CONSTRAINT anruf_signale_typ_check CHECK ((typ = ANY (ARRAY['angebot'::text, 'antwort'::text, 'kandidat'::text])))
);

CREATE TABLE public.anrufe (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gespraech_id uuid NOT NULL,
    anrufer_id uuid NOT NULL,
    angerufener_id uuid NOT NULL,
    art text NOT NULL,
    status text DEFAULT 'klingelt'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    angenommen_am timestamp with time zone,
    beendet_am timestamp with time zone,
    CONSTRAINT anrufe_pkey PRIMARY KEY (id),
    CONSTRAINT anrufe_art_check CHECK ((art = ANY (ARRAY['audio'::text, 'video'::text]))),
    CONSTRAINT anrufe_status_check CHECK ((status = ANY (ARRAY['klingelt'::text, 'aktiv'::text, 'abgelehnt'::text, 'beendet'::text, 'verpasst'::text, 'abgebrochen'::text])))
);

CREATE TABLE public.beitraege (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    beitragstyp_id uuid,
    beitragstyp_name text NOT NULL,
    betrag numeric(10,2) DEFAULT 0 NOT NULL,
    faellig date,
    bezahlt boolean DEFAULT false NOT NULL,
    bezahlt_am date,
    iban text,
    zahlungsweg text DEFAULT 'Überweisung'::text NOT NULL,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beitraege_pkey PRIMARY KEY (id)
);

CREATE TABLE public.beitragstypen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    name text NOT NULL,
    betrag numeric(10,2) DEFAULT 0 NOT NULL,
    faellig date,
    rhythmus text DEFAULT 'jährlich'::text NOT NULL,
    zielgruppe text DEFAULT 'alle'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beitragstypen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.beitritts_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    user_id uuid NOT NULL,
    gewuenschte_rolle text DEFAULT 'Tänzer/in'::text NOT NULL,
    status text DEFAULT 'neu'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    entschieden_am timestamp with time zone,
    CONSTRAINT beitritts_anfragen_pkey PRIMARY KEY (id),
    CONSTRAINT beitritts_anfragen_verein_id_user_id_key UNIQUE (verein_id, user_id),
    CONSTRAINT beitritts_anfragen_status_check CHECK ((status = ANY (ARRAY['neu'::text, 'angenommen'::text, 'abgelehnt'::text])))
);

CREATE TABLE public.benachrichtigungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    typ text NOT NULL,
    text text NOT NULL,
    gelesen boolean DEFAULT false NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT benachrichtigungen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.blockierungen (
    blocker_id uuid NOT NULL,
    blockiert_id uuid NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blockierungen_pkey PRIMARY KEY (blocker_id, blockiert_id),
    CONSTRAINT blockierungen_check CHECK ((blocker_id <> blockiert_id))
);

CREATE TABLE public.chat_stumm (
    gespraech_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT chat_stumm_pkey PRIMARY KEY (gespraech_id, user_id)
);

CREATE TABLE public.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    connected_to uuid,
    status text DEFAULT 'pending'::text,
    beantwortet_am timestamp with time zone,
    art text DEFAULT 'kontakt'::text NOT NULL,
    CONSTRAINT connections_pkey PRIMARY KEY (id),
    CONSTRAINT connections_art CHECK ((art = ANY (ARRAY['kontakt'::text, 'netzwerk'::text]))),
    CONSTRAINT connections_nicht_selbst CHECK ((user_id <> connected_to)),
    CONSTRAINT connections_status CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'blocked'::text])))
);

CREATE TABLE public.dateien (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid,
    user_id uuid,
    ordner_pfad text DEFAULT ''::text NOT NULL,
    name text NOT NULL,
    storage_path text NOT NULL,
    groesse_bytes bigint DEFAULT 0 NOT NULL,
    mime_type text,
    ist_medien boolean DEFAULT false NOT NULL,
    hochgeladen_von uuid NOT NULL,
    hochgeladen_am timestamp with time zone DEFAULT now() NOT NULL,
    bpm integer,
    turnier_id uuid,
    CONSTRAINT dateien_pkey PRIMARY KEY (id),
    CONSTRAINT dateien_check CHECK ((((((verein_id IS NOT NULL))::integer + ((user_id IS NOT NULL))::integer) + ((turnier_id IS NOT NULL))::integer) = 1))
);

CREATE TABLE public.disziplinen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sortierung integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT disziplinen_pkey PRIMARY KEY (id),
    CONSTRAINT disziplinen_name_key UNIQUE (name)
);

CREATE TABLE public.eigene_kontakte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    info text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eigene_kontakte_pkey PRIMARY KEY (id)
);

CREATE TABLE public.eigene_vereinsnotizen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    vereinsname text NOT NULL,
    funktion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eigene_vereinsnotizen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.einladungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    rolle_id uuid,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    max_uses integer DEFAULT 1 NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    gruppe_id uuid,
    CONSTRAINT einladungen_pkey PRIMARY KEY (id),
    CONSTRAINT einladungen_token_key UNIQUE (token)
);

CREATE TABLE public.eltern_code_versuche (
    user_id uuid NOT NULL,
    am timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.eltern_codes (
    kind_id uuid NOT NULL,
    code_hash text NOT NULL,
    laeuft_ab timestamp with time zone NOT NULL,
    CONSTRAINT eltern_codes_pkey PRIMARY KEY (kind_id)
);

CREATE TABLE public.eltern_kind_zuordnung (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    eltern_vm_id uuid NOT NULL,
    kind_vm_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eltern_kind_zuordnung_pkey PRIMARY KEY (id),
    CONSTRAINT eltern_kind_zuordnung_eltern_vm_id_kind_vm_id_key UNIQUE (eltern_vm_id, kind_vm_id)
);

CREATE TABLE public.eltern_verknuepfungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eltern_id uuid NOT NULL,
    kind_id uuid NOT NULL,
    status text NOT NULL,
    verein_id uuid,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    bestaetigt_am timestamp with time zone,
    bestaetigt_von uuid,
    CONSTRAINT eltern_verknuepfungen_pkey PRIMARY KEY (id),
    CONSTRAINT eltern_verknuepfungen_eltern_id_kind_id_key UNIQUE (eltern_id, kind_id),
    CONSTRAINT eltern_verknuepfungen_check CHECK ((eltern_id <> kind_id)),
    CONSTRAINT eltern_verknuepfungen_status_check CHECK ((status = ANY (ARRAY['wartet_verein'::text, 'bestaetigt'::text])))
);

CREATE TABLE public.fernwartungs_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    angefordert_von uuid,
    typ text,
    beschreibung text,
    fernzugriff_gewuenscht boolean DEFAULT false NOT NULL,
    code text,
    status text DEFAULT 'offen'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    laeuft_ab_am timestamp with time zone,
    widerrufen_am timestamp with time zone,
    CONSTRAINT fernwartungs_anfragen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.gespraech_teilnehmer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gespraech_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gespraech_teilnehmer_pkey PRIMARY KEY (id),
    CONSTRAINT gespraech_teilnehmer_gespraech_id_user_id_key UNIQUE (gespraech_id, user_id)
);

CREATE TABLE public.gespraeche (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    typ text NOT NULL,
    verein_id uuid,
    gruppe_id uuid,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    turnier_id uuid,
    nur_leitung_schreibt boolean DEFAULT false NOT NULL,
    erstellt_von uuid,
    dm_schluessel text,
    CONSTRAINT gespraeche_pkey PRIMARY KEY (id),
    CONSTRAINT gespraeche_dm_schluessel_key UNIQUE (dm_schluessel),
    CONSTRAINT gespraeche_typ_verein_id_gruppe_id_key UNIQUE (typ, verein_id, gruppe_id),
    CONSTRAINT gespraeche_typ_check CHECK ((typ = ANY (ARRAY['dm'::text, 'verein'::text, 'trainingsgruppe'::text, 'juryraum'::text])))
);

CREATE TABLE public.gruppen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    altersklasse_id uuid,
    disziplin_id uuid,
    name text,
    thema text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gruppen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.gruppen_mitglieder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gruppe_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    funktion text DEFAULT 'mitglied'::text NOT NULL,
    CONSTRAINT gruppen_mitglieder_pkey PRIMARY KEY (id),
    CONSTRAINT gruppen_mitglieder_gruppe_id_vereins_mitglied_id_key UNIQUE (gruppe_id, vereins_mitglied_id)
);

CREATE TABLE public.invite_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    created_by uuid NOT NULL,
    created_by_name text,
    type text DEFAULT 'buddy'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ziel_verein_id uuid,
    ziel_rolle text,
    ziel_email text,
    CONSTRAINT invite_links_pkey PRIMARY KEY (id),
    CONSTRAINT invite_links_token_key UNIQUE (token)
);

CREATE TABLE public.juryraum_besetzungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turnier_id uuid NOT NULL,
    altersklasse text NOT NULL,
    disziplin text NOT NULL,
    obmann_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    wertende_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    passkontrolle_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_besetzungen_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_besetzungen_turnier_id_altersklasse_disziplin_key UNIQUE (turnier_id, altersklasse, disziplin)
);

CREATE TABLE public.juryraum_einladungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    verband_id uuid,
    rolle text DEFAULT 'mitglied'::text NOT NULL,
    eingeladen_von uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'offen'::text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_einladungen_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_einladungen_token_key UNIQUE (token),
    CONSTRAINT juryraum_einladungen_rolle_check CHECK ((rolle = ANY (ARRAY['mitglied'::text, 'admin'::text]))),
    CONSTRAINT juryraum_einladungen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'angenommen'::text, 'abgelehnt'::text, 'widerrufen'::text, 'abgelaufen'::text])))
);

CREATE TABLE public.juryraum_einsatz_zusagen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turnier_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'offen'::text NOT NULL,
    eingeladen_von uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_einsatz_zusagen_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_einsatz_zusagen_turnier_id_user_id_key UNIQUE (turnier_id, user_id),
    CONSTRAINT juryraum_einsatz_zusagen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'zugesagt'::text, 'abgesagt'::text])))
);

CREATE TABLE public.juryraum_fahrgemeinschaften (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turnier_id uuid NOT NULL,
    created_by uuid NOT NULL,
    abfahrtsort text NOT NULL,
    freie_plaetze integer DEFAULT 0 NOT NULL,
    rueckfahrt boolean DEFAULT true NOT NULL,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_fahrgemeinschaften_pkey PRIMARY KEY (id)
);

CREATE TABLE public.juryraum_fernwartungs_zugriff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gewaehrt_von uuid NOT NULL,
    ziel_user_id uuid NOT NULL,
    grund text,
    status text DEFAULT 'aktiv'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    laeuft_ab_am timestamp with time zone,
    widerrufen_am timestamp with time zone,
    code text,
    bestaetigt_am timestamp with time zone,
    CONSTRAINT juryraum_fernwartungs_zugriff_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_fernwartungs_zugriff_status_check CHECK ((status = ANY (ARRAY['ausstehend'::text, 'aktiv'::text, 'widerrufen'::text, 'abgelehnt'::text])))
);

CREATE TABLE public.juryraum_mitglieder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verband_id uuid,
    rolle text DEFAULT 'mitglied'::text NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_mitglieder_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_mitglieder_user_id_key UNIQUE (user_id),
    CONSTRAINT juryraum_mitglieder_rolle_check CHECK ((rolle = ANY (ARRAY['mitglied'::text, 'admin'::text])))
);

CREATE TABLE public.juryraum_unterkuenfte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turnier_id uuid NOT NULL,
    created_by uuid NOT NULL,
    hotelname text NOT NULL,
    adresse text,
    telefon text,
    website text,
    check_in date,
    check_out date,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_unterkuenfte_pkey PRIMARY KEY (id)
);

CREATE TABLE public.juryraum_verfuegbarkeiten (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turnier_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL,
    notiz text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT juryraum_verfuegbarkeiten_pkey PRIMARY KEY (id),
    CONSTRAINT juryraum_verfuegbarkeiten_turnier_id_user_id_key UNIQUE (turnier_id, user_id),
    CONSTRAINT juryraum_verfuegbarkeiten_status_check CHECK ((status = ANY (ARRAY['kann'::text, 'kann_nicht'::text, 'vielleicht'::text])))
);

CREATE TABLE public.kassenbuch_eintraege (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    typ text NOT NULL,
    kategorie text,
    betrag numeric(10,2) NOT NULL,
    beschreibung text,
    erstellt_von uuid,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    zahlungsart text,
    beleg_pfad text,
    CONSTRAINT kassenbuch_eintraege_pkey PRIMARY KEY (id),
    CONSTRAINT kassenbuch_eintraege_betrag_check CHECK ((betrag > (0)::numeric)),
    CONSTRAINT kassenbuch_eintraege_typ_check CHECK ((typ = ANY (ARRAY['einnahme'::text, 'ausgabe'::text])))
);

CREATE TABLE public.kind_einstellungen (
    kind_id uuid NOT NULL,
    nachrichten_erlaubt boolean DEFAULT true NOT NULL,
    map_erlaubt boolean DEFAULT true NOT NULL,
    spotlights_nur_kontakte boolean DEFAULT false NOT NULL,
    geaendert_von uuid,
    geaendert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kind_einstellungen_pkey PRIMARY KEY (kind_id)
);

CREATE TABLE public.kostuem_gruppen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    altersklasse_id uuid,
    name text NOT NULL,
    farbe text DEFAULT '#c91919'::text,
    beschreibung text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kostuem_gruppen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kostueme (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    kostuem_gruppe_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    teil text NOT NULL,
    groesse text,
    zustand text DEFAULT 'gut'::text NOT NULL,
    vergabe_datum date,
    rueckgabe date,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kostueme_pkey PRIMARY KEY (id)
);

CREATE TABLE public.login_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_adresse text,
    user_agent text,
    eingeloggt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT login_ips_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mail_versand_log (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    art text NOT NULL,
    absender_user uuid,
    verein_id uuid,
    bezug_id uuid,
    empfaenger_anzahl integer DEFAULT 1 NOT NULL,
    erfolgreich boolean DEFAULT true NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_versand_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.meldungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    melder_id uuid,
    ziel_user_id uuid,
    spotlight_id uuid,
    grund text NOT NULL,
    text text,
    status text DEFAULT 'offen'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    bearbeitet_von uuid,
    bearbeitet_am timestamp with time zone,
    admin_notiz text,
    CONSTRAINT meldungen_pkey PRIMARY KEY (id),
    CONSTRAINT meldungen_admin_notiz_check CHECK ((char_length(admin_notiz) <= 2000)),
    CONSTRAINT meldungen_grund_check CHECK ((grund = ANY (ARRAY['unangemessen'::text, 'belaestigung'::text, 'unerwuenschter_kontakt'::text, 'jugendgefaehrdend'::text, 'spam'::text, 'sonstiges'::text]))),
    CONSTRAINT meldungen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'erledigt'::text]))),
    CONSTRAINT meldungen_text_check CHECK ((char_length(text) <= 1000))
);

CREATE TABLE public.mitglieder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    user_id uuid,
    vorname text NOT NULL,
    nachname text NOT NULL,
    geburtsdatum date,
    email text,
    telefon text,
    strasse text,
    hausnummer text,
    plz text,
    ort text,
    gruppe text,
    beitragsart text,
    sepa_kontoinhaber text,
    sepa_iban text,
    sepa_mandatsdatum date,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mitglieder_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mitgliedsantraege (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    status text DEFAULT 'neu'::text NOT NULL,
    vorname text NOT NULL,
    nachname text NOT NULL,
    geburtsdatum date,
    email text,
    telefon text,
    strasse text,
    hausnummer text,
    plz text,
    ort text,
    gruppe text,
    eltern1_name text,
    eltern1_email text,
    eltern1_telefon text,
    eltern2_name text,
    eltern2_email text,
    eltern2_telefon text,
    sepa_zustimmung boolean DEFAULT false NOT NULL,
    sepa_kontoinhaber text,
    sepa_iban text,
    sepa_mandatsdatum date,
    fotoeinwilligung boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    entschieden_am timestamp with time zone,
    user_id uuid,
    mitglied_id uuid,
    CONSTRAINT mitgliedsantraege_pkey PRIMARY KEY (id),
    CONSTRAINT mitgliedsantraege_status_check CHECK ((status = ANY (ARRAY['neu'::text, 'angenommen'::text, 'abgelehnt'::text])))
);

CREATE TABLE public.nachricht_reaktionen (
    nachricht_id uuid NOT NULL,
    gespraech_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nachricht_reaktionen_pkey PRIMARY KEY (nachricht_id, user_id),
    CONSTRAINT nachricht_reaktionen_emoji_check CHECK ((emoji = ANY (ARRAY['👍'::text, '❤️'::text, '😂'::text, '😮'::text, '😢'::text, '🙏'::text, '🎉'::text, '🔥'::text])))
);

CREATE TABLE public.nachrichten (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gespraech_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    inhalt text NOT NULL,
    gesendet_am timestamp with time zone DEFAULT now() NOT NULL,
    bild_pfad text,
    umfrage jsonb,
    antwort_auf uuid,
    geloescht_am timestamp with time zone,
    anhang jsonb,
    standort jsonb,
    sticker text,
    bearbeitet_am timestamp with time zone,
    weitergeleitet boolean DEFAULT false NOT NULL,
    CONSTRAINT nachrichten_pkey PRIMARY KEY (id),
    CONSTRAINT nachrichten_laenge CHECK ((char_length(inhalt) <= 4000)),
    CONSTRAINT nachrichten_nicht_leer CHECK (((geloescht_am IS NOT NULL) OR (char_length(btrim(inhalt)) > 0) OR (bild_pfad IS NOT NULL) OR (umfrage IS NOT NULL) OR (anhang IS NOT NULL) OR (standort IS NOT NULL) OR (sticker IS NOT NULL)))
);

CREATE TABLE public.onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verein_id uuid,
    tarif text NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    total_steps integer DEFAULT 1 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    skipped_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id)
);

CREATE TABLE public.paypal_plans (
    key text NOT NULL,
    plan_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT paypal_plans_pkey PRIMARY KEY (key)
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    vorname text,
    nachname text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rolle text,
    tarif text,
    stripe_customer_id text,
    stripe_subscription_id text,
    tarif_aktiv_bis timestamp with time zone,
    handle text,
    ist_plattform_admin boolean DEFAULT false NOT NULL,
    paypal_subscription_id text,
    geschlecht text,
    telefon text,
    gesperrt boolean DEFAULT false NOT NULL,
    konto_privat boolean DEFAULT false NOT NULL,
    ical_token text,
    geburtsdatum date,
    ort text,
    map_sichtbar boolean DEFAULT false NOT NULL,
    map_lat double precision,
    map_lng double precision,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_ical_token_key UNIQUE (ical_token),
    CONSTRAINT profiles_geburtsdatum_plausibel CHECK (((geburtsdatum IS NULL) OR ((geburtsdatum >= '1900-01-01'::date) AND (geburtsdatum <= '2100-01-01'::date)))),
    CONSTRAINT profiles_map_koordinaten CHECK ((((map_lat IS NULL) = (map_lng IS NULL)) AND ((map_lat IS NULL) OR ((abs(map_lat) <= (90)::double precision) AND (abs(map_lng) <= (180)::double precision))))),
    CONSTRAINT profiles_ort_laenge CHECK ((char_length(ort) <= 80))
);

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE TABLE public.rechnungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nummer text NOT NULL,
    typ text NOT NULL,
    ziel_user_id uuid,
    ziel_verein_id uuid,
    empfaenger_name text NOT NULL,
    empfaenger_adresse text,
    empfaenger_email text NOT NULL,
    leistung text NOT NULL,
    zeitraum text,
    betrag numeric(10,2) NOT NULL,
    zahlungsweg text NOT NULL,
    rechnungsdatum date DEFAULT CURRENT_DATE NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    versendet boolean DEFAULT false NOT NULL,
    versendet_am timestamp with time zone,
    CONSTRAINT rechnungen_pkey PRIMARY KEY (id),
    CONSTRAINT rechnungen_nummer_key UNIQUE (nummer),
    CONSTRAINT rechnungen_typ_check CHECK ((typ = ANY (ARRAY['basic'::text, 'verein'::text])))
);

CREATE TABLE public.rechnungs_einstellungen (
    id boolean DEFAULT true NOT NULL,
    firmenzeile text DEFAULT 'Kai Kern – Taktmanufaktur'::text NOT NULL,
    adresse text DEFAULT 'Jahnstraße 15, 67378 Zeiskam'::text NOT NULL,
    steuernummer text,
    naechste_nummer integer DEFAULT 1 NOT NULL,
    nummer_praefix text DEFAULT 'TR-2026-'::text NOT NULL,
    CONSTRAINT rechnungs_einstellungen_pkey PRIMARY KEY (id),
    CONSTRAINT rechnungs_einstellungen_id_check CHECK ((id = true))
);

CREATE TABLE public.rollen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rollen_pkey PRIMARY KEY (id),
    CONSTRAINT rollen_name_key UNIQUE (name)
);

CREATE TABLE public.spenden (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    spender_name text NOT NULL,
    spender_strasse text,
    spender_hausnummer text,
    spender_plz text,
    spender_ort text,
    betrag numeric(10,2),
    spendenart text DEFAULT 'geld'::text NOT NULL,
    sachspende_beschreibung text,
    datum date DEFAULT CURRENT_DATE NOT NULL,
    verwendungszweck text,
    email text,
    versendet boolean DEFAULT false NOT NULL,
    erstellt_von uuid,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    bescheinigungsnummer text,
    CONSTRAINT spenden_pkey PRIMARY KEY (id),
    CONSTRAINT spenden_spendenart_check CHECK ((spendenart = ANY (ARRAY['geld'::text, 'sach'::text])))
);

CREATE TABLE public.spotlight_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spotlight_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT spotlight_reactions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.spotlight_views (
    spotlight_id uuid NOT NULL,
    viewer_user_id uuid NOT NULL,
    viewed_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT spotlight_views_pkey PRIMARY KEY (spotlight_id, viewer_user_id)
);

CREATE TABLE public.spotlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    media_path text,
    media_typ text NOT NULL,
    text_overlay text,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    ablauf_am timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    sichtbarkeit text DEFAULT 'netzwerk'::text NOT NULL,
    hintergrund text,
    sticker text,
    entfernt_am timestamp with time zone,
    CONSTRAINT spotlights_pkey PRIMARY KEY (id),
    CONSTRAINT spotlights_media_typ_check CHECK ((media_typ = ANY (ARRAY['foto'::text, 'video'::text, 'text'::text]))),
    CONSTRAINT spotlights_sichtbarkeit_check CHECK ((sichtbarkeit = ANY (ARRAY['netzwerk'::text, 'kontakte'::text]))),
    CONSTRAINT spotlights_text_laenge CHECK ((char_length(text_overlay) <= 500))
);

CREATE TABLE public.sticker (
    id text NOT NULL,
    satz text NOT NULL,
    bezeichnung text NOT NULL,
    sortierung integer NOT NULL,
    kategorie text NOT NULL,
    CONSTRAINT sticker_pkey PRIMARY KEY (id),
    CONSTRAINT sticker_id_check CHECK ((id ~ '^[a-z][0-9]{2,3}$'::text)),
    CONSTRAINT sticker_kategorie_gueltig CHECK ((kategorie = ANY (ARRAY['gefuehle'::text, 'tanz'::text, 'erfolg'::text, 'gruppe'::text, 'musik'::text, 'alltag'::text]))),
    CONSTRAINT sticker_satz_check CHECK ((satz = ANY (ARRAY['taenzerin'::text, 'gardist'::text])))
);

CREATE TABLE public.tarif_ereignisse (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    verein_id uuid,
    previous_plan text,
    new_plan text,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tarif_ereignisse_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tarif_preise (
    tarif text NOT NULL,
    periode text NOT NULL,
    preis_cent integer NOT NULL,
    CONSTRAINT tarif_preise_pkey PRIMARY KEY (tarif, periode),
    CONSTRAINT tarif_preise_periode_check CHECK ((periode = ANY (ARRAY['monat'::text, 'jahr'::text]))),
    CONSTRAINT tarif_preise_preis_cent_check CHECK ((preis_cent > 0)),
    CONSTRAINT tarif_preise_tarif_check CHECK ((tarif = ANY (ARRAY['basic'::text, 'verein'::text])))
);

CREATE TABLE public.tarif_system_freigabe (
    txid bigint NOT NULL,
    CONSTRAINT tarif_system_freigabe_pkey PRIMARY KEY (txid)
);

CREATE TABLE public.termin_rueckmeldungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    termin_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    status text NOT NULL,
    kommentar text,
    geaendert_von uuid DEFAULT auth.uid(),
    geaendert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT termin_rueckmeldungen_pkey PRIMARY KEY (id),
    CONSTRAINT termin_rueckmeldungen_termin_id_vereins_mitglied_id_key UNIQUE (termin_id, vereins_mitglied_id),
    CONSTRAINT termin_rueckmeldungen_kommentar_check CHECK ((char_length(kommentar) <= 300)),
    CONSTRAINT termin_rueckmeldungen_status_check CHECK ((status = ANY (ARRAY['zugesagt'::text, 'abgesagt'::text, 'vielleicht'::text])))
);

CREATE TABLE public.termine (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid,
    erstellt_von uuid DEFAULT auth.uid() NOT NULL,
    art text NOT NULL,
    titel text NOT NULL,
    beschreibung text,
    ort text,
    datum date NOT NULL,
    bis_datum date,
    von time without time zone,
    bis time without time zone,
    zielgruppe text DEFAULT 'verein'::text NOT NULL,
    gruppe_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    rueckmeldung boolean DEFAULT false NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    geaendert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT termine_pkey PRIMARY KEY (id),
    CONSTRAINT termine_art_check CHECK ((art = ANY (ARRAY['privat'::text, 'veranstaltung'::text, 'auftritt'::text, 'sitzung'::text, 'sonstiges'::text]))),
    CONSTRAINT termine_beschreibung_check CHECK ((char_length(beschreibung) <= 2000)),
    CONSTRAINT termine_bis_datum CHECK (((bis_datum IS NULL) OR (bis_datum > datum))),
    CONSTRAINT termine_gruppen CHECK (((zielgruppe = 'gruppen'::text) = (cardinality(gruppe_ids) > 0))),
    CONSTRAINT termine_ort_check CHECK ((char_length(ort) <= 200)),
    CONSTRAINT termine_privat_ohne_rueckmeldung CHECK (((verein_id IS NOT NULL) OR ((rueckmeldung = false) AND (zielgruppe = 'verein'::text) AND (cardinality(gruppe_ids) = 0)))),
    CONSTRAINT termine_privat_ohne_verein CHECK (((art = 'privat'::text) = (verein_id IS NULL))),
    CONSTRAINT termine_titel_check CHECK (((char_length(btrim(titel)) >= 1) AND (char_length(btrim(titel)) <= 120))),
    CONSTRAINT termine_zeit_reihenfolge CHECK (((bis IS NULL) OR (bis_datum IS NOT NULL) OR (bis > von))),
    CONSTRAINT termine_zeiten CHECK (((von IS NOT NULL) OR (bis IS NULL))),
    CONSTRAINT termine_zielgruppe_check CHECK ((zielgruppe = ANY (ARRAY['verein'::text, 'gruppen'::text, 'leitung'::text])))
);

CREATE TABLE public.trainings_abmeldungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    gruppe_id uuid NOT NULL,
    datum date NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    status text DEFAULT 'entschuldigt'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    grund text,
    CONSTRAINT trainings_abmeldungen_pkey PRIMARY KEY (id),
    CONSTRAINT trainings_abmeldungen_gruppe_id_datum_vereins_mitglied_id_key UNIQUE (gruppe_id, datum, vereins_mitglied_id),
    CONSTRAINT trainings_abmeldungen_status_check CHECK ((status = ANY (ARRAY['entschuldigt'::text, 'unentschuldigt'::text])))
);

CREATE TABLE public.trainings_anwesenheit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    gruppe_id uuid NOT NULL,
    datum date NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    anwesend boolean NOT NULL,
    erfasst_von uuid NOT NULL,
    erfasst_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trainings_anwesenheit_pkey PRIMARY KEY (id),
    CONSTRAINT trainings_anwesenheit_gruppe_id_datum_vereins_mitglied_id_key UNIQUE (gruppe_id, datum, vereins_mitglied_id)
);

CREATE TABLE public.trainingstermine (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    gruppe_id uuid NOT NULL,
    ist_wiederholend boolean DEFAULT false NOT NULL,
    wochentag integer,
    datum date,
    von time without time zone NOT NULL,
    bis time without time zone NOT NULL,
    halle text,
    titel text,
    erstellt_von uuid NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trainingstermine_pkey PRIMARY KEY (id),
    CONSTRAINT trainingstermine_check CHECK (((ist_wiederholend AND (wochentag IS NOT NULL) AND (datum IS NULL)) OR ((NOT ist_wiederholend) AND (datum IS NOT NULL) AND (wochentag IS NULL)))),
    CONSTRAINT trainingstermine_wochentag_check CHECK (((wochentag >= 1) AND (wochentag <= 7)))
);

CREATE TABLE public.turnier_merkliste (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    turnier_id uuid NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT turnier_merkliste_pkey PRIMARY KEY (user_id, turnier_id)
);

CREATE TABLE public.turnier_start_rueckmeldungen (
    start_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    status text NOT NULL,
    kommentar text,
    geaendert_von uuid,
    geaendert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT turnier_start_rueckmeldungen_pkey PRIMARY KEY (start_id, vereins_mitglied_id),
    CONSTRAINT turnier_start_rueckmeldungen_status_check CHECK ((status = ANY (ARRAY['dabei'::text, 'nicht_dabei'::text, 'unsicher'::text])))
);

CREATE TABLE public.turnier_starts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    turnier_id uuid NOT NULL,
    gruppe_id uuid,
    bezeichnung text,
    solisten uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    disziplin_id uuid,
    altersklasse_id uuid,
    tag date,
    startnummer text,
    status text DEFAULT 'geplant'::text NOT NULL,
    notiz text,
    platz integer,
    punkte numeric(7,2),
    ergebnis_notiz text,
    erstellt_von uuid,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    geaendert_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT turnier_starts_pkey PRIMARY KEY (id),
    CONSTRAINT turnier_starts_platz_check CHECK (((platz >= 1) AND (platz <= 999))),
    CONSTRAINT turnier_starts_punkte_check CHECK ((punkte >= (0)::numeric)),
    CONSTRAINT turnier_starts_status_check CHECK ((status = ANY (ARRAY['geplant'::text, 'gemeldet'::text, 'abgesagt'::text])))
);

CREATE TABLE public.turniere (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    typ text,
    kategorie text DEFAULT 'Turnier'::text NOT NULL,
    ort text NOT NULL,
    adresse text,
    ausrichter text,
    ausschreibung_url text,
    beginn_samstag text,
    beginn_sonntag text,
    tage jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verband_id uuid,
    verein_id uuid,
    meldeschluss date,
    erstellt_von uuid,
    CONSTRAINT turniere_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ueberweisungs_rechnungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    typ text NOT NULL,
    ziel_user_id uuid,
    ziel_verein_id uuid,
    tarif text NOT NULL,
    periode text NOT NULL,
    betrag numeric(10,2) NOT NULL,
    status text DEFAULT 'offen'::text NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    bezahlt_am timestamp with time zone,
    CONSTRAINT ueberweisungs_rechnungen_pkey PRIMARY KEY (id),
    CONSTRAINT ueberweisungs_rechnungen_check CHECK ((((typ = 'basic'::text) AND (ziel_user_id IS NOT NULL)) OR ((typ = 'verein'::text) AND (ziel_verein_id IS NOT NULL)))),
    CONSTRAINT ueberweisungs_rechnungen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'bezahlt'::text, 'storniert'::text]))),
    CONSTRAINT ueberweisungs_rechnungen_typ_check CHECK ((typ = ANY (ARRAY['basic'::text, 'verein'::text])))
);

CREATE TABLE public.umfrage_stimmen (
    nachricht_id uuid NOT NULL,
    user_id uuid NOT NULL,
    option integer NOT NULL,
    abgestimmt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT umfrage_stimmen_pkey PRIMARY KEY (nachricht_id, user_id, option),
    CONSTRAINT umfrage_stimmen_option_check CHECK (((option >= 0) AND (option <= 11)))
);

CREATE TABLE public.verbaende (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kuerzel text NOT NULL,
    name text NOT NULL,
    beschreibung text,
    logo_url text,
    aktiv boolean DEFAULT true NOT NULL,
    sortierung integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verbaende_pkey PRIMARY KEY (id),
    CONSTRAINT verbaende_kuerzel_key UNIQUE (kuerzel)
);

CREATE TABLE public.verband_altersklassen (
    verband_id uuid NOT NULL,
    altersklasse_id uuid NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortierung integer DEFAULT 0 NOT NULL,
    CONSTRAINT verband_altersklassen_pkey PRIMARY KEY (verband_id, altersklasse_id)
);

CREATE TABLE public.verband_disziplinen (
    verband_id uuid NOT NULL,
    disziplin_id uuid NOT NULL,
    aktiv boolean DEFAULT true NOT NULL,
    sortierung integer DEFAULT 0 NOT NULL,
    CONSTRAINT verband_disziplinen_pkey PRIMARY KEY (verband_id, disziplin_id)
);

CREATE TABLE public.vereine (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    kuerzel text,
    logo_url text,
    beschreibung text,
    ansprechpartner text,
    email text,
    telefon text,
    webseite text,
    strasse text,
    hausnummer text,
    plz text,
    ort text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tarif text DEFAULT 'free'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    tarif_aktiv_bis text,
    paypal_subscription_id text,
    gesperrt boolean DEFAULT false NOT NULL,
    mitgliederzahl_oeffentlich boolean DEFAULT false NOT NULL,
    beitragsordnung_text text,
    datenschutz_text text,
    beitritt_sepa_aktiv boolean DEFAULT true NOT NULL,
    beitritt_foto_aktiv boolean DEFAULT true NOT NULL,
    satzung_pfad text,
    sepa_glaeubiger_id text,
    spenden_finanzamt text,
    spenden_freistellung_datum date,
    spenden_steuernummer text,
    spenden_naechste_nummer integer DEFAULT 1 NOT NULL,
    verband_id uuid,
    lat double precision,
    lng double precision,
    CONSTRAINT vereine_pkey PRIMARY KEY (id),
    CONSTRAINT vereine_koordinaten CHECK ((((lat IS NULL) = (lng IS NULL)) AND ((lat IS NULL) OR ((abs(lat) <= (90)::double precision) AND (abs(lng) <= (180)::double precision)))))
);

CREATE TABLE public.vereins_bereichsrechte (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    vereins_mitglied_id uuid NOT NULL,
    bereich text NOT NULL,
    erlaubt boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vereins_bereichsrechte_pkey PRIMARY KEY (id),
    CONSTRAINT vereins_bereichsrechte_vereins_mitglied_id_bereich_key UNIQUE (vereins_mitglied_id, bereich)
);

CREATE TABLE public.vereins_lizenz_abdeckungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    user_id uuid NOT NULL,
    vereins_mitglied_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    source text DEFAULT 'club_license'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    CONSTRAINT vereins_lizenz_abdeckungen_pkey PRIMARY KEY (id),
    CONSTRAINT vereins_lizenz_abdeckungen_source_check CHECK ((source = ANY (ARRAY['club_license'::text, 'personal_plan'::text]))),
    CONSTRAINT vereins_lizenz_abdeckungen_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text, 'expired'::text])))
);

CREATE TABLE public.vereins_mitglieder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verein_id uuid NOT NULL,
    rolle_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rolle_freitext text,
    bereiche text[],
    altersklasse text,
    aktiv boolean DEFAULT true NOT NULL,
    CONSTRAINT vereins_mitglieder_pkey PRIMARY KEY (id),
    CONSTRAINT vereins_mitglieder_user_id_verein_id_key UNIQUE (user_id, verein_id)
);

CREATE TABLE public.vereins_software_verbindungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verein_id uuid NOT NULL,
    software text NOT NULL,
    api_key text NOT NULL,
    status text DEFAULT 'ungeprueft'::text NOT NULL,
    letzter_abgleich timestamp with time zone,
    letzter_fehler text,
    erstellt_von uuid NOT NULL,
    erstellt_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vereins_software_verbindungen_pkey PRIMARY KEY (id),
    CONSTRAINT vereins_software_verbindungen_verein_id_software_key UNIQUE (verein_id, software),
    CONSTRAINT vereins_software_verbindungen_status_check CHECK ((status = ANY (ARRAY['ungeprueft'::text, 'verbunden'::text, 'fehler'::text])))
);

CREATE TABLE public.vereinswechsel_anfragen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quell_verein_id uuid NOT NULL,
    ziel_verein_id uuid NOT NULL,
    mitglied_user_id uuid NOT NULL,
    vorgeschlagene_rolle_id uuid,
    angefragt_von uuid NOT NULL,
    status text DEFAULT 'offen'::text NOT NULL,
    quell_verein_bestaetigt_at timestamp with time zone,
    mitglied_bestaetigt_at timestamp with time zone,
    abgelehnt_von text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vereinswechsel_anfragen_pkey PRIMARY KEY (id)
);

CREATE TABLE public.zahlungs_ereignisse (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    anbieter text NOT NULL,
    ereignis_id text NOT NULL,
    typ text NOT NULL,
    abo_id uuid,
    status_neu text,
    fehler text,
    eingegangen_am timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zahlungs_ereignisse_pkey PRIMARY KEY (id),
    CONSTRAINT zahlungs_ereignisse_anbieter_ereignis_id_key UNIQUE (anbieter, ereignis_id)
);

COMMENT ON COLUMN public.turniere.beginn_samstag IS 'Veraltet – Beginn steht je Tag in turniere.tage (beginn)';
COMMENT ON COLUMN public.turniere.beginn_sonntag IS 'Veraltet – Beginn steht je Tag in turniere.tage (beginn)';
