# 앱 아이콘 원본

사용자가 승인한 HeyMoa cockatoo·microphone squircle입니다. built-in image_gen에서 기존 브랜드 그림을 참고해 만든 `source.png`가 원본이고 `icon.png`는 승인된 PNG 기술 export입니다. coral rounded square, 오른쪽을 보는 흰 새, navy 눈·부리, peach 날개와 cream microphone을 유지합니다. 웹 favicon과 APP894 메뉴 막대 template 자산은 별도입니다.

macOS에서 `node apps/desktop/scripts/build-icons.mjs`를 실행하면 승인 export를 `sips`로 크기별 변환하고 `iconutil`로 ICNS를 만듭니다. ICO는 크기별 RGBA PNG를 Windows icon directory에 넣습니다. 그림을 재생성하거나 crop하지 않습니다. 원본 바깥의 미세한 alpha 잔여 픽셀도 승인된 export 그대로 보존합니다.

ICNS·ICO와 PNG는 OS 패키지 리소스입니다. 앱 ASAR에 원본을 넣지 않습니다. 생성물 검사는 `node apps/desktop/scripts/verify-icons.mjs`입니다. 작은 크기의 native Dock·Explorer 표시와 실제 설치 후 표시는 별도로 확인해야 합니다.
