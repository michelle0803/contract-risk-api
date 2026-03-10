const Anthropic = require('@anthropic-ai/sdk');

// Initialize the client — automatically uses ANTHROPIC_API_KEY from .env
const client = new Anthropic();

/**
 * Analyzes a contract and returns a structured risk assessment.
 * @param {string} contractText - The full text of the contract
 * @param {string} contractType - e.g. 'NDA', 'SOW', 'MSA', 'Vendor'
 * @returns {Object} { riskScore, riskSummary, flags[] }
 */
async function analyzeContract(contractText, contractType) {

  // Truncate very long contracts to avoid token limits
  const truncated = contractText.length > 15000
    ? contractText.substring(0, 15000) + '\n[Contract truncated for analysis]'
    : contractText;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a contract risk analyst specializing in ${contractType} agreements.
Analyze the contract below and respond ONLY with a valid JSON object.
Do not include any text before or after the JSON. No markdown backticks.

Contract:
${truncated}

Respond with this exact JSON structure:
{
  \"riskScore\": <integer 1-10, where 10 is highest risk>,
  \"riskSummary\": \"<2-3 sentence plain English summary of overall risk>\",
  \"flags\": [
    {
      \"title\": \"<short descriptive flag name>\",
      \"clauseText\": \"<exact quoted text from contract that is problematic>\",
      \"category\": \"<one of: Liability, IP, Payment, Termination, Compliance>\",
      \"severity\": \"<one of: Low, Medium, High, Critical>\",
      \"recommendation\": \"<specific actionable advice to address this flag>\"
    }
  ]
}`
    }]
  });

  // Parse the JSON response
  const raw = response.content[0].text.trim();

  try {
    const result = JSON.parse(raw);

    // Validate the shape of the response
    if (typeof result.riskScore !== 'number' || !Array.isArray(result.flags)) {
      throw new Error('Unexpected response shape from Claude');
    }

    return result;

  } catch (parseError) {
    console.error('Failed to parse Claude response:', raw);
    throw new Error(`Claude returned invalid JSON: ${parseError.message}`);
  }
}

module.exports = { analyzeContract };
