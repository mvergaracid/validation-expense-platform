# ANALISIS (Parte 3 - Analizador de Lotes)

Este documento resume los hallazgos al procesar el archivo `gastos_historicos.csv` (o su equivalente subido vía dashboard) usando la plataforma de validación.

La Parte 3 del desafío pide:

- Desglose de gastos por estado (**APROBADO / PENDIENTE / RECHAZADO**).
- Anomalías detectadas (ej. duplicados exactos, montos negativos) con ejemplos.
- (Bonus) Breve explicación de cómo optimizar (o cómo se optimizó) el acceso a tasas de cambio para evitar N+1.

---

## 1) Desglose por estado

Los estados provienen del resultado del motor de reglas (`validation-service`) y se persisten por gasto (tabla `expenses`) y por job (tabla `job_runs`).

- **APROBADO**: _[completar]_ 
- **PENDIENTE**: _[completar]_ 
- **RECHAZADO**: _[completar]_ 

> Nota: En esta plataforma, el procesamiento se traza por `processId` (FileProcess). El dashboard muestra métricas agregadas y permite auditar jobs individuales.

---

## 2) Anomalías detectadas

### 2.1 Montos negativos

**Definición (anomalía):** Gastos con `monto_original < 0`.

**Tratamiento en la plataforma:**

- Se detecta en el `worker-service` durante la etapa `normalize`.
- El registro se marca como **omitido** y **no** se ejecuta conversión de moneda ni validación ni persistencia del gasto como “procesado exitoso”.
- Se guarda en el `JobRun.meta` un bloque `negative_amount` para auditoría.

**Ejemplos:**

- `gasto_id`: _[ejemplo]_ 
  - `monto_original`: _[ejemplo]_ 
  - `moneda_original`: _[ejemplo]_ 
  - evidencia: `job_runs.meta.negative_amount.reason = 'negative_amount'`

---

### 2.2 Duplicados exactos

**Definición (anomalía):** Gastos donde `monto`, `moneda` y `fecha` (y otros campos relevantes) son idénticos.

**Tratamiento en la plataforma:**

- El `worker-service` calcula un `fingerprint` (SHA-256) a partir de **3 campos**: `monto_original`, `moneda_original` y `fecha`.
- Se usa deduplicación en dos niveles:
  - **Cache Redis (TTL, *time-to-live*)**: evita reprocesar eventos repetidos durante una ventana (por defecto `DEDUP_TTL_SECONDS`).
  - **Fallback a DB**: si Redis no tiene el key (por restart/TTL), se valida existencia en Postgres por `expenses.fingerprint` (único) y se marca como duplicado.

**Implicancia / mejora propuesta:**

Este criterio (solo 3 campos) puede generar **falsos positivos** en un escenario productivo: por ejemplo, dos empleados distintos podrían rendir gastos legítimos con el mismo monto, moneda y fecha y quedarían marcados como duplicados.

En un requerimiento real, el `fingerprint` “correcto” suele construirse con un set más amplio de campos (p.ej. `empleado_id`, `categoria`, `cost_center`, merchant/proveedor, documento, etc.) y/o con reglas de deduplicación configurables por tenant.

Dicho esto, si la **regla de negocio explícita** establece que “duplicado exacto” es *monto + moneda + fecha*, entonces el comportamiento actual es el correcto para el desafío, y la evolución recomendada es:

- parametrizar el set de campos del `fingerprint` (por policy/tenant), y
- mantener ambos modos: “dedup estricto 3 campos” vs “dedup canónico ampliado”.

**Ejemplos:**

- `fingerprint`: _[ejemplo]_ 
  - evidencia 1: `job_runs.meta.dedup.reason = 'duplicate_fingerprint'` (detectado en Redis)
  - evidencia 2: `job_runs.meta.dedup.reason = 'duplicate_fingerprint_db'` (detectado en DB)

---

## 3) Bonus: optimización para evitar N+1 requests (tasas de cambio)

El problema clásico **N+1** sería: “por cada fila del CSV, hacer una llamada a la API de tasas de cambio”, lo que no escala para archivos grandes.

En esta solución, la optimización se aborda en capas:

- **Procesamiento de CSV grande**
  - El `ingestor-service` hace **streaming** del CSV y publica batches configurables, evitando cargar el archivo completo en memoria.
  - Esto resuelve el problema de **memoria/IO** del CSV gigante y permite paralelizar el procesamiento.
  - Nota: esto es independiente del problema de tasas de cambio **FX (*foreign exchange*, tipo de cambio)**, que se aborda con cache/agrupación.

- **Cache de tasas de cambio (Redis)**
  - El `currency-service` utiliza Redis para cachear tasas.
  - Cuando el proveedor externo es **OpenExchangeRates** (`OPENEXCHANGERATES_APP_ID`), además se cachea una **tabla completa por fecha**:
    - `fx_table:<YYYY-MM-DD|latest>` contiene el objeto `rates` retornado por OpenExchangeRates.
    - A partir de esa tabla, el servicio calcula cualquier par `FROM->TO` como `rates[TO] / rates[FROM]` (con la moneda base del proveedor como pivote).
  - Resultado: para un `process_batch` con múltiples gastos del mismo día, se realiza **1 sola llamada externa por fecha** (por ventana de TTL), y el resto de conversiones se resuelven desde Redis.

- **Optimización adicional (si se quiere llevar más lejos)**
  - Un paso extra sería exponer un endpoint batch de conversión para reducir roundtrips entre `worker-service` y `currency-service`.
  - Sin embargo, el cuello de botella más costoso (llamadas al proveedor externo) ya se mitiga con el cache `fx_table:*`.

---

## 4) Conclusiones

- El motor de reglas (`validation-service`) es lógica pura y testeable, y define el estado final con prioridad (RECHAZADO > PENDIENTE > APROBADO).
- El procesamiento de lote (Parte 3) se implementa como pipeline: streaming + batching + jobs auditables.
- Anomalías relevantes para datos migrados (negativos, duplicados) se detectan y quedan auditables por `processId`/`batchIndex`/`jobId`.

---

## 5) Cómo reproducir

1. Levantar stack:

```bash
docker compose up --build
```

2. Subir `gastos_historicos.csv` desde el dashboard:

- UI -> `New` -> seleccionar `.csv`

3. Consultar resultados:

- Dashboard / Process Monitor: métricas agregadas y lista de jobs.
- DB (opcional): `expenses`, `job_runs`, `job_run_stages`.
