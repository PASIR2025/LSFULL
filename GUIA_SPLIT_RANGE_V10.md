# Guía: Control bidireccional / Split Range — SimuPLC 1.2 V10

## Objetivo

El bloque **SPLIT** divide una orden analógica en dos salidas mutuamente excluyentes:

- **LLENAR**: abre la válvula de entrada o acciona el actuador en sentido positivo.
- **VACIAR**: abre la válvula de salida o acciona el actuador en sentido negativo.

Nunca entrega simultáneamente un valor mayor que cero en las dos salidas.

## Parámetros

- **Entrada mínima / máxima**: rango que recibe desde el PID u otro bloque analógico.
- **Punto neutro**: valor en el que ambas salidas quedan cerradas.
- **Zona muerta total**: banda alrededor del neutro donde ambas salidas quedan en cero.
- **Salida máxima**: máximo entregado por LLENAR y VACIAR.
- **Limitar al rango**: restringe la entrada entre los límites configurados.

## Ejemplo recomendado con PID de 0 a 100 %

Configure:

- PID: salida mínima `0`, salida máxima `100`.
- SPLIT: entrada `0…100`, neutro `50`, zona muerta `2`, salida máxima `100`.

Conexión FBD o Ladder:

```text
AI1 (nivel real) ───────────────→ PV del PID
AI2 (consigna manual) ──────────→ SP del PID
PID1 ───────────────────────────→ IN de SPLIT1
SPLIT1 / LLENAR ────────────────→ PWM1
SPLIT1 / VACIAR ────────────────→ PWM2
```

En el HMI:

```text
Tanque analógico: AI1, modo Proceso virtual
Mando de llenado: PWM1
Mando de vaciado: PWM2
Consigna: AI2, modo Manual HMI
Válvula de entrada proporcional: PWM1
Válvula de salida proporcional: PWM2
```

Comportamiento con neutro 50 y zona muerta 2:

- Entrada SPLIT mayor que `51`: LLENAR aumenta proporcionalmente; VACIAR queda en cero.
- Entrada entre `49` y `51`: ambas quedan en cero.
- Entrada menor que `49`: VACIAR aumenta proporcionalmente; LLENAR queda en cero.

## Alternativa con PID de -100 a +100

También puede configurar:

- PID: salida mínima `-100`, salida máxima `100`.
- SPLIT: entrada `-100…100`, neutro `0`, zona muerta `2`, salida máxima `100`.

Esta alternativa representa de forma directa:

- salida positiva: llenar;
- salida negativa: vaciar;
- salida cercana a cero: cerrar ambas válvulas.

## Generación C++

El bloque se genera tanto para FBD como para Ladder. Al elegir la placa, SimuPLC adapta:

- ADC de Arduino AVR a `0…1023`;
- ADC de ESP32 a `0…4095`;
- PWM de Arduino mediante `analogWrite()`;
- PWM de ESP32 mediante LEDC compatible con los cores 2.x y 3.x;
- comunicación USB/OTG a 115200 baudios.

Para Arduino UNO puede utilizar, por ejemplo:

```text
AI1 → A0
AI2 → A1
PWM1 → D9
PWM2 → D10
```

No conecte una electroválvula, motor o carga inductiva directamente al pin. Utilice MOSFET o driver, diodo de rueda libre, fuente externa apropiada y tierra común.

## Guardado del proyecto

El proyecto completo conserva:

- parámetros del bloque SPLIT;
- sus dos conexiones independientes;
- la salida LLENAR (`out1` / `fill`);
- la salida VACIAR (`out2` / `drain`);
- FBD, Ladder y HMI.

## Servo y motor paso a paso

SPLIT puede generar dos órdenes proporcionales de alto nivel, pero **no debe controlar directamente** un servo o un motor paso a paso.

- Un **servo** necesita un bloque específico de posición: ángulo `0…180°`, pulsos de aproximadamente 50 Hz y generación compatible con la placa.
- Un **motor paso a paso** necesita un bloque específico `STEP/DIR`: posición, número de pasos, frecuencia, aceleración, desaceleración, sentido, homing y finales de carrera.

Por ello, SERVO y STEPPER deben añadirse como bloques separados. SPLIT podrá utilizarse más adelante como orden de dirección o demanda, pero no sustituye la temporización especializada de esos actuadores.
