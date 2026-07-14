# EVAL-DEV-1 · Parte 3 — Entrega y evaluación

> Qué se entrega y cómo se corrige. El encargo está en [01](01-encargo-y-contexto.md) y la guía técnica en [02](02-guia-tecnica-y-entorno.md).

## Dónde y cuándo

En GitHub, con push **antes de los 60 min**. Dos vías válidas:

- **Preferida:** FIT Community (`FACTORIT-INGENIERIA/fit-community`), en una carpeta o repositorio **con tu nombre**.
- **Alternativa:** un **repositorio personal creado con tu cuenta corporativa**.

Lo que no esté en GitHub al cierre, no se evalúa.

## Qué se entrega (4 artefactos)

1. **Código del agente + su proyecto objetivo**, con commits **incrementales** (no uno solo al final).
2. **README breve:** qué hace, cómo se configura el token, comando único para ejecutarlo headless.
3. **Transcripción de una ejecución real:** diagnóstico → intento → resultado de tests → parada (verde o
   presupuesto agotado). Es también la evidencia de que la autenticación funciona.
4. **Nota corta:** objetivo elegido, criterio de parada, cómo evitas el bucle infinito, qué hace cuando
   no puede arreglar algo, y qué te faltó por tiempo.

## Rúbrica (100 pts)

| Dimensión | Pts | Qué se evalúa |
|---|:--:|---|
| Configuración y autenticación | 15 | Token por variable de entorno; secreto fuera del repositorio; ejecución headless reproducible. |
| **Diseño del bucle** | 25 | Ciclo razonamiento-acción funciona; parada y presupuesto explícitos; **converge** en vez de girar. |
| Recuperación ante fallas | 20 | Cierra un ciclo real; si un intento falla no lo repite; cuando no puede, se detiene con explicación. |
| Salvaguardas y seguridad | 15 | Mínimo privilegio; nada destructivo; no push sin permiso; secreto no se filtra. **En código, no en el prompt.** |
| Juicio bajo tiempo | 15 | Objetivo razonable (no trivial, falla real); llegó a algo que corre; honesto sobre lo que faltó. |
| Bitácora e higiene | 10 | Se sigue qué hizo el agente; código legible; subido a tiempo. |

**Umbral (abierto, a fijar con el evaluador):** sugerencia **70/100** = "construye agentes con
supervisión"; **85+** = autonomía real bajo presión.

## Anti-trampa (señales de descarte o alerta)

- **Falsear tests** para llegar al verde: descarte inmediato. No hay escudo de "el repositorio venía así".
- **Un solo commit** al cierre o **sin transcripción** de un ciclo real: alerta.
- **Objetivo trivial** para ganar fácil: se evalúa como lo que es.

## Piso y techo

- **Piso:** headless con OAuth; **un** ciclo de reparación legítimo; salvaguardas básicas; para por
  presupuesto; subido a tiempo.
- **Techo:** además, se **recupera de un intento fallido** sin repetirlo; se **detiene con diagnóstico**
  cuando no puede; presupuesto bien pensado; bitácora que muestra el **razonamiento**, no solo el resultado.
