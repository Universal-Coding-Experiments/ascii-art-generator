const textInput = document.getElementById('textInput');
const asciiEl = document.getElementById('ascii');
const presetEl = document.getElementById('preset');
const fontSizeEl = document.getElementById('fontSize');
const densityEl = document.getElementById('density');
const randomnessEl = document.getElementById('randomness');
const gradientRandomEl = document.getElementById('gradientRandom');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');
const exportPngBtn = document.getElementById('exportPng');
const imageUpload = document.getElementById('imageUpload');
const asciiBox = document.getElementById('asciiBox');
const canvas = document.getElementById('sampleCanvas');
const ctx = canvas.getContext('2d');

const presets = {
    classic: { chars: "@%#*+=-:. " },
    retro: { chars: "█▓▒░ " },
    neon: { chars: "@#S%?*+;:,. " },
    glitch: { chars: "@#&$%*o!;:,. " }
};

function seededRandom(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) { return { r: Math.round(lerp(c1.r, c2.r, t)), g: Math.round(lerp(c1.g, c2.g, t)), b: Math.round(lerp(c1.b, c2.b, t)) }; }
function rgbToCss(c) { return `rgb(${c.r},${c.g},${c.b})`; }
function randomColor(rand) { return { r: Math.floor(rand() * 256), g: Math.floor(rand() * 256), b: Math.floor(rand() * 256) }; }
function mapBrightnessToChar(bright, chars) { const idx = Math.floor(bright * (chars.length - 1)); return chars[Math.max(0, Math.min(chars.length - 1, idx))]; }

function buildGradientColors(cols, seedValue) {
    const rand = seededRandom(seedValue);
    const stops = 2 + Math.floor(rand() * 3);
    const stopColors = [];
    for (let i = 0; i < stops; i++) stopColors.push(randomColor(rand));
    const colors = new Array(cols);
    for (let c = 0; c < cols; c++) {
        const t = c / Math.max(1, cols - 1);
        const pos = t * (stops - 1);
        const i0 = Math.floor(pos);
        const localT = pos - i0;
        const cA = stopColors[i0];
        const cB = stopColors[Math.min(stops - 1, i0 + 1)];
        colors[c] = rgbToCss(lerpColor(cA, cB, localT));
    }
    return colors;
}

function generateASCII({ image = null, text = '', preset = 'classic', fontSize = 12, density = 8, randomness = 0.25, gradientSeed = 12345 } = {}) {
    const padding = 8;
    if (image) {
        const maxW = 600;
        const scale = Math.min(1, maxW / image.width);
        canvas.width = Math.max(100, Math.floor(image.width * scale));
        canvas.height = Math.max(100, Math.floor(image.height * scale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else {
        const scaleFactor = 4;
        ctx.font = `${Math.round(fontSize * scaleFactor)}px monospace`;
        const metrics = ctx.measureText(text || ' ');
        const w = Math.max(200, Math.ceil(metrics.width) + padding * 2);
        const h = Math.max(80, Math.ceil(fontSize * scaleFactor * 1.6) + padding * 2);
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(fontSize * scaleFactor)}px monospace`;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    const cell = Math.max(2, Math.round(density));
    const cols = Math.floor(canvas.width / cell);
    const rows = Math.floor(canvas.height / cell);
    const charset = presets[preset]?.chars || presets.classic.chars;
    const rand = seededRandom(gradientSeed);
    const gradientColors = buildGradientColors(cols, Math.floor(rand() * 1e9));
    let outHtml = '';
    for (let r = 0; r < rows; r++) {
        let lineHtml = '';
        for (let c = 0; c < cols; c++) {
            const jitterX = (rand() - 0.5) * cell * randomness;
            const jitterY = (rand() - 0.5) * cell * randomness;
            const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(c * cell + cell / 2 + jitterX)));
            const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(r * cell + cell / 2 + jitterY)));
            const px = ctx.getImageData(x, y, 1, 1).data;
            const bright = (px[0] + px[1] + px[2]) / (255 * 3);
            let ch;
            if (rand() < randomness * 0.06) ch = charset[Math.floor(rand() * charset.length)];
            else ch = mapBrightnessToChar(1 - bright, charset);
            const color = gradientColors[c] || '#fff';
            lineHtml += `<span style="color:${color}">${ch}</span>`;
        }
        outHtml += lineHtml + '\n';
    }
    return outHtml.trimEnd();
}

let uploadedImage = null;
let gradientSeed = Date.now() % 1e9;

function regenGradientSeed() {
    const slider = document.getElementById('gradientRandom');
    gradientSeed = Math.floor(Date.now() * (1 + (slider ? Number(slider.value) : 50) / 100));
}

function renderImmediate() {
    const preset = presetEl.value;
    const fontSize = Number(fontSizeEl.value);
    const density = Number(densityEl.value);
    const randomness = Number(randomnessEl.value);
    const seed = Math.floor(Math.random() * 1e9);
    let resultHtml;
    if (uploadedImage) {
        resultHtml = generateASCII({ image: uploadedImage, preset, density, randomness, gradientSeed: seed });
        textInput.value = '';
    } else {
        const text = (textInput.value || '').trim() || 'ASCII';
        resultHtml = generateASCII({ text, preset, fontSize, density, randomness, gradientSeed });
    }
    asciiEl.innerHTML = resultHtml;
    asciiEl.style.fontSize = Math.max(10, Math.round(Number(fontSizeEl.value))) + 'px';
    asciiBox.style.maxHeight = '68vh';
}

function debounce(fn, wait = 120) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

const renderDebounced = debounce(renderImmediate, 80);

imageUpload.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const tmp = document.createElement('canvas');
        tmp.width = Math.max(50, Math.floor(img.width * scale));
        tmp.height = Math.max(50, Math.floor(img.height * scale));
        const tctx = tmp.getContext('2d');
        tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
        const dataUrl = tmp.toDataURL();
        const loaded = new Image();
        loaded.onload = () => {
            uploadedImage = loaded;
            textInput.value = '';
            regenGradientSeed();
            renderImmediate();
            URL.revokeObjectURL(url);
        };
        loaded.src = dataUrl;
    };
    img.onerror = () => { uploadedImage = null; URL.revokeObjectURL(url); alert('Failed to load image'); };
    img.src = url;
});

textInput.addEventListener('input', () => {
    if (textInput.value.trim().length > 0 && uploadedImage) {
        uploadedImage = null;
        imageUpload.value = '';
    }
    renderDebounced();
});

presetEl.addEventListener('change', () => renderImmediate());
fontSizeEl.addEventListener('input', () => renderImmediate());
densityEl.addEventListener('input', () => renderImmediate());
randomnessEl.addEventListener('input', () => renderImmediate());

const gradientSlider = document.getElementById('gradientRandom');
if (gradientSlider) gradientSlider.addEventListener('input', () => { regenGradientSeed(); renderImmediate(); });

copyBtn.addEventListener('click', async () => {
    const text = asciiEl.textContent || '';
    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied';
        setTimeout(() => copyBtn.textContent = 'Copy', 1200);
    } catch {
        const range = document.createRange();
        range.selectNodeContents(asciiEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const ok = document.execCommand && document.execCommand('copy');
        sel.removeAllRanges();
        copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
        setTimeout(() => copyBtn.textContent = 'Copy', 1200);
    }
});

downloadBtn.addEventListener('click', () => {
    const blob = new Blob([asciiEl.textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ascii-art.txt';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

exportPngBtn.addEventListener('click', () => {
    const linesHtml = asciiEl.innerHTML.split('\n');
    const textLines = asciiEl.textContent.split('\n');
    const fontSize = Math.max(10, Math.round(Number(fontSizeEl.value)));
    const lineHeight = Math.round(fontSize * 1.05);
    const padding = 12;
    const longest = Math.max(...textLines.map(l => l.length));
    const width = Math.max(200, Math.ceil(longest * (fontSize * 0.6)) + padding * 2);
    const height = Math.max(100, textLines.length * lineHeight + padding * 2);

    const devicePR = window.devicePixelRatio || 1;
    const scale = Math.min(4, Math.max(2, devicePR));
    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.round(width * scale);
    outCanvas.height = Math.round(height * scale);
    const octx = outCanvas.getContext('2d');
    octx.scale(scale, scale);

    octx.fillStyle = '#071022';
    octx.fillRect(0, 0, width, height);
    octx.font = `${fontSize}px monospace`;
    octx.textBaseline = 'top';

    for (let r = 0; r < linesHtml.length; r++) {
        const lineHtml = linesHtml[r];
        const temp = document.createElement('div');
        temp.innerHTML = lineHtml;
        const nodes = Array.from(temp.childNodes);
        let x = padding;
        if (nodes.length === 0) {
            octx.fillStyle = '#fff';
            octx.fillText(textLines[r] || '', padding, padding + r * lineHeight);
            continue;
        }
        for (let node of nodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent || '';
                if (txt.length) {
                    octx.fillStyle = '#fff';
                    octx.fillText(txt, x, padding + r * lineHeight);
                    x += txt.length * (fontSize * 0.6);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const ch = node.textContent || ' ';
                const color = (node.style && node.style.color) ? node.style.color : '#fff';
                octx.fillStyle = color;
                octx.fillText(ch, x, padding + r * lineHeight);
                x += fontSize * 0.6;
            }
        }
    }

    outCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'ascii-art.png';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }, 'image/png');
});

textInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

regenGradientSeed();
renderImmediate();