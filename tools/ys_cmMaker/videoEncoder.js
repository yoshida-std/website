import parseAPNG from 'https://cdn.skypack.dev/apng-js';
import { Muxer, ArrayBufferTarget } from 'https://unpkg.com/mp4-muxer@latest/build/mp4-muxer.mjs';

// 解像度はPC・スマホ共にハードウェアエンコーダが最も安定する「16の倍数」に固定
export const VIDEO_CONFIG = {
    width: 544,  
    height: 960,
    fps: 30,
    bitrate: 1_500_000,
    codec: 'avc1.4D401F' // PCでの互換性が高いMain Profileに変更
};

export async function generateStampVideo(params, onProgress) {
    const { stampFiles, mainImg, title, author, footer, bgColor, stampBgColor, textColor, canvas, ctx } = params;
    
    // 1. Muxerの初期化
    let muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: VIDEO_CONFIG.width, height: VIDEO_CONFIG.height },
        fastStart: 'in-memory'
    });

    // 2. VideoEncoderの初期化
    let encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("VideoEncoder Error: ", e)
    });

    // 設定完了を確実に待機
    await encoder.configure({ 
        codec: VIDEO_CONFIG.codec, 
        width: VIDEO_CONFIG.width, 
        height: VIDEO_CONFIG.height, 
        bitrate: VIDEO_CONFIG.bitrate, 
        framerate: VIDEO_CONFIG.fps,
        latencyMode: 'quality' // PCでの安定性を優先
    });

    let frameCount = 0;

    // 3. メインループ（スタンプごとの処理）
    for (let i = 0; i < stampFiles.length; i++) {
        if (onProgress) onProgress(i + 1, stampFiles.length);

        const buffer = await stampFiles[i].async("arraybuffer");
        let frames = await getRenderedFrames(buffer);
        
        if (!frames) {
            const blob = await stampFiles[i].async("blob");
            const img = await loadImage(URL.createObjectURL(blob));
            if (img) frames = [{ img, delay: 1000 }];
        }
        if (!frames) continue;

        let stampTime = 0;
        const displayDuration = 1.0; 
        const totalApngMs = frames.reduce((a, b) => a + b.delay, 0) || 1000;

        while (stampTime < displayDuration) {
            // 【PCエラー対策】エンコーダの状態を毎フレーム確認
            if (encoder.state !== "configured") break;

            // 【スマホ・PC共通】キューが溜まりすぎている場合は待機（パンク防止）
            while (encoder.encodeQueueSize > 5) {
                await new Promise(r => setTimeout(r, 20));
            }

            drawUI(ctx, { 
                title, author, footer, mainImg, bgColor, stampBgColor, textColor, 
                targetFrame: getFrameAtTime(frames, stampTime, totalApngMs), 
                index: i + 1 
            });

            // VideoFrameの作成
            const ts = Math.round((frameCount * 1000000) / VIDEO_CONFIG.fps);
            const vFrame = new VideoFrame(canvas, { 
                timestamp: ts,
                duration: Math.round(1000000 / VIDEO_CONFIG.fps)
            });

            try {
                encoder.encode(vFrame);
            } catch (e) {
                console.warn("Encode call failed, skipping frame:", e);
            }
            
            // 【最重要】即座にメモリを解放（スマホのクラッシュ防止）
            vFrame.close(); 
            
            frameCount++;
            stampTime += 1 / VIDEO_CONFIG.fps;
        }

        // 【PCエラー対策の要】スタンプ1枚ごとに同期（flush）をとる
        // これがないとPCでは処理が速すぎて内部的に破綻し「closed codec」になります
        if (encoder.state === "configured") {
            await encoder.flush();
        }
    }

    // 4. 最終フラッシュと終了処理
    if (encoder.state === "configured") {
        await encoder.flush();
        encoder.close();
    }
    
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

// --- 以下、補助関数（スマホ互換性を維持） ---

async function getRenderedFrames(buffer) {
    try {
        const apng = parseAPNG(buffer);
        if (apng instanceof Error) return null;
        await apng.createImages();
        
        const renderedFrames = [];
        const workCanvas = document.createElement('canvas');
        workCanvas.width = apng.width; 
        workCanvas.height = apng.height;
        const workCtx = workCanvas.getContext('2d');
        
        for (const frame of apng.frames) {
            if (frame.disposeOp === 1 || frame.blendOp === 0) {
                workCtx.clearRect(frame.left, frame.top, frame.width, frame.height);
            }
            workCtx.drawImage(frame.imageElement, frame.left, frame.top);
            
            const snapshot = document.createElement('canvas');
            snapshot.width = apng.width; 
            snapshot.height = apng.height;
            snapshot.getContext('2d').drawImage(workCanvas, 0, 0);
            renderedFrames.push({ img: snapshot, delay: frame.delay });
        }
        return renderedFrames;
    } catch (e) { return null; }
}

function getFrameAtTime(frames, stampTime, totalApngMs) {
    const currentMs = (stampTime * 1000) % totalApngMs;
    let acc = 0;
    for (const f of frames) {
        acc += f.delay;
        if (currentMs < acc) return f;
    }
    return frames[frames.length - 1];
}

async function loadImage(url) {
    return new Promise(res => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url); 
            res(img);
        };
        img.onerror = () => res(null);
        img.src = url;
    });
}

function drawUI(ctx, p) {
    const { width: W, height: H } = VIDEO_CONFIG;
    ctx.fillStyle = p.bgColor; 
    ctx.fillRect(0, 0, W, H);

    let currentY = 80; 
    if (p.mainImg) {
        const size = 110; 
        const imgX = (W - size) / 2;
        ctx.save();
        ctx.beginPath(); 
        ctx.roundRect(imgX, currentY, size, size, 20);
        ctx.fillStyle = p.stampBgColor; 
        ctx.fill(); ctx.clip();
        const r = Math.min((size - 10) / p.mainImg.width, (size - 10) / p.mainImg.height);
        ctx.drawImage(p.mainImg, imgX + (size - p.mainImg.width * r) / 2, currentY + (size - p.mainImg.height * r) / 2, p.mainImg.width * r, p.mainImg.height * r);
        ctx.restore();
        currentY += size + 25; 
    }

    ctx.fillStyle = p.textColor;
    const titleLineHeight = fillSingleLineTextAutoFit(ctx, p.title, W / 2, currentY, 480, 34);
    currentY += titleLineHeight + 5; 

    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.author || "", W / 2, currentY + 20);

    const cardSize = 420;
    const cardX = (W - cardSize) / 2;
    const cardY = 320; 
    ctx.save();
    ctx.beginPath(); 
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 30);
    ctx.fillStyle = p.stampBgColor; ctx.fill(); ctx.clip();
    if (p.targetFrame?.img) {
        const img = p.targetFrame.img;
        const r = Math.min((cardSize - 40) / img.width, (cardSize - 40) / img.height);
        ctx.drawImage(img, cardX + (cardSize - img.width * r) / 2, cardY + (cardSize - img.height * r) / 2, img.width * r, img.height * r);
    }
    ctx.restore();

    ctx.font = "bold 40px sans-serif";
    ctx.fillText(`No. ${p.index}`, W / 2, cardY + cardSize + 70);

    ctx.font = "bold 32px sans-serif";
    ctx.fillText(p.footer || "", W / 2, H - 80);
}

function fillSingleLineTextAutoFit(ctx, text, x, y, maxWidth, fontSize) {
    ctx.save();
    let currentSize = fontSize;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    do {
        ctx.font = `bold ${currentSize}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth || currentSize <= 10) break;
        currentSize -= 1;
    } while (currentSize > 10);
    ctx.fillText(text, x, y);
    ctx.restore();
    return currentSize * 1.3;
}
