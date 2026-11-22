# Documentos del proyecto — SolarParaguaná IA

Esta carpeta contiene los cinco documentos solicitados en la rúbrica, cada uno en **dos formatos**:

- **`.pdf`** → para subirlos con la opción *Subir archivo* de la plataforma.
- **`.md`** → para entregarlos con la opción *Enlace* apuntando al repositorio.

## Índice

| # | Documento | PDF | Markdown | Páginas |
|---|---|---|---|---|
| 1 | Documento principal del proyecto | [`01-documento-principal.pdf`](01-documento-principal.pdf) | [`01-documento-principal.md`](01-documento-principal.md) | 4 |
| 2 | Estudio e investigación | [`02-estudio-investigacion.pdf`](02-estudio-investigacion.pdf) | [`02-estudio-investigacion.md`](02-estudio-investigacion.md) | 4 |
| 3 | Requerimientos y casos de uso | [`03-requerimientos-casos-uso.pdf`](03-requerimientos-casos-uso.pdf) | [`03-requerimientos-casos-uso.md`](03-requerimientos-casos-uso.md) | 4 |
| 4 | Arquitectura y modelo de datos | [`04-arquitectura-modelo-datos.pdf`](04-arquitectura-modelo-datos.pdf) | [`04-arquitectura-modelo-datos.md`](04-arquitectura-modelo-datos.md) | 4 |
| 5 | Planificación y riesgos | [`05-planificacion-riesgos.pdf`](05-planificacion-riesgos.pdf) | [`05-planificacion-riesgos.md`](05-planificacion-riesgos.md) | 3 |

## Fuentes utilizadas

El contenido se elaboró a partir de:

- `context/system_context.md` — contexto de negocio y público objetivo.
- `context/business_rules.md` — constantes, fórmulas y reglas de negocio.
- `context/api_contracts.md` — contratos de los endpoints.
- `memory/architecture_decisions.md` — decisiones de diseño.
- `memory/error_solutions.md` — incidencias detectadas y resueltas.
- `evidence/` y `postman/` — resultados reales de las pruebas.

## Cómo regenerarlos

Desde la raíz del repositorio:

```powershell
python projects\backend\scripts\generate_documentos.py
```

El generador (`projects/backend/scripts/generate_documentos.py`) define el contenido **una sola vez** y renderiza los dos formatos, por lo que PDF y Markdown siempre coinciden. Necesita Python con el paquete `reportlab`:

```powershell
pip install reportlab
```

Si haces un cambio en el contenido, vuelve a ejecutar el script y sube ambos formatos juntos para mantenerlos sincronizados.

## Verificación realizada

- Los cinco PDF empiezan con `%PDF-1.4`, tienen `xref` y `%%EOF`, y entre 3 y 4 páginas cada uno.
- Se extrajo el texto de los streams (ASCII85 + Flate) y se comprobó que las tildes y los términos clave están presentes.
- Los ejemplos numéricos coinciden con la evidencia real: **12,3 kWh/día**, **5 paneles**, **inversor 5 kVA**, **USD 3.865**.
