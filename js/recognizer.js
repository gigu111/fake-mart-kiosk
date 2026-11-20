// 카메라 켜기, Teachable Machine 모델 불러오기, 반복 예측을 담당하는 모듈입니다.
// 다른 화면에서도 재사용할 수 있도록 전역 객체(window.ProductRecognizer)로 제공합니다.
(function (global) {
  "use strict";

  // 모델 입력 크기 (Teachable Machine 이미지 모델 기본 크기: 224x224)
  const MODEL_IMAGE_SIZE = 224;

  /**
   * 오류 종류에 따라 사용자에게 보여줄 한국어 이유와 해결 방법을 만듭니다.
   * @param {Error} error - 발생한 오류 객체
   * @param {string} stage - 오류가 발생한 단계 ("model" 또는 "camera")
   * @returns {{ title: string, guide: string }}
   */
  function getFriendlyError(error, stage) {
    if (stage === "model") {
      return {
        title: "AI 모델 파일을 불러오지 못했습니다.",
        guide: "model 폴더 안에 model.json, metadata.json, weights.bin 파일이 모두 있는지 확인하고, 로컬 서버(http://localhost:3000)로 접속했는지 확인해 주세요."
      };
    }

    // 브라우저가 카메라 기능을 지원하지 않거나 보안 연결(localhost/HTTPS)이 아닌 경우
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        title: "이 브라우저 환경에서는 카메라를 사용할 수 없습니다.",
        guide: "Chrome 또는 Safari 최신 버전에서 http://localhost:3000 또는 HTTPS 주소로 접속해 주세요."
      };
    }

    const name = error && error.name ? error.name : "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        title: "카메라 권한이 거부되었습니다.",
        guide: "브라우저 주소창 왼쪽의 자물쇠(또는 카메라) 아이콘을 눌러 카메라 권한을 '허용'으로 바꾼 뒤 페이지를 새로 고침해 주세요."
      };
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return {
        title: "연결된 카메라를 찾을 수 없습니다.",
        guide: "PC에 웹캠이 연결되어 있는지 확인하거나, 카메라가 있는 노트북·휴대폰에서 접속해 주세요."
      };
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return {
        title: "카메라를 다른 프로그램에서 사용 중입니다.",
        guide: "화상 회의나 다른 카메라 앱을 종료한 뒤 페이지를 새로 고침해 주세요."
      };
    }

    return {
      title: "카메라를 켜는 중 오류가 발생했습니다.",
      guide: "브라우저를 새로 고침하거나 Chrome 브라우저에서 다시 시도해 주세요." + (name ? " (" + name + ")" : "")
    };
  }

  /**
   * 사용 가능한 카메라 스트림을 엽니다.
   * 거울 모드에 맞는 전면 웹캠(user)을 우선 요청하고, 실패 시 기본 카메라로 다시 시도합니다.
   * @returns {Promise<MediaStream>}
   */
  async function openCameraStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false
      });
    } catch (firstErr) {
      // 권한 거부는 재시도하지 않고 바로 오류를 전달합니다.
      if (firstErr && (firstErr.name === "NotAllowedError" || firstErr.name === "PermissionDeniedError")) {
        throw firstErr;
      }
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }
  }

  /**
   * video 요소에 스트림을 연결하고 첫 프레임이 준비될 때까지 기다린 뒤 재생합니다.
   * @param {HTMLVideoElement} videoElement
   * @param {MediaStream} stream
   */
  async function attachAndPlayVideo(videoElement, stream) {
    // 아이폰 Safari 등 모바일 환경에서도 재생되도록 속성을 지정합니다.
    videoElement.setAttribute("playsinline", "");
    videoElement.setAttribute("muted", "");
    videoElement.setAttribute("autoplay", "");
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.autoplay = true;

    videoElement.srcObject = stream;

    // 메타데이터(영상 가로·세로 크기)가 준비될 때까지 기다립니다.
    if (videoElement.readyState < 1) {
      await new Promise(function (resolve) {
        videoElement.addEventListener("loadedmetadata", resolve, { once: true });
      });
    }

    try {
      await videoElement.play();
    } catch (playErr) {
      // autoplay로 이미 재생이 시작된 경우 발생하는 AbortError는 무시합니다.
      if (!playErr || playErr.name !== "AbortError") {
        throw playErr;
      }
    }
  }

  /**
   * 비디오 영상의 가운데 정사각형 부분만 잘라서 오프스크린 캔버스에 그립니다.
   * @param {HTMLVideoElement} video - 재생 중인 비디오 요소
   * @param {HTMLCanvasElement} canvas - 모델에 전달할 정사각형 캔버스
   * @param {CanvasRenderingContext2D} ctx - 캔버스 2D 컨텍스트
   */
  function drawCenterSquare(video, canvas, ctx) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) {
      return false;
    }

    // 가로와 세로 중 짧은 길이를 기준으로 가운데 정사각형 영역을 계산합니다.
    const squareSize = Math.min(videoWidth, videoHeight);
    const startX = (videoWidth - squareSize) / 2;
    const startY = (videoHeight - squareSize) / 2;

    ctx.drawImage(
      video,
      startX,
      startY,
      squareSize,
      squareSize,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return true;
  }

  /**
   * 상품 인식기를 생성합니다.
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoElement - 카메라 영상을 보여줄 video 요소
   * @param {string} [options.modelPath="./model"] - model.json, metadata.json이 들어 있는 폴더 경로
   * @param {Function} [options.onStatusChange] - 상태 문구가 바뀔 때 호출되는 함수
   * @param {Function} [options.onClassesLoaded] - 모델의 클래스 이름 목록을 불러왔을 때 호출되는 함수
   * @param {Function} [options.onResult] - 예측 결과 [{ className, probability }, ...]를 전달하는 함수
   * @param {Function} [options.onError] - 오류 발생 시 { title, guide }를 전달하는 함수
   */
  function createRecognizer(options) {
    const videoElement = options.videoElement;
    const modelBasePath = (options.modelPath || "./model").replace(/\/$/, "");

    let model = null;
    let mediaStream = null;
    let isRunning = false;
    let animationTimerId = null;

    // 모델에 가운데 정사각형 영상만 넘기기 위한 보이지 않는 캔버스
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = MODEL_IMAGE_SIZE;
    offscreenCanvas.height = MODEL_IMAGE_SIZE;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    function notifyStatus(text, stateType) {
      if (typeof options.onStatusChange === "function") {
        options.onStatusChange(text, stateType);
      }
    }

    function notifyError(error, stage) {
      const info = getFriendlyError(error, stage);
      notifyStatus(info.title, "error");
      if (typeof options.onError === "function") {
        options.onError(info);
      }
    }

    // 앞의 예측이 끝난 뒤에만 다음 예측을 시작하는 반복 함수입니다.
    async function predictLoop() {
      if (!isRunning || !model) {
        return;
      }

      try {
        // 비디오 프레임이 준비되었을 때만 가운데 정사각형을 잘라 예측합니다.
        if (videoElement.readyState >= 2 && drawCenterSquare(videoElement, offscreenCanvas, offscreenCtx)) {
          // Teachable Machine은 거울 모드로 학습하므로 두 번째 인자(flipped)를 true로 줍니다.
          const predictions = await model.predict(offscreenCanvas, true);
          const results = predictions.map(function (item) {
            return {
              className: item.className,
              probability: item.probability
            };
          });

          if (isRunning && typeof options.onResult === "function") {
            options.onResult(results);
          }
        }
      } catch (err) {
        // 일시적인 프레임 오류는 무시하고 다음 주기에 다시 시도합니다.
        console.warn("예측 중 일시적 오류:", err);
      }

      if (isRunning) {
        animationTimerId = global.requestAnimationFrame(predictLoop);
      }
    }

    /**
     * 모델을 불러오고 카메라를 켠 뒤 반복 예측을 시작합니다.
     */
    async function start() {
      stop();

      // 1단계: Teachable Machine 모델 불러오기
      notifyStatus("모델 불러오는 중...", "loading");
      try {
        const modelUrl = modelBasePath + "/model.json";
        const metadataUrl = modelBasePath + "/metadata.json";
        model = await global.tmImage.load(modelUrl, metadataUrl);

        if (typeof options.onClassesLoaded === "function") {
          options.onClassesLoaded(model.getClassLabels());
        }
      } catch (err) {
        console.error("모델 불러오기 실패:", err);
        notifyError(err, "model");
        return false;
      }

      // 2단계: 카메라 권한 요청 및 영상 연결
      notifyStatus("카메라 권한을 허용해 주세요", "loading");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("MediaDevicesNotSupported");
        }

        mediaStream = await openCameraStream();
        await attachAndPlayVideo(videoElement, mediaStream);
      } catch (err) {
        console.error("카메라 시작 실패:", err);
        stop();
        notifyError(err, "camera");
        return false;
      }

      // 3단계: 반복 예측 시작
      isRunning = true;
      notifyStatus("인식 중", "running");
      predictLoop();
      return true;
    }

    /**
     * 예측을 멈추고 카메라 장치를 완전히 끕니다.
     */
    function stop() {
      isRunning = false;

      if (animationTimerId !== null) {
        global.cancelAnimationFrame(animationTimerId);
        animationTimerId = null;
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach(function (track) {
          track.stop();
        });
        mediaStream = null;
      }

      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null;
      }
    }

    return {
      start: start,
      stop: stop
    };
  }

  global.ProductRecognizer = {
    create: createRecognizer
  };
})(window);
