# El Puesto del Pueblo

Sistema de venta para un puesto de **frutas y verduras en la feria**. Pensado para una **tablet**: venta rápida
por peso, unidad, atado o preparado; cobro en efectivo o con Mercado Pago (QR); cierre de caja con arqueo y libro
contable en Make. Todo en **pesos chilenos (CLP)**.

**Versión 5.1 · 1.0.0** — comparte base con el kiosko del club (`v0-minimarket-internacional`) y trae sus correcciones.

---

## Qué hace

| Área | Funciones |
|---|---|
| **Venta** | Catálogo con foto o emoji, categorías (Frutas, Verduras, Ensaladas y Preparados, Jugos Naturales). Tipos de venta: **unidad** (lechuga, sandía entera), **peso** (a granel: por gramos pesados o "por monto"), **atado** (cilantro, perejil), **preparado** (jugo natural con variante de fruta). Descuentos por ítem: promos **3x2 y 2x1 exactas** (solo rebajan grupos completos; con 4 unidades el 3x2 cobra 3) y % de 1 a 100. Redondeo a $10 en efectivo. Las ventas "por monto" descuentan stock con el peso estimado. **Sin fiado, sin socios ni clubes:** venta directa a personas de barrio. |
| **Pago** | **Efectivo** o **Mercado Pago** (QR con confirmación automática). |
| **Compras** | El dueño compra en volumen (cajones, sacos, mallas) y las registra: proveedor, productos con cantidad (kg o unidades) y costo total. Suma al stock, actualiza el costo por kilo/unidad, y queda en Pasivos (lo pagado en efectivo sale del arqueo; lo que queda debiendo es deuda al proveedor). Se puede anular. |
| **Merma** | Registro de lo que se pierde sin vender, con motivo; descuenta stock y queda trazable. |
| **Pasivos** | Deudas a proveedores (La Vega, fletes…) y sus pagos en efectivo, transferencia o tarjeta, con n° de operación y **foto de comprobante**. |
| **Cierre y arqueo** | Efectivo esperado = fondo inicial + ventas en efectivo − pagos a proveedores en efectivo. Mercado Pago y transferencias se informan aparte. Desglose por vendedor y producto; envío del cierre a Make. |
| **Stock** | **Revisar mi catálogo** (producto por producto: precio, stock en kilos y foto real), alta/edición con foto, **búsqueda de fotos reales en internet**, código de barras, alertas de stock bajo, import/export CSV, respaldo completo, diagnóstico de Mercado Pago y Make. |

## Fotos reales de frutas y verduras

**Sin costo:** el buscador usa Wikimedia Commons (gratis, sin cuenta ni clave de API) y la cámara es de la propia tablet; la app no usa ningún servicio de pago para imágenes.

**Para partir:** Stock → *Fotos del catálogo* → **Revisar mi catálogo**. Recorre todos los productos uno por uno (primero los que no tienen foto): ajustas precio y stock y le pones una foto real, ya sea **buscándola en internet** (Wikimedia Commons: eliges entre varias, se guarda reducida en la tablet con su crédito de autor) o **tomándola con la cámara**. Los créditos quedan en *Créditos de fotos*.

**Después:** todo producto nuevo se fotografía con la cámara al crearlo (el buscador de internet no se ofrece en productos nuevos). Si guardas uno sin foto, la app te lo recuerda. Mientras un producto no tenga foto se muestra su emoji.

## Puesta en marcha

Requisitos: Node.js 20+ y [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # completa MP_ACCESS_TOKEN y MAKE_WEBHOOK_URL
pnpm dev                     # http://localhost:3000
```

| Variable | Para qué |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token de **producción** de Mercado Pago. Sin él la pantalla de pago queda en **Modo Demo** (no cobra de verdad). |
| `MAKE_WEBHOOK_URL` | Webhook "Custom Webhook" del escenario de Make que escribe el libro. |

Se despliega en **Vercel**. Pasos, claves de fábrica y verificación previa a la primera venta: [`docs/GUIA-DESPLIEGUE.md`](docs/GUIA-DESPLIEGUE.md). Antes de vender con clientes reales, activa *Deployment Protection / Password Protection* en Vercel.

## Cómo se guardan los datos

- Inventario, ventas, merma, pasivos y turno viven **solo en la tablet** (`localStorage`). Si el guardado falla (memoria llena) aparece un aviso rojo: no recargar y descargar respaldo.
- Fotos de productos reducidas a ~50 KB; fotos de comprobantes en `IndexedDB` (**no van dentro del respaldo**; el n° de operación sí).
- **Respaldo diario:** Stock → *Descargar Respaldo*, guardado fuera de la tablet.
- La app necesita internet para **abrirse**. Ya abierta, se puede vender en efectivo sin internet; Mercado Pago, la búsqueda de fotos y el envío a Make sí lo requieren.
- Las claves de almacenamiento usan el prefijo `puesto-pueblo-*`: **no se mezcla** con la app del club aunque estén en el mismo navegador.

## Claves de fábrica

- PIN de administrador: `1234` → **cámbialo** en Stock → PIN Admin (el vendedor "Administrador" usa el mismo PIN).
- Catálogo de demostración (verduras, 7 lechugas, frutas, jugo): Stock → *Vaciar Catálogo de Demostración* cuando cargues el real.

## Estructura

```
app/page.tsx                  Estado global, persistencia, turno y cierre
app/api/                      mercadopago · make/cierre · productos/buscar-codigo · status
components/pos-terminal.tsx   Venta (peso, unidad, atado, preparado, descuentos)
components/admin-inventory.tsx Stock, merma, respaldo, fotos, diagnóstico
components/product-editor.tsx Alta/edición de productos y fotos
components/photo-finder.tsx   Buscador de fotos reales (Wikimedia Commons)
components/purchases.tsx      Compras del dueño (stock, costo, pasivos)
components/payables.tsx       Pasivos
components/daily-closure.tsx  Cierre y arqueo
lib/store.ts                  Tipos, catálogo demo, precios por peso, arqueo, respaldo
lib/photo-search.ts           Búsqueda de fotos (lógica pura)
lib/receipt-store.ts          Comprobantes en IndexedDB
docs/                         Guía de despliegue, manual de operación, cambios
```

## Limitaciones conocidas

- Rutas API sin login propio (proteger con Vercel Password Protection).
- Los PIN se guardan en texto plano en la tablet.
- El QR de pago se genera con un servicio externo (`api.qrserver.com`).
- El webhook de Mercado Pago no verifica firma ni evita duplicados hacia Make.
- Sin modo offline al abrir la app. `ignoreBuildErrors` está activo en `next.config.mjs`.
- La búsqueda de fotos depende de Wikimedia Commons y no se pudo probar contra internet real en la revisión (ver `docs/CAMBIOS.md`).

Proyecto iniciado con [v0](https://v0.app).
