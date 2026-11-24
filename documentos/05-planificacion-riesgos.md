# Planificación y riesgos

> Cronograma, entregables y matriz de riesgos de SolarParaguana IA

**Proyecto:** SolarParaguana IA  
**Fecha:** 22 de noviembre de 2026

---

# 1. Propósito y enfoque

La planificación sigue un modelo incremental por sprints. Cada entrega deja un componente funcionando y verificable, de modo que el avance sea demostrable incluso antes de completar el producto final. El primer sprint se impactó en el backend y su despliegue ya fue ejecutado; los siguientes incorporan interfaz web, integración y móvil.

# 2. Plan de sprints

| Sprint | Objetivo | Entregables principales | Estado |
| --- | --- | --- | --- |
| 1 | Backend funcional | Cálculo, OCR, cotización, inventario, MCP | Completado |
| 2 | Interfaz web | SPA Angular, formularios y visualización de resultados | Planificado |
| 3 | Integración y calidad | Pruebas ampliadas, manejo de errores y pulido de flujos | Parcialmente anticipado |
| 4 | Aplicación móvil | Cliente Kotlin nativo con MVVM y Retrofit | Planificado |
| 5 | Despliegue y operación | Publicación, PM2, respaldos y actualizaciones APK | Backend publicado en Railway; pendientes respaldos y APK |

# 3. Cronograma propuesto

| Semana | Actividad | Resultado esperado |
| --- | --- | --- |
| 1 | Contexto, reglas y contratos | Documentos base del proyecto |
| 2 | Backend: cálculo e inventario | Endpoints de cálculo y stock |
| 3 | Backend: OCR y cotización | Flujo completo verificado |
| 4 | MCP, evidencia y cierre | Backend entregable y documentado |
| 5 en adelante | Frontend y móvil | Siguientes avances |

# 4. Entregables de este avance

| Entregable | Estado | Evidencia |
| --- | --- | --- |
| Documento principal | Listo | documentos/01-documento-principal.pdf |
| Estudio o investigación | Listo | documentos/02-estudio-investigacion.pdf |
| Requerimientos y casos de uso | Listo | documentos/03-requerimientos-casos-uso.pdf |
| Arquitectura y modelo de datos | Listo | documentos/04-arquitectura-modelo-datos.pdf |
| Planificación y riesgos | Listo | documentos/05-planificacion-riesgos.pdf |
| Repositorio backend | Listo | github.com/Jaren2402/solarparaguana-ia |
| README y manual | Listo | README.md |
| Documentación API / Postman | Listo | postman/SolarParaguana.postman_collection.json |
| Evidencia de pruebas | Listo | evidence/smoke-test-result.txt |
| URL del backend desplegado | Listo | https://solarparaguana-ia-production.up.railway.app |

# 5. Matriz de riesgos

| Riesgo | Prob. | Impacto | Mitigación |
| --- | --- | --- | --- |
| MongoDB no disponible | Media | Medio | Conexión no bloqueante; cálculo sigue activo |
| Falta de token de Telegram | Alta | Bajo | Modo degraded y aviso legible |
| Datos OCR incorrectos | Media | Alto | Borrador con confianza y confirmación obligatoria |
| Sin stock local | Media | Medio | Error 409 y sugerencia de revisión |
| Cambios de Node en el hosting | Media | Alto | Declarar versión compatible y probar arranque |
| Secretos versionados | Baja | Alto | .gitignore y revisión antes de cada commit |
| Retraso en el despliegue | Baja | Bajo | Cerrado: Railway y Atlas verificados el 23/11 |

# 6. Hitos de aceptación

- El backend arranca sin errores en el puerto 18512.
- Las 15 pruebas automatizadas devuelven el estado esperado.
- El presupuesto de referencia es USD 3.865 con stock real.
- El repositorio no contiene .env ni node_modules.
- Los cinco documentos se encuentran disponibles en PDF y Markdown.

# 7. Recursos y supuestos

- Node.js 26, npm y Git en el entorno de desarrollo.
- MongoDB local para desarrollo y MongoDB Atlas para producción.
- Cuenta de GitHub para el repositorio y cuenta de hosting para la URL publica.
- Los valores de inventario corresponden al catálogo sembrado en este avance.

# 8. Seguimiento y control

El estado de cada decisión y de cada incidencia queda registrado en la carpeta memory del repositorio. Ante un cambio de arquitectura se actualiza architecture_decisions.md; ante un error resuelto se documenta la causa, la solución y la verificación en error_solutions.md. Este registro permite retomar el trabajo en cualquier punto sin depender de conversaciones previas.
