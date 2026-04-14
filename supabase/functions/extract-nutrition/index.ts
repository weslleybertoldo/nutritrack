import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Verificar autenticação JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Token de autenticação necessário" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rejeita anon key (apenas usuários logados podem usar extração por foto)
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (token === anonKey) {
    return new Response(JSON.stringify({ error: "Autenticação de usuário necessária" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    anonKey,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const prompt = `Read this nutrition label image. Return a JSON object (no markdown, no backticks) with: {"nome":string|null,"calorias_por_100":number|null,"proteina_por_100":number|null,"carbo_por_100":number|null,"acucares_por_100":number|null,"gordura_por_100":number|null,"gordura_saturada_por_100":number|null,"gordura_trans_por_100":number|null,"fibras_por_100":number|null,"sodio_por_100":number|null,"colesterol_por_100":number|null,"potassio_por_100":number|null}. Convert values to per 100g/ml. Use null if not found. ONLY the JSON object, nothing else.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API returned ${response.status}: ${t}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let nutritionData;
    try {
      // Remove markdown code blocks (```json ... ```)
      let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr) {
      // Tenta parse parcial: se JSON truncado, completa com nulls
      try {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const partial = cleaned.match(/\{[\s\S]*/);
        if (partial) {
          // Fecha campos abertos e o objeto
          let fix = partial[0].replace(/,\s*$/, "") + "}";
          // Remove trailing incomplete key-value pairs
          fix = fix.replace(/,\s*"[^"]*":\s*$/, "}");
          nutritionData = JSON.parse(fix);
        } else {
          throw parseErr;
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Could not parse nutrition data", raw: content.slice(0, 300) }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true, data: nutritionData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-nutrition error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
