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

// === 超擬真 3D 深海流體氣泡引擎 ===
let bubbleCanvas = null;
let bubbleCtx = null;
let backgroundBubbles = []; 
let explosionParticles = []; 
let animationFrameId = null;

function initBubbleCanvas() {
    bubbleCanvas = document.getElementById('bubble-canvas');
    if (!bubbleCanvas) return;
    bubbleCtx = bubbleCanvas.getContext('2d');
    resizeBubbleCanvas();
    window.addEventListener('resize', resizeBubbleCanvas);
    if (!animationFrameId) updateExplosionAnimation();
}

function resizeBubbleCanvas() {
    if (bubbleCanvas) {
        bubbleCanvas.width = window.innerWidth;
        bubbleCanvas.height = window.innerHeight;
    }
}

function spawnAmbientBubble() {
    if (!bubbleCanvas) return;
    
    const isHuge = Math.random() < 0.25; // 25% 機率生成巨型氣泡
    let size = Math.random() * 12 + 4; 
    
    if (isHuge) {
        const minHuge = bubbleCanvas.width * 0.12;
        const maxHuge = bubbleCanvas.width * 0.18;
        size = Math.random() * (maxHuge - minHuge) + minHuge;
    }

    backgroundBubbles.push({
        x: Math.random() * (bubbleCanvas.width * 0.3),
        y: bubbleCanvas.height + size + 20,
        vx: Math.random() * 1.0 + 0.5, 
        vy: -(Math.random() * 1.3 + 0.6), 
        size: size,
        isHuge: isHuge,
        
        // 👑 果凍形變參數
        squishPhase: Math.random() * Math.PI * 2,
        squishSpeed: Math.random() * 0.08 + 0.05, // 抖動頻率
        squishAmount: isHuge ? 0.08 : 0.04,        // 大氣泡抖動幅度更明顯
        
        wobbleAngle: Math.random() * Math.PI,
        depthFactor: isHuge ? 0.6 : Math.random() * 0.4 + 0.4, 
        splitY: bubbleCanvas.height * (Math.random() * 0.4 + 0.2) 
    });
}

function splitBubble(parentBubble) {
    const spawnCount = Math.floor(Math.random() * 6) + 8;
    for (let i = 0; i < spawnCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const scatterSpeed = Math.random() * 1.5 + 1; 
        const size = Math.random() * 5 + 3;
        backgroundBubbles.push({
            x: parentBubble.x,
            y: parentBubble.y,
            vx: parentBubble.vx + Math.cos(angle) * scatterSpeed,
            vy: parentBubble.vy + Math.sin(angle) * scatterSpeed - 0.3,
            size: size,
            isHuge: false,
            squishPhase: Math.random() * Math.PI,
            squishSpeed: Math.random() * 0.15 + 0.1, // 小氣泡抖動極快
            squishAmount: 0.03,
            wobbleAngle: Math.random() * Math.PI,
            depthFactor: parentBubble.depthFactor * 1.2,
            splitY: -999
        });
    }
}

// 主動畫循環
function updateExplosionAnimation() {
    if (!bubbleCtx) return;
    bubbleCtx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);
    
    if (backgroundBubbles.length < 35 && Math.random() < 0.04) {
        spawnAmbientBubble();
    }
    
    backgroundBubbles = backgroundBubbles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        // 1. 水流引起的左右蛇行
        p.wobbleAngle += 0.015;
        p.x += Math.sin(p.wobbleAngle) * 0.2;
        
        if (p.y < -p.size * 2 || p.x > bubbleCanvas.width + p.size * 2) return false;
        
        if (p.isHuge && p.y <= p.splitY) {
            splitBubble(p);
            return false;
        }
        
        // 👑 2. 計算流體動態形變 (果凍上下左右擠壓效果)
        p.squishPhase += p.squishSpeed;
        // 根據相位計算當前橫向與縱向的縮放比例
        let radiusX = p.size * (1 + Math.sin(p.squishPhase) * p.squishAmount);
        let radiusY = p.size * (1 - Math.sin(p.squishPhase) * p.squishAmount);
        
        // 3. 環境光度計算（越接近右上方陽光處越透亮）
        let yProgress = 1 - (p.y / bubbleCanvas.height); 
        let xProgress = p.x / bubbleCanvas.width;
        let lightIntensity = (0.2 + (yProgress * 0.5) + (xProgress * 0.2)) * p.depthFactor;
        if (lightIntensity > 1) lightIntensity = 1;
        
        // 👑 4. 動態 3D 光影矩陣：高光點隨氣泡在螢幕的位置發生「透視位移」
        // 氣泡越往右上走，高光越往右上方邊緣靠攏，模擬真實折射
        let highlightX = p.x - radiusX * (0.3 - xProgress * 0.15);
        let highlightY = p.y - radiusY * (0.3 + yProgress * 0.15);
        
        // 繪製主體漸層 (使用變形後的半徑)
        bubbleCtx.beginPath();
        // 使用 ellipse 代替正圓 arc 實現流體變形
        bubbleCtx.ellipse(p.x, p.y, radiusX, radiusY, 0, 0, Math.PI * 2);
        
        let gradient = bubbleCtx.createRadialGradient(
            highlightX, highlightY, p.size * 0.02,
            p.x, p.y, p.size
        );
        // 水晶折射：核心近乎完全透明(0.02)，邊緣因為菲涅爾效應反射出強烈藍綠波光
        gradient.addColorStop(0, `rgba(255, 255, 255, ${lightIntensity * 1.3})`); 
        gradient.addColorStop(0.15, `rgba(186, 230, 253, ${lightIntensity * 0.5})`); 
        gradient.addColorStop(0.6, `rgba(14, 165, 233, ${lightIntensity * 0.15})`); // 中心半透明看穿背景
        gradient.addColorStop(0.9, `rgba(2, 132, 199, ${lightIntensity * 0.6})`);  // 邊緣折射深藍
        gradient.addColorStop(1, `rgba(3, 105, 161, 0)`);
        
        bubbleCtx.fillStyle = gradient;
        bubbleCtx.fill();
        
        // 👑 5. 精緻的 3D 立體弧形高光點 (Specular Sparkle)
        // 這不是一個死板的小圓圈，而是一個貼合氣泡弧度的微弱月牙狀或亮點
        bubbleCtx.beginPath();
        bubbleCtx.ellipse(highlightX, highlightY, radiusX * 0.15, radiusY * 0.12, Math.PI / 4, 0, Math.PI * 2);
        bubbleCtx.fillStyle = `rgba(255, 255, 255, ${lightIntensity * 1.6})`;
        bubbleCtx.fill();
        
        // 👑 6. 左下角二次環境反光 (來自海底或周遭水流散射)
        bubbleCtx.beginPath();
        bubbleCtx.ellipse(p.x + radiusX * 0.4, p.y + radiusY * 0.4, radiusX * 0.2, radiusY * 0.1, -Math.PI / 4, 0, Math.PI * 2);
        bubbleCtx.fillStyle = `rgba(56, 189, 248, ${lightIntensity * 0.3})`;
        bubbleCtx.fill();

        return true;
    });
    
    // 渲染正確點擊時的粒子 (同樣優化為流體感)
    explosionParticles = explosionParticles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy -= 0.04; p.life -= p.decay;
        if (p.life <= 0) return false;
        
        bubbleCtx.beginPath();
        bubbleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        let expGradient = bubbleCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        expGradient.addColorStop(0, `rgba(255, 255, 255, ${p.life})`);
        expGradient.addColorStop(0.4, `rgba(56, 189, 248, ${p.life * 0.7})`);
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
