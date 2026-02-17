"""
Nexusmods API client using pynxm
"""
import os
from typing import List, Dict, Optional
from dotenv import load_dotenv
import pynxm

load_dotenv()

class NexusmodsClient:
    def __init__(self):
        api_key = os.getenv("NEXUSMODS_API_KEY")
        if not api_key:
            raise ValueError("NEXUSMODS_API_KEY not found in environment")
        self.client = pynxm.Nexus(api_key)

    def get_mod_details(self, game: str, mod_id: int) -> Dict:
        """Get mod details from Nexusmods"""
        return self.client.mod_details(game, mod_id)

    def get_mod_files(self, game: str, mod_id: int) -> List[Dict]:
        """Get all files for a mod"""
        response = self.client.mod_file_list(game, mod_id)
        return response.get('files', [])

    def get_file_details(self, game: str, mod_id: int, file_id: int) -> Dict:
        """Get specific file details"""
        return self.client.mod_file_details(game, mod_id, file_id)

    def get_tracked_mods(self) -> List[Dict]:
        """Get user's tracked mods from Nexusmods"""
        return self.client.user_tracked_list()

    def track_mod(self, game: str, mod_id: int):
        """Track a mod on Nexusmods"""
        self.client.user_tracked_add(game, str(mod_id))

    def untrack_mod(self, game: str, mod_id: int):
        """Untrack a mod on Nexusmods"""
        self.client.user_tracked_delete(game, str(mod_id))

    def get_updated_mods(self, game: str, period: str) -> List[Dict]:
        """Get mods updated in a given period. Period: '1d', '1w', or '1m'."""
        return self.client.game_updated_list(game, period)

    def get_download_link(self, game: str, mod_id: int, file_id: int) -> str:
        """Generate download link (requires premium for direct download)"""
        # For non-premium users, return the web page URL
        return f"https://www.nexusmods.com/{game}/mods/{mod_id}?tab=files&file_id={file_id}"

# Singleton instance
_client = None

def get_nexusmods_client() -> NexusmodsClient:
    """Get or create Nexusmods client instance"""
    global _client
    if _client is None:
        _client = NexusmodsClient()
    return _client
