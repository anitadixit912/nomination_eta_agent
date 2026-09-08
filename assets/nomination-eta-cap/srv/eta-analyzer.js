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
    const response = await callViaDestination('aicore', '/v2/inference/deployments', {
      method: 'GET',
      headers: { 'AI-Resource-Group': 'default' }
    });

    // Find an active chat deployment
    const deployments = response?.resources || [];
    const chatDeployment = deployments.find(d =>
      d.status === 'RUNNING' && (d.details?.resources?.backend_details?.model?.name?.includes('gpt') ||
      d.details?.resources?.backend_details?.model?.name?.includes('claude') ||
      d.details?.resources?.backend_details?.model?.name?.includes('llama'))
    );
    if (!chatDeployment) throw new Error('No running LLM deployment found in AI Core');

    const deploymentId = chatDeployment.id;
    LOG.info(`Using AI Core deployment: ${deploymentId} (${chatDeployment.details?.resources?.backend_details?.model?.name})`);

    const chatResponse = await callViaDestination('aicore', `/v2/inference/deployments/${deploymentId}/chat/completions`, {
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
- Vehicle/vessel tracking estimates

Respond ONLY with a valid JSON object in this exact format:
{
  "proposed_eta_utc": "YYYY-MM-DDTHH:mm:ss",
  "confidence": "High|Medium|Low",
  "reasoning": "Detailed explanation of the ETA estimate including all factors considered",
  "supporting_evidence": {
    "historical": {
      "avg_lead_time_days": <number>,
      "min_days": <number>,
      "max_days": <number>,
      "sample_size": <number>,
      "recent_trend": "stable|increasing|decreasing",
      "confidence": "High|Medium|Low"
    },
    "ais": {
      "remaining_distance_nm": <number>,
      "sog_knots": <number>,
      "vessel_status": "underway|at_anchor|moored|unknown",
      "destination_mismatch": false,
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

    const content = chatResponse?.choices?.[0]?.message?.content;
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
