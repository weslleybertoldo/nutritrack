-- Staging: policies de meal_items/recipe_items referenciavam "meals"/"recipes"
-- SEM qualificar o schema. Via PostgREST (Accept-Profile: staging) o nome
-- resolvia para public.meals/public.recipes → o EXISTS falhava e itens do
-- sandbox ficavam invisíveis (SELECT) e inserção era negada (WITH CHECK).
-- Fix: recriar as policies com staging.* qualificado. Idempotente.

-- meal_items -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own meal items" ON staging.meal_items;
CREATE POLICY "Users can view own meal items" ON staging.meal_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staging.meals m WHERE m.id = meal_items.meal_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own meal items" ON staging.meal_items;
CREATE POLICY "Users can insert own meal items" ON staging.meal_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staging.meals m WHERE m.id = meal_items.meal_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own meal items" ON staging.meal_items;
CREATE POLICY "Users can update own meal items" ON staging.meal_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staging.meals m WHERE m.id = meal_items.meal_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own meal items" ON staging.meal_items;
CREATE POLICY "Users can delete own meal items" ON staging.meal_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staging.meals m WHERE m.id = meal_items.meal_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage own meal items" ON staging.meal_items;
CREATE POLICY "Users manage own meal items" ON staging.meal_items
  FOR ALL TO public
  USING (meal_id IN (SELECT m.id FROM staging.meals m WHERE m.user_id = auth.uid()));

-- recipe_items ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can view own recipe items" ON staging.recipe_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staging.recipes r WHERE r.id = recipe_items.recipe_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can insert own recipe items" ON staging.recipe_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staging.recipes r WHERE r.id = recipe_items.recipe_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own recipe items" ON staging.recipe_items;
CREATE POLICY "Users can delete own recipe items" ON staging.recipe_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staging.recipes r WHERE r.id = recipe_items.recipe_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users manage own recipe items" ON staging.recipe_items;
CREATE POLICY "Users manage own recipe items" ON staging.recipe_items
  FOR ALL TO public
  USING (recipe_id IN (SELECT r.id FROM staging.recipes r WHERE r.user_id = auth.uid()));
