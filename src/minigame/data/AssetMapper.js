// src/minigame/data/AssetMapper.js
/**
 * 거대한 Switch-Case (DRY 위반)를 없애기 위한 스킨별 에셋 O(1) 매핑 딕셔너리
 */
export const ASSET_MAP = {
    'default': { bgHex: '#FFF4F4', icon: '❓', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] },
    'skin_lavender': { bgHex: '#EAE6FF', icon: '🔮', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] },
    'skin_dark': { bgHex: '#2C3E50', icon: '🧪', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] },
    'skin_space': { bgHex: '#1A1A2E', icon: '🌌', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] },
    'skin_fairy': { bgHex: '#E3FDFD', icon: '🧚', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] },
    'skin_royal': { bgHex: '#FFF2E6', icon: '👑', buttonColors: ['btn-candy-1', 'btn-candy-2', 'btn-candy-3'] }
};

export function getSkinAssets(skinId) {
    return ASSET_MAP[skinId] || ASSET_MAP['default'];
}
