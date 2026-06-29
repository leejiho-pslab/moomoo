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
    body: '현대자동차 대전선화대리점 카마스터 김무겸입니다. 무리한 권유 대신 가장 잘 맞는 선택을, 계약 이후에도 변함없는 케어를 약속합니다.',
    stats: [
      { value: 'Hyundai', label: '현대자동차 정식 카마스터' },
      { value: 'Genesis', label: '제네시스 상담 가능' },
      { value: '대전', label: '대전선화대리점' },
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
