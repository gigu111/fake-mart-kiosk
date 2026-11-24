// 계산 화면(scan.html)의 카메라 인식 상태 표시와 생명주기를 담당합니다.
// (이번 단계에서는 인식 결과만 한 줄로 표시하며 장바구니 담기 기능은 다음 단계에서 추가합니다.)
(function () {
  "use strict";

  const videoElement = document.getElementById("scan-video");
  const scanStatus = document.getElementById("scan-status");
  const errorBox = document.getElementById("scan-error-box");
  const errorTitle = document.getElementById("scan-error-title");
  const errorGuide = document.getElementById("scan-error-guide");

  // 인식 상태 한 줄 문구와 강조 스타일을 바꿉니다.
  function setStatusText(text, mode) {
    scanStatus.textContent = text;
    scanStatus.classList.remove("is-detected", "is-error");
    if (mode === "detected") {
      scanStatus.classList.add("is-detected");
    } else if (mode === "error") {
      scanStatus.classList.add("is-error");
    }
  }

  // 카메라·모델 준비 상태가 바뀔 때 한 줄 안내를 갱신합니다.
  function handleStatusChange(text, stateType) {
    if (stateType === "running") {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
      return;
    }
    if (stateType === "error") {
      setStatusText(text, "error");
      return;
    }
    setStatusText(text, "idle");
  }

  // 오류 안내 상자를 화면에 보여줍니다.
  function handleError(info) {
    errorTitle.textContent = info.title;
    errorGuide.textContent = info.guide;
    errorBox.hidden = false;
  }

  // 모델 예측 결과를 받아 가장 확률이 높은 클래스에 맞는 안내 문구를 표시합니다.
  function handleResult(results) {
    if (!results || results.length === 0) {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
      return;
    }

    // 가장 확률이 높은 클래스를 찾습니다.
    let topResult = results[0];
    for (let i = 1; i < results.length; i += 1) {
      if (results[i].probability > topResult.probability) {
        topResult = results[i];
      }
    }

    // 배경("없음")이면 안내 문구를 보여 줍니다.
    if (topResult.className === "없음") {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
      return;
    }

    // 가격표(js/products.js)에서 상품을 찾아 "상품명 가격 (확률%)" 형태로 표시합니다.
    const product = window.ProductCatalog.findByClassName(topResult.className);
    const percent = Math.round(topResult.probability * 100);

    if (product) {
      const formattedPrice = window.ProductCatalog.formatPrice(product.price);
      setStatusText(product.name + " " + formattedPrice + " (" + percent + "%)", "detected");
    } else {
      setStatusText("상품을 카메라에 비춰 주세요", "idle");
    }
  }

  // 공용 인식기(js/recognizer.js)를 생성해 시작합니다.
  const recognizer = window.ProductRecognizer.create({
    videoElement: videoElement,
    modelPath: "./model",
    onStatusChange: handleStatusChange,
    onResult: handleResult,
    onError: handleError
  });

  recognizer.start();

  // 화면을 떠날 때 카메라를 끕니다.
  window.addEventListener("pagehide", function () {
    recognizer.stop();
  });
})();
