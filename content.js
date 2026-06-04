(function initializeSystem() {
    if (document.getElementById('focus-anchor-host')) return;

    // ==========================================
    // 區塊 1：建立懸浮視窗 (Shadow DOM)
    // ==========================================
    const host = document.createElement('div');
    host.id = 'focus-anchor-host';
    host.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2147483647; user-select: none;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            :host {
                --widget-bg: #ffffff; --btn-bg: #f0f0f0; --btn-hover: #e0e0e0;
                --block-0: #e0e0e0; --block-1: #ffd54f; --block-2: #81c784; 
                --block-3: #8d6e63; --block-4: #A9D9D5; --icon-color: #555555;
            }
            :host([data-theme="dark"]) {
                --widget-bg: #1e1e1e; --btn-bg: #333333; --btn-hover: #4d4d4d;
                --block-0: #333333; --block-1: #d4a319; --block-2: #4e9a51; 
                --block-3: #6a4a3e; --block-4: #24A0BF; --icon-color: #e0e0e0;
            }

            #widget {
                background: var(--widget-bg); padding: 12px; border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.15); display: flex; flex-direction: column; 
                gap: 12px; align-items: center; transition: background 0.3s, padding 0.3s;
                cursor: grab;
            }
            #widget:active { cursor: grabbing; }
            
            /* 核心修正：加入 !important 強制切斷 JS 的內聯樣式干擾 */
            #widget.minimized { padding: 0; background: transparent; box-shadow: none; }
            #widget.minimized .controls, 
            #widget.minimized #prevBlock { display: none !important; }
            
            .blocks-row { display: flex; gap: 8px; }
            .status-block {
                width: 45px; height: 45px; border-radius: 10px; background: var(--block-0); 
                transition: background 0.3s, transform 0.2s; cursor: pointer;
            }
            #widget.minimized #currBlock { width: 24px; height: 24px; border-radius: 50%; opacity: 0.8; }
            #widget.minimized #currBlock:hover { opacity: 1; transform: scale(1.1); }
            
            .state-0 { background: var(--block-0); }
            .state-1 { background: var(--block-1); box-shadow: 0 0 10px rgba(255, 213, 79, 0.4); }
            .state-2 { background: var(--block-2); }
            .state-3 { background: var(--block-3); }
            .state-4 { background: var(--block-4); cursor: default; }
            .state-5 { background: transparent; border: 2px dashed var(--block-1); box-sizing: border-box; cursor: default; }
            
            .controls { display: flex; gap: 6px; cursor: default; }
            button { 
                width: 32px; height: 32px; border: none; border-radius: 6px; 
                background: var(--btn-bg); color: var(--icon-color); 
                cursor: pointer; transition: background 0.2s;
            }
            button:hover { background: var(--btn-hover); }
        </style>
        
        <div id="widget" style="display: none;">
            <div class="blocks-row">
                <div class="status-block" id="prevBlock" title="評價上一輪狀態" style="display: none;"></div>
                <div class="status-block" id="currBlock" title="點擊縮小/展開"></div>
            </div>
            <div class="controls">
                <button id="startBtn" title="啟動">▶</button>
                <button id="restBtn" title="休息">☕</button>
                <button id="resetBtn" title="重置">🔄</button>
            </div>
        </div>
    `;

    const widget = shadow.getElementById('widget');
    const prevBlock = shadow.getElementById('prevBlock');
    const currBlock = shadow.getElementById('currBlock');

    // 拖曳定位邏輯
    let isDragging = false;
    let startX, startY;
    let hasMoved = false;

    widget.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'button') return;
        isDragging = true;
        hasMoved = false;

        const rect = host.getBoundingClientRect();
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        host.style.left = rect.left + 'px';
        host.style.top = rect.top + 'px';

        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        hasMoved = true;
        host.style.left = (e.clientX - startX) + 'px';
        host.style.top = (e.clientY - startY) + 'px';
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // 點擊交互 (縮放與評價)
    currBlock.addEventListener('click', () => {
        if (hasMoved) return;
        widget.classList.toggle('minimized');
    });

    prevBlock.addEventListener('click', (e) => {
        if (hasMoved) return;
        const el = e.target;
        let s = parseInt(el.dataset.state);
        const idx = parseInt(el.dataset.index);

        if (isNaN(s) || isNaN(idx)) return;
        if (s === 0 || s === 4 || s === 5) return;

        if (s === 1 || s === 3) s = 2;
        else if (s === 2) s = 3;

        chrome.storage.local.get(['blocksState'], (data) => {
            let blocks = data.blocksState || [];
            if (blocks[idx] !== undefined) {
                blocks[idx] = s;
                chrome.storage.local.set({ blocksState: blocks });
            }
        });
    });

    // 渲染陣列與環境同步
    function renderBlocks(blocks) {
        if (!blocks || blocks.length === 0) blocks = [0];
        const len = blocks.length;

        const currState = blocks[len - 1];
        currBlock.className = `status-block state-${currState}`;
        currBlock.dataset.index = len - 1;
        currBlock.dataset.state = currState;

        if (len >= 2) {
            const prevState = blocks[len - 2];
            prevBlock.style.display = 'block';
            prevBlock.className = `status-block state-${prevState}`;
            prevBlock.dataset.index = len - 2;
            prevBlock.dataset.state = prevState;
        } else {
            prevBlock.style.display = 'none';
        }
    }

    chrome.storage.local.get(['blocksState', 'theme'], (data) => {
        if (data.theme === 'dark') host.setAttribute('data-theme', 'dark');
        renderBlocks(data.blocksState);
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.theme) {
            if (changes.theme.newValue === 'dark') host.setAttribute('data-theme', 'dark');
            else host.removeAttribute('data-theme');
        }
        if (changes.blocksState) {
            renderBlocks(changes.blocksState.newValue);
        }
    });

    // 按鈕訊號
    shadow.getElementById('startBtn').addEventListener('click', () => {
        chrome.storage.local.get(['duration', 'blocksState'], (data) => {
            const duration = data.duration || 20;
            let blocks = data.blocksState || [];
            if (blocks.length === 0 || blocks[blocks.length - 1] !== 1) {
                if (blocks.length > 0 && blocks[blocks.length - 1] === 0) blocks[blocks.length - 1] = 1;
                else blocks.push(1);
            }
            chrome.storage.local.set({ blocksState: blocks });
            chrome.runtime.sendMessage({ action: 'START_TIMER', duration: duration, endTime: Date.now() + duration * 60 * 1000 });
        });
    });

    shadow.getElementById('resetBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'STOP_TIMER' });
        chrome.storage.local.get(['blocksState'], (data) => {
            let blocks = data.blocksState || [];
            if (blocks.length > 0 && blocks[blocks.length - 1] === 1) blocks[blocks.length - 1] = 0;
            chrome.storage.local.set({ blocksState: blocks });
        });
    });

    shadow.getElementById('restBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'STOP_TIMER' });
        chrome.storage.local.get(['isRunning', 'endTime', 'duration', 'blocksState'], (data) => {
            let blocks = data.blocksState || [];
            if (data.isRunning && data.endTime) {
                const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
                const total = (data.duration || 20) * 60;
                if ((total - remaining) < 300) blocks[blocks.length - 1] = 0;
                else blocks[blocks.length - 1] = 5;
            }
            const lastIdx = blocks.length - 1;
            if (blocks[lastIdx] === 0) blocks.splice(lastIdx, 0, 4);
            else { blocks.push(4); blocks.push(0); }
            chrome.storage.local.set({ blocksState: blocks });
        });
    });

    // 視覺斷裂機制
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "SHOW_WIDGET") {
            widget.style.display = 'flex';
            widget.classList.remove('minimized');
        }
        if (msg.action === "TIME_UP") {
            if (document.getElementById('focus-alert-overlay')) return;
            chrome.storage.local.get(['theme'], (data) => {
                const isDark = data.theme === 'dark';
                const style = document.createElement('style');
                style.innerHTML = `
                    #focus-alert-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: transparent; z-index: 2147483647; pointer-events: none; }
                    .focus-particle { position: absolute; bottom: -40px; animation: ${isDark ? 'firefly-rise' : 'leaf-rise'} ease-in-out infinite; }
                    .focus-leaf { width: 24px; height: 24px; background-color: rgba(76, 175, 80, 0.7); border-radius: 50% 0 50% 0; }
                    .focus-firefly { width: 5px; height: 5px; background-color: #e6ffb3; border-radius: 50%; box-shadow: 0 0 10px 4px rgba(180, 255, 100, 0.4); }
                    @keyframes leaf-rise { 0% { transform: translateY(0) scale(var(--scale)) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 75% { opacity: 0.7; } 100% { transform: translateY(-110vh) scale(var(--scale)) rotate(540deg); opacity: 0; } }
                    @keyframes firefly-rise { 0% { transform: translateY(0) translateX(0) scale(var(--scale)); opacity: 0; box-shadow: 0 0 0px 0px rgba(180,255,100,0); } 20% { opacity: var(--max-opacity); box-shadow: 0 0 12px 4px rgba(180,255,100,0.6); } 50% { opacity: 0.2; transform: translateY(-50vh) translateX(var(--drift)) scale(var(--scale)); box-shadow: 0 0 2px 1px rgba(180,255,100,0.2); } 80% { opacity: var(--max-opacity); box-shadow: 0 0 12px 4px rgba(180,255,100,0.6); } 100% { transform: translateY(-110vh) translateX(calc(var(--drift) * -1)) scale(var(--scale)); opacity: 0; } }
                `;
                document.head.appendChild(style);
                const overlay = document.createElement('div');
                overlay.id = 'focus-alert-overlay';
                for (let i = 0; i < 60; i++) {
                    const p = document.createElement('div');
                    p.className = `focus-particle ${isDark ? 'focus-firefly' : 'focus-leaf'}`;
                    p.style.left = Math.random() * 100 + '%';
                    p.style.setProperty('--scale', Math.random() * 0.5 + 0.5);
                    p.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
                    p.style.setProperty('--max-opacity', Math.random() * 0.6 + 0.4);
                    p.style.animationDuration = (Math.random() * 3 + 3) + 's';
                    p.style.animationDelay = (Math.random() * 2) + 's';
                    overlay.appendChild(p);
                }
                document.body.appendChild(overlay);
                const dismiss = () => { if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); style.parentNode.removeChild(style); } ['mousemove', 'click', 'keydown'].forEach(e => document.removeEventListener(e, dismiss)); };
                setTimeout(() => { ['mousemove', 'click', 'keydown'].forEach(e => document.addEventListener(e, dismiss)); }, 1200);
            });
        }
    });
})();