# Project provenance

## Original group work

This is a public, sanitized copy of **Multi-Model Data Warehouse for Drug Seizures**, a group project for **IKT453 Intelligent Data Management at the University of Agder in 2025**.

The submitted report identifies these authors:

- Kristian Eieland
- Daniela Viktoria Eberhard
- Lucas Lange

The group name is **SELECT * FROM talent**. The source code is joint coursework.

Source repository: `LucasLange1113/UIA_IDM` (private at the time this copy was prepared).  
Source branch: `main`.  
Source commit: `eff87812a1c3586e51e7d4bf9763b14dc7582b66`.  
Snapshot prepared: 6 October 2026.

The local source checkout was six commits behind remote main; the public edition incorporates all ten files changed in those six commits. The private repository and its history were left unchanged.

## Changes made for this public edition

- Kept the current application, ETL scripts, graph definitions and editable schema diagram.
- Excluded external spreadsheets, database archives/dumps, full report PDFs, an installer, machine-specific setup notes and the unused earlier prototype.
- Replaced embedded connection credentials with environment configuration and a placeholder-only `.env.example`.
- Removed automatic Neo4j password replacement and command logging that could expose credentials.
- Rebuilt the local Compose configuration without missing private dump mounts; databases start empty and exposed ports bind to localhost.
- Aligned the application container and documented runtime to Node.js 22; made the frontend command cross-platform and added a frontend build command.
- Added setup/data documentation and retained prominent group attribution.

A fresh history is used for the public copy because the original history includes credentials/defaults and large data artifacts. The commit identifier above provides traceability without republishing that history.

## Verification scope

Checked on 6 October 2026:

- JavaScript syntax checks passed for all six backend/configuration files.
- Python parsing passed for all eight data scripts.
- Docker Compose configuration validation passed against `.env.example`.
- Configuration checks passed for missing/placeholder values and MongoDB credential encoding.
- The React production build compiled successfully under Node.js 22.23.3.
- The dependency lockfile matches the package manifest and is used by the Docker build.

The Docker stack was not started for this packaging check. The complete original dataset was not imported, and the academic analysis was not reproduced. Source data is deliberately excluded, and the original scripts still assume the coursework data layout.

## License status

No project-wide license file was present in the source repository. This copy does not add an open-source license on behalf of the other authors. Dependency and dataset terms remain separate.
