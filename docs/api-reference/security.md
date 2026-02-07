# Security APIs

The Security APIs provide endpoints for running security scans and generating a Software Bill of Materials (SBOM).

---

## POST `/api/security/scan`

Run security scan on workspace.

**Request:**
```bash
curl -X POST http://localhost:3000/api/security/scan \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "./my-project",
    "scanTypes": ["secrets", "vulnerabilities", "dependencies"],
    "severity": "medium"
  }'
```

**Response (200):**
```json
{
  "scanId": "scan-abc123",
  "findings": [
    {
      "type": "secret",
      "severity": "high",
      "file": "config.js",
      "line": 45,
      "message": "Hardcoded API key detected"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 3,
    "low": 5
  }
}
```

---

## POST `/api/security/sbom`

Generate Software Bill of Materials.

**Response (200):**
```json
{
  "sbom": {
    "format": "SPDX",
    "packages": [
      { "name": "express", "version": "5.0.0", "license": "MIT" }
    ]
  }
}
```
