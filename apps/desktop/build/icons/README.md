# 앱 아이콘 원본

HeyMoa cockatoo·microphone 브랜드를 유지한 full-bleed 앱 아이콘입니다. 사용자 추가 요청에 따라 built-in image_gen으로 코럴 배경을 네 모서리까지 채운 불투명 square `source.png`를 만들었습니다. `icon.png`는 1024px RGBA 기술 export이며 alpha는 전 픽셀 255입니다. 오른쪽을 보는 흰 새, navy 눈·부리, peach 날개와 cream microphone을 유지합니다. 웹 favicon은 변경하지 않습니다.

Mac용 `source-mac.png`는 새·마이크 그림을 더 크게 편집한 불투명 정사각형입니다. 코럴 배경은 네 모서리까지 채우며, 투명 둥근 모서리와 96% inset을 모두 제거했습니다. 최신 macOS가 아이콘 외곽을 보정할 때 이미지 자체의 모서리 여백이 겹치지 않도록 합니다. Icon Composer 대신 legacy ICNS를 사용합니다. OS별 외곽 보정 차이와 실제 Dock 표시는 설치 QA로 확인합니다.

macOS에서 `node apps/desktop/scripts/build-icons.mjs`로 `source.png`를 Windows용 `icon.png`·ICO로, `source-mac.png`를 `icon-mac.png`·ICNS로 각각 export하고 tray template을 재생성합니다. 그림을 crop하거나 내부 투명 inset을 추가하지 않습니다. PNG 원본은 built-in image_gen으로 만들고, 생성기는 크기와 컨테이너만 변환합니다.

`tray-source.png`는 별도의 image_gen monochrome 원본입니다. 메뉴 막대에는 투명 padding을 추가하지 않은 20px `assets/trayTemplate.png`와 40px `@2x`를 사용합니다. 새 원본 실루엣을 캔버스 높이에 꽉 차게 편집하고, 기존 18→20px padding 단계도 제거했습니다. 원본의 자연스러운 가로·세로 비율은 유지하며 `nativeImage.setTemplateImage(true)`가 OS 밝기별 색상을 소유합니다. source는 패키지에 넣지 않습니다.

2026-10-05 image_gen prompt: 기존 새·마이크 정체성과 비율을 유지하고 코럴 gradient가 모서리를 포함한 square canvas 전체를 채우도록 편집했습니다. rounded inset·회색 bezel·바깥 shadow·text를 추가하지 않습니다. 96% inset 시안은 최종본이 아닙니다. Tray는 같은 bird+mic silhouette을 크게 만들고 세부 grille 없이 black alpha template을 유지했습니다.

ICNS·ICO와 PNG는 OS 패키지 리소스입니다. 앱 ASAR에 원본을 넣지 않습니다. 생성물 검사는 `node apps/desktop/scripts/verify-icons.mjs`입니다. 작은 크기의 native Dock·Explorer 표시와 실제 설치 후 표시는 별도로 확인해야 합니다.

2026-10-05 Mac 이미지 편집 prompt: 기존 그림·색·배치를 유지하고 macOS rounded-square 바깥 모서리만 투명하게 처리합니다. 내부 여백·프레임·그림자·글자는 추가하지 않습니다. 두 번째 편집은 alpha 경계의 잔점 정리에 한정합니다. 별도 실측에서 alpha 16 이상 영역은 연결된 타일 하나, 네 꼭짓점 alpha는 0이며 낮은 alpha 색 잔점의 최대 불투명도는 2/255입니다. 컨테이너 검사만으로 실제 Dock 품질을 증명하지 않습니다.

공식 근거: [electron-builder ICNS 지원](https://www.electron.build/v26/docs/features/icons-and-images/), [Apple 기존 Mac 아이콘 보정 설명](https://developer.apple.com/videos/play/wwdc2025/220/).

2026-10-05 추가 여백 축소: built-in image_gen 편집으로 Mac 코럴 배경의 투명 모서리를 채우고 새·마이크 그림을 약 8% 확대했습니다. 메뉴바 실루엣은 높이를 캔버스에 꽉 채워 다시 생성했습니다. 실제 출력의 alpha 16 이상 높이는 20px 기준 17→20px, Retina 기준 34→40px입니다. 그림을 찌그러뜨려 가로까지 강제로 늘리지 않습니다. 이전 둥근 모서리 편집 설명은 과거 시안 기록이며 현재 최종 자산은 불투명 정사각형입니다.
