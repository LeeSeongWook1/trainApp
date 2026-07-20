# 오늘운동

음식 섭취와 운동을 날짜별로 기록하는 오프라인 우선 Android/iOS 앱입니다. 기록은 서버가 아니라 기기 내부 SQLite DB에 저장됩니다.

홈 오른쪽 위 설정 버튼에서 전체 JSON 백업 또는 음식/운동 CSV 파일을 내보낼 수 있습니다. Android 공유창에서 Google Drive, 메일, 파일 앱 등 원하는 위치를 선택하세요.

복원할 때는 설정의 **JSON 백업 파일 선택**을 누릅니다. `병합`은 현재 기록을 유지하면서 백업을 추가하고, `전체 교체`는 현재 기록을 삭제한 뒤 백업 내용으로 바꿉니다.

통계 화면에서는 달력으로 과거 날짜를 선택해 음식 기록을 수정할 수 있고, 운동 탭의 **기록 추가** 또는 각 카드의 **수정**으로 과거 운동을 등록·수정·삭제할 수 있습니다. 홈 화면의 빠른 등록은 항상 오늘 날짜로 저장됩니다.

## 가장 빠르게 내 Android 휴대폰에서 실행하기

1. 휴대폰 Play Store에서 **Expo Go**를 설치합니다.
2. PC와 휴대폰을 같은 Wi-Fi에 연결합니다.
3. 이 폴더에서 `npm start`를 실행합니다.
4. 터미널에 뜨는 QR 코드를 휴대폰의 Expo Go로 스캔합니다.

연결이 안 되면 `npx expo start --tunnel`을 실행합니다.

## 설치 파일(APK) 만들기

Expo 계정이 필요하며 빌드는 무료 요금제로도 시작할 수 있습니다.

```powershell
npm install --global eas-cli
eas login
eas build --platform android --profile preview
```

빌드 완료 후 표시되는 주소에서 `.apk`를 휴대폰으로 내려받아 설치합니다. Android가 경고하면 해당 브라우저/파일 앱의 **알 수 없는 앱 설치** 권한을 한 번 허용해야 합니다.

## Play Store 출시 파일(AAB) 만들기

```powershell
eas build --platform android --profile production
```

생성된 `.aab` 파일을 Google Play Console의 내부 테스트 트랙에 먼저 올린 뒤 테스트하고 프로덕션으로 승격합니다. Play Console 개발자 계정 등록비와 스토어 심사 절차는 별도입니다.

## 개발 명령

```powershell
npm install
npm start
npx tsc --noEmit
```

> 앱 삭제 시 기기 내부 기록도 함께 삭제됩니다. 여러 기기 동기화와 백업이 필요해지면 Supabase 같은 오픈소스 기반 서버를 다음 단계에서 연결할 수 있습니다.
