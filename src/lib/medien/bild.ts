// Fotos im Browser verkleinern (max. Kantenlaenge, JPEG). GIFs bleiben unveraendert.
export async function bildVerkleinern(datei: File, maxKante = 1600): Promise<Blob> {
  if (datei.type === "image/gif") return datei;
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
  const leinwand = document.createElement("canvas");
  leinwand.width = Math.round(bild.width * faktor);
  leinwand.height = Math.round(bild.height * faktor);
  leinwand.getContext("2d")!.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
  return new Promise((ok, fehler) => leinwand.toBlob((b) => (b ? ok(b) : fehler(new Error("Bild"))), "image/jpeg", 0.82));
}
