// 인식 테스트 화면(test.html)의 UI 업데이트와 생명주기를 담당합니다.
(function () {
  "use strict";

  const videoElement = document.getElementById("camera-video");
  const statusBanner = document.getElementById("status-banner");
  const errorBox = document.getElementById("error-box");
  const errorTitle = document.getElementById("error-title");
  const errorGuide = document.getElementById("error-guide");
  const predictionList = document.getElementById("prediction-list");

  // 클래스 이름별로 화면 요소(막대, 퍼센트 글자, 행)를 저장해 빠르게 갱신합니다.
  const rowMap = new Map();

  // 상태 안내 배지를 업데이트합니다.
  function updateStatus(text, stateType) {
    statusBanner.textContent = text;
    statusBanner.classList.remove("is-running", "is-error");
    if (stateType === "running") {
      statusBanner.classList.add("is-running");
    } else if (stateType === "error") {
      statusBanner.classList.add("is-error");
    }
  }

  // 오류 안내 상자를 화면에 보여줍니다.
  function showError(info) {
    errorTitle.textContent = info.title;
    errorGuide.textContent = info.guide;
    errorBox.hidden = false;
  }

  // 모델에서 읽어 온 클래스 이름 목록으로 화면 줄을 만듭니다.
  function renderClassRows(labels) {
    predictionList.innerHTML = "";
    rowMap.clear();

    labels.forEach(function (label) {
      const li = document.createElement("li");
      li.className = "prediction-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "class-name";
      nameSpan.textContent = label;

      const barTrack = document.createElement("div");
      barTrack.className = "bar-track";

      const barFill = document.createElement("div");
      barFill.className = "bar-fill";
      barTrack.appendChild(barFill);

      const percentSpan = document.createElement("span");
      percentSpan.className = "class-percent";
      percentSpan.textContent = "0%";

      li.appendChild(nameSpan);
      li.appendChild(barTrack);
      li.appendChild(percentSpan);
      predictionList.appendChild(li);

      rowMap.set(label, {
        item: li,
        barFill: barFill,
        percentSpan: percentSpan
      });
    });
  }

  // 예측 결과를 받아 각 클래스의 막대와 퍼센트를 갱신하고, 최고 확률 줄을 강조합니다.
  function updatePredictions(results) {
    if (!results || results.length === 0) {
      return;
    }

    // 가장 확률이 높은 클래스를 찾습니다.
    let topClassName = results[0].className;
    let topProbability = results[0].probability;

    results.forEach(function (result) {
      if (result.probability > topProbability) {
        topProbability = result.probability;
        topClassName = result.className;
      }
    });

    // 각 클래스 행의 막대 길이, 숫자, 강조 표시를 업데이트합니다.
    results.forEach(function (result) {
      const row = rowMap.get(result.className);
      if (!row) {
        return;
      }

      const percent = Math.round(result.probability * 100);
      row.barFill.style.width = percent + "%";
      row.percentSpan.textContent = percent + "%";

      if (result.className === topClassName) {
        row.item.classList.add("is-top");
      } else {
        row.item.classList.remove("is-top");
      }
    });
  }

  // 인식기를 생성하고 실행합니다.
  const recognizer = window.ProductRecognizer.create({
    videoElement: videoElement,
    modelPath: "./model",
    onStatusChange: updateStatus,
    onClassesLoaded: renderClassRows,
    onResult: updatePredictions,
    onError: showError
  });

  recognizer.start();

  // 다른 페이지로 이동하거나 창을 닫을 때 카메라를 끕니다.
  window.addEventListener("pagehide", function () {
    recognizer.stop();
  });
})();
