# Manual de Operación — El Puesto del Pueblo

Guía rápida del día a día. Si algo falla, busca el síntoma acá.

---

## Rutina diaria

**Al abrir**
1. Toca tu nombre en "¿Quién vende hoy?" e ingresa tu PIN.
2. La app pide el **fondo de caja inicial**: cuenta el efectivo con el que partes, escríbelo y toca **Confirmar** (o Enter).
3. Si vas a cobrar con Mercado Pago: Stock → "Verificar" y confirma que salga en verde.

**Al cerrar**
1. CIERRE → Generar Reporte.
2. Cuenta el efectivo físico y anótalo en "Efectivo contado físicamente".
3. "Enviar cierre al libro (Make)" → debe quedar en "Enviado al libro ✓".
4. Stock → "Descargar Respaldo" y guárdalo fuera de la tablet.
5. Recién ahí "Finalizar Turno y Resetear". Si no enviaste el cierre, la app te avisa.

---

## Cómo se vende

- **Por unidad** (lechuga, sandía entera, zapallo): toca el producto.
- **Por atado** (cilantro, perejil, albahaca): toca el producto.
- **Por peso** (tomate, papa, manzana, trozos de sandía): pesa y escribe los gramos, o usa "por monto" si el cliente pide "$X de…" (la app te dice cuánto poner en la balanza).
- **Jugo natural:** elige la fruta y los extras.
- **Descuentos:** por ítem (3x2, 2x1, %). Lo que se pierde sin vender (se echó a perder, se aplastó) se registra como **merma** desde Stock, no como descuento.
- En efectivo el total se redondea a $10.

## Compras (lo que compras para vender)

COMPRAS → **Registrar compra**:
1. Proveedor (opcional) y, por cada producto comprado, la **cantidad** (kg si se vende por peso; unidades si no) y el **costo total** de esa línea. La app te muestra el costo por kilo/unidad y a cuánto lo vendes.
2. **Pagado ahora** (por defecto todo) y medio de pago. Lo que no pagas queda como deuda al proveedor en PASIVOS.
3. Foto de la boleta/guía y n° de operación: opcionales.
4. Al registrar: **suma al stock**, actualiza el costo (puedes desmarcarlo) y, si pagaste en efectivo, ese dinero **sale del arqueo** del turno.
- Si te equivocaste: **Anular** (resta el stock y borra la deuda y el pago). No se puede anular una compra que ya tiene pagos posteriores en PASIVOS. El costo actualizado no vuelve solo: corrígelo en Stock.
- El **stock de productos por peso se escribe en kilos** (20 = 20 kg) en el editor, en Merma y en Compras. Al vender, el peso se escribe en gramos (como marca la balanza).

## Descuentos

- **3x2 / 2x1:** solo se pueden aplicar con 3 / 2 o más unidades y rebajan solo los grupos completos (3x2 con 4 unidades cobra 3).
- **-20%, -30%, -50% o % propio (1–100):** se aplican a la línea completa.
- Lo que se pierde **sin vender** (se echó a perder, se aplastó) se registra como **merma** en Stock, no como descuento.
- Ventas **"por monto"** ("$1.000 de tomate"): el precio es el monto; el stock baja según el peso estimado.

## Arqueo de caja

**Efectivo esperado = fondo inicial + ventas en efectivo − lo pagado en efectivo DESDE EL CAJÓN (compras, pagos a proveedores, gastos y retiros).**
- **De dónde salió la plata:** al registrar una compra, un pago a proveedor o un gasto en efectivo, la app pregunta si salió **del cajón del puesto** (baja el efectivo esperado) o **de tu bolsillo** (no toca el cajón). Ejemplo: compras en La Vega con tu plata antes de abrir → "de mi bolsillo". Si te equivocas, el cierre marcará un sobrante o faltante falso. Un **retiro** siempre sale del cajón.
- Mercado Pago no entra al cajón. Las transferencias y tarjetas pagadas a proveedores tampoco: el cierre las muestra aparte.
- Solo cuentan los movimientos hechos **desde que se abrió la caja** del turno (cuando ingresaste el fondo inicial).
- **Redondeo:** en efectivo el total se redondea a $10; el cierre muestra cuánto suma ese redondeo en el turno.
- **Transferencias por verificar:** si la venta por transferencia quedó sin confirmar en el banco, puedes confirmarla en el Cierre o después, en **Contabilidad → Transferencias por verificar**, aunque el turno ya esté cerrado. Si el abono nunca llegó, ese dinero no entró.
- Al pagar a un proveedor (PASIVOS) anota el **n° de operación** y, si puedes, adjunta la **foto del comprobante** (cámara o galería). Es opcional. Las fotos quedan solo en la tablet y no van en el respaldo.

## Fotos de productos

**Para partir:** Stock → *Fotos del catálogo* → **Revisar mi catálogo** (producto por producto: precio, stock y foto). La foto se busca en internet (elige entre varias; necesita conexión) o se toma con la cámara. **Productos nuevos: siempre foto con la cámara.** La foto se guarda en la tablet y sirve sin internet. Los créditos de las fotos de internet están en *Créditos de fotos*.

---

## Síntomas y solución

### 🔴 Pantalla en blanco o no carga
Recarga la página. Si sigue: revisa el internet de la tablet. **No borra datos**; recargar es seguro.

### 🔴 Aviso rojo: "No se pudo GUARDAR en la tablet (memoria llena)"
Lo último que hiciste **no quedó guardado** y se perdería al recargar. **No recargues.** Stock → Descargar Respaldo de inmediato y borra fotos de la Galería. Avisa a Ignacio.

### 🔴 Olvidé mi PIN de vendedor
Un administrador lo crea de nuevo en "Agregar vendedor" con un PIN nuevo.

### 🔴 Olvidamos el PIN de administrador
No se puede recuperar desde la app. Restaura el último respaldo (Stock → Restaurar Respaldo) en un dispositivo donde sí se recuerde el PIN. Si no hay ninguno, hay que borrar los datos del navegador y empezar de cero: por eso el respaldo diario.

### 🟡 Mercado Pago dice "No se pudo generar el cobro"
No hubo conexión o Mercado Pago rechazó la solicitud. **No se registró ninguna venta.** Revisa el internet y toca "Reintentar" (genera un QR nuevo), o cobra en efectivo.

### 🟡 El QR no confirma solo (el cliente ya pagó)
1. Espera 10–15 segundos.
2. Stock → "Verificar". Si Mercado Pago sale en rojo, es configuración (avisar a Ignacio).
3. Si sale en verde: mira el panel de Mercado Pago. Si el pago aparece aprobado, **sí se cobró, pero la venta no quedó registrada en la app** (no baja el stock ni sale en el cierre): anótala aparte y avisa a Ignacio. Si no aparece en el panel, no se cobró: pide que el cliente pague de nuevo.
4. Si el cliente pagó justo al vencer el QR (2 min), el pago queda en Mercado Pago pero la venta no se registra en la app: revisa el panel antes de volver a cobrar.

### 🟡 Aparece "Modo Demo" en Mercado Pago
Faltan las credenciales reales en Vercel: los "pagos" son de mentira. **No registres ventas reales así.** Avisa a Ignacio.

### 🟡 "Enviar cierre al libro (Make)" falla
Revisa el internet y Stock → "Verificar" (Make en verde). Si sigue: descarga igual el respaldo antes de finalizar el turno y avisa a Ignacio para reenviarlo.

### 🟡 "Buscar foto" no encuentra nada o falla
Necesita internet. Prueba otro nombre (singular, sin marca). Si sigue, toma la foto con la cámara.

### 🟠 Productos o ventas desaparecieron
Se borró el navegador o se reseteó la tablet. Stock → Restaurar Respaldo → último archivo → PIN de admin.

### 🟠 Un cambio de precio "no se guarda"
Si cambia más de 20 %, la app pide confirmar ("Confirmar de todos modos"): es para evitar errores de tipeo.

### 🟠 El CSV de inventario omitió filas
La app avisa cuántas. Revisa que precios y stock sean números **enteros sin puntos** (ej. `1200`, no `1.200`). El stock de productos por peso va en **gramos**.

---

## Dónde mirar cuando algo se pone técnico
- **Panel de Mercado Pago** (Tu negocio → Actividad): si un pago se acreditó de verdad.
- **Historial de ejecuciones de Make:** si el cierre llegó al libro.
- **Vercel → Deployments → Logs:** errores del servidor.
