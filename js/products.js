// 계산대에서 판매하는 상품 목록(가격표)과 금액 표시 도우미 함수를 관리하는 모듈입니다.
// 다른 화면에서도 재사용할 수 있도록 전역 객체(window.ProductCatalog)로 제공합니다.
(function (global) {
  "use strict";

  // 상품 목록 배열입니다.
  // - className: Teachable Machine 모델(metadata.json)의 클래스 이름
  // - name: 화면에 보여 줄 상품 이름 (클래스 이름과 동일)
  // - price: 상품 가격 (원 단위 숫자)
  // - color: 화면에서 상품을 구분하기 위한 대표 색상 (HEX 값)
  // ※ "없음" 클래스는 카메라 앞에 상품이 없는 배경 상태이므로 목록에 넣지 않습니다.
  const PRODUCTS = [
    {
      className: "활명수",
      name: "활명수",
      price: 100,
      color: "#16a34a"
    },
    {
      className: "종이컵",
      name: "종이컵",
      price: 8700,
      color: "#ea580c"
    }
  ];

  /**
   * 모델의 클래스 이름으로 가격표에서 상품 정보를 찾습니다.
   * 가격표에 없는 이름(예: "없음")이면 null을 돌려줍니다.
   * @param {string} className - 찾을 상품의 모델 클래스 이름
   * @returns {{ className: string, name: string, price: number, color: string } | null}
   */
  function findProductByClassName(className) {
    if (typeof className !== "string" || className.length === 0) {
      return null;
    }

    return (
      PRODUCTS.find(function (product) {
        return product.className === className;
      }) || null
    );
  }

  /**
   * 숫자 금액을 "1,500원" 같은 한국 원화 문자열로 바꿉니다.
   * @param {number} amount - 원 단위 숫자 금액
   * @returns {string} 천 단위 쉼표와 "원"이 붙은 문자열
   */
  function formatPrice(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return "0원";
    }

    // 원 단위 정수로 반올림한 뒤 천 단위 쉼표를 붙입니다.
    return Math.round(amount).toLocaleString("ko-KR") + "원";
  }

  // 다른 스크립트에서 상품 목록과 함수를 꺼내 쓸 수 있도록 내보냅니다.
  global.ProductCatalog = {
    products: PRODUCTS,
    findByClassName: findProductByClassName,
    formatPrice: formatPrice
  };
})(typeof window !== "undefined" ? window : globalThis);
