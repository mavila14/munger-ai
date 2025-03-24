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
      Look at the following image and identify the consumer item shown.
      Be very specific and detailed about what you see (e.g., "Apple iPhone 14 Pro" rather than just "smartphone").
      
      Your task is to:
      1. Identify the exact item with brand and model if visible
      2. Estimate a realistic cost in USD 
      
      Return only valid JSON in the format:
      {
        "name": "<specific item name with brand if visible>",
        "cost": <estimated cost as a number>
      }
      
      If you cannot confidently identify the specific item, provide your best guess with whatever details you can see (color, style, approximate type).
      Only use "Unknown" as the name if the image is completely unrecognizable.
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
