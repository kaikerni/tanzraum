# Leitet die Web-Bilder von Kai aus dem verbindlichen Masterbild ab (nur verkleinern/zuschneiden, nichts verändern):
#   python3 scripts/kai-bilder.py
from PIL import Image

MASTER = "public/images/assistant/kai-master.png"
im = Image.open(MASTER).convert("RGBA")

# Ganze Figur (Seitenverhältnis 2:3 wie das Master), transparent
im.resize((512, 768), Image.LANCZOS).save("public/images/assistant/kai.webp", "WEBP", quality=86, method=6)

# Porträt (Kopf mit Federhut und Schultern) für kleine Hinweise, quadratisch
im.crop((290, 0, 730, 440)).resize((256, 256), Image.LANCZOS).save("public/images/assistant/kai-portrait.webp", "WEBP", quality=88, method=6)
