// 주문 번호 생성(localStorage), 결제 시각 포맷, 영수증 임시 저장(sessionStorage)을 담당하는 모듈입니다.
(function (global) {
  "use strict";

  const ORDER_COUNTER_KEY = "monggle_mart_order_counter_v1";
  const RECEIPT_STORAGE_KEY = "monggle_mart_last_receipt_v1";

  // 한 자리 숫자를 두 자리("05") 형태로 맞춥니다.
  function pad2(num) {
    return String(num).padStart(2, "0");
  }

  // 세 자리 주문 순번("001") 형태로 맞춥니다.
  function pad3(num) {
    return String(num).padStart(3, "0");
  }

  // 날짜 비교용 문자열("2026-11-25")을 만듭니다.
  function formatDateKey(date) {
    return (
      date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate())
    );
  }

  // 주문 번호 앞부분("1125")을 만듭니다.
  function formatOrderDatePrefix(date) {
    return pad2(date.getMonth() + 1) + pad2(date.getDate());
  }

  /**
   * 날짜 객체를 "2026.11.19 14:05" 형식의 문자열로 바꿉니다.
   * @param {Date} [date=new Date()]
   * @returns {string}
   */
  function formatPaidAt(date) {
    const target = date instanceof Date ? date : new Date();
    return (
      target.getFullYear() +
      "." +
      pad2(target.getMonth() + 1) +
      "." +
      pad2(target.getDate()) +
      " " +
      pad2(target.getHours()) +
      ":" +
      pad2(target.getMinutes())
    );
  }

  /**
   * 오늘 날짜와 순서로 새 주문 번호(예: "1125-001")를 발급하고 localStorage에 저장합니다.
   * 같은 날짜에 결제할 때마다 1씩 늘어나며, 날짜가 바뀌면 001부터 다시 셉니다.
   * @param {Date} [now=new Date()]
   * @returns {string}
   */
  function issueOrderNumber(now) {
    const target = now instanceof Date ? now : new Date();
    const todayKey = formatDateKey(target);
    let nextSeq = 1;

    try {
      if (global.localStorage) {
        const raw = global.localStorage.getItem(ORDER_COUNTER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            parsed.date === todayKey &&
            typeof parsed.seq === "number" &&
            Number.isFinite(parsed.seq) &&
            parsed.seq >= 1
          ) {
            nextSeq = Math.floor(parsed.seq) + 1;
          }
        }

        global.localStorage.setItem(
          ORDER_COUNTER_KEY,
          JSON.stringify({ date: todayKey, seq: nextSeq })
        );
      }
    } catch (err) {
      // localStorage를 쓸 수 없는 환경에서도 화면 흐름이 멈추지 않게 기본값을 씁니다.
    }

    return formatOrderDatePrefix(target) + "-" + pad3(nextSeq);
  }

  /**
   * 결제하기를 누르는 시점의 주문 내역으로 영수증 데이터를 만들어 sessionStorage에 저장합니다.
   * @param {Array<{ className: string, name: string, price: number, quantity: number }>} items
   * @param {string} paymentMethod - "카드", "간편결제", "현금"
   * @param {Date} [now=new Date()]
   */
  function createAndSaveReceipt(items, paymentMethod, now) {
    const target = now instanceof Date ? now : new Date();
    const safeItems = Array.isArray(items)
      ? items.map(function (item) {
          return {
            className: item.className,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0
          };
        })
      : [];

    const totalQuantity = safeItems.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);

    const totalPrice = safeItems.reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);

    const receipt = {
      orderNumber: issueOrderNumber(target),
      paidAt: formatPaidAt(target),
      paymentMethod: paymentMethod,
      items: safeItems,
      totalQuantity: totalQuantity,
      totalPrice: totalPrice
    };

    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
      }
    } catch (err) {
      // 저장 실패 시에도 오류로 중단되지 않도록 처리합니다.
    }

    return receipt;
  }

  /**
   * sessionStorage에 저장해 둔 최근 영수증을 읽어 옵니다. 없으면 null을 돌려줍니다.
   */
  function loadReceipt() {
    try {
      if (!global.sessionStorage) {
        return null;
      }

      const raw = global.sessionStorage.getItem(RECEIPT_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed.orderNumber !== "string" ||
        typeof parsed.paidAt !== "string" ||
        typeof parsed.paymentMethod !== "string" ||
        !Array.isArray(parsed.items) ||
        parsed.items.length === 0
      ) {
        return null;
      }

      return parsed;
    } catch (err) {
      return null;
    }
  }

  /**
   * 저장해 둔 영수증을 지웁니다. ("새 주문 시작" 시 사용)
   */
  function clearReceipt() {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.removeItem(RECEIPT_STORAGE_KEY);
      }
    } catch (err) {
      // 무시
    }
  }

  /**
   * 주문 내역 목록(ul)에 상품 이름, 수량, 금액 줄을 그려 넣습니다.
   * 결제 화면(pay.html)과 영수증 화면(receipt.html)에서 함께 사용합니다.
   * @param {HTMLElement} listElement
   * @param {Array<{ name: string, price: number, quantity: number }>} items
   */
  function renderItemRows(listElement, items) {
    listElement.innerHTML = "";

    items.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "order-item-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "order-item-name";
      nameSpan.textContent = item.name;

      const qtySpan = document.createElement("span");
      qtySpan.className = "order-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const amountSpan = document.createElement("span");
      amountSpan.className = "order-item-amount";
      amountSpan.textContent = global.ProductCatalog.formatPrice(item.price * item.quantity);

      li.appendChild(nameSpan);
      li.appendChild(qtySpan);
      li.appendChild(amountSpan);
      listElement.appendChild(li);
    });
  }

  global.OrderStore = {
    formatPaidAt: formatPaidAt,
    issueOrderNumber: issueOrderNumber,
    createAndSaveReceipt: createAndSaveReceipt,
    loadReceipt: loadReceipt,
    clearReceipt: clearReceipt,
    renderItemRows: renderItemRows
  };
})(typeof window !== "undefined" ? window : globalThis);
