"""
Validacao funcional das correcoes da auditoria NutriTrack v1.5.
Testa contra Supabase real + DB direto.
"""
import requests, json, psycopg2, sys, uuid

SUPABASE_URL = "https://qyikubuqyhobppvojvpa.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aWt1YnVxeWhvYnBwdm9qdnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODM5NDUsImV4cCI6MjA4OTU1OTk0NX0.YYhbW3KrkXtBDBb4Wpnvfrbl8hzb-ixet54prpD6_U"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aWt1YnVxeWhvYnBwdm9qdnBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mzk0NSwiZXhwIjoyMDg5NTU5OTQ1fQ.CICEklYopd4JJyVwkV5P162YOVewiuAKtBzmhaRieZU"
DB_HOST = "db.qyikubuqyhobppvojvpa.supabase.co"
DB_PASS = "Bt8751bt,!1"

passed = 0
failed = 0
errors = []

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [OK] {name}")
    else:
        failed += 1
        errors.append(f"{name}: {detail}")
        print(f"  [FAIL] {name} -- {detail}")

def headers_service():
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}

# ======================================================
print("\n=== 1. DB: Credencial removida do app_config ===")
conn = psycopg2.connect(host=DB_HOST, port=5432, dbname="postgres", user="postgres", password=DB_PASS, sslmode="require")
cur = conn.cursor()

cur.execute("SELECT count(*) FROM app_config WHERE key = 'weslleybertoldo'")
count = cur.fetchone()[0]
test("Credencial weslleybertoldo removida", count == 0, f"ainda existe: {count} row(s)")

# ======================================================
print("\n=== 2. DB: TRUNCATE revogado ===")
cur.execute("""
    SELECT grantee, table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema='public' AND grantee='anon' AND privilege_type='TRUNCATE'
""")
truncate_grants = cur.fetchall()
test("anon nao tem TRUNCATE", len(truncate_grants) == 0, f"ainda tem {len(truncate_grants)} grants")

# ======================================================
print("\n=== 3. DB: RLS ativo em todas as tabelas ===")
cur.execute("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'")
for tname, rls in cur.fetchall():
    test(f"RLS ativo em {tname}", rls == True, f"rowsecurity={rls}")

# ======================================================
print("\n=== 4. API: Leitura de foods funciona ===")
r = requests.get(f"{SUPABASE_URL}/rest/v1/foods?select=id,nome&limit=5",
    headers=headers_service())
test("Foods GET retorna 200", r.status_code == 200, f"status={r.status_code}")
foods = r.json()
test("Foods tem dados", len(foods) > 0, "vazio")

# ======================================================
print("\n=== 5. API: Profiles existem ===")
r = requests.get(f"{SUPABASE_URL}/rest/v1/profiles?select=id,nome,email&limit=10",
    headers=headers_service())
test("Profiles GET retorna 200", r.status_code == 200, f"status={r.status_code}")
profiles = r.json()
test("Profiles tem dados", len(profiles) > 0, "vazio")

# ======================================================
print("\n=== 6. API: Meals/meal_items existem ===")
r = requests.get(f"{SUPABASE_URL}/rest/v1/meals?select=id,tipo,data&limit=5",
    headers=headers_service())
test("Meals GET retorna 200", r.status_code == 200, f"status={r.status_code}")

# ======================================================
print("\n=== 7. API: Edge Function extract-nutrition responde ===")
r = requests.post(f"{SUPABASE_URL}/functions/v1/extract-nutrition",
    headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}", "Content-Type": "application/json"},
    json={"imageBase64": "dGVzdA=="})
# Sem Gemini key, deve retornar erro sobre API key, nao 404
test("extract-nutrition existe (nao 404)", r.status_code != 404, f"status={r.status_code}")
resp = r.json()
has_gemini_error = "API Key" in resp.get("error", "") or "GEMINI" in resp.get("error", "").upper()
test("Erro indica falta de GEMINI_API_KEY", has_gemini_error, f"error={resp.get('error', '')[:100]}")

# ======================================================
print("\n=== 8. DB: Foreign keys intactas ===")
cur.execute("""SELECT tc.table_name, kcu.column_name, ccu.table_name AS fk_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'""")
fks = cur.fetchall()
test("Foreign keys existem", len(fks) >= 5, f"count={len(fks)}")

expected_fks = ["meal_items.food_id", "meal_items.meal_id", "recipe_items.recipe_id", "favorites.food_id", "habitos_registro.habito_id"]
actual_fks = [f"{r[0]}.{r[1]}" for r in fks]
for fk in expected_fks:
    test(f"FK {fk} existe", fk in actual_fks, "ausente")

# ======================================================
print("\n=== 9. API: Anon nao consegue ler profiles ===")
r = requests.get(f"{SUPABASE_URL}/rest/v1/profiles?select=id,email",
    headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"})
test("Anon profiles retorna vazio", r.status_code == 200 and len(r.json()) == 0, f"status={r.status_code} count={len(r.json()) if r.status_code==200 else 'err'}")

# ======================================================
print("\n=== 10. DB: Tabelas esperadas existem ===")
expected = ["profiles", "foods", "meals", "meal_items", "recipes", "recipe_items",
            "favorites", "recent_foods", "water_intake", "habitos", "habitos_registro",
            "user_meal_config", "admin_plans", "user_roles", "app_config", "meal_reminders"]
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
db_tables = [r[0] for r in cur.fetchall()]
for t in expected:
    test(f"Tabela {t} existe", t in db_tables, "AUSENTE")

conn.close()

# ======================================================
print(f"\n{'='*50}")
print(f"RESULTADO: {passed} passed, {failed} failed")
if errors:
    print(f"\nFalhas:")
    for e in errors:
        print(f"  [FAIL] {e}")
sys.exit(0 if failed == 0 else 1)
