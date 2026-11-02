# Configuración final AO/HMI

## Regla principal
La configuración final debe estar en el bloque **AO** o **PWM** del programa FBD/Ladder. En el HMI selecciona **Automática — usar la configuración del bloque PLC**.

## Ejemplo 0–10 V
- AO1 entrada: 0–100 %
- AO1 salida: 0–10 V
- Válvula HMI: variable AO1, escala Automática
- Tanque: llenado AO1, escala Automática

Resultado: 6 V se interpreta como 60 % de apertura y 60 % de caudal.

## Ejemplo 4–20 mA
- AO2 entrada: 0–100 %
- AO2 salida: 4–20 mA
- Válvula HMI: variable AO2, escala Automática

Resultado: 12 mA se interpreta como 50 % de apertura.

## Split Range
- Salida LLENAR → AO1
- Salida VACIAR → AO2
- Tanque analógico:
  - Variable PLC 3: AO1
  - Variable PLC 4: AO2
  - Escala del mando: Automática

El HMI detecta y normaliza cada salida de manera independiente.
