// 계산 화면(scan.html)의 카메라 인식, 판정 규칙 연결, 장바구니 화면 갱신을 담당합니다.
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
      cartEmpty.hidden = false;
      cartList.hidden = true;
      cartTotalQty.textContent = "0개";
      cartTotalPrice.textContent = "0원";
      checkoutButton.disabled = true;
      return;
    }

    cartEmpty.hidden = true;
    cartList.hidden = false;

    let highlightedRow = null;

    items.forEach(function (item) {
      const li = document.createElement("li");
      li.className = "cart-item";

      if (highlightClassName && item.className === highlightClassName) {
        li.classList.add("is-just-added");
        highlightedRow = li;
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "cart-item-name";
      nameSpan.textContent = item.name;

      const qtySpan = document.createElement("span");
      qtySpan.className = "cart-item-qty";
      qtySpan.textContent = item.quantity + "개";

      const amountSpan = document.createElement("span");
      amountSpan.className = "cart-item-amount";
      amountSpan.textContent = window.ProductCatalog.formatPrice(item.price * item.quantity);

      li.appendChild(nameSpan);
      li.appendChild(qtySpan);
      li.appendChild(amountSpan);
      cartList.appendChild(li);
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
      if (addedProduct) {
        window.ShoppingCart.addItem(addedProduct);
        renderCart(addedProduct.className);
        showCameraToast(addedProduct.name + " 담았어요");
      }
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

  // 페이지가 열릴 때 sessionStorage에 남아 있는 장바구니를 먼저 표시합니다.
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
