/**
 * editor-logic.js
 * エディタ画面の操作、プレビュー、画像処理、エンコード
 */

let isPlaying = false;
let previewTimer = null;
let currentIdx = 0;
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas ? mainCanvas.getContext('2d') : null;

/**
 * エディタを開く
 */
function openEditor(id) {
    currentId = id; 
    currentType = (id === 'main' || id === 'tab') ? id : 'stamp';
    
    if (!mainCanvas) return;

    mainCanvas.width = CONFIG[currentType].w; 
    mainCanvas.height = CONFIG[currentType].h;
    
    // 表示倍率の調整
    const displayScale = currentType === 'tab' ? 1.5 : (project.profile === 'emoji' ? 1.2 : 0.8);
    mainCanvas.style.width = (CONFIG[currentType].w * displayScale) + 'px';
    mainCanvas.style.height = (CONFIG[currentType].h * displayScale) + 'px';
    
    // UIの表示切り替え
    document.getElementById('anim-controls').style.display = (currentType === 'tab') ? 'none' : 'block';
    document.getElementById('tab-controls').style.display = (currentType === 'tab') ? 'block' : 'none';
    document.getElementById('frame-info-bar').style.display = (currentType === 'tab') ? 'none' : 'block';
    document.getElementById('delay-100').style.display = (currentType === 'tab') ? 'none' : 'block';
    document.getElementById('delay-200').style.display = (currentType === 'tab') ? 'none' : 'block';
    
    document.getElementById('project-screen').classList.remove('active');
    document.getElementById('editor-screen').classList.add('active');
    
    updateDelayUI(); 
    renderEditorLists(); 
    updateStaticPreview(0);
}

/**
 * フレームリスト（右側/下側のリスト）の描画
 */
function renderEditorLists() {
    const list = document.getElementById('frames-list'); 
    if (!list || currentType === 'tab') {
        if (list) list.innerHTML = '';
        return;
    }
    
    list.innerHTML = '';
    const sData = project.stamps[currentId];

    sData.buffers.forEach((buf, i) => {
        const thumbSrc = buf ? arrayBufferToDataURL(buf, currentType) : '';
        const dbg = sData.debugBgs[i] || 'debug-none';
        const isSelected = (currentIdx === i);
        const isEnabled = sData.enabled[i];
        
        const div = document.createElement('div'); 
        div.className = `frame-item ${isSelected ? 'selected' : ''} ${isEnabled ? '' : 'disabled'}`;
        div.id = `f-item-${i}`;
        div.onclick = () => { if(!isPlaying) updateStaticPreview(i); };

        div.innerHTML = `
            <input type="checkbox" class="frame-check" ${isEnabled ? 'checked' : ''} onclick="event.stopPropagation(); toggleFrameEnabled(${i}, this.checked)">
            <div style="font-size:14px; width:20px; font-weight:bold; color:var(--primary)">${i+1}</div>
            <div class="list-thumb transparent-bg ${dbg}" onclick="event.stopPropagation(); document.getElementById('file-${i}').click()">
                ${thumbSrc ? `<img src="${thumbSrc}">` : '<span style="font-size:8px;">TAP</span>'}
                <input type="file" id="file-${i}" accept="image/*" onchange="loadSingle(${i}, this)" style="display:none">
            </div>
            <div class="debug-controls" onclick="event.stopPropagation()">
                <button class="btn-debug btn-gray ${dbg==='debug-none'?'btn-active':''}" onclick="setDebugBg(${i}, 'debug-none')">標</button>
                <button class="btn-debug btn-red ${dbg==='debug-red'?'btn-active':''}" onclick="setDebugBg(${i}, 'debug-red')">赤</button>
                <button class="btn-debug btn-orange ${dbg==='debug-yellow'?'btn-active':''}" onclick="setDebugBg(${i}, 'debug-yellow')">黄</button>
            </div>
            <div style="margin-left:auto; display:flex; flex-direction:column; gap:2px;" onclick="event.stopPropagation()">
                <button class="btn-gray" onclick="moveFrame(${i}, -1)">▲</button>
                <button class="btn-gray" onclick="moveFrame(${i}, 1)">▼</button>
            </div>
            <button class="btn-red" style="padding:15px 10px; font-size:16px;" onclick="event.stopPropagation(); deleteFrame(${i})">×</button>`;
        list.appendChild(div);
    });
}

/**
 * 静止画プレビュー更新
 */
function updateStaticPreview(idx) {
    if (!mainCtx) return;
    currentIdx = idx; 
    const sData = project.stamps[currentId];
    let target = idx;
    
    if (currentType !== 'tab' && (!sData.buffers[target] || !sData.enabled[target])) {
         target = sData.buffers.findIndex((b, i) => b !== null && sData.enabled[i]);
    }
    if (currentType === 'tab') target = 0;
    
    const previewArea = document.getElementById('preview-area');
    const dbgClass = (target !== -1) ? (sData.debugBgs[target] || 'debug-none') : 'debug-none';
    if (previewArea) previewArea.className = 'transparent-bg ' + dbgClass;

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    if (target !== -1 && sData.buffers[target]) {
        mainCtx.putImageData(new ImageData(new Uint8ClampedArray(sData.buffers[target]), mainCanvas.width, mainCanvas.height), 0, 0);
        const infoBar = document.getElementById('frame-info-bar');
        if(infoBar && currentType !== 'tab') infoBar.innerText = `FRAME: ${target + 1}`;
    }

    document.querySelectorAll('.frame-item').forEach(el => el.classList.remove('selected'));
    const activeItem = document.getElementById(`f-item-${target}`);
    if(activeItem) activeItem.classList.add('selected');
}

/**
 * プレビュー再生・停止
 */
function togglePreview() {
    if (currentType === 'tab') return;
    isPlaying = !isPlaying;
    if (isPlaying) {
        const active = project.stamps[currentId].buffers
            .map((b, i) => (b !== null && project.stamps[currentId].enabled[i]) ? i : null)
            .filter(v => v !== null);
        
        if(active.length === 0) { isPlaying = false; return; }
        let c = active.indexOf(currentIdx); if(c === -1) c = 0;

        previewTimer = setInterval(() => { 
            currentIdx = active[c % active.length];
            updateStaticPreview(currentIdx); 
            c++; 
        }, project.stamps[currentId].delay);
    } else { 
        stopPreview(); 
    }
}

function stopPreview() {
    clearInterval(previewTimer);
    isPlaying = false;
}

/**
 * 遅延時間（ディレイ）のUI更新
 */
function updateDelayUI() {
    const d = project.stamps[currentId].delay;
    const btn100 = document.getElementById('delay-100');
    const btn200 = document.getElementById('delay-200');
    if (btn100) btn100.className = d === 100 ? 'btn-blue' : 'btn-gray';
    if (btn200) btn200.className = d === 200 ? 'btn-blue' : 'btn-gray';
}

function setDelay(ms) {
    project.stamps[currentId].delay = ms;
    updateDelayUI();
    if (isPlaying) { stopPreview(); togglePreview(); }
}

/**
 * 有効・無効切り替え
 */
function toggleFrameEnabled(i, checked) {
    project.stamps[currentId].enabled[i] = checked;
    renderEditorLists();
}

/**
 * 画像処理・変換ユーティリティ
 */
async function processImage(blobOrFile, type) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                cvs.width = CONFIG[type].w; cvs.height = CONFIG[type].h;
                const ctx = cvs.getContext('2d');
                const s = Math.min(cvs.width/img.width, cvs.height/img.height);
                ctx.drawImage(img, (cvs.width-img.width*s)/2, (cvs.height-img.height*s)/2, img.width*s, img.height*s);
                resolve(ctx.getImageData(0,0,cvs.width,cvs.height).data.buffer);
            };
            img.src = e.target.result;
        };
        if (blobOrFile instanceof Blob) reader.readAsDataURL(blobOrFile);
    });
}

function arrayBufferToDataURL(buf, type) {
    const cvs = document.createElement('canvas');
    cvs.width = CONFIG[type].w; cvs.height = CONFIG[type].h;
    cvs.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf), cvs.width, cvs.height), 0,0);
    return cvs.toDataURL();
}

async function resizeRgbaBuffer(rgba, sw, sh, dw, dh) {
    return new Promise(resolve => {
        const c1 = document.createElement('canvas'); c1.width = sw; c1.height = sh;
        c1.getContext('2d').putImageData(new ImageData(rgba, sw, sh), 0, 0);
        const c2 = document.createElement('canvas'); c2.width = dw; c2.height = dh;
        const ctx = c2.getContext('2d');
        const s = Math.min(dw/sw, dh/sh);
        ctx.drawImage(c1, (dw-sw*s)/2, (dh-sh*s)/2, sw*s, sh*s);
        resolve(ctx.getImageData(0,0,dw,dh).data.buffer);
    });
}

/**
 * APNGエンコード (UPNG.js使用)
 */
function encodeApng(bufs, w, h, d) {
    const apng = UPNG.encode(bufs, w, h, 256, new Array(bufs.length).fill(d));
    const v = new DataView(apng);
    let o = 8;
    while(o < apng.byteLength) {
        const l = v.getUint32(o), t = v.getUint32(o+4);
        if(t===0x6163544C) { v.setUint32(o+12, 1); break; } // ループ回数1回に固定
        o += 12 + l;
    }
    return apng;
}

/**
 * APNG読込・デコード
 */
async function smartDecode(buffer, id, type) {
    if (id === 'tab') return { frames: [await processImage(new Blob([buffer]), type)], delay: 100 };
    try {
        const img = UPNG.decode(buffer);
        const rgbaFrames = UPNG.toRGBA8(img);
        const processed = [];
        for (let i = 0; i < rgbaFrames.length; i++) {
            processed.push(await resizeRgbaBuffer(new Uint8ClampedArray(rgbaFrames[i]), img.width, img.height, CONFIG[type].w, CONFIG[type].h));
        }
        return { frames: processed, delay: (img.frames && img.frames.length > 0) ? (img.frames[0].delay || 100) : 100 };
    } catch (e) {
        return { frames: [await processImage(new Blob([buffer]), type)], delay: 100 };
    }
}

// その他のボタン操作関数
async function loadSingle(i, input) { if (!input.files[0]) return; project.stamps[currentId].buffers[i] = await processImage(input.files[0], currentType); renderEditorLists(); updateStaticPreview(i); }
async function handleBulkUpload(input) { toggleLoading(true, "アップロード中..."); const files = Array.from(input.files).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})); for (let i=0; i<project.stamps[currentId].buffers.length && i<files.length; i++) project.stamps[currentId].buffers[i] = await processImage(files[i], currentType); renderEditorLists(); updateStaticPreview(0); toggleLoading(false); }
async function handleApngImport(input) { const file = input.files[0]; if (!file) return; toggleLoading(true, "解析中..."); const reader = new FileReader(); reader.onload = async (e) => { try { const res = await smartDecode(e.target.result, currentId, currentType); project.stamps[currentId].buffers.fill(null); project.stamps[currentId].enabled.fill(true); project.stamps[currentId].delay = res.delay; res.frames.forEach((f, i) => { if(i < project.stamps[currentId].buffers.length) project.stamps[currentId].buffers[i] = f; }); renderEditorLists(); updateStaticPreview(0); updateDelayUI(); } catch (err) { alert(err.message); } toggleLoading(false); }; reader.readAsArrayBuffer(file); }
function setDebugBg(i, c) { project.stamps[currentId].debugBgs[i] = c; renderEditorLists(); updateStaticPreview(i); }
function moveFrame(i, d) { const b = project.stamps[currentId].buffers, db = project.stamps[currentId].debugBgs, eb = project.stamps[currentId].enabled, t = i+d; if(t<0 || t>=b.length) return; [b[i],b[t]] = [b[t],b[i]]; [db[i],db[t]] = [db[t],db[i]]; [eb[i],eb[t]] = [eb[t],eb[i]]; renderEditorLists(); updateStaticPreview(t); }
function deleteFrame(i) { project.stamps[currentId].buffers[i] = null; renderEditorLists(); updateStaticPreview(null); }
function smartFill() { const b = project.stamps[currentId].buffers, p = b.filter(x=>x!==null); if(p.length<1) return; for(let i=0; i<b.length; i++) if(!b[i]) b[i] = p[i % p.length]; renderEditorLists(); }
async function exportSingleAPNG() { const sData = project.stamps[currentId]; const active = sData.buffers.filter((b, i) => b !== null && sData.enabled[i]); if(active.length===0) return; const out = (currentId === 'tab') ? UPNG.encode([active[0]], CONFIG[currentType].w, CONFIG[currentType].h, 0) : encodeApng(active, CONFIG[currentType].w, CONFIG[currentType].h, sData.delay); saveBlob(new Blob([out], {type:'image/png'}), `${currentId}.png`); }