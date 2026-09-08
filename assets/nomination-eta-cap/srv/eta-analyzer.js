/**
 * ETA Analyzer - calls SAP AI Core via BTP Destination to analyze nominations
 * and produce ETA proposals using LLM.
 */
import { callViaDestination } from './destination-helper.js';

const LOG = cds.log('eta-analyzer');

export async function analyzeNomination(nomination) {
  try {
    LOG.info(`Analyzing ETA for nomination: ${nomination.nominationId}`);

    const destinationName = process.env.AICORE_DESTINATION_NAME || 'aicore';
    const model = process.env.AGENT_LLM_MODEL || 'gpt-4o';

    // Get list of deployments from default resource group
    const deploymentsResponse = await callViaDestination(destinationName, '/v2/lm/deployments', {
      method: 'GET',
      headers: { 'AI-Resource-Group': 'default' }
    });

    // Find a running foundation-models deployment matching the configured model
    const deployments = deploymentsResponse?.resources || [];
    const runningDeployments = deployments.filter(d => d.status === 'RUNNING' && d.scenarioId === 'foundation-models');

    // Prefer matching model name, fallback to gpt-4o, fallback to first running
    const modelName = model.replace('gpt-4o', 'gpt-4o'); // normalize
    let deployment = runningDeployments.find(d => d.details?.resources?.backendDetails?.model?.name === modelName)
      || runningDeployments.find(d => d.details?.resources?.backendDetails?.model?.name === 'gpt-4o')
      || runningDeployments[0];

    if (!deployment) throw new Error(`No running foundation-models deployments found`);

    const deploymentId = deployment.id;
    LOG.info(`Using deployment: ${deploymentId} (model: ${deployment.details?.resources?.backendDetails?.model?.name})`);

    const chatResponse = await callViaDestination(destinationName, `/v2/inference/deployments/${deploymentId}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AI-Resource-Group': 'default'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are an expert oil & gas logistics analyst. Analyze the nomination and provide ETA estimate.
Respond ONLY with valid JSON:
{
  "proposed_eta_utc": "YYYY-MM-DDTHH:mm:ss",
  "confidence": "High|Medium|Low",
  "reasoning": "explanation",
  "supporting_evidence": {
    "historical": {"avg_lead_time_days": 0, "min_days": 0, "max_days": 0, "sample_size": 0, "recent_trend": "stable", "confidence": "Medium"},
    "ais": {"remaining_distance_nm": 0, "sog_knots": 0, "vessel_status": "unknown", "destination_mismatch": false, "confidence": "Medium"},
    "geo_weather": {"overall_risk": "Low", "weather_summary": {"weather_risk": "Low"}, "geopolitical_summary": {"geo_risk": "Low"}, "total_estimated_delay_days": 0}
  }
}`
          },
          {
            role: 'user',
            content: `Nomination: ID=${nomination.nominationId}, Material=${nomination.material}, Transport=${nomination.transportSystem}, Origin=${nomination.origin}, Destination=${nomination.destination}, Vehicle=${nomination.vesselName || nomination.vesselMMSI || 'N/A'}. Today: ${new Date().toISOString().split('T')[0]}`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      })
    });

    const content = chatResponse?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from AI Core');

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
