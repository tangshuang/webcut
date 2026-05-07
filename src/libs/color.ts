let colorParserCtx: CanvasRenderingContext2D | null = null;

function clampOpacity(opacity: number) {
    if (Number.isNaN(opacity)) {
        return 1;
    }
    return Math.min(1, Math.max(0, opacity));
}

function round(value: number, fixed = 4) {
    return Number(value.toFixed(fixed));
}

function getColorParserContext() {
    if (typeof document === 'undefined') {
        return null;
    }
    if (colorParserCtx) {
        return colorParserCtx;
    }
    const canvas = document.createElement('canvas');
    colorParserCtx = canvas.getContext('2d');
    return colorParserCtx;
}

function parseHexColor(value: string) {
    const hex = value.replace('#', '').trim();
    if (![3, 4, 6, 8].includes(hex.length)) {
        return null;
    }

    let expanded = hex;
    if (hex.length === 3 || hex.length === 4) {
        expanded = hex.split('').map(item => item + item).join('');
    }

    const hasAlpha = expanded.length === 8;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    const a = hasAlpha ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;

    if ([r, g, b, a].some(item => Number.isNaN(item))) {
        return null;
    }
    return { r, g, b, a };
}

function parseRgbColor(value: string) {
    const matched = value.match(/rgba?\(([^)]+)\)/i);
    if (!matched) {
        return null;
    }

    const values = matched[1]
        .replace(/\//g, ',')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    if (values.length < 3) {
        return null;
    }

    const r = Number(values[0]);
    const g = Number(values[1]);
    const b = Number(values[2]);
    const a = values[3] !== undefined ? Number(values[3]) : 1;

    if ([r, g, b, a].some(item => Number.isNaN(item))) {
        return null;
    }
    return { r, g, b, a };
}

function parseCssColorToRgba(color: string) {
    const input = String(color || '').trim();
    if (!input) {
        return null;
    }

    if (input.startsWith('#')) {
        return parseHexColor(input);
    }

    if (/^rgba?\(/i.test(input)) {
        return parseRgbColor(input);
    }

    const ctx = getColorParserContext();
    if (!ctx) {
        return null;
    }

    const marker1 = '#010203';
    const marker2 = '#030201';

    ctx.fillStyle = marker1;
    ctx.fillStyle = input;
    const after1 = String(ctx.fillStyle).toLowerCase();

    ctx.fillStyle = marker2;
    ctx.fillStyle = input;
    const after2 = String(ctx.fillStyle).toLowerCase();

    const normalizedMarker1 = String(marker1).toLowerCase();
    const normalizedMarker2 = String(marker2).toLowerCase();
    if (after1 === normalizedMarker1 && after2 === normalizedMarker2) {
        return null;
    }

    if (after2.startsWith('#')) {
        return parseHexColor(after2);
    }
    if (after2.startsWith('rgb')) {
        return parseRgbColor(after2);
    }

    return null;
}

/**
 * 为任意 CSS 色值附加透明度
 * - 优先输出 `rgba(...)`（可解析时）
 * - 无法可靠解析时回退到 `color-mix(...)`（适配 `var(...)` 等场景）
 */
export function withColorOpacity(color: string, opacity = 1) {
    const input = String(color || '').trim();
    if (!input) {
        return input;
    }

    const alpha = clampOpacity(opacity);
    if (alpha >= 1) {
        return input;
    }
    if (alpha <= 0) {
        return 'transparent';
    }

    const rgba = parseCssColorToRgba(input);
    if (rgba) {
        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${round(rgba.a * alpha)})`;
    }

    // var()/currentColor/oklch 等复杂表达式回退
    return `color-mix(in srgb, ${input} ${Math.round(alpha * 100)}%, transparent)`;
}
