// --- PROOF OF CONNECTION ---
console.log("✅ script.js has successfully loaded!");

// --- THEME & UI LOGIC ---
function toggleTheme() {
    const body = document.body;
    if (body.getAttribute('data-theme') === 'dark') body.removeAttribute('data-theme');
    else body.setAttribute('data-theme', 'dark');
}

function triggerAnimations(pageId) {
    const page = document.getElementById(pageId);
    const elements = page.querySelectorAll('.reveal');
    elements.forEach(el => {
        el.style.animation = 'none';
        el.offsetHeight; 
        el.style.animation = null; 
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    triggerAnimations(pageId);
    window.scrollTo(0,0);
}

function resetApp() {
    document.getElementById('imageInput').value = '';
    showPage('mainMenu');
}

// --- MODAL LOGIC ---
function openModal() {
    const modal = document.getElementById('imageModal');
    document.getElementById('modalImg').src = document.getElementById('previewImg').src;
    modal.classList.add('show');
}
function closeModal() { 
    document.getElementById('imageModal').classList.remove('show'); 
}

// --- PROGRESS BAR ---
let progressInterval;
function startLoading() {
    showPage('loadingUI');
    const bar = document.getElementById('loadingFill');
    const text = document.getElementById('loadingText');
    let progress = 0; bar.style.width = '0%';
    
    const messages = ["Reading nutritional facts...", "Checking for hidden sugars...", "Identifying product...", "Consulting the AI..."];
    let msgIdx = 0;
    
    progressInterval = setInterval(() => {
        progress += Math.random() * 12; 
        if (progress > 92) progress = 92; 
        bar.style.width = progress + '%';
        if (Math.random() > 0.6) { text.innerText = messages[msgIdx % messages.length]; msgIdx++; }
    }, 1200);
}

function finishLoading() {
    clearInterval(progressInterval);
    document.getElementById('loadingFill').style.width = '100%';
    document.getElementById('loadingText').innerText = "Complete!";
}

// --- CAMERA UI ---
const video = document.getElementById('videoElement');
let currentStream = null;

async function openCamera() {
    try { 
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); 
        video.srcObject = currentStream; 
        showPage('cameraUI'); 
    } catch (err) { alert("Camera access denied."); }
}

function closeCamera() { 
    if (currentStream) currentStream.getTracks().forEach(track => track.stop()); 
    resetApp(); 
}

// --- RAW UPLOAD LOGIC (Bypasses compression for local speed) ---
async function captureAndAnalyze() {
    // Basic canvas capture for video
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; 
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
        document.getElementById('previewImg').src = URL.createObjectURL(blob);
        const formData = new FormData(); 
        formData.append("file", blob, "scan.jpg");
        
        if (currentStream) currentStream.getTracks().forEach(track => track.stop());
        sendToBackend(formData);
    }, 'image/jpeg', 0.8);
}

async function uploadFromGallery(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('previewImg').src = URL.createObjectURL(file);
    
    const formData = new FormData(); 
    formData.append("file", file);
    sendToBackend(formData);
}

// --- API CONNECTION ---
async function sendToBackend(formData) {
    startLoading();
    try {
       const response = await fetch("/analyze-label", { 
            method: "POST", 
            body: formData 
        });

        const rawText = await response.text();
        finishLoading();

        if (!response.ok) {
            alert(`🚨 HTTP ERROR [${response.status}]\n\nDetails:\n${rawText}`);
            resetApp();
            return; 
        }

        const jsonResponse = JSON.parse(rawText);
        
        setTimeout(() => {
            if (jsonResponse.status === "success") {
                displayResults(jsonResponse.data);
            } else { 
                const errorMsg = jsonResponse.message || jsonResponse.detail || JSON.stringify(jsonResponse, null, 2);
                alert("⚠️ APP ERROR:\n\n" + errorMsg); 
                resetApp(); 
            }
        }, 500);

    } catch (error) {
        finishLoading();
        setTimeout(() => { 
            alert("❌ NETWORK FAILURE:\n\nCannot reach Python server. Make sure Uvicorn is running on port 8000.\n\n" + error.message); 
            resetApp(); 
        }, 500);
    }
}

// --- DYNAMIC RESULTS RENDERING ---
function displayResults(data) {
    showPage('resultsBox');

    const productNameText = data.product_name && data.product_name.trim() !== "" ? data.product_name : "Unknown Product";
    document.getElementById('productNameDisplay').innerText = productNameText;

    const m = data.macros || {};
    document.getElementById('val-protein').innerText = (m.protein_g || m.protein || 0) + 'g';
    document.getElementById('val-carbs').innerText = (m.carbs_g || m.carbs || 0) + 'g';
    document.getElementById('val-fats').innerText = (m.fats_g || m.fats || m.fat || 0) + 'g';
    document.getElementById('val-sugar').innerText = (m.sugar_g || m.sugar || 0) + 'g';

    const ratingContainer = document.getElementById('ratingContainer');
    let colorHex = "#f39c12"; 
    const aiRating = data.rating || "";
    if(aiRating.includes("Green") || aiRating.includes("Healthy")) colorHex = "#05c46b";
    if(aiRating.includes("Red") || aiRating.includes("Unhealthy")) colorHex = "#ff4757";

    ratingContainer.innerHTML = `
        <div class="rating-badge" style="background: ${colorHex}; box-shadow: 0 10px 30px ${colorHex}66;">${data.rating || "Unknown"}</div>
        <div class="rating-reason">${data.rating_reason || "Analyzed based on ingredients."}</div>
    `;

    const flagsContainer = document.getElementById('flagsContainer');
    flagsContainer.innerHTML = ''; 
    
    let issuesHtml = "";
    if (!data.red_flags || data.red_flags.length === 0) {
        issuesHtml = `<div class="info-card alert-card" style="border-color: #05c46b;"><h4 style="color:#05c46b;">All Clear</h4><p style="font-size: 1.2rem;">No harmful artificial ingredients or major red flags detected.</p></div>`;
    } else {
        issuesHtml = `<div class="info-card alert-card"><h4>Harmful Ingredients Found</h4><ul>`;
        data.red_flags.forEach(flag => {
            issuesHtml += `<li><b>${flag.ingredient || "Ingredient"}:</b> ${flag.issue || "Potential health concern"}</li>`;
        });
        issuesHtml += `</ul></div>`;
    }

    let altHtml = '';
    if (data.healthy_alternatives && data.healthy_alternatives.length > 0) {
        altHtml = `<div class="info-card good-card"><h4>Healthier Alternatives</h4><ul>`;
        data.healthy_alternatives.forEach(alt => {
            if (typeof alt === 'string') {
                altHtml += `<li>${alt}</li>`;
            } else {
                altHtml += `<li><b>${alt.name}:</b> <p>${alt.detail}</p></li>`;
            }
        });
        altHtml += `</ul></div>`;
    }

    flagsContainer.innerHTML = issuesHtml + altHtml;
}
// --- HACK: FORCE KILL GOOGLE TRANSLATE BANNER ---
setInterval(() => {
    document.body.style.top = '0px';
    const banner = document.querySelector('.goog-te-banner-frame');
    if (banner) banner.style.display = 'none';
}, 500);