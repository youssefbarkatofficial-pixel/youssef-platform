// --- DYNAMIC SECTIONS RENDERER ---

            function migrateCourseToSections(contents) {
                if (contents && Array.isArray(contents.sections)) return contents;
                let sections = [];
                const c = contents || {};
                
                if (c.lectures && c.lectures.length) {
                    let items = [];
                    c.lectures.forEach(lec => {
                        if (lec.children && lec.children.length) {
                            items.push({ id: lec.id || 'lec_'+Date.now(), title: lec.title, type: 'header', thumbnail: lec.thumbnail });
                            lec.children.forEach(child => items.push(child));
                        } else {
                            items.push(lec);
                        }
                    });
                    sections.push({ id: 'sec_lectures', title: 'المحاضرات', items: items });
                }
                
                if (c.homeworks && c.homeworks.length) sections.push({ id: 'sec_homeworks', title: 'الواجبات', items: c.homeworks });
                if (c.exams && c.exams.length) sections.push({ id: 'sec_exams', title: 'الامتحانات', items: c.exams });
                if (c.customSections && c.customSections.length) {
                    c.customSections.forEach((sec, idx) => {
                        sections.push({ id: 'sec_custom_'+idx, title: sec.name || 'قسم مخصص', items: sec.items || [] });
                    });
                }
                if (sections.length === 0) sections.push({ id: 'sec_default', title: 'القسم الأول', items: [] });
                return { sections: sections };
            }

            const normalizedContents = migrateCourseToSections(rawContents);
            
            function isItemCompleted(itemId) {
                return dbUser.completedItems && dbUser.completedItems.includes(itemId);
            }

            function markItemCompleted(itemId) {
                if(!dbUser.completedItems) dbUser.completedItems = [];
                if(!dbUser.completedItems.includes(itemId)) {
                    dbUser.completedItems.push(itemId);
                    if(userStr) {
                        let user = JSON.parse(userStr);
                        if(window.FirebaseService && typeof window.FirebaseService.updateStudentData === 'function') {
                            window.FirebaseService.updateStudentData(user.phone, { completedItems: dbUser.completedItems }).then(() => {
                                localStorage.setItem('db_' + user.phone, JSON.stringify(dbUser));
                            });
                        } else {
                            localStorage.setItem('db_' + user.phone, JSON.stringify(dbUser));
                        }
                    }
                }
            }

            function openCourseResource(item, isLocked, lockReason) {
                if(!isOwned) {
                    if(window.showToast) window.showToast('هذا المحتوى غير متاح حتى تشترك بالكورس','error');
                    else alert('هذا المحتوى غير متاح حتى تشترك بالكورس');
                    return;
                }
                if(isLocked) {
                    if(window.showToast) window.showToast(lockReason || 'هذا المحتوى مقفول حالياً', 'error');
                    else alert(lockReason || 'هذا المحتوى مقفول حالياً');
                    return;
                }
                
                if(item.type === 'video' && (item.youtubeUrl || item.videoUrl)) {
                    const modal = document.getElementById('videoModal');
                    if(modal) {
                        document.getElementById('videoModalTitle').textContent = item.title;
                        const container = document.getElementById('videoPlayerContainer');
                        if(item.youtubeUrl) {
                            let videoId = '';
                            try {
                                const urlObj = new URL(item.youtubeUrl);
                                if(urlObj.hostname.includes('youtube.com')) videoId = urlObj.searchParams.get('v');
                                else if(urlObj.hostname.includes('youtu.be')) videoId = urlObj.pathname.slice(1);
                            } catch(e) {}
                            if(videoId) {
                                container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                            } else {
                                window.open(item.youtubeUrl, '_blank');
                            }
                        } else if (item.videoUrl) {
                            const posterAttr = item.thumbnail ? `poster="${item.thumbnail}"` : '';
                            container.innerHTML = `<video width="100%" height="100%" controls controlsList="nodownload" autoplay ${posterAttr}><source src="${item.videoUrl}" type="video/mp4">متصفحك لا يدعم تشغيل الفيديو.</video>`;
                            const vidEl = container.querySelector('video');
                            if(vidEl) {
                                vidEl.onended = () => {
                                    markItemCompleted(item.id);
                                    if(window.showToast) window.showToast('تم اكتمال مشاهدة الدرس بنجاح!', 'success');
                                    setTimeout(() => window.location.reload(), 1500);
                                };
                            }
                        }
                        if(item.youtubeUrl) markItemCompleted(item.id);
                        modal.classList.add('active');
                    } else {
                        window.open(item.youtubeUrl || item.videoUrl, '_blank');
                    }
                    return;
                }
                
                if(item.type === 'task' || item.type === 'quiz') {
                    // Find it across all sections
                    let targetList = [];
                    let idx = -1;
                    normalizedContents.sections.forEach(sec => {
                        sec.items.forEach(i => targetList.push(i));
                    });
                    idx = targetList.findIndex(x => x.id === item.id);
                    if(idx > -1 && window.openExamModal) {
                        // For backwards compat with exam system, we'll just mock the list
                        course.contents.exams = targetList;
                        window.openExamModal(course.id, idx, item.type === 'quiz' ? 'exam' : 'task');
                        return;
                    }
                }
                
                if(item.type === 'pdf' && item.pdfUrl) {
                    window.open(item.pdfUrl, '_blank');
                    return;
                }
                
                if(window.showToast) window.showToast('افتح المحتوى: ' + item.title, 'success');
                else alert('افتح المحتوى: ' + item.title);
            }

            function toItemIcon(type) {
                if(type === 'video') return 'fa-play-circle';
                if(type === 'pdf') return 'fa-file-pdf';
                if(type === 'task') return 'fa-edit';
                if(type === 'quiz') return 'fa-star';
                if(type === 'header') return 'fa-heading';
                return 'fa-file';
            }

            const sectionsContainer = document.getElementById('cdSectionsContainer');
            if (sectionsContainer) {
                sectionsContainer.innerHTML = '';
                
                normalizedContents.sections.forEach((sec, sIdx) => {
                    const secWrapper = document.createElement('div');
                    secWrapper.style.cssText = 'border:1px solid rgba(255,255,255,0.1); border-radius: 18px; overflow: hidden; background: rgba(255,255,255,0.02); margin-bottom: 20px;';
                    
                    const header = document.createElement('button');
                    header.type = 'button';
                    header.style.cssText = 'width:100%; text-align:right; padding: 22px 24px; display:flex; align-items:center; justify-content:space-between; gap:15px; background: rgba(0,0,0,0.2); border:none; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--text-primary); cursor: pointer;';
                    
                    header.innerHTML = `
                        <div style="display:flex; align-items:center; gap:16px; flex:1;">
                            <i class="fas fa-folder-open text-gold" style="font-size:1.4rem;"></i>
                            <div style="text-align:right; min-width:0;">
                                <div style="font-size:1.2rem; font-weight:bold; color: var(--accent-cyan); white-space:normal;">${sec.title}</div>
                                <div style="color: rgba(255,255,255,0.5); font-size:0.9rem; margin-top:4px;">${(sec.items || []).filter(i => i.type !== 'header').length} محتويات</div>
                            </div>
                        </div>
                        <i class="fas fa-chevron-down" style="color: rgba(255,255,255,0.5); transition: transform 0.3s;" id="chevron_${sIdx}"></i>
                    `;

                    const details = document.createElement('div');
                    // Start expanded if it's the first section
                    const isFirst = sIdx === 0;
                    details.style.cssText = `max-height: ${isFirst ? '2000px' : '0'}; overflow: hidden; transition: max-height 0.4s ease; background: transparent;`;
                    if (isFirst) {
                        setTimeout(() => { header.querySelector('i.fa-chevron-down').style.transform = 'rotate(180deg)'; }, 50);
                    }

                    const detailsInner = document.createElement('div');
                    detailsInner.style.cssText = 'display:flex; flex-direction:column; gap:12px; padding: 20px;';

                    if(!sec.items || sec.items.length === 0) {
                        detailsInner.innerHTML = '<p style="color: rgba(255,255,255,0.4); text-align:center;">لا يوجد محتوى في هذا القسم.</p>';
                    } else {
                        sec.items.forEach(item => {
                            if (item.type === 'header') {
                                const hDiv = document.createElement('div');
                                hDiv.style.cssText = 'margin-top: 15px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--royal-gold); font-weight: bold; font-size: 1.1rem; display: flex; align-items: center; gap: 10px;';
                                hDiv.innerHTML = `<i class="fas fa-bookmark"></i> ${item.title}`;
                                detailsInner.appendChild(hDiv);
                                return;
                            }

                            // Dynamic LMS Checks (Dependencies and Dates)
                            let isLocked = false;
                            let lockReason = '';
                            
                            if (item.dependsOn) {
                                if (!isItemCompleted(item.dependsOn)) {
                                    isLocked = true;
                                    lockReason = 'يجب إكمال المحتوى السابق أولاً';
                                }
                            }
                            
                            if (item.availabilityDate) {
                                const availTime = new Date(item.availabilityDate).getTime();
                                if (Date.now() < availTime) {
                                    isLocked = true;
                                    const dateStr = new Date(item.availabilityDate).toLocaleDateString('ar-EG');
                                    lockReason = `سيكون متاحاً يوم ${dateStr}`;
                                }
                            }

                            const row = document.createElement('div');
                            row.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-radius:12px; background: rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); ${isLocked ? 'opacity: 0.6; filter: grayscale(0.8); cursor: not-allowed;' : ''}`;

                            const isCompleted = isItemCompleted(item.id);
                            const iconColor = isLocked ? 'rgba(255,255,255,0.4)' : (isCompleted ? '#2ecc71' : 'var(--accent-cyan)');
                            const statusBadge = isCompleted ? `<span style="background:#2ecc71; color:#000; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-right:8px;">مكتمل</span>` : '';

                            row.innerHTML = `
                                <div style="display:flex; align-items:center; gap:15px; flex:1;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">
                                        <i class="fas ${toItemIcon(item.type)}" style="color: ${iconColor}; font-size: 1.2rem;"></i>
                                    </div>
                                    <div style="min-width:0;">
                                        <div style="color: var(--text-primary); font-weight: 700; font-size: 1.05rem;">${item.title} ${statusBadge}</div>
                                        <div style="font-size:0.8rem; color: rgba(255,255,255,0.5); margin-top: 4px;">
                                            ${item.type === 'video' ? 'فيديو مسجل' : item.type === 'pdf' ? 'مذكرة' : item.type === 'task' ? 'واجب وتدريب' : 'امتحان'}
                                            ${item.deadlineDate ? ` <span style="color: #e74c3c; margin-right: 10px;"><i class="fas fa-clock"></i> الديدلاين: ${new Date(item.deadlineDate).toLocaleDateString('ar-EG')}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;

                            const actionBtn = document.createElement('button');
                            actionBtn.className = 'btn btn-outline';
                            actionBtn.style.cssText = 'padding: 8px 16px; border-radius: 8px; font-size: 0.9rem; white-space: nowrap;';
                            
                            if (isLocked) {
                                actionBtn.innerHTML = '<i class="fas fa-lock"></i> مقفول';
                                actionBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                                actionBtn.style.color = 'rgba(255,255,255,0.5)';
                            } else {
                                actionBtn.textContent = isOwned ? (isCompleted ? 'مراجعة' : 'بدء') : 'اشترك لفتح';
                                if (isCompleted) {
                                    actionBtn.style.borderColor = '#2ecc71';
                                    actionBtn.style.color = '#2ecc71';
                                } else {
                                    actionBtn.style.borderColor = 'var(--accent-cyan)';
                                    actionBtn.style.color = 'var(--accent-cyan)';
                                }
                            }
                            
                            actionBtn.addEventListener('click', () => openCourseResource(item, isLocked, lockReason));
                            row.appendChild(actionBtn);
                            detailsInner.appendChild(row);
                        });
                    }

                    details.appendChild(detailsInner);

                    header.addEventListener('click', () => {
                        const chevron = header.querySelector('i.fa-chevron-down');
                        if(details.style.maxHeight === '0px' || !details.style.maxHeight) {
                            details.style.maxHeight = '2000px';
                            chevron.style.transform = 'rotate(180deg)';
                        } else {
                            details.style.maxHeight = '0';
                            chevron.style.transform = 'rotate(0deg)';
                        }
                    });

                    secWrapper.appendChild(header);
                    secWrapper.appendChild(details);
                    sectionsContainer.appendChild(secWrapper);
                });
            }
