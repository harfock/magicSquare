import { 
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
let globalIdleHintTimer = null;

// 核心定義：25 關為一輪大滿貫
const TOTAL_ROUNDS = 25;

// === 🎵 聽覺音效模組 (完美破除瀏覽器自動播放限制版) ===
const BUBBLE_SOUND_URL = './soundreality-bubble-pop-424583.mp3'; 
let audioPool = []; 
let poolIndex = 0;
let isAudioInitialized = false; 

function initAudioPool() {
    if (isAudioInitialized) return;
    try {
        // 建立一個音訊集（Audio Pool）防止連續點擊時音效被切斷
        audioPool = Array.from({ length: 5 }, () => {
            const audio = new Audio(BUBBLE_SOUND_URL);
            audio.preload = 'auto';
            return audio;
        });
        isAudioInitialized = true;
    } catch (e) {
        console.error("音效初始化失敗", e);
    }
}

function playPlinkSound() {
    if (!isAudioInitialized) initAudioPool();
    try {
        if (audioPool.length === 0) return;
        const sound = audioPool[poolIndex];
        if (sound) {
            sound.currentTime = 0; 
            sound.muted = false; // 👑 確保解除靜音，讓長輩聽得到
            
            const playPromise = sound.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log("瀏覽器阻擋了有聲播放，啟動靜音解鎖機制...", err);
                    // 👑 備用核心機制：若被阻擋，先靜音播放藉此解鎖音訊軌道，隨後重啟聲音
                    sound.muted = true;
                    sound.play().then(() => {
                        setTimeout(() => {
                            sound.muted = false; // 解鎖成功後立刻恢復聲音
                        }, 50);
                    }).catch(e => console.error("極端狀況下音訊解鎖失敗:", e));
                });
            }
            poolIndex = (poolIndex + 1) % audioPool.length;
        }
    } catch (e) {
        console.error("音效播放失敗", e);
    }
}

// === 🧱 介面排版優化 (完全使用 HTML 現成單一進度條) ===
function applyZenUIModifications() {
    const yard = document.getElementById('construction-yard');
    if (yard) yard.remove();

    const mainContainer = document.getElementById('main-container');
    if (mainContainer) {
        mainContainer.style.display = 'flex';
        mainContainer.style.flexDirection = 'column';
        mainContainer.style.alignItems = 'center';
        mainContainer.style.justifyContent = 'flex-start';
        mainContainer.style.padding = '20px';
    }

    const playArea = document.getElementById('play-area');
    if (playArea) {
        playArea.style.width = '100%';
        playArea.style.maxWidth = '500px';
        playArea.style.margin = '20px auto 0 auto'; 
        playArea.style.backgroundColor = 'rgba(15, 23, 42, 0.45)';
        playArea.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        playArea.style.transition = 'opacity 0.3s ease';
    }
}

function updateZenProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        let currentRoundProgress = ((currentLevel - 1) % TOTAL_ROUNDS);
        let percentage = (currentRoundProgress / TOTAL_ROUNDS) * 100;
        progressBar.style.width = `${percentage}%`;
    }
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

function startTopBarRotation() {
    if (infoRotationTimer) clearInterval(infoRotationTimer);
    updateCarouselDisplay();

    infoRotationTimer = setInterval(() => {
        carouselIndex = (carouselIndex + 1) % 2; 
        updateCarouselDisplay();
    }, 5000);
}

function updateCarouselDisplay() {
    const textSpan = document.getElementById('carousel-text');
    if (!textSpan) return;

    switch(carouselIndex) {
        case 0:
            textSpan.innerHTML = `⭐ 靜心修為: <span style="color: #4CD964; font-size: 18px;">${gameScore}</span>`;
            break;
        case 1:
            textSpan.innerHTML = `🎯 禪定關卡: <span style="color: #5AC8FA; font-size: 18px;">${((currentLevel - 1) % TOTAL_ROUNDS) + 1} / 25</span>`;
            break;
    }
}

function resetIdleTimer() {
    startGlobalIdleHintTimeout();
}

function getRoundMode(level) {
    let pos = (level - 1) % 12 + 1; 
    if (pos <= 3) return 'SHAPE'; 
    if (pos <= 6) return 'MATH';  
    if (pos <= 9) return 'COLOR';               
    return 'SEQUENCE'; 
}

// === 💎 按鈕內高光三軸流動引擎 ===
let bubbleAnimateTimer = null;

function startButtonBubbleFlow() {
    if (bubbleAnimateTimer) cancelAnimationFrame(bubbleAnimateTimer);
    
    function renderFlow() {
        const time = Date.now() * 0.002;
        const buttons = document.querySelectorAll('.shape-box, .num-btn, .color-btn, .seq-btn');
        
        buttons.forEach((btn, index) => {
            const x = Math.sin(time + index * 0.5) * 15;
            const y = Math.cos(time * 0.8 + index * 0.3) * 15;
            const z = Math.sin(time * 0.5 + index * 0.7); 
            const blur = (z + 1) * 3 + 2;
            const opacity = (z + 1) * 0.25 + 0.3; 

            btn.style.setProperty('--bubble-x', `${50 + x}%`);
            btn.style.setProperty('--bubble-y', `${30 + y}%`);
            btn.style.setProperty('--bubble-blur', `${blur}px`);
            btn.style.setProperty('--bubble-opacity', opacity);
        });
        
        bubbleAnimateTimer = requestAnimationFrame(renderFlow);
    }
    renderFlow();
}

// ==========================================================================
// 🌊 全新 Canvas 水晶氣泡炸裂與光影粒子系統 (Splash Engine)
// ==========================================================================
let splashParticles = [];
let activeSplashBubbles = [];

class SplashParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10; 
        this.vy = (Math.random() - 0.5) * 10 - 3; 
        this.radius = Math.random() * 8 + 5; 
        this.alpha = 1.0;
        this.decay = Math.random() * 0.025 + 0.015;
        this.color = color || '#4cd964';
        this.angle = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.15;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.08; 
        this.alpha -= this.decay;
        this.angle += this.rotSpeed;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        let gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, this.color);
        gradient.addColorStop(0.8, 'rgba(2, 27, 51, 0.6)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, this.angle, this.angle + 1.2);
        ctx.stroke();

        ctx.restore();
    }
}

class MegaSplashBubble {
    constructor(x, y, width, height, onComplete) {
        this.startX = x + width / 2;
        this.startY = y + height / 2;
        this.maxRadius = Math.max(width, height) * 0.85; 
        this.currentRadius = Math.min(width, height) * 0.45;
        this.state = 'EXPAND'; 
        this.onComplete = onComplete;
        this.lightAngle = 0; 
    }

    update() {
        this.lightAngle += 0.1; 

        if (this.state === 'EXPAND') {
            this.currentRadius += (this.maxRadius - this.currentRadius) * 0.3;
            if (this.maxRadius - this.currentRadius < 2) {
                this.state = 'CONDENSE'; 
            }
        } else if (this.state === 'CONDENSE') {
            let shrinkTarget = this.maxRadius * 0.3;
            this.currentRadius += (shrinkTarget - this.currentRadius) * 0.4;
            if (this.currentRadius - shrinkTarget < 2) {
                this.state = 'POP';
                for (let i = 0; i < 22; i++) {
                    splashParticles.push(new SplashParticle(this.startX, this.startY, '#4cd964'));
                }
                if (this.onComplete) this.onComplete();
            }
        }
    }

    draw(ctx) {
        if (this.state === 'POP') return;

        ctx.save();
        let gradient = ctx.createRadialGradient(
            this.startX - this.currentRadius * 0.3, this.startY - this.currentRadius * 0.3, this.currentRadius * 0.05,
            this.startX, this.startY, this.currentRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); 
        gradient.addColorStop(0.2, 'rgba(76, 217, 100, 0.45)'); 
        gradient.addColorStop(0.7, 'rgba(10, 78, 122, 0.5)');  
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, this.currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, this.currentRadius * 0.85, this.lightAngle, this.lightAngle + 1.4);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, this.currentRadius * 0.85, this.lightAngle + Math.PI, this.lightAngle + Math.PI + 0.9);
        ctx.stroke();

        ctx.restore();
    }
}

function startSplashCanvasEngine() {
    const canvas = document.getElementById('bubble-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        if(canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    }
    window.addEventListener('resize', resize);
    resize();

    function renderLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        activeSplashBubbles.forEach((bubble, idx) => {
            bubble.update();
            bubble.draw(ctx);
            if (bubble.state === 'POP') activeSplashBubbles.splice(idx, 1);
        });

        splashParticles.forEach((p, idx) => {
            p.update();
            p.draw(ctx);
            if (p.alpha <= 0) splashParticles.splice(idx, 1);
        });

        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
}

function triggerSplashEffect(element, successCallback) {
    const rect = element.getBoundingClientRect();
    
    element.style.transition = 'transform 0.1s ease';
    element.style.transform = 'scale(0)';
    
    setTimeout(() => {
        element.classList.add('eliminated'); 
    }, 100);

    const megaBubble = new MegaSplashBubble(rect.left, rect.top, rect.width, rect.height, successCallback);
    activeSplashBubbles.push(megaBubble);
}

// === 初始化遊玩關卡與核心邏輯 ===
function initGame() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
    applyZenUIModifications();
    updateZenProgressBar();

    const playArea = document.getElementById('play-area');
    const targetDisplay = document.getElementById('target-display');
    const instruction = document.getElementById('game-instruction');
    if (!playArea || !targetDisplay) return;

    playArea.innerHTML = '';
    let mode = getRoundMode(currentLevel);

    if (mode === 'SHAPE') {
        instruction.innerHTML = '請找出 <span style="color: #FCD34D;">三個</span> 指定形狀：';
        playArea.className = "grid-shape-mode"; 
        clickedCorrectCount = 0;

        currentTargetShape = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
        targetDisplay.innerHTML = SHAPE_TEMPLATES[currentTargetShape];

        let spawnPool = [];
        for (let i = 0; i < 3; i++) { spawnPool.push({ type: currentTargetShape, isTarget: true }); }
        const wrongTypes = SHAPE_TYPES.filter(type => type !== currentTargetShape);
        for (let i = 0; i < 6; i++) {
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
        clickedCorrectCount = 0;

        currentTargetColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        targetDisplay.innerHTML = `<div class="color-target-preview" style="background-color: ${currentTargetColor}"></div>`;

        let spawnPool = [];
        for (let i = 0; i < 3; i++) { spawnPool.push({ color: currentTargetColor, isTarget: true }); }
        const wrongColors = COLOR_PALETTE.filter(c => c !== currentTargetColor);
        for (let i = 0; i < 6; i++) {
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
            
            btn.style.background = `linear-gradient(135deg, ${item.color} 30%, rgba(0,0,0,0.1) 100%)`;
            bindElderTouch(btn, () => handleItemClick(btn, item.isTarget, 200)); 
            playArea.appendChild(btn);
        });

    } else if (mode === 'SEQUENCE') {
        instruction.innerHTML = '請依序 <span style="color: #34D399;">由小到大</span> 點選以下數字：';
        playArea.className = "grid-sequence-mode";
        targetDisplay.textContent = "123"; 

        let numSet = new Set();
        while(numSet.size < 9) {
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
                if (seqBtn.classList.contains('eliminated') || seqBtn.style.transform === 'scale(0)') return;
                let correctNextValue = sortedNumbers[nextExpectedIndex];
                
                if (num === correctNextValue) {
                    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);

                    playPlinkSound(); 
                    gameScore += 50;
                    nextExpectedIndex++;

                    triggerSplashEffect(seqBtn, () => {
                        seqBtn.classList.add('completed');
                        seqBtn.removeAttribute('data-val'); 
                        if (nextExpectedIndex === 9) { 
                            gameScore += 150; 
                            processRoundSuccess();
                        } else {
                            startGlobalIdleHintTimeout();
                        }
                    });
                } else {
                    seqBtn.classList.add('shake');
                    setTimeout(() => seqBtn.classList.remove('shake'), 350);
                }
            });

            playArea.appendChild(seqBtn);
        });
    }

    startButtonBubbleFlow();
    startGlobalIdleHintTimeout();
    updateCarouselDisplay();
}

function handleItemClick(element, isTarget, scoreReward) {
    if (element.classList.contains('eliminated') || element.classList.contains('shake') || element.style.transform === 'scale(0)') return;

    if (isTarget) {
        if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
        
        playPlinkSound(); 
        gameScore += scoreReward;

        triggerSplashEffect(element, () => {
            clickedCorrectCount++;
            if (clickedCorrectCount === 3) { 
                processRoundSuccess(); 
            } else {
                startGlobalIdleHintTimeout();
            }
        });
    } else {
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 350);
    }
}

function handleMathGridSelection(clickedBtn, isCorrect) {
    if (clickedBtn.classList.contains('eliminated') || clickedBtn.style.transform === 'scale(0)') return;
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); 

    if (isCorrect) {
        playPlinkSound(); 
        gameScore += 250;
        document.getElementById('target-display').textContent = mathAnswer;
        
        triggerSplashEffect(clickedBtn, () => {
            processRoundSuccess();
        });
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
    try {
        const playArea = document.getElementById('play-area');
        if (!playArea) return;

        let mode = getRoundMode(currentLevel);
        let targets = [];

        if (mode === 'SEQUENCE') {
            let remainingBtns = Array.from(document.querySelectorAll('.seq-btn[data-val]'));
            if (remainingBtns.length > 0) {
                remainingBtns.sort((a, b) => {
                    let valA = parseInt(a.getAttribute('data-val')) || 0;
                    let valB = parseInt(b.getAttribute('data-val')) || 0;
                    return valA - valB;
                });
                targets = [remainingBtns[0]]; 
            }
        } else {
            targets = Array.from(document.querySelectorAll('[data-target-hint="true"]'))
                           .filter(el => el && !el.classList.contains('eliminated'));
        }

        targets.forEach(targetBtn => {
            if (!targetBtn) return;
            targetBtn.classList.add('flash-hint');
            setTimeout(() => {
                if (targetBtn) targetBtn.classList.remove('flash-hint');
            }, 1500);
        });

    } catch (error) {
        console.error("提示動畫攔截安全關閉:", error);
    } finally {
        startGlobalIdleHintTimeout();
    }
}

function startGlobalIdleHintTimeout() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer);
    globalIdleHintTimer = setTimeout(() => {
        flashAllCorrectAnswersOnce();
    }, 5000); 
}

function processRoundSuccess() {
    if (globalIdleHintTimer) clearTimeout(globalIdleHintTimer); 
    objectsBuiltCount++; 
    currentLevel++;
    updateZenProgressBar();
    setTimeout(() => { triggerTransitionModal(); }, 500);
}

function triggerTransitionModal() {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const continueBtn = document.getElementById('modal-continue-btn');
    if(!overlay || !title || !desc || !continueBtn) return;

    if ((currentLevel - 1) % TOTAL_ROUNDS === 0) {
        title.innerHTML = `<span style="font-size: 80px; display: block; margin-bottom: 20px;">👍</span> 禪定圓滿 功德無量`;
        desc.innerHTML = `恭喜您成功通過 <span style="color: #5ac8fa; font-weight: bold;">25 輪</span> 深度心靈禪意挑戰！<br><br>在此奉上至高無上的讚譽，願您內心平靜安寧，思緒清明。請按下下方按鈕，重新開展新一輪的智慧智慧之旅。`;
        
        continueBtn.textContent = "重新開始靜心之旅";
        continueBtn.style.display = 'block';
        overlay.style.display = 'flex';
    } else {
        let prevMode = getRoundMode(currentLevel - 1);
        if (prevMode === 'MATH') { title.textContent = `🧠 心算活化成功`; } 
        else if (prevMode === 'COLOR') { title.textContent = `🎨 色彩感知成功`; } 
        else if (prevMode === 'SEQUENCE') { title.textContent = `🔢 數字邏輯成功`; } 
        else { title.textContent = `🧱 視覺消除成功`; }
        
        desc.textContent = `思緒更臻澄明...`;
        continueBtn.style.display = 'none'; 
        overlay.style.display = 'flex';
        
        setTimeout(() => {
            overlay.style.display = 'none';
            initGame();
        }, 1200);
    }
}

function handleModalContinue() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-continue-btn').style.display = 'none';
    objectsBuiltCount = 0; 
    initGame();
}

// === 初始化與互動綁定 ===
function handleFirstUserInteraction() {
    initAudioPool();   
    resetIdleTimer();  
    // 👑 首觸即主動執行一次空播放，徹底打通瀏覽器限制
    if (audioPool.length > 0) {
        audioPool[0].play().catch(() => {});
    }
    window.removeEventListener('click', handleFirstUserInteraction);
    window.removeEventListener('touchstart', handleFirstUserInteraction);
}

window.addEventListener('click', handleFirstUserInteraction);
window.addEventListener('touchstart', handleFirstUserInteraction);
window.addEventListener('touchmove', resetIdleTimer);

document.addEventListener('DOMContentLoaded', () => {
    applyZenUIModifications();  
    initGame();                
    startTopBarRotation(); 
    resetIdleTimer();
    startSplashCanvasEngine(); 
    
    const continueBtn = document.getElementById('modal-continue-btn');
    if (continueBtn) {
        bindElderTouch(continueBtn, handleModalContinue);
    }
});