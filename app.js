// --- 設定・状態管理 ---
let scheduleData = [];
let currentDayId = "";
let currentTag = "all";
let availableTags = new Set();
let isInitialLoad = true;
let showDayEndedMessage = false;

// --- デバッグ（時間操作）機能 ---
let timeMultiplier = 1;
let virtualEpoch = null;
let realEpoch = null;

function getNow() {
    if (!virtualEpoch || !realEpoch) {
        return new Date();
    }
    const realElapsed = Date.now() - realEpoch;
    return new Date(virtualEpoch + realElapsed * timeMultiplier);
}

function initDebugTool() {
    const debugPanel = document.getElementById("debug-panel");
    const urlParams = new URLSearchParams(window.location.search);
    const hasDebugHash = window.location.hash === '#debug';
    
    // URLに ?debug=true または #debug がある場合のみ有効化
    if (urlParams.get('debug') === 'true' || hasDebugHash) {
        debugPanel.classList.add("active");
    } else {
        return; // 無効な場合は処理しない
    }

    const timeInput = document.getElementById("debug-time");
    const speedCheck = document.getElementById("debug-speed");
    const applyBtn = document.getElementById("debug-apply");
    const resetBtn = document.getElementById("debug-reset");
    const display = document.getElementById("debug-now-display");

    setInterval(() => {
        const now = getNow();
        display.innerHTML = `${now.toLocaleDateString("ja-JP")} <br> ${now.toLocaleTimeString("ja-JP")}`;
    }, 100);

    applyBtn.addEventListener("click", () => {
        if (timeInput.value) {
            virtualEpoch = new Date(timeInput.value).getTime();
        } else {
            virtualEpoch = Date.now();
        }
        realEpoch = Date.now();
        timeMultiplier = speedCheck.checked ? 30 : 1;

        isInitialLoad = true;
        determineInitialTab();
        renderTabs();
        renderSchedule(true);
    });

    resetBtn.addEventListener("click", () => {
        virtualEpoch = null;
        realEpoch = null;
        timeMultiplier = 1;
        timeInput.value = "";
        speedCheck.checked = false;

        isInitialLoad = true;
        determineInitialTab();
        renderTabs();
        renderSchedule(true);
    });
}

// --- 初期化処理 ---
document.addEventListener("DOMContentLoaded", () => {
    initDebugTool();

    fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error("データの読み込みに失敗しました");
            return response.json();
        })
        .then(data => {
            scheduleData = data;
            if(scheduleData.length > 0) {
                currentDayId = scheduleData[0].dateId; 
                extractTags();
                determineInitialTab(); 
                
                renderTabs();
                renderTagFilters();
                renderSchedule();

                setInterval(checkScheduleProgress, 1000);
            }
        })
        .catch(error => {
            document.getElementById("timeline-container").innerHTML = `<div class="empty-message">番組表データを読み込めませんでした。</div>`;
            console.error(error);
        });
});

function extractTags() {
    availableTags.clear();
    scheduleData.forEach(day => {
        day.programs.forEach(program => {
            let tagsArray = [];
            if (Array.isArray(program.tags)) {
                tagsArray = program.tags;
            } else if (typeof program.tags === 'string') {
                tagsArray = program.tags.split(',').map(t => t.trim()).filter(t => t);
            }
            program.tags = tagsArray;
            tagsArray.forEach(tag => availableTags.add(tag));
        });
    });
}

function determineInitialTab() {
    const now = getNow();
    // JSTの YYYY-MM-DD を取得するためパース
    const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayString = nowJst.toISOString().split('T')[0];
    
    let matchedDayIndex = scheduleData.findIndex(day => day.dateString === todayString);
    
    if (matchedDayIndex !== -1) {
        currentDayId = scheduleData[matchedDayIndex].dateId;
        
        const dayPrograms = scheduleData[matchedDayIndex].programs;
        if (dayPrograms.length > 0) {
            const lastProgram = dayPrograms[dayPrograms.length - 1];
            const lastEndTime = new Date(lastProgram.endTime);
            
            if (now >= lastEndTime) {
                if (matchedDayIndex < scheduleData.length - 1) {
                    currentDayId = scheduleData[matchedDayIndex + 1].dateId;
                    showDayEndedMessage = true;
                }
            }
        }
    } else {
        currentDayId = scheduleData[0].dateId; 
    }
}

function checkScheduleProgress() {
    const now = getNow();
    const currentIndex = scheduleData.findIndex(d => d.dateId === currentDayId);
    if (currentIndex === -1) return;

    const currentDayData = scheduleData[currentIndex];
    const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayString = nowJst.toISOString().split('T')[0];
    
    if (currentDayData.dateString === todayString) {
        const dayPrograms = currentDayData.programs;
        if (dayPrograms.length > 0) {
            const lastProgram = dayPrograms[dayPrograms.length - 1];
            const lastEndTime = new Date(lastProgram.endTime);
            
            if (now >= lastEndTime && currentIndex < scheduleData.length - 1) {
                currentDayId = scheduleData[currentIndex + 1].dateId;
                showDayEndedMessage = true;
                isInitialLoad = true;
                currentTag = "all";
                
                renderTabs();
                renderTagFilters();
                renderSchedule();
                return;
            }
        }
    }
    renderSchedule(false);
}

function renderTabs() {
    const container = document.getElementById("tabs-container");
    container.innerHTML = "";
    
    scheduleData.forEach(day => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${day.dateId === currentDayId ? "active" : ""}`;
        btn.textContent = day.dateLabel;
        btn.onclick = () => handleTabClick(day.dateId);
        container.appendChild(btn);
    });
}

function renderTagFilters() {
    const container = document.getElementById("filters-container");
    container.innerHTML = "";
    
    const allBtn = document.createElement("button");
    allBtn.className = `filter-btn ${currentTag === "all" ? "active" : ""}`;
    allBtn.textContent = "すべて表示";
    allBtn.onclick = () => handleTagClick("all");
    container.appendChild(allBtn);
    
    Array.from(availableTags).sort().forEach(tag => {
        const btn = document.createElement("button");
        btn.className = `filter-btn ${currentTag === tag ? "active" : ""}`;
        btn.textContent = tag;
        btn.onclick = () => handleTagClick(tag);
        container.appendChild(btn);
    });
}

function handleTabClick(dateId) {
    if (currentDayId === dateId) return;
    currentDayId = dateId;
    isInitialLoad = false;
    showDayEndedMessage = false;
    
    renderTabs();
    renderSchedule();
}

function handleTagClick(tag) {
    if (currentTag === tag) return;
    currentTag = tag;
    isInitialLoad = false;
    
    renderTagFilters();
    renderSchedule();
}

function renderSchedule(autoScroll = isInitialLoad) {
    const msgContainer = document.getElementById("message-container");
    const container = document.getElementById("timeline-container");
    container.innerHTML = "";
    
    if (showDayEndedMessage) {
        msgContainer.innerHTML = `<div class="system-message">本日の番組は終了しました。翌日の番組表を表示しています。</div>`;
        showDayEndedMessage = false;
    } else {
        msgContainer.innerHTML = "";
    }

    const dayData = scheduleData.find(d => d.dateId === currentDayId);
    if (!dayData) return;
    
    const now = getNow();
    const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayString = nowJst.toISOString().split('T')[0];
    
    let currentOrNextFound = false;
    let isCurrentlyOnAir = false;

    if (dayData.dateString === todayString) {
        isCurrentlyOnAir = dayData.programs.some(p => {
            return now >= new Date(p.startTime) && now < new Date(p.endTime);
        });
    }

    const filteredPrograms = dayData.programs.filter(p => {
        if (currentTag === "all") return true;
        return p.tags && p.tags.includes(currentTag);
    });

    if (filteredPrograms.length === 0) {
        container.innerHTML = `<div class="empty-message">該当する番組がありません。</div>`;
        return;
    }

    let prepCardInserted = false;

    filteredPrograms.forEach((program) => {
        const progStart = new Date(program.startTime);
        const progEnd = new Date(program.endTime); 

        let isCurrent = false;

        if (dayData.dateString === todayString) {
            if (now >= progStart && now < progEnd) {
                isCurrent = true;
                currentOrNextFound = true;
            } else if (!isCurrentlyOnAir && now < progStart && !prepCardInserted) {
                const prepCard = document.createElement("div");
                prepCard.className = "prep-card";
                prepCard.id = "target-program"; 
                
                prepCard.innerHTML = `
                    <div class="prep-card-content">
                        <div class="prep-card-title">⏳ 現在、ステージ準備中です</div>
                        <div class="prep-card-next">
                            次回は <strong>${program.time}</strong> より<br>
                            <strong>「${program.title}」</strong> をお届けします！
                        </div>
                    </div>
                `;
                container.appendChild(prepCard);
                prepCardInserted = true;
                currentOrNextFound = true;
            }
        }

        const card = document.createElement("div");
        card.className = `program-card ${isCurrent ? "is-current" : ""}`;
        
        if (isCurrent) {
            card.id = "target-program";
        }
        
        let tagsHtml = "";
        if (program.tags && program.tags.length > 0) {
            tagsHtml = `<div class="tags">
                ${program.tags.map(t => `<span class="tag">${t}</span>`).join("")}
            </div>`;
        }

        let subtitleHtml = "";
        if (program.subtitle && program.subtitle !== "nan" && program.subtitle.trim() !== "") {
            subtitleHtml = `<div class="subtitle">${program.subtitle}</div>`;
        }

        card.innerHTML = `
            ${isCurrent ? '<div class="current-badge">ON AIR</div>' : ''}
            <div class="time">${program.time}</div>
            <div class="title">${program.title}</div>
            ${subtitleHtml}
            <div class="description">${program.description}</div>
            ${tagsHtml}
        `;
        
        container.appendChild(card);
    });

    if (autoScroll && currentOrNextFound) {
        setTimeout(() => {
            const targetEl = document.getElementById('target-program');
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
    
    isInitialLoad = false;
}
