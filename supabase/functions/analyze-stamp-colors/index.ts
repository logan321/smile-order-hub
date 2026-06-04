
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { colors } = await req.json()

    const prompt = `
      Você é um especialista em design de estampas têxteis. 
      Analise a seguinte lista de cores detectadas em um arquivo SVG de uma estampa.
      
      Cores:
      ${JSON.stringify(colors, null, 2)}
      
      Sua tarefa é classificar cada cor em um dos seguintes grupos semânticos:
      1. "Cor Base" (a cor predominante do fundo ou maior área)
      2. "Cor Secundária" (áreas médias)
      3. "Detalhes" (pequenos elementos decorativos)
      4. "Textos" (se houver indicação de texto)
      5. "Destaque" (cores vibrantes para chamar atenção)

      Retorne apenas um JSON no seguinte formato:
      [
        { "hex": "#HEX", "group": "Nome do Grupo", "reason": "Breve motivo" }
      ]
    `

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'system', content: 'Você é um assistente técnico de design.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }),
    })

    const data = await response.json()
    const result = data.choices[0].message.content

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
