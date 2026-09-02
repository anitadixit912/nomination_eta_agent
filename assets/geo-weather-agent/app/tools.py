"""
Tools for the Geopolitical & Weather Forecast Agent.
Uses: Open-Meteo (free, no key), ACLED (free, API key), PortWatch IMF (free, no key).
"""
import json
import logging
import os
from typing import Any

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

ACLED_API_KEY = os.environ.get("ACLED_API_KEY", "")
ACLED_EMAIL = os.environ.get("ACLED_EMAIL", "")


@tool
def fetch_route_weather(
    origin_lat: float,
    origin_lon: float,
    destination_lat: float,
    destination_lon: float
) -> str:
    """
    Fetch marine weather forecast along a route using Open-Meteo (free, no API key needed).
    Returns wave height, wind speed, and wind direction for origin, midpoint, and destination.

    Args:
        origin_lat: Origin latitude
        origin_lon: Origin longitude
        destination_lat: Destination latitude
        destination_lon: Destination longitude
    """
    mid_lat = (origin_lat + destination_lat) / 2
    mid_lon = (origin_lon + destination_lon) / 2

    waypoints = [
        {"label": "origin", "lat": origin_lat, "lon": origin_lon},
        {"label": "midpoint", "lat": mid_lat, "lon": mid_lon},
        {"label": "destination", "lat": destination_lat, "lon": destination_lon},
    ]

    results = []
    max_wave = 0.0
    max_wind = 0.0

    for wp in waypoints:
        try:
            response = httpx.get(
                "https://marine-api.open-meteo.com/v1/marine",
                params={
                    "latitude": wp["lat"],
                    "longitude": wp["lon"],
                    "hourly": "wave_height,wind_speed_10m",
                    "forecast_days": 7
                },
                timeout=15
            )
            response.raise_for_status()
            data = response.json()
            hourly = data.get("hourly", {})
            waves = hourly.get("wave_height", [0])
            winds = hourly.get("wind_speed_10m", [0])
            wp_max_wave = max(w for w in waves if w is not None)
            wp_max_wind = max(w for w in winds if w is not None)
            max_wave = max(max_wave, wp_max_wave)
            max_wind = max(max_wind, wp_max_wind)
            results.append({
                "label": wp["label"],
                "max_wave_height_m": round(wp_max_wave, 1),
                "max_wind_speed_kmh": round(wp_max_wind, 1)
            })
        except Exception as e:
            logger.warning("Open-Meteo fetch failed for %s: %s", wp["label"], e)
            results.append({"label": wp["label"], "error": str(e)})

    # Determine risk level
    if max_wave > 5 or max_wind > 74:
        weather_risk = "Critical"
        delay_days = 3.0
    elif max_wave > 3 or max_wind > 55:
        weather_risk = "High"
        delay_days = 1.5
    elif max_wave > 2 or max_wind > 37:
        weather_risk = "Medium"
        delay_days = 0.5
    else:
        weather_risk = "Low"
        delay_days = 0.0

    return json.dumps({
        "waypoints": results,
        "max_wave_height_m": round(max_wave, 1),
        "max_wind_speed_kmh": round(max_wind, 1),
        "weather_risk": weather_risk,
        "weather_delay_days": delay_days
    })


@tool
def fetch_geopolitical_risk(
    origin: str,
    destination: str,
    origin_lat: float,
    origin_lon: float,
    destination_lat: float,
    destination_lon: float
) -> str:
    """
    Fetch geopolitical risk data from ACLED for events near the shipping route.
    Returns conflict event count, risk level, and chokepoints affected.

    Args:
        origin: Origin port name
        destination: Destination port name
        origin_lat: Origin latitude
        origin_lon: Origin longitude
        destination_lat: Destination latitude
        destination_lon: Destination longitude
    """
    if not ACLED_API_KEY or not ACLED_EMAIL:
        return json.dumps({
            "geo_risk": "Low",
            "geo_delay_days": 0,
            "acled_events_count": 0,
            "status": "unavailable",
            "reason": "ACLED_API_KEY or ACLED_EMAIL not configured"
        })

    try:
        mid_lat = (origin_lat + destination_lat) / 2
        mid_lon = (origin_lon + destination_lon) / 2

        # Query ACLED for events near route midpoint (200 NM ≈ 3.7 degrees)
        from datetime import datetime, timedelta
        date_from = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.utcnow().strftime("%Y-%m-%d")

        response = httpx.get(
            "https://api.acleddata.com/acled/read",
            params={
                "key": ACLED_API_KEY,
                "email": ACLED_EMAIL,
                "latitude": mid_lat,
                "longitude": mid_lon,
                "event_date": f"{date_from}|{date_to}",
                "event_date_where": "BETWEEN",
                "limit": 50
            },
            timeout=20
        )
        response.raise_for_status()
        data = response.json()
        events = data.get("data", [])
        count = len(events)
        latest = events[0].get("notes", "")[:200] if events else "No recent events"

        if count > 10:
            geo_risk, delay = "Critical", 3.0
        elif count > 3:
            geo_risk, delay = "High", 1.5
        elif count > 0:
            geo_risk, delay = "Medium", 0.5
        else:
            geo_risk, delay = "Low", 0.0

        return json.dumps({
            "acled_events_count": count,
            "latest_event": latest,
            "geo_risk": geo_risk,
            "geo_delay_days": delay,
            "chokepoints_affected": [],
            "status": "ok"
        })

    except Exception as e:
        logger.warning("ACLED fetch failed: %s", e)
        return json.dumps({
            "geo_risk": "Low",
            "geo_delay_days": 0,
            "acled_events_count": 0,
            "status": "unavailable",
            "reason": str(e)
        })


@tool
def fetch_port_disruption(origin_port: str, destination_port: str) -> str:
    """
    Fetch port traffic disruption data from PortWatch IMF (free, no key required).
    Returns disruption index for origin and destination ports.

    Args:
        origin_port: Origin port name or LOCODE
        destination_port: Destination port name or LOCODE
    """
    try:
        response = httpx.get(
            "https://portwatch.imf.org/api/v1/port-traffic",
            params={"ports": f"{origin_port},{destination_port}"},
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            origin_idx = data.get(origin_port, {}).get("disruption_index", 0)
            dest_idx = data.get(destination_port, {}).get("disruption_index", 0)
        else:
            origin_idx, dest_idx = 0, 0
    except Exception as e:
        logger.warning("PortWatch fetch failed: %s — continuing without port disruption data", e)
        return json.dumps({
            "status": "unavailable",
            "origin_disruption_index": 0,
            "destination_disruption_index": 0,
            "port_delay_days": 0,
            "reason": str(e)
        })

    max_idx = max(origin_idx, dest_idx)
    if max_idx > 80:
        port_delay = 2.0
    elif max_idx > 50:
        port_delay = 1.0
    elif max_idx > 20:
        port_delay = 0.5
    else:
        port_delay = 0.0

    return json.dumps({
        "status": "ok",
        "origin_disruption_index": origin_idx,
        "destination_disruption_index": dest_idx,
        "port_delay_days": port_delay
    })


def get_custom_tools() -> list[Any]:
    """Return the list of custom tools for this agent."""
    return [fetch_route_weather, fetch_geopolitical_risk, fetch_port_disruption]
