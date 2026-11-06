#!/usr/bin/env bash
# Instala Chromium para Playwright sin depender de apt cuando no hace falta.
#
# Las máquinas de GitHub ya traen las librerías del sistema que usa Chromium. El paso con
# --with-deps (apt-get) se colgó varias veces el 06-nov-2026 bajando paquetes de un mirror lento:
# hasta 52 minutos, y el reintento fallaba porque el apt-get colgado seguía con el lock de dpkg.
# Ahora: se baja solo el navegador (de la CDN de Playwright, sin apt) y se comprueba que abra.
# Únicamente si no abre se instalan las dependencias con apt, con tope de tiempo.
set -u

for intento in 1 2 3; do
  npx playwright install chromium && break
  echo "Descarga de Chromium falló (intento $intento), reintento en 20 s"
  sleep 20
done

if node -e "require('@playwright/test').chromium.launch().then((b) => b.close()).catch(() => process.exit(1))"; then
  echo "Chromium listo, sin pasar por apt."
  exit 0
fi

echo "Chromium no abre: faltan librerías del sistema, se instalan con apt (tope 10 min)."
timeout -k 15 600 npx playwright install --with-deps chromium
