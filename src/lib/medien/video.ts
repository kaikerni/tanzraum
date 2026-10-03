// Videos vor dem Hochladen im Browser verkleinern (WebCodecs ueber mediabunny), damit auch komplette
// Taenze unter die Speichergrenze passen. Die Laenge wird nicht beschraenkt – bei langen Videos sinken
// Aufloesung und Bitrate. Ohne WebCodecs wird das Original genutzt, sofern es klein genug ist.

export const MAX_BYTES = 50 * 1024 * 1024;

export class VideoZuGross extends Error {}

export async function videoVorbereiten(datei: File, fortschritt: (anteil: number) => void, maxBytes = MAX_BYTES): Promise<Blob> {
  const ZIEL_BYTES = Math.floor(maxBytes * 0.92);
  const grenzeMb = Math.round(maxBytes / 1024 / 1024);
  const mb = await import("mediabunny");
  const kannKodieren = typeof VideoEncoder !== "undefined" && (await mb.canEncodeVideo("avc").catch(() => false));
  if (!kannKodieren) {
    if (datei.size <= maxBytes) return datei;
    throw new VideoZuGross(`Dein Browser kann das Video nicht verkleinern und es ist größer als ${grenzeMb} MB.`+" Bitte kürze es oder nutze einen aktuellen Browser (z. B. Chrome, Edge, Safari).");
  }

  const input = new mb.Input({ source: new mb.BlobSource(datei), formats: mb.ALL_FORMATS });
  const dauer = Math.max(1, await input.computeDuration());
  const spur = await input.getPrimaryVideoTrack();
  if (!spur) throw new Error("Diese Datei enthält kein Video.");

  // Ziel-Bitrate aus der Laenge (Audio 96 kbit/s abziehen), Aufloesung passend dazu
  const bitrate = Math.min(2_500_000, Math.floor((ZIEL_BYTES * 8) / dauer - 96_000));
  if (bitrate < 250_000) throw new VideoZuGross("Das Video ist zu lang. Bitte teile es in kürzere Abschnitte.");
  const kurzeKante = bitrate >= 1_400_000 ? 720 : bitrate >= 700_000 ? 540 : 360;
  const b = spur.displayWidth;
  const h = spur.displayHeight;
  const faktor = Math.min(1, kurzeKante / Math.min(b, h));
  // gerade Pixelzahlen fuer H.264
  const breite = Math.max(2, Math.round((b * faktor) / 2) * 2);
  const hoehe = Math.max(2, Math.round((h * faktor) / 2) * 2);

  if (datei.size <= ZIEL_BYTES && faktor === 1 && datei.type === "video/mp4") return datei;

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: { width: breite, height: hoehe, fit: "fill", codec: "avc", bitrate, frameRate: 30 },
    audio: { codec: "aac", bitrate: 96_000 },
  });
  if (!conversion.isValid) {
    if (datei.size <= maxBytes) return datei;
    throw new VideoZuGross(`Dieses Videoformat kann hier nicht verkleinert werden. Bitte nutze ein MP4-Video unter ${grenzeMb} MB.`);
  }
  conversion.onProgress = (anteil) => fortschritt(anteil);
  await conversion.execute();
  const puffer = output.target.buffer;
  if (!puffer) throw new Error("Das Video konnte nicht verarbeitet werden.");
  const blob = new Blob([puffer], { type: "video/mp4" });
  if (blob.size > maxBytes) throw new VideoZuGross("Das Video ist auch verkleinert noch zu groß. Bitte kürze es etwas.");
  return blob;
}
