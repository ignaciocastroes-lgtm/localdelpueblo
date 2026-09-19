# Guía de Despliegue — El Puesto del Pueblo

## 1. Requisitos previos

- Cuenta de [Vercel](https://vercel.com).
- Cuenta de Mercado Pago con **Access Token de producción** (no el de prueba).
- Cuenta de [Make](https://www.make.com) con un escenario que reciba un "Custom Webhook".
- El código en un repositorio de GitHub/GitLab (o `vercel deploy` con la CLI).

## 2. Desplegar

1. Vercel → **Add New → Project** → importa el repositorio. Framework: **Next.js** (automático).
2. Carga las variables de entorno del punto 3 **antes** de "Deploy".
3. Vercel entrega una URL `https://tu-proyecto.vercel.app`: esa se abre en la tablet.

## 3. Variables de entorno (Production)

| Variable | Qué es |
|---|---|
| `MP_ACCESS_TOKEN` | Token de **producción** de Mercado Pago. Sin esto el cobro con QR queda en "Modo Demo" (no cobra de verdad). Se obtiene en mercadopago.cl/developers/panel/app → Credenciales de producción. |
| `MAKE_WEBHOOK_URL` | URL del webhook de tu escenario de Make. Sin esto "Enviar cierre al libro" falla. |

Ninguna lleva el prefijo `NEXT_PUBLIC_` (así quedan solo en el servidor). Tras cambiarlas: **Deployments → ⋯ → Redeploy**.

## 4. Claves de fábrica

| Qué | Valor de fábrica | Cómo cambiarlo |
|---|---|---|
| PIN de administrador | `1234` | Stock → PIN Admin. El vendedor "Administrador" pasa a usar el mismo PIN. |
| Catálogo | Verduras a granel, 7 lechugas, hierbas por atado, frutas, sandía entera y en trozos, jugo natural, ensalada armada | Stock → Vaciar Catálogo de Demostración (cuando cargues el real) |

## 5. Seguridad (antes de vender con clientes reales)

- **Activa la protección de Vercel:** Project → Settings → **Deployment Protection** (o *Password Protection*). Las rutas `/api/*` no tienen login propio; esa clave es la protección real. La app incluye un chequeo de origen en las rutas POST, pero es solo un freno básico.
- Los PIN se guardan en la tablet en texto plano: evitan errores y curiosos, no a alguien con conocimientos técnicos.

## 6. Verificación antes de la primera venta real

1. Entra como Administrador (PIN `1234` si aún no lo cambias).
2. **Stock → Diagnóstico de Pagos y Libro → Verificar**: Mercado Pago y Make deben salir en verde.
3. Cambia el PIN de administrador.
4. Cambia el catálogo de demostración por tus productos reales (precios por kilo, por unidad o por atado).
5. Catálogo: Stock → *Fotos del catálogo* → **Revisar mi catálogo**: recorre cada producto para dejar precio, stock (en kilos si es por peso) y una foto real.
6. Haz una venta de prueba con Mercado Pago por un monto bajo (ej. $500) y confirma que se acredite sola.
7. Revisa que llegue a Make (historial de ejecuciones).
8. Registra una compra de prueba (COMPRAS) y verifica que suba el stock; luego anúlala. Prueba el ciclo completo: fondo de caja → una venta → Cierre → contar efectivo → enviar a Make → finalizar turno.

## 7. Modo tablet

1. Abre la URL en Chrome (Android) o Safari (iPad) y usa **Agregar a pantalla de inicio** / **Instalar app**.
2. Abre la app desde ese ícono (pantalla completa). La pantalla se mantiene encendida sola.
3. La app necesita internet para **abrirse**. Ya abierta, se puede vender en efectivo sin conexión; Mercado Pago, la búsqueda de fotos y el envío a Make sí la requieren. No recargues la página sin internet.

## 8. Respaldo

Stock → **Descargar Respaldo** todos los días y guarda el archivo fuera de la tablet (Drive, correo). Es la base para recuperar todo si la tablet se resetea. Los comprobantes fotográficos **no** van en el respaldo (el n° de operación sí).
