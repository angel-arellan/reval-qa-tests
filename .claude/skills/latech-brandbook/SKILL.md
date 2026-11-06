---
name: latech-brandbook
description: Brandbook de Latech Factory (logos, colores, tipografía, voz y reglas de uso). Usar siempre que haya que producir o brandear material con la marca Latech: informes y PDFs para clientes, mails, presentaciones, documentos, páginas o artifacts, firmas o cualquier pieza que diga "Latech". También cuando pidan "brandear", "con la marca de Latech", "con el logo" o "con el brandbook".
---

# Brandbook de Latech Factory

Latech Factory es una agencia de ecommerce (Shopify Plus Partner) con el lema «Driving Ecommerce Excellence». La marca es sobria y moderna: mucho blanco, negro y un único color de acento, el azul Latech. Los títulos son grandes y finos, y hay aire alrededor de cada bloque.

> Origen de estos valores: los logos oficiales que pasó el CEO (nov-2026) y la tipografía y los colores que usa latechfactory.com. Si aparece un brandbook oficial en PDF con otros valores, ese manda: actualizar este archivo.

## Logos

Todos los archivos están en `assets/` (relativo a esta Skill). Son SVG de **800×800 con el logo chico en el centro**, así que **siempre hay que recortar el `viewBox`** con estos valores antes de usarlos. Si no se recorta, el logo queda diminuto y rodeado de blanco.

| Pieza | Archivos | viewBox recortado | Proporción |
|---|---|---|---|
| Logo completo (isologo + LATECH) | `logo-completo-azul.svg`, `logo-completo-negro.svg`, `logo-completo-blanco.svg` | `253.2 378.2 293.5 43.6` | 6,73 : 1 |
| Logo completo con contenedor | `logo-completo-contenedor-azul.svg`, `-negro.svg`, `-blanco.svg` | `251.5 376.5 297 47` | 6,32 : 1 |
| Isologo | `isologo-azul.svg`, `isologo-negro.svg`, `isologo-blanco.svg` | `358.2 358.2 83.6 83.6` | 1 : 1 |
| Isologo con contenedor | `isologo-contenedor-azul.svg`, `isologo-contenedor-negro.svg` | `353 353 94 94` | 1 : 1 |

Para recortar, reemplazar `width="800" height="800" viewBox="0 0 800 800"` por, por ejemplo, `height="28" viewBox="253.2 378.2 293.5 43.6"`. El ancho se calcula con la proporción.

`logo-completo-blanco.svg`, `isologo-azul.svg` e `isologo-negro.svg` (sin contenedor) se derivaron cambiando solo el `fill` de los oficiales.

Qué versión usar:
- **Fondo blanco o claro** → `logo-completo-azul` (principal) o `logo-completo-negro`.
- **Fondo negro, pizarra o azul** → `logo-completo-blanco` o `logo-completo-contenedor-blanco`.
- **Impresión en blanco y negro** → versiones negras.
- **Espacios chicos** (avatar, favicon, pie de página, marca de agua) → isologo, con o sin contenedor.
- La versión con contenedor (cuadrado redondeado) va cuando el logo necesita «apoyarse» en algo, por ejemplo un avatar o un ícono de app.

Reglas:
- **Área de resguardo**: alrededor del logo, dejar libre al menos la mitad de la altura del isologo.
- **Tamaño mínimo**: logo completo de 90 px (25 mm) de ancho; isologo de 16 px.
- **No** deformarlo, rotarlo ni ponerle sombras, contornos o degradés.
- **No** usarlo en colores fuera de azul, negro o blanco.
- **No** ponerlo sobre fondos o fotos sin contraste suficiente.

## Colores

| Nombre | Hex | Uso |
|---|---|---|
| **Azul Latech** | `#2447A4` | Color de marca. Acentos, títulos destacados, números grandes, líneas, links, botones. |
| Negro | `#000000` | Texto de títulos grandes, logo monocromo. |
| Tinta | `#171717` | Texto de cuerpo. |
| Blanco | `#FFFFFF` | Fondo principal. |
| Pizarra | `#23303B` | Fondos oscuros (bandas, portadas). |
| Gris fondo | `#F5F5F5` | Fondos de bloques y tarjetas. |
| Gris borde | `#D1D5DB` | Bordes y separadores. |
| Gris texto | `#8C939E` | Texto secundario, notas al pie, fechas. |
| Azul claro | `#E9EDF8` | Fondo suave para destacar un bloque (tinte del azul Latech). |

Proporción: casi todo blanco y negro, con el azul como **único** acento. No sumar otros colores de marca.

Colores de **estado**, solo para indicar resultados (nunca como decoración):
- OK: texto `#1E6B3A` sobre `#E3F3E8`
- Atención: texto `#8A5A00` sobre `#FDF1D8`
- Problema: texto `#9B2C22` sobre `#FBE3E1`

## Tipografía

**DM Sans** (Google Fonts, variable), la misma de latechfactory.com.

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&display=swap" rel="stylesheet">
```

```css
font-family: 'DM Sans', Helvetica, Arial, sans-serif;
```

- **Títulos grandes**: peso 300 (light), tamaño generoso, sin mayúsculas sostenidas. Es el rasgo más reconocible de la marca.
- **Subtítulos**: peso 600, tamaño chico o mediano.
- **Cuerpo**: peso 400, interlineado 1,5.
- **Etiquetas o rótulos**: peso 600, mayúsculas, tamaño chico, espaciado de letras de unos 1 px, en gris texto o azul.
- **Mails**: los programas de correo no cargan fuentes web, así que el respaldo es Helvetica o Arial. Igual declarar DM Sans primero.

## Formas y composición

- Mucho aire: márgenes amplios y bloques separados.
- Bordes redondeados suaves (6 a 10 px), en sintonía con el contenedor del isologo.
- Líneas finas (1 px) en gris borde para separar. Una línea o barra azul corta sirve como acento.
- Tablas limpias: sin rejilla completa, solo separadores horizontales.
- Nada de sombras pesadas, degradés ni emojis.

## Voz y tono

- Claro, directo y profesional, en español neutro rioplatense («vos» solo en comunicación interna o informal).
- Para clientes, sin tecnicismos: explicar qué se hizo y qué significa para su negocio.
- Positivo y concreto: primero lo que funciona y después las observaciones, cada una con su estado («ya solucionada», «en revisión»).
- Que no suene a texto generado por IA: frases cortas, nada de rellenos ni de palabras como «robusto», «integral» o «potenciar», y sin emojis.
- Firma: «Equipo de QA · Latech Factory» (o el área que corresponda) y `latechfactory.com`.

## Plantilla rápida (HTML / PDF)

```html
<header style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #D1D5DB">
  <!-- logo-completo-azul.svg con viewBox="253.2 378.2 293.5 43.6" height="26" -->
  <span style="font:600 8pt 'DM Sans',Helvetica,Arial;letter-spacing:1px;text-transform:uppercase;color:#8C939E">Título de la pieza</span>
</header>
<h1 style="font:300 28pt/1.15 'DM Sans',Helvetica,Arial;color:#000;margin:28px 0 4px">Nombre del cliente</h1>
<div style="width:40px;height:3px;background:#2447A4;margin:10px 0 18px"></div>
```

Pie de página: isologo azul de unos 10 px, más «Latech Factory · latechfactory.com» en gris texto, 7,5 pt.

## Dónde ya está aplicado

- Informe semanal de QA (PDF por proyecto y mail): `.github/scripts/reporte-semanal.js`, que toma colores y logos de `.github/scripts/marca-latech.js`. Ese módulo lee los logos de `assets/` de esta Skill.
