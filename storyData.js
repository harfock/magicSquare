// 👑 所有圖片格式已統一為 .png


export const SHAPE_TEMPLATES = {
    circle: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="#FCD34D"/></svg>`,
    square: `<svg viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="14" fill="#FCD34D"/></svg>`,
    triangle: `<svg viewBox="0 0 100 100"><polygon points="50,12 92,85 8,85" fill="#FCD34D"/></svg>`,
    star: `<svg viewBox="0 0 100 100"><polygon points="50,7 64,36 96,36 70,57 81,89 50,70 19,89 30,57 4,36 36,36" fill="#FCD34D"/></svg>`
};

export const COLOR_PALETTE = [
    "#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6", "#FF2D55",
    "#9C27B0", "#009688", "#E91E63", "#4CAF50", "#FF5722", "#607D8B", "#00FFFF", "#FFFF00"
];

export const SHAPE_TYPES = ['circle', 'square', 'triangle', 'star'];
