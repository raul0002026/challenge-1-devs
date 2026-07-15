# Parte 1 — El encargo

> Empieza por aquí: qué se construye y por qué. Sigue con la guía técnica en [02](02-guia-tecnica-y-entorno.md) y la entrega y evaluación en [03](03-entrega-y-rubrica.md).

## Qué es la prueba

Prueba de desempeño de **60 minutos**, no de conocimiento. No se pregunta si sabes: se te pide
**construir desde cero un agente autónomo que funcione**, apoyándote en Claude Code + Agent SDK. Aquí
el resultado no se finge: un agente corre o no corre, un bucle converge o gira en vano, un build queda
en verde legítimo o hecho con trampa.

Se te entrega el **proyecto objetivo** ya listo y **pre-roto** en [`../project/`](../project/): su
suite de tests arranca en rojo por fallas reales ya inyectadas. Tú no lo construyes ni lo rompes; construyes el
**agente** que lo sana. La herramienta (Claude Agent SDK) y el token los pones tú.

## El encargo

> Construye un **agente autorreparable** (self-healing): mantiene sano un proyecto **sin intervención
> humana**. Cuando el build o los tests se rompen, **diagnostica, aplica una corrección, verifica y
> repite** hasta recuperar el verde o agotar un presupuesto que tú defines, recuperándose de sus
> intentos fallidos y dejando bitácora.

| Término | Qué significa en concreto |
|---|---|
| Sin intervención humana | Se invoca una vez y trabaja hasta su criterio de parada. |
| Diagnostica | Lee la salida real de tests/build y razona la causa. Sin pistas. |
| Aplica una corrección | Edita **código de producto**, no los tests. |
| Verifica | Corre la suite de tests por el camino real y observa el resultado. |
| Repite hasta... | Itera mientras siga en rojo y quede presupuesto. |
| Presupuesto | Criterio de parada explícito (iteraciones, tokens o tiempo). Tú lo eliges y justificas. |
| Se recupera | Si una corrección falla, no repite el mismo error: cambia de estrategia. |
| Bitácora | Registro que deja ver el razonamiento del bucle, no solo el resultado. |

Se espera un agente que **funcione de verdad sobre una falla real**, no un ejercicio de juguete. Si la
hora no alcanza, esa también es la señal: no se penaliza no terminar, se penaliza **fingir** que
terminaste.

## Regla de integridad (DESCALIFICATORIA)

Recuperar el verde **borrando, saltando o vaciando tests, o debilitando las validaciones** es hacer
trampa con la métrica: no aprueba, por bien construido que esté el resto. El proyecto viene provisto,
pero eso **no** habilita debilitar la suite: no vale el escudo de "el repositorio venía así".

## Qué decides tú

La **arquitectura del agente y su bucle**, el alcance, el presupuesto y el criterio de parada, la
estrategia de recuperación y las salvaguardas. El proyecto objetivo y su falla ya vienen dados; lo que
revela criterio es **cómo diseñas el agente**. Cada elección es deliberada y el evaluador puede cuestionarla.
