
document.addEventListener("DOMContentLoaded", async () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const preview = document.getElementById('preview');
    const captureBtn = document.getElementById('captureBtn');
    //const deviceInfoDiv = document.getElementById('deviceInfo');
    const photoCountDiv = document.getElementById('photoCount');
    const loadingOverlay = document.getElementById('loading');
    const toast = document.getElementById('toast');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const lightboxImg = document.getElementById('lightboxImg');
    const angleButtons = document.querySelectorAll('#angleButtons button');

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const iddt = params.get('iddt');
    const token = params.get('token');
    const ts = params.get('ts');

    let locationData = { lat: null, lon: null };
    let deviceInfo = { userAgent: navigator.userAgent, platform: navigator.platform };
    let photoNum = 0, MAX_PHOTOS = 5;
    let photos = [];
    let selectedAngle = null;
    let selectedAngleText = "";

    document.body.classList.add('no-scroll');
    loadingOverlay.style.display = 'flex';

    if (angleButtons.length > 0) angleButtons[0].click();

    photos.forEach(p => {
        const btn = document.querySelector(`#angleButtons button[data-angle="${p.angleKey}"]`);
        if (btn) {
            btn.classList.add("captured");
            btn.disabled = true;
        }
    });

    //Check url hợp lệ
    (function validateUrlParams() {
        let query = window.location.search;

        query = decodeURIComponent(query)
            .replace(/^\?/, '')
            .replace(/#.*$/, '')
            .trim();

        const pattern = /^token=.+&ts=\d+&id=\d+&iddt=\d+$/;

        if (!pattern.test(query)) {
            showTokenError("Đường dẫn không hợp lệ", "Vui lòng truy cập đúng liên kết để tiếp tục.");
            throw new Error("Invalid URL");
        }
    })();

    const isValid = await verifyToken(token, ts, id, iddt);

    if (!isValid) {
        showTokenError("Token không hợp lệ hoặc đã hết hạn.", "Vui lòng truy cập đúng liên kết để tiếp tục.");
        throw new Error("Token Expired");
    }

    function showTokenError(notify, message) {
        document.body.innerHTML = `
    <div style="
        position: fixed;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background: linear-gradient(135deg, #1c1c28, #101018);
        color: white;
        text-align: center;
        padding: 20px;
        font-family: 'Segoe UI', sans-serif;
    ">
        <div style="
            background: rgba(255, 255, 255, 0.07);
            padding: 40px 25px;
            border-radius: 14px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.35);
            backdrop-filter: blur(6px);
            max-width: 360px;
            width: 90%;
            animation: fadeIn 0.3s ease-out;
        ">
            <div style="
                font-size: 60px;
                font-weight: 700;
                margin-bottom: 10px;
                color: #ff6b6b;
                text-shadow: 0 0 12px rgba(255, 80, 80, 0.9);
            ">⚠</div>

            <div style="font-size: 28px; font-weight: 600; margin-bottom: 8px;">
                ${notify}
            </div>

            <div style="font-size: 16px; color: #ddd; line-height: 1.5;">
                ${message}
            </div>
        </div>
    </div>

    <style>
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
    `;
    }

    function showToast(msg, success = true) {
        toast.textContent = msg;
        toast.style.background = success ? "rgba(0,150,0,0.9)" : "rgba(220,0,0,0.9)";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
    }

    angleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            angleButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAngle = btn.dataset.angle;
            selectedAngleText = btn.textContent;

            changeOverlay(selectedAngle);
        });
    });

    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            document.body.classList.remove('no-scroll');
            loadingOverlay.style.display = "none";
        } catch (err) {
            loadingOverlay.querySelector(".loading-text").textContent = "Không thể truy cập camera!";
            console.error(err);
        }
    }

    if (angleButtons.length > 0) angleButtons[0].click();

    function getLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(pos => {
            locationData.lat = pos.coords.latitude;
            locationData.lon = pos.coords.longitude;
            //        updateDeviceInfo();
        }, err => console.warn('Không lấy vị trí:', err.message));
    }


    //function updateDeviceInfo() {
    //    deviceInfoDiv.innerHTML = `
    //         <strong>Thiết bị:</strong> ${getFinalDeviceName()}<br>
    //         <strong>Trình duyệt:</strong> ${detectBrowser()}<br>
    //         <strong>ID hợp đồng:</strong> ${id}<br>
    //         <strong>ID đối tượng:</strong> ${iddt}<br>
    //         <strong>Vĩ độ:</strong> ${locationData.lat ?? "?"} | <strong>Kinh độ:</strong> ${locationData.lon ?? "?"}
    //         `;
    //}

    function detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes("Chrome") && ua.includes("Edg")) return "Microsoft Edge (Chromium)";
        if (ua.includes("Chrome")) return "Google Chrome";
        if (ua.includes("Firefox")) return "Mozilla Firefox";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
        return "Trình duyệt không xác định";
    }

    function makeSafeName(angleKey) {
        return `${angleKey}_${id}_${iddt}.jpg`;
    }

    function isAngleCaptured(angle) {
        return photos.some(photo => photo.angle === angle);
    }

    function getVietnamTimeISO() {
        return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    }

    captureBtn.addEventListener('click', async () => {
        if (!selectedAngle) return showToast('Hãy chọn góc chụp!', false);
        if (photos.length >= MAX_PHOTOS) return showToast(`Đã đủ ${MAX_PHOTOS} ảnh!`, false);

        if (isAngleCaptured(selectedAngleText)) {
            return showToast(`Bạn đã chụp góc "${selectedAngleText}" rồi! Vui lòng chọn góc chụp khác.`, true);
        }

        const container = document.querySelector('.video-container');
        const ctx = canvas.getContext('2d');

        // Lấy kích thước video thực
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cw = container.clientWidth;
        const ch = container.clientHeight;

        const videoRatio = vw / vh;
        const containerRatio = cw / ch;

        let sx, sy, sw, sh;

        if (videoRatio > containerRatio) {
            // Video rộng hơn → crop 2 bên
            const newWidth = vh * containerRatio;
            sx = (vw - newWidth) / 2;
            sy = 0;
            sw = newWidth;
            sh = vh;
        } else {
            // Video cao hơn → crop trên dưới
            const newHeight = vw / containerRatio;
            sx = 0;
            sy = (vh - newHeight) / 2;
            sw = vw;
            sh = newHeight;
        }

        canvas.width = sw;
        canvas.height = sh;

        // Chụp đúng khung hiển thị
        //ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        const isPortrait = window.innerHeight > window.innerWidth;

        if (isPortrait) {
            // Canvas phải hoán đổi chiều để chứa ảnh ngang
            canvas.width = sh;
            canvas.height = sw;

            ctx.save();

            // Dịch tâm rồi xoay 90°
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-90 * Math.PI / 180);

            // Vẽ video đã crop vào canvas xoay
            ctx.drawImage(
                video,
                sx, sy, sw, sh,
                -sw / 2, -sh / 2, sw, sh
            );

            ctx.restore();

        } else {
            // Landscape giữ nguyên
            canvas.width = sw;
            canvas.height = sh;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const timestamp = getVietnamTimeISO();
        const safeName = makeSafeName(selectedAngle);

        const photoObj = { dataUrl, angle: selectedAngleText, angleKey: selectedAngle, safeName, timestamp };

        showToast("Chụp ảnh thành công!", true);

        photos.push(photoObj);

        // Disable nút của góc vừa chụp
        const btn = document.querySelector(`#angleButtons button[data-angle="${selectedAngle}"]`);
        if (btn) {
            btn.classList.add("captured");
            btn.disabled = true;
        }

        selectNextAngle(selectedAngle);

        // Tạo preview
        const card = document.createElement('div');
        card.className = 'img-card';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = photoObj.safeName;
        img.addEventListener('click', () => {
            lightboxImg.src = dataUrl;
            lightbox.style.display = 'flex';
        });

        const label = document.createElement('div');
        label.className = 'angle-label';
        label.textContent = photoObj.angle;

        const ts = document.createElement('div');
        ts.className = 'timestamp';
        ts.textContent = photoObj.timestamp;

        const del = document.createElement('div');
        del.className = 'delete-btn';
        del.textContent = '×';
        del.title = 'Xóa ảnh';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            preview.removeChild(card);
            photos = photos.filter(p => p !== photoObj);
            updatePhotoCount();

            // mở lại nút khi ảnh bị xóa
            const btn = document.querySelector(`#angleButtons button[data-angle="${photoObj.angleKey}"]`);
            if (btn) {
                btn.classList.remove("captured");
                btn.disabled = false;
                btn.click();
            }
        });

        card.appendChild(img);
        card.appendChild(label);
        card.appendChild(ts);
        card.appendChild(del);
        preview.appendChild(card);

        updatePhotoCount();
    });

    function selectNextAngle() {
        const angleArray = Array.from(angleButtons);
        const currentIndex = angleArray.findIndex(b => b.dataset.angle === selectedAngle);

        // Tìm nút tiếp theo chưa chụp
        for (let i = currentIndex + 1; i < angleArray.length; i++) {
            if (!angleArray[i].disabled) {
                angleArray[i].click();  // auto chọn
                return;
            }
        }

        // Nếu hết → thử quay lại đầu danh sách
        for (let i = 0; i < angleArray.length; i++) {
            if (!angleArray[i].disabled) {
                angleArray[i].click();
                return;
            }
        }
    }


    function updatePhotoCount() { photoCountDiv.textContent = `${photos.length} / ${MAX_PHOTOS} ảnh đã chụp`; }


    uploadAllBtn.addEventListener("click", async () => {
        if (photos.length === 0)
            return showToast("Chưa có ảnh để tải lên!", false);

        loadingOverlay.style.display = "flex";
        loadingOverlay.querySelector(".loading-text").textContent = "Đang tải ảnh lên...";

        const formData = new FormData();

        const dataObj = {
            Id: id,
            IdChild: iddt,
            productCode: "XE",
            ttin_file: photos.map((p, idx) => ({
                slotType: p.angleKey,
                slotTypeNum: idx + 1,
                Name: p.safeName,
                Longitude: locationData.lon?.toString() ?? "",
                Latitude: locationData.lat?.toString() ?? "",
                CaptureTime: p.timestamp,
                Browser: detectBrowser(),
                Device: getFinalDeviceName(),
                LinkImg: "",
                TypeImg: "image/jpeg"
            }))
        };

        formData.append("data", JSON.stringify(dataObj));

        //--------------------------------------------------------------------
        for (const photo of photos) {
            const blob = await (await fetch(photo.dataUrl)).blob();
            const sizeMB = blob.size / (1024 * 1024);

            if (sizeMB > 5) {
                loadingOverlay.style.display = "none";
                showToast(`Ảnh "${photo.angle}" vượt quá 5MB (${sizeMB.toFixed(2)}MB) – Không thể tải lên!`, false);
                return;
            }
        }
        //--------------------------------------------------------------------

        for (const photo of photos) {
            const blob = await (await fetch(photo.dataUrl)).blob();
            const file = new File([blob], photo.safeName, { type: "image/jpeg" });
            formData.append("files", file);
        }

        try {
            const res = await fetch("https://aut.bshc.com.vn/api/car-insur/upload-files", {
                method: "POST",
                headers: {
                    "token": token,
                    "ts": ts
                },
                body: formData
            });

            const json = await res.json();
            console.log("Kết quả:", json);

            if (!res.ok) throw new Error(json?.message || "❌ Tải ảnh thất bại!");

            showToast("✔ Tải ảnh thành công!");
            //photos = [];
            //preview.innerHTML = "";
            updatePhotoCount();

        } catch (err) {
            console.error(err);
            showToast("❌ Tải ảnh thất bại!", false);
        }

        loadingOverlay.style.display = "none";
    });

    async function verifyToken(token, ts, id, iddt) {
        const url = `https://aut.bshc.com.vn/api/car-insur/verify-token?token=${token}&ts=${ts}&id=${id}&iddt=${iddt}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            });

            return response.status === 200;
        } catch (error) {
            console.error("Lỗi khi verify token:", error);
            return false;
        }
    }

    async function getDeviceModel() {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            try {
                const data = await navigator.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion", "uaFullVersion"]);
                deviceInfo.model = data.model || "Không xác định";
                deviceInfo.platform = data.platform || deviceInfo.platform;
                deviceInfo.uaFullVersion = data.uaFullVersion;
                //        updateDeviceInfo();
            } catch (err) { console.warn("Không thể lấy model:", err); }
        } else {
            deviceInfo.model = "Không hỗ trợ (userAgentData)";
            //        updateDeviceInfo();
        }
    }

    function getFinalDeviceName() {

        // 1. Ưu tiên model (Android / iPhone)
        if (deviceInfo.model && deviceInfo.model !== "Không xác định" && deviceInfo.model !== "Không hỗ trợ (userAgentData)") {
            return deviceInfo.model;
        }

        // 2. Nếu không có model → dùng platform + version
        if (deviceInfo.platform && deviceInfo.platformVersion) {
            return `${deviceInfo.platform} ${deviceInfo.platformVersion}`;
        }

        // 3. Nếu không có userAgentData → dùng userAgent
        if (navigator.userAgent) {
            if (/android/i.test(navigator.userAgent)) return "Android device";
            if (/iphone/i.test(navigator.userAgent)) return "iPhone";
            if (/windows/i.test(navigator.userAgent)) return "Windows PC";
            if (/mac/i.test(navigator.userAgent)) return "Macbook";
            if (/linux/i.test(navigator.userAgent)) return "Linux device";
        }

        // 4. Cuối cùng luôn có giá trị
        return "Unknown Device";
    }

    document.querySelectorAll(".guide-images img").forEach(img => {
        img.addEventListener("click", () => {
            lightboxImg.src = img.src;
            lightbox.style.display = "flex";
        });
    });

    const overlay = document.getElementById("overlay");

    function changeOverlay(angle) {
        if (!angle) {
            overlay.style.display = "none";
            return;
        }

        let newSrc = "";
        switch (angle) {
            case "FRONT_RIGHT":
                newSrc = "/Resources/2.png";
                break;
            case "REAR_RIGHT":
                newSrc = "/Resources/5.png";
                break;
            case "FRONT_LEFT":
                newSrc = "/Resources/4.png";
                break;
            case "REAR_LEFT":
                newSrc = "/Resources/3.png";
                break;
            default:
                newSrc = "";
                break;
        }

        if (newSrc) {
            overlay.src = newSrc;
            overlay.style.display = "block";
            overlay.style.opacity = 0.6;
        } else {
            overlay.style.display = "none";
        }
    }

    const lightbox = document.getElementById("lightbox");
    const lightboxClose = document.getElementById("lightboxClose");

    lightboxClose.addEventListener("click", () => {
        lightbox.style.display = "none";
    });

    document.querySelectorAll(".guide-images img, .img-card img").forEach(img => {
        img.addEventListener("click", () => {
            lightboxImg.src = img.src;
            lightbox.style.display = "flex";
        });
    });


    getDeviceModel();
    initCamera();
    getLocation();
    //updateDeviceInfo();
});
