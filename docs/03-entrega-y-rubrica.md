# Parte 3 — Entrega y evaluación

> Qué se entrega y cómo se corrige. El encargo está en [01](01-encargo-y-contexto.md) y la guía técnica en [02](02-guia-tecnica-y-entorno.md).

## Dónde y cuándo

En GitHub, con push **antes de los 60 min**. Dos vías válidas:

- **PR abierta contra `main`** de este repositorio, con tu nombre.
- **Repositorio propio en tu GitHub, con tu cuenta corporativa (@factorit).**

Lo que no esté en GitHub al cierre, no se evalúa.

## Qué se entrega (4 artefactos)

1. **Código del agente**, con commits **incrementales** (no uno solo al final). El proyecto objetivo ya
   viene en [`../project/`](../project/): no se reconstruye ni se sube de nuevo.
2. **README breve:** qué hace, cómo se configura el token, comando único para ejecutarlo headless.
3. **Transcripción de una ejecución real:** diagnóstico → intento → resultado de tests → parada (verde o
   presupuesto agotado). Es también la evidencia de que la autenticación funciona.
4. **Nota corta:** alcance del agente, criterio de parada, cómo evitas el bucle infinito, qué hace cuando
   no puede arreglar algo, y qué te faltó por tiempo.

## Rúbrica (100 pts)

| Dimensión | Pts | Qué se evalúa |
|---|:--:|---|
| Configuración y autenticación | 15 | Token por variable de entorno; secreto fuera del repositorio; ejecución headless reproducible. |
| **Diseño del bucle** | 25 | Ciclo razonamiento-acción funciona; parada y presupuesto explícitos; **converge** en vez de girar. |
| Recuperación ante fallas | 20 | Cierra un ciclo real; si un intento falla no lo repite; cuando no puede, se detiene con explicación. |
| Salvaguardas y seguridad | 15 | Mínimo privilegio; nada destructivo; no push sin permiso; secreto no se filtra. **En código, no en el prompt.** |
| Juicio bajo tiempo | 15 | Decisiones del agente razonables (alcance, presupuesto, estrategia); llegó a algo que corre; honesto sobre lo que faltó. |
| Bitácora e higiene | 10 | Se sigue qué hizo el agente; código legible; subido a tiempo. |

**Umbral (abierto, a fijar con el evaluador):** sugerencia **70/100** = "construye agentes con
supervisión"; **85+** = autonomía real bajo presión.

## Anti-trampa (señales de descarte o alerta)

- **Falsear tests** para llegar al verde: descarte inmediato. El proyecto viene provisto, pero eso no cambia nada: debilitar la suite es descarte igual.
- **Un solo commit** al cierre o **sin transcripción** de un ciclo real: alerta.
- **Sobreajustar la corrección al test** (hardcodear el valor esperado en vez de arreglar la causa): trampa gris, se nota en el diff.

## Piso y techo

- **Piso:** headless con OAuth; **un** ciclo de reparación legítimo; salvaguardas básicas; para por
  presupuesto; subido a tiempo.
- **Techo:** además, se **recupera de un intento fallido** sin repetirlo; se **detiene con diagnóstico**
  cuando no puede; presupuesto bien pensado; bitácora que muestra el **razonamiento**, no solo el resultado.
