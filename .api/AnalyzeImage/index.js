/**
 * index.js for .api/AnalyzeImage
 *
 * Receives { imageBase64 } in req.body, calls Gemini to identify item & approximate cost,
 * and returns JSON like: { name: "...", cost: 123 }
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * We'll do a single, simple call: we pass in the Base64 image plus a text
 * prompt telling Gemini to identify the item and estimate its cost.
 */
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

    // We’ll pick a model that supports vision, e.g. "gemini-1.5-pro" or "gemini-1.5-flash"
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // We’ll pass in a prompt that instructs the model to:
    // - Identify the item in the image
    // - Estimate an approximate cost
    // - Return valid JSON
    const instructions = `
      Look at the following image and identify a single consumer item in it.
      Estimate an approximate cost in USD.
      Return only valid JSON in the format:
      {
        "name": "<item name>",
        "cost": <number>
      }
    `.trim();

    // The inline data part
    const inlinePart = {
      inlineData: {
        data: base64,
        mimeType: "image/jpeg"
      }
    };

    // We'll call generateContent() with an array of "Parts" or strings
    // The first item can be the instructions, second is the image
    // or you can do [image, instructions]. Typically "text last" is recommended,
    // but we’ll do text first for clarity.
    const result = await model.generateContent([instructions, inlinePart]);

    const text = await result.response.text();

    context.log("Gemini raw response:", text);

    // The model might produce extra text. We'll attempt to parse JSON from it.
    // For safety, find the first { ... } block in the text.
    let recognized = { name: "Unknown", cost: 0 };
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        recognized = JSON.parse(jsonMatch[0]);
      } catch (err) {
        context.log.warn("Error parsing JSON from Gemini:", err);
      }
    }

    // Ensure name/cost exist
    if (!recognized.name) {
      recognized.name = "Unknown";
    }
    if (!recognized.cost || isNaN(recognized.cost)) {
      recognized.cost = 0;
    }

    // Return the item name & cost
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
