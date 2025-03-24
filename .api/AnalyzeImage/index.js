/**
 * index.js for .api/AnalyzeImage
 *
 * Receives { imageBase64 } in req.body, calls Gemini to identify item & approximate cost,
 * and returns JSON like: { name: "...", cost: 123 }
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (context, req) {
  context.log("AnalyzeImage function triggered.");

  if (req.method !== "POST") {
    context.res = {
      status: 405,
      body: "Method Not Allowed"
    };
    return;
  }

  // Make sure we have a base64-encoded image and a GEMINI_API_KEY
  const base64 = req.body?.imageBase64;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    context.log.error("Missing GEMINI_API_KEY environment variable.");
    context.res = {
      status: 500,
      body: { error: "Server not configured with Gemini key" }
    };
    return;
  }
  if (!base64) {
    context.res = {
      status: 400,
      body: { error: "Missing imageBase64 in request body." }
    };
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const instructions = `
      Look at the following image and identify a single consumer item in it.
      Be specific about what the item is (e.g., "Sony WH-1000XM4 Headphones" not just "Headphones").
      Estimate an approximate cost in USD.
      Return only valid JSON in the format:
      {
        "name": "<specific item name>",
        "cost": <number>
      }
      
      If you cannot confidently identify the item, use "Unknown" as the name.
    `.trim();

    const inlinePart = {
      inlineData: {
        data: base64,
        mimeType: "image/jpeg"
      }
    };

    const result = await model.generateContent([instructions, inlinePart]);
    const text = await result.response.text();
    context.log("Gemini raw response:", text);

    let recognized = { name: "Unknown", cost: 0 };
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        recognized = JSON.parse(jsonMatch[0]);
      } catch (err) {
        context.log.warn("Error parsing JSON from Gemini:", err);
      }
    }

    if (!recognized.name) recognized.name = "Unknown";
    if (!recognized.cost || isNaN(recognized.cost)) recognized.cost = 0;

    context.res = {
      body: {
        name: recognized.name,
        cost: recognized.cost
      }
    };
  } catch (err) {
    context.log.error("Error calling Gemini:", err);
    context.res = {
      status: 500,
      body: {
        error: "Gemini call failed",
        details: err.message
      }
    };
  }
};
