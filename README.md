# Tablero de proposiciones al Plan Nacional de Desarrollo 2018-2022

Tablero de control estático (HTML + CSS + JavaScript, sin dependencias externas) para el seguimiento de las
proposiciones presentadas por congresistas al **Plan Nacional de Desarrollo 2018-2022 «Pacto por Colombia, Pacto por
la Equidad»** (Ley 1955 de 2019; Proyecto de Ley 311/2019 Cámara – 227/2019 Senado).

> **Datos simulados.** Los 50 registros, los conceptos, los impactos fiscales y los radicados son simulados con fines
> demostrativos, y los nombres de los congresistas son ficticios. El calendario del trámite y la posición de los partidos
> frente al Gobierno (Estatuto de la Oposición, Ley 1909 de 2018) se basan en información pública. Este sitio no es un
> canal oficial del Congreso de la República ni del Departamento Nacional de Planeación.

## Qué contiene el tablero

| Elemento | Dónde |
|---|---|
| Trazabilidad cronológica | Gráfico semanal con 7 hitos del trámite + registro cronológico con la trazabilidad de cada proposición |
| Filtro por congresista | Barra de filtros y gráfico «Congresista» |
| Filtro por partido | Barra de filtros y gráfico «Partido» |
| Filtro Gobierno / Oposición / Independiente | Selector segmentado y gráfico «Posición frente al Gobierno» |
| Filtro por cámara | Selector segmentado y gráfico «Cámara» |
| Conteo de favorabilidad | Tarjetas superiores (clic para filtrar) y barras apiladas en todos los desgloses |
| Filtro por entidad | Barra de filtros y gráfico «Entidad líder del análisis» |
| Filtro por tipo de proposición | Barra de filtros y gráfico «Tipo de proposición» |
| Extras | Rango de fechas, chips de filtros activos, vista de tabla en cada gráfico, descarga CSV de la selección |

**Favorabilidad** (derivada de la columna *Estado*): Favorable = Acogida total o Aprobada · Parcialmente favorable =
Acogida parcial · Desfavorable = No acogida o Negada · Pendiente = En análisis · Retirada.

## Estructura del repositorio

```
├── index.html                 Página del tablero
├── assets/
│   ├── styles.css             Estilos
│   └── app.js                 Lógica (filtros, gráficos SVG, tabla, CSV)
├── data/
│   ├── proposiciones.js       Datos que lee la página (generado)
│   ├── proposiciones.json     Los mismos datos en JSON (generado)
│   └── Proposiciones_PND_2018-2022_diligenciado.xlsx   Cuadro fuente validado
├── notebooks/
│   └── generar_tablero_PND.ipynb   Notebook de Google Colab que valida el Excel y genera el sitio
├── INSTRUCCIONES_GITHUB.md
└── README.md
```

## Ver el tablero en el equipo

Abra `index.html` con doble clic (funciona sin servidor) o, desde la carpeta del proyecto:

```bash
python -m http.server 8000      # luego abra http://localhost:8000
```

## Actualizar los datos

1. Diligencie el Excel (hoja `Proposiciones (2)`; mantenga la hoja `Catalogos`, que alimenta las listas desplegables).
2. Abra `notebooks/generar_tablero_PND.ipynb` en [Google Colab](https://colab.research.google.com), ejecute todas las celdas y cargue el Excel cuando se le pida.
3. El notebook valida el cuadro (25 controles), regenera el sitio y descarga un ZIP. Reemplace en el repositorio la carpeta `data/` (o todo el contenido) y haga *commit*.

Controles de validación principales: campos obligatorios, IDs únicos, valores dentro de catálogos, fechas dentro del trámite
(6-feb a 25-may-2019), coherencia estado ↔ etapa del trámite, recomendación del Gobierno ↔ conceptos, congresista ↔ cámara/partido,
rangos del impacto fiscal.

## Publicar en GitHub Pages

Siga `INSTRUCCIONES_GITHUB.md`.

## Fuentes de contexto

- Ley 1955 de 2019 (Plan Nacional de Desarrollo 2018-2022).
- Gaceta del Congreso, trámite del Proyecto de Ley 311/2019 Cámara – 227/2019 Senado.
- Ley 1909 de 2018 (Estatuto de la Oposición) y declaraciones de los partidos frente al Gobierno 2018-2022.
