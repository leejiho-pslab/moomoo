/**
 * 사이트 정적 콘텐츠 설정.
 * 딜러의 실제 정보·차종·이미지 경로를 여기서 교체하면 전체 사이트에 반영된다.
 * (SNS 피드는 feed.json 으로 빌드 시 자동 주입)
 */

export interface CarModel {
  /** 이미지 소스 매핑용 식별자 (image-sources.json 의 models 키와 일치) */
  id: string;
  name: string;
  tagline: string;
  /** 차급/세그먼트 라벨 */
  segment: string;
  /** hyundai.com 상세 페이지 링크 */
  href: string;
  /** 카드 배경 이미지(선택). 없으면 그라디언트 비주얼로 폴백 */
  image?: string;
}

export interface SiteConfig {
  brand: {
    name: string;
    /** 헤더 로고 텍스트(이미지 로고가 없을 때) */
    logoText: string;
    /** 짧은 슬로건 */
    slogan: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    /** 배경 이미지(선택). 없으면 프리미엄 다크 그라디언트 비주얼 */
    backgroundImage?: string;
  };
  about: {
    title: string;
    body: string;
    stats: { value: string; label: string }[];
    /** 프로필 자격·전문 뱃지 */
    credentials: string[];
    /** 경력 타임라인 (브랜드별) */
    career: { period: string; brand: string; role: string; note?: string }[];
    /** 수상·실적 */
    awards: string[];
    /** 전문 분야 / 제공 서비스 */
    services: { name: string; desc: string }[];
    /** 상담~출고 프로세스 */
    process: { no: string; title: string; desc: string }[];
  };
  models: {
    title: string;
    description: string;
    items: CarModel[];
  };
  youtube: {
    title: string;
    description: string;
    channelUrl: string;
  };
  instagram: {
    title: string;
    description: string;
    profileUrl: string;
  };
  /** 담당 딜러 정보 (히어로 카드·소개 섹션에 표시) */
  dealer: {
    name: string;
    role: string;
    dealership: string;
  };
  contact: {
    title: string;
    description: string;
    /** 휴대전화 (상담) */
    phone: string;
    /** 대표 전화 */
    officeTel: string;
    /** 이메일 */
    email: string;
    /** 카카오톡 채널/오픈채팅 링크 (없으면 빈 문자열) */
    kakaoUrl: string;
    hours: string;
    location: string;
  };
}

export const site: SiteConfig = {
  brand: {
    name: '현대자동차 대전선화대리점',
    logoText: 'MOOMOO',
    slogan: '신뢰로 만나는 현대자동차 · 제네시스',
  },
  dealer: {
    name: '김무겸',
    role: 'CAR MASTER',
    dealership: '현대자동차 대전선화대리점',
  },
  hero: {
    eyebrow: 'HYUNDAI · GENESIS',
    title: '당신의 드라이브,\n여기서 시작됩니다',
    subtitle:
      '상담부터 출고까지, 카마스터 김무겸이 처음부터 끝까지 함께합니다.\n진심을 담은 한 대를 약속드립니다.',
    backgroundImage: undefined,
  },
  about: {
    title: '한 대의 차가 아닌,\n오래갈 신뢰를 팝니다',
    body: '2015년 첫 영업을 시작한 이래 폭스바겐 · 재규어 랜드로버 · 르노 · BMW를 거치며 10년 넘게 자동차 한 길을 걸어왔습니다. 대전 판매왕 · 전국 TOP10의 현장 경험을 바탕으로, 무리한 권유 대신 고객에게 가장 잘 맞는 한 대를 제안하고 계약 이후에도 변함없이 함께합니다.',
    stats: [
      { value: '10년+', label: '자동차 영업 경력' },
      { value: '100대+', label: '연간 판매 실적' },
      { value: 'TOP 10', label: '전국 판매 다수 수상' },
    ],
    credentials: [
      '현대자동차 정식 카마스터',
      '제네시스 상담 가능',
      '신차 · 법인 · 리스 · 장기렌트',
      '대전 · 세종 · 충청 권역',
    ],
    career: [
      { period: '2025 – 현재', brand: '현대자동차 대전선화대리점', role: '카마스터', note: '신차 · 법인 · 리스 전문' },
      { period: '2023 – 2024', brand: 'BMW 청주', role: '세일즈 매니저', note: '지점 판매 1위' },
      { period: '2017 – 2021', brand: '르노삼성 유성', role: '영업 팀장', note: '대전 판매왕 · 전국 TOP10' },
      { period: '2016', brand: '재규어 랜드로버', role: '영업 주임' },
      { period: '2015 – 2016', brand: '폭스바겐 대전', role: '영업 대리', note: '최연소 대리 진급' },
    ],
    awards: [
      '전국 판매 TOP 10 다수',
      '대전 판매왕',
      '충청 권역 TOP 10',
      'BMW 지점 판매 1위',
      '최연소 대리 진급',
      '연간 100대+ 꾸준한 판매',
    ],
    services: [
      { name: '신차 구매 상담', desc: '차종 비교부터 옵션·색상까지 1:1 맞춤 제안으로 가장 잘 맞는 한 대를 찾아드립니다.' },
      { name: '금융 설계', desc: '할부·리스·장기렌트 조건을 비교해 월 납입과 총비용까지 최적 플랜을 설계합니다.' },
      { name: '법인 구매', desc: '법인 명의 구매와 세무·회계 처리까지 매끄럽게 진행해 드립니다.' },
      { name: '보상판매 · 매입', desc: '타시던 차의 시세를 정확히 산정해 보상판매·매입으로 부담을 줄여드립니다.' },
      { name: '출고 · 등록 대행', desc: '번호판·등록·탁송까지 번거로운 절차를 책임지고 대신 처리합니다.' },
      { name: '출고 후 케어', desc: '정기 점검·보증·리콜 안내 등 계약 이후에도 변함없이 관리합니다.' },
    ],
    process: [
      { no: '01', title: '문의 · 상담', desc: '전화 · 문자 · 카카오톡으로 편하게 시작하세요.' },
      { no: '02', title: '맞춤 견적', desc: '예산과 용도에 맞춘 최적의 견적을 제안합니다.' },
      { no: '03', title: '계약', desc: '투명한 조건으로 안심하고 계약을 진행합니다.' },
      { no: '04', title: '출고', desc: '등록 · 탁송까지 책임지고 마무리합니다.' },
      { no: '05', title: '사후관리', desc: '출고 이후에도 변함없는 케어를 약속합니다.' },
    ],
  },
  models: {
    title: '주력 차종',
    description: '대표 라인업을 빠르게 만나보세요. 자세한 제원은 현대자동차 공식 페이지에서 확인할 수 있습니다.',
    items: [
      {
        id: 'grandeur',
        name: '디 올 뉴 그랜저',
        tagline: '플래그십 세단의 품격',
        segment: 'SEDAN',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'santafe',
        name: '싼타페',
        tagline: '가족을 위한 정공법 SUV',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'avante',
        name: '아반떼',
        tagline: '첫 차로 완벽한 밸런스',
        segment: 'SEDAN',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'ioniq5',
        name: '아이오닉 5',
        tagline: '전동화의 새로운 기준',
        segment: 'EV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'palisade',
        name: '팰리세이드',
        tagline: '대형 SUV의 완성',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'sonata',
        name: '쏘나타',
        tagline: '시대를 잇는 베스트셀러',
        segment: 'SEDAN',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'tucson',
        name: '투싼',
        tagline: '도심형 SUV의 표준',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'kona',
        name: '코나',
        tagline: '경쾌한 컴팩트 SUV',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'staria',
        name: '스타리아',
        tagline: '공간의 품격, 패밀리 RV',
        segment: 'RV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'ioniq6',
        name: '아이오닉 6',
        tagline: '전기 세단의 새 기준',
        segment: 'EV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'casper',
        name: '캐스퍼',
        tagline: '작지만 단단한 엔트리 SUV',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
      {
        id: 'venue',
        name: '베뉴',
        tagline: '나만의 첫 SUV',
        segment: 'SUV',
        href: 'https://www.hyundai.com/kr/ko/e',
      },
    ],
  },
  youtube: {
    title: '유튜브',
    description: '리뷰·출고·꿀팁까지. 채널의 최신 영상을 만나보세요.',
    channelUrl: 'https://www.youtube.com/@hyundai_moomoo',
  },
  instagram: {
    title: '인스타그램',
    description: '일상 속 생생한 출고 현장과 차량 이야기.',
    profileUrl: 'https://www.instagram.com/',
  },
  contact: {
    title: '지금 상담하세요',
    description: '궁금한 차종, 견적, 프로모션 무엇이든 편하게 문의주세요. 카마스터 김무겸이 가장 빠르게 답해드립니다.',
    phone: '010-8033-3522',
    officeTel: '042-254-9000',
    email: 'mookyumi@naver.com',
    kakaoUrl: '',
    hours: '연중무휴 09:00 – 20:00 (주말·공휴일 포함)',
    location: '현대자동차 대전선화대리점 · 대전광역시 중구 우암로 4',
  },
};
