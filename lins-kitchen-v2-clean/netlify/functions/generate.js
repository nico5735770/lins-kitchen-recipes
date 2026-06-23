exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured on the server." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request." }) };
  }

  const { fridge, spices, pantry, diet, time, cuisine, skill } = body;

  if (!fridge && !spices && !pantry) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Please add some ingredients first!" }) };
  }

  const inventoryParts = [];
  if (fridge) inventoryParts.push(`FRIDGE: ${fridge}`);
  if (spices) inventoryParts.push(`SPICE CABINET: ${spices}`);
  if (pantry)  inventoryParts.push(`PANTRY: ${pantry}`);

  const prefParts = [];
  if (diet && diet !== "none") prefParts.push(`dietary preference: ${diet}`);
  if (time && time !== "any")  prefParts.push(`max cooking time: ${time} minutes`);
  if (cuisine && cuisine !== "any") prefParts.push(`preferred cuisine: ${cuisine}`);
  if (skill && skill !== "any") prefParts.push(`skill level: ${skill}`);
  const prefsText = prefParts.length ? `\n\nUSER PREFERENCES: ${prefParts.join(", ")}` : "";

  const prompt = `You are a warm, encouraging home cook assistant. Generate exactly 5 recipes using ONLY the ingredients listed — never invent ingredients the user does not have.

KITCHEN INVENTORY:
${inventoryParts.join("\n")}${prefsText}

For each recipe, use this exact format:

━━━━━━━━━━━━━━━━━━━━━━━━
RECIPE [number]: [NAME]
Cuisine: [type] | Difficulty: [Easy/Medium/Challenging] | Total time: [X min] | Serves: [X]
━━━━━━━━━━━━━━━━━━━━━━━━

INGREDIENTS
• [ingredient + quantity]

INSTRUCTIONS
Step 1 — [Title] ([X min])
[Detail with sensory cues — what it looks/smells/feels like when done]

[continue steps...]

DONE WHEN: [clear visual/smell/texture cue]
PRO TIP: [one practical tip]
SERVING SUGGESTION: [simple serving idea]

---

Rules:
- Use ONLY ingredients from the inventory
- Vary the 5 recipes: 1 quick under 20 min, 1 hearty comfort meal, 1 vegetable-forward, 1 creative/unexpected, 1 wildcard
- Include timing for every step
- If ONE missing ingredient would greatly improve a recipe, add Optional upgrade at the end
- Flag allergy info if relevant
- Keep language warm and friendly
- Never say cook until done — always define done with a sensory cue`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.map((c) => c.text || "").join("") || "";

    return { statusCode: 200, headers, body: JSON.stringify({ result: text }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
