const themeToggle = document.getElementById('themeToggle');
const grid = document.getElementById('blockGrid');
const minutesInput = document.getElementById('minutesInput');
const displayTime = document.getElementById('displayTime');
const startBtn = document.getElementById('startBtn');
const restBtn = document.getElementById('restBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const pinBtn = document.getElementById('pinBtn');

let localTimerInterval;
let blocksState = [];

// 初始化
chrome.storage.local.get(['theme', 'endTime', 'isRunning', 'duration', 'blocksState'], (data) => {
    if (data.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
    if (data.blocksState && data.blocksState.length > 0) {
        blocksState = data.blocksState;
        blocksState.forEach(state => createBlockElement(state));
    } else {
        addBlock(0);
    }
    if (data.duration) minutesInput.value = data.duration;

    if (data.isRunning && data.endTime) {
        const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
        if (remaining > 0) startLocalTick(data.endTime);
        else { updateDisplay(0); chrome.storage.local.set({ isRunning: false }); }
    } else {
        updateDisplay(minutesInput.value * 60);
    }
});

function updateDisplay(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    displayTime.textContent = `${m}:${s}`;
}

function startLocalTick(endTime) {
    clearInterval(localTimerInterval);
    localTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        updateDisplay(remaining);
        if (remaining <= 0) {
            clearInterval(localTimerInterval);
            // 核心修正：避免與背景引擎重複新增方格
            if (blocksState.length === 0 || blocksState[blocksState.length - 1] !== 0) {
                addBlock(0);
            }
        }
    }, 1000);
}

function saveBlocks() { chrome.storage.local.set({ blocksState }); }

function createBlockElement(state) {
    const block = document.createElement('div');
    block.className = `block state-${state}`;
    block.dataset.state = state;
    block.dataset.index = grid.children.length;

    block.addEventListener('click', function () {
        let s = parseInt(this.dataset.state);
        if (s === 0 || s === 4 || s === 5) return;
        if (s === 1 || s === 3) s = 2;
        else if (s === 2) s = 3;
        this.dataset.state = s;
        this.className = `block state-${s}`;
        blocksState[this.dataset.index] = s;
        saveBlocks();
    });
    grid.appendChild(block);
}

function addBlock(state) {
    blocksState.push(state);
    createBlockElement(state);
    saveBlocks();
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.toggleAttribute('data-theme', !isDark);
    chrome.storage.local.set({ theme: isDark ? 'light' : 'dark' });
});

startBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isRunning'], (data) => {
        if (data.isRunning) return;
        if (blocksState.length > 0 && blocksState[blocksState.length - 1] === 0) {
            const lastIdx = blocksState.length - 1;
            blocksState[lastIdx] = 1;
            grid.children[lastIdx].className = 'block state-1';
            grid.children[lastIdx].dataset.state = 1;
            saveBlocks();
        }
        const duration = minutesInput.value;
        const endTime = Date.now() + duration * 60 * 1000;
        chrome.storage.local.set({ isRunning: true, duration: duration, endTime: endTime });
        chrome.alarms.create("focusTimer", { delayInMinutes: parseFloat(duration) });
        startLocalTick(endTime);
    });
});

resetBtn.addEventListener('click', () => {
    clearInterval(localTimerInterval);
    chrome.alarms.clear("focusTimer");
    chrome.storage.local.set({ isRunning: false, endTime: null });
    updateDisplay(minutesInput.value * 60);
    if (blocksState.length > 0 && blocksState[blocksState.length - 1] === 1) {
        const lastIdx = blocksState.length - 1;
        blocksState[lastIdx] = 0;
        grid.children[lastIdx].className = 'block state-0';
        grid.children[lastIdx].dataset.state = 0;
        saveBlocks();
    }
});

restBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isRunning', 'endTime'], (data) => {
        if (data.isRunning && data.endTime) {
            clearInterval(localTimerInterval);
            chrome.alarms.clear("focusTimer");
            chrome.storage.local.set({ isRunning: false, endTime: null });
            updateDisplay(minutesInput.value * 60);

            const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
            const total = minutesInput.value * 60;
            const elapsed = total - remaining;

            const lastIdx = blocksState.length - 1;
            if (elapsed < 300) {
                blocksState[lastIdx] = 0;
                grid.children[lastIdx].className = 'block state-0';
                grid.children[lastIdx].dataset.state = 0;
            } else {
                blocksState[lastIdx] = 5;
                grid.children[lastIdx].className = 'block state-5';
                grid.children[lastIdx].dataset.state = 5;
            }
        }
        const lastIdx = blocksState.length - 1;
        if (blocksState[lastIdx] === 0) {
            blocksState.splice(lastIdx, 0, 4);
            grid.innerHTML = '';
            blocksState.forEach(s => createBlockElement(s));
        } else {
            addBlock(4); addBlock(0);
        }
        saveBlocks();
    });
});

clearBtn.addEventListener('click', () => {
    clearInterval(localTimerInterval);
    chrome.alarms.clear("focusTimer");
    chrome.storage.local.set({ isRunning: false, endTime: null });
    updateDisplay(minutesInput.value * 60);
    grid.innerHTML = '';
    blocksState = [];
    addBlock(0);
});

pinBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "SHOW_WIDGET" }).catch(err => {
                alert("無法在此網頁呼叫懸浮窗，請確認這是一般網頁，並按下 F5 重新整理後再試一次。");
            });
        }
    });
});