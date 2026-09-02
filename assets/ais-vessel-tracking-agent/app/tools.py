"""
Tools for the AIS Vessel Tracking Agent.
Uses AISStream.io WebSocket API — free tier, registration required.
"""
import asyncio
import json
import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

AISSTREAM_API_KEY = os.environ.get("AISSTREAM_API_KEY", "")
PORT_COORDS_PATH = Path(__file__).parent / "skills/vessel-tracking/references/major-port-coordinates.json"


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in nautical miles between two lat/lon points."""
    R = 3440.065  # Earth radius in nautical miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _load_port_coords() -> dict:
    """Load port coordinates from reference file."""
    try:
        return json.loads(PORT_COORDS_PATH.read_text())
    except Exception as e:
        logger.warning("Could not load port coordinates: %s", e)
        return {}


@tool
def fetch_vessel_position(mmsi: str) -> str:
    """
    Fetch live vessel position from AISStream.io WebSocket API.
    Returns vessel position, speed, heading, and AIS destination.

    Args:
        mmsi: Vessel MMSI number (9-digit string)
    """
    try:
        import websockets

        async def _fetch():
            if not AISSTREAM_API_KEY:
                return {"status": "vessel_not_found", "reason": "AISSTREAM_API_KEY not configured"}

            subscribe_msg = json.dumps({
                "APIKey": AISSTREAM_API_KEY,
                "BoundingBoxes": [[[-90, -180], [90, 180]]],
                "FiltersShipMMSI": [mmsi]
            })

            try:
                async with websockets.connect(
                    "wss://stream.aisstream.io/v0/stream",
                    open_timeout=10
                ) as ws:
                    await ws.send(subscribe_msg)
                    msg = await asyncio.wait_for(ws.recv(), timeout=10)
                    data = json.loads(msg)

                    pos = data.get("Message", {}).get("PositionReport", {})
                    meta = data.get("MetaData", {})

                    return {
                        "mmsi": mmsi,
                        "vessel_name": meta.get("ShipName", "Unknown").strip(),
                        "latitude": pos.get("Latitude", 0.0),
                        "longitude": pos.get("Longitude", 0.0),
                        "sog_knots": pos.get("Sog", 0.0),
                        "cog_degrees": pos.get("Cog", 0.0),
                        "navigational_status": pos.get("NavigationalStatus", -1),
                        "destination_from_ais": meta.get("Destination", "").strip().upper(),
                        "data_timestamp_utc": datetime.now(timezone.utc).isoformat(),
                        "status": "underway" if pos.get("Sog", 0) >= 1 else "moored_or_anchored"
                    }
            except asyncio.TimeoutError:
                return {"status": "vessel_not_found", "mmsi": mmsi, "reason": "AIS stream timeout after 10s"}

        result = asyncio.run(_fetch())
        return json.dumps(result)

    except ImportError:
        logger.warning("websockets package not available — returning mock for testing")
        return json.dumps({
            "status": "vessel_not_found",
            "reason": "websockets package not installed",
            "mmsi": mmsi
        })
    except Exception as e:
        logger.error("fetch_vessel_position error: %s", e)
        return json.dumps({"status": "vessel_not_found", "reason": str(e), "mmsi": mmsi})


@tool
def calculate_remaining_journey(
    current_lat: float,
    current_lon: float,
    destination_port: str,
    sog_knots: float
) -> str:
    """
    Calculate remaining distance and predicted ETA from current vessel position.
    Uses Haversine formula and vessel speed over ground.

    Args:
        current_lat: Current vessel latitude
        current_lon: Current vessel longitude
        destination_port: Destination port name (e.g. 'ROTTERDAM')
        sog_knots: Vessel speed over ground in knots
    """
    ports = _load_port_coords()
    port_key = destination_port.upper().strip()

    if port_key not in ports:
        return json.dumps({
            "error": f"Port '{destination_port}' not found in coordinates reference",
            "available_ports": list(ports.keys())
        })

    port = ports[port_key]
    distance_nm = _haversine_nm(current_lat, current_lon, port["lat"], port["lon"])

    if sog_knots < 0.5:
        estimated_hours = None
        predicted_eta = None
        note = "Vessel is stationary — ETA cannot be computed from speed"
    else:
        estimated_hours = distance_nm / sog_knots
        from datetime import timedelta
        predicted_eta = (datetime.now(timezone.utc) + timedelta(hours=estimated_hours)).isoformat()
        note = f"Distance {distance_nm:.1f} NM at {sog_knots} knots = {estimated_hours:.1f} hours"

    return json.dumps({
        "destination_port": port_key,
        "destination_coords": {"lat": port["lat"], "lon": port["lon"]},
        "distance_nm": round(distance_nm, 1),
        "sog_knots": sog_knots,
        "estimated_hours": round(estimated_hours, 1) if estimated_hours else None,
        "predicted_eta_utc": predicted_eta,
        "note": note
    })


def get_custom_tools() -> list[Any]:
    """Return the list of custom tools for this agent."""
    return [fetch_vessel_position, calculate_remaining_journey]
