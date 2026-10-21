// --- 設定・状態管理 ---
let scheduleData = [];
let currentDayId = "";
let currentTag = "all";
let availableTags = new Set();
let isInitialLoad = true;
let showDayEndedMessage = false;

// ★テスト用現在時刻（本番環境では空文字列 "" にしてください）
// 例: "2026-10-23T11:45:00+09:00"（11:30終了の次が12:00開始の場合の準備中テスト等）
const DEBUG_NOW = ""; 

function getNow() {
    return DEBUG_NOW ? new Date(DEBUG_NOW) : new Date();
}

// --- 初期化処理 ---
document.addEventListener("DOMContentLoaded", () => {
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

                // 1分ごとに現在時刻と番組の進行状況をチェック
                setInterval(checkScheduleProgress, 60000);
            }
        })
        .catch(error => {
            document.getElementById("timeline-container").innerHTML = `<div class="empty-message">番組表データを読み込めませんでした。</div>`;
            console.error(error);
        });
});

// データの全番組からタグを自動抽出
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

// 初期表示する日付タブを判定し、終了していれば翌日へ遷移
function determineInitialTab() {
    const now = getNow();
    const todayString = now.toISOString().split('T')[0];
    
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

// 定期実行：日跨ぎや番組切替が発生したかチェック
function checkScheduleProgress() {
    const now = getNow();
    const currentIndex = scheduleData.findIndex(d => d.dateId === currentDayId);
    if (currentIndex === -1) return;

    const currentDayData = scheduleData[currentIndex];
    
    if (currentDayData.dateString === now.toISOString().split('T')[0]) {
        const dayPrograms = currentDayData.programs;
        if (dayPrograms.length > 0) {
            const lastProgram = dayPrograms[dayPrograms.length - 1];
            const lastEndTime = new Date(lastProgram.endTime);
            
            // 最後の番組が終わった瞬間に翌日へ遷移
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
    
    // 定期チェックでON AIR/準備中表示を更新（スクロールはさせない）
    renderSchedule(false);
}

// タブUIの生成
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

// タグフィルターUIの生成
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

// タブのクリック処理
function handleTabClick(dateId) {
    if (currentDayId === dateId) return;
    currentDayId = dateId;
    isInitialLoad = false;
    showDayEndedMessage = false;
    
    renderTabs();
    renderSchedule();
}

// タグのクリック処理
function handleTagClick(tag) {
    if (currentTag === tag) return;
    currentTag = tag;
    isInitialLoad = false;
    
    renderTagFilters();
    renderSchedule();
}

// 番組表の描画
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
    let currentOrNextFound = false;
    let isCurrentlyOnAir = false;

    // 現在ON AIR中の番組があるかチェック
    if (dayData.dateString === now.toISOString().split('T')[0]) {
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

        // 今日のタブを見ている場合の判定
        if (dayData.dateString === now.toISOString().split('T')[0]) {
            if (now >= progStart && now < progEnd) {
                isCurrent = true;
                currentOrNextFound = true;
            } else if (!isCurrentlyOnAir && now < progStart && !prepCardInserted) {
                // 放送中の番組がなく、時間が未来の最初の番組の「直前」に準備中カードを挿入
                const prepCard = document.createElement("div");
                prepCard.className = "prep-card";
                prepCard.id = "target-program"; // 自動スクロールのターゲット
                
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

        // 通常の番組カードを作成
        const card = document.createElement("div");
        card.className = `program-card ${isCurrent ? "is-current" : ""}`;
        
        // 準備中がない場合、現在放送中のカードをスクロールターゲットにする
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
        if (program.subtitle) {
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

    // 初回表示時のみ、ON AIR または 準備中 の位置にスクロール
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
