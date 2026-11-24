// 모델 예측 결과를 받아 "장바구니에 담기" 시점을 판정하는 모듈입니다.
// 90% 이상 확률이 1초 동안 유지되면 담기를 판정하고,
// 방금 담은 상품은 화면에서 치울 때까지 중복으로 담기지 않도록 막아 줍니다.
(function (global) {
  "use strict";

  const DEFAULT_THRESHOLD = 0.9;
  const DEFAULT_HOLD_MS = 1000;
  const DEFAULT_CLEAR_MS = 200;
  const DEFAULT_BACKGROUND_CLASS = "없음";

  /**
   * 상품 판정기를 생성합니다.
   * @param {Object} [options]
   * @param {number} [options.threshold=0.9] - 후보로 인정할 최소 확률 (0 ~ 1)
   * @param {number} [options.holdMs=1000] - 담기 판정까지 유지해야 하는 시간(밀리초)
   * @param {number} [options.clearMs=200] - 담은 상품을 치웠다고 판단하기까지 기다리는 시간(밀리초)
   * @param {string} [options.backgroundClass="없음"] - 상품이 없는 배경 클래스 이름
   * @param {Function} [options.isValidClass] - 가격표에 있는 상품인지 확인하는 함수
   */
  function createJudge(options) {
    const config = options || {};
    const threshold =
      typeof config.threshold === "number" ? config.threshold : DEFAULT_THRESHOLD;
    const holdMs = typeof config.holdMs === "number" ? config.holdMs : DEFAULT_HOLD_MS;
    const clearMs =
      typeof config.clearMs === "number" ? config.clearMs : DEFAULT_CLEAR_MS;
    const backgroundClass = config.backgroundClass || DEFAULT_BACKGROUND_CLASS;
    const isValidClass =
      typeof config.isValidClass === "function"
        ? config.isValidClass
        : function () {
            return true;
          };

    // 상태: "idle"(대기), "holding"(후보 유지 중), "wait_clear"(치우기 대기)
    let state = "idle";
    let candidateClass = null;
    let holdStartTime = 0;
    let lastAddedClass = null;
    let clearStartTime = null;

    // 예측 목록에서 가장 확률이 높은 결과 1개를 찾습니다.
    function pickTopResult(results) {
      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }

      let top = results[0];
      for (let i = 1; i < results.length; i += 1) {
        if (results[i].probability > top.probability) {
          top = results[i];
        }
      }
      return top;
    }

    // 배경이 아니고 가격표에 있으며 기준 확률 이상인지 확인합니다.
    function isCandidate(result) {
      if (!result || typeof result.className !== "string") {
        return false;
      }
      if (result.className === backgroundClass) {
        return false;
      }
      if (!isValidClass(result.className)) {
        return false;
      }
      return result.probability >= threshold;
    }

    /**
     * 판정 상태를 처음(대기 상태)으로 되돌립니다.
     */
    function reset() {
      state = "idle";
      candidateClass = null;
      holdStartTime = 0;
      lastAddedClass = null;
      clearStartTime = null;
    }

    /**
     * 새 예측 결과를 넣어 현재 상태와 담기 여부를 계산합니다.
     * @param {Array<{ className: string, probability: number }>} results - 예측 결과 배열
     * @param {number} [now=Date.now()] - 현재 시각(밀리초)
     * @returns {{
     *   action: "none" | "add",
     *   state: "idle" | "holding" | "wait_clear",
     *   className: string | null,
     *   probability: number,
     *   progress: number,
     *   topResult: { className: string, probability: number } | null
     * }}
     */
    function evaluate(results, now) {
      const currentTime = typeof now === "number" ? now : Date.now();
      const topResult = pickTopResult(results);
      const topProbability = topResult ? topResult.probability : 0;

      // 1. 방금 담은 상품을 치울 때까지 기다리는 상태
      if (state === "wait_clear") {
        // 다른 상품이 바로 기준 확률 이상으로 보이면 새 후보로 전환합니다.
        if (isCandidate(topResult) && topResult.className !== lastAddedClass) {
          state = "holding";
          candidateClass = topResult.className;
          holdStartTime = currentTime;
          lastAddedClass = null;
          clearStartTime = null;

          return {
            action: "none",
            state: "holding",
            className: candidateClass,
            probability: topProbability,
            progress: 0,
            topResult: topResult
          };
        }

        // 방금 담은 상품이 사라졌거나 확률이 크게 낮아졌는지 확인합니다.
        const looksCleared =
          !topResult ||
          topResult.className === backgroundClass ||
          (topResult.className === lastAddedClass && topResult.probability < 0.5) ||
          !isValidClass(topResult.className);

        if (looksCleared) {
          if (clearStartTime === null) {
            clearStartTime = currentTime;
          }

          if (currentTime - clearStartTime >= clearMs) {
            reset();
            return {
              action: "none",
              state: "idle",
              className: null,
              probability: topProbability,
              progress: 0,
              topResult: topResult
            };
          }
        } else {
          clearStartTime = null;
        }

        return {
          action: "none",
          state: "wait_clear",
          className: lastAddedClass,
          probability: topProbability,
          progress: 0,
          topResult: topResult
        };
      }

      // 2. 대기 상태 또는 후보 유지 상태
      if (!isCandidate(topResult)) {
        // 후보가 사라지면 진행도를 즉시 0으로 비우고 대기 상태로 돌아갑니다.
        state = "idle";
        candidateClass = null;
        holdStartTime = 0;

        return {
          action: "none",
          state: "idle",
          className: null,
          probability: topProbability,
          progress: 0,
          topResult: topResult
        };
      }

      // 새 후보가 시작되었거나 다른 상품 후보로 바뀐 경우 타이머를 새로 시작합니다.
      if (state !== "holding" || candidateClass !== topResult.className) {
        state = "holding";
        candidateClass = topResult.className;
        holdStartTime = currentTime;

        return {
          action: "none",
          state: "holding",
          className: candidateClass,
          probability: topProbability,
          progress: 0,
          topResult: topResult
        };
      }

      // 같은 후보가 유지 중이면 0 ~ 1 진행도를 계산합니다.
      const elapsed = Math.max(0, currentTime - holdStartTime);
      const progress = holdMs > 0 ? Math.min(1, elapsed / holdMs) : 1;

      if (elapsed >= holdMs) {
        // 유지 시간 도달: "담기" 판정을 내리고 치우기 대기 상태로 전환합니다.
        const addedClass = candidateClass;
        state = "wait_clear";
        candidateClass = null;
        holdStartTime = 0;
        lastAddedClass = addedClass;
        clearStartTime = null;

        return {
          action: "add",
          state: "wait_clear",
          className: addedClass,
          probability: topProbability,
          progress: 1,
          topResult: topResult
        };
      }

      return {
        action: "none",
        state: "holding",
        className: candidateClass,
        probability: topProbability,
        progress: progress,
        topResult: topResult
      };
    }

    return {
      evaluate: evaluate,
      reset: reset
    };
  }

  global.ProductJudge = {
    create: createJudge
  };
})(typeof window !== "undefined" ? window : globalThis);
