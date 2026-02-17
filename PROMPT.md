# Nexusmods Tracker — Dev Notes

## Registering Local Mod Files (Ver.R / CatFood mods)

### Problem
Local mod files are renamed (e.g. `Ver.R Body Inner2 AIO.zip`) and need to be matched to the correct Nexusmods mod_id + file_id.

### Workflow
1. **Match local filename to mod**: The Nexusmods API `name` field (not `file_name`) matches the local filename stem. e.g. local `Ver.R Body Inner2 AIO.zip` → API name `Ver.R Body Inner2 AIO`.
2. **Determine the correct file_id**: The local file may not be the latest version. Check the version inside the zip — typically the top-level folder name contains it (e.g. `Ver.R Body inner2 v1.1/` → version 1.1).
3. **List all file versions**: `GET https://api.nexusmods.com/v1/games/{game}/mods/{mod_id}/files.json` — find the file_id whose `version` matches (note: `v1.1` in zip = `1.10` in API).
4. **Register**: `POST /api/mods/` with `{mod_id, file_id, game, local_file}`. The backend auto-fetches metadata from Nexusmods.
5. **Check for updates**: `GET /api/updates/check/{id}` — detects if a newer file exists.

### Key API Details
- All CatFood mods are under author `CatFood` (username `ranaragua`) for game `monsterhunterwilds`.
- User's tracked mods on Nexusmods: `GET /v1/user/tracked_mods.json` (requires API key).
- File list for a mod: `GET /v1/games/{game}/mods/{mod_id}/files.json` — returns all versions with file_id, version, name, file_name, category_name (MAIN/ARCHIVED/OLD).
