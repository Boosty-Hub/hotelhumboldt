#!/bin/bash
# Smoke test autenticado: login real + recorrido de todas las rutas
BASE=http://localhost:3010
JAR=/tmp/hh-cookies.txt
rm -f $JAR

# 1. CSRF
CSRF=$(curl -s -c $JAR $BASE/api/auth/csrf | python -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
echo "csrf: ${CSRF:0:12}..."

# 2. Login con credenciales del seed
curl -s -b $JAR -c $JAR -X POST $BASE/api/auth/callback/credentials \
  -d "csrfToken=$CSRF" -d "email=admin@hotelhumboldt.com" -d "password=humboldt2026" \
  -o /dev/null -w "login: %{http_code}\n"

# 3. Sesión
SESSION=$(curl -s -b $JAR $BASE/api/auth/session)
echo "session: $(echo $SESSION | head -c 120)"

# 4. Rutas internas
for ruta in / /pipeline /cotizaciones /calendario /clientes /salones /catalogo /proveedores /pagos /reportes /configuracion; do
  curl -s -b $JAR -o /dev/null -w "GET $ruta : %{http_code} (%{time_total}s)\n" --max-time 60 $BASE$ruta
done
