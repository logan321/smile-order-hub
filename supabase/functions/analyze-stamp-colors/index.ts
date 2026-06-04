
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
    const { colors, texts, images } = await req.json()

    const prompt = `
      Você é um especialista em design de estampas têxteis. 
      Analise a composição de uma estampa SVG com base nos seguintes dados:
      
      Cores: ${JSON.stringify(colors)}
      Textos Detectados: ${JSON.stringify(texts?.map((t: any) => ({ id: t.id, text: t.text })))}
      Imagens/Logos Detectados: ${JSON.stringify(images?.map((img: any) => ({ id: img.id })))}
      
      Sua tarefa:
      1. Classificar cada cor em: "Cor Base", "Cor Secundária", "Detalhes", "Textos", "Destaque".
      2. Dar um nome amigável para cada campo de texto detectado (ex: se o texto é "SEU NOME", o nome do campo é "Nome do Atleta").
      3. Dar um nome amigável para cada logo/imagem detectada (ex: se o ID é "escudo", o nome do campo é "Escudo do Time").

      Retorne APENAS um JSON no formato:
      {
        "colors": [ { "hex": "#HEX", "group": "Nome do Grupo", "reason": "Motivo" } ],
        "texts": [ { "id": "id", "group": "Nome Amigável" } ],
        "images": [ { "id": "id", "group": "Nome Amigável" } ]
      }
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

    const data = await response.json();
    const result = data.choices[0].message.content;

    // A IA pode retornar o JSON dentro de um campo ou como string pura.
    // Como usamos response_format: json_object, o Gemini deve retornar um objeto válido.
    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
    } catch (e) {
      console.error("Erro ao fazer parse do resultado da IA:", e);
      parsedResult = result;
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
