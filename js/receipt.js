// 완료 화면(receipt.html)의 영수증 표시, 장바구니 비우기, 새 주문 시작 이동을 담당합니다.
(function () {
  "use strict";

  const receiptEmpty = document.getElementById("receipt-empty");
  const receiptContent = document.getElementById("receipt-content");
  const orderNumberEl = document.getElementById("receipt-order-number");
  const paidAtEl = document.getElementById("receipt-paid-at");
  const paymentMethodEl = document.getElementById("receipt-payment-method");
  const receiptItemList = document.getElementById("receipt-item-list");
  const receiptTotalSummary = document.getElementById("receipt-total-summary");
  const newOrderButton = document.getElementById("new-order-button");

  // 저장된 영수증을 읽어 화면에 표시합니다.
  function renderReceipt() {
    const receipt = window.OrderStore.loadReceipt();

    // 결제를 거치지 않고 바로 들어온 경우 안내와 시작 화면 버튼만 보여 줍니다.
    if (!receipt) {
      receiptEmpty.hidden = false;
      receiptContent.hidden = true;
      return;
    }

    // 결제 완료 화면에 들어오면 기존 장바구니를 비웁니다. (영수증은 새로 고침해도 유지됩니다.)
    window.ShoppingCart.clear();

    receiptEmpty.hidden = true;
    receiptContent.hidden = false;

    orderNumberEl.textContent = receipt.orderNumber;
    paidAtEl.textContent = receipt.paidAt;
    paymentMethodEl.textContent = receipt.paymentMethod;

    window.OrderStore.renderItemRows(receiptItemList, receipt.items);

    const formattedTotal = window.ProductCatalog.formatPrice(receipt.totalPrice);
    receiptTotalSummary.textContent = "총 " + receipt.totalQuantity + "개 · " + formattedTotal;
  }

  // "새 주문 시작" 클릭: 저장해 둔 영수증을 지우고 시작 화면으로 돌아갑니다.
  newOrderButton.addEventListener("click", function () {
    window.OrderStore.clearReceipt();
    window.location.href = "index.html";
  });

  renderReceipt();
})();
