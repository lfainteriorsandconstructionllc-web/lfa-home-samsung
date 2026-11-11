# LFA Home para Samsung Tizen

Lanzador para televisores y proyectores Samsung con Tizen. Reúne aplicaciones, entradas y canales compatibles en una interfaz manejable con el mando. La biblioteca se construye con las aplicaciones visibles que devuelve el televisor.

## Compilar e instalar

1. Desde la raíz del repositorio, ejecuta `python3 instalar.py`. El paquete sin firmar queda en `build/Home-unsigned.wgt`.
2. Para firmar, configura un perfil Samsung TV en el Certificate Manager de Tizen Studio y deja el comando `tizen` en tu PATH. Ejecuta `python3 instalar.py --profile NOMBRE_DEL_PERFIL`.
3. Con un dispositivo de desarrollo conectado, puedes firmar e instalar con `python3 instalar.py --profile NOMBRE_DEL_PERFIL --target IDENTIFICADOR --install`.

El tiempo se configura desde Ajustes. Las tarjetas usan los iconos que proporciona el dispositivo y muestran iniciales cuando no pueden cargarlos. La disponibilidad de aplicaciones, sintonizador y reproducción depende del modelo y de la región.

El código se distribuye con la licencia MIT incluida. Los nombres comerciales pertenecen a sus respectivos titulares.
