// =======================================================
// 0. 初期設定とユーティリティ
// =======================================================

// OpenWeatherMap API仕様に基づいて更新
const defaultLocation = '新浦安駅'; // デフォルトの場所を新浦安駅に変更
const DEFAULT_LAT = '35.6517';      // 新浦安駅付近の緯度
const DEFAULT_LON = '139.9079';     // 新浦安駅付近の経度

// ユーザー提供のAPIキーを設定
const WEATHER_API_KEY = 'ffa3590bb2f3c1f712a6abbc1ebdccea';

// APIエンドポイント
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast/daily';
const GEO_API_URL = 'https://api.openweathermap.org/geo/1.0/direct';


// JSON Bin 設定
const BIN_ID = '68e4a432ae596e708f08d474';
const X_MASTER_KEY = '$2a$10$jXqWaOsnNAUVPbvzX4ytFeZoXohqmbWD20InKtsiIQr3.vkgXzj36';

if (!BIN_ID || !X_MASTER_KEY) {
    console.error("【設定エラー】JSON Binキーが設定されていません。アプリは空のデータで動作します。");
}

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let appData = {
    schedules: [],
    currentView: 'month',
    lastId: 0,
    currentDate: new Date()
};

// スケジュール分類用のタグ設定 (白, 黒, 赤, 黄色のみを使用)
const TAG_COLORS = {
    // classには、背景色と文字色を設定
    'red': { label: '🔴 緊急/重要', class: 'bg-[var(--color-red)] text-white' },
    'yellow': { label: '🟡 趣味/プライベート', class: 'bg-[var(--color-yellow)] text-black' },
    'white': { label: '⚪ 通常/その他', class: 'bg-white text-black border border-black' }, // 白地に黒文字
    'black': { label: '⚫ 業務/仕事', class: 'bg-black text-white' }
};

/**
 * ユーティリティ: タグのHTMLを生成 (詳細/リスト表示用)
 * @param {string} tagName - タグ名 ('red', 'yellow', 'white', 'black')
 * @returns {string} タグを表示するためのHTMLスニペット
 */
function getTagHtml(tagName) {
    const tag = TAG_COLORS[tagName] || TAG_COLORS['white'];
    // ラベルはアイコンと最初の単語のみを使用
    const shortLabel = tag.label.split('/')[0].trim();
    return `<span class="inline-block text-xs font-bold rounded-full px-2 py-0.5 mr-1 ${tag.class} whitespace-nowrap">${shortLabel}</span>`;
}

/**
 * ユーティリティ: カレンダー表示で使用するタグのアクセント色クラスを生成
 * @param {string} tagName - タグ名 ('red', 'yellow', 'white', 'black')
 * @returns {string} Tailwind CSSのボーダー色クラス
 */
function getTagAccentClass(tagName) {
    const tag = tagName || 'black';
    switch (tag) {
        case 'red':
            return 'border-[var(--color-red)]';
        case 'yellow':
            return 'border-[var(--color-yellow)]';
        case 'white':
            return 'border-[var(--color-white)]'; // 白い帯（背景と区別しにくいが、意図通り）
        case 'black':
        default:
            return 'border-[var(--color-black)]';
    }
}


// UI要素の取得
const viewContainer = document.getElementById('view-container');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');

/**
 * データをJSON Binからロード
 * @returns {Promise<void>}
 */
async function loadData() {
    if (!BIN_ID || !X_MASTER_KEY) {
        initializeDemoData();
        return;
    }

    console.log("データをJSON Binからロード中...");
    try {
        let response = null;
        for (let i = 0; i < 3; i++) {
            response = await fetch(JSONBIN_URL, {
                method: 'GET',
                headers: {
                    'X-Master-Key': X_MASTER_KEY,
                    'X-Bin-Meta': 'false'
                }
            });

            if (response.ok || response.status === 404) break; 
            
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log("JSON Binにデータが見つかりませんでした。初回起動またはBinが空です。");
                initializeDemoData();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const storedData = await response.json();

        if (storedData && storedData.schedules && Array.isArray(storedData.schedules)) {
            appData = { ...appData, ...storedData };
            if (appData.currentDate) {
                appData.currentDate = new Date(appData.currentDate);
            }
            console.log("JSON Binからデータが正常にロードされました。");
        } else {
            console.error("JSON Binからのデータフォーマットが不正です。空のデータを設定します。");
            initializeDemoData();
        }
    } catch (e) {
        console.error("JSON Binからのデータロードに失敗しました。空のデータで続行します。", e);
        initializeDemoData();
    }
}

/**
 * データをJSON Binに保存
 * @returns {Promise<void>}
 */
async function saveData() {
    if (!BIN_ID || !X_MASTER_KEY) {
        console.log("キーが未設定のため、データ保存はスキップされました。");
        return;
    }

    console.log("データをJSON Binに保存中...");
    try {
        const dataToSave = {
            ...appData,
            currentDate: appData.currentDate.toISOString()
        };

        let response = null;
        for (let i = 0; i < 3; i++) {
            response = await fetch(JSONBIN_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': X_MASTER_KEY
                },
                body: JSON.stringify(dataToSave)
            });

            if (response.ok) break; 
            
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log("JSON Binへのデータ保存が成功しました。");

    } catch (e) {
        console.error("JSON Binへのデータ保存に失敗しました。", e);
    }
}


/**
 * 現在時刻をヘッダーに表示（赤い点滅コロン付き）
 */
function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}<span class="blinking-colon">:</span>${minutes}<span class="blinking-colon">:</span>${seconds}`;
    document.getElementById('current-time').innerHTML = timeString;
}

/**
 * 指定された日付のYYYY-MM-DD形式の文字列を返す
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
}

/**
 * 指定された日時のYYYY-MM-DDTHH:MM形式の文字列を返す
 * @param {Date} date
 * @returns {string}
 */
function formatDateTimeLocal(date) {
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0') + 'T' +
           String(date.getHours()).padStart(2, '0') + ':' +
           String(date.getMinutes()).padStart(2, '0');
}

// =======================================================
// 1. データ操作 (CRUD)
// =======================================================

/**
 * スケジュール/タスクを登録または更新
 * @param {Object} eventData - イベントデータ
 */
function saveEvent(eventData) {
    if (eventData.id) {
        // 更新
        const index = appData.schedules.findIndex(e => e.id === eventData.id);
        if (index !== -1) {
            appData.schedules[index] = eventData;
        }
    } else {
        // 新規登録
        appData.lastId++;
        eventData.id = appData.lastId;
        appData.schedules.push(eventData);
    }
    saveData(); 
    closeModal();
    renderView(appData.currentView);
}

/**
 * スケジュール/タスクを削除
 * @param {number} id - イベントID
 */
function deleteEvent(id) {
    // 確認モーダルの代わりにカスタムメッセージボックスを使用
    showCustomMessageBox('確認', 'この予定を削除しますか？', () => {
        appData.schedules = appData.schedules.filter(e => e.id !== id);
        // --- 修正箇所: データのフィルタリング後に保存と再レンダリングを呼び出す ---
        saveData(); 
        closeModal();
        renderView(appData.currentView);
        // ----------------------------------------------------------------------
    });
}

/**
 * タスクの完了状態をトグル
 * @param {number} id - タスクID
 */
function toggleTask(id) {
    const task = appData.schedules.find(e => e.id === id);
    if (task) {
        // タスクではない場合は何もしない
        if (task.type !== 'task') return;
        
        task.completed = !task.completed;
        if (task.completed) {
            task.actualEnd = new Date().toISOString(); 
        } else {
            task.actualEnd = null;
        }
        saveEvent(task);
    }
}

// =======================================================
// 2. モーダル/UI処理
// =======================================================

/**
 * モーダルを開く
 * @param {string} contentHtml - モーダルに表示するHTMLコンテンツ
 */
function openModal(contentHtml) {
    modalContent.innerHTML = contentHtml;
    modalOverlay.classList.remove('hidden');
}

/**
 * モーダルを閉じる
 */
function closeModal() {
    modalOverlay.classList.add('hidden');
    modalContent.innerHTML = '';
}

// モーダル外クリックで閉じる
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});

/**
 * イベント登録/編集フォームの表示
 * @param {number|null} id - 編集の場合はID, 新規の場合はnull
 * @param {Date} [initialDate] - 新規作成時の初期日付
 */
function showEventForm(id = null, initialDate = appData.currentDate) {
    const event = id ? appData.schedules.find(e => e.id === id) : null;
    const isTask = event ? event.type === 'task' : false;
    // タグが未設定の場合は'white'をデフォルトとする
    const currentTag = event ? event.tag : 'white';

    const now = new Date();
    const defaultStart = new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate(), now.getHours() + 1, 0);
    const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

    const startTime = event ? new Date(event.start) : defaultStart;
    const endTime = event ? new Date(event.end) : defaultEnd;

    const formHtml = `
        <h2 class="text-xl font-extrabold ink-border-b pb-2 mb-4">${id ? '予定を編集' : '新しい予定/タスク'}</h2>
        <form id="event-form">
            <input type="hidden" name="id" value="${id || ''}">

            <div class="mb-4">
                <label class="block mb-1 font-bold">種類</label>
                <div class="flex space-x-4">
                    <label class="flex items-center">
                        <input type="radio" name="type" value="schedule" ${!isTask ? 'checked' : ''} class="mr-2 border-2 border-black" required> 予定
                    </label>
                    <label class="flex items-center">
                        <input type="radio" name="type" value="task" ${isTask ? 'checked' : ''} class="mr-2 border-2 border-black"> タスク
                    </label>
                </div>
            </div>

            <div class="mb-4">
                <label for="title" class="block mb-1 font-bold">タイトル</label>
                <input type="text" id="title" name="title" value="${event ? event.title : ''}"
                       class="ink-border p-2 w-full" placeholder="タイトルを入力" required>
            </div>

            <div id="datetime-fields">
                <div class="mb-4">
                    <label for="start" class="block mb-1 font-bold">開始日時</label>
                    <input type="datetime-local" id="start" name="start" value="${formatDateTimeLocal(startTime)}"
                           class="ink-border p-2 w-full" required>
                </div>
                <div class="mb-4">
                    <label for="end" class="block mb-1 font-bold">終了日時</label>
                    <input type="datetime-local" id="end" name="end" value="${formatDateTimeLocal(endTime)}"
                           class="ink-border p-2 w-full" required>
                </div>
            </div>

            <!-- ユーザーの要望により、タスク選択時に非表示にする場所フィールド -->
            <div id="location-field-container" class="mb-4">
                <label for="location" class="block mb-1 font-bold">場所</label>
                <input type="text" id="location" name="location" value="${event ? event.location || '' : ''}"
                       class="ink-border p-2 w-full" placeholder="場所（任意）">
            </div>

            <!-- New Tag Selection Field -->
            <div class="mb-6 ink-border p-3 bg-gray-50/50">
                <label class="block mb-2 font-extrabold text-lg ink-border-b pb-1">分類タグ (色)</label>
                <div class="grid grid-cols-2 gap-3">
                    ${Object.entries(TAG_COLORS).map(([key, value]) => `
                        <label class="flex items-center ink-border p-2 rounded-lg cursor-pointer transition-all ${value.class} ${key === 'white' ? 'border-2 border-black' : ''}">
                            <input type="radio" name="tag" value="${key}" ${currentTag === key ? 'checked' : ''} class="mr-2 h-4 w-4 border-2 border-black" required>
                            <span class="font-bold text-sm">${value.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <!-- End Tag Selection Field -->

            <div id="notes-field" class="mb-4">
                <label for="notes" class="block mb-1 font-bold">備考</label>
                <textarea id="notes" name="notes" class="ink-border p-2 w-full" rows="3" placeholder="詳細、メモ">${event ? event.notes || '' : ''}</textarea>
            </div>

            <div class="flex justify-between items-center pt-2 border-t border-gray-300">
                <button type="button" onclick="window.closeModal()" class="steamboat-button bg-white text-black px-4 py-2 ink-border">キャンセル</button>
                <button type="submit" class="steamboat-button bg-[var(--color-red)] text-white px-4 py-2 ink-border shadow-md">保存</button>
            </div>
        </form>
    `;

    openModal(formHtml);

    // --- 追加: タスク選択時の場所フィールド非表示ロジック ---
    const locationContainer = document.getElementById('location-field-container');
    const typeRadios = document.querySelectorAll('input[name="type"]');

    /**
     * 選択された種類に基づいて場所フィールドの表示を切り替える
     */
    function toggleFormFields() {
        const selectedType = document.querySelector('input[name="type"]:checked').value;
        if (selectedType === 'task') {
            locationContainer.classList.add('hidden');
        } else {
            locationContainer.classList.remove('hidden');
        }
    }

    typeRadios.forEach(radio => {
        radio.addEventListener('change', toggleFormFields);
    });

    // 初回ロード時の状態を適用
    toggleFormFields();
    // --------------------------------------------------------

    document.getElementById('event-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const type = formData.get('type');
        
        // タスクの場合、場所を空にする
        const location = type === 'task' ? '' : formData.get('location');
        
        const data = {
            id: formData.get('id') ? parseInt(formData.get('id')) : null,
            title: formData.get('title'),
            type: type,
            start: new Date(formData.get('start')).toISOString(),
            end: new Date(formData.get('end')).toISOString(),
            location: location, // タスクの場合は空、予定の場合は入力値
            notes: formData.get('notes'),
            tag: formData.get('tag') || 'white', // ★★★ 追加: タグを保存
            completed: event ? event.completed : false,
            actualEnd: event ? event.actualEnd : null,
        };
        saveEvent(data);
    });
}

/**
 * イベント詳細モーダルの表示
 * @param {number} id - イベントID
 */
async function showEventDetails(id) {
    const event = appData.schedules.find(e => e.id === id);
    if (!event) return;

    const isTask = event.type === 'task';
    const start = new Date(event.start);
    const end = new Date(event.end);
    const now = new Date();
    const isPast = end.getTime() < now.getTime(); // 予定が既に終了しているか
    
    const dateStr = `${start.getMonth() + 1}月${start.getDate()}日`;
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    
    // タグ情報の取得
    const tag = TAG_COLORS[event.tag] || TAG_COLORS['white'];

    // タスクの場合はローディングをスキップし、すぐに詳細表示に移行
    openModal(`
        <h2 class="text-2xl font-extrabold ink-border-b pb-2 mb-4">${event.title}</h2>
        <div class="text-center py-8">
            <p class="font-bold">情報をロード中...</p>
            <p class="text-sm italic text-black">（外部連携処理）</p>
        </div>
    `);

    let weatherHtml = '';
    let routeInfoHtml = '';
    let locationDetailHtml = '';

    if (!isTask) {
        // 予定の場合のみ、天気予報と経路情報を取得・表示
        const locationForWeather = event.location;
        const weather = await fetchWeatherForecast(start, locationForWeather); 
        
        locationDetailHtml = `<p class="flex justify-between items-center"><span class="font-bold">📍 場所:</span> <span>${event.location || '未定'}</span></p>`;

        weatherHtml = `
            <!-- 天気情報 -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-bold">天気予報 (日中):</span>
                    <div class="flex items-center space-x-2 ${weather.warning ? 'bg-[var(--color-red)] text-white font-bold p-1 rounded-sm' : 'text-black bg-[var(--color-yellow)]'}">
                        <span class="weather-icon text-2xl">${weather.icon}</span>
                        <span>${weather.condition}</span>
                    </div>
                </div>

                <div class="flex items-center justify-between border-t border-black pt-2">
                    <span class="font-bold">予想最高気温:</span>
                    <span class="${weather.warning ? 'text-[var(--color-red)] font-bold' : ''}">${weather.maxTemp}°C</span>
                </div>
                
                <div class="flex items-center justify-between border-t border-black pt-2">
                    <span class="font-bold">予想降水確率:</span>
                    <span class="${weather.warning ? 'text-[var(--color-red)] font-bold' : ''}">${weather.precipitation}</span>
                </div>
            </div>

            <div class="text-xs text-black mt-1 italic">
                ※データは${weather.locationName}付近のものです。
            </div>
        `;

        routeInfoHtml = `
            <!-- 経路・時間検索 -->
            <div class="mt-4">
                <p class="font-bold mb-1 border-t pt-3">🚗 経路・所要時間情報:</p>
                <p class="text-sm bg-white p-2 ink-border text-black italic">
                    正確な所要時間を検索するAPI連携がないため、情報はありません。
                    <span class="block text-xs text-black mt-1">目的地: ${event.location || '未定'}</span>
                </p>
            </div>
        `;
    } else {
        // タスクの場合
        locationDetailHtml = '<p class="flex justify-between items-center"><span class="font-bold">📍 場所:</span> <span>場所なし (タスク)</span></p>';
    }

    // 外部情報連携コンテナは、タスクでない場合のみ表示
    const externalInfoContainer = !isTask ? `
        <div class="ink-border p-3 mt-4 bg-white">
            <h3 class="font-extrabold text-lg ink-border-b border-dashed pb-2 mb-3">天気・経路情報連携</h3>
            ${weatherHtml}
            ${routeInfoHtml}
        </div>
    ` : '';


    // ★★★ 完了ボタンのロジック修正 ★★★
    let completionButtonHtml = '';
    if (isTask) {
        // タスクの場合: 完了/未完了のトグルボタンを表示
        completionButtonHtml = `
            <button onclick="window.toggleTask(${event.id})" class="steamboat-button ${event.completed ? 'bg-[var(--color-yellow)] text-black' : 'bg-[var(--color-red)] text-white'} px-4 py-2 ink-border font-bold">
                ${event.completed ? '未完了に戻す' : '完了として記録'}
            </button>
        `;
    } else {
        // 予定の場合: ステータス表示（非インタラクティブ）
        const statusText = isPast ? '✅ 実施済み' : '⏱️ 未実施';
        const statusClass = isPast ? 'bg-black text-white' : 'bg-white text-black border border-black';
        completionButtonHtml = `
            <span class="px-4 py-2 ${statusClass} ink-border font-bold text-sm select-none">
                ${statusText}
            </span>
        `;
    }

    const detailHtml = `
        <h2 class="text-2xl font-extrabold ink-border-b pb-2 mb-4">${event.title} ${getTagHtml(event.tag)}</h2>
        <p class="text-sm text-black mb-4">${isTask ? 'タスク' : '予定'}</p>

        <div class="space-y-3 mb-4">
            <p class="flex justify-between items-center"><span class="font-bold">📅 日付:</span> <span>${dateStr}</span></p>
            <p class="flex justify-between items-center"><span class="font-bold">⏱️ 時間:</span> <span>${timeStr}</span></p>
            <p class="flex justify-between items-center"><span class="font-bold">🏷️ タグ:</span> <span class="text-sm ${tag.class} ink-border-b p-1 rounded-sm">${tag.label}</span></p>
            ${locationDetailHtml}
            ${event.notes ? `<p class="font-bold border-t pt-3">📝 備考:</p><p class="whitespace-pre-wrap">${event.notes}</p>` : ''}
        </div>

        <!-- 外部情報連携 (タスクの場合は空) -->
        ${externalInfoContainer}

        <div class="flex justify-between items-center mt-6">
            <button onclick="window.showEventForm(${event.id})" class="steamboat-button bg-[var(--color-yellow)] text-black px-4 py-2 ink-border font-bold">編集</button>
            
            ${completionButtonHtml}
            
            <button id="deleteBtn" data-event-id="${event.id}" class="steamboat-button bg-black text-white px-4 py-2 ink-border font-bold">削除</button>
        </div>
    `;
    // ★★★ 完了ボタンのロジック修正ここまで ★★★

    // 再度モーダルを開く (コンテンツの上書き)
    openModal(detailHtml);
    
    // 削除ボタンにイベントリスナーを追加
    document.getElementById('deleteBtn').addEventListener('click', function() {
        const eventId = parseInt(this.getAttribute('data-event-id'));
        window.deleteEvent(eventId);
    });
}

/**
 * カスタムメッセージボックスを表示 (alert/confirmの代わり)
 * @param {string} title
 * @param {string} message
 * @param {Function} onConfirm - 確認時のコールバック
 * @param {Function} [onCancel] - キャンセル時のコールバック
 */
function showCustomMessageBox(title, message, onConfirm, onCancel = closeModal) {
    const messageBoxHtml = `
        <h2 class="text-xl font-extrabold ink-border-b pb-2 mb-4">${title}</h2>
        <p class="mb-6">${message}</p>
        <div class="flex justify-end space-x-4">
            <button id="messageBoxCancelBtn" class="steamboat-button bg-white text-black px-4 py-2 ink-border">キャンセル</button>
            <button id="messageBoxConfirmBtn" class="steamboat-button bg-[var(--color-red)] text-white px-4 py-2 ink-border shadow-md">OK</button>
        </div>
    `;
    openModal(messageBoxHtml);

    // --- 修正箇所: イベントリスナー方式に変更し、onConfirm関数を確実に実行 ---
    document.getElementById('messageBoxConfirmBtn').addEventListener('click', () => {
        closeModal();
        onConfirm(); // 渡されたコールバック関数 (deleteEvent) を実行
    });
    
    document.getElementById('messageBoxCancelBtn').addEventListener('click', () => {
        closeModal();
        if (onCancel && onCancel !== closeModal) {
            onCancel();
        }
    });
    // --------------------------------------------------------------------------
}


// =======================================================
// 3. 外部情報連携 (OpenWeatherMap API)
// =======================================================

/**
 * 場所の文字列から緯度と経度を取得する (OpenWeatherMap Geocoding API)
 * @param {string} locationName - 検索する場所の名前
 * @returns {Promise<{lat: string, lon: string, name: string, status: string}>} - 緯度、経度、都市名、ステータスのオブジェクト
 */
async function getCoordsFromLocation(locationName) {
    // 場所が未入力の場合、デフォルト（新浦安駅）の座標と名前を返す
    if (!locationName || locationName.trim() === '') {
        console.log("場所が未入力です。デフォルト座標（新浦安駅）を使用します。");
        return { lat: DEFAULT_LAT, lon: DEFAULT_LON, name: defaultLocation, status: 'default' };
    }

    const limit = 1;
    const geoApiUrl = `${GEO_API_URL}?q=${encodeURIComponent(locationName)}&limit=${limit}&appid=${WEATHER_API_KEY}`;
    
    try {
        const response = await fetch(geoApiUrl);
        if (!response.ok) throw new Error(`Geocoding API HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            // 都市名、国名、都道府県名などを結合して表示名を作成
            const name = `${result.name}${result.state ? `, ${result.state}` : ''}${result.country ? ` (${result.country})` : ''}`;
            return { 
                lat: result.lat.toFixed(4), 
                lon: result.lon.toFixed(4), 
                name: name,
                status: 'success'
            };
        }
    } catch (e) {
        console.error("Geocoding APIからの座標取得に失敗しました。デフォルト座標を使用します。", e);
    }
    
    // 失敗または見つからない場合は、エラーフラグを付けてデフォルトを返す
    console.log(`場所「${locationName}」の座標が見つかりませんでした。デフォルト座標（新浦安駅）を使用します。`);
    return { lat: DEFAULT_LAT, lon: DEFAULT_LON, name: locationName, status: 'not_found' };
}

/**
 * OpenWeatherMap APIから予定日の予報データを取得
 * @param {Date} date - 予定の日時
 * @param {string} location - 予定の場所の文字列
 * @returns {Promise<{icon: string, condition: string, maxTemp: string, precipitation: string, warning: boolean, locationName: string}>}
 */
async function fetchWeatherForecast(date, location) {
    const now = new Date();
    const isPast = date.getTime() < now.getTime();
    
    // 1. 場所から緯度・経度を取得
    const coords = await getCoordsFromLocation(location);

    // 過去の予定の場合は「過去の予定」として返す
    if (isPast) {
         return { 
            icon: '🕰️', 
            condition: '過去の予定', 
            maxTemp: 'N/A', 
            precipitation: 'N/A', 
            warning: false,
            locationName: coords.name 
        };
    }

    // APIキーがない場合はエラーを返す
    if (!WEATHER_API_KEY) {
        console.error("【APIエラー】OpenWeatherMap APIキーが未設定です。");
         return { 
            icon: '❗', 
            condition: 'APIキー設定エラー', 
            maxTemp: 'N/A', 
            precipitation: 'N/A', 
            warning: true,
            locationName: coords.name
        };
    }

    // 2. 場所が見つからなかった場合の特別な処理
    if (coords.status === 'not_found') {
         return { 
            icon: '🔍', 
            condition: '場所不明のため予報不可', 
            maxTemp: 'N/A', 
            precipitation: 'N/A', 
            warning: true,
            locationName: `${coords.name} (場所が見つかりませんでした)`
        };
    }
    
    // 3. 天気予報APIを呼び出し
    const apiEndpoint = `${WEATHER_API_URL}?lat=${coords.lat}&lon=${coords.lon}&cnt=16&appid=${WEATHER_API_KEY}`;
    
    try {
        let response = null;
        // 指数バックオフ付きリトライ
        for (let i = 0; i < 3; i++) {
            response = await fetch(apiEndpoint);
            if (response.ok) break; 
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (!response.ok) {
            throw new Error(`OpenWeatherMap API HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.list || data.list.length === 0) {
             throw new Error("APIレスポンスに予報データがありませんでした。");
        }

        // 予定日と一致する予報データを検索 (日単位)
        const targetDay = formatDate(date);
        const targetForecast = data.list.find(dayData => {
            // APIのdtはUNIXタイムスタンプ（秒）
            const forecastDate = new Date(dayData.dt * 1000);
            return formatDate(forecastDate) === targetDay;
        });

        if (!targetForecast) {
            // APIがカバーする16日間の予報期間外の場合
            return { 
                icon: '❓', 
                condition: '予報期間外', 
                maxTemp: 'N/A', 
                precipitation: 'N/A', 
                warning: false,
                locationName: coords.name
            };
        }

        // ケルビンを摂氏に変換 (K - 273.15)
        const maxTempC = (targetForecast.temp.max - 273.15).toFixed(0);
        
        // 降水量 (mm) を取得 (Daily APIの標準フィールド)
        const rainVolume = targetForecast.rain || 0; 
        
        // OpenWeatherMapのアイコンIDに基づいてアイコンと状態を決定
        const weatherId = targetForecast.weather[0].id;
        const { icon, condition, warning } = getWeatherIconAndCondition(weatherId, rainVolume);

        // 場所名がデフォルトの場合、特別に「新浦安駅付近のものです」と明記する
        const displayLocationName = coords.status === 'default' ? `${coords.name}付近のものです` : `${coords.name}`;

        return { 
            icon, 
            condition, 
            maxTemp: maxTempC, 
            precipitation: getPrecipitationDisplay(rainVolume), // 降水量から確率表示へ変換
            warning,
            locationName: displayLocationName
        };

    } catch (e) {
        console.error("OpenWeatherMapからのデータ取得に失敗しました:", e);
        return { 
            icon: '❌', 
            condition: '取得失敗', 
            maxTemp: 'N/A', 
            precipitation: 'N/A', 
            warning: true,
            locationName: coords.name
        };
    }
}

/**
 * OpenWeatherMapのIDと降水量に基づいて、アイコン、状態、警告を決定
 * @param {number} id - OpenWeatherMapの天気ID
 * @param {number} rainVolume - 予想降水量 (mm)
 * @returns {{icon: string, condition: string, warning: boolean}}
 */
function getWeatherIconAndCondition(id, rainVolume) {
    let icon = '❓';
    let condition = '不明';
    let warning = false;

    if (id >= 200 && id < 300) { // Thunderstorm
        icon = '⛈️'; condition = '雷雨'; warning = true;
    } else if (id >= 300 && id < 500) { // Drizzle
        icon = '🌧️'; condition = '霧雨';
    } else if (id >= 500 && id < 600) { // Rain
        icon = '☔'; condition = (rainVolume > 10) ? '強雨' : '雨';
        if (rainVolume > 5) warning = true;
    } else if (id >= 600 && id < 700) { // Snow
        icon = '❄️'; condition = '雪';
    } else if (id >= 700 && id < 800) { // Atmosphere (Mist, Smoke, Haze etc.)
        icon = '🌫️'; condition = '霧';
    } else if (id === 800) { // Clear
        icon = '☀️'; condition = '快晴';
    } else if (id === 801 || id === 802) { // Few Clouds
        icon = '🌤️'; condition = '晴れ時々曇り';
    } else if (id === 803 || id === 804) { // Scattered/Broken Clouds
        icon = '☁️'; condition = '曇り';
    }
    
    // 降水確率/降水量が特に高い場合は警告を出す
    if (rainVolume > 15) {
        condition = '大雨警報';
        warning = true;
    }

    return { icon, condition, warning };
}

/**
 * 降水量から降水確率の表示を生成 (OpenWeatherMap Daily APIの制約のため)
 * 実際は降水確率フィールドがないため、降水量を確率の代替として表示。
 * @param {number} rainVolume - 予想降水量 (mm)
 * @returns {string}
 */
function getPrecipitationDisplay(rainVolume) {
     if (rainVolume === 0 || rainVolume === undefined) return '0%';
     if (rainVolume > 10) return '80% 以上 (強雨)';
     if (rainVolume > 3) return '50 - 80% (中雨)';
     if (rainVolume > 0.5) return '20 - 50% (弱雨)';
     return '20% 未満 (微量)';
}


// =======================================================
// 4. 高度な時間管理機能 (スロット分析)
// =======================================================

/**
 * 指定された日の空き時間帯 (スロット) を分析
 * @param {Date} targetDate - 対象の日付
 * @returns {Array<{start: Date, end: Date}>} - 空き時間スロットの配列
 */
function analyzeTimeSlots(targetDate) {
    const slots = [];
    const dayStartHour = 9; // 分析開始時刻
    const dayEndHour = 22; // 分析終了時刻

    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), dayStartHour, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), dayEndHour, 0);

    // 対象日の確定した予定（未完了のスケジュール、開始日時順）
    const bookedTimes = appData.schedules
        // 完了済みのタスクを除外する条件を追加
        .filter(e => e.type === 'schedule' || (e.type === 'task' && !e.completed))
        .filter(e => {
            const start = new Date(e.start);
            // 比較を簡単にするために、日付部分のみを比較
            const eventDayStr = formatDate(start);
            const targetDayStr = formatDate(dayStart);
            return eventDayStr === targetDayStr;
        })
        .map(e => ({
            start: new Date(e.start),
            end: new Date(e.end)
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentCheckTime = dayStart;
    const minSlotDuration = 30 * 60 * 1000; // 30分以上の空き

    for (const booked of bookedTimes) {
        // 予定の開始時刻が分析期間の開始時刻より遅い場合のみ考慮
        const gapStart = new Date(Math.max(currentCheckTime.getTime(), dayStart.getTime()));
        
        // 予定が分析期間内に収まっているかチェック
        if (booked.start.getTime() >= dayEnd.getTime()) {
             // 予定が日の終わりに達しているか、超えている場合はループを抜ける
            break;
        }

        const gapDuration = booked.start.getTime() - gapStart.getTime();

        // 予定と予定の間、または一日の始まりと最初の予定の間に空きがあるか
        if (gapDuration >= minSlotDuration) {
            slots.push({
                start: gapStart,
                end: booked.start
            });
        }
        
        // チェック開始時間を現在の予定の終了時刻に進める (重複考慮のため)
        if (booked.end.getTime() > currentCheckTime.getTime()) {
            currentCheckTime = booked.end;
        }
    }

    // 最後の予定の終了時刻から一日の終わりまでの空き
    const endGapDuration = dayEnd.getTime() - currentCheckTime.getTime();
    if (endGapDuration >= minSlotDuration) {
        // 確保された空き時間の開始時刻が一日の開始時刻より遅いことを保証
        const slotStart = new Date(Math.max(currentCheckTime.getTime(), dayStart.getTime()));
        slots.push({
            start: slotStart,
            end: dayEnd
        });
    }

    return slots;
}

// =======================================================
// 5. ビューレンダリング
// =======================================================

/**
 * 現在のビューを設定し、レンダリングをトリガー
 * @param {string} view - 'month', 'week', 'task', 'log'
 */
window.setView = function(view) {
    appData.currentView = view;
    document.querySelectorAll('footer button').forEach(btn => {
        btn.classList.remove('text-[var(--color-red)]', 'font-extrabold');
        btn.classList.remove('text-black'); // ナビの非アクティブな文字色はCSSで設定済み
        btn.classList.add('text-[var(--color-black)]'); // CSSで設定されるはずだが、念のため
    });
    // アクティブなボタンのテキスト色を設定
    document.getElementById(`nav-${view}`).classList.remove('text-[var(--color-black)]');
    document.getElementById(`nav-${view}`).classList.add('text-[var(--color-red)]', 'font-extrabold');

    renderView(view);
}

/**
 * メインビューのコンテンツをレンダリング
 * @param {string} view - 'month', 'week', 'task', 'log'
 */
function renderView(view) {
    // --------------------------------------------------------------------------
    // 修正点1: カレンダービューの場合、親コンテナのパディングを削除する
    if (view === 'month' || view === 'week') {
        viewContainer.classList.remove('p-4'); // index.htmlのview-contentのデフォルトパディング
        viewContainer.classList.remove('p-16');
        viewContainer.classList.add('p-0'); // パディングを削除して最大幅を使用
    } else {
        viewContainer.classList.remove('p-0');
        viewContainer.classList.add('p-4'); // タスク/日誌ビューはデフォルトのパディングに戻す
    }
    // --------------------------------------------------------------------------
    
    viewContainer.innerHTML = ''; // コンテンツをクリア

    const headerHtml = (title) => `
        <div class="flex justify-between items-center mb-4 ink-border p-2 bg-white">
            <button onclick="window.changeDate(-1)" class="text-2xl steamboat-button">◀</button>
            <h2 class="text-xl font-extrabold">${title}</h2>
            <button onclick="window.changeDate(1)" class="text-2xl steamboat-button">▶</button>
        </div>
    `;

    switch (view) {
        case 'month':
            renderMonthView(headerHtml);
            break;
        case 'week':
            renderWeekView(headerHtml);
            break;
        case 'task':
            renderTaskView();
            break;
        case 'log':
            renderLogView();
            break;
    }

    // どのビューでも新規作成ボタンは表示
    const createButton = document.createElement('button');
    createButton.className = 'fixed right-6 bottom-20 w-12 h-12 bg-[var(--color-red)] text-white text-3xl font-extrabold rounded-full shadow-lg ink-border steamboat-button z-40';
    createButton.innerHTML = '+';
    createButton.onclick = () => window.showEventForm(null, appData.currentDate);
    viewContainer.appendChild(createButton);
}

/**
 * 月ビューのレンダリング
 */
function renderMonthView(headerHtml) {
    const date = appData.currentDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const today = new Date();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=日曜

    // ヘッダーと日付タイトル
    viewContainer.innerHTML = `
        <div class="p-4">
            ${headerHtml(`${year}年${month + 1}月`)}
        </div>
    `;
    
    // bg-gray-200 -> bg-white に変更
    let html = '<div class="ink-border p-1 bg-white">';
    html += '<div class="grid grid-cols-7 text-center font-bold text-sm bg-[var(--color-yellow)] text-black ink-border-b">';
    ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
        html += `<div class="p-2">${day}</div>`;
    });
    html += '</div>';

    html += '<div class="grid grid-cols-7">';

    // 前月の日付埋め
    // bg-gray-50 -> bg-white に変更
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="h-20 border border-black bg-white"></div>';
    }

    // 今月の日付
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const dayStr = formatDate(currentDate);
        const isToday = dayStr === formatDate(today);

        // その日の予定を取得 (完了済みタスクを除外)
        const events = appData.schedules.filter(e => 
            formatDate(new Date(e.start)) === dayStr && 
            !(e.type === 'task' && e.completed) // 完了済みタスクを除外
        );
        
        // ★★★ 変更: 黒ベース＋タグ色の帯を適用 ★★★
        const eventHtml = events.slice(0, 2).map(e => {
            const tagKey = e.tag || 'black';
            const accentClass = getTagAccentClass(tagKey);
            // 完了済みタスクは少し暗く表示
            const baseClass = e.completed ? 'opacity-60 line-through' : '';

            return `
                <div onclick="event.stopPropagation(); window.showEventDetails(${e.id})"
                     class="text-xs truncate px-1 mt-0.5 rounded-sm cursor-pointer bg-black text-white border-l-4 ${accentClass} ${baseClass}"
                     title="${e.title} (${TAG_COLORS[tagKey].label})">
                    ${e.title}
                </div>
            `;
        }).join('');
        // ★★★ 変更ここまで ★★★

        const dayClass = isToday ? 'bg-[var(--color-red)] text-white font-extrabold' : 'bg-white text-black';
        // border-gray-200 -> border-black に変更
        html += `
            <div class="h-20 border border-black p-0.5 relative cursor-pointer" onclick="window.showEventForm(null, new Date(${year}, ${month}, ${day}))">
                <div class="w-6 h-6 rounded-full text-center text-xs flex items-center justify-center ${dayClass}">
                    ${day}
                </div>
                <div class="mt-0.5 space-y-0.5">
                    ${eventHtml}
                </div>
            </div>
        `;
    }

    html += '</div></div>';
    viewContainer.innerHTML += html;
}

/**
 * 週ビューのレンダリング
 */
function renderWeekView(headerHtml) {
    const date = appData.currentDate;
    const today = new Date();
    const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
    const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek); // 今週の日曜

    const weekDates = Array(7).fill(0).map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    // ヘッダー
    viewContainer.innerHTML = `
        <div class="p-4">
            ${headerHtml(`週間 ${weekDates[0].getMonth() + 1}/${weekDates[0].getDate()} - ${weekDates[6].getMonth() + 1}/${weekDates[6].getDate()}`)}
        </div>
    `;

    let html = '<div class="overflow-x-auto"><div class="ink-border bg-white">';

    // 曜日ヘッダー
    // bg-gray-200 -> bg-[var(--color-yellow)] に変更
    // border-r border-gray-300 -> border-r border-black に変更
    html += '<div class="grid grid-cols-8 text-center font-bold text-sm bg-[var(--color-yellow)] text-black ink-border-b">';
    html += '<div class="p-2 border-r border-black">時間</div>';
    ['日', '月', '火', '水', '木', '金', '土'].forEach((day, i) => {
        const d = weekDates[i];
        const dayStr = formatDate(d);
        const isToday = dayStr === formatDate(today);
        const dayClass = isToday ? 'text-[var(--color-red)] font-extrabold' : 'text-black';
        html += `<div class="p-2 border-r border-black ${dayClass}">${day}<br>${d.getDate()}</div>`;
    });
    html += '</div>';

    // タイムライン
    html += '<div class="relative">';
    const hourStart = 8;
    const hourEnd = 23;
    for (let h = hourStart; h < hourEnd; h++) {
        // border-b border-gray-200 -> border-b border-black に変更
        html += `<div class="grid grid-cols-8 h-12 border-b border-black">`;
        // border-r border-gray-300 -> border-r border-black に変更
        html += `<div class="p-1 text-xs text-right border-r border-black relative"><span class="absolute right-1 -top-2">${h}:00</span></div>`; // 時間表示

        for (let i = 0; i < 7; i++) {
            const d = weekDates[i];
            const dayStr = formatDate(d);
            const isToday = dayStr === formatDate(today);
            // bg-yellow-50/50 -> bg-[var(--color-yellow)] の半透明 (ここでは直接の色指定がないため、半透明の黄色を維持)
            const colClass = isToday ? 'bg-[var(--color-yellow)] opacity-50' : '';

            // その日その時間の予定を取得 (完了済みタスクを除外)
            const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0);
            const endOfHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 59, 59);

            const events = appData.schedules
                .filter(e => new Date(e.start) < endOfHour && new Date(e.end) > startOfDay)
                .filter(e => !(e.type === 'task' && e.completed)) // 完了済みタスクを除外
                .map(e => ({
                    ...e,
                    start: new Date(e.start),
                    end: new Date(e.end)
                }));

            let eventsHtml = '';
            events.forEach(e => {
                // 1時間内の予定の開始・終了位置を計算
                const startMin = e.start.getMinutes();
                const endMin = e.end.getMinutes();
                let top = (startMin / 60) * 100;
                let height = ((e.end.getTime() - e.start.getTime()) / (60 * 60 * 1000)) * 100;

                // 複数の日にまたがるイベントの調整 (ここでは1時間スロットに収めるため簡略化)
                const startOnThisHour = Math.max(startOfDay.getTime(), e.start.getTime());
                const endOnThisHour = Math.min(endOfHour.getTime(), e.end.getTime());

                if (endOnThisHour > startOnThisHour) {
                    const duration = endOnThisHour - startOnThisHour;
                    top = ((startOnThisHour - startOfDay.getTime()) / (60 * 60 * 1000)) * 100;
                    height = (duration / (60 * 60 * 1000)) * 100;

                    // 100%を超えないように調整
                    if (top + height > 100) height = 100 - top;
                    if (top < 0) {
                        height += top;
                        top = 0;
                    }

                    // ★★★ 変更: 黒ベース＋タグ色の帯を適用 ★★★
                    const tagKey = e.tag || 'black';
                    const accentClass = getTagAccentClass(tagKey);
                    const baseClass = e.completed ? 'opacity-60 line-through' : '';

                    eventsHtml += `
                        <div onclick="event.stopPropagation(); window.showEventDetails(${e.id})"
                            class="absolute w-full px-1 text-xs truncate rounded-sm cursor-pointer z-20 bg-black text-white border-l-4 ${accentClass} ${baseClass}"
                            style="top: ${top}%; height: ${height}%; left: 0px; box-sizing: border-box;"
                            title="${e.title} (${TAG_COLORS[tagKey].label})">
                            ${e.title}
                        </div>
                    `;
                    // ★★★ 変更ここまで ★★★
                }
            });

            // border-r border-gray-300 -> border-r border-black に変更
            html += `<div class="relative border-r border-black h-full ${colClass}">${eventsHtml}</div>`;
        }
        html += `</div>`;
    }
    html += '</div></div></div>'; // end of overflow-x-auto, end of relative
    viewContainer.innerHTML += html;


    // --- スロット分析のレンダリング (週ビューのみに適用) ---
    const timeLineContainer = viewContainer.querySelector('.relative');
    const dayWidth = timeLineContainer.offsetWidth / 8; // 8列 (時間+7日)
    const hourHeight = 48; // h-12 (48px)

    weekDates.forEach((d, i) => {
        const slots = analyzeTimeSlots(d);
        const colIndex = i + 1; // 0は時間列

        slots.forEach(slot => {
            const start = slot.start;
            const end = slot.end;

            // 9:00を基準とした相対位置を計算 (h=8が開始時間)
            const totalMinutesFromStart = ((start.getHours() - hourStart) * 60) + start.getMinutes();
            const durationMinutes = (end.getTime() - start.getTime()) / (60 * 60 * 1000);

            if (totalMinutesFromStart >= 0 && durationMinutes > 0) {
                const topPosition = (totalMinutesFromStart / 60) * hourHeight;
                const height = (durationMinutes / 60) * hourHeight;
                const leftPosition = colIndex * dayWidth;

                const slotDiv = document.createElement('div');
                slotDiv.className = 'slot-highlight absolute';
                slotDiv.style.top = `${topPosition}px`;
                slotDiv.style.left = `${leftPosition}px`;
                slotDiv.style.width = `${dayWidth}px`;
                slotDiv.style.height = `${height}px`;
                slotDiv.title = `空きスロット: ${start.toTimeString().slice(0, 5)} - ${end.toTimeString().slice(0, 5)}`;
                timeLineContainer.appendChild(slotDiv);
            }
        });
    });
}

/**
 * タスクビューのレンダリング
 */
function renderTaskView() {
    const tasks = appData.schedules.filter(e => e.type === 'task');
    const pendingTasks = tasks.filter(t => !t.completed).sort((a, b) => new Date(a.end) - new Date(b.end));
    const completedTasks = tasks.filter(t => t.completed).sort((a, b) => new Date(b.actualEnd) - new Date(a.actualEnd));

    let html = '<h2 class="text-xl font-extrabold ink-border-b pb-2 mb-4">タスク管理 (Todoリスト)</h2>';

    // 未完了タスク
    html += '<div class="mb-6">';
    html += '<h3 class="text-lg font-bold text-[var(--color-red)] mb-2">🔴 未完了タスク</h3>';
    if (pendingTasks.length === 0) {
        html += '<p class="text-black italic">素晴らしい！未完了タスクはありません。</p>';
    } else {
        pendingTasks.forEach(task => {
            const endDate = new Date(task.end);
            const deadline = `${endDate.getMonth() + 1}/${endDate.getDate()} ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
            // タグクラスを取得
            const tagKey = task.tag || 'white';
            const accentClass = getTagAccentClass(tagKey);
            
            // bg-white ink-border を使用し、タグの色を左側のボーダーとして表現
            html += `
                <div class="ink-border p-3 mb-2 flex justify-between items-center bg-white cursor-pointer steamboat-button relative overflow-hidden" onclick="window.showEventDetails(${task.id})">
                    <!-- タグ色を左の太線で強調 (border-l-4を直接使用) -->
                    <div class="absolute top-0 left-0 h-full w-2 ${accentClass} border-l-4"></div>
                    <div class="flex-1 ml-3">
                        <p class="font-bold">${task.title}</p>
                        <p class="text-black text-xs">締切: ${deadline} ${getTagHtml(task.tag)}</p>
                    </div>
                    <button onclick="event.stopPropagation(); window.toggleTask(${task.id})" class="steamboat-button bg-[var(--color-red)] text-white px-3 py-1 ink-border ml-3">
                        完了
                    </button>
                </div>
            `;
        });
    }
    html += '</div>';

    // 完了済みタスク
    html += '<div>';
    html += '<h3 class="text-lg font-bold text-[var(--color-yellow)] mb-2">🟡 完了済み (最近5件)</h3>';
    // text-gray-500 -> text-black, bg-gray-100 -> bg-[var(--color-yellow)]/50, bg-gray-300 -> bg-black/20 に変更
    completedTasks.slice(0, 5).forEach(task => {
        const actualEnd = new Date(task.actualEnd);
        const completedTime = `${actualEnd.getMonth() + 1}/${actualEnd.getDate()} ${String(actualEnd.getHours()).padStart(2, '0')}:${String(actualEnd.getMinutes()).padStart(2, '0')}`;
        // タグクラスを取得
        const tagKey = task.tag || 'white';
        const accentClass = getTagAccentClass(tagKey);

        html += `
            <div class="ink-border p-3 mb-2 flex justify-between items-center bg-[var(--color-yellow)]/50 line-through text-black cursor-pointer steamboat-button relative overflow-hidden" onclick="window.showEventDetails(${task.id})">
                <!-- タグ色を左の太線で強調 (border-l-4を直接使用) -->
                <div class="absolute top-0 left-0 h-full w-2 ${accentClass} border-l-4"></div>
                <div class="flex-1 ml-3">
                    <p class="font-bold">${task.title}</p>
                    <p class="text-xs">完了: ${completedTime} ${getTagHtml(task.tag)}</p>
                </div>
                <button onclick="event.stopPropagation(); window.toggleTask(${task.id})" class="steamboat-button bg-black/20 text-black px-3 py-1 ink-border ml-3 text-xs">
                    戻す
                </button>
            </div>
        `;
    });
    html += '</div>';

    viewContainer.innerHTML = html;
}

/**
 * 日誌ビューのレンダリング
 */
function renderLogView() {
    // 完了した予定とタスクを結合し、実測時間（actualEnd）または終了時間（end）でソート
    const completedEvents = appData.schedules
        .filter(e => e.type === 'schedule' || (e.type === 'task' && e.completed))
        .map(e => ({
            ...e,
            logTime: new Date(e.actualEnd || e.end) // タスクはactualEnd、予定はendを使用
        }))
        .sort((a, b) => b.logTime.getTime() - a.logTime.getTime());

    let html = '<h2 class="text-xl font-extrabold ink-border-b pb-2 mb-4">日誌 (タイムライン振り返り)</h2>';

    if (completedEvents.length === 0) {
        html += '<p class="text-black italic">まだ記録された日誌はありません。予定を完了させましょう。</p>';
    } else {
        html += '<div class="relative border-l-4 border-[var(--color-black)] ml-6 p-2">';

        let lastDate = null;

        completedEvents.forEach(e => {
            const logDate = e.logTime;
            const logTimeStr = `${String(logDate.getHours()).padStart(2, '0')}:${String(logDate.getMinutes()).padStart(2, '0')}`;
            const dateStr = `${logDate.getFullYear()}/${logDate.getMonth() + 1}/${logDate.getDate()}`;

            // 日付の区切り線
            if (dateStr !== lastDate) {
                html += `
                    <div class="relative my-4">
                        <div class="absolute -left-8 top-1/2 w-4 h-4 rounded-full bg-[var(--color-red)] ink-border transform -translate-y-1/2"></div>
                        <h3 class="ml-4 font-extrabold text-sm bg-white text-black inline-block px-2 py-0.5 ink-border-b">${dateStr}</h3>
                    </div>
                `;
                lastDate = dateStr;
            }

            // イベントアイテム
            // 黒ベースのアイテムを作成し、タグ色を左帯として利用
            const tagKey = e.tag || 'black';
            const accentClass = getTagAccentClass(tagKey);

            html += `
                <div class="relative mb-6">
                    <!-- タイムラインの丸ポチ -->
                    <div class="absolute -left-8 top-0 w-3 h-3 rounded-full bg-[var(--color-black)] transform translate-x-[2px] mt-1"></div>
                    <div class="ml-4 p-3 ink-border bg-black text-white shadow-lg steamboat-button relative overflow-hidden" onclick="window.showEventDetails(${e.id})">
                         <!-- タグ色を左の太線で強調 -->
                        <div class="absolute top-0 left-0 h-full w-2 ${accentClass} border-l-4"></div>
                        <div class="ml-3">
                             <p class="text-xs font-bold mb-1">${logTimeStr} - ${e.type === 'task' ? 'タスク完了' : '予定終了'} ${getTagHtml(e.tag)}</p>
                            <p class="text-lg font-extrabold">${e.title}</p>
                            <p class="text-xs mt-1">⏰ 予定時間: ${durationHours} 時間</p>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    viewContainer.innerHTML = html;
}

/**
 * 日付の変更 (月ビューと週ビューの移動)
 * @param {number} offset - -1 (前へ) または 1 (次へ)
 */
window.changeDate = function(offset) {
    const currentView = appData.currentView;
    let newDate = new Date(appData.currentDate);

    if (currentView === 'month') {
        newDate.setMonth(newDate.getMonth() + offset);
    } else if (currentView === 'week') {
        newDate.setDate(newDate.getDate() + (offset * 7));
    } else {
        // タスクと日誌ビューでは変更なし
        return;
    }

    appData.currentDate = newDate;
    renderView(currentView);
}

// =======================================================
// 6. 初期化と実行
// =======================================================

/**
 * 初期データを作成 (デモ用) - 予定が取得できなかった場合の空の状態を設定
 */
function initializeDemoData() {
    // データを空の状態にリセット
    appData = {
        schedules: [], // スケジュールを空にする
        currentView: appData.currentView || "month",
        lastId: 0,
        currentDate: new Date() 
    };
    console.log("データロードに失敗したため、スケジュールを空の状態で開始します。");
}

// アプリケーションの開始
window.onload = async function() {
    // グローバル関数を定義
    window.saveEvent = saveEvent;
    window.deleteEvent = deleteEvent;
    window.toggleTask = toggleTask;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.showEventForm = showEventForm;
    window.showEventDetails = showEventDetails;
    window.showCustomMessageBox = showCustomMessageBox;
    
    // データロード (JSON Binから)
    await loadData(); 

    // 現在時刻の更新ループ
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // 初期ビューのレンダリング
    renderView(appData.currentView);
};
