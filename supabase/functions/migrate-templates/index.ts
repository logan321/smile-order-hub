import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Get all templates
    const { data: templates, error: tError } = await supabaseClient
      .from('shirt_templates')
      .select('id, uv_map_url')

    if (tError) throw tError

    const results = []

    for (const template of templates) {
      if (!template.uv_map_url) continue;

      try {
        const res = await fetch(template.uv_map_url)
        const svgText = await res.text()
        
        // Basic hex extractor (since we can't use DOMParser in Edge Function easily without extra deps)
        const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g
        const matches = svgText.match(hexRegex)
        const uniqueColors = [...new Set(matches?.map(c => {
          let hex = c.toUpperCase()
          if (hex.length === 4) {
            hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
          }
          return hex
        }) || [])]

        if (uniqueColors.length > 0) {
          const toInsert = uniqueColors.map((color, idx) => ({
            template_id: template.id,
            original_color: color,
            region_name: `Cor ${idx + 1}`,
            sort_order: idx
          }))

          // Check if mappings already exist to avoid duplicates
          const { count } = await supabaseClient
            .from('template_color_mappings')
            .select('*', { count: 'exact', head: true })
            .eq('template_id', template.id)

          if (count === 0) {
            const { error: insError } = await supabaseClient
              .from('template_color_mappings')
              .insert(toInsert)
            
            if (insError) throw insError
            results.push({ id: template.id, status: 'migrated', colors: uniqueColors.length })
          } else {
            results.push({ id: template.id, status: 'skipped (already exists)' })
          }
        }
      } catch (err) {
        results.push({ id: template.id, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
