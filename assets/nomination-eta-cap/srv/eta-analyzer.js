/**
 * ETA Analyzer - calls SAP AI Core via BTP Destination to analyze nominations
 * and produce ETA proposals using LLM.
 */
import { callViaDestination } from './destination-helper.js';

const LOG = cds.log('eta-analyzer');

export async function analyzeNomination(nomination) {
  try {
    LOG.info(`Analyzing ETA for nomination: ${nomination.nominationId}`);

    // Call AI Core chat completions via destination
    const response = await callViaDestination('aicore', '/v2/inference/deployments/latest/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AI-Resource-Group': 'default'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert oil & gas logistics analyst specializing in nomination ETA predictions. 
Analyze the nomination details and provide a realistic ETA estimate based on:
- Transport system and route characteristics
- Material type and typical handling times
- Industry standard transit times for the transport mode
- Location information

Respond ONLY with a valid JSON object in this exact format:
{
  "proposed_eta_utc": "YYYY-MM-DDTHH:mm:ss",
  "confidence": "High|Medium|Low",
  "reasoning": "Brief explanation of the ETA estimate",
  "supporting_evidence": {
    "historical": {
      "avg_lead_time_days": <number>,
      "min_days": <number>,
      "max_days": <number>,
      "sample_size": <number>,
      "recent_trend": "stable|increasing|decreasing",
      "confidence": "High|Medium|Low"
    },
    "geo_weather": {
      "overall_risk": "Low|Medium|High",
      "weather_summary": {"weather_risk": "Low|Medium|High"},
      "geopolitical_summary": {"geo_risk": "Low|Medium|High"},
      "total_estimated_delay_days": <number>
    }
  }
}`
          },
          {
            role: 'user',
            content: `Analyze ETA for this oil & gas nomination:
- Nomination ID: ${nomination.nominationId}
- Material: ${nomination.material}
- Transport System: ${nomination.transportSystem}
- Origin Location: ${nomination.origin}
- Destination Location: ${nomination.destination}
- Vehicle/Vessel: ${nomination.vesselName || nomination.vesselMMSI || 'Not specified'}

Provide a realistic ETA estimate. The current date is ${new Date().toISOString().split('T')[0]}.`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      })
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from AI Core');

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');
    const proposal = JSON.parse(jsonMatch[0]);

    LOG.info(`ETA proposal generated for ${nomination.nominationId}: ${proposal.proposed_eta_utc}`);
    return proposal;

  } catch (e) {
    LOG.warn(`ETA analysis failed for ${nomination.nominationId}: ${e.message}`);
    return null;
  }
}
