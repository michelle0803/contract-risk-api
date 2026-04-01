const express = require('express');
const router  = express.Router();
const { analyzeContract }                         = require('../services/claudeService');
const { updateContract, createRiskFlag, logReviewEvent } = require('../services/dataverseService');

router.get('/ping', (req, res) => {
  res.json({ message: 'analyze router is connected' });
});

router.post('/analyze', async (req, res) => {
  const { contractId, contractText, contractType = 'General' } = req.body;

  if (!contractId || !contractText) {
    return res.status(400).json({ error: 'contractId and contractText are required' });
  }
  if (contractText.trim().length < 50) {
    return res.status(400).json({ error: 'contractText is too short to analyze meaningfully' });
  }

  console.log(`[analyze] Starting analysis for contract: ${contractId}`);

  try {
    // ── STEP 1: Log that analysis has started ──────────────
    await logReviewEvent(contractId, 'AI Analysis', 'initiated');

    // ── STEP 2: Send contract to Claude ────────────────────
    console.log(`[analyze] Sending to Claude...`);
    const analysis = await analyzeContract(contractText, contractType);
    console.log(`[analyze] Score: ${analysis.riskScore}, Flags: ${analysis.flags.length}`);

    // ── STEP 3: Write risk score and summary to Contracts ──
    await updateContract(contractId, analysis.riskScore, analysis.riskSummary);

    // ── STEP 4: Create a Risk Flag row for each flag ───────
    for (const flag of analysis.flags) {
      await createRiskFlag(contractId, flag);
    }

    // ── STEP 5: Log completion ──────────────────────────────
    await logReviewEvent(
      contractId,
      'AI Analysis',
      `Complete. Score: ${analysis.riskScore}/10. Flags: ${analysis.flags.length}`
    );

    return res.status(200).json({
      success:     true,
      riskScore:   analysis.riskScore,
      riskSummary: analysis.riskSummary,
      flagCount:   analysis.flags.length,
    });

  } catch (error) {
    console.error(`[analyze] Error:`, error.message);
    return res.status(500).json({
      error:  'Analysis failed',
      detail: error.message,
    });
  }
});

module.exports = router;


