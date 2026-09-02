"""
Historical Nomination Agent — tool declarations.

All OGS/650 data access is handled exclusively via MCP tools loaded at runtime
through get_mcp_tools(). This file declares the agent's custom non-MCP tools only.

MCP tools wired at runtime (via sap-sf-scm-nomination-mcp-server and
sap-s4-oil-transport-system-mcp-server) provide:
  - action_upsertnomination_for_nominationservice_svc  (read historical nominations)
  - list_transportsystem_for_sap_self                  (read transport system data)
  - list_locationassignment_for_sap_self               (read route location assignments)
  - list_plannedmaterials_for_sap_self                 (read planned materials per route)

The agent system prompt instructs the LLM to call these MCP tools directly with
appropriate OData $filter parameters to retrieve live data from OGS/650.
No placeholder or stub implementations are included here.
"""
from typing import Any


def get_custom_tools() -> list[Any]:
    """
    Return custom (non-MCP) tools for this agent.

    All OGS/650 data access uses MCP tools loaded via get_mcp_tools().
    No additional custom tools are required for this agent.
    """
    return []
