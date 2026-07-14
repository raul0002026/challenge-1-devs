# EVAL-DEV-1 · Anexo — Resolución de problemas y casos borde

> Se consulta, no se lee entero. Busca tu caso en la tabla.

## "¿Qué construyo?"

Algo **pequeño con suite de tests real** (≤ 10 archivos, corre en segundos). Créalo con Claude Code en
2-3 min: el proyecto es el vehículo, no gastes tiempo en él.

| Opción | Riesgo |
|---|---|
| Librería mínima **Python + pytest** (utilidades, parser, calculadora) | Casi ninguno. **Recomendado.** |
| Paquete **Node/TS + vitest/jest** | Configuración de herramientas algo mayor. |
| **Repositorio público** existente | Agujero de tiempo en dependencias/entorno. Solo si lo conoces y sus tests corren rápido. |
| App con framework (Next, Django...) | Se come la hora en el montaje inicial. **Evítalo.** |

## "¿Contra qué lo pruebo? ¿Cómo lo rompo sin que sea trampa?"

Introducir la falla **no es trampa**; falsear tests **sí**. La falla debe ser **real y diagnosticable
desde la salida** (mejor varios tests en rojo por una causa real que uno trivial). El agente **no recibe
pistas**: diagnostica de la salida.

| Falla legítima (úsala) | Ilegítima / trivial (evítala) |
|---|---|
| Error de lógica: off-by-one, operador equivocado, borde no manejado | Error de sintaxis obvio |
| Firma de función cambiada que rompe las llamadas | `throw new Error("boom")` que el agente solo borra |
| Refactor que rompe un contrato o un import | Comentar una línea que se restaura sin diagnóstico |
| Actualización de una dependencia que cambia el comportamiento | Fallo que se "arregla" reintentando sin cambiar nada |

## Las "excusas" y su realidad

| Lo que dirá la persona | La realidad |
|---|---|
| "Si yo introduzco el error, es trampa." | No. Romperlo tú es parte. La trampa es falsear tests o un error de juguete. |
| "60 minutos no alcanzan." | Es parte de la señal. No terminar y ser honesto puntúa; **fingir**, no. |
| "Puse las reglas en el prompt." | La rúbrica exige salvaguardas **en código** (permisos + hooks). Un prompt no es una salvaguarda. |
| "Dio una vuelta y no iteró." | Falta el **bucle** (externo o turno largo bien instruido). Ver [Parte 2](02-guia-tecnica-y-entorno.md). |
| "Se quedó en un bucle infinito." | Falta **presupuesto** y **detección de no-progreso** (firma del fallo). |
| "Repite la misma corrección." | Falta **memoria de intentos**: vuelve a pasarle al contexto qué probaste y su resultado. |
| "No me dio tiempo a la transcripción." | Es obligatoria y puntúa. Se escribe **mientras se ejecuta**, no al final. |
| "Un solo commit al final." | Alerta. Haz commits incrementales: crear → romper → agente → salvaguardas. |
| "En mi máquina corre." | Debe ser **reproducible por un tercero**: dependencias fijadas, comando único en el README. |
| "Ajusté los tests para que pasaran." | **Descalificatorio** si fue borrar/saltar/vaciar o debilitar validaciones. |
| "El agente fijó a mano el valor esperado." | Trampa gris (sobreajuste al test); se nota en el diff. Diseña la falla para que la corrección real sea más fácil que el atajo tramposo. |

## Resolución de problemas técnicos

| Síntoma | Salida |
|---|---|
| `claude setup-token` no funciona | Usa `ANTHROPIC_API_KEY`. Verifica el token antes de construir. |
| El SDK "no ve" el token | No está exportado en el mismo proceso. Expórtalo o carga `.env` (ignorado por git). |
| El agente intenta `git push` | El hook `PreToolUse` debe bloquearlo. Si no, no tienes salvaguarda (-15). |
| Edita fuera del proyecto | Acota el directorio de trabajo / `allowed_tools`. |
| El secreto aparece en la bitácora | Ocúltalo antes de subirlo al repositorio (si no, baja Salvaguardas). |
| El push a `fit-community` falla | Es la autenticación de **GitHub**, distinta de la de Anthropic. |
| Suite en verde desde el inicio | No hay nada que sanar: confirma **rojo inicial**. |
| El bucle no corta aunque esté en verde | El chequeo no lee bien el exit code. Prueba el corte a mano primero. |

## Presupuesto de tiempo (60 min)

| Min | Bloque |
|:--:|---|
| 0-5 | Autenticación: generar y **verificar** el token. |
| 5-15 | Crear proyecto + suite en verde + introducir la falla real. |
| 15-40 | Agente: bucle, presupuesto, memoria de intentos, salvaguardas. |
| 40-50 | Ejecución real headless + capturar la transcripción. |
| 50-60 | README + nota corta + commits + **push a tiempo**. |

> Si algo se cae, prioriza: **ciclo real > salvaguardas en código > evidencia > pulido**. Un piso
> completo y honesto vale más que un techo a medias sin subir.
