import { 
    GALLERY_IMAGES, 
    DYNAMIC_THEMES, 
    SHAPE_TEMPLATES, 
    COLOR_PALETTE, 
    SHAPE_TYPES 
} from './storyData.js';

// === 狀態管理（封裝在模組內，外部無法任意污染） ===
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

// 👑 全局發呆自動提示專用計時器 (取代舊有單一模式計時)
let globalIdleHintTimer = null;

// 👑 核心優化：定義 25 關為一輪大滿貫
const TOTAL_ROUNDS = 25;

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
    // 1. 原本的霓虹螢幕保護程式計時
    const neonContainer = document.getElementById('neon-trail-container');
    if (neonContainer && neonContainer.classList.contains('active')) {
        neonContainer.classList.remove('active');
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (neonContainer) neonContainer.classList.add('active');
    }, 5000);

    // 👑 2. 核心修正：只要玩家觸控或點擊螢幕，立刻重設「5秒全局發呆自動提示」計時器
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
    // 👑 初始化新關卡時，徹底清空發呆提示計時器
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
            // 👑 標記正確答案以便發呆提示搜尋
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
            // 👑 標記正確答案以便發呆提示搜尋
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
            // 👑 標記正確答案以便發呆提示搜尋
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
            // 👑 動態屬性：記錄其數值，方便發呆時找出當前「最小值」按鈕
            seqBtn.setAttribute('data-val', num);

            bindElderTouch(seqBtn, () => {
                let correctNextValue = sortedNumbers[nextExpectedIndex];
                if (num === correctNextValue) {
                    seqBtn.classList.remove('flash-hint'); // 若正在閃爍則移除
                    seqBtn.classList.add('completed');
                    seqBtn.removeAttribute('data-val'); // 已完成，移除數值標記
                    nextExpectedIndex++;
                    gameScore += 50;

                    if (nextExpectedIndex === 6) {
                        gameScore += 100; 
                        processRoundSuccess();
                    } else {
                        // 👑 答對其中一步，重新起算下一個數字的 5秒發呆計時
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

    // 👑 任何模式初始化完畢，立刻開啟「5秒全局發呆自動提示機制」
    startGlobalIdleHintTimeout();
    updateCarouselDisplay();
}

function handleMathGridSelection(clickedBtn, isCorrect) {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); 

    if (isCorrect) {
        gameScore += 250;
        document.getElementById('target-display').textContent = mathAnswer;
        processRoundSuccess();
    } else {
        mathWrongCount++;
        clickedBtn.classList.add('shake');
        setTimeout(() => clickedBtn.classList.remove('shake'), 350);

        if (mathWrongCount >= 3) {
            flashAllCorrectAnswersOnce(); // 錯三次直接高亮
        } else {
            startGlobalIdleHintTimeout(); // 未滿三次，重啟5秒發呆提示
        }
    }
}

// 👑 全局核心優化：1秒內快速閃爍5次正確目標（適應全模式）
function flashAllCorrectAnswersOnce() {
    let mode = getRoundMode(currentLevel);
    let targets = [];

    if (mode === 'SEQUENCE') {
        // 數列模式：找出目前還沒被點選的按鈕中，數值最小的那一個
        let remainingBtns = Array.from(document.querySelectorAll('.seq-btn[data-val]'));
        if (remainingBtns.length > 0) {
            remainingBtns.sort((a, b) => parseInt(a.getAttribute('data-val')) - parseInt(b.getAttribute('data-val')));
            targets = [remainingBtns[0]]; // 只提示當前該點的那一個
        }
    } else {
        // 圖形、顏色、心算模式：直接撈取尚未被消除且帶有 data-target-hint 的按鈕
        targets = Array.from(document.querySelectorAll('[data-target-hint="true"]'))
                       .filter(el => !el.classList.contains('eliminated'));
    }

    // 執行同步高亮閃爍（配合 CSS 1秒閃爍5次）
    targets.forEach(targetBtn => {
        targetBtn.classList.remove('flash-hint');
        void targetBtn.offsetWidth; 
        targetBtn.classList.add('flash-hint');
        
        setTimeout(() => {
            targetBtn.classList.remove('flash-hint');
        }, 1000);
    });

    // 👑 閃爍完成後，若該關卡尚未結束，繼續維持 5 秒發呆循環監聽
    startGlobalIdleHintTimeout();
}

// 👑 核心啟動器：閒置 5 秒自動觸發提示
function startGlobalIdleHintTimeout() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
    globalIdleHintTimer = setTimeout(() => {
        flashAllCorrectAnswersOnce();
    }, 5000); // 👑 正式改為 5000 毫秒 (5秒)
}

function handleItemClick(element, isTarget, scoreReward) {
    if (element.classList.contains('eliminated') || element.classList.contains('shake')) return;

    if (isTarget) {
        if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
        element.classList.remove('flash-hint');
        element.classList.add('eliminated');
        clickedCorrectCount++;
        gameScore += scoreReward;

        if (clickedCorrectCount === 3) { 
            processRoundSuccess(); 
        } else {
            // 👑 找到了其中一個目標，重新起算其餘目標的 5秒發呆提示
            startGlobalIdleHintTimeout();
        }
    } else {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 350);
    }
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
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); // 過關立刻切斷計時
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

// 燈箱與按鈕的綁定
const galleryPopup = document.getElementById('gallery-popup');
if (galleryPopup) {
    galleryPopup.addEventListener('click', closeGalleryPopup);
}
const continueBtn = document.getElementById('modal-continue-btn');
if (continueBtn) {
    bindElderTouch(continueBtn, handleModalContinue);
}

// 啟動遊戲與環境閉環
document.addEventListener('DOMContentLoaded', () => {
    createBaseMesh();
    renderThumbBadges();
    initGame();
    startTopBarRotation(); 
    resetIdleTimer();
});
