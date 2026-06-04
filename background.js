chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "focusTimer") {

        // 1. 核心修正：將「結算方格」的紀錄直接寫入底層資料庫
        chrome.storage.local.get(['blocksState'], (data) => {
            let blocks = data.blocksState || [];
            // 如果最後一個方塊不是 0（代表還沒被結算），就推入一個灰格 0
            if (blocks.length === 0 || blocks[blocks.length - 1] !== 0) {
                blocks.push(0);
            }
            // 更新狀態：停止計時，並儲存方格
            chrome.storage.local.set({ isRunning: false, blocksState: blocks });
        });

        // 2. 觸發系統原生通知
        try {
            chrome.notifications.create({
                type: "basic", iconUrl: "icon.png", title: "時間到", message: "請上色與結算。", priority: 2
            });
        } catch (e) {
            console.log("通知發送失敗，但不影響視覺干擾");
        }

        // 3. 呼叫網頁端：觸發視覺斷裂
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && !currentTab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(currentTab.id, { action: "TIME_UP" }).catch(err => {
                    console.log('無法喚醒網頁', err);
                });
            }
        });
    }
});

// 接收來自懸浮視窗或面板的控制指令
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'START_TIMER') {
        chrome.storage.local.set({ isRunning: true, endTime: request.endTime, duration: request.duration });
        chrome.alarms.create("focusTimer", { delayInMinutes: parseFloat(request.duration) });
    } else if (request.action === 'STOP_TIMER') {
        chrome.alarms.clear("focusTimer");
        chrome.storage.local.set({ isRunning: false, endTime: null });
    }
});