# Jr.G BANK

Prototipo educativo de un sistema financiero propio, desarrollado por etapas.

## Estado actual

**Versión 0.1 — entorno DEMO.** Incluye:
- Panel web adaptable a móvil.
- Dos cuentas internas de prueba.
- Abonos simulados (no representan depósitos reales).
- Transferencias internas.
- Libro de movimientos con asientos de doble partida.
- Persistencia local en `data/ledger.json`.

## Ejecutar pruebas automáticas

```bash
npm test
```

Las pruebas comprueban el estado inicial, abonos simulados, transferencias, rechazo por saldo insuficiente y equilibrio de los asientos contables. GitHub Actions ejecuta estas comprobaciones automáticamente al actualizar `main` o abrir un pull request.

## Ejecutar

Requiere Node.js 20 o superior.

```bash
npm start
```

Abrir `http://localhost:3000`.

## Límites importantes

Este prototipo no es un banco, IFPE ni institución financiera autorizada. No recibe ni custodia efectivo, no verifica billetes, no emite dinero electrónico, no conecta con SPEI ni procesa pagos reales. No ingresar datos bancarios ni información sensible.

La API todavía no incluye autenticación, autorización, cifrado de datos, controles antifraude, conciliación externa, alta disponibilidad ni auditoría independiente. Debe permanecer en un entorno local/de pruebas y no exponerse públicamente ni usarse con fondos reales.

## Próximas etapas

1. Pruebas automatizadas del libro contable y reglas de saldo.
2. Autenticación, roles, sesiones seguras y bitácora protegida.
3. Base de datos transaccional y migraciones.
4. Diseño legal y regulatorio en México antes de cualquier operación real.
5. Integraciones de pago únicamente mediante proveedores e instituciones autorizadas.
