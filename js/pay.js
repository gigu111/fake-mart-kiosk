// 결제 화면(pay.html)의 주문 내역 표시, 결제 수단 선택, 모의 결제 진행을 담당합니다.
(function () {
  "use strict";

  const PAYMENT_DELAY_MS = 2000;

  const payEmpty = document.getElementById("pay-empty");
  const payContent = document.getElementById("pay-content");
  const payItemList = document.getElementById("pay-item-list");
  const payTotalQty = document.getElementById("pay-total-qty");
  const payTotalPrice = document.getElementById("pay-total-price");
  const methodButtons = Array.prototype.slice.call(
    document.querySelectorAll(".payment-method-button")
  );
  const paySubmitButton = document.getElementById("pay-submit-button");
  const payMoreLink = document.getElementById("pay-more-link");

  let selectedMethod = null;
  let isProcessing = false;
  let paymentTimerId = null;

  // 장바구니 데이터를 읽어 주문 내역을 그리거나, 비어 있으면 안내 화면을 보여 줍니다.
  function renderOrder() {
    const items = window.ShoppingCart.getItems();

    if (items.length === 0) {
      payEmpty.hidden = false;
      payContent.hidden = true;
      return;
    }

    payEmpty.hidden = true;
    payContent.hidden = false;

    window.OrderStore.renderItemRows(payItemList, items);

    payTotalQty.textContent = window.ShoppingCart.getTotalQuantity() + "개";
    payTotalPrice.textContent = window.ProductCatalog.formatPrice(
      window.ShoppingCart.getTotalPrice()
    );
  }

  // 결제 수단 버튼 선택 상태를 갱신합니다.
  function selectPaymentMethod(methodName) {
    if (isProcessing) {
      return;
    }

    selectedMethod = methodName;

    methodButtons.forEach(function (button) {
      const isMatch = button.getAttribute("data-method") === methodName;
      button.classList.toggle("is-selected", isMatch);
      button.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });

    paySubmitButton.disabled = false;
  }

  methodButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      selectPaymentMethod(button.getAttribute("data-method"));
    });
  });

  // 결제 중에는 "상품 더 담기" 이동을 막아 흐름이 꼬이지 않게 합니다.
  payMoreLink.addEventListener("click", function (event) {
    if (isProcessing) {
      event.preventDefault();
    }
  });

  // "결제하기" 클릭: 영수증을 먼저 저장해 둔 뒤 2초 후 완료 화면으로 이동합니다.
  paySubmitButton.addEventListener("click", function () {
    if (isProcessing || !selectedMethod) {
      return;
    }

    const items = window.ShoppingCart.getItems();
    if (items.length === 0) {
      renderOrder();
      return;
    }

    isProcessing = true;
    paySubmitButton.disabled = true;
    paySubmitButton.textContent = "결제 중...";

    methodButtons.forEach(function (button) {
      button.disabled = true;
    });
    payMoreLink.classList.add("is-disabled");
    payMoreLink.setAttribute("aria-disabled", "true");

    // 결제하기를 누른 시점의 주문 내역으로 영수증을 생성·저장합니다.
    window.OrderStore.createAndSaveReceipt(items, selectedMethod);

    paymentTimerId = window.setTimeout(function () {
      paymentTimerId = null;
      window.location.href = "receipt.html";
    }, PAYMENT_DELAY_MS);
  });

  // 뒤로가기 등으로 돌아왔을 때도 최신 장바구니 상태를 반영합니다.
  window.addEventListener("pageshow", function () {
    if (paymentTimerId !== null) {
      window.clearTimeout(paymentTimerId);
      paymentTimerId = null;
    }
    isProcessing = false;
    renderOrder();
  });

  window.addEventListener("pagehide", function () {
    if (paymentTimerId !== null) {
      window.clearTimeout(paymentTimerId);
      paymentTimerId = null;
    }
  });

  renderOrder();
})();
