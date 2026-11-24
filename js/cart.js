// 장바구니 데이터를 관리하고 브라우저 sessionStorage에 저장하는 모듈입니다.
// 새로 고침하거나 다른 화면(시작 화면, 인식 테스트)에 다녀와도 장바구니가 유지됩니다.
(function (global) {
  "use strict";

  const STORAGE_KEY = "monggle_mart_cart_v1";

  // sessionStorage에서 장바구니 배열을 안전하게 읽어 옵니다.
  function loadItems() {
    try {
      if (!global.sessionStorage) {
        return [];
      }

      const raw = global.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      // 잘못된 데이터가 섞여 있을 때를 대비해 필요한 필드만 걸러냅니다.
      return parsed.filter(function (item) {
        return (
          item &&
          typeof item.className === "string" &&
          typeof item.name === "string" &&
          typeof item.price === "number" &&
          Number.isFinite(item.price) &&
          typeof item.quantity === "number" &&
          item.quantity > 0
        );
      });
    } catch (err) {
      return [];
    }
  }

  // 장바구니 배열을 sessionStorage에 저장합니다.
  function saveItems(items) {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (err) {
      // 저장 공간 오류 등이 나더라도 화면 동작은 계속되도록 무시합니다.
    }
  }

  /**
   * 현재 장바구니에 담긴 상품 목록을 돌려줍니다.
   * @returns {Array<{ className: string, name: string, price: number, quantity: number }>}
   */
  function getItems() {
    return loadItems();
  }

  /**
   * 상품을 장바구니에 1개 담습니다.
   * 이미 같은 클래스 이름의 상품이 있으면 새 줄을 만들지 않고 수량만 1 올립니다.
   * @param {{ className: string, name: string, price: number }} product
   * @returns {Array<{ className: string, name: string, price: number, quantity: number }>}
   */
  function addItem(product) {
    if (!product || typeof product.className !== "string") {
      return loadItems();
    }

    const items = loadItems();
    const existing = items.find(function (item) {
      return item.className === product.className;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({
        className: product.className,
        name: product.name || product.className,
        price: Number(product.price) || 0,
        quantity: 1
      });
    }

    saveItems(items);
    return items;
  }

  /**
   * 장바구니에 담긴 전체 상품 수량을 계산합니다.
   * @returns {number}
   */
  function getTotalQuantity() {
    return loadItems().reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  /**
   * 장바구니에 담긴 모든 상품의 합계 금액(원)을 계산합니다.
   * @returns {number}
   */
  function getTotalPrice() {
    return loadItems().reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);
  }

  /**
   * 장바구니를 모두 비웁니다.
   */
  function clear() {
    saveItems([]);
  }

  global.ShoppingCart = {
    getItems: getItems,
    addItem: addItem,
    getTotalQuantity: getTotalQuantity,
    getTotalPrice: getTotalPrice,
    clear: clear
  };
})(typeof window !== "undefined" ? window : globalThis);
