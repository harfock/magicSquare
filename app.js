import { 
    GALLERY_IMAGES, 
    DYNAMIC_THEMES, 
    SHAPE_TEMPLATES, 
    COLOR_PALETTE, 
    SHAPE_TYPES 
} from './storyData.js';

// === 狀態管理 ===
let currentTargetShape = '';
let currentTargetColor = '';
let mathAnswer = 0;
let mathWrongCount = 0;
let sequenceNumbers = [];
let nextExpectedIndex = 0;

let clickedCorrectCount = 0;
let gameScore = 0;
let currentLevel = 1;
let objectsBuiltCount = 0; 

let carouselIndex = 0;
let infoRotationTimer = null;
let idleTimer = null;

// 全局發呆自動提示專用計時器
let globalIdleHintTimer = null;

// 核心定義：25 關為一輪大滿貫
const TOTAL_ROUNDS = 25;

// === Canvas 3D 深海陽光氣泡流動與自然分裂引擎 ===
let bubbleCanvas = null;
let bubbleCtx = null;
let backgroundBubbles = []; // 包含大氣泡與分裂後的小氣泡
let explosionParticles = []; // 點擊正確時的爆炸粒子
let animationFrameId = null;

function initBubbleCanvas() {
    bubbleCanvas = document.getElementById('bubble-canvas');
    if (!bubbleCanvas) return;
    bubbleCtx = bubbleCanvas.getContext('2d');
    resizeBubbleCanvas();
    window.addEventListener('resize', resizeBubbleCanvas);
    
    if (!animationFrameId) {
        updateExplosionAnimation();
    }
}

function resizeBubbleCanvas() {
    if (bubbleCanvas) {
        bubbleCanvas.width = window.innerWidth;
        bubbleCanvas.height = window.innerHeight;
    }
}

// 從左下角生成氣泡：有機率產生高達螢幕寬度 20% 的巨型大氣泡
function spawnAmbientBubble() {
    if (!bubbleCanvas) return;
    
    // 隨機決定這個氣泡是不是巨型氣泡（30% 機率是超級大氣泡）
    const isHuge = Math.random() < 0.3;
    let size = Math.random() * 15 + 5; // 一般氣泡 5px ~ 20px
    
    if (isHuge) {
        // 👑 設定為螢幕寬度的 15% 到 20% 之間
        const minHuge = bubbleCanvas.width * 0.15;
        const maxHuge = bubbleCanvas.width * 0.20;
        size = Math.random() * (maxHuge - minHuge) + minHuge;
    }

    backgroundBubbles.push({
        x: Math.random() * (bubbleCanvas.width * 0.3),
        y: bubbleCanvas.height + size + 20,
        vx: Math.random() * 1.2 + 0.6, // 由左下往右上
        vy: -(Math.random() * 1.5 + 0.5), 
        size: size,
        originalSize: size, // 記錄原始大小
        isHuge: isHuge,     // 標記是否為大氣泡
        wobbleSpeed: Math.random() * 0.01 + 0.005,
        wobbleRange: isHuge ? Math.random() * 3 + 1 : Math.random() * 1.5 + 0.5, // 大氣泡搖晃幅度大
        wobbleAngle: Math.random() * Math.PI,
        depthFactor: isHuge ? 0.7 : Math.random() * 0.4 + 0.4, // 大氣泡給予適度的半透明度，避免過度遮擋
        
        // 👑 破裂觸控點：當 vy 漂浮到螢幕高達 30%~70% 區間時，隨機觸發破裂
        splitY: bubbleCanvas.height * (Math.random() * 0.4 + 0.2) 
    });
}

// 當大氣泡到達指定高度，觸發「分裂成多個小氣泡」
function splitBubble(parentBubble) {
    // 依據原本大氣泡的體積，決定分裂出的小氣泡數量（大約 8~15 個）
    const spawnCount = Math.floor(Math.random() * 8) + 8;
    
    for (let i = 0; i < spawnCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const scatterSpeed = Math.random() * 2 + 1; // 破裂時稍微向外彈開的速度
        
        backgroundBubbles.push({
            x: parentBubble.x + (Math.random() - 0.5) * (parentBubble.size * 0.5),
            y: parentBubble.y + (Math.random() - 0.5) * (parentBubble.size * 0.5),
            // 繼承原本大氣泡的斜向速度，並加上破裂散射速度
            vx: parentBubble.vx + Math.cos(angle) * scatterSpeed,
            vy: parentBubble.vy + Math.sin(angle) * scatterSpeed - 0.5, // 稍微往上衝
            size: Math.random() * 6 + 3, // 分裂後的小氣泡尺寸為 3px ~ 9px
            originalSize: Math.random() * 6 + 3,
            isHuge: false, // 它們已經不是大氣泡了
            wobbleSpeed: Math.random() * 0.03 + 0.01,
            wobbleRange: Math.random() * 2 + 0.5,
            wobbleAngle: Math.random() * Math.PI,
            depthFactor: parentBubble.depthFactor * 1.2, // 分裂後光感變亮
            splitY: -999 // 小氣泡不會再次分裂
        });
    }
}

// 點擊正確方塊時的爆炸特效（保持不變）
function createExplosion(x, y) {
    if (!bubbleCtx) return;
    const count = 14; 
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2; 
        explosionParticles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed + 0.5,
            vy: Math.sin(angle) * speed - 1.0,
            size: Math.random() * 7 + 3,
            life: 1.0,
            decay: Math.random() * 0.025 + 0.015
        });
    }
}

// 動畫核心主循環
function updateExplosionAnimation() {
    if (!bubbleCtx) return;
    
    bubbleCtx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);
    
    // 控制深海環境氣泡生成頻率（限制畫面上同時存在的氣泡數，避免大爆滿）
    if (backgroundBubbles.length < 50 && Math.random() < 0.05) {
        spawnAmbientBubble();
    }
    
    let newSplittedBubbles = []; // 暫存這一幀內新分裂出來的小氣泡
    
    // 渲染與計算環境背景氣泡
    backgroundBubbles = backgroundBubbles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        p.wobbleAngle += p.wobbleSpeed;
        p.x += Math.sin(p.wobbleAngle) * p.wobbleRange * 0.2;
        
        // 邊界檢查：飄出螢幕則移除
        if (p.y < -p.size || p.x > bubbleCanvas.width + p.size) return false;
        
        // 👑 核心邏輯：如果是巨型大氣泡，且飄到了指定的 splitY 高度，立刻觸發分裂！
        if (p.isHuge && p.y <= p.splitY) {
            splitBubble(p); // 在原地產生多個小氣泡
            return false;   // 移除這個原本的大氣泡
        }
        
        // 3D 陽光折射光暈計算
        let yProgress = 1 - (p.y / bubbleCanvas.height); 
        let alpha = (0.15 + yProgress * 0.45) * p.depthFactor;
        if (alpha > 1) alpha = 1;
        
        bubbleCtx.beginPath();
        bubbleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        let gradient = bubbleCtx.createRadialGradient(
            p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.05,
            p.x, p.y, p.size
        );
        gradient.addColorStop(0, `rgba(240, 251, 255, ${alpha * 1.2})`); 
        gradient.addColorStop(0.2, `rgba(56, 189, 248, ${alpha * 0.8})`); 
        gradient.addColorStop(0.7, `rgba(14, 165, 233, ${alpha * 0.35})`); 
        gradient.addColorStop(1, `rgba(3, 105, 161, 0)`);
        
        bubbleCtx.fillStyle = gradient;
        bubbleCtx.fill();
        
        // 氣泡邊緣線條（大氣泡線條稍微加粗，更有存在感）
        bubbleCtx.beginPath();
        bubbleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        bubbleCtx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.5})`;
        bubbleCtx.lineWidth = p.isHuge ? 1.8 : 1.0;
        bubbleCtx.stroke();
        
        // 頂部陽光直射高光點
        bubbleCtx.beginPath();
        bubbleCtx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.14, 0, Math.PI * 2);
        bubbleCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.4})`;
        bubbleCtx.fill();
        
        return true;
    });
    
    // 渲染正確點擊時產生的碎裂小粒子
    explosionParticles = explosionParticles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy -= 0.05; p.life -= p.decay;
        if (p.life <= 0) return false;
        
        bubbleCtx.beginPath();
        bubbleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        let expGradient = bubbleCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        expGradient.addColorStop(0, `rgba(255, 255, 255, ${p.life})`);
        expGradient.addColorStop(0.5, `rgba(56, 189, 248, ${p.life * 0.8})`);
        expGradient.addColorStop(1, `rgba(14, 165, 233, 0)`);
        bubbleCtx.fillStyle = expGradient;
        bubbleCtx.fill();
        return true;
    });
    
    animationFrameId = requestAnimationFrame(updateExplosionAnimation);
}


// === 輔助防退化觸控 ===
function bindElderTouch(element, callback) {
    element.addEventListener('touchstart', (e) => {
        e.preventDefault(); 
        callback();
    }, { passive: false });

    element.addEventListener('click', (e) => {
        if (e.pointerType === 'touch') return; 
        callback();
    });
}

function getCurrentImageConfig() {
    let loops = Math.floor((currentLevel - 1) / TOTAL_ROUNDS);
    let imgIndex = loops % GALLERY_IMAGES.length;
    return GALLERY_IMAGES[imgIndex];
}

function refreshYardBackground() {
    const yard = document.getElementById('construction-yard');
    const title = document.getElementById('yard-title');
    if (!yard) return;

    let imgConfig = getCurrentImageConfig();
    yard.style.backgroundImage = `url('${imgConfig.url}')`;
    title.textContent = `${imgConfig.name}`; 
}

function renderThumbBadges() {
    const container = document.getElementById('top-badge-container');
    if (!container) return;
    
    let savedLoops = parseInt(localStorage.getItem('completed_loops')) || 0;
    container.innerHTML = '';
    
    for(let i = 0; i < savedLoops; i++) {
        const thumb = document.createElement('span');
        thumb.className = 'thumb-badge';
        thumb.textContent = '👍';
        thumb.title = `查看第 ${i + 1} 輪解鎖畫卷`;
        
        bindElderTouch(thumb, () => openGalleryPopup(i));
        container.appendChild(thumb);
    }
}

function openGalleryPopup(loopIndex) {
    const popup = document.getElementById('gallery-popup');
    const img = document.getElementById('gallery-img');
    const textTitle = document.getElementById('gallery-text-title');
    if (!popup || !img || !textTitle) return;

    let imgIndex = loopIndex % GALLERY_IMAGES.length;
    let config = GALLERY_IMAGES[imgIndex];

    img.src = config.url;
    textTitle.textContent = `🎉 這是您在第 ${loopIndex + 1} 輪大滿貫中所創造的：${config.name}`;
    popup.style.display = 'flex';
}

function closeGalleryPopup() {
    const popup = document.getElementById('gallery-popup');
    if (popup) popup.style.display = 'none';
}

function startTopBarRotation() {
    if (infoRotationTimer) clearInterval(infoRotationTimer);
    updateCarouselDisplay();

    infoRotationTimer = setInterval(() => {
        const leftSide = document.getElementById('target-left-side');
        if (leftSide) {
            leftSide.classList.remove('blink-active');
            void leftSide.offsetWidth; 
            leftSide.classList.add('blink-active');
        }
        carouselIndex = (carouselIndex + 1) % 3;
        updateCarouselDisplay();
    }, 5000);
}

function updateCarouselDisplay() {
    const textSpan = document.getElementById('carousel-text');
    if (!textSpan) return;

    textSpan.classList.remove('fade-in-effect');
    void textSpan.offsetWidth;
    textSpan.classList.add('fade-in-effect');

    let imgConfig = getCurrentImageConfig();
    let themeList = DYNAMIC_THEMES[imgConfig.type] || DYNAMIC_THEMES.CITY;

    let stageIndex = Math.min(objectsBuiltCount, themeList.length - 1);
    let stageName = themeList[stageIndex] ? themeList[stageIndex] : "等待開發";

    switch(carouselIndex) {
        case 0:
            textSpan.innerHTML = `⭐ 得分: <span style="color: #4CD964; font-size: 18px;">${gameScore}</span>`;
            break;
        case 1:
            textSpan.innerHTML = `🎯 關卡: <span style="color: #5AC8FA; font-size: 18px;">第 ${currentLevel} 關</span>`;
            break;
        case 2:
            textSpan.innerHTML = `🔍 探索: <span style="color: #FCD34D; font-size: 14px;">${stageName}</span>`;
            break;
    }
}

function resetIdleTimer() {
    const neonContainer = document.getElementById('neon-trail-container');
    if (neonContainer && neonContainer.classList.contains('active')) {
        neonContainer.classList.remove('active');
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (neonContainer) neonContainer.classList.add('active');
    }, 5000);

    startGlobalIdleHintTimeout();
}

function createBaseMesh() {
    const grid = document.getElementById('iso-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const tile = document.createElement('div');
        tile.className = 'grid-tile';
        tile.id = `tile-${i}`;
        tile.textContent = `${i + 1}`;
        grid.appendChild(tile);
    }
    refreshYardBackground();
}

function getRoundMode(level) {
    let pos = (level - 1) % 12 + 1; 
    if (pos <= 3) return 'SHAPE'; 
    if (pos <= 6) return 'MATH';  
    if (pos <= 9) return 'COLOR';               
    return 'SEQUENCE'; 
}

function initGame() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);

    const playArea = document.getElementById('play-area');
    const targetDisplay = document.getElementById('target-display');
    const instruction = document.getElementById('game-instruction');
    if (!playArea || !targetDisplay) return;

    let mode = getRoundMode(currentLevel);

    if (mode === 'SHAPE') {
        instruction.innerHTML = '請找出 <span style="color: #FCD34D;">三個</span> 指定形狀：';
        playArea.className = "grid-shape-mode"; 
        playArea.innerHTML = '';
        clickedCorrectCount = 0;

        currentTargetShape = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
        targetDisplay.innerHTML = SHAPE_TEMPLATES[currentTargetShape];

        let spawnPool = [];
        for (let i = 0; i < 3; i++) { spawnPool.push({ type: currentTargetShape, isTarget: true }); }
        const wrongTypes = SHAPE_TYPES.filter(type => type !== currentTargetShape);
        for (let i = 0; i < 9; i++) {
            const randomWrongType = wrongTypes[Math.floor(Math.random() * wrongTypes.length)];
            spawnPool.push({ type: randomWrongType, isTarget: false });
        }

        for (let i = spawnPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [spawnPool[i], spawnPool[j]] = [spawnPool[j], spawnPool[i]];
        }

        spawnPool.forEach((item) => {
            const box = document.createElement('div');
            box.className = 'shape-box';
            if (item.isTarget) box.setAttribute('data-target-hint', 'true');
            box.innerHTML = SHAPE_TEMPLATES[item.type];
            bindElderTouch(box, () => handleItemClick(box, item.isTarget, 150));
            playArea.appendChild(box);
        });

    } else if (mode === 'MATH') {
        playArea.className = "grid-math-mode"; 
        playArea.innerHTML = '';
        targetDisplay.textContent = "?";
        mathWrongCount = 0; 

        let mathType = Math.floor(Math.random() * 3); 
        let questionText = "";

        if (mathType === 0) {
            let num1 = Math.floor(Math.random() * 40) + 15;
            let num2 = Math.floor(Math.random() * 40) + 15;
            mathAnswer = num1 + num2;
            questionText = `${num1} <span style="font-size:32px; color:#FCD34D; margin:0 4px;">+</span> ${num2}`;
        } else if (mathType === 1) {
            let singleNum = Math.floor(Math.random() * 8) + 2;
            mathAnswer = singleNum * 11;
            questionText = `${singleNum} <span style="font-size:32px; color:#FCD34D; margin:0 4px;">×</span> 11`;
        } else {
            let evenNum = (Math.floor(Math.random() * 40) + 10) * 2;
            mathAnswer = evenNum / 2;
            questionText = `${evenNum} <span style="font-size:32px; color:#FCD34D; margin:0 4px;">÷</span> 2`;
        }

        instruction.innerHTML = `請精準點選正確答案： ${questionText} = ?`;

        let mathAnswersPool = [mathAnswer];
        while(mathAnswersPool.length < 9) {
            let offset = Math.floor(Math.random() * 24) - 12; 
            let fakeAns = mathAnswer + offset;
            if(fakeAns > 0 && !mathAnswersPool.includes(fakeAns)) {
                mathAnswersPool.push(fakeAns);
            }
        }

        for (let i = mathAnswersPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mathAnswersPool[i], mathAnswersPool[j]] = [mathAnswersPool[j], mathAnswersPool[i]];
        }

        mathAnswersPool.forEach((val) => {
            const btn = document.createElement('div');
            btn.className = 'num-btn';
            btn.textContent = val;
            if (val === mathAnswer) btn.setAttribute('data-target-hint', 'true'); 

            bindElderTouch(btn, () => handleMathGridSelection(btn, val === mathAnswer));
            playArea.appendChild(btn);
        });

    } else if (mode === 'COLOR') {
        instruction.innerHTML = '請找出 <span style="color: #FCD34D;">三個</span> 指定色彩：';
        playArea.className = "grid-color-mode"; 
        playArea.innerHTML = '';
        clickedCorrectCount = 0;

        currentTargetColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        targetDisplay.innerHTML = `<div class="color-target-preview" style="background-color: ${currentTargetColor}"></div>`;

        let spawnPool = [];
        for (let i = 0; i < 3; i++) { spawnPool.push({ color: currentTargetColor, isTarget: true }); }
        const wrongColors = COLOR_PALETTE.filter(c => c !== currentTargetColor);
        for (let i = 0; i < 13; i++) {
            const randomWrongColor = wrongColors[i % wrongColors.length];
            spawnPool.push({ color: randomWrongColor, isTarget: false });
        }

        for (let i = spawnPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [spawnPool[i], spawnPool[j]] = [spawnPool[j], spawnPool[i]];
        }

        spawnPool.forEach((item) => {
            const btn = document.createElement('div');
            btn.className = 'color-btn';
            if (item.isTarget) btn.setAttribute('data-target-hint', 'true');
            btn.style.backgroundColor = item.color; 
            bindElderTouch(btn, () => handleItemClick(btn, item.isTarget, 200)); 
            playArea.appendChild(btn);
        });

    } else if (mode === 'SEQUENCE') {
        instruction.innerHTML = '請依序 <span style="color: #34D399;">由小到大</span> 點選以下數字：';
        playArea.className = "grid-sequence-mode";
        playArea.innerHTML = '';
        targetDisplay.textContent = "123"; 

        let numSet = new Set();
        while(numSet.size < 6) {
            numSet.add(Math.floor(Math.random() * 95) + 3);
        }
        
        sequenceNumbers = Array.from(numSet);
        let sortedNumbers = [...sequenceNumbers].sort((a, b) => a - b);
        nextExpectedIndex = 0; 

        sequenceNumbers.forEach((num) => {
            const seqBtn = document.createElement('div');
            seqBtn.className = 'seq-btn';
            seqBtn.textContent = num;
            seqBtn.setAttribute('data-val', num);

            bindElderTouch(seqBtn, () => {
                let correctNextValue = sortedNumbers[nextExpectedIndex];
                if (num === correctNextValue) {
                    // 👑 點擊正確：獲取當前按鈕中心點，觸發 3D 氣泡碎裂
                    const rect = seqBtn.getBoundingClientRect();
                    createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);

                    seqBtn.classList.remove('flash-hint'); 
                    seqBtn.classList.add('completed');
                    seqBtn.removeAttribute('data-val'); 
                    nextExpectedIndex++;
                    gameScore += 50;

                    if (nextExpectedIndex === 6) {
                        gameScore += 100; 
                        processRoundSuccess();
                    } else {
                        startGlobalIdleHintTimeout();
                    }
                } else {
                    seqBtn.classList.add('shake');
                    setTimeout(() => seqBtn.classList.remove('shake'), 350);
                }
            });

            playArea.appendChild(seqBtn);
        });
    }

    startGlobalIdleHintTimeout();
    updateCarouselDisplay();
}

function handleItemClick(element, isTarget, scoreReward) {
    if (element.classList.contains('eliminated') || element.classList.contains('shake')) return;

    if (isTarget) {
        if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
        
        // 👑 點擊正確：獲取元件中心點，觸發 3D 氣泡碎裂
        const rect = element.getBoundingClientRect();
        createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);

        element.classList.remove('flash-hint');
        element.classList.add('eliminated');
        clickedCorrectCount++;
        gameScore += scoreReward;

        if (clickedCorrectCount === 3) { 
            processRoundSuccess(); 
        } else {
            startGlobalIdleHintTimeout();
        }
    } else {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 350);
    }
}

function handleMathGridSelection(clickedBtn, isCorrect) {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); 

    if (isCorrect) {
        // 👑 點擊正確：獲取元件中心點，觸發 3D 氣泡碎裂
        const rect = clickedBtn.getBoundingClientRect();
        createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);

        gameScore += 250;
        document.getElementById('target-display').textContent = mathAnswer;
        processRoundSuccess();
    } else {
        mathWrongCount++;
        clickedBtn.classList.add('shake');
        setTimeout(() => clickedBtn.classList.remove('shake'), 350);

        if (mathWrongCount >= 3) {
            flashAllCorrectAnswersOnce(); 
        } else {
            startGlobalIdleHintTimeout(); 
        }
    }
}

function flashAllCorrectAnswersOnce() {
    let mode = getRoundMode(currentLevel);
    let targets = [];

    if (mode === 'SEQUENCE') {
        let remainingBtns = Array.from(document.querySelectorAll('.seq-btn[data-val]'));
        if (remainingBtns.length > 0) {
            remainingBtns.sort((a, b) => parseInt(a.getAttribute('data-val')) - parseInt(b.getAttribute('data-val')));
            targets = [remainingBtns[0]]; 
        }
    } else {
        targets = Array.from(document.querySelectorAll('[data-target-hint="true"]'))
                       .filter(el => !el.classList.contains('eliminated'));
    }

    targets.forEach(targetBtn => {
        targetBtn.classList.remove('flash-hint');
        void targetBtn.offsetWidth; 
        targetBtn.classList.add('flash-hint');
        
        setTimeout(() => {
            targetBtn.classList.remove('flash-hint');
        }, 1000);
    });

    startGlobalIdleHintTimeout();
}

function startGlobalIdleHintTimeout() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
    globalIdleHintTimer = setTimeout(() => {
        flashAllCorrectAnswersOnce();
    }, 5000); 
}

function revealCityMask() {
    let tileIndex = (objectsBuiltCount - 1) % TOTAL_ROUNDS; 
    let targetTile = document.getElementById(`tile-${tileIndex}`);
    
    if (targetTile) { 
        targetTile.classList.add('revealed'); 
        
        const yard = document.getElementById('construction-yard');
        if (yard) {
            yard.classList.remove('just-unlocked');
            void yard.offsetWidth; 
            yard.classList.add('just-unlocked'); 
        }
    }
}

function processRoundSuccess() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); 
    objectsBuiltCount++; 
    currentLevel++;
    revealCityMask(); 
    setTimeout(() => { triggerTransitionModal(); }, 500);
}

function triggerTransitionModal() {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const continueBtn = document.getElementById('modal-continue-btn');
    if(!overlay || !title || !desc || !continueBtn) return;

    let imgConfig = getCurrentImageConfig();
    let themeList = DYNAMIC_THEMES[imgConfig.type] || DYNAMIC_THEMES.CITY;

    if ((currentLevel - 1) % TOTAL_ROUNDS === 0) {
        let currentLoopCount = (currentLevel - 1) / TOTAL_ROUNDS;
        let lastImgConfig = GALLERY_IMAGES[(currentLoopCount - 1) % GALLERY_IMAGES.length];
        
        title.textContent = `🎉 榮耀大滿貫成就達成！`;
        desc.innerHTML = `您已成功揭開整個：<span style="color: #FFF; text-decoration: underline;">${lastImgConfig.name}</span>！<br>獲得了第 ${currentLoopCount} 個 👍 勳章！<br><br><span style="font-size: 15px; color:#A7F3D0;">💡 提示：點擊右上方的 👍 按鈕即可隨時回看完整高清大圖哦！</span>`;
        
        localStorage.setItem('completed_loops', currentLoopCount);
        renderThumbBadges();

        continueBtn.style.display = 'block';
        overlay.style.display = 'flex';
    } else {
        let tileIndex = Math.min((objectsBuiltCount - 1) % TOTAL_ROUNDS, themeList.length - 1);
        let latestBuildName = themeList[tileIndex];
        let prevMode = getRoundMode(currentLevel - 1);

        if (prevMode === 'MATH') { title.textContent = `🧠 心算活化成功！`; } 
        else if (prevMode === 'COLOR') { title.textContent = `🎨 色彩感知成功！`; } 
        else if (prevMode === 'SEQUENCE') { title.textContent = `🔢 數字邏輯成功！`; } 
        else { title.textContent = `🧱 視覺消除成功！`; }
        
        desc.textContent = `成功解鎖進度：${latestBuildName}`;
        continueBtn.style.display = 'none'; 
        overlay.style.display = 'flex';
        
        setTimeout(() => {
            overlay.style.display = 'none';
            initGame();
        }, 1600);
    }
}

function handleModalContinue() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-continue-btn').style.display = 'none';
    objectsBuiltCount = 0; 
    createBaseMesh(); 
    initGame();
}

// === 初始化事件綁定 ===
window.addEventListener('click', resetIdleTimer);
window.addEventListener('touchstart', resetIdleTimer);
window.addEventListener('touchmove', resetIdleTimer);

const galleryPopup = document.getElementById('gallery-popup');
if (galleryPopup) {
    galleryPopup.addEventListener('click', closeGalleryPopup);
}
const continueBtn = document.getElementById('modal-continue-btn');
if (continueBtn) {
    bindElderTouch(continueBtn, handleModalContinue);
}

// 啟動與環境初始化
document.addEventListener('DOMContentLoaded', () => {
    initBubbleCanvas(); // 👑 初始化氣泡畫布
    createBaseMesh();
    renderThumbBadges();
    initGame();
    startTopBarRotation(); 
    resetIdleTimer();
});
