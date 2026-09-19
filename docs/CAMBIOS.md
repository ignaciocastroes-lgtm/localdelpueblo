# Cambios v3 → v5 — El Puesto del Pueblo

Esta versión trae al puesto las correcciones de la auditoría del kiosko del club (`v0-minimarket-internacional`, v8–v10),
**sin tocar lo propio del puesto** (venta por peso, unidad, atado y preparado, descuentos, merma, catálogo, colores, emojis).

**Estado de verificación:** no se pudo compilar ni ejecutar la app en el entorno de revisión (sin `node_modules` ni red).
Se revisó el código, se comprobó con `tsc` que no hay errores de sintaxis ni nombres sin definir, y la lógica pura se probó
con casos automáticos (arqueo, turno, precios por peso, descuentos, redondeo, respaldo, parseo del buscador de fotos).
⚠ = probar en la tablet.

## v5.1 — Auditoría del flujo de caja (incluye lo agregado por la otra sesión: transferencias, gastos y retiros, stock diario, contabilidad)

Se revisó de punta a punta el camino del dinero: fondo → ventas (efectivo, transferencia, Mercado Pago) → compras y pagos → gastos y retiros → arqueo → cierre → contabilidad.

| Gravedad | Hallazgo | Corrección |
|---|---|---|
| **Alta** | **El arqueo suponía que TODO efectivo pagado (compras, pagos a proveedores, gastos) salía del cajón.** El dueño financia con su propia plata (compra en La Vega antes de abrir): en un día típico el cierre mostraba un **sobrante falso de $40.000** (simulado). | Al pagar en efectivo se elige **"del cajón" o "de mi bolsillo"** (sin opción por defecto, a propósito). Solo lo del cajón baja el efectivo esperado; lo del bolsillo se informa aparte. Registros antiguos sin dato = del cajón. Retiros siempre del cajón. |
| Media | Una transferencia "por verificar" **no se podía confirmar** después de finalizar el turno: quedaba pendiente para siempre. | Contabilidad → *Transferencias por verificar* (cualquier día) con botón "Ya llegó al banco". |
| Media | El redondeo a $10 en efectivo no aparecía en el cierre. | Se guarda por venta y el cierre muestra el redondeo del turno. |
| Baja | "Resultado de caja simple" contaba las compras a su valor total (incluye lo no pagado). | Etiqueta corregida; lo pendiente ya se muestra aparte. |
| Baja | Constantes de fotos de la app del club (enlaces a Unsplash) sin uso. | Eliminadas. |

**Sin cambios:** la lógica de stock diario, conteo, remates, regalos, "hoy hay" y venta sin stock quedó como la dejó la otra sesión (unidades en kilos coherentes con lo de v5).

**Pendiente / riesgos que conviene conocer**
1. Si se ajusta "Carta y stock del día" **después** de registrar compras del mismo día, la columna "otros ajustes" del conteo puede mostrar una diferencia (no afecta el dinero).
2. El texto tributario (Ley 21.745, 1,5 %) es referencial y no se validó: conviene revisarlo con un contador.
3. Todo lo anterior sigue sin poder ejecutarse en el entorno de revisión: probar en la tablet.

Prueba nueva (5 min): abrir caja con $30.000 → vender $45.000 en efectivo → registrar una compra de $40.000 en efectivo **"de mi bolsillo"** → gasto de $2.000 **"del cajón"** → retiro de $10.000 → el Cierre debe esperar **$63.000**; luego repetir la compra marcando **"del cajón"** y comprobar que espera $23.000.

## v5 — Auditoría de cómo vende el puesto (y lo que se corrigió)

Esta ronda sí revisó la lógica de venta (peso, "por monto", descuentos, stock, merma). Hallazgos:

| Gravedad | Hallazgo | Corrección |
|---|---|---|
| **Alta** | Las ventas **"por monto"** ("$1.000 de tomate") **no descontaban stock**: el inventario quedaba inflado. | Se descuenta el peso estimado (monto ÷ precio por kilo) y se avisa si no alcanza el stock. |
| **Alta** | El campo **Stock del editor no tenía unidad**: en productos por peso se guarda en gramos, así que escribir "20" pensando en kilos dejaba **20 g**. Igual en Merma (gramos). | Stock, stock mínimo y merma se escriben en **kilos** en productos por peso (se guardan en gramos). Cambiar el tipo de venta reinicia el stock para no mezclar unidades. |
| **Alta** | Los "descuentos 3x2 / 2x1" eran solo -33% / -50% aplicados aunque llevaran 1 unidad. | Promos exactas "lleva N paga M": solo rebajan grupos completos y solo se ofrecen con la cantidad necesaria. |
| Media | El % personalizado aceptaba 150 % o negativos. | Validado entre 1 % y 100 %. |
| Media | Jugos (preparado) se podían vender sin revisar stock; el stepper de cantidad ignoraba otras líneas del mismo producto. | Corregido. |
| Media | El cierre sumaba precio unitario × cantidad (no servía para promos). | Se guarda y suma el total real de cada línea. |
| **Faltaba** | **No había cómo registrar las compras del dueño** (compra en volumen): el stock había que editarlo a mano y Pasivos no sabía qué productos se compraron. | Módulo **COMPRAS** (ver README). |
| — | Foto: el dueño parte editando su catálogo y luego fotografía cada producto nuevo. | **Revisar mi catálogo** (producto por producto) y, en productos nuevos, foto con cámara + recordatorio si falta. |

**Lo que NO cambió (a propósito):** el puesto no tiene socios, clubes, camisetas, apoderados ni fiado. Nada del flujo del club se trajo.

**Detectado y no corregido (decisiones del dueño):**
1. **Medios de pago del cliente:** el POS solo cobra efectivo o Mercado Pago. Si el cliente paga por **transferencia o tarjeta** (muy común en ferias), hoy no hay dónde registrarlo como venta.
2. **Sandía entera vs. trozos** son dos productos con stock separado: al cortar una sandía no se traspasa el stock de una a otra.
3. **Jugos y ensaladas** no descuentan la fruta/verdura que usan: solo su propio stock.
4. El redondeo a $10 en efectivo no se muestra como línea aparte en el cierre (la suma por producto puede diferir hasta $9 por venta).

## Corregido (mismos problemas que tenía el kiosko)

| Gravedad | Problema | Corrección |
|---|---|---|
| Bloqueante | Al partir, el diálogo **"Fondo de Caja Inicial" no tenía botón Confirmar**: la clase `[&>button]:hidden` ocultaba todos los botones hijos. Igual con "Agregar vendedor". | `showCloseButton={false}`; el fondo de caja es un formulario (Enter y botón), teclado numérico con "Listo", solo dígitos. |
| Crítica (dinero) | Un fallo de red al crear el cobro de Mercado Pago activaba el **Modo Demo**: se podía registrar una venta como pagada sin cobrar. | Modo Demo solo si falta `MP_ACCESS_TOKEN`. "Reintentar" genera un cobro nuevo. ⚠ |
| Crítica (datos) | Las fotos de cámara se guardaban sin reducir y **llenaban la memoria** de la tablet; luego la app dejaba de guardar ventas sin avisar. | Fotos comprimidas (~50 KB), aviso rojo si un guardado falla, cada dato se guarda por separado. |
| Crítica (seguridad) | El vendedor "Administrador" seguía con PIN 1234 aunque se cambiara el PIN admin. | Ambos PIN quedan unidos. |
| Alta | El carrito y los botones de pago quedaban al final de una página larguísima. | Layout acotado al alto de pantalla. ⚠ |
| Alta | El reporte de cierre se recortaba; se podía finalizar sin enviar a Make. | Scroll nativo; aviso amarillo; se registra si se envió. ⚠ |
| Media | Importar CSV aceptaba filas inválidas (precio $0, "1.500" leído como 1,5). | Se omiten y se informa; el CSV ahora incluye **TipoVenta** y **PrecioKg** (antes un producto por peso importado quedaba a $0). |
| Media | Editor de productos sin validación; fotos rotas mostraban texto; botón de quitar/borrar foto solo visible con "hover" (no existe en tablet). | Validación (precio por kilo si es por peso), `SafeImage` con fallback al emoji, botones siempre visibles. |
| Media | Rutas API sin validación; `/api/status` exponía el correo de la cuenta de Mercado Pago. | Validación, tope de monto, chequeo de origen, correo enmascarado. |
| Baja | `title` de la pestaña decía "Club de Hockey Internacional"; la app se instalaba como "Kiosko - Minimarket Internacional"; `lang="en"`; manifest sin iconos 192/512. | Marca de El Puesto del Pueblo, iconos verdes nuevos. |
| Baja | Código muerto del club (socios, cobranza, comanda, importador simulado con datos falsos). | Eliminado. |

## Nuevo

- **Arqueo con pagos a proveedores:** efectivo esperado = fondo + ventas en efectivo − pagos a proveedores en efectivo, solo del turno; transferencias y tarjeta a proveedores se informan aparte. Cada pago admite n° de operación y **foto del comprobante** (IndexedDB, fuera del respaldo).
- **Fotos reales:** Stock → *Fotos del catálogo* y "Buscar foto real en internet" en el editor (Wikimedia Commons, tú eliges, se guarda el crédito). ⚠ **No se pudo probar contra internet real**; el parseo se probó con una respuesta simulada. Si falla, muestra un aviso y queda la cámara.

## Detectado y no corregido
1. Rutas API sin login (activar *Password Protection* en Vercel).
2. PIN en texto plano en la tablet.
3. QR generado por un servicio externo (`api.qrserver.com`).
4. Webhook de Mercado Pago sin firma ni control de duplicados.
5. Sin modo offline al abrir; `ignoreBuildErrors` activo.
6. Comprobantes fuera del respaldo.
7. Si el cliente paga justo al vencer el QR (2 min) el pago queda en Mercado Pago pero la venta no se registra.
8. **Cumplimiento tributario (Régimen de Feriantes):** el texto de Stock trae afirmaciones legales propias del proyecto; conviene validarlas con un contador antes de operar, no las revisé.

## Prueba mínima antes de operar (10 min, en la tablet)
1. Abrir → vendedor → aparece Fondo de Caja → escribir monto → **Enter** y botón funcionan.
2. Con 10+ productos, Efectivo / M. Pago se ven sin hacer scroll.
3. Vender: unidad, atado, peso por gramos, peso por monto (¿bajó el stock?), jugo con extras; descuento 3x2 con 1, 3 y 4 unidades.
4. Mercado Pago real de $500; luego sin Wi-Fi: "No se pudo generar el cobro" **sin** botones de simulación.
5. Cambiar PIN admin → entrar como "Administrador" con el nuevo (el 1234 ya no sirve).
6. Stock → Fotos del catálogo → "Buscar foto" → elegir una (con internet) y comprobar que queda en la tarjeta del producto.
7. COMPRAS: registrar una compra (p. ej. 20 kg de tomate) pagada en efectivo, ver que suba el stock y que baje el efectivo esperado en el Cierre; anularla. PASIVOS: una compra con saldo pendiente.
8. Cierre: se ve completo; finalizar sin enviar muestra el aviso; descargar y restaurar respaldo.
