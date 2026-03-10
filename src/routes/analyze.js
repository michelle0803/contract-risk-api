const express = require('express');
const router  = express.Router();
router.get('/ping', (req, res) => {
  res.json({ message: 'analyze router is connected' });
});
const { analyzeContract } = require('../services/claudeService');

router.post('/analyze', async (req, res) => {
  const { contractId, contractText, contractType = 'General' } = req.body;

  if (!contractId || !contractText) {
    return res.status(400).json({
      error: 'contractId and contractText are required'
    });
  }

  if (contractText.trim().length < 50) {
    return res.status(400).json({
      error: 'contractText is too short to analyze meaningfully'
    });
  }

  console.log(`[analyze] Starting analysis for contract: ${contractId}`);

  try {
    console.log(`[analyze] Sending to Claude...`);
    const analysis = await analyzeContract(contractText, contractType);
    console.log(`[analyze] Claude returned score: ${analysis.riskScore}, flags: ${analysis.flags.length}`);

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

