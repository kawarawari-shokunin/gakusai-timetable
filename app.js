// --- 設定・状態管理 ---
let currentDayId = "day1"; // 現在選択されているタブ
let currentTag = "all";    // 現在選択されているタグ
let availableTags = new Set(); // 抽出したタグの一覧
let isInitialLoad = true;  // 初回読み込みフラグ（自動スクロール用）

// ★現在時刻テスト用オーバーライド
// 本番時は空文字列("")にしてください。
// 例: "2026-10-24T12:15:00+09:00" と入れると、10/24 12時台の挙動をテストできます。
const DEBUG_NOW = "2026-10-23T11:45:00+09:00"; 

// --- 初期化処理 ---
document.addEventListener("DOMContentLoaded", () => {
    extractTags();       // data.jsからタグを収集
    renderTabs();        // タブUIの生成
    renderTagFilters();  // タグボタンUIの生成
    
    // アクセス日時に基づいて初期タブを決定
    determineInitialTab(); 
    
    // 描画
    renderSchedule();
});

// 現在時刻を取得する関数
function getNow() {
    return DEBUG_NOW ? new Date(DEBUG_NOW) : new Date();
}

// データの全番組からタグを自動抽出
function extractTags() {
    scheduleData.forEach(day => {
        day.programs.forEach(program => {
            if (program.tags) {
                program.tags.forEach(tag => availableTags.add(tag));
            }
        });
    });
}

// 初期表示する日付タブを現在時刻から判定
function determineInitialTab() {
    const now = getNow();
    const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const matchedDay = scheduleData.find(day => day.dateString === todayString);
    if (matchedDay) {
        currentDayId = matchedDay.dateId;
    } else {
        // 期間外のアクセスなら、とりあえず1日目を表示
        currentDayId = scheduleData[0].dateId; 
    }
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
    
    // 「すべて表示」ボタン
    const allBtn = document.createElement("button");
    allBtn.className = `filter-btn ${currentTag === "all" ? "active" : ""}`;
    allBtn.textContent = "すべて表示";
    allBtn.onclick = () => handleTagClick("all");
    container.appendChild(allBtn);
    
    // 各タグのボタン
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
    isInitialLoad = false; // 手動切替時はスクロールしない
    
    renderTabs();
    renderSchedule();
}

// タグのクリック処理
function handleTagClick(tag) {
    if (currentTag === tag) return;
    currentTag = tag;
    isInitialLoad = false; // タグ切替時はスクロールしない
    
    renderTagFilters();
    renderSchedule();
}

// 番組表の描画
function renderSchedule() {
    const container = document.getElementById("timeline-container");
    container.innerHTML = "";
    
    const dayData = scheduleData.find(d => d.dateId === currentDayId);
    if (!dayData) return;
    
    const now = getNow();
    let currentProgramFound = false;

    // フィルタリング処理
    const filteredPrograms = dayData.programs.filter(p => {
        if (currentTag === "all") return true;
        return p.tags && p.tags.includes(currentTag);
    });

    if (filteredPrograms.length === 0) {
        container.innerHTML = `<div class="empty-message">該当する番組がありません。</div>`;
        return;
    }

    filteredPrograms.forEach((program, index) => {
        const progStart = new Date(program.startTime);
        
        // 次の番組の開始時間を終了時間と仮定する（最後の場合は+1時間）
        let progEnd = new Date(progStart.getTime() + 60 * 60 * 1000); 
        if (index < filteredPrograms.length - 1) {
            progEnd = new Date(filteredPrograms[index + 1].startTime);
        }

        // 現在進行中の番組かどうかの判定 (表示しているタブが今日の場合のみ)
        let isCurrent = false;
        if (dayData.dateString === now.toISOString().split('T')[0]) {
            if (now >= progStart && now < progEnd) {
                isCurrent = true;
                currentProgramFound = true;
            }
        }

        // カード要素の作成
        const card = document.createElement("div");
        card.className = `program-card ${isCurrent ? "is-current" : ""}`;
        
        let tagsHtml = "";
        if (program.tags) {
            tagsHtml = `<div class="tags">
                ${program.tags.map(t => `<span class="tag">${t}</span>`).join("")}
            </div>`;
        }

        card.innerHTML = `
            ${isCurrent ? '<div class="current-badge">ON AIR</div>' : ''}
            <div class="time">${program.time}</div>
            <div class="title">${program.title}</div>
            <div class="description">${program.description}</div>
            ${tagsHtml}
        `;
        
        container.appendChild(card);
    });

    // 初回読み込み時に現在進行中の番組があれば自動スクロール
    if (isInitialLoad && currentProgramFound) {
        setTimeout(() => {
            const currentEl = document.querySelector('.is-current');
            if (currentEl) {
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100); // 描画完了を少し待つ
    }
}