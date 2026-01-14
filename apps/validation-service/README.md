## Validation Platform

Monorepo NestJS que aloja el microservicio **validation-service**, encargado de ejecutar reglas de negocio para validar gastos corporativos utilizando un motor basado en Chain of Responsibility / Strategy. Cada regla vive en su propia clase, aporta alertas y propone un estado que luego se consolida respetando la jerarquía `RECHAZADO > PENDIENTE > APROBADO`.

### Arquitectura

| Capa | Descripción |
| --- | --- |
| `apps/validation-service/src/main.ts` | Arranque de Nest con `ValidationPipe` global. |
| `src/controllers` | `ValidationController` expone `POST /validations`. |
| `src/dto` | DTOs (gasto, políticas y request) con `class-validator`. |
| `src/domain` | Modelos puros (`Expense`, `Policies`, `ValidationContext`, etc.). |
| `src/rules` | Reglas independientes (antigüedad, límites, centro de costo). |
| `src/services` | `ValidationService` orquesta la ejecución de reglas. |

La inyección de dependencias (`validation.module.ts`) registra cada regla y las agrupa mediante el token `VALIDATION_RULES`.

### Flujo de validación

1. **Antigüedad:** compara la fecha actual con la del gasto (`limite_antiguedad`).  
2. **Conversión & límites:** usa el `monto_base` (si viene) o, si la moneda ya coincide con `moneda_base`, toma `monto_original`. Se compara contra `limites_por_categoria`.  
3. **Centros de costo:** valida contra `reglas_centro_costo` para detectar categorías prohibidas.  
4. Cada regla registra alertas/opiniones en el `ValidationContext`. El estado final adopta la prioridad más alta observada.

### API

`POST /validations`

```jsonc
{
  "gasto": {
    "id": "exp-987",
    "fecha": "2024-05-20",
    "monto_original": 120.5,
    "moneda_original": "EUR",
    "monto_base": 130.4, // requerido si difiere de moneda_base
    "categoria": "food",
    "cost_center": "core_engineering",
    "empleado_id": "emp-01"
  },
  "politicas": {
    "moneda_base": "USD",
    "limite_antiguedad": { "pendiente_dias": 30, "rechazado_dias": 60 },
    "limites_por_categoria": {
      "food": { "aprobado_hasta": 100, "pendiente_hasta": 150 }
    },
    "reglas_centro_costo": [
      { "cost_center": "core_engineering", "categoria_prohibida": "food" }
    ]
  }
}
```

Respuesta:

```json
{
  "estadoFinal": "PENDIENTE",
  "alertas": ["..."],
  "sugerencias": [
    { "regla": "ExpenseAgeRule", "estado": "PENDIENTE" },
    { "regla": "CategoryLimitRule", "estado": "APROBADO" },
    { "regla": "CostCenterRule", "estado": "APROBADO" }
  ],
  "montoConvertido": 120,
  "monedaBase": "USD"
}
```

### Scripts principales

```bash
npm install                     # instala dependencias
npm run start:dev               # levanta validation-service con watch
npm test                        # ejecuta Jest (cobertura en apps/validation-service)
npm run build                   # compila a dist/
```

> Nota: los scripts invocan Nest CLI y Jest desde `node_modules` para evitar depender de binarios globales.

### Variables de entorno

El servicio lee su zona horaria desde `APP_TIMEZONE` (ej. `America/Santiago`) definida en `.env`.  
Si no se especifica, se usa `UTC`. Esta variable se utiliza para interpretar las fechas ISO recibidas y calcular la antigüedad del gasto con apoyo de `date-fns/date-fns-tz`.

### Docker multi-stage

```bash
# Build
docker build -t validation-service .

# Run
docker run -p 3000:3000 --env PORT=3000 validation-service
```

El `Dockerfile` usa tres etapas (`deps`, `builder`, `runner`). En producción solo copia `dist/` y dependencias runtime (`npm install --omit=dev`).

### Pruebas unitarias

Las specs viven en `apps/validation-service/src/services`. Se cubren:

1. Gasto aprobado (<30 días, dentro de límites).  
2. Gasto pendiente por antigüedad.  
3. Gasto rechazado por centro de costo.  

Ejecutar:

```bash
npm test
```

### Próximos pasos sugeridos

1. Persistencia de diagnósticos (ej. publicar eventos o guardar auditorías).  
2. Añadir autenticación y rate limiting al endpoint.  
3. Incorporar conversor de divisas externo para poblar automáticamente `monto_base` cuando falte.  
