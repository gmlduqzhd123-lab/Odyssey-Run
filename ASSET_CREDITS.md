# 자산과 사용 조건

게임의 시각·음향 자산은 이 프로젝트를 위해 직접 제작했습니다. 외부 게임의 캐릭터·스프라이트·배경·음악을 복사하지 않았습니다. 외부 이미지, 웹폰트, CDN 또는 런타임 생성 API를 사용하지 않습니다.

| 자산 | 위치 | 제작·사용 |
|---|---|---|
| 오디세우스 9개 동작 SVG | `public/assets/hero-*.svg` | 자체 벡터 그래픽. 달리기 4단계, 점프, 낙하, 슬라이드, 피격, 완주 |
| 섬별 sky/far/mid SVG | `public/assets/{beach,cave,wind}-*.svg` | 자체 3층 풍경. 바다·유적·동굴·횃불·구름 |
| 배, 거인, 장애물 | `public/assets/{boat,giant,crate,pillar,gate,rock}.svg` | 자체 벡터 그래픽 |
| 아이템·나침반 | `public/assets/{star,map,shield,wings,magnet,apple,compass}.svg` | 자체 벡터 그래픽 |
| 지면·바람·피드백 | `src/scenes/World.ts` | 자체 절차적 그래픽 |
| 배경 선율·효과음 | `src/systems/audio.ts` | 자체 음계·합성 파형. Web Audio 생성, 외부 음원 없음 |
| 메뉴 글꼴 | 시스템 글꼴 스택 | 기기에 설치된 글꼴 사용. 배포 폰트 파일 없음 |

자체 제작 자산은 이 프로젝트 소스와 함께 수정·재사용할 수 있습니다. 오디세이아의 신화와 인물은 고대 원전에서 착안했으며 짧은 도감 문구는 새로 작성했습니다. 이 게임은 원전의 전체 줄거리를 재현하지 않습니다.

의존성 라이선스는 각 패키지를 따릅니다. Phaser 3.90.0(MIT), Vite(MIT), TypeScript(Apache-2.0), Playwright(Apache-2.0), tsx(MIT). 정확한 설치 목록은 `package-lock.json`에 있습니다.
