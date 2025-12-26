
import { GoogleGenAI, Type } from "@google/genai";
import { Devotional } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getDailyDevotional = async (reading: string): Promise<Devotional> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Gere um devocional diário curto em Português para a leitura de: ${reading}. 
               O devocional deve incluir um título inspirador, um resumo dos capítulos, uma reflexão prática para a vida diária, uma pequena oração e um versículo chave.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          reflection: { type: Type.STRING },
          prayer: { type: Type.STRING },
          keyVerse: { type: Type.STRING },
        },
        required: ["title", "summary", "reflection", "prayer", "keyVerse"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const askBibleAssistant = async (question: string, context: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Você é o assistente bíblico do On The Way. Responda à pergunta baseada na leitura de hoje (${context}): ${question}`,
    config: {
      systemInstruction: "Seja encorajador, teologicamente equilibrado e focado na jornada de fé cristã.",
    }
  });
  return response.text || "Desculpe, não consegui processar sua pergunta.";
};
