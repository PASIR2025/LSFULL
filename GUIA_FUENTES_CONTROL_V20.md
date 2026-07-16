# Fuentes de control V20

## Solo HMI
El pin físico se ignora. Es la opción para trabajar sin pulsadores, selectores o emergencia físicos.

- NO: HMI en reposo 0; accionado 1.
- NC: HMI en reposo 1; accionado 0.

## Solo física
La entrada efectiva depende del pin. El HMI muestra el estado, pero su mando virtual no interviene.

## Física + HMI automática
- Contacto NO: `FISICA OR HMI`. Cualquiera activa.
- Contacto NC: `FISICA AND HMI`. Cualquiera abre y desactiva.

## Permiso compartido
Usa `FISICA AND HMI`. Se recomienda para habilitaciones y selectores donde cualquiera debe poder retirar el permiso.

## Emergencia virtual
Para una práctica sin emergencia física:

- Tipo: NC.
- Fuente: Solo HMI.
- Estado inicial HMI: 1.

Al presionarla pasa a 0. El rearranque depende de la lógica FBD/Ladder programada.

## Prueba incluida
`hardware/PRUEBA_FUENTES_HMI_V20.ino`
