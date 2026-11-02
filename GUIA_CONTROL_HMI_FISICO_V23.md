# Control HMI / físico V23

La comunicación USB de la V41 se conserva sin cambios.

## Modos

### Control HMI
- Entradas NO de mando: solo responde el HMI.
- Entradas NC de seguridad: el contacto físico y el HMI deben permanecer cerrados.
- Un STOP, emergencia o protección física puede detener aunque el mando esté en HMI.

### Control físico
- Solo responden las entradas físicas.
- Los controles HMI quedan bloqueados.
- La pantalla sigue mostrando entradas y salidas.

### HMI + físico
- Contactos NO: `FÍSICO OR HMI`. Cualquiera puede activar.
- Contactos NC: `FÍSICO AND HMI`. Cualquiera que abra puede detener.

## Prueba de arranque directo

Entradas sugeridas:
- I1: emergencia NC.
- I2: STOP NC.
- I3: START NO.
- Q1: motor o LED.

### Control HMI
1. START HMI: Q1 activa.
2. STOP HMI: Q1 desactiva.
3. Emergencia HMI: Q1 desactiva.
4. START físico: no arranca.
5. STOP o emergencia física: sí detiene por seguridad.

### Control físico
1. START físico: Q1 activa.
2. STOP físico: Q1 desactiva.
3. Emergencia física: Q1 desactiva.
4. Los botones HMI no envían órdenes.

### HMI + físico
1. START HMI o START físico: cualquiera activa.
2. STOP HMI o STOP físico: cualquiera desactiva.
3. Emergencia HMI o física: cualquiera desactiva.

## Verificación del código generado

Debe contener:

```cpp
// ===== SIMUPLC HMI READY CODE V23 =====
const bool hmiInputIsNc[HMI_SAFE_INPUT_COUNT]={...};
const uint8_t HMI_DEFAULT_CONTROL_MODE=...;
```

Valores del modo:
- `0`: HMI + físico.
- `1`: Control HMI.
- `2`: Control físico.
