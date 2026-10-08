"""
routers/sla.py — SLA Compliance & Certificate PDF Endpoint.

Ports: GET /api/reports/sla-compliance  (server/index.ts L141)
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Response

from services.sla_report import generate_sla_pdf

logger = logging.getLogger("sla_router")
router = APIRouter(tags=["reports"])


@router.get("/reports/sla-compliance")
async def get_sla_compliance_report():
    try:
        pdf_bytes = await generate_sla_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=SLA_Compliance_Report.pdf",
                "Content-Type": "application/pdf",
            },
        )
    except Exception as exc:
        logger.error(f"[SLA Report] Generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed generating SLA report: {exc}")
