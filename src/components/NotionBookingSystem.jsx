import React, { useState, useEffect } from 'react';

const NotionBookingSystem = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookingData, setBookingData] = useState({});
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [xLink, setXLink] = useState(''); // Xリンク用の状態を追加
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  
  // Notionからカレンダーデータを取得
  const [notionEvents, setNotionEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // 初回読み込み中フラグ

  // システム設定（コードで直接変更）
  const settings = {
    immediateButtonText: '今すぐ予約する',
    startHour: 11,
    endHour: 21,
    systemTitle: '予約システム',
    description: 'ご希望の日時を選択してください'
  };

  // 祝日リスト（2025年の日本の祝日）
  const holidays2025 = [
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23',
    '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04',
    '2025-05-05', '2025-07-21', '2025-08-11', '2025-09-15',
    '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23',
  ];

  // Notion API設定
  const CALENDAR_DATABASE_ID = '1fa44ae2d2c780a5b27dc7aae5bae1aa';

  // 平日のみの週の日付を生成（土日を除外）
  const getCurrentWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + (weekOffset * 7));
    
    const weekDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  // 祝日かどうかをチェック
  const isHoliday = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return holidays2025.includes(dateString);
  };

  // 時間スロットを生成（1時間ごと）
  const generateTimeSlots = (startHour, endHour) => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      slots.push(time);
    }
    return slots;
  };

  const weekDates = getCurrentWeekDates();
  const timeSlots = generateTimeSlots(settings.startHour, settings.endHour);

  // Notionからカレンダーイベントを取得
  const fetchNotionCalendar = async () => {
    try {
      setIsLoading(true);
      if (isInitialLoading) {
        setIsInitialLoading(true);
      }
      
      const response = await fetch('/.netlify/functions/notion-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          databaseId: CALENDAR_DATABASE_ID,
          filter: {
            property: '予定日',
            date: {
              on_or_after: weekDates[0].toISOString().split('T')[0],
              on_or_before: weekDates[4].toISOString().split('T')[0]
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Notion APIエラー');
      }

      const data = await response.json();
      console.log('Notionから取得したイベント:', data.results);
      setNotionEvents(data.results || []);

    } catch (error) {
      console.error('Notionカレンダーの取得に失敗:', error);
      setNotionEvents([]);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  // Notionに新しい予約を追加
  const createNotionEvent = async (bookingData) => {
    try {
      const properties = {
        '名前': {
          title: [
            {
              text: {
                content: bookingData.customerName
              }
            }
          ]
        },
        '予定日': {
          date: {
            start: `${bookingData.date}T${bookingData.time}:00+09:00`,
            end: `${bookingData.date}T${String(parseInt(bookingData.time.split(':')[0]) + 1).padStart(2, '0')}:00+09:00`
          }
        },
        'X': {
          url: bookingData.xLink
        },
        '対応者': {
          people: [
            {
              id: '1ffd872b-594c-8107-b306-000269021f07'
            }
          ]
        }
      };

      const response = await fetch('/.netlify/functions/notion-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: CALENDAR_DATABASE_ID },
          properties: properties
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Notion APIエラー詳細:', errorData);
        throw new Error('Notion APIエラー');
      }

      const result = await response.json();
      console.log('Notionに予約を作成:', result);
      return true;
    } catch (error) {
      console.error('Notion予約作成エラー:', error);
      return false;
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (weekDates && weekDates.length > 0) {
      fetchNotionCalendar();
    }
  }, [weekOffset]);

  // 修正版: Notionのイベントと照合して予約状況を確認（時間枠の重複を厳密にチェック）
  const getBookingStatus = (date, time) => {
    if (isHoliday(date)) {
      return 'holiday';
    }
    
    const dateString = date.toISOString().split('T')[0];
    const timeHour = parseInt(time.split(':')[0]);
    
    // 予約したい時間枠の開始時刻と終了時刻
    const slotStart = new Date(`${dateString}T${time}:00`);
    const slotEnd = new Date(`${dateString}T${String(timeHour + 1).padStart(2, '0')}:00`);
    
    // 対面通話の前後2時間をブロックするチェック
    const hasBlockedTimeForInPerson = notionEvents.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      const callMethod = event.properties['通話方法']?.select?.name;
      
      console.log('通話方法チェック:', callMethod, 'イベント:', event.properties['名前']?.title?.[0]?.text?.content);
      
      if (!eventStart || callMethod !== '対面') return false;
      
      const existingStart = new Date(eventStart);
      let existingEnd;
      
      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        // 終了時刻が設定されていない場合は1時間後とする
        existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);
      }
      
      // 対面通話の前後2時間をブロック（ミリ秒単位で計算）
      const blockStart = new Date(existingStart.getTime() - 2 * 60 * 60 * 1000); // 2時間前
      const blockEnd = new Date(existingEnd.getTime() + 2 * 60 * 60 * 1000); // 2時間後
      
      console.log('対面通話検出 - ブロック範囲:', {
        original: `${existingStart.toLocaleTimeString()} - ${existingEnd.toLocaleTimeString()}`,
        blocked: `${blockStart.toLocaleTimeString()} - ${blockEnd.toLocaleTimeString()}`,
        checking: `${slotStart.toLocaleTimeString()} - ${slotEnd.toLocaleTimeString()}`,
        slotTime: time
      });
      
      // ブロック時間帯と予約したい時間枠が重複するかチェック
      const isBlocked = (blockStart < slotEnd && blockEnd > slotStart);
      if (isBlocked) {
        console.log(`時間 ${time} は対面通話のためブロック`);
      }
      return isBlocked;
    });
    
    if (hasBlockedTimeForInPerson) return 'booked';
    
    const hasNotionEvent = notionEvents.some(event => {
      const eventStart = event.properties['予定日']?.date?.start;
      const eventEnd = event.properties['予定日']?.date?.end;
      
      if (!eventStart) return false;
      
      const existingStart = new Date(eventStart);
      let existingEnd;
      
      if (eventEnd) {
        existingEnd = new Date(eventEnd);
      } else {
        // 終了時刻が設定されていない場合は1時間後とする
        existingEnd = new Date(existingStart);
        existingEnd.setHours(existingEnd.getHours() + 1);
      }
      
      // 重複判定: 既存の予定が予約したい時間枠と重複するかどうか
      // 重複する条件:
      // 1. 既存の予定の開始時刻が時間枠内にある
      // 2. 既存の予定の終了時刻が時間枠内にある  
      // 3. 既存の予定が時間枠を完全に包含する
      return (
        (existingStart < slotEnd && existingEnd > slotStart) // 時間枠に重複がある
      );
    });
    
    if (hasNotionEvent) return 'booked';
    
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${time}`;
    return bookingData[key] || 'available';
  };

  // 日付選択時の処理
  const handleDateSelect = (date) => {
    // 読み込み中は操作を無効化
    if (isInitialLoading) {
      alert('データを読み込み中です。しばらくお待ちください。');
      return;
    }
    
    // 祝日の場合はエラーメッセージを表示
    if (isHoliday(date)) {
      alert('祝日は予約できません。他の日付を選択してください。');
      return;
    }
    
    // 満員の場合もエラーメッセージを表示
    if (getDateStatus(date) === 'full') {
      alert('選択した日付は満員です。他の日付を選択してください。');
      return;
    }
    
    setSelectedDate(date);
    setShowTimeSlots(true);
  };

  // 時間選択時の処理
  const handleTimeSelect = (time) => {
    // 読み込み中は操作を無効化
    if (isInitialLoading) {
      alert('データを読み込み中です。しばらくお待ちください。');
      return;
    }
    
    const status = getBookingStatus(selectedDate, time);
    if (status === 'available') {
      setSelectedTime(time);
      setShowBookingForm(true);
    } else {
      alert('選択した時間帯は予約できません。他の時間を選択してください。');
    }
  };

  // 予約処理
  const handleBooking = async () => {
    // 予約前に再度重複チェック
    await fetchNotionCalendar();
    
    // 選択した日時が祝日でないか再確認
    if (isHoliday(selectedDate)) {
      alert('エラー: 祝日は予約できません。');
      setShowBookingForm(false);
      setShowTimeSlots(false);
      setSelectedDate(null);
      setSelectedTime(null);
      return;
    }
    
    // 最新のデータで重複チェック
    const currentStatus = getBookingStatus(selectedDate, selectedTime);
    if (currentStatus !== 'available') {
      alert('エラー: 選択した時間帯は既に予約済みです。他の時間を選択してください。');
      setShowBookingForm(false);
      setSelectedTime(null);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const bookingDataObj = {
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        customerName: customerName,
        xLink: xLink // Xリンクを追加
      };
      
      const success = await createNotionEvent(bookingDataObj);
      
      if (success) {
        const bookingKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}-${selectedTime}`;
        setBookingData(prev => ({
          ...prev,
          [bookingKey]: 'booked'
        }));
        
        setShowBookingForm(false);
        setShowTimeSlots(false);
        setSelectedDate(null);
        setSelectedTime(null);
        setCustomerName('');
        setXLink(''); // Xリンクもリセット
        
        alert('予約が完了しました！');
        await fetchNotionCalendar();
      } else {
        alert('予約の作成に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('予約エラー:', error);
      alert('予約の作成に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  const getDayName = (date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  const getDateStatus = (date) => {
    if (isHoliday(date)) return 'holiday';
    
    const availableSlots = timeSlots.filter(time => 
      getBookingStatus(date, time) === 'available'
    ).length;
    
    if (availableSlots === 0) return 'full';
    if (availableSlots <= 3) return 'few';
    return 'available';
  };

  const getDateStatusText = (date) => {
    const status = getDateStatus(date);
    switch (status) {
      case 'holiday': return '休業';
      case 'full': return '×';
      case 'few': return '△';
      case 'available': return '○';
      default: return '○';
    }
  };

  const getDateColor = (date) => {
    const status = getDateStatus(date);
    const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();
    
    if (isSelected) return 'bg-blue-500 text-white border-blue-500';
    
    switch (status) {
      case 'holiday': return 'bg-gray-200 text-gray-500 border-gray-300';
      case 'full': return 'bg-red-50 text-red-600 border-red-200';
      case 'few': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'available': return 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100';
      default: return 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 sticky top-0 z-40">
          <div className="text-center">
            <h1 className="text-xl font-bold">{settings.systemTitle}</h1>
            <p className="text-blue-100 text-sm mt-1">{settings.description}</p>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="p-4">
          {!showTimeSlots && !showBookingForm && (
            <>
              {/* 週選択 */}
              <div className="flex justify-between items-center mb-4 bg-white rounded-lg shadow-sm border p-3">
                <button 
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  disabled={isInitialLoading}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 前週
                </button>
                <span className="font-bold text-gray-800">
                  {weekDates && weekDates.length > 0 ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[4])}` : '読み込み中...'}
                </span>
                <button 
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  disabled={isInitialLoading}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  翌週 →
                </button>
              </div>

              {/* 凡例 */}
              <div className="bg-white rounded-lg shadow-sm border p-3 mb-4">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center">
                    <span className="w-4 h-4 bg-green-50 border border-green-200 rounded mr-1"></span>
                    <span className="text-gray-600">○ 空あり</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-4 h-4 bg-orange-50 border border-orange-200 rounded mr-1"></span>
                    <span className="text-gray-600">△ 残少</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-4 h-4 bg-red-50 border border-red-200 rounded mr-1"></span>
                    <span className="text-gray-600">× 満員</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-4 h-4 bg-gray-200 border border-gray-300 rounded mr-1"></span>
                    <span className="text-gray-600">休業</span>
                  </div>
                </div>
              </div>

              {/* 日付選択 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-gray-800 mb-3">📅 日付を選択</h2>
                
                {/* 読み込み中の表示 */}
                {isInitialLoading && (
                  <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-blue-600 font-bold mb-2">読み込み中...</div>
                    <div className="text-blue-500 text-sm">データを読み込んでいます。しばらくお待ちください。</div>
                  </div>
                )}
                
                {weekDates.map((date, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateSelect(date)}
                    disabled={isInitialLoading || isHoliday(date) || getDateStatus(date) === 'full'}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${isInitialLoading ? 'opacity-50' : ''} ${getDateColor(date)} ${isInitialLoading || isHoliday(date) || getDateStatus(date) === 'full' ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg">
                          {formatDate(date)} ({getDayName(date)})
                        </div>
                        <div className="text-sm opacity-75">
                          {formatFullDate(date)}
                        </div>
                      </div>
                      <div className="text-2xl font-bold">
                        {isInitialLoading ? '...' : getDateStatusText(date)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 時間選択画面 */}
          {showTimeSlots && !showBookingForm && (
            <div>
              <div className="flex items-center mb-4">
                <button
                  onClick={() => {
                    setShowTimeSlots(false);
                    setSelectedDate(null);
                  }}
                  className="mr-3 p-2 text-gray-600"
                >
                  ← 戻る
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">⏰ 時間を選択</h2>
                  <p className="text-sm text-gray-600">
                    {selectedDate && formatFullDate(selectedDate)} ({selectedDate && getDayName(selectedDate)})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {timeSlots.map((time) => {
                  const status = getBookingStatus(selectedDate, time);
                  const isAvailable = status === 'available';
                  
                  return (
                    <button
                      key={time}
                      onClick={() => handleTimeSelect(time)}
                      disabled={!isAvailable}
                      className={`p-4 rounded-lg border-2 font-bold text-lg transition-all ${
                        isAvailable
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 active:scale-95'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <div>{time}</div>
                      <div className="text-xs mt-1">
                        {isAvailable ? '予約可能' : '予約済み'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 予約フォーム */}
          {showBookingForm && (
            <div>
              <div className="flex items-center mb-4">
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setSelectedTime(null);
                  }}
                  className="mr-3 p-2 text-gray-600"
                >
                  ← 戻る
                </button>
                <h2 className="text-lg font-bold text-gray-800">📝 予約情報入力</h2>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="font-bold text-blue-800 mb-2">予約内容確認</div>
                <div className="text-blue-700">
                  📅 {selectedDate && formatFullDate(selectedDate)} ({selectedDate && getDayName(selectedDate)})
                </div>
                <div className="text-blue-700">
                  ⏰ {selectedTime}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-700 font-bold mb-3">お名前 *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                    placeholder="お名前を入力してください"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-3">Xリンク *</label>
                  <input
                    type="url"
                    value={xLink}
                    onChange={(e) => setXLink(e.target.value)}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                    placeholder="https://x.com/username"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowBookingForm(false)}
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-bold text-lg"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={!customerName.trim() || !xLink.trim() || isLoading}
                    className="flex-1 py-4 bg-red-500 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                  >
                    {isLoading ? '予約中...' : '予約確定'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 bg-gray-100 text-center text-xs text-gray-600">
          <p>予約は1時間単位です（平日のみ）</p>
          <p>営業時間：{settings.startHour}:00 - {settings.endHour}:00</p>
        </div>
      </div>
    </div>
  );
};

export default NotionBookingSystem;