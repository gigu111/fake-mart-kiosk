// 계산 화면(scan.html)의 카메라 인식, 판정 규칙 연결, 직접 담기 및 장바구니 수동 조작을 담당합니다.
(function () {
  "use strict";

  const TOAST_DURATION_MS = 1500;
  const ROW_HIGHLIGHT_MS = 1500;

  const videoElement = document.getElementById("scan-video");
  const cameraToast = document.getElementById("camera-toast");
  const progressTrack = document.getElementById("judge-progress-track");
  const progressFill = document.getElementById("judge-progress-fill");
  const scanStatus = document.getElementById("scan-status");
  const errorBox = document.getElementById("scan-error-box");
  const errorTitle = document.getElementById("scan-error-title");
  const errorGuide = document.getElementById("scan-error-guide");
  const manualAddGrid = document.getElementById("manual-add-grid");

  const clearCartButton = document.getElementById("clear-cart-button");
  const cartEmpty = document.getElementById("cart-empty");
  const cartList = document.getElementById("cart-list");
  const cartTotalQty = document.getElementById("cart-total-qty");
  const cartTotalPrice = document.getElementById("cart-total-price");
  const checkoutButton = document.getElementById("checkout-button");

  let toastTimerId = null;
  let rowHighlightTimerId = null;

  // 인식 상태 한 줄 문구와 강조 스타일을 바꿉니다.
  function setStatusText(text, mode) {
    scanStatus.textContent = text;
    scanStatus.classList.remove("is-detected", "is-waiting", "is-error");
    if (mode === "detected") {
      scanStatus.classList.add("is-detected");
    } else if (mode === "waiting") {
      scanStatus.classList.add("is-waiting");
    } else if (mode === "error") {
      scanStatus.classList.add("is-error");
    }
  }

  // 후보 유지 진행 막대를 0% ~ 100%로 갱신합니다. (0%일 때는 즉시 비웁니다.)
  function setProgress(ratio) {
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    if (percent === 0) {
      progressFill.classList.remove("is-filling");
    } else {
      progressFill.classList.add("is-filling");
    }
    progressFill.style.width = percent + "%";
    progressTrack.setAttribute("aria-valuenow", String(percent));
  }

  // 상품이 담겼을 때 카메라 위에 1.5초 동안 안내 문구를 크게 띄웁니다.
  function showCameraToast(message) {
    if (toastTimerId !== null) {
      window.clearTimeout(toastTimerId);
      toastTimerId = null;
    }

    cameraToast.textContent = message;
    cameraToast.hidden = false;

    toastTimerId = window.setTimeout(function () {
      cameraToast.hidden = true;
      toastTimerId = null;
    }, TOAST_DURATION_MS);
  }

  // 카메라 인식 또는 직접 담기로 상품을 장바구니에 1개 담을 때 공통으로 사용합니다.
  function addProductToCart(product) {
    if (!product) {
      return;
    }
    window.ShoppingCart.addItem(product);
    renderCart(product.className);
    showCameraToast(product.name + " 담았어요");
  }

  // 가격표(js/products.js)에 있는 모든 상품을 "직접 담기" 버튼으로 만듭니다.
  function renderManualAddButtons() {
    manualAddGrid.innerHTML = "";

    window.ProductCatalog.products.forEach(function (product) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "manual-add-button";
      button.setAttribute("data-class-name", product.className);

      const nameSpan = document.createElement("span");
      nameSpan.className = "manual-add-name";
      nameSpan.textContent = product.name;

      const priceSpan = document.createElement("span");
      priceSpan.className = "manual-add-price";
      priceSpan.textContent = window.ProductCatalog.formatPrice(product.price);

      button.appendChild(nameSpan);
      button.appendChild(priceSpan);

      button.addEventListener("click", function () {
        addProductToCart(product);
      });

      manualAddGrid.appendChild(button);
    });
  }

  // 장바구니 줄의 "−", "+", "삭제" 버튼 동작을 만듭니다.
  function createCartItemRow(item, isJustAdded) {
    const li = document.createElement("li");
    li.className = "cart-item";
    if (isJustAdded) {
      li.classList.add("is-just-added");
    }

    // 위쪽 줄: 상품 이름과 금액(가격 × 수량)
    const topRow = document.createElement("div");
    topRow.className = "cart-item-top";

    const nameSpan = document.createElement("span");
    nameSpan.className = "cart-item-name";
    nameSpan.textContent = item.name;

    const amountSpan = document.createElement("span");
    amountSpan.className = "cart-item-amount";
    amountSpan.textContent = window.ProductCatalog.formatPrice(item.price * item.quantity);

    topRow.appendChild(nameSpan);
    topRow.appendChild(amountSpan);

    // 아래쪽 줄: 수량 조절(−, 수량, +)과 삭제 버튼
    const controlsRow = document.createElement("div");
    controlsRow.className = "cart-item-controls";

    const qtyGroup = document.createElement("div");
    qtyGroup.className = "qty-control-group";

    const decreaseButton = document.createElement("button");
    decreaseButton.type = "button";
    decreaseButton.className = "qty-button";
    decreaseButton.textContent = "−";
    decreaseButton.setAttribute("aria-label", item.name + " 수량 줄이기");
    decreaseButton.addEventListener("click", function () {
      window.ShoppingCart.decreaseQuantity(item.className);
      renderCart(null);
    });

    const qtySpan = document.createElement("span");
    qtySpan.className = "cart-item-qty";
    qtySpan.textContent = item.quantity + "개";

    const increaseButton = document.createElement("button");
    increaseButton.type = "button";
    increaseButton.className = "qty-button";
    increaseButton.textContent = "+";
    increaseButton.setAttribute("aria-label", item.name + " 수량 늘리기");
    increaseButton.addEventListener("click", function () {
      window.ShoppingCart.increaseQuantity(item.className);
      renderCart(null);
    });

    qtyGroup.appendChild(decreaseButton);
    qtyGroup.appendChild(qtySpan);
    qtyGroup.appendChild(increaseButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "삭제";
    deleteButton.setAttribute("aria-label", item.name + " 삭제");
    deleteButton.addEventListener("click", function () {
      window.ShoppingCart.removeItem(item.className);
      renderCart(null);
    });

    controlsRow.appendChild(qtyGroup);
    controlsRow.appendChild(deleteButton);

    li.appendChild(topRow);
    li.appendChild(controlsRow);
    return li;
  }

  // sessionStorage에 저장된 장바구니 내용을 화면에 그립니다.
  function renderCart(highlightClassName) {
    const items = window.ShoppingCart.getItems();
    const totalQty = window.ShoppingCart.getTotalQuantity();
    const totalPrice = window.ShoppingCart.getTotalPrice();

    cartList.innerHTML = "";

    if (rowHighlightTimerId !== null) {
      window.clearTimeout(rowHighlightTimerId);
      rowHighlightTimerId = null;
    }

    if (items.length === 0) {
      clearCartButton.hidden = true;
      cartEmpty.hidden = false;
      cartList.hidden = true;
      cartTotalQty.textContent = "0개";
      cartTotalPrice.textContent = "0원";
      checkoutButton.disabled = true;
      return;
    }

    clearCartButton.hidden = false;
    cartEmpty.hidden = true;
    cartList.hidden = false;

    let highlightedRow = null;

    items.forEach(function (item) {
      const isJustAdded = Boolean(highlightClassName && item.className === highlightClassName);
      const row = createCartItemRow(item, isJustAdded);
      if (isJustAdded) {
        highlightedRow = row;
      }
      cartList.appendChild(row);
    });

    if (highlightedRow) {
      rowHighlightTimerId = window.setTimeout(function () {
        highlightedRow.classList.remove("is-just-added");
        rowHighlightTimerId = null;
      }, ROW_HIGHLIGHT_MS);
    }

    cartTotalQty.textContent = totalQty + "개";
    cartTotalPrice.textContent = window.ProductCatalog.formatPrice(totalPrice);
    checkoutButton.disabled = false;
  }

  // "전체 비우기" 버튼: 확인창에서 확인을 눌렀을 때만 장바구니를 비웁니다.
  clearCartButton.addEventListener("click", function () {
    if (window.ShoppingCart.getItems().length === 0) {
      return;
    }

    if (window.confirm("장바구니를 모두 비울까요?")) {
      window.ShoppingCart.clear();
      renderCart(null);
    }
  });

  // "결제하기" 버튼: 장바구니에 상품이 있을 때 결제 화면(pay.html)으로 이동합니다.
  checkoutButton.addEventListener("click", function () {
    if (window.ShoppingCart.getItems().length === 0) {
      return;
    }
    window.location.href = "pay.html";
  });

  // 판정 규칙 모듈을 생성합니다. (90% 이상 1초 유지)
  const judge = window.ProductJudge.create({
    threshold: 0.9,
    holdMs: 1000,
    backgroundClass: "없음",
    isValidClass: function (className) {
      return Boolean(window.ProductCatalog.findByClassName(className));
    }
  });

  // 카메라·모델 준비 상태가 바뀔 때 한 줄 안내를 갱신합니다.
  function handleStatusChange(text, stateType) {
    if (stateType === "running") {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
      return;
    }
    if (stateType === "error") {
      setProgress(0);
      setStatusText(text, "error");
      return;
    }
    setProgress(0);
    setStatusText(text, "idle");
  }

  // 오류 안내 상자를 화면에 보여줍니다.
  function handleError(info) {
    errorTitle.textContent = info.title;
    errorGuide.textContent = info.guide;
    errorBox.hidden = false;
  }

  // 예측 결과를 판정 규칙에 넣고 진행 막대·장바구니·인식 상태를 갱신합니다.
  function handleResult(results) {
    const decision = judge.evaluate(results);

    // 1. 담기 판정이 난 경우: 장바구니 추가 + 카메라 안내 + 치우기 안내
    if (decision.action === "add") {
      const addedProduct = window.ProductCatalog.findByClassName(decision.className);
      addProductToCart(addedProduct);
      setProgress(0);
      setStatusText("상품을 치워 주세요", "waiting");
      return;
    }

    // 2. 담은 뒤 아직 상품을 비추고 있는 상태
    if (decision.state === "wait_clear") {
      setProgress(0);
      setStatusText("상품을 치워 주세요", "waiting");
      return;
    }

    // 3. 후보가 유지 중이면 진행 막대를 채우고, 아니면 즉시 비웁니다.
    if (decision.state === "holding") {
      setProgress(decision.progress);
    } else {
      setProgress(0);
    }

    // 4. 한 줄 인식 상태 텍스트 갱신
    const topResult = decision.topResult;
    if (!topResult || topResult.className === "없음") {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
      return;
    }

    const product = window.ProductCatalog.findByClassName(topResult.className);
    const percent = Math.round(topResult.probability * 100);

    if (product) {
      const formattedPrice = window.ProductCatalog.formatPrice(product.price);
      setStatusText(product.name + " " + formattedPrice + " (" + percent + "%)", "detected");
    } else {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
    }
  }

  // 초기 화면 준비: 직접 담기 버튼과 sessionStorage의 기존 장바구니를 그립니다.
  renderManualAddButtons();
  renderCart(null);

  // 공용 인식기(js/recognizer.js)를 생성해 시작합니다.
  const recognizer = window.ProductRecognizer.create({
    videoElement: videoElement,
    modelPath: "./model",
    onStatusChange: handleStatusChange,
    onResult: handleResult,
    onError: handleError
  });

  recognizer.start();

  // 화면을 떠날 때 카메라와 타이머를 정리합니다.
  window.addEventListener("pagehide", function () {
    recognizer.stop();
    judge.reset();
    if (toastTimerId !== null) {
      window.clearTimeout(toastTimerId);
      toastTimerId = null;
    }
    if (rowHighlightTimerId !== null) {
      window.clearTimeout(rowHighlightTimerId);
      rowHighlightTimerId = null;
    }
  });
})();
