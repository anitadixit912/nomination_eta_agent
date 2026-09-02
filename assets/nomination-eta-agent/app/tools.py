"""
Tools for the Nomination ETA Orchestrator Agent.
Coordinates the three specialist agents via A2A HTTP calls and writes back to OGS/650 via CAP.
"""
import json
import logging
import os
from typing import Any

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

HISTORICAL_AGENT_URL = os.environ.get("HISTORICAL_AGENT_URL", "http://localhost:8001")
AIS_AGENT_URL = os.environ.get("AIS_AGENT_URL", "http://localhost:8002")
GEO_WEATHER_AGENT_URL = os.environ.get("GEO_WEATHER_AGENT_URL", "http://localhost:8003")
CAP_SERVICE_URL = os.environ.get("CAP_SERVICE_URL", "http://localhost:4004")


def _call_specialist_agent(base_url: str, message: str, context_id: str) -> dict:
    """Call a specialist agent via A2A protocol."""
    try:
        response = httpx.post(
            f"{base_url}/invoke",
            json={"message": message, "context_id": context_id},
            timeout=60
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error("Specialist agent call failed: %s — %s", base_url, e)
        return {"error": str(e), "status": "agent_unavailable"}


@tool
def call_historical_agent(
    material: str,
    transport_system: str,
    origin: str,
    destination: str,
    nomination_id: str
) -> str:
    """
    Call the Historical Nomination Agent to get voyage pattern statistics.

    Args:
        material: Material code from the nomination
        transport_system: Transport system ID
        origin: Origin location
        destination: Destination location
        nomination_id: Nomination ID for context tracking
    """
    message = (
        f"Analyse historical ETA patterns for nomination {nomination_id}. "
        f"Material: {material}, Transport system: {transport_system}, "
        f"Origin: {origin}, Destination: {destination}. "
        f"Return structured JSON with avg_lead_time_days, confidence, and reasoning."
    )
    result = _call_specialist_agent(HISTORICAL_AGENT_URL, message, nomination_id)
    return json.dumps(result)


@tool
def call_ais_agent(
    vessel_mmsi: str,
    destination: str,
    nomination_id: str
) -> str:
    """
    Call the AIS Vessel Tracking Agent to get live vessel position and predicted ETA.

    Args:
        vessel_mmsi: Vessel MMSI number
        destination: Nomination destination port
        nomination_id: Nomination ID for context tracking
    """
    message = (
        f"Track vessel MMSI {vessel_mmsi} for nomination {nomination_id}. "
        f"Compute predicted ETA to {destination}. "
        f"Return structured JSON with predicted_eta_utc, sog_knots, remaining_distance_nm, and confidence."
    )
    result = _call_specialist_agent(AIS_AGENT_URL, message, nomination_id)
    return json.dumps(result)


@tool
def call_geo_weather_agent(
    origin: str,
    destination: str,
    nomination_id: str
) -> str:
    """
    Call the Geopolitical & Weather Forecast Agent to assess route risk.

    Args:
        origin: Origin port name
        destination: Destination port name
        nomination_id: Nomination ID for context tracking
    """
    message = (
        f"Assess route risk for nomination {nomination_id}. "
        f"Route: {origin} to {destination}. "
        f"Return structured JSON with overall_risk, total_estimated_delay_days, and reasoning."
    )
    result = _call_specialist_agent(GEO_WEATHER_AGENT_URL, message, nomination_id)
    return json.dumps(result)


@tool
def write_eta_to_nomination(
    nomination_id: str,
    approved_eta: str,
    decision_maker: str,
    reasoning: str
) -> str:
    """
    Write the approved ETA back to the nomination in OGS/650 via the CAP service.
    IMPORTANT: Only call this after receiving an explicit supervisor approval signal.

    Args:
        nomination_id: Nomination ID in OGS/650
        approved_eta: Approved ETA in ISO 8601 format
        decision_maker: Supervisor user ID who approved
        reasoning: Agent reasoning for the audit log
    """
    try:
        response = httpx.post(
            f"{CAP_SERVICE_URL}/api/nominations/{nomination_id}/eta",
            json={
                "approvedETA": approved_eta,
                "decisionMaker": decision_maker,
                "reasoning": reasoning
            },
            timeout=30
        )
        response.raise_for_status()
        logger.info(
            "[M5.achieved]: ETA written to OGS/650 and audit log created — nomination_id=%s, eta=%s",
            nomination_id, approved_eta
        )
        return json.dumps({"status": "success", "nomination_id": nomination_id, "eta": approved_eta})
    except Exception as e:
        logger.error(
            "[M5.missed]: ETA write to OGS/650 failed — nomination_id=%s, reason=%s",
            nomination_id, str(e)
        )
        return json.dumps({"status": "error", "reason": str(e)})


@tool
def write_audit_log(
    nomination_id: str,
    event_type: str,
    eta_value: str,
    decision_maker: str,
    agent_reasoning: str,
    rejection_reason: str = ""
) -> str:
    """
    Write an audit log entry to the CAP audit service.

    Args:
        nomination_id: Nomination ID
        event_type: Event type (proposed/approved/rejected/written_back/deviation_flagged)
        eta_value: ETA value being recorded
        decision_maker: User ID or 'system'
        agent_reasoning: Full reasoning from the ETA proposal
        rejection_reason: Supervisor rejection reason (if applicable)
    """
    try:
        response = httpx.post(
            f"{CAP_SERVICE_URL}/api/audit",
            json={
                "nominationId": nomination_id,
                "eventType": event_type,
                "etaValue": eta_value,
                "decisionMaker": decision_maker,
                "agentReasoning": agent_reasoning,
                "rejectionReason": rejection_reason,
                "sourceAgents": "historical-nomination-agent, ais-vessel-tracking-agent, geo-weather-agent"
            },
            timeout=15
        )
        response.raise_for_status()
        return json.dumps({"status": "success", "audit_event": event_type})
    except Exception as e:
        logger.error("Audit log write failed: %s", e)
        return json.dumps({"status": "error", "reason": str(e)})


def get_custom_tools() -> list[Any]:
    """Return the list of custom tools for this agent."""
    return [
        call_historical_agent,
        call_ais_agent,
        call_geo_weather_agent,
        write_eta_to_nomination,
        write_audit_log
    ]
