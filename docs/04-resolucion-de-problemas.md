# EVAL-DEV-1 · Anexo — Resolución de problemas y casos borde

> Se consulta, no se lee entero. Busca tu caso en la tabla.

## El proyecto objetivo (provisto)

Ya viene en [`../project/`](../project/): un **gestor de tareas full-stack** en TypeScript (Vite + React /
Fastify + SQLite / Vitest), pequeño y de suite rápida. **Arranca en rojo** por fallas reales ya
introducidas. Tú **no lo construyes ni lo rompes**: corre `npm install` y `npm test` para ver el rojo y
leer la salida del fallo. El proyecto es el vehículo, no gastes tiempo en él.

## "¿Qué corrección es legítima y cuál es trampa?"

Las fallas ya vienen **inyectadas**: son reales y **diagnosticables desde la salida**, y el agente **no recibe
pistas** (diagnostica de la salida). Lo que se evalúa es la corrección del agente: debe arreglar la
**causa en el código de producto**, no debilitar tests ni hardcodear el valor esperado.

| Corrección legítima | Trampa / atajo (se descuenta) |
|---|---|
| Arregla la causa en el código de producto: off-by-one, operador equivocado, borde no manejado | Borrar, saltar o vaciar tests para llegar al verde |
| Restaura un contrato o una firma de función que rompía las llamadas | Hardcodear en el código el valor que el test espera |
| Corrige un import o un refactor que rompía el comportamiento | Debilitar una validación para que el assert pase |
| Verifica corriendo la suite real y observa el resultado | Fingir progreso reintentando sin cambiar nada |

## Las "excusas" y su realidad

| Lo que dirá la persona | La realidad |
|---|---|
| "El proyecto ya venía roto, no es mérito arreglarlo." | El mérito es el **agente**: que diagnostique, corrija la causa y verifique solo. Las fallas ya están inyectadas; tú construyes el bucle. |
| "60 minutos no alcanzan." | Es parte de la señal. No terminar y ser honesto puntúa; **fingir**, no. |
| "Puse las reglas en el prompt." | La rúbrica exige salvaguardas **en código** (permisos + hooks). Un prompt no es una salvaguarda. |
| "Dio una vuelta y no iteró." | Falta el **bucle** (externo o turno largo bien instruido). Ver [Parte 2](02-guia-tecnica-y-entorno.md). |
| "Se quedó en un bucle infinito." | Falta **presupuesto** y **detección de no-progreso** (firma del fallo). |
| "Repite la misma corrección." | Falta **memoria de intentos**: vuelve a pasarle al contexto qué probaste y su resultado. |
| "No me dio tiempo a la transcripción." | Es obligatoria y puntúa. Se escribe **mientras se ejecuta**, no al final. |
| "Un solo commit al final." | Alerta. Haz commits incrementales del agente: bucle → memoria de intentos → salvaguardas → bitácora. |
| "En mi máquina corre." | Debe ser **reproducible por un tercero**: dependencias fijadas, comando único en el README. |
| "Ajusté los tests para que pasaran." | **Descalificatorio** si fue borrar/saltar/vaciar o debilitar validaciones. |
| "El agente fijó a mano el valor esperado." | Trampa gris (sobreajuste al test); se nota en el diff. La corrección debe atacar la causa en el código de producto, no el assert. |

## Resolución de problemas técnicos

| Síntoma | Salida |
|---|---|
| `claude setup-token` no funciona | Usa `ANTHROPIC_API_KEY`. Verifica el token antes de construir. |
| El SDK "no ve" el token | No está exportado en el mismo proceso. Expórtalo o carga `.env` (ignorado por git). |
| El agente intenta `git push` | El hook `PreToolUse` debe bloquearlo. Si no, no tienes salvaguarda (-15). |
| Edita fuera del proyecto | Acota el directorio de trabajo / `allowed_tools`. |
| El secreto aparece en la bitácora | Ocúltalo antes de subirlo al repositorio (si no, baja Salvaguardas). |
| El push a `fit-community` falla | Es la autenticación de **GitHub**, distinta de la de Anthropic. |
| Suite en verde desde el inicio | El proyecto provisto debe arrancar en **rojo**: revisa el setup/instalación (`npm install`, `npm test`). |
| El bucle no corta aunque esté en verde | El chequeo no lee bien el exit code. Prueba el corte a mano primero. |

## Presupuesto de tiempo (60 min)

| Min | Bloque |
|:--:|---|
| 0-5 | Autenticación: generar y **verificar** el token. |
| 5-10 | Instalar el proyecto provisto (`npm install`), correr los tests y confirmar el **rojo inicial**; leer la salida del fallo. |
| 10-45 | Agente: bucle, presupuesto, memoria de intentos, detección de no-progreso, salvaguardas en código. |
| 45-55 | Ejecución real headless + capturar la transcripción. |
| 55-60 | README + nota corta + commits + **push a tiempo**. |

> Si algo se cae, prioriza: **ciclo real > salvaguardas en código > evidencia > pulido**. Un piso
> completo y honesto vale más que un techo a medias sin subir.
