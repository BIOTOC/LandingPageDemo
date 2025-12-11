
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
    const angleButtons = document.querySelectorAll('#angleButtons button');
    const overlay = document.getElementById("overlay");

    const lightbox = document.getElementById("lightbox");
    lightbox.style.display = 'none';
    const lightboxClose = document.getElementById("lightboxClose");
    const lightboxImg = document.getElementById("lightboxImg");
    const lightboxThumbs = document.getElementById("lightboxThumbs");
    const rotateBtn = document.getElementById("rotateBtn");


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

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let dataUrl = canvas.toDataURL("image/jpeg", 0.9);

        if (window.innerHeight > window.innerWidth) {
            dataUrl = await autoRotate90(dataUrl);
        }

        const timestamp = getVietnamTimeISO();
        const safeName = makeSafeName(selectedAngle);

        const photoObj = {
            dataUrl,
            originalDataUrl: dataUrl,
            rotation: 0,
            angle: selectedAngleText,
            angleKey: selectedAngle,
            safeName,
            timestamp
        };

        showToast("Chụp ảnh thành công!", true);
        photos.push(photoObj);

        const btn = document.querySelector(`#angleButtons button[data-angle="${selectedAngle}"]`);
        if (btn) {
            btn.classList.add("captured");
            btn.disabled = true;
        }

        selectNextAngle(selectedAngle);

        // Preview
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

        //const ts = document.createElement('div');
        //ts.className = 'timestamp';
        //ts.textContent = photoObj.timestamp;

        const del = document.createElement('div');
        del.className = 'delete-btn';
        del.textContent = '×';
        del.title = 'Xóa ảnh';
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            preview.removeChild(card);
            photos = photos.filter(p => p !== photoObj);
            updatePhotoCount();

            const btn = document.querySelector(`#angleButtons button[data-angle="${photoObj.angleKey}"]`);
            if (btn) {
                btn.classList.remove("captured");
                btn.disabled = false;
                btn.click();
            }
        });

        card.appendChild(img);
        card.appendChild(label);
        //card.appendChild(ts);
        card.appendChild(del);
        preview.appendChild(card);

        updatePhotoCount();
    });

    async function autoRotate90(dataUrl) {
        return new Promise(resolve => {
            const img = new Image();
            img.src = dataUrl;

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                // Canvas mới sau khi xoay
                canvas.width = img.height;
                canvas.height = img.width;

                // Xoay -90 độ
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-90 * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);

                resolve(canvas.toDataURL("image/jpeg", 0.9));
            };
        });
    }

    function selectNextAngle() {
        const angleArray = Array.from(angleButtons);
        const currentIndex = angleArray.findIndex(b => b.dataset.angle === selectedAngle);

        for (let i = currentIndex + 1; i < angleArray.length; i++) {
            if (!angleArray[i].disabled) {
                angleArray[i].click();
                return;
            }
        }
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

        for (const photo of photos) {
            const blob = await (await fetch(photo.dataUrl)).blob();
            const sizeMB = blob.size / (1024 * 1024);

            if (sizeMB > 5) {
                loadingOverlay.style.display = "none";
                showToast(`Ảnh "${photo.angle}" vượt quá 5MB (${sizeMB.toFixed(2)}MB) – Không thể tải lên!`, false);
                return;
            }
        }

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

    function resizeOverlay() {
        const overlay = document.querySelector('.overlay');
        const video = document.querySelector('video');

        if (!overlay || !video) return;

        const isLandscape = window.innerWidth > window.innerHeight;

        if (isLandscape) {
            let scale = 1.5;

            // Giảm scale cho iPad
            if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
                scale = 1.2; 
            }
            else if ((window.screen.width === 1180 && window.screen.height === 820) ||
                (window.screen.width === 1194 && window.screen.height === 834) ||
                (window.screen.width === 1366 && window.screen.height === 1024)) {
                scale = 1.2;
            }

            overlay.style.width = `${video.clientWidth * scale}px`;
            overlay.style.height = `${video.clientHeight * scale}px`;
        } else {
            overlay.style.width = `${video.clientWidth}px`;
            overlay.style.height = `${video.clientHeight}px`;
        }
    }

    window.addEventListener('resize', resizeOverlay);
    resizeOverlay();

    function openLightbox(photo) {
        lightboxImg.src = photo.dataUrl;
        lightboxImg.alt = photo.safeName;
        lightboxImg.style.transform = `rotate(0deg)`;

        lightbox.style.display = "flex";

        lightboxThumbs.innerHTML = "";
        photos.forEach(p => {
            const thumb = document.createElement("img");
            thumb.src = p.dataUrl;
            thumb.classList.toggle("selected", p.safeName === photo.safeName);

            thumb.addEventListener("click", () => {
                lightboxImg.src = p.dataUrl;
                lightboxImg.alt = p.safeName;
                lightboxImg.style.transform = `rotate(0deg)`;

                lightboxThumbs.querySelectorAll("img").forEach(i => i.classList.remove("selected"));
                thumb.classList.add("selected");
            });

            lightboxThumbs.appendChild(thumb);
        });
    }

    function rotatePhoto(photo, angle = 90) {
        const img = new Image();
        img.src = photo.originalDataUrl;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            photo.rotation = (photo.rotation + angle) % 360;

            const isRotate90Or270 = photo.rotation % 180 !== 0;
            canvas.width = isRotate90Or270 ? img.height : img.width;
            canvas.height = isRotate90Or270 ? img.width : img.height;

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(photo.rotation * Math.PI / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            photo.dataUrl = canvas.toDataURL("image/jpeg", 0.9);

            if (lightboxImg.alt === photo.safeName) {
                lightboxImg.src = photo.dataUrl;
                lightboxImg.style.transform = `rotate(0deg)`;
            }

            const previewImg = [...preview.querySelectorAll("img")].find(i => i.alt === photo.safeName);
            if (previewImg) previewImg.src = photo.dataUrl;
        };
    }

    rotateBtn.addEventListener("click", () => {
        const photo = photos.find(p => p.safeName === lightboxImg.alt);
        if (!photo) return;

        rotatePhoto(photo, 90);
    });

    preview.addEventListener("click", (e) => {
        const card = e.target.closest(".img-card");
        if (!card) return;
        const photo = photos.find(p => p.safeName === card.querySelector("img").alt);
        if (photo) openLightbox(photo);
    });

    lightboxClose.addEventListener("click", () => {
        lightbox.style.display = "none";
    });


    getDeviceModel();
    initCamera();
    getLocation();
    //updateDeviceInfo();
});
