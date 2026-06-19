-- NutriTrack — ambiente de STAGING via schema separado (espelha public.*)
-- Idempotente. Sem dados. Padrão seazone-support-hub. Gerado por introspecção 2026-06-18.
-- Enums ficam em public (tipo compartilhado); tabelas staging usam o tipo public.<enum>.

CREATE SCHEMA IF NOT EXISTS staging;

-- ---------- Tabelas (LIKE INCLUDING ALL) ----------
CREATE TABLE IF NOT EXISTS staging.admin_plans (LIKE public.admin_plans INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.app_config (LIKE public.app_config INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.favorites (LIKE public.favorites INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.foods (LIKE public.foods INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.habitos (LIKE public.habitos INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.habitos_registro (LIKE public.habitos_registro INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.meal_items (LIKE public.meal_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.meal_reminders (LIKE public.meal_reminders INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.meals (LIKE public.meals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.profiles (LIKE public.profiles INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.recent_foods (LIKE public.recent_foods INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.recipe_items (LIKE public.recipe_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.recipes (LIKE public.recipes INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.user_meal_config (LIKE public.user_meal_config INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.user_roles (LIKE public.user_roles INCLUDING ALL);
CREATE TABLE IF NOT EXISTS staging.water_intake (LIKE public.water_intake INCLUDING ALL);

-- ---------- Funções (public -> staging; search_path resolve tabelas em staging, tipos/enums em public) ----------
CREATE OR REPLACE FUNCTION staging.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'staging, public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION staging.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staging, public'
AS $function$
BEGIN
  INSERT INTO staging.profiles (user_id, nome, email, foto_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION staging.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'staging, public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM staging.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION staging.auto_assign_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staging, public'
AS $function$
BEGIN
  IF NEW.email = 'weslleybertoldo18@gmail.com' THEN
    INSERT INTO staging.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION staging.generate_user_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'staging, public'
AS $function$
DECLARE
  current_year INT := EXTRACT(YEAR FROM NOW());
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    (LEFT(user_code::text, LENGTH(user_code::text) - 4))::int
  ), 0) + 1
  INTO next_seq
  FROM profiles
  WHERE RIGHT(user_code::text, 4) = current_year::text;
  NEW.user_code := (next_seq::text || current_year::text)::bigint;
  RETURN NEW;
END;
$function$;

-- ---------- FKs (intra-staging; refs a auth.* preservadas) ----------
ALTER TABLE staging.favorites DROP CONSTRAINT IF EXISTS favorites_food_id_fkey;
ALTER TABLE staging.favorites ADD CONSTRAINT favorites_food_id_fkey FOREIGN KEY (food_id) REFERENCES staging.foods(id) ON DELETE CASCADE;
ALTER TABLE staging.favorites DROP CONSTRAINT IF EXISTS favorites_user_id_fkey;
ALTER TABLE staging.favorites ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.foods DROP CONSTRAINT IF EXISTS foods_atualizado_por_fkey;
ALTER TABLE staging.foods ADD CONSTRAINT foods_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES auth.users(id);
ALTER TABLE staging.foods DROP CONSTRAINT IF EXISTS foods_criado_por_fkey;
ALTER TABLE staging.foods ADD CONSTRAINT foods_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);
ALTER TABLE staging.habitos_registro DROP CONSTRAINT IF EXISTS habitos_registro_habito_id_fkey;
ALTER TABLE staging.habitos_registro ADD CONSTRAINT habitos_registro_habito_id_fkey FOREIGN KEY (habito_id) REFERENCES staging.habitos(id) ON DELETE CASCADE;
ALTER TABLE staging.habitos_registro DROP CONSTRAINT IF EXISTS habitos_registro_user_id_fkey;
ALTER TABLE staging.habitos_registro ADD CONSTRAINT habitos_registro_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.habitos DROP CONSTRAINT IF EXISTS habitos_user_id_fkey;
ALTER TABLE staging.habitos ADD CONSTRAINT habitos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.meal_items DROP CONSTRAINT IF EXISTS meal_items_food_id_fkey;
ALTER TABLE staging.meal_items ADD CONSTRAINT meal_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES staging.foods(id);
ALTER TABLE staging.meal_items DROP CONSTRAINT IF EXISTS meal_items_meal_id_fkey;
ALTER TABLE staging.meal_items ADD CONSTRAINT meal_items_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES staging.meals(id) ON DELETE CASCADE;
ALTER TABLE staging.meal_reminders DROP CONSTRAINT IF EXISTS meal_reminders_user_id_fkey;
ALTER TABLE staging.meal_reminders ADD CONSTRAINT meal_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.meals DROP CONSTRAINT IF EXISTS meals_user_id_fkey;
ALTER TABLE staging.meals ADD CONSTRAINT meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.profiles DROP CONSTRAINT IF EXISTS profiles_plano_id_fkey;
ALTER TABLE staging.profiles ADD CONSTRAINT profiles_plano_id_fkey FOREIGN KEY (plano_id) REFERENCES staging.admin_plans(id) ON DELETE SET NULL;
ALTER TABLE staging.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE staging.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.recent_foods DROP CONSTRAINT IF EXISTS recent_foods_food_id_fkey;
ALTER TABLE staging.recent_foods ADD CONSTRAINT recent_foods_food_id_fkey FOREIGN KEY (food_id) REFERENCES staging.foods(id) ON DELETE CASCADE;
ALTER TABLE staging.recent_foods DROP CONSTRAINT IF EXISTS recent_foods_user_id_fkey;
ALTER TABLE staging.recent_foods ADD CONSTRAINT recent_foods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.recipe_items DROP CONSTRAINT IF EXISTS recipe_items_food_id_fkey;
ALTER TABLE staging.recipe_items ADD CONSTRAINT recipe_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES staging.foods(id);
ALTER TABLE staging.recipe_items DROP CONSTRAINT IF EXISTS recipe_items_recipe_id_fkey;
ALTER TABLE staging.recipe_items ADD CONSTRAINT recipe_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES staging.recipes(id) ON DELETE CASCADE;
ALTER TABLE staging.recipes DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
ALTER TABLE staging.recipes ADD CONSTRAINT recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.user_meal_config DROP CONSTRAINT IF EXISTS user_meal_config_user_id_fkey;
ALTER TABLE staging.user_meal_config ADD CONSTRAINT user_meal_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE staging.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE staging.water_intake DROP CONSTRAINT IF EXISTS water_intake_user_id_fkey;
ALTER TABLE staging.water_intake ADD CONSTRAINT water_intake_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------- RLS ----------
ALTER TABLE staging.admin_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.habitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.habitos_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.meal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.recent_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.user_meal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.water_intake ENABLE ROW LEVEL SECURITY;

-- ---------- Policies ----------
DROP POLICY IF EXISTS "Anyone authenticated can view foods" ON staging.foods;
CREATE POLICY "Anyone authenticated can view foods" ON staging.foods AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert foods" ON staging.foods;
CREATE POLICY "Authenticated users can insert foods" ON staging.foods AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((criado_por = auth.uid()) OR (criado_por IS NULL)));
DROP POLICY IF EXISTS "Users can view own roles" ON staging.user_roles;
CREATE POLICY "Users can view own roles" ON staging.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can view all roles" ON staging.user_roles;
CREATE POLICY "Admins can view all roles" ON staging.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (staging.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins can insert roles" ON staging.user_roles;
CREATE POLICY "Admins can insert roles" ON staging.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (staging.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins can delete roles" ON staging.user_roles;
CREATE POLICY "Admins can delete roles" ON staging.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING (staging.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Anyone authenticated can view plans" ON staging.admin_plans;
CREATE POLICY "Anyone authenticated can view plans" ON staging.admin_plans AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can view own meals" ON staging.meals;
CREATE POLICY "Users can view own meals" ON staging.meals AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own meals" ON staging.meals;
CREATE POLICY "Users can insert own meals" ON staging.meals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own meals" ON staging.meals;
CREATE POLICY "Users can update own meals" ON staging.meals AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own meals" ON staging.meals;
CREATE POLICY "Users can delete own meals" ON staging.meals AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own meal items" ON staging.meal_items;
CREATE POLICY "Users can view own meal items" ON staging.meal_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_items.meal_id) AND (meals.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can insert own meal items" ON staging.meal_items;
CREATE POLICY "Users can insert own meal items" ON staging.meal_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_items.meal_id) AND (meals.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view own reminders" ON staging.meal_reminders;
CREATE POLICY "Users can view own reminders" ON staging.meal_reminders AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own meal items" ON staging.meal_items;
CREATE POLICY "Users can update own meal items" ON staging.meal_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_items.meal_id) AND (meals.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can delete own meal items" ON staging.meal_items;
CREATE POLICY "Users can delete own meal items" ON staging.meal_items AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_items.meal_id) AND (meals.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view own favorites" ON staging.favorites;
CREATE POLICY "Users can view own favorites" ON staging.favorites AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own favorites" ON staging.favorites;
CREATE POLICY "Users can insert own favorites" ON staging.favorites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own favorites" ON staging.favorites;
CREATE POLICY "Users can delete own favorites" ON staging.favorites AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own recent foods" ON staging.recent_foods;
CREATE POLICY "Users can view own recent foods" ON staging.recent_foods AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own recent foods" ON staging.recent_foods;
CREATE POLICY "Users can insert own recent foods" ON staging.recent_foods AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own recent foods" ON staging.recent_foods;
CREATE POLICY "Users can delete own recent foods" ON staging.recent_foods AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own profile" ON staging.profiles;
CREATE POLICY "Users can view own profile" ON staging.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own profile" ON staging.profiles;
CREATE POLICY "Users can insert own profile" ON staging.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own profile" ON staging.profiles;
CREATE POLICY "Users can update own profile" ON staging.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own reminders" ON staging.meal_reminders;
CREATE POLICY "Users can insert own reminders" ON staging.meal_reminders AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own reminders" ON staging.meal_reminders;
CREATE POLICY "Users can update own reminders" ON staging.meal_reminders AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own reminders" ON staging.meal_reminders;
CREATE POLICY "Users can delete own reminders" ON staging.meal_reminders AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own recipes" ON staging.recipes;
CREATE POLICY "Users can view own recipes" ON staging.recipes AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own recipes" ON staging.recipes;
CREATE POLICY "Users can insert own recipes" ON staging.recipes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own recipes" ON staging.recipes;
CREATE POLICY "Users can update own recipes" ON staging.recipes AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own recipes" ON staging.recipes;
CREATE POLICY "Users can delete own recipes" ON staging.recipes AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can view own recipe items" ON staging.recipe_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_items.recipe_id) AND (recipes.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can insert own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can insert own recipe items" ON staging.recipe_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_items.recipe_id) AND (recipes.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can delete own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can delete own recipe items" ON staging.recipe_items AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM recipes
  WHERE ((recipes.id = recipe_items.recipe_id) AND (recipes.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can manage own water intake" ON staging.water_intake;
CREATE POLICY "Users can manage own water intake" ON staging.water_intake AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own water intake" ON staging.water_intake;
CREATE POLICY "Users can view own water intake" ON staging.water_intake AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own water intake" ON staging.water_intake;
CREATE POLICY "Users can insert own water intake" ON staging.water_intake AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete own water intake" ON staging.water_intake;
CREATE POLICY "Users can delete own water intake" ON staging.water_intake AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can manage own meal config" ON staging.user_meal_config;
CREATE POLICY "Users can manage own meal config" ON staging.user_meal_config AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own habitos" ON staging.habitos;
CREATE POLICY "Users manage own habitos" ON staging.habitos AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users manage own habitos_registro" ON staging.habitos_registro;
CREATE POLICY "Users manage own habitos_registro" ON staging.habitos_registro AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Anyone can read plans" ON staging.admin_plans;
CREATE POLICY "Anyone can read plans" ON staging.admin_plans AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON staging.profiles;
CREATE POLICY "Users manage own profile" ON staging.profiles AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Read global and own foods" ON staging.foods;
CREATE POLICY "Read global and own foods" ON staging.foods AS PERMISSIVE FOR SELECT TO public USING (((criado_por IS NULL) OR (criado_por = auth.uid())));
DROP POLICY IF EXISTS "Insert own foods" ON staging.foods;
CREATE POLICY "Insert own foods" ON staging.foods AS PERMISSIVE FOR INSERT TO public WITH CHECK ((criado_por = auth.uid()));
DROP POLICY IF EXISTS "Update own foods" ON staging.foods;
CREATE POLICY "Update own foods" ON staging.foods AS PERMISSIVE FOR UPDATE TO public USING ((criado_por = auth.uid()));
DROP POLICY IF EXISTS "Delete own foods" ON staging.foods;
CREATE POLICY "Delete own foods" ON staging.foods AS PERMISSIVE FOR DELETE TO public USING ((criado_por = auth.uid()));
DROP POLICY IF EXISTS "Users manage own meals" ON staging.meals;
CREATE POLICY "Users manage own meals" ON staging.meals AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users manage own meal items" ON staging.meal_items;
CREATE POLICY "Users manage own meal items" ON staging.meal_items AS PERMISSIVE FOR ALL TO public USING ((meal_id IN ( SELECT meals.id
   FROM meals
  WHERE (meals.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users manage own favorites" ON staging.favorites;
CREATE POLICY "Users manage own favorites" ON staging.favorites AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users manage own reminders" ON staging.meal_reminders;
CREATE POLICY "Users manage own reminders" ON staging.meal_reminders AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users manage own recent foods" ON staging.recent_foods;
CREATE POLICY "Users manage own recent foods" ON staging.recent_foods AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users manage own recipes" ON staging.recipes;
CREATE POLICY "Users manage own recipes" ON staging.recipes AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users manage own recipe items" ON staging.recipe_items;
CREATE POLICY "Users manage own recipe items" ON staging.recipe_items AS PERMISSIVE FOR ALL TO public USING ((recipe_id IN ( SELECT recipes.id
   FROM recipes
  WHERE (recipes.user_id = auth.uid()))));
DROP POLICY IF EXISTS "Users manage own water intake" ON staging.water_intake;
CREATE POLICY "Users manage own water intake" ON staging.water_intake AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users see own role" ON staging.user_roles;
CREATE POLICY "Users see own role" ON staging.user_roles AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can read app_config" ON staging.app_config;
CREATE POLICY "Authenticated users can read app_config" ON staging.app_config AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can update own foods" ON staging.foods;
CREATE POLICY "Users can update own foods" ON staging.foods AS PERMISSIVE FOR UPDATE TO authenticated USING ((criado_por = auth.uid())) WITH CHECK (((criado_por = auth.uid()) AND (atualizado_por = auth.uid())));

-- ---------- Triggers (em tabelas public -> staging; triggers em auth.* NÃO são replicados) ----------
DROP TRIGGER IF EXISTS update_profiles_updated_at ON staging.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON staging.profiles FOR EACH ROW EXECUTE FUNCTION staging.update_updated_at_column();
DROP TRIGGER IF EXISTS update_foods_updated_at ON staging.foods;
CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON staging.foods FOR EACH ROW EXECUTE FUNCTION staging.update_updated_at_column();
DROP TRIGGER IF EXISTS update_recipes_updated_at ON staging.recipes;
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON staging.recipes FOR EACH ROW EXECUTE FUNCTION staging.update_updated_at_column();
DROP TRIGGER IF EXISTS set_user_code ON staging.profiles;
CREATE TRIGGER set_user_code BEFORE INSERT ON staging.profiles FOR EACH ROW WHEN ((new.user_code IS NULL)) EXECUTE FUNCTION staging.generate_user_code();
DROP TRIGGER IF EXISTS auto_admin_on_profile ON staging.profiles;
CREATE TRIGGER auto_admin_on_profile AFTER INSERT ON staging.profiles FOR EACH ROW EXECUTE FUNCTION staging.auto_assign_admin();

-- ---------- Grants ----------
GRANT USAGE ON SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA staging TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA staging TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
