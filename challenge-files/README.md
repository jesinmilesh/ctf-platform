# Challenge Files Storage (Isolated)

> **CRITICAL SECURITY PROTOCOL (SECTION 29)**
> Never store challenge files inside `/public/` or accessible static asset directories.
> Files in this directory are served strictly through `/api/files/:fileId` which validates:
> 1. Operative session validity.
> 2. Mission publication state (`PUBLISHED` or `LIVE`).
> 3. Administrative clearance check.
