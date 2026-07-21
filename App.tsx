import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as NavigationBar from 'expo-navigation-bar';
import * as Sharing from 'expo-sharing';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Screen = 'home' | 'food' | 'exercise' | 'stats' | 'settings';
type StatsTab = 'food' | 'exercise';
type WorkoutType = '주짓수' | '유도' | '유산소' | '튜브' | '기타';

type NutritionRow = { item: string; taken: number };
type WorkoutRow = {
  id: number;
  workout_type: WorkoutType;
  category: string;
  detail: string;
  amount: number | null;
  completed: number;
};
type CalendarWorkoutRow = { log_date: string; workout_type: '주짓수' | '유도' };
type CalendarMarkers = Record<string, { jiuJitsu: boolean; judo: boolean }>;

const NUTRIENTS = ['비타민 C', '비타민 D', '오메가3', '마그네슘', '크레아틴', '아연', '단백질'];
const WORKOUT_TYPES: WorkoutType[] = ['주짓수', '유도', '유산소', '튜브', '기타'];
const CATEGORIES: Record<WorkoutType, string[]> = {
  주짓수: ['가드', '패스', '스탠딩'],
  유도: ['손기술', '허리기술', '발기술', '연결기술'],
  유산소: ['런닝', '계단'],
  튜브: [],
  기타: [],
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const koreanDate = (date: Date) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(date);

async function migrate(db: any) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS nutrition_logs (
      log_date TEXT NOT NULL,
      item TEXT NOT NULL,
      taken INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (log_date, item)
    );
    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date TEXT NOT NULL,
      workout_type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      amount INTEGER,
      completed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_workout_date ON workout_logs(log_date);
  `);
}

export default function App() {
  return (
    <SQLiteProvider databaseName="daily-training.db" onInit={migrate}>
      <AppContent />
    </SQLiteProvider>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'home') {
        setScreen('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [screen]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hideNavigation = () => NavigationBar.setVisibilityAsync('hidden').catch(() => undefined);
    hideNavigation();
    const keyboardSubscription = Keyboard.addListener('keyboardDidHide', hideNavigation);
    const appStateSubscription = AppState.addEventListener('change', (state) => state === 'active' && hideNavigation());
    return () => { keyboardSubscription.remove(); appStateSubscription.remove(); };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {screen === 'home' ? (
          <Home now={now} onNavigate={setScreen} />
        ) : (
          <View style={styles.page}>
            <Header title={{ food: '오늘의 음식', exercise: '오늘의 운동', stats: '기록 통계', settings: '설정' }[screen]} onBack={() => setScreen('home')} />
            {screen === 'food' && <FoodScreen selectedDate={dateKey()} />}
            {screen === 'exercise' && <ExerciseScreen selectedDate={dateKey()} />}
            {screen === 'stats' && <StatsScreen />}
            {screen === 'settings' && <SettingsScreen />}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Home({ now, onNavigate }: { now: Date; onNavigate: (screen: Screen) => void }) {
  return (
    <View style={styles.home}>
      <Pressable style={styles.settingsButton} onPress={() => onNavigate('settings')} hitSlop={10}>
        <Text style={styles.settingsIcon}>⚙</Text>
      </Pressable>
      <View>
        <Text style={styles.eyebrow}>DAILY TRAINING</Text>
        <Text style={styles.date}>{koreanDate(now)}</Text>
        <Text style={styles.time}>{`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`}</Text>
      </View>

      <View style={styles.homeActions}>
        <View style={styles.sideActions}>
          <HomeButton icon="🥗" label="음식" onPress={() => onNavigate('food')} />
          <HomeButton icon="📊" label="통계" onPress={() => onNavigate('stats')} />
        </View>
        <Pressable style={({ pressed }) => [styles.exerciseButton, pressed && styles.pressed]} onPress={() => onNavigate('exercise')}>
          <Text style={styles.exerciseIcon}>🥋</Text>
          <Text style={styles.exerciseLabel}>운동</Text>
          <Text style={styles.exerciseSub}>오늘도 한 걸음</Text>
        </Pressable>
      </View>
      <Text style={styles.homeHint}>기록은 이 휴대폰에 안전하게 저장됩니다.</Text>
    </View>
  );
}

function HomeButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.homeSmallButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.homeSmallIcon}>{icon}</Text>
      <Text style={styles.homeSmallLabel}>{label}</Text>
    </Pressable>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );
}

function FoodScreen({ selectedDate }: { selectedDate: string }) {
  const db = useSQLiteContext();
  const [values, setValues] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<NutritionRow>('SELECT item, taken FROM nutrition_logs WHERE log_date = ?', selectedDate);
    const next: Record<string, boolean> = {};
    NUTRIENTS.forEach((item) => (next[item] = rows.find((row) => row.item === item)?.taken === 1));
    setValues(next);
  }, [db, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    await db.withTransactionAsync(async () => {
      for (const item of NUTRIENTS) {
        await db.runAsync(
          `INSERT INTO nutrition_logs (log_date, item, taken) VALUES (?, ?, ?)
           ON CONFLICT(log_date, item) DO UPDATE SET taken = excluded.taken`,
          selectedDate, item, values[item] ? 1 : 0
        );
      }
    });
    Alert.alert('저장 완료', '오늘의 음식 기록을 저장했습니다.');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionIntro title="오늘 챙겨 먹었나요?" text="항목을 누르면 먹음/안 먹음이 바뀝니다." />
      {NUTRIENTS.map((item) => {
        const taken = !!values[item];
        return (
          <Pressable key={item} onPress={() => setValues((old) => ({ ...old, [item]: !old[item] }))}
            style={({ pressed }) => [styles.toggleRow, taken ? styles.taken : styles.notTaken, pressed && styles.pressed]}>
            <View style={[styles.statusDot, { backgroundColor: taken ? '#138A5B' : '#D44747' }]} />
            <Text style={styles.toggleName}>{item}</Text>
            <Text style={[styles.toggleStatus, { color: taken ? '#0B6B44' : '#A72E2E' }]}>{taken ? '먹음 ✓' : '안 먹음'}</Text>
          </Pressable>
        );
      })}
      <PrimaryButton label="오늘 기록 저장" onPress={save} />
    </ScrollView>
  );
}

function ExerciseScreen({ selectedDate }: { selectedDate: string }) {
  const db = useSQLiteContext();
  const [type, setType] = useState<WorkoutType>('주짓수');
  const [category, setCategory] = useState('가드');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState(1);
  const [tubeDone, setTubeDone] = useState(false);

  const chooseType = (next: WorkoutType) => {
    setType(next);
    setCategory(CATEGORIES[next][0] ?? '');
    setAmount(1);
    setDetail('');
  };

  const save = async () => {
    if (type === '기타' && !detail.trim()) {
      Alert.alert('내용을 입력해주세요', '어떤 운동을 했는지 적어주세요.');
      return;
    }
    await db.runAsync(
      'INSERT INTO workout_logs (log_date, workout_type, category, detail, amount, completed) VALUES (?, ?, ?, ?, ?, ?)',
      selectedDate, type, category, detail.trim(), type === '유산소' ? amount : null, type === '튜브' ? (tubeDone ? 1 : 0) : 1
    );
    setDetail('');
    Alert.alert('저장 완료', `${type} 기록을 저장했습니다.`);
  };

  const amountMax = category === '런닝' ? 10 : 5;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SectionIntro title="어떤 운동을 했나요?" text="종목과 세부 내용을 선택해 기록하세요." />
        <Text style={styles.fieldLabel}>운동 종목</Text>
        <ChoiceGrid values={WORKOUT_TYPES} selected={type} onSelect={(value) => chooseType(value as WorkoutType)} />

        {CATEGORIES[type].length > 0 && (
          <>
            <Text style={styles.fieldLabel}>{type === '유산소' ? '운동 방식' : '기술 분류'}</Text>
            <ChoiceGrid values={CATEGORIES[type]} selected={category} onSelect={setCategory} />
          </>
        )}

        {type === '유산소' && (
          <>
            <Text style={styles.fieldLabel}>{category === '런닝' ? '거리 (km)' : '27층 계단 횟수'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.numberRow}>
              {Array.from({ length: amountMax }, (_, i) => i + 1).map((number) => (
                <Pressable key={number} onPress={() => setAmount(number)} style={[styles.numberChip, amount === number && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, amount === number && styles.choiceTextSelected]}>{number}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {type === '튜브' ? (
          <Pressable onPress={() => setTubeDone(!tubeDone)} style={[styles.tubeToggle, tubeDone ? styles.taken : styles.notTaken]}>
            <Text style={styles.tubeIcon}>{tubeDone ? '✓' : '–'}</Text>
            <View><Text style={styles.toggleName}>튜브 운동</Text><Text style={styles.muted}>{tubeDone ? '오늘 완료했어요' : '아직 하지 않았어요'}</Text></View>
          </Pressable>
        ) : (
          <>
            <Text style={styles.fieldLabel}>{type === '기타' ? '운동 내용' : '오늘 배운 내용 / 메모'}</Text>
            <TextInput value={detail} onChangeText={setDetail} multiline textAlignVertical="top"
              placeholder={type === '기타' ? '예: 턱걸이 5회 × 3세트' : '오늘 수업에서 한 내용을 자유롭게 적어주세요.'}
              placeholderTextColor="#8A918C" style={styles.textArea} />
          </>
        )}
        <PrimaryButton label="운동 기록 저장" onPress={save} />
      </ScrollView>
    </View>
  );
}

function ChoiceGrid({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.choiceGrid}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onSelect(value)} style={[styles.choice, selected === value && styles.choiceSelected]}>
          <Text style={[styles.choiceText, selected === value && styles.choiceTextSelected]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatsScreen() {
  const db = useSQLiteContext();
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [tab, setTab] = useState<StatsTab>('food');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [markers, setMarkers] = useState<CalendarMarkers>({});
  const [markerRefreshKey, setMarkerRefreshKey] = useState(0);

  useEffect(() => {
    const loadMarkers = async () => {
      const monthStart = dateKey(month);
      const monthEnd = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1));
      const rows = await db.getAllAsync<CalendarWorkoutRow>(
        `SELECT DISTINCT log_date, workout_type
         FROM workout_logs
         WHERE log_date >= ? AND log_date < ? AND workout_type IN ('주짓수', '유도')`,
        monthStart, monthEnd
      );
      const next: CalendarMarkers = {};
      rows.forEach((row) => {
        next[row.log_date] ??= { jiuJitsu: false, judo: false };
        if (row.workout_type === '주짓수') next[row.log_date].jiuJitsu = true;
        if (row.workout_type === '유도') next[row.log_date].judo = true;
      });
      setMarkers(next);
    };
    loadMarkers();
  }, [db, month, markerRefreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <Calendar month={month} selected={selectedDate} markers={markers} onSelect={setSelectedDate} onMonth={setMonth} />
      <View style={styles.tabs}>
        {(['food', 'exercise'] as StatsTab[]).map((value) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabSelected]}>
            <Text style={[styles.tabText, tab === value && styles.tabTextSelected]}>{value === 'food' ? '음식' : '운동'}</Text>
          </Pressable>
        ))}
      </View>
      <DailyStats selectedDate={selectedDate} tab={tab} onWorkoutChanged={() => setMarkerRefreshKey((value) => value + 1)} />
    </ScrollView>
  );
}

function Calendar({ month, selected, markers, onSelect, onMonth }: { month: Date; selected: string; markers: CalendarMarkers; onSelect: (date: string) => void; onMonth: (date: Date) => void }) {
  const cells = useMemo(() => {
    const start = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(start).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={styles.monthArrow}>‹</Text></Pressable>
        <Text style={styles.monthTitle}>{month.getFullYear()}년 {month.getMonth() + 1}월</Text>
        <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={styles.monthArrow}>›</Text></Pressable>
      </View>
      <View style={styles.calendarGrid}>
        {weekdays.map((day, i) => <Text key={day} style={[styles.weekday, i === 0 && { color: '#D44747' }]}>{day}</Text>)}
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(day)}`;
          const active = key === selected;
          const marker = markers[key];
          return <Pressable key={key} onPress={() => onSelect(key)} style={[styles.dayCell, active && styles.daySelected]}>
            <View style={styles.dayNumberWrap}>
              <Text style={[styles.dayText, active && styles.dayTextSelected]}>{day}</Text>
              <View style={styles.calendarDots}>
                {marker?.jiuJitsu && <View style={[styles.calendarDot, styles.jiuJitsuDot]} />}
                {marker?.judo && <View style={[styles.calendarDot, styles.judoDot]} />}
              </View>
            </View>
          </Pressable>;
        })}
      </View>
      <View style={styles.calendarLegend}>
        <View style={styles.legendItem}><View style={[styles.calendarDot, styles.jiuJitsuDot]} /><Text style={styles.legendText}>주짓수</Text></View>
        <View style={styles.legendItem}><View style={[styles.calendarDot, styles.judoDot]} /><Text style={styles.legendText}>유도</Text></View>
      </View>
    </View>
  );
}

function DailyStats({ selectedDate, tab, onWorkoutChanged }: { selectedDate: string; tab: StatsTab; onWorkoutChanged: () => void }) {
  const db = useSQLiteContext();
  const [nutrition, setNutrition] = useState<NutritionRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [foodValues, setFoodValues] = useState<Record<string, boolean>>({});
  const [editingWorkout, setEditingWorkout] = useState<WorkoutRow | null>(null);
  const [addingWorkout, setAddingWorkout] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingWorkout || addingWorkout) {
        setEditingWorkout(null);
        setAddingWorkout(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [editingWorkout, addingWorkout]);

  useEffect(() => {
    const load = async () => {
      const foodRows = await db.getAllAsync<NutritionRow>('SELECT item, taken FROM nutrition_logs WHERE log_date = ? ORDER BY item', selectedDate);
      const workoutRows = await db.getAllAsync<WorkoutRow>('SELECT id, workout_type, category, detail, amount, completed FROM workout_logs WHERE log_date = ? ORDER BY id DESC', selectedDate);
      const next: Record<string, boolean> = {};
      NUTRIENTS.forEach((item) => (next[item] = foodRows.find((row) => row.item === item)?.taken === 1));
      setNutrition(foodRows);
      setFoodValues(next);
      setWorkouts(workoutRows);
    };
    load();
  }, [db, selectedDate, refreshKey]);

  useEffect(() => {
    setEditingWorkout(null);
    setAddingWorkout(false);
  }, [selectedDate, tab]);

  const reload = () => setRefreshKey((value) => value + 1);
  const reloadWorkouts = () => { reload(); onWorkoutChanged(); };
  const savePastFood = async () => {
    await db.withTransactionAsync(async () => {
      for (const item of NUTRIENTS) {
        await db.runAsync(
          `INSERT INTO nutrition_logs (log_date, item, taken) VALUES (?, ?, ?)
           ON CONFLICT(log_date, item) DO UPDATE SET taken = excluded.taken`,
          selectedDate, item, foodValues[item] ? 1 : 0
        );
      }
    });
    reload();
    Alert.alert('수정 완료', `${selectedDate} 음식 기록을 저장했습니다.`);
  };

  return (
    <View>
      <View style={styles.statsTitleRow}>
        <Text style={styles.statsDate}>{selectedDate} 기록</Text>
        {tab === 'exercise' && !addingWorkout && !editingWorkout && (
          <Pressable onPress={() => setAddingWorkout(true)} style={styles.addRecordButton}>
            <Text style={styles.addRecordText}>＋ 기록 추가</Text>
          </Pressable>
        )}
      </View>
      {tab === 'food' ? (
        <View>
          {nutrition.length === 0 && <Text style={styles.noRecordHint}>기록이 없습니다. 항목을 눌러 과거 기록을 등록할 수 있어요.</Text>}
          {NUTRIENTS.map((item) => {
            const taken = !!foodValues[item];
            return (
              <Pressable key={item} onPress={() => setFoodValues((old) => ({ ...old, [item]: !old[item] }))} style={styles.statRow}>
                <Text style={styles.statName}>{item}</Text>
                <Text style={{ color: taken ? '#138A5B' : '#D44747', fontWeight: '800' }}>{taken ? '먹음 ✓' : '안 먹음'}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={savePastFood} style={styles.compactSaveButton}><Text style={styles.compactSaveText}>변경사항 저장</Text></Pressable>
        </View>
      ) : (
        <View>
          {(addingWorkout || editingWorkout) && (
            <WorkoutEditor
              key={editingWorkout?.id ?? `new-${selectedDate}`}
              selectedDate={selectedDate}
              existing={editingWorkout}
              onCancel={() => { setAddingWorkout(false); setEditingWorkout(null); }}
              onSaved={() => { setAddingWorkout(false); setEditingWorkout(null); reloadWorkouts(); }}
            />
          )}
          {!addingWorkout && !editingWorkout && (workouts.length === 0 ? <Empty text="저장된 운동 기록이 없습니다." /> : workouts.map((row) => (
            <View key={row.id} style={styles.workoutCard}>
              <View style={styles.workoutCardHeader}>
                <Text style={styles.workoutType}>{row.workout_type} <Text style={styles.workoutCategory}>{row.category}</Text></Text>
                <Pressable onPress={() => setEditingWorkout(row)} hitSlop={10}><Text style={styles.editLink}>수정</Text></Pressable>
              </View>
              {row.workout_type === '유산소' && <Text style={styles.workoutDetail}>{row.category === '런닝' ? `${row.amount} km` : `27층 × ${row.amount}회`}</Text>}
              {row.workout_type === '튜브' && <Text style={styles.workoutDetail}>{row.completed ? '완료' : '하지 않음'}</Text>}
              {!!row.detail && <Text style={styles.workoutDetail}>{row.detail}</Text>}
            </View>
          )))}
        </View>
      )}
    </View>
  );
}

function WorkoutEditor({ selectedDate, existing, onCancel, onSaved }: {
  selectedDate: string; existing: WorkoutRow | null; onCancel: () => void; onSaved: () => void;
}) {
  const db = useSQLiteContext();
  const [type, setType] = useState<WorkoutType>(existing?.workout_type ?? '주짓수');
  const [category, setCategory] = useState(existing?.category || CATEGORIES[existing?.workout_type ?? '주짓수'][0] || '');
  const [detail, setDetail] = useState(existing?.detail ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 1);
  const [tubeDone, setTubeDone] = useState(existing ? existing.completed === 1 : false);

  const chooseType = (next: WorkoutType) => {
    setType(next); setCategory(CATEGORIES[next][0] ?? ''); setAmount(1); setDetail(''); setTubeDone(false);
  };
  const save = async () => {
    if (type === '기타' && !detail.trim()) return Alert.alert('내용을 입력해주세요', '어떤 운동을 했는지 적어주세요.');
    const params = [type, category, detail.trim(), type === '유산소' ? amount : null, type === '튜브' ? (tubeDone ? 1 : 0) : 1];
    if (existing) {
      await db.runAsync('UPDATE workout_logs SET workout_type = ?, category = ?, detail = ?, amount = ?, completed = ? WHERE id = ?', ...params, existing.id);
    } else {
      await db.runAsync('INSERT INTO workout_logs (workout_type, category, detail, amount, completed, log_date) VALUES (?, ?, ?, ?, ?, ?)', ...params, selectedDate);
    }
    Alert.alert(existing ? '수정 완료' : '등록 완료', `${selectedDate} 운동 기록을 저장했습니다.`);
    onSaved();
  };
  const remove = () => existing && Alert.alert('기록을 삭제할까요?', '삭제한 기록은 백업이 없으면 되돌릴 수 없습니다.', [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: async () => { await db.runAsync('DELETE FROM workout_logs WHERE id = ?', existing.id); onSaved(); } },
  ]);
  const amountMax = category === '런닝' ? 10 : 5;

  return (
    <View style={styles.editorCard}>
      <Text style={styles.editorTitle}>{existing ? '운동 기록 수정' : '지난 운동 기록 추가'}</Text>
      <Text style={styles.editorDate}>{selectedDate}</Text>
      <Text style={styles.fieldLabel}>운동 종목</Text>
      <ChoiceGrid values={WORKOUT_TYPES} selected={type} onSelect={(value) => chooseType(value as WorkoutType)} />
      {CATEGORIES[type].length > 0 && <><Text style={styles.fieldLabel}>{type === '유산소' ? '운동 방식' : '기술 분류'}</Text><ChoiceGrid values={CATEGORIES[type]} selected={category} onSelect={setCategory} /></>}
      {type === '유산소' && <><Text style={styles.fieldLabel}>{category === '런닝' ? '거리 (km)' : '27층 계단 횟수'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.numberRow}>
        {Array.from({ length: amountMax }, (_, i) => i + 1).map((number) => <Pressable key={number} onPress={() => setAmount(number)} style={[styles.numberChip, amount === number && styles.choiceSelected]}><Text style={[styles.choiceText, amount === number && styles.choiceTextSelected]}>{number}</Text></Pressable>)}
      </ScrollView></>}
      {type === '튜브' ? <Pressable onPress={() => setTubeDone(!tubeDone)} style={[styles.tubeToggle, tubeDone ? styles.taken : styles.notTaken]}><Text style={styles.tubeIcon}>{tubeDone ? '✓' : '–'}</Text><View><Text style={styles.toggleName}>튜브 운동</Text><Text style={styles.muted}>{tubeDone ? '완료' : '하지 않음'}</Text></View></Pressable> : <><Text style={styles.fieldLabel}>{type === '기타' ? '운동 내용' : '수업 내용 / 메모'}</Text><TextInput value={detail} onChangeText={setDetail} multiline textAlignVertical="top" placeholder="운동 내용을 입력해주세요." placeholderTextColor="#8A918C" style={styles.textArea} /></>}
      <View style={styles.editorActions}>
        <Pressable onPress={onCancel} style={styles.editorCancel}><Text style={styles.editorCancelText}>취소</Text></Pressable>
        {existing && <Pressable onPress={remove} style={styles.editorDelete}><Text style={styles.editorDeleteText}>삭제</Text></Pressable>}
        <Pressable onPress={save} style={styles.editorSave}><Text style={styles.editorSaveText}>{existing ? '수정 저장' : '등록'}</Text></Pressable>
      </View>
    </View>
  );
}

type NutritionExportRow = { log_date: string; item: string; taken: number };
type WorkoutExportRow = WorkoutRow & { log_date: string; created_at: string };
type BackupData = {
  format: 'daily-training-backup';
  version: 1;
  exportedAt: string;
  nutritionLogs: Array<{ log_date: string; item: string; taken: boolean }>;
  workoutLogs: Array<Omit<WorkoutExportRow, 'completed'> & { completed: boolean }>;
};

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
}

function SettingsScreen() {
  const db = useSQLiteContext();
  const [exporting, setExporting] = useState(false);

  const getAllData = async () => {
    const nutrition = await db.getAllAsync<NutritionExportRow>('SELECT log_date, item, taken FROM nutrition_logs ORDER BY log_date, item');
    const workouts = await db.getAllAsync<WorkoutExportRow>(
      'SELECT id, log_date, workout_type, category, detail, amount, completed, created_at FROM workout_logs ORDER BY log_date, id'
    );
    return { nutrition, workouts };
  };

  const shareFile = async (filename: string, content: string, mimeType: string) => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('이 기기에서는 파일 공유 기능을 사용할 수 없습니다.');
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(content);
    await Sharing.shareAsync(file.uri, { dialogTitle: '운동 기록 백업 저장', mimeType });
  };

  const exportJson = async () => {
    try {
      setExporting(true);
      const data = await getAllData();
      const backup = {
        format: 'daily-training-backup', version: 1, exportedAt: new Date().toISOString(),
        nutritionLogs: data.nutrition.map((row) => ({ ...row, taken: row.taken === 1 })),
        workoutLogs: data.workouts.map((row) => ({ ...row, completed: row.completed === 1 })),
      };
      await shareFile(`daily-training-backup-${dateKey()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    } catch (error) {
      Alert.alert('내보내기 실패', error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.');
    } finally { setExporting(false); }
  };

  const exportCsv = async (kind: 'nutrition' | 'workout') => {
    try {
      setExporting(true);
      const data = await getAllData();
      if (kind === 'nutrition') {
        const rows = data.nutrition.map((row) => ({ 날짜: row.log_date, 항목: row.item, 섭취여부: row.taken ? '먹음' : '안 먹음' }));
        await shareFile(`daily-training-food-${dateKey()}.csv`, toCsv(['날짜', '항목', '섭취여부'], rows), 'text/csv');
      } else {
        const rows = data.workouts.map((row) => ({
          날짜: row.log_date, 운동종목: row.workout_type, 분류: row.category, 내용: row.detail,
          수치: row.amount, 완료여부: row.completed ? '완료' : '안 함', 저장시각: row.created_at,
        }));
        await shareFile(`daily-training-workout-${dateKey()}.csv`, toCsv(['날짜', '운동종목', '분류', '내용', '수치', '완료여부', '저장시각'], rows), 'text/csv');
      }
    } catch (error) {
      Alert.alert('내보내기 실패', error instanceof Error ? error.message : 'CSV 파일을 만들지 못했습니다.');
    } finally { setExporting(false); }
  };

  const validateBackup = (value: unknown): BackupData => {
    if (!value || typeof value !== 'object') throw new Error('JSON 파일의 구조가 올바르지 않습니다.');
    const data = value as Partial<BackupData>;
    if (data.format !== 'daily-training-backup' || data.version !== 1) throw new Error('오늘운동 앱에서 만든 백업 파일이 아닙니다.');
    if (!Array.isArray(data.nutritionLogs) || !Array.isArray(data.workoutLogs)) throw new Error('백업 기록 목록이 없습니다.');
    const validDate = /^\d{4}-\d{2}-\d{2}$/;
    const nutritionValid = data.nutritionLogs.every((row) => row && validDate.test(row.log_date) && typeof row.item === 'string' && typeof row.taken === 'boolean');
    const workoutsValid = data.workoutLogs.every((row) => row && validDate.test(row.log_date) && WORKOUT_TYPES.includes(row.workout_type) &&
      typeof row.category === 'string' && typeof row.detail === 'string' && (row.amount === null || typeof row.amount === 'number') &&
      typeof row.completed === 'boolean' && typeof row.created_at === 'string');
    if (!nutritionValid || !workoutsValid) throw new Error('백업 안에 손상되었거나 지원하지 않는 기록이 있습니다.');
    return data as BackupData;
  };

  const restoreBackup = async (data: BackupData, mode: 'merge' | 'replace') => {
    try {
      setExporting(true);
      await db.withTransactionAsync(async () => {
        if (mode === 'replace') {
          await db.runAsync('DELETE FROM nutrition_logs');
          await db.runAsync('DELETE FROM workout_logs');
        }
        for (const row of data.nutritionLogs) {
          await db.runAsync(
            `INSERT INTO nutrition_logs (log_date, item, taken) VALUES (?, ?, ?)
             ON CONFLICT(log_date, item) DO UPDATE SET taken = excluded.taken`,
            row.log_date, row.item, row.taken ? 1 : 0
          );
        }
        for (const row of data.workoutLogs) {
          await db.runAsync(
            `INSERT INTO workout_logs (log_date, workout_type, category, detail, amount, completed, created_at)
             SELECT ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM workout_logs
               WHERE log_date = ? AND workout_type = ? AND category = ? AND detail = ?
                 AND amount IS ? AND completed = ? AND created_at = ?
             )`,
            row.log_date, row.workout_type, row.category, row.detail, row.amount, row.completed ? 1 : 0, row.created_at,
            row.log_date, row.workout_type, row.category, row.detail, row.amount, row.completed ? 1 : 0, row.created_at
          );
        }
      });
      Alert.alert('복원 완료', `음식 ${data.nutritionLogs.length}개, 운동 ${data.workoutLogs.length}개 기록을 ${mode === 'merge' ? '병합' : '복원'}했습니다.`);
    } catch (error) {
      Alert.alert('복원 실패', error instanceof Error ? error.message : '기록을 복원하지 못했습니다. 기존 데이터는 변경되지 않았습니다.');
    } finally { setExporting(false); }
  };

  const chooseBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('백업 파일이 너무 큽니다. 10MB 이하 파일을 선택해주세요.');
      const raw = await new File(asset.uri).text();
      const data = validateBackup(JSON.parse(raw));
      const message = `음식 ${data.nutritionLogs.length}개, 운동 ${data.workoutLogs.length}개 기록이 있습니다.`;
      Alert.alert('복원 방식 선택', `${message}\n\n병합은 현재 기록을 유지합니다.`, [
        { text: '취소', style: 'cancel' },
        { text: '병합', onPress: () => restoreBackup(data, 'merge') },
        { text: '전체 교체', style: 'destructive', onPress: () => Alert.alert(
          '정말 전체 교체할까요?', '현재 앱의 기록을 모두 삭제하고 백업 내용으로 교체합니다.',
          [{ text: '취소', style: 'cancel' }, { text: '교체하기', style: 'destructive', onPress: () => restoreBackup(data, 'replace') }]
        ) },
      ]);
    } catch (error) {
      const message = error instanceof SyntaxError ? 'JSON 파일을 읽을 수 없습니다.' : error instanceof Error ? error.message : '백업 파일을 열지 못했습니다.';
      Alert.alert('파일 확인 실패', message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionIntro title="백업 및 내보내기" text="전체 기록을 보관하거나 다른 앱에서 사용할 수 있습니다." />
      <View style={styles.exportCard}>
        <Text style={styles.exportIcon}>📦</Text>
        <View style={styles.exportCopy}>
          <Text style={styles.exportTitle}>전체 백업 파일</Text>
          <Text style={styles.exportDescription}>음식과 운동 기록을 하나의 JSON 파일로 저장합니다. 나중에 앱 복원 기능에도 사용할 수 있습니다.</Text>
        </View>
        <Pressable disabled={exporting} onPress={exportJson} style={styles.exportButton}><Text style={styles.exportButtonText}>JSON 내보내기</Text></Pressable>
      </View>
      <View style={styles.exportCard}>
        <Text style={styles.exportIcon}>📄</Text>
        <View style={styles.exportCopy}>
          <Text style={styles.exportTitle}>다른 앱에서 사용</Text>
          <Text style={styles.exportDescription}>Excel, Google Sheets, 데이터 분석 도구에서 열 수 있는 CSV 파일입니다.</Text>
        </View>
        <View style={styles.exportActions}>
          <Pressable disabled={exporting} onPress={() => exportCsv('nutrition')} style={styles.exportButtonSecondary}><Text style={styles.exportButtonSecondaryText}>음식 CSV</Text></Pressable>
          <Pressable disabled={exporting} onPress={() => exportCsv('workout')} style={styles.exportButtonSecondary}><Text style={styles.exportButtonSecondaryText}>운동 CSV</Text></Pressable>
        </View>
      </View>
      <View style={styles.restoreCard}>
        <Text style={styles.exportIcon}>♻️</Text>
        <View style={styles.exportCopy}>
          <Text style={styles.exportTitle}>백업에서 복원</Text>
          <Text style={styles.exportDescription}>이 앱에서 내보낸 JSON 파일을 선택합니다. 현재 기록과 병합하거나 백업 내용으로 전체 교체할 수 있습니다.</Text>
        </View>
        <Pressable disabled={exporting} onPress={chooseBackup} style={styles.restoreButton}><Text style={styles.restoreButtonText}>JSON 백업 파일 선택</Text></Pressable>
      </View>
      <View style={styles.notice}><Text style={styles.noticeText}>앱을 삭제하기 전에 JSON 백업을 Google Drive 같은 안전한 곳에 저장하세요.</Text></View>
      {exporting && <Text style={styles.exportingText}>파일을 만드는 중...</Text>}
    </ScrollView>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return <View style={styles.intro}><Text style={styles.introTitle}>{title}</Text><Text style={styles.introText}>{text}</Text></View>;
}
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyIcon}>○</Text><Text style={styles.muted}>{text}</Text></View>; }

const colors = { ink: '#18251F', green: '#176B4D', pale: '#EAF4EF', cream: '#F6F3EA', border: '#DCE4DF' };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBFCFA', paddingTop: Platform.OS === 'android' ? 28 : 0 },
  page: { flex: 1 },
  home: { flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32, justifyContent: 'space-between' },
  settingsButton: { position: 'absolute', top: 18, right: 22, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  settingsIcon: { color: colors.ink, fontSize: 22 },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  date: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 12 },
  time: { color: colors.ink, fontSize: 52, lineHeight: 64, fontWeight: '300', letterSpacing: -2 },
  homeActions: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  sideActions: { width: '32%', gap: 14 },
  homeSmallButton: { flex: 1, minHeight: 112, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, justifyContent: 'space-between' },
  homeSmallIcon: { fontSize: 27 }, homeSmallLabel: { fontSize: 19, color: colors.ink, fontWeight: '800' },
  exerciseButton: { flex: 1, minHeight: 238, padding: 24, borderRadius: 32, backgroundColor: colors.green, justifyContent: 'flex-end', shadowColor: '#0A3A29', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  exerciseIcon: { fontSize: 54, position: 'absolute', top: 26, right: 24 },
  exerciseLabel: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' }, exerciseSub: { color: '#CDE7DB', fontSize: 14, marginTop: 5 },
  homeHint: { textAlign: 'center', color: '#7A837E', fontSize: 12 }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0EE' },
  back: { color: colors.ink, fontSize: 42, lineHeight: 42, fontWeight: '300' }, headerTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 48 }, intro: { marginBottom: 22 }, introTitle: { color: colors.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }, introText: { color: '#707974', fontSize: 14, marginTop: 7 },
  toggleRow: { minHeight: 70, paddingHorizontal: 18, marginBottom: 11, borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  taken: { backgroundColor: '#E7F6EE', borderColor: '#A8DCC4' }, notTaken: { backgroundColor: '#FCEDED', borderColor: '#F0C3C3' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 13 }, toggleName: { color: colors.ink, fontSize: 17, fontWeight: '800', flex: 1 }, toggleStatus: { fontSize: 14, fontWeight: '800' },
  primaryButton: { minHeight: 58, backgroundColor: colors.green, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  fieldLabel: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 18, marginBottom: 10 }, choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: 16, minHeight: 44, borderRadius: 14, justifyContent: 'center' },
  choiceSelected: { backgroundColor: colors.green, borderColor: colors.green }, choiceText: { color: '#58625D', fontSize: 14, fontWeight: '700' }, choiceTextSelected: { color: '#FFFFFF' },
  numberRow: { gap: 9, paddingRight: 20 }, numberChip: { width: 45, height: 45, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  textArea: { minHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, color: colors.ink, fontSize: 15, lineHeight: 22 },
  tubeToggle: { minHeight: 88, marginTop: 24, padding: 18, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, tubeIcon: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#FFFFFF', color: colors.green, fontSize: 24, fontWeight: '900', marginRight: 14 }, muted: { color: '#77807B', fontSize: 13, marginTop: 3 },
  calendar: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 14 }, calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 }, monthArrow: { fontSize: 32, color: colors.ink, paddingHorizontal: 8 }, monthTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285%', textAlign: 'center', color: '#7A837E', fontSize: 12, fontWeight: '800', marginBottom: 7 }, dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }, daySelected: { backgroundColor: colors.green }, dayNumberWrap: { position: 'relative', width: 32, height: 24, alignItems: 'center', justifyContent: 'center' }, dayText: { color: colors.ink, fontSize: 14, fontWeight: '700' }, dayTextSelected: { color: '#FFFFFF', fontWeight: '900' },
  calendarDots: { position: 'absolute', top: 0, right: 0, minHeight: 5, flexDirection: 'row', alignItems: 'center', gap: 2 }, calendarDot: { width: 5, height: 5, borderRadius: 2.5 }, jiuJitsuDot: { backgroundColor: '#E86A5A' }, judoDot: { backgroundColor: '#3977D6' },
  calendarLegend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, paddingTop: 11, marginTop: 5, borderTopWidth: 1, borderTopColor: '#EDF0EE' }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendText: { color: '#707974', fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: '#EBEFEC', padding: 4, borderRadius: 15, marginTop: 18, marginBottom: 18 }, tab: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, tabSelected: { backgroundColor: '#FFFFFF' }, tabText: { color: '#707974', fontWeight: '800' }, tabTextSelected: { color: colors.green },
  statsTitleRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, statsDate: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  addRecordButton: { paddingHorizontal: 12, minHeight: 36, borderRadius: 12, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }, addRecordText: { color: colors.green, fontSize: 13, fontWeight: '900' },
  noRecordHint: { color: '#7A837E', fontSize: 13, lineHeight: 19, backgroundColor: colors.cream, borderRadius: 14, padding: 13, marginBottom: 5 },
  statRow: { minHeight: 51, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E7ECE9' }, statName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  compactSaveButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, compactSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  workoutCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 10 }, workoutCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, workoutType: { color: colors.ink, fontSize: 17, fontWeight: '900' }, workoutCategory: { color: colors.green, fontSize: 14 }, workoutDetail: { color: '#606A64', fontSize: 14, lineHeight: 21, marginTop: 6 }, editLink: { color: colors.green, fontSize: 13, fontWeight: '900' },
  editorCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFD7CC', borderRadius: 22, padding: 17, marginBottom: 14 }, editorTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, editorDate: { color: colors.green, fontSize: 13, fontWeight: '800', marginTop: 4 },
  editorActions: { flexDirection: 'row', gap: 8, marginTop: 18 }, editorCancel: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#EDF0EE', alignItems: 'center', justifyContent: 'center' }, editorCancelText: { color: '#626B66', fontWeight: '900' }, editorDelete: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#FCEDED', alignItems: 'center', justifyContent: 'center' }, editorDeleteText: { color: '#B33636', fontWeight: '900' }, editorSave: { flex: 1.35, minHeight: 46, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, editorSaveText: { color: '#FFFFFF', fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 42, borderRadius: 18, backgroundColor: colors.cream }, emptyIcon: { color: '#8D958F', fontSize: 32 },
  exportCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 18, marginBottom: 14 },
  exportIcon: { fontSize: 30, marginBottom: 12 }, exportCopy: { marginBottom: 15 }, exportTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  exportDescription: { color: '#69736D', fontSize: 14, lineHeight: 21, marginTop: 6 },
  exportButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, exportButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  exportActions: { flexDirection: 'row', gap: 9 }, exportButtonSecondary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.pale, borderWidth: 1, borderColor: '#BDD9CC', alignItems: 'center', justifyContent: 'center' }, exportButtonSecondaryText: { color: colors.green, fontSize: 14, fontWeight: '900' },
  restoreCard: { backgroundColor: '#F5F1FF', borderWidth: 1, borderColor: '#D9CEF2', borderRadius: 22, padding: 18, marginBottom: 14 }, restoreButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#5E478F', alignItems: 'center', justifyContent: 'center' }, restoreButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  notice: { backgroundColor: colors.cream, borderRadius: 16, padding: 15, marginTop: 4 }, noticeText: { color: '#6A716D', fontSize: 13, lineHeight: 20 }, exportingText: { color: colors.green, fontWeight: '800', textAlign: 'center', marginTop: 16 },
});
