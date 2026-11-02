# Proceso Banda + expulsor neumático

Variables de la plantilla:

- I1 START
- I2 STOP NC
- I3 sensor fotoeléctrico de caja
- I4 cilindro retraído
- I5 cilindro extendido
- Q1 motor de la banda
- Q2 extender cilindro
- Q3 retraer cilindro

El HMI mueve la caja cuando Q1 está activa. Al cruzar el sensor se genera I3. Q2/Q3 mueven el cilindro y sus posiciones generan I4/I5. Con Arduino conectado, las salidas reales animan el proceso y las entradas virtuales se envían al programa según el modo global HMI/Físico/Ambos.


## Secuencia recomendada en FBD/Ladder

1. START con STOP habilitado activa Q1.
2. I3 detiene Q1 y ordena extender con Q2.
3. I5 confirma extendido y conmuta de Q2 a Q3.
4. I4 confirma retraído, apaga Q3 y permite reiniciar Q1.

La plantilla coloca y vincula los componentes; la secuencia se ejecuta con el programa que diseñes en FBD/Ladder o con el código cargado en Arduino.

En las propiedades del cilindro y de la banda puedes ajustar la velocidad. La banda permite escoger el sentido y el cilindro su posición inicial.
