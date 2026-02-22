/**
 * project-manager.js
 * プロジェクト全体の管理・ダッシュボード表示ロジック
 */

// プロファイルごとの解像度と最大フレーム数
const CONFIG = {
    main: { w: 240, h: 240, maxF: 20, label: "Main" },
    tab: { w: 96, h: 74, maxF: 1, label: "Tab" },
    stamp: { w: 320, h: 270, maxF: 20, label: "Stamp" }
};

// プロジェクトのグローバル状態
let project = { profile: 'stamp', stamps: {} };
let currentId = "01";
let currentType = "stamp";

/**
 * プロファイルの適用 (アニメスタンプ or アニメ絵文字)
 */
function applyProfile(mode) {
    project.profile = mode;
    // モードによってstampの定義を上書き
    CONFIG.stamp = (mode === 'emoji') 
        ? { w: 180, h: 180, maxF: 20, label: "Emoji" } 
        : { w: 320, h: 270, maxF: 20, label: "Stamp" };

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('project-screen').classList.add('active');
    initProject();
}

/**
 * ダッシュボード画面のスタンプ枠を生成
 * (31行目付近のロジック)
 */
function initProject() {
    // 1. スペシャル枠 (main, tab) の生成
    const sg = document.getElementById('special-grid'); 
    if (sg) {
        sg.innerHTML = '';
        const list = (project.profile === 'emoji') ? ['tab'] : ['main', 'tab'];
        list.forEach(id => {
            if (!project.stamps[id]) project.stamps[id] = createStampData(id);
            renderCard(sg, id, CONFIG[id].label);
        });
    }

    // 2. 通常スタンプ枠 (01-24 または 01-40) の生成
    const g = document.getElementById('stamp-grid'); 
    if (g) {
        g.innerHTML = '';
        const count = (project.profile === 'emoji') ? 40 : 24;
        for (let i = 1; i <= count; i++) {
            const id = String(i).padStart(2, '0');
            if (!project.stamps[id]) project.stamps[id] = createStampData(id);
            renderCard(g, id, `#${id}`);
        }
    }
}

/**
 * 個別のスタンプデータ構造を作成
 */
function createStampData(id) {
    const type = (id === 'main' || id === 'tab') ? id : 'stamp';
    const max = CONFIG[type].maxF;
    return { 
        delay: 100, 
        buffers: new Array(max).fill(null), 
        debugBgs: new Array(max).fill('debug-none'),
        enabled: new Array(max).fill(true) 
    };
}

/**
 * ダッシュボード上のカードを描画
 */
function renderCard(container, id, label) {
    const card = document.createElement('div');
    card.className = 'stamp-card';
    card.onclick = () => {
        if (typeof openEditor === 'function') {
            openEditor(id);
        } else {
            console.error("editor-logic.js が読み込まれていません");
        }
    };

    const sData = project.stamps[id];
    const buf = sData ? sData.buffers[0] : null;
    const type = (id === 'main' || id === 'tab') ? id : 'stamp';
    
    // プレビュー用サムネイルの生成 (バッファがあれば)
    let thumbHtml = '';
    if (buf) {
        const thumbSrc = arrayBufferToDataURL(buf, type);
        thumbHtml = `<img src="${thumbSrc}" style="max-width:100%;max-height:100%">`;
    }

    card.innerHTML = `
        <div class="thumb transparent-bg">${thumbHtml}</div>
        <div style="font-size:10px;">${label}</div>
    `;
    container.appendChild(card);
}

/**
 * プロジェクト全体をZipで保存
 */
async function buildProjectZip() {
    if (typeof toggleLoading === 'function') toggleLoading(true, "プロジェクトを保存中...");
    
    const zip = new JSZip(); 
    const pName = document.getElementById('project-name').value || 'project';
    
    const tasks = Object.keys(project.stamps).map(async id => {
        const sData = project.stamps[id];
        // 有効なフレームのみを抽出
        const active = sData.buffers.filter((b, i) => b !== null && sData.enabled[i]);
        
        if (active.length > 0) {
            const t = (id === 'main' || id === 'tab') ? id : 'stamp';
            
            let fileName = `${id}.png`; // デフォルト (main, tab, stampの01-24)

            // 絵文字プロファイルかつ、通常のスタンプID（数字）の場合のみ3桁化
            if (project.profile === 'emoji' && !isNaN(id)) {
                fileName = `${id.padStart(3, '0')}.png`; // "01" -> "001.png"
            }

            // editor-logic.js 内に定義される encodeApng を使用
            let out = (id === 'tab') 
                ? UPNG.encode([active[0]], CONFIG[t].w, CONFIG[t].h, 0) 
                : encodeApng(active, CONFIG[t].w, CONFIG[t].h, sData.delay);
            
            zip.file(fileName, out);
        }
    });

    await Promise.all(tasks);
    const content = await zip.generateAsync({ type: "blob" });
    saveBlob(content, `${pName}.zip`);
    
    if (typeof toggleLoading === 'function') toggleLoading(false);
}

/**
 * プロジェクトZipの読込
 */
async function importProjectZip(input) {
    if (!input.files[0]) return;
    if (typeof toggleLoading === 'function') toggleLoading(true, "プロジェクトを読込中...");
    
    try {
        const zip = await JSZip.loadAsync(input.files[0]);
        
        // 1. ファイルサイズからプロファイルを自動判定
        let detProfile = 'stamp';
        for (let fName of Object.keys(zip.files)) {
            if (fName.toLowerCase().endsWith(".png")) {
                const buf = await zip.file(fName).async("uint8array");
                if (buf.length > 24) {
                    const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
                    if (width === 180) { detProfile = 'emoji'; break; }
                }
            }
        }
        applyProfile(detProfile);

        // 2. 各ファイルを読み込んでデータ構造に展開
        for (let fName of Object.keys(zip.files)) {
            const idMatch = fName.match(/^([a-z0-9]+)\.png$/i);
            if (!idMatch) continue;
            
            let id = idMatch[1].toLowerCase();

            // 【修正箇所】3桁の数字(001など)を2桁(01)に変換して内部IDと合わせる
            if (project.profile === 'emoji' && id.length === 3 && !isNaN(id)) {
                id = id.substring(1); // 先頭の"0"を削る
            }

            if (!project.stamps[id]) continue;

            const buf = await zip.file(fName).async("arraybuffer");
            const res = await smartDecode(buf, id, (id==='main'||id==='tab')?id:'stamp');
            
            project.stamps[id].buffers.fill(null);
            project.stamps[id].enabled.fill(true);
            project.stamps[id].delay = res.delay;
            res.frames.forEach((f, i) => { 
                if (i < project.stamps[id].buffers.length) project.stamps[id].buffers[i] = f; 
            });
        }
        initProject();
    } catch (e) { 
        alert("読込失敗: " + e.message); 
    }
    
    if (typeof toggleLoading === 'function') toggleLoading(false);
    input.value = "";
}

/**
 * ダッシュボードへ戻る
 */
function showDashboard() { 
    if (typeof stopPreview === "function") stopPreview();
    document.getElementById('editor-screen').classList.remove('active'); 
    document.getElementById('project-screen').classList.add('active'); 
    initProject(); 
}


