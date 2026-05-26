// --- DYNAMIC SECTIONS REPLACEMENT ---

function migrateCourseToSections(contents) {
    if (contents && Array.isArray(contents.sections)) {
        return contents; // already migrated
    }
    
    let sections = [];
    const c = contents || {};
    
    if (c.lectures && c.lectures.length) {
        let items = [];
        c.lectures.forEach(lec => {
            if (lec.children && lec.children.length) {
                // Flatten children into the section
                let lecHeader = { id: lec.id || 'lec_'+Date.now(), title: lec.title, type: 'header', thumbnail: lec.thumbnail };
                items.push(lecHeader);
                lec.children.forEach(child => items.push(child));
            } else {
                items.push(lec);
            }
        });
        sections.push({ id: 'sec_lectures', title: 'المحاضرات', items: items });
    }
    
    if (c.homeworks && c.homeworks.length) {
        sections.push({ id: 'sec_homeworks', title: 'الواجبات', items: c.homeworks });
    }
    
    if (c.exams && c.exams.length) {
        sections.push({ id: 'sec_exams', title: 'الامتحانات', items: c.exams });
    }
    
    if (c.customSections && c.customSections.length) {
        c.customSections.forEach((sec, idx) => {
            sections.push({ id: 'sec_custom_'+idx, title: sec.name || 'قسم مخصص', items: sec.items || [] });
        });
    }

    if (sections.length === 0) {
        sections.push({ id: 'sec_default', title: 'القسم الأول', items: [] });
    }

    return { sections: sections };
}

function renderContentLists() {
    const container = document.getElementById('fcSectionsContainer');
    if(!container) return;
    container.innerHTML = '';
    
    if(!tempContents.sections) {
        tempContents = migrateCourseToSections(tempContents);
    }

    tempContents.sections.forEach((sec, sIdx) => {
        const secDiv = document.createElement('div');
        secDiv.style.cssText = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 20px;';
        
        secDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <i class="fas fa-folder-open text-gold" style="font-size: 1.5rem;"></i>
                    <input type="text" value="${sec.title}" class="form-control" style="font-size: 1.2rem; font-weight: bold; background: transparent; border: none; color: var(--accent-cyan); width: 100%; max-width: 300px;" onchange="updateSectionTitle(${sIdx}, this.value)" placeholder="اسم القسم">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-outline" style="padding: 5px 12px; font-size: 0.85rem;" onclick="addSectionItem(${sIdx})"><i class="fas fa-plus"></i> إضافة محتوى</button>
                    <button class="btn btn-outline" style="padding: 5px 12px; font-size: 0.85rem; border-color: #e74c3c; color: #e74c3c;" onclick="removeSection(${sIdx})"><i class="fas fa-trash"></i> حذف القسم</button>
                </div>
            </div>
            <div id="sectionItems_${sIdx}" style="display: flex; flex-direction: column; gap: 10px;"></div>
        `;
        
        container.appendChild(secDiv);
        
        const itemsContainer = document.getElementById('sectionItems_' + sIdx);
        if(!sec.items || sec.items.length === 0) {
            itemsContainer.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.4); padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px;">لا يوجد محتوى في هذا القسم. اضغط على إضافة محتوى.</div>';
        } else {
            sec.items.forEach((item, iIdx) => {
                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px;';
                
                let icon = 'fa-file';
                if(item.type === 'video') icon = 'fa-play-circle';
                else if(item.type === 'pdf') icon = 'fa-file-pdf';
                else if(item.type === 'task') icon = 'fa-edit';
                else if(item.type === 'quiz') icon = 'fa-star';
                else if(item.type === 'header') icon = 'fa-heading';

                // Core fields
                let html = `
                    <div style="display: flex; align-items: flex-start; gap: 15px;">
                        <select onchange="updateItemType(${sIdx}, ${iIdx}, this.value)" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; padding: 5px; width: 120px;">
                            <option value="video" ${item.type==='video'?'selected':''}>فيديو (درس)</option>
                            <option value="pdf" ${item.type==='pdf'?'selected':''}>مذكرة (PDF)</option>
                            <option value="task" ${item.type==='task'?'selected':''}>تدريب / واجب</option>
                            <option value="quiz" ${item.type==='quiz'?'selected':''}>امتحان شامل</option>
                            <option value="header" ${item.type==='header'?'selected':''}>عنوان فرعي</option>
                        </select>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                            <input type="text" class="form-control" value="${item.title || ''}" onchange="updateItemField(${sIdx}, ${iIdx}, 'title', this.value)" placeholder="عنوان المحتوى (مثال: الحصة الأولى)" style="padding: 8px; border: 1px solid rgba(255,255,255,0.2);">
                `;

                // URL fields based on type
                if (item.type === 'video') {
                    html += `<input type="text" class="form-control" value="${item.videoUrl || item.youtubeUrl || ''}" onchange="updateItemUrl(${sIdx}, ${iIdx}, 'video', this.value)" placeholder="رابط الفيديو (سيرفر أو يوتيوب)" style="padding: 6px; font-size: 0.9rem;">`;
                    html += `<input type="text" class="form-control" value="${item.thumbnail || ''}" onchange="updateItemField(${sIdx}, ${iIdx}, 'thumbnail', this.value)" placeholder="رابط الصورة المصغرة (اختياري)" style="padding: 6px; font-size: 0.9rem;">`;
                } else if (item.type === 'pdf') {
                    html += `<input type="text" class="form-control" value="${item.pdfUrl || ''}" onchange="updateItemUrl(${sIdx}, ${iIdx}, 'pdf', this.value)" placeholder="رابط المذكرة (PDF)" style="padding: 6px; font-size: 0.9rem;">`;
                }

                // Advanced LMS fields (Availability, Deadline, Depends On)
                if (item.type !== 'header') {
                    html += `
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 5px;">
                            <div style="flex: 1; min-width: 150px;">
                                <label style="font-size: 0.8rem; color: #aaa; margin-bottom: 2px; display: block;">تاريخ الإتاحة (لفتح الدرس)</label>
                                <input type="datetime-local" class="form-control" value="${item.availabilityDate || ''}" onchange="updateItemField(${sIdx}, ${iIdx}, 'availabilityDate', this.value)" style="padding: 4px; font-size: 0.8rem;">
                            </div>
                            <div style="flex: 1; min-width: 150px;">
                                <label style="font-size: 0.8rem; color: #e74c3c; margin-bottom: 2px; display: block;">الموعد النهائي (الديدلاين)</label>
                                <input type="datetime-local" class="form-control" value="${item.deadlineDate || ''}" onchange="updateItemField(${sIdx}, ${iIdx}, 'deadlineDate', this.value)" style="padding: 4px; font-size: 0.8rem;">
                            </div>
                            <div style="flex: 1; min-width: 150px;">
                                <label style="font-size: 0.8rem; color: #3498db; margin-bottom: 2px; display: block;">يعتمد على (مقفل حتى يُنجز)</label>
                                <select class="form-control" onchange="updateItemField(${sIdx}, ${iIdx}, 'dependsOn', this.value)" style="padding: 4px; font-size: 0.8rem;">
                                    <option value="">-- لا يوجد (متاح فوراً) --</option>
                                    ${generateDependsOnOptions(sIdx, iIdx, item.dependsOn)}
                                </select>
                            </div>
                        </div>
                    `;
                }

                html += `
                        </div>
                        <button class="btn btn-outline" style="padding: 6px 10px; border-color: #e74c3c; color: #e74c3c;" onclick="removeItem(${sIdx}, ${iIdx})" title="حذف المحتوى"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                
                itemDiv.innerHTML = html;
                itemsContainer.appendChild(itemDiv);
            });
        }
    });
}

function generateDependsOnOptions(currentSIdx, currentIIdx, selectedVal) {
    let optionsHtml = '';
    tempContents.sections.forEach((sec, sIdx) => {
        if(sec.items) {
            sec.items.forEach((item, iIdx) => {
                // Cannot depend on itself or items after it (to avoid circular deps)
                if(sIdx > currentSIdx || (sIdx === currentSIdx && iIdx >= currentIIdx)) return;
                if(item.type === 'header') return;
                
                const isSelected = (item.id === selectedVal) ? 'selected' : '';
                optionsHtml += `<option value="${item.id}" ${isSelected}>${item.title || 'بدون اسم'}</option>`;
            });
        }
    });
    return optionsHtml;
}

window.addNewSection = function() {
    if(!tempContents.sections) tempContents.sections = [];
    tempContents.sections.push({ id: 'sec_' + Date.now(), title: 'قسم جديد', items: [] });
    markUnsaved();
    renderContentLists();
};

window.removeSection = function(sIdx) {
    if(confirm('هل أنت متأكد من حذف هذا القسم بالكامل بما يحتويه؟')) {
        tempContents.sections.splice(sIdx, 1);
        markUnsaved();
        renderContentLists();
    }
};

window.updateSectionTitle = function(sIdx, val) {
    tempContents.sections[sIdx].title = val;
    markUnsaved();
};

window.addSectionItem = function(sIdx) {
    if(!tempContents.sections[sIdx].items) tempContents.sections[sIdx].items = [];
    tempContents.sections[sIdx].items.push({
        id: 'item_' + Date.now(),
        title: 'محتوى جديد',
        type: 'video'
    });
    markUnsaved();
    renderContentLists();
};

window.removeItem = function(sIdx, iIdx) {
    if(confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
        tempContents.sections[sIdx].items.splice(iIdx, 1);
        markUnsaved();
        renderContentLists();
    }
};

window.updateItemField = function(sIdx, iIdx, field, val) {
    tempContents.sections[sIdx].items[iIdx][field] = val;
    markUnsaved();
};

window.updateItemType = function(sIdx, iIdx, type) {
    tempContents.sections[sIdx].items[iIdx].type = type;
    markUnsaved();
    renderContentLists();
};

window.updateItemUrl = function(sIdx, iIdx, type, val) {
    const item = tempContents.sections[sIdx].items[iIdx];
    if(type === 'video') {
        if(val.includes('youtube') || val.includes('youtu.be')) {
            item.youtubeUrl = val;
            item.videoUrl = '';
        } else {
            item.videoUrl = val;
            item.youtubeUrl = '';
        }
    } else if (type === 'pdf') {
        item.pdfUrl = val;
    }
    markUnsaved();
};
