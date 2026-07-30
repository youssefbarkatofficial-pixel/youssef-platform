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
  const studentCode = user.studentCode || user.phone || '';
  root.innerHTML = `
    <aside class="bc-side">
      <div class="bc-head" style="padding: 10px 14px; border-bottom:1px solid rgba(255,255,255,0.05);">
        <b style="display:block; color:var(--royal-gold); font-size:0.95rem; text-align:center;">📚 قائمة المحاضرات</b>
        ${studentCode ? `<div style="text-align:center; margin-top:6px; background:rgba(212,175,55,0.1); border:1px dashed rgba(212,175,55,0.4); border-radius:6px; padding:3px 8px;">
          <small style="color:rgba(255,255,255,0.5); font-size:0.65rem; display:block;">كود الطالب</small>
          <span style="color:var(--royal-gold); font-family:monospace; font-weight:bold; font-size:0.85rem; letter-spacing:1px;">${studentCode}</span>
        </div>` : ''}
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
    const secBox = document.createElement("div");
    secBox.innerHTML = `<div class="bc-sec" style="color:var(--royal-gold); border-bottom:1px solid rgba(212,175,55,0.3); padding-bottom:5px; margin-bottom:10px;">${sec.title || 'قسم بدون عنوان'}</div>`;
    
    let currentLecBox = null;

    sec.items.forEach(les => {
      if (les.type === 'header') return;
      
      const btn = document.createElement("button");
      btn.className = "bc-les";
      btn.dataset.id = les.id;
      
      let icon = "📄";
      if (les.type === 'video') icon = "▶️";
      if (les.type === 'quiz' || les.type === 'task' || les.type === 'training' || les.type === 'تدريب') icon = "📝";
      
      let attemptsText = '';
      if(progress.done.includes(les.id) && les.type !== 'video' && les.type !== 'pdf') {
          try {
              const dbRec = JSON.parse(localStorage.getItem(`db_${user.phone}`) || '{}');
              const results = (dbRec.examResults || []).filter(r => r.courseId === courseObj.id && r.examTitle === les.title);
              if (results.length > 0) {
                  const official = results.find(r => r.isOfficial || r.attemptNumber === 1) || results[0];
                  const officialScore = official.effectivePercent || official.percent;
                  attemptsText += `<span style="font-size:0.75rem; color:var(--accent-cyan); margin-right:5px; background:rgba(0,255,255,0.1); padding:2px 6px; border-radius:4px;">(${officialScore}%)</span>`;
                  
                  const otherAttempts = results.filter(r => r !== official);
                  if (otherAttempts.length > 0) {
                      const othersText = otherAttempts.map(r => `${r.effectivePercent || r.percent}%`).join(' - ');
                      attemptsText += `<span style="font-size:0.65rem; color:rgba(255,255,255,0.3); margin-right:4px;">[ ${othersText} ]</span>`;
                  }
              } else {
                  attemptsText = `<span style="font-size:0.75rem; color:var(--accent-cyan); margin-right:5px; background:rgba(0,255,255,0.1); padding:2px 6px; border-radius:4px;">(مكتمل)</span>`;
              }
          } catch(e) {
              attemptsText = `<span style="font-size:0.75rem; color:var(--accent-cyan); margin-right:5px; background:rgba(0,255,255,0.1); padding:2px 6px; border-radius:4px;">(مكتمل)</span>`;
          }
      }

      btn.innerHTML = `<span>${icon} ${les.title} ${attemptsText}</span>
        <b class="bc-check">${progress.done.includes(les.id) ? "✔" : ""}</b>`;
      btn.onclick = () => show(les.id);

      // Nesting logic based on parent lecture
      if (les._parentLecId) {
          if (!currentLecBox) {
              currentLecBox = document.createElement("div");
              currentLecBox.style.cssText = "background: rgba(255,255,255,0.02); border-right: 2px solid var(--accent-cyan); margin-bottom: 10px; padding-right: 5px;";
              secBox.appendChild(currentLecBox);
          }
          btn.style.fontSize = "0.85rem";
          btn.style.opacity = "0.9";
          currentLecBox.appendChild(btn);
      } else {
          // This is a main item (e.g. video lecture)
          currentLecBox = document.createElement("div");
          currentLecBox.style.cssText = "background: rgba(0,0,0,0.3); border-radius: 8px; margin-bottom: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); padding: 5px;";
          btn.style.fontWeight = "bold";
          currentLecBox.appendChild(btn);
          secBox.appendChild(currentLecBox);
      }
    });
    list.appendChild(secBox);
  });

  function refreshBar() {
      // Global bar removed as requested, keeping function stub for compatibility
  }

  function show(id) {
    const i = all.findIndex(l => l.id === id);
    if(i === -1) return;
    const les = all[i];
    const stage = root.querySelector(".bc-stage");
    let html = `<h3 style="color:var(--royal-gold); margin-bottom:15px; font-size:1.1rem; line-height:1.4;">${les.title}</h3>`;

    const vidUrl = les.videoUrl || les.youtubeUrl;
    if (vidUrl) {
      const v = embedUrl(vidUrl);
      if (v) {
          if (v.type === "iframe") {
              const ytSrc = v.src.includes('?') ? v.src + '&enablejsapi=1' : v.src + '?enablejsapi=1';
              html += `<div class="bc-video"><iframe id="ytplayer_${les.id}" src="${ytSrc}" allowfullscreen frameborder="0"></iframe></div>`;
          } else {
              html += `<div class="bc-video"><video id="vidplayer_${les.id}" src="${v.src}" controls controlsList="nodownload"></video></div>`;
          }
          // Thermometer Progress
          html += `<div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:8px; overflow:hidden;">
                     <div id="vid_thermometer_${les.id}" style="height:100%; width:0%; background:linear-gradient(90deg, #2ecc71, #27ae60); transition:width 0.3s ease;"></div>
                   </div>`;
      }
    }
    
    if (les.pdfUrl) {
      html += `<div class="bc-files"><b>📎 ملفات الدرس:</b>
        <a href="${les.pdfUrl}" target="_blank" class="bc-file">📄 فتح المذكرة (PDF)</a></div>`;
    }
    
    if (les.type === 'quiz' || les.type === 'task' || les.type === 'training' || les.type === 'تدريب') {
      let btnText = "📝 ابدأ";
      if (les.type === 'training' || les.type === 'تدريب' || (les.title && les.title.includes('تدريب'))) btnText = "📝 ابدأ التدريب";
      else if (les.type === 'homework' || les.type === 'واجب' || (les.title && les.title.includes('واجب'))) btnText = "📝 ابدأ الواجب";
      else if (les.type === 'quiz' || les.type === 'امتحان' || (les.title && les.title.includes('امتحان'))) btnText = "📝 ابدأ الامتحان";
      
      html += `<div style="margin-top: 20px;"><button class="bc-quiz btn btn-gold btn-block" style="font-size: 1.1rem; padding: 12px;">${btnText}</button></div>`;
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
            const chk = root.querySelector(`.bc-les[data-id="${id}"] .bc-check`);
            if(chk) chk.textContent = "✔";
            if(window.showToast) window.showToast('تم اكتمال الدرس بنجاح', 'success');
        }
        // Auto open next item or attached training if it exists
        if (vidUrl) {
            // Find if this video has a training attached
            let attachedTraining = all.find(l => l._parentLecId === id && (l.type === 'training' || l.type === 'تدريب'));
            if (attachedTraining) {
                show(attachedTraining.id);
            } else if (i < all.length - 1) {
                setTimeout(() => show(all[i+1].id), 2000);
            }
        }
    };
    
    // If not video, allow manual completion after 5 seconds
    if (!vidUrl) {
        setTimeout(markCompleted, 5000);
    } else {
        const updateThermometer = (pct) => {
            const th = document.getElementById(`vid_thermometer_${les.id}`);
            if(th) th.style.width = Math.min(100, Math.max(0, pct)) + "%";
        };

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
                if (vidElem.duration) {
                    let pct = (watchTime / vidElem.duration) * 100;
                    updateThermometer(pct);
                    if (pct >= 90) markCompleted();
                }
            });
            vidElem.addEventListener('ended', () => { updateThermometer(100); markCompleted(); });
        } else {
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
                                            if (duration) {
                                                let pct = (ytWatchTime / duration) * 100;
                                                updateThermometer(pct);
                                                if (pct >= 90) {
                                                    markCompleted();
                                                    clearInterval(ytInterval);
                                                }
                                            }
                                        }, 1000);
                                    } else {
                                        if(ytInterval) clearInterval(ytInterval);
                                    }
                                    if (event.data == YT.PlayerState.ENDED) {
                                        updateThermometer(100);
                                        markCompleted();
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.warn("YT API Error", e);
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
