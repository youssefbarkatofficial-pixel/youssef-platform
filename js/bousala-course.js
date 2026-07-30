// ============================================================
//  عارض كورسات البوصلة 🧭 — وحدة إضافية مستقلة، لا تمس الكود القديم
// ============================================================

// ---------- تحويل روابط الفيديو لصيغة تضمين ----------
function embedUrl(url) {
  if(!url) return null;
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };
  return { type: "video", src: url };
}

// ---------- التركيب ----------
export function mountCourse(containerId, courseObj, sectionsArray, userStr, saveProgressFn, openQuizFn) {
  const root = document.getElementById(containerId);
  if (!root) return;
  
  const user = userStr ? JSON.parse(userStr) : { phone: 'guest', completedItems: [] };
  const progress = {
      done: user.completedItems || [],
      last: localStorage.getItem(`bc_last_${courseObj.id}_${user.phone}`) || null
  };

  const all = [];
  sectionsArray.forEach(sec => {
      if(sec.items) sec.items.forEach(les => {
          if (les.type !== 'header') {
              all.push(les);
          }
      });
  });

  if(all.length === 0) {
      root.innerHTML = '<div style="text-align:center; padding: 20px;">لا يوجد محتوى لعرضه في هذه الدورة.</div>';
      return;
  }

  root.classList.add("bcourse");
  root.innerHTML = `
    <aside class="bc-side">
      <div class="bc-head">
        <b>${courseObj.name || courseObj.title || 'الكورس'}</b>
        <div class="bc-bar"><i></i></div><small class="bc-pct"></small>
      </div>
      <div class="bc-list"></div>
    </aside>
    <main class="bc-main"><div class="bc-stage"></div>
      <div class="bc-nav">
        <button class="bc-prev">◀ السابق</button>
        <button class="bc-done">أنهيت الدرس ✔</button>
        <button class="bc-next">التالي ▶</button>
      </div>
    </main>`;

  const list = root.querySelector(".bc-list");
  sectionsArray.forEach(sec => {
    if(!sec.items || sec.items.length === 0) return;
    const box = document.createElement("div");
    box.innerHTML = `<div class="bc-sec">${sec.title || 'قسم بدون عنوان'}</div>`;
    sec.items.forEach(les => {
      if (les.type === 'header') return;
      const btn = document.createElement("button");
      btn.className = "bc-les";
      btn.dataset.id = les.id;
      let icon = "📄";
      if (les.type === 'video') icon = "▶️";
      if (les.type === 'quiz' || les.type === 'task' || les.type === 'training') icon = "📝";
      btn.innerHTML = `<span>${icon} ${les.title}</span>
        <b class="bc-check">${progress.done.includes(les.id) ? "✔" : ""}</b>`;
      btn.onclick = () => show(les.id);
      box.appendChild(btn);
    });
    list.appendChild(box);
  });

  function refreshBar() {
    const pct = Math.round(progress.done.length / Math.max(all.length, 1) * 100);
    root.querySelector(".bc-bar i").style.width = pct + "%";
    root.querySelector(".bc-pct").textContent = `أنجزت ${pct}%`;
  }

  function show(id) {
    const i = all.findIndex(l => l.id === id);
    if(i === -1) return;
    const les = all[i];
    const stage = root.querySelector(".bc-stage");
    let html = `<h3 style="color:var(--royal-gold);margin-bottom:15px;font-size:1.4rem;">${les.title}</h3>`;

    const vidUrl = les.videoUrl || les.youtubeUrl;
    if (vidUrl) {
      const v = embedUrl(vidUrl);
      if (v) {
          if (v.type === "iframe") {
              // Add enablejsapi for YouTube
              const ytSrc = v.src.includes('?') ? v.src + '&enablejsapi=1' : v.src + '?enablejsapi=1';
              html += `<div class="bc-video"><iframe id="ytplayer_${les.id}" src="${ytSrc}" allowfullscreen frameborder="0"></iframe></div>`;
          } else {
              html += `<div class="bc-video"><video id="vidplayer_${les.id}" src="${v.src}" controls controlsList="nodownload"></video></div>`;
          }
      }
    }
    
    if (les.pdfUrl) {
      html += `<div class="bc-files"><b>📎 ملفات الدرس:</b>
        <a href="${les.pdfUrl}" target="_blank" class="bc-file">📄 فتح المذكرة (PDF)</a></div>`;
    }
    
    if (les.type === 'quiz' || les.type === 'task' || les.type === 'training') {
      html += `<div style="margin-top: 20px;"><button class="bc-quiz">📝 ابدأ التدريبات / الامتحان</button></div>`;
    }

    stage.innerHTML = html;
    
    // Inject watermark if any
    const videoContainer = stage.querySelector(".bc-video");
    if(videoContainer && window.injectVideoWatermark) {
        window.injectVideoWatermark(videoContainer);
    }
    
    const quizBtn = stage.querySelector(".bc-quiz");
    if (quizBtn && openQuizFn) {
        quizBtn.addEventListener("click", () => openQuizFn(les));
    }

    root.querySelectorAll(".bc-les").forEach(b => b.classList.toggle("active", b.dataset.id === id));
    
    root.querySelector(".bc-prev").style.visibility = (i > 0) ? 'visible' : 'hidden';
    root.querySelector(".bc-prev").onclick = () => i > 0 && show(all[i-1].id);
    
    root.querySelector(".bc-next").style.visibility = (i < all.length - 1) ? 'visible' : 'hidden';
    root.querySelector(".bc-next").onclick = () => i < all.length - 1 && show(all[i+1].id);
    
    const doneBtn = root.querySelector(".bc-done");
    doneBtn.style.display = 'none'; // Hide manual button permanently
    
    const markCompleted = () => {
        if (!progress.done.includes(id)) {
            progress.done.push(id);
            if (saveProgressFn) saveProgressFn(id);
            root.querySelector(`.bc-les[data-id="${id}"] .bc-check`).textContent = "✔";
            refreshBar();
            if(window.showToast) window.showToast('تم اكتمال الدرس بنجاح', 'success');
            
            // Auto open next item if it exists
            if(i < all.length - 1) {
                setTimeout(() => show(all[i+1].id), 2000);
            }
        }
    };
    
    // If not video, allow manual completion after 5 seconds
    if (!vidUrl) {
        setTimeout(markCompleted, 5000);
    } else {
        // Watch time tracking
        const vidElem = document.getElementById(`vidplayer_${les.id}`);
        if (vidElem) {
            let watchTime = 0;
            let lastTime = 0;
            vidElem.addEventListener('timeupdate', (e) => {
                let current = vidElem.currentTime;
                let diff = current - lastTime;
                if (diff > 0 && diff < 2.0 && !vidElem.paused && vidElem.playbackRate <= 1.5) {
                    watchTime += diff;
                }
                lastTime = current;
                if (vidElem.duration && (watchTime / vidElem.duration) >= 0.9) {
                    markCompleted();
                }
            });
            vidElem.addEventListener('ended', markCompleted);
        } else {
            // It's a YouTube iframe. We need YT API.
            // Simplified approximation for YT: fallback to time based on message API or just 90% of a predefined duration.
            // Since we don't have YT API fully loaded here reliably, we'll auto complete YT videos when they send 'ended' via API or fallback.
            // For robust YT tracking, we load the IFrame Player API.
            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
            
            const checkYT = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    clearInterval(checkYT);
                    try {
                        let ytWatchTime = 0;
                        let ytLastTime = 0;
                        let ytInterval = null;
                        
                        new YT.Player(`ytplayer_${les.id}`, {
                            events: {
                                'onStateChange': (event) => {
                                    if (event.data == YT.PlayerState.PLAYING) {
                                        ytInterval = setInterval(() => {
                                            const player = event.target;
                                            if(!player || !player.getCurrentTime) return;
                                            let current = player.getCurrentTime();
                                            let diff = current - ytLastTime;
                                            if (diff > 0 && diff < 2.0 && player.getPlaybackRate() <= 1.5) {
                                                ytWatchTime += diff;
                                            }
                                            ytLastTime = current;
                                            
                                            let duration = player.getDuration();
                                            if (duration && (ytWatchTime / duration) >= 0.9) {
                                                markCompleted();
                                                clearInterval(ytInterval);
                                            }
                                        }, 1000);
                                    } else {
                                        if(ytInterval) clearInterval(ytInterval);
                                    }
                                    if (event.data == YT.PlayerState.ENDED) {
                                        markCompleted();
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.warn("YT API Error", e);
                        // Fallback: auto complete after a long time just in case
                        setTimeout(markCompleted, 60000); 
                    }
                }
            }, 500);
        }
    }
    
    progress.last = id;
    localStorage.setItem(`bc_last_${courseObj.id}_${user.phone}`, id);
  }

  refreshBar();
  const lastId = progress.last;
  const startId = (lastId && all.find(l => l.id === lastId)) ? lastId : all[0].id;
  show(startId);
}
